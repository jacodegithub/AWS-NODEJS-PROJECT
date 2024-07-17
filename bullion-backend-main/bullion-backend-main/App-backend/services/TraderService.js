const axios = require('axios')
const TraderModel = require("../Models/TraderModel");
const bullionOrderModel = require('../Models/bullionOrderModel');
const Enums = require("../_helpers/Enums");
const timeStampTypes = require("../_helpers/Enums").Trader.RateSource.timeStampTypes
const NodeCache = require('node-cache');
const ItemsModel = require('../Models/ItemsModel');
const quoteCache = new NodeCache({ stdTTL: 180 }) // Expire keys after 3 minutes of timeout
const { orderAccepted } = Enums.bullionOrderStatus;
const EmailService = new (require('../users/EmailService'))();
const logger = require("../_helpers/logger");
const config = require('../config.json');
const { captureException } = require('@sentry/node');
const reportingEmails = config.reportingEmails
const { maxRetryCount, delayMs } = config.externalAPIRetryParams

let lastEmailSentAt = 0

async function generateAPIKey(trader) {
  try {
    const apiDetails = trader.apiDetails
    const lastAuthenticationTime = new Date(apiDetails.lastAuthenticationTime).getTime()

    if ((Date.now() - lastAuthenticationTime) > apiDetails.JWTValidityMs) {
      const apiURL = apiDetails.url;
      const apiCredentials = apiDetails.loginCredentials;
      const { endpoint, username, password } = apiCredentials
      const response = await axios.post(apiURL + endpoint,
        {
          [username.key]: username.value,
          [password.key]: password.value
        },
        {
          timeout: 1000
        })

      const apiKey = response.data.data.token;
      trader.apiDetails.key = apiKey;
      trader.apiDetails.lastAuthenticationTime = new Date();
      await trader.save();

      return apiKey;
    }
    return apiDetails.key

  } catch (error) {
    captureException(error)
    console.error(error)
  }
}

async function getQuote(traderId, item) {
  const traderIdStr = toString(traderId);
  const { commodityName } = item
  const quoteCacheKey = traderIdStr + ":" + commodityName
  let trader;
  try {

    if (quoteCache.has(quoteCacheKey)) {
      return quoteCache.get(quoteCacheKey)
    }
    trader = await TraderModel.findOne({ _id: traderId });

    await generateAPIKey(trader);

    const apiDetails = trader.apiDetails
    const apiURL = apiDetails.url;
    const rateSource = apiDetails.rate;
    const apiKey = await generateAPIKey(trader);
    const response = await axios.get(apiURL + rateSource.endpoint + commodityName,
      {
        headers: {
          "Authorization": "Bearer " + apiKey
        },
        timeout: 1000
      })
    const rateData = response.data.data;
    const quoteData = {
      quote: rateData[rateSource.quoteKey],
      checksum: rateData[rateSource.checksumKey],
      expiryTime: calculateExpiry(rateData[rateSource.timeStampKey], rateSource.timeStampType, rateSource.quoteExpirySeconds)
    }
    quoteCache.set(quoteCacheKey, quoteData);
    return quoteData;
  } catch (error) {
    captureException(error)
    console.error(error);
    reportRatesError(trader, error);
    return {
      quote: null,
      checksum: null,
      expiryTime: null
    }
  }
}

async function sendOrder(trader, orderData) {
  try {
    await retryWithExpBackoff(0, () => sendPostRequest(trader, orderData))
  } catch (error) {
    captureException(error)
    await bullionOrderModel.findOneAndUpdate({ orderId: orderData.orderId },
      { $set: { "orderStatus": Enums.Order.Status.failure } });
    logger.error(error);
    await reportError(trader, orderData, error);
  }
}

async function getOrderStatus(orderData) {
  try {
    const trader = orderData.item.traderId
    const apiDetails = trader.apiDetails
    const apiURL = apiDetails.url
    const apiKey = await generateAPIKey(trader);
    const response = await axios.get(apiURL + "orders/status", {
      headers: {
        "Authorization": "Bearer " + apiKey
      },
      timeout: 2000,
      params: {
        userEmail: apiDetails.order.fieldAssocs.userEmail,
        internalId: orderData.orderId
      }
    })
    return response.data
  } catch (error) {
    captureException(error)
    console.error(error)
    throw error
  }
}

function calculateExpiry(timeStamp, timeStampType, quoteExpirySeconds) {
  const quoteExpiryMs = quoteExpirySeconds * 1000;
  switch (timeStampType) {
    case timeStampTypes.epoch:
      const d = new Date(parseInt(parseInt(timeStamp) + parseInt(quoteExpiryMs)));
      return d;
    default:
      return new Date();
  }
}

function calculateEpoch(timeStampString) {
  let dateObj = new Date(timeStampString);
  return dateObj.getTime();
}

module.exports = { generateAPIKey, getQuote, sendOrder, getOrderStatus }

function mapOrderData(APIFieldsAssoc, orderData, orderId) {
  let externalData = {};
  for (const externalField in APIFieldsAssoc) {
    const internalField = APIFieldsAssoc[externalField];
    let internalValue;
    switch (internalField) {
      case "expiryTime":
        internalValue = calculateEpoch(orderData[internalField]) - 300 * 1000
        break
      case "id":
        internalValue = orderId
        break
      default:
        internalValue = orderData[internalField] || internalField;
    }

    externalData[externalField] = internalValue
  }
  return externalData;
}

async function sendPostRequest(trader, orderData) {
  await generateAPIKey(trader);
  const apiDetails = trader.apiDetails
  const apiURL = apiDetails.url
  const ordersAPIParams = apiDetails.order;
  const apiKey = await generateAPIKey(trader);
  orderData.commodityName = orderData?.itemId?.commodityName;

  const orderBody = mapOrderData(ordersAPIParams.fieldAssocs, orderData, orderData.orderId)
  logger.info("Sending request to Trader API at: " + apiURL)
  const response = await axios.post(apiURL + ordersAPIParams.endpoint,
    orderBody,
    {
      headers: {
        "Authorization": "Bearer " + apiKey
      }
    })

  await updateStatustoAccepted(response, orderData.orderId)
}

async function exponentialBackoffDelay(retryCount) {
  const delayDurationMs = (delayMs ** (retryCount + 1)) * 1000 //adding 1 to avoid 0th power
  logger.info("Waiting for " + delayDurationMs + "ms for next retry");
  await new Promise(resolve => setTimeout(resolve, delayDurationMs));
}

async function retryWithExpBackoff(retryCount = 0, func) {
  try {
    logger.info("Retry Count: " + retryCount)
    response = await func()
    return response;
  } catch (e) {
    captureException(e)
    logger.error(e)
    if (retryCount == maxRetryCount) throw e
    await exponentialBackoffDelay(retryCount);
    return retryWithExpBackoff(retryCount + 1, func);
  }
};

async function updateStatustoAccepted(response, orderId) {
  const statusObj = {
    status: orderAccepted,
    createdAt: new Date(),
  };
  const updateObject = {
    $set: {
      "metadata.externalOrderId": response.data.data.orderId,
      "currentStatus": orderAccepted
    },
    $push: { "statusHistory": statusObj },
  };
  await bullionOrderModel.findOneAndUpdate(
    { orderId: orderId },
    updateObject);
}

async function reportError(trader, orderData, error) {
  const subject = "[Urgent] | Gordian <> " + trader.name + " | Order Failure Notification"
  let text = "Dear Team, \n";
  text += "There was an issue while creating a order using the API. Following are the order details: \n";
  text += "\n orderId: " + orderData.orderId;
  text += "\n Quantity: " + orderData.quantity;
  text += "\n Rate: " + orderData.quote
  text += "\n Order Creation Time: " + orderData.created_at;
  text += "\n Error: " + JSON.stringify(error?.response?.data)
  text += "\n\n\n\n\n This email is auto generated, please do not reply."

  await sendEmail(trader, subject, text)
}

async function reportRatesError(trader, error) {
  const subject = "Gordian <> " + trader.name + " | Rates API Failure Notification"
  let text = "Dear Team, \n";
  text += "There was an issue while receiving rates from the API. Following are the error details: \n";
  text += "\n Error: " + JSON.stringify(error?.response?.data)
  text += "\n\n\n\n\n This email is auto generated, please do not reply."

  // await sendEmail(trader, subject, text)
}

async function sendEmail(trader, subject, emailText) {
  const senderList = reportingEmails?.concat(trader.supportEmails)

  if (senderList.length > 0) {
    if (lastEmailSentAt === 0 || Date.now() - lastEmailSentAt > config.emailReportingIntervalMs) {
      EmailService.send(senderList, subject, "", emailText)
      lastEmailSentAt = Date.now()
    }
  }
  else
    logger.info(text)
}
