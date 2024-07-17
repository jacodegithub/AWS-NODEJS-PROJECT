const ItemsModel = require("../Models/ItemsModel");
const TraderModel = require("../Models/TraderModel");
const ZerodhaService = require("./ZerodhaService");
const logger = require("../_helpers/logger");
const Enums = require("../_helpers/Enums");
const bcrypt = require("bcryptjs");
const ObjectID = require('mongodb').ObjectID;
const authenticator = new (require("../security/authenticator"))();
const { generateQuoteChecksum } = require("../_helpers/checksum");
const UserModel = require("../Models/UserModel");
const CompanyModel = require("../Models/CompanyModel");
const MarginTransactionModel = require("../Models/MarginTransactionModel");
const traderService = require("./TraderService");
const markupHistoryModel = require('../Models/MarkupHistoryModel');
const bullionOrderModel = require('../Models/bullionOrderModel')
const WhatsappService = new (require("../users/WhatsappService"))();
const taxConstants = require("../config.json").taxConstants;
const TookanService = new (require("../users/TookanService"))()
const deliveryOrderService = require("../users/orders_service")
const { sendOrderConfirmationMail } = require("./EmailSenderService");
const { captureException } = require("@sentry/node");
const allowedStatusTransitions = require("../config.json").allowedBullionOrderStatusTransitions

module.exports = {
  getTraders,
  getTraderbyId,
  getItemById,
  getItems,
  getQuotes,
  getQuote,
  getQuotesv2,
  getQuotev2,
  blockMargin,
  authenticateUsingEmailPassword,
  refreshAccessToken,
  updateMarkup,
  validateQuoteExpiry, validateChecksum,
  validateOrder,
  performPreOrderOperations,
  createOrder,
  placeOrderWithExternalTrader,
  performPostOrderOperations,
  placeBullionOrder,
  getBullionOrder,
  updateOrderStatus,
  updateOrderReceiverAddress,
  getOrdersForUser,
  getOrdersForAdmin,
  updatePickupAddress,
  trackBullionOrder,
  addPaymentReference,
};

async function getItems(query = {}) {
  try {
    return await ItemsModel.find(query);
  } catch (e) {
    captureException(e)
    logger.error("BullionService::getItems::UncaughtError", e);
    throw e;
  }
}

async function getOrdersForAdmin() {
  const orders = await bullionOrderModel.find({
    currentStatus: { $ne: Enums.bullionOrderStatus.adminDeleted }
  })
  return orders
}

async function getOrdersForUser(userId, queryParams = null) {
  let query = {}
  const status = queryParams?.status;

  // TODO: Extract this into a filter function
  if ((status !== null) && (Array.isArray(status) && status.length > 0)) {
    query = {
      $and: [
        { userId: userId },
        { currentStatus: { $in: status } }
      ]
    }
  } else {
    query = { userId }
  }

  const select = {}
  const sort = { "created_at": -1 };

  const orders = await bullionOrderModel.find(query)
    .select(select)
    .sort(sort)
    .populate({
      path: "userId", select: [
        "_id",
        "email",
        "fullName",
        "phonenumber",
      ]
    })
    .populate({
      path: "itemId",
      select: [
        "_id",
        "commodityName",
        "baseTradingWeightInGram",
        "baseTradingWeightUnitSymbol",
        "name",
        "type",
        "exchangeTradingSymbol",
      ]
    })
    .populate({
      path: "traderId",
      select: [
        "_id",
        "name",
        "logo",
        "email",
      ]
    })

  return orders
}


async function updatePickupAddress(updateBody) {
  const { orderIds, address, buildingName, number, location } = updateBody
  for (let i = 0; i < orderIds.length; i++) {
    const orderId = orderIds[i];
    const query = { orderId }
    const order = await bullionOrderModel.findOne(query);
    const updateObject = {
      senderAdd: address,
      senderBuilding: buildingName,
      senderContact: number,
      senderLocation: location
    }
    if (order) {
      await bullionOrderModel.findOneAndUpdate(query, updateObject)
    }
  }
}

async function getTraders() {
  try {
    return await TraderModel.find({ isEnabled: true }, {
      passwordHash: 0,
      markupHistory: 0,
      rate_source: 0,
      order_confirmation_method: 0
    });
  } catch (e) {
    captureException(e)
    logger.error("BullionService::getTraders::UncaughtError", e);
    throw e;
  }
}

async function getItemById(id) {
  try {
    return await ItemsModel.findById(id);
  } catch (e) {
    captureException(e)
    logger.error("BullionService::getItemById::UncaughtError", e);
    throw e;
  }
}

async function getTraderbyId(Id) {
  try {
    return await TraderModel.findById(Id, {
      passwordHash: 0,
      markupHistory: 0,
      rate_source: 0,
      order_confirmation_method: 0
    });
  } catch (e) {
    captureException(e)
    logger.error("BullionService::getTraderbyId::UncaughtError", e);
    throw e;
  }
}

async function getQuotesv2(itemId) {
  try {
    const item = await ItemsModel.findById(itemId)
    const traders = await TraderModel.find({
      "items.itemId": itemId,
      isEnabled: true
    }, {
      markup: 1,
      isAPIEnabled: 1,
      name: 1,
      logo_url: 1,
      items: 1,
      paymentTerms: 1,
    })
    const traderquotes = [];
    for (let i = 0; i < traders.length; i++) {
      var trader = traders[i];
      try {
        const quote = await getQuotev2(trader, item);
        traderquotes.push(quote);
      } catch (e) {
        logger.error("BullionService::getQuotev2::UncaughtError", e);
        throw e;
      }
    }
    return traderquotes;
  } catch (e) {
    logger.error("BullionService::getQuotesv2::UncaghtError", e);
    throw e;
  }
}

async function getQuotev2(trader, item) {
  const seconds = 1000; // Date.now() returns milliseconds since epoch
  // TODO: Fetch the timeout from config
  const expirationSeconds = 1800;

  let ExpiryTime = new Date(Date.now() + expirationSeconds * seconds).toJSON();
  let traderQuote = {}
  const traderItem = trader?.items?.find(traderItem => traderItem.itemId.toString() === item._id.toString())
  const { markup, isAPIEnabled, items, ...strippedTrader } = trader.toJSON()
  if (trader.isAPIEnabled) {
    const { quote, expiryTime, checksum } = await traderService.getQuote(trader._id, item)
    traderQuote = {
      itemId: item._id,
      baseTradingWeightInGram: item?.baseTradingWeightInGram || 10,
      baseTradingWeightUnitSymbol: item?.baseTradingWeightUnitSymbol || 'g',
      trader: strippedTrader,
      quote,
      expiryTime,
      checksum,
      ...traderItem.toJSON()
    }
  } else {
    const ltp = await ZerodhaService.getSellingPrice(item.exchangeTradingSymbol)
    const quote = getMarkedUpPrice(ltp, trader, item)
    traderQuote = {
      itemId: item._id,
      baseTradingWeightInGram: item?.baseTradingWeightInGram || 10,
      baseTradingWeightUnitSymbol: item?.baseTradingWeightUnitSymbol || 'g',
      trader: strippedTrader,
      quote: quote,
      expiryTime: ExpiryTime,
      ...traderItem.toJSON()
    }

    const checksum = generateQuoteChecksum(item._id, trader._id, traderQuote.quote, ExpiryTime)
    traderQuote.checksum = checksum
  }
  return traderQuote
}

async function getQuotes(itemId) {
  try {
    const item = await ItemsModel.findById(itemId);
    const traderIds = item.traders;
    const traders = await TraderModel.find({
      _id: { $in: traderIds },
      isEnabled: true
    }, {
      passwordHash: 0,
      markupHistory: 0,
      rate_source: 0,
      order_confirmation_method: 0,
      apiDetails: 0
    })
    const traderquotes = [];
    for (let i = 0; i < traders.length; i++) {
      var trader = traders[i];
      try {
        const quote = await getQuote(trader, item);
        traderquotes.push(quote);
      } catch (e) {
        logger.error("BullionService::getQuoteforTrader::UncaughtError", e);
        throw e;
      }
    }
    return traderquotes;
  } catch (e) {
    logger.error("BullionService::getQuotes::UncaghtError", e);
    throw e;
  }
}

async function getQuote(trader, item) {
  const seconds = 1000; // Date.now() returns milliseconds since epoch
  // TODO: Fetch the timeout from config
  const expirationSeconds = 180;
  let ExpiryTime = new Date(Date.now() + expirationSeconds * seconds).toJSON();
  let traderQuote = {}
  const traderItem = trader?.items?.find(traderItem => traderItem.itemId.toString() === item._id.toString())
  const quoteUnitInGram = traderItem.quoteUnitInGram || trader.quoteUnitInGram
  if (trader.isAPIEnabled) {
    const { quote, expiryTime, checksum } = await traderService.getQuote(trader._id, item)
    traderQuote = {
      itemId: item._id,
      trader,
      quote,
      quoteUnitInGram,
      expiryTime,
      checksum
    }
  } else {
    const ltp = await ZerodhaService.getSellingPrice(item.exchangeTradingSymbol)
    const quote = getMarkedUpPrice(ltp, trader, item)
    traderQuote = {
      itemId: item._id,
      trader: trader,
      quote: quote,
      quoteUnitInGram,
      expiryTime: ExpiryTime
    }

    const checksum = generateQuoteChecksum(item._id, trader._id, traderQuote.quote, ExpiryTime)
    traderQuote.checksum = checksum
  }


  return traderQuote
}

function getMarkedUpPrice(price, trader, item) {
  const traderItem = trader.items.find((traderItem) => traderItem.itemId.toString() === item._id.toString())
  if (traderItem?.markup) {
    return price + traderItem.markup
  }
  throw {
    status: 500,
    message: "Markup not setup for this item(" + item._id + ") and trader(" + trader._id + ")"
  }
}

async function blockMargin(order) {
  try {
    const { marginAmount, traderId } = order.item
    const userId = order.userId
    const theUser = await UserModel.findById(userId);
    if (theUser && theUser.GST && theUser.GST.companyId) {
      const theCompany = await CompanyModel.findById(theUser.GST.companyId);
      const margin = theCompany?.paymentTypes?.margin
      if (margin?.allowed) {
        margin.available -= marginAmount;
        margin.blocked += marginAmount

        theCompany.paymentTypes.margin = margin

        await MarginTransactionModel.create({
          orderId: order.orderId,
          userId,
          traderId,
          amount: marginAmount,
          statusHistory: [{
            status: Enums.MarginActions.blocked,
            createdAt: Date()
          }]
        })

        await theCompany.save();
      }
      else {
        throw {
          status: 401,
          message: "Margin is not enabled for user's company"
        }
      }
    }
    else {
      throw {
        status: 404,
        message: "User does not exists or company details not found"
      }
    }
  } catch (error) {
    console.log(error)
    throw {
      status: 500,
      message: "Internal Server Error"
    }
  }
}

async function authenticateUsingEmailPassword(email, password) {
  const trader = await TraderModel.findOne({ email: email });

  if (
    !trader ||
    !trader.passwordHash ||
    !areHashesMatching(password, trader.passwordHash)
  ) {
    throw {
      status: 401,
      message: "Email or password is incorrect",
    };
  }

  return generatedAuthResponse(trader);
}

async function refreshAccessToken(refreshToken) {
  try {
    const { sub } = authenticator.assertTokenIsValid(refreshToken);
    // Remove refresh token. Assert that it was removed
    const { deletedCount } = await authenticator.removeToken({
      user: sub,
      token: refreshToken,
    });
    if (deletedCount < 1) {
      console.error(
        "bullionService::refreshAccessToken::Failed to remove refreshToken from database"
      );
      throw {
        status: 401,
        message: "Invalid refresh token",
      };
    }

    const trader = await TraderModel.findOne({ _id: sub });
    if (!trader) {
      console.error(
        "bullionService::refreshAccessToken::Decoded refresh token but could not find user = ",
        sub
      );
      throw {
        status: 500,
        message: "Something went wrong. Please try again",
      };
    }

    return generatedAuthResponse(trader);
  } catch (e) {
    if (e.hasOwnProperty("status")) throw e;
    console.error(
      "UserService::refreshAccessToken::Failed to decode refresh token"
    );
    throw {
      status: 401,
      message: "Invalid refresh token",
    };
  }
}

async function updateMarkup(traderId, itemId, value) {
  try {
    let newMarkup = {
      value: value,
      created_at: Date.now()
    };
    await markupHistoryModel.findOneAndUpdate({
      traderId,
      itemId
    }, {
      $push: {
        markupHistory: newMarkup
      }
    }, { upsert: 1 })

    await TraderModel.findOneAndUpdate({
      _id: traderId,
      "items.itemId": itemId
    }, {
      $set:
        { "items.$.markup": value }
    })

  }
  catch (error) {
    logger.error(error)
    throw error
  }
}

function areHashesMatching(password, passwordHash) {
  return bcrypt.compareSync(password, passwordHash);
}

function generatedAuthResponse(user) {
  const { _id } = user;
  const { accessToken, refreshToken } = authenticator.generateTokenPairs(_id);

  return {
    name: user.name,
    logo_url: user.logo_url,
    jwtToken: accessToken,
    refreshToken,
    autoAcceptOrders: user.autoAcceptOrders,
    margin: user.margin,
    markup: user.markup,
    _id: user._id
  };
}

function validateQuoteExpiry(quote) {
  const currentTime = Date.now()
  if (quote.expiryTime) {
    const quotedExpiryTime = new Date(quote.expiryTime).getTime()
    if (quotedExpiryTime < currentTime) {
      throw {
        message: "Quote expired"
      }
    }
  }
  else {
    throw {
      message: "Quote does not have expiryTime"
    }
  }
}

function validateChecksum(itemId, traderId, quote, expiryTime, requestChecksum) {
  try {
    const checksum = generateQuoteChecksum(itemId, traderId, quote, expiryTime)
    if (requestChecksum !== checksum) {
      throw {
        message: 'Quote checkum invalid'
      }
    }
  } catch (error) {
    captureException(error)
    throw error
  }
}

function validateOrder(orderBody, trader) {
  try {
    const { itemId, traderId, quote, expiryTime, checksum } = orderBody
    if (!trader.isAPIEnabled) {
      validateChecksum(itemId, traderId, quote, expiryTime, checksum)
    }
    validateQuoteExpiry(orderBody)
  } catch (error) {
    captureException(error)
    console.log('Validation Error in BullionService::validateOrder', error)
    throw error
  }
}

async function performPreOrderOperations(trader, orderBody) {
  try {
    const amounts = await calculateAmounts(orderBody)
    const gordianMarkupDetails = calculateGordianMarkup(trader, orderBody, amounts)
    const orderId = `bullion_${Math.round(new Date().getTime() + Math.random())}`;
    const defaultSenderAddressDetails = getDefaultSenderAddressForBullion(trader);
    return {
      ...orderBody, ...amounts, orderId, ...defaultSenderAddressDetails, ...gordianMarkupDetails,
      currentStatus: Enums.bullionOrderStatus.orderCreated,
      statusHistory: {
        status: Enums.bullionOrderStatus.orderCreated,
        createdAt: new Date(),
      }
    }
  } catch (error) {
    captureException(error)
    logger.error('Exception in BullionService::performPreOrderOperations', error)
    throw error
  }
}

function calculateGordianMarkup(trader, orderBody, amounts) {
  const { itemId, quantity } = orderBody
  const { bullionAmount } = amounts
  const traderItem = trader?.items?.find(traderItem => traderItem?.itemId.toString() === itemId.toString())
  const traderItemJSON = traderItem.toJSON()

  const { gordianMarkup, quoteUnitInGram } = traderItemJSON
  let totalGordianMarkup = 0
  totalGordianMarkup = quantity * (gordianMarkup / quoteUnitInGram)
  const amountPayableToTrader = bullionAmount - totalGordianMarkup

  return { gordianMarkup, totalGordianMarkup, amountPayableToTrader }
}


function getDefaultSenderAddressForBullion(trader) {
  const defaultAddress = trader.savedAddresses.find(address => address.label === "default")
    || trader.savedAddresses[0];
  if (defaultAddress) {
    return {
      senderName: trader.name,
      senderAdd: defaultAddress.address,
      senderBuilding: defaultAddress.buildingName,
      senderContact: defaultAddress.number,
      senderLocation: defaultAddress.location
    }
  }
  else {
    throw {
      message: "Trader does not have a default address"
    }
  }
}

async function calculateAmounts(orderBody) {
  try {
    const { quote, quoteUnitInGram, quantity, userId } = orderBody
    const bullionAmount = Math.round(quantity * (quote / quoteUnitInGram))
    let tcs = 0;

    if (bullionAmount >= taxConstants.tcsAmountThreshold) {
      tcs = Math.round(bullionAmount * taxConstants.tcs)
    } else {
      const user = await UserModel.findOne({ _id: userId })
      const userCompany = user?.GST?.companyId
      if (userCompany) {
        const allUsers = await UserModel.find({ 'GST.companyId': userCompany })
        const companyUserIds = allUsers.map(user => user._id);
        const today = new Date();

        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        let lastAprilFirst;
        let comingMarchLast;

        if (currentMonth < 3) {
          lastAprilFirst = new Date(currentYear - 1, 3, 1);
          comingMarchLast = new Date(currentYear, 2, 31);
        } else {
          lastAprilFirst = new Date(currentYear, 3, 1);
          comingMarchLast = new Date(currentYear + 1, 2, 31);
        }

        const [data] = await bullionOrderModel.aggregate([
          {
            $match: {
              userId: { $in: companyUserIds },
              created_at: { $gte: lastAprilFirst, $lte: comingMarchLast }
            }
          },
          {
            $group: {
              _id: null,
              totalBullionAmount: { $sum: "$bullionAmount" }
            }
          }
        ])
        if (data?.totalBullionAmount >= taxConstants.tcsAmountThreshold) {
          tcs = Math.round(bullionAmount * taxConstants.tcs)
        }
      }
    }

    //calc the below based on item collection
    const totalAmount = bullionAmount + tcs
    return { bullionAmount, tcs, totalAmount }
  } catch (error) {
    captureException(error)
    logger.error(error)
    throw error
  }
}

async function getBullionOrder(userId, orderId) {
  try {
    const order = await getPopulatedBullionOrder(orderId)
    if (order?.userId?.id.toString() === userId) {
      return order
    } else {
      logger.error(`BullionService::getBullionOrder: OrderId: ${orderId} does not exist for user: ${userId}`)
      return null;
    }
  } catch (error) {
    captureException(error)
    logger.error("Unhandled exception in BullionService::getBullionOrder", error)
    throw error
  }
}

async function updateOrderReceiverAddress(orderId, body, userId) {
  try {
    const dbOrder = await bullionOrderModel.findOne({ userId: ObjectID(userId), orderId: orderId })
    const receiverDetails = body.receiverDetails
    if (dbOrder) {
      const updateOrder = {
        $set: {
          "receiverName": receiverDetails.receiverName,
          "receiverAdd": receiverDetails.receiverAdd,
          "receiverFlat": receiverDetails?.receiverFlat,
          "receiverBuilding": receiverDetails.receiverBuilding,
          "receiverContact": receiverDetails.receiverContact,
          "receiverLocation": receiverDetails.receiverLocation,
        }
      }
      const updatedOrder = await bullionOrderModel.findOneAndUpdate({ userId: ObjectID(userId), orderId: orderId }, updateOrder)
      return updatedOrder.toJSON()
    } else {
      logger.error("Order not found in BullionService::updateOrderReceiverAddress", orderId);
      return null
    }
  } catch (error) {
    captureException(error)
    logger.error("Unhandled exception in BullionService::updateOrderReceiverAddress", error)
    throw error
  }
}

async function createOrder(orderDTO) {
  try {
    const createdOrder = await bullionOrderModel.create(orderDTO)
    return createdOrder.toJSON()
  } catch (error) {
    captureException(error)
    logger.error('Exception in BullionService::createOrder', error)
    throw error
  }
}

async function addPaymentReference(orderId, paymentRef, userId) {
  try {
    const updateObject = {
      $set: { "payment.paymentRef": paymentRef },
    };
    await bullionOrderModel.findOneAndUpdate({ orderId, userId }, updateObject)
  } catch (err) {
    captureException(err)
    console.log("Exception in BullionService::addPaymentReference", err)
    throw err
  }
}

async function updateOrderStatus(orderId, status, userRole) {
  const dbOrder = await bullionOrderModel.findOne({ orderId })
  const order = dbOrder.toJSON()
  if (order) {
    let itemCurrentStatus = order.currentStatus;
    let allowedStatuses = allowedStatusTransitions[userRole][itemCurrentStatus];
    if (allowedStatuses && allowedStatuses.includes(status)) {
      const statusObj = {
        status: status,
        createdAt: new Date(),
      };
      const updateObject = {
        $set: { "currentStatus": status },
        $push: { "statusHistory": statusObj },
      };
      const updatedOrder = await bullionOrderModel.findOneAndUpdate({ orderId }, updateObject).then(
        sendNotificationOnStatusChange(orderId, status)
      )
      if (status === Enums.bullionOrderStatus.orderReadyForDispatch) {
        //createInvoice()
        createTookanOrder(order)
      }

      return updatedOrder;
    }
    else {
      throw {
        message: "Current status change not allowed for this user"
      }
    }
  }
  else {
    throw {
      message: "Order with given id not found"
    }
  }
}

function createTookanOrder(order) {
  const tookanOrder = {
    payment: {
      entity: {
        id: "", // payment_id
        order_id: "", //payment order_id
        method: Enums.PaymentMethod.gordian_wallet, //payment methof
        notes: {
          orderId: order.orderId, //gordian orderId
          paymentType: Enums.PaymentType.booking,
        },
      },
    },
    categoryId: "misc",
    deliveryMethod: "secure",
    ...order
  }
  TookanService.createTask(tookanOrder)
}

async function createDeliveryOrder(orderPayload) {
  const user = orderPayload.userId
  await deliveryOrderService.placeOrder(user, orderData)
}

async function getPopulatedBullionOrder(orderId) {
  const populatedOrder = await bullionOrderModel.findOne({ orderId })
    .populate("userId")
    .populate("itemId")
    .populate("traderId")
  return populatedOrder.toJSON()
}

async function sendNotificationOnStatusChange(orderId, status) {
  try {
    const detailedOrder = await getPopulatedBullionOrder(orderId)
    switch (status) {
      case Enums.bullionOrderStatus.paidToTrader: {
        //send whatsapp to trader
        let statusHistory = detailedOrder.statusHistory.find(c => c.status === Enums.bullionOrderStatus.paidToTrader)
        let statusDate = (statusHistory) ? statusHistory.createdAt : orderData.created_at
        WhatsappService.notifyTraderOnPayment(
          detailedOrder.traderId.phonenumber, //trader phone
          orderId,
          detailedOrder.traderId.name, //trader name
          detailedOrder.itemId.name, // item name
          detailedOrder.quantity,
          detailedOrder.quote,
          detailedOrder.bullionAmount,
          detailedOrder.totalAmount, //TODO: change this to total amount
          statusDate.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
        );
        break;
      }
      case Enums.Order.Status.ongoing: {
        WhatsappService.notifyUserOnDispatch(
          detailedOrder.userId.phonenumber, //user phone
          orderId,
          detailedOrder.traderId.name, //trader name
          detailedOrder.itemId.name, // item name
          detailedOrder.quantity
        );
        break;
      }
    }
  } catch (error) {
    captureException(error)
    logger.error(
      "BullionService::sendNotificationOnStatusChange::Failed to send msg",
      error
    );
  }

}

async function validateExistance(traderId, itemId) {
  try {
    const trader = await TraderModel.findById(traderId)
    const item = await ItemsModel.findById(itemId)
    if (trader && item) {
      return { trader, item }
    }
    throw {
      status: 404,
      message: "ItemId or traderId does not exists"
    }
  } catch (error) {
    captureException(error)
    logger.error('Validation Error in BullionService::validateExistance', error)
    throw error
  }

}

async function placeOrderWithExternalTrader(trader, orderDTO) {
  try {
    await traderService.sendOrder(trader, orderDTO)
  } catch (error) {
    captureException(error)
    logger.error(error)
    throw error
  }
}

async function performPostOrderOperations(trader, createdOrder) {
  const customerOrder = await getPopulatedBullionOrder(createdOrder.orderId)
  let traderOrder = Object.assign({}, customerOrder)
  if (trader.autoAcceptOrders) {
    checkAndAutoAcceptOrder(createdOrder.orderId)
  }
  if (trader.isAPIEnabled) {
    traderOrder = removeMarkupFromExternalOrder(trader, traderOrder)
    placeOrderWithExternalTrader(trader, traderOrder)
  }
  sendOrderConfirmationMail(customerOrder, traderOrder, Enums.Order.Type.product)
}

function removeMarkupFromExternalOrder(trader, order) {
  let { quote } = order
  const item = order.itemId
  const traderItem = trader?.items?.find(traderItem => traderItem?.itemId.toString() === item._id.toString())
  const traderItemJSON = traderItem.toJSON()
  const { gordianMarkup } = traderItemJSON

  order.quote = quote - gordianMarkup
  return order
}

async function checkAndAutoAcceptOrder(orderId) {
  const order = await bullionOrderModel
    .findOne({ orderId: orderId })
    .select({})
    .populate('traderId')

  order.statusHistory.push({
    status: Enums.bullionOrderStatus.orderAccepted,
    createdAt: new Date()
  })

  const updateBody = {
    "$set": {
      "statusHistory": order.statusHistory,
      "currentStatus": Enums.bullionOrderStatus.orderAccepted,
    }
  }
  const updatedOrder = await bullionOrderModel.findOneAndUpdate({ orderId: orderId }, updateBody)
  await updatedOrder.save()
  return order
}

async function placeBullionOrder(orderBody) {
  try {
    const { traderId, itemId } = orderBody
    const { trader, _item } = await validateExistance(traderId, itemId)
    validateOrder(orderBody, trader)
    const orderDTO = await performPreOrderOperations(trader, orderBody)
    const createdOrder = await createOrder(orderDTO)
    performPostOrderOperations(trader, createdOrder)
    return createdOrder
  } catch (error) {
    captureException(error)
    logger.error('Exception in BullionService::placeBullionOrder', error)
    throw error
  }
}

async function checkMarginRequirement(user, body) {
  const margin = await UserService.getMargin(user)
  const trader = await TraderModel.findById(body.item.traderId);
  await checkMarginExemption(trader, body);
  if (trader.margin.type != Enums.Trader.MarginType.absolute || trader.margin.value > margin.available) {
    throw {
      "status": 422,
      "message": "Insufficient margin available while placing Bullion order",
      "errors": [],
    }
  }
}
async function checkMarginExemption(trader, body) {
  //check if order is allowed without margin
  const { quantity } = body.item;
  const { exemption } = trader.margin;
  const { allowed, limit, current } = exemption;
  if (allowed === false || current + quantity > limit) {
    if (allowed === true) {
      await TraderModel.findByIdAndUpdate(trader._id, {
        $set: { "margin.exemption.allowed": false },
      });
    }
    throw {
      status: 424,
      message: "Not able to place order for this trader",
      errors: [],
    };
  }
}
async function updateMarginExemption(order) {
  const { item } = order;
  const { quantity, traderId } = item;
  const trader = await TraderModel.findById(traderId);
  const { margin, step } = trader;
  const { exemption } = margin;
  const { allowed, limit, current } = exemption;
  if (current + quantity > limit - step) {
    //set allowed to false for future orders
    if (allowed === true) {
      await TraderModel.findByIdAndUpdate(traderId, {
        $set: { "margin.exemption.allowed": false },
      });
    }
  } else {
    //add to current
    await TraderModel.findByIdAndUpdate(traderId, {
      $inc: { "margin.exemption.current": quantity },
    });
  }
}
async function clearMarginExemption(order) {
  try {
    const { item } = order;
    const { quantity, traderId } = item;
    const a = await TraderModel.findByIdAndUpdate(traderId, {
      $set: { "margin.exemption.allowed": true },
      $inc: { "margin.exemption.current": -quantity },
    });
  } catch { }
}

async function trackBullionOrder(userId, orderId) {
  const order = getBullionOrder(userId, orderId)
  if (!order) {
    return null;
  }

  if (order?.currentStatus !== Enums.bullionOrderStatus.orderReadyForDispatch) {
    return {
      orderStatus: order.currentStatus,
      senderAdd: order.senderAdd,
      receiverAdd: order.receiverAdd,
      senderLocation: order?.senderLocation,
      receiverLocation: order?.receiverLocation,
      riderLocation: null,
      deviceLocation: null,
      riderName: null,
      riderPhone: null,
    }
  } else {
    const task = await TookanService.getTaskFromOrderId(orderId);
    const fleetId = task.data[0].fleet_id
    const tags = await TookanService.getAgentTags(fleetId);
    const boxId = DeviceService.getBoxIdFromTags(tags.data, "box");
    const location = await TookanService.getAgentLocation(fleetId);
    const riderLocation = { lat: location.data[0].latitude, lng: location.data[0].longitude }
    const boxLocation = await DeviceService.getDeviceLocation(boxId);
    const deviceLocation = { lat: parseFloat(boxLocation.latitude), lng: parseFloat(boxLocation.longitude) }

    let riderName, riderPhone;

    if (order?.tracking?.riderName && order?.tracking?.riderPhone) {
      //check if details present in db
      riderName = order.tracking.riderName
      riderPhone = order.tracking.riderPhone
    } else {
      // Otherwise fetch the details from DeviceService
      riderName = DeviceService.getNameFromProfile(profile);
      riderPhone = DeviceService.getPhoneFromProfile(profile);
      updateTrackingInformation(orderId);
    }

    return {
      orderStatus: order?.currentStatus,
      senderAdd: order?.senderAdd,
      receiverAdd: order?.receiverAdd,
      senderLocation: order?.senderLocation,
      receiverLocation: order?.receiverLocation,
      riderLocation: riderLocation,
      deviceLocation: deviceLocation,
      riderName: riderName,
      riderPhone: riderPhone,
    }
  }
}

async function updateTrackingInformation(orderId) {
  const task = await TookanService.getTaskFromOrderId(orderId);
  const fleetId = task.data[0].fleet_id
  const tags = await TookanService.getAgentTags(fleetId);
  const profile = await TookanService.getAgentProfile(fleetId);
  const riderName = DeviceService.getNameFromProfile(profile);
  const riderPhone = DeviceService.getPhoneFromProfile(profile);
  const boxId = DeviceService.getBoxIdFromTags(tags.data, "box");

  const update_query = {
    "$set": {
      "tracking.fleetId": fleetId,
      "tracking.boxId": boxId,
      "tracking.riderName": riderName,
      "tracking.riderPhone": riderPhone
    }
  };
  await bullionOrderModel.findOneAndUpdate({ orderId: orderId }, update_query)
}
