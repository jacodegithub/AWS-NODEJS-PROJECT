const UserService = new (require("./UserService"))();
const CompanyService = new (require("./CompanyService"))();
const walletService = require('./wallet_service')
const CreditTransactionService = new (require("./CreditTransactionService"))();
const Enums = require("../_helpers/Enums");
const request = require("request");
const logger = require("../_helpers/logger");

module.exports = {
  checkPayment,
  makePaymentWalletOrCredit,
  refundPaymentWalletOrCredit,
  handleWalletPayment,
  handleZeroPayment,
  handlePostPayPayment,
  addMarginToWallet,
  removeMarginFromWallet,
};

async function checkPayment(userId, paymentType, orderAmount) {
  const user = await UserService.findOne({ _id: userId });
  const { GST } = user;
  const { companyId } = GST;
  if (!companyId) {
    //no companyID found for this user
    throw {
      status: 404,
      message: "Company is not setup for orders, please contact support.",
    };
  } else {
    //fetch company modal
    const { paymentTypes } = await CompanyService.findOne({ _id: companyId });
    const { wallet, credit } = paymentTypes;
    if (paymentType === Enums.PaymentType.wallet) {
      //check if wallet has min balance
      if (!wallet || !wallet.allowed) {
        throw {
          status: 404,
          message:
            "Company is not setup for wallet payments, please contact support.",
        };
      } else {
        const { currentAmount } = wallet;
        if (orderAmount > currentAmount) {
          throw {
            status: 404,
            message:
              "Not enough amount in the wallet. Current wallet amount is " +
              currentAmount,
          };
        }
      }
    } else if (paymentType === Enums.PaymentType.credit) {
      //check credit cycle and credit
      await checkPaymentCredit(credit, orderAmount, companyId);
    }
  }
  return true;
}
async function checkPaymentCredit(credit, orderAmount, companyId) {
  const { allowed, currentPeriod, cycle, creditLimit } = credit;
  const { frequency, startDate, autoReset } = cycle;
  const { periodCredit, start, end } = currentPeriod;
  if (!credit || !allowed) {
    throw {
      status: 404,
      message:
        "Company is not setup for credit payments, please contact support.",
    };
  }
  const cur_date = new Date();
  cur_date.setUTCHours(0, 0, 0, 0);
  //start date of credit cycle
  const freq_start = new Date(startDate);
  //freq_start.setUTCHours(0, 0, 0, 0);

  if (cur_date < freq_start) {
    throw {
      status: 404,
      message: "Credit payment not yet started, please contact support.",
    };
  }
  //const { start_date, end_date } = await getCreditDates(cur_date, freq_start, frequency, start, end, companyId);

  if (cur_date >= start && cur_date < end) {
    if (orderAmount > creditLimit - periodCredit) {
      throw {
        status: 404,
        message:
          "Credit limit exceeded for the period, please contact support.",
      };
    }
  } else {
    if (cur_date >= end) {
      if (autoReset) {
        //create period start and end if not exist
        //update company credit dates
        await updateCreditTransaction(
          companyId,
          frequency,
          periodCredit,
          start,
          end,
          cur_date,
          freq_start
        );
      } else {
        throw {
          status: 404,
          message:
            "Payment pending for the last period, cannot place order, please contact support.",
        };
      }
    } else {
      throw {
        status: 404,
        message:
          "Credit payment not configured correctly, please contact support.",
      };
    }
  }
  return true;
}
// async function getCreditDates(cur_date,freq_start,frequency,period_start, period_end, companyId){
//     let startDate, endDate;
//     if(!period_start || !period_end || (cur_date > period_end) ){
//         //current freq start is null, create current start and end date
//         const { start_date, end_date } = calcCreditDates(cur_date,freq_start,frequency);
//         startDate = new Date(start_date);
//         startDate.setHours(0,0,0,0);
//         //update current start date in database
//         // update_query = {
//         //     "$set": {
//         //         "paymentTypes.credit.currentPeriod.start": startDate,
//         //     }
//         // }
//         // const update = await CompanyService.updateOne({_id:companyId},update_query);
//     }
//     else{
//         //use existing current freq date
//         startDate = new Date(freq_start);
//         startDate.setHours(0,0,0,0);
//     }
//     endDate = new Date(startDate);
//     endDate.setHours(0,0,0,0);
//     switch(frequency){
//         case Enums.Credit.Cycle.Frequency.month:
//             endDate.setMonth(endDate.getMonth()+1);
//             break;
//         case Enums.Credit.Cycle.Frequency.quarter:
//             endDate.setMonth(endDate.getMonth()+3);
//             break;
//         case Enums.Credit.Cycle.Frequency.year:
//             endDate.setYear(endDate.getFullYear()+1);
//             break;
//         default:
//             break;
//     }
//     const data = { start_date: startDate, end_date: endDate};
//     return data;
// }

function calcCreditDates(cur_date, freq_start, frequency) {
  const start_date = new Date(freq_start);
  let end_date;

  if (frequency === Enums.Credit.Cycle.Frequency.month) {
    //create start and end of current month based on start date
    start_date.setYear(cur_date.getFullYear());
    start_date.setMonth(cur_date.getMonth());

    end_date = new Date(start_date);
    end_date.setMonth(end_date.getMonth() + 1);
  } else if (frequency === Enums.Credit.Cycle.Frequency.quarter) {
    if (cur_date.getMonth() < freq_start.getMonth()) {
      start_date.setYear(cur_date.getFullYear() - 1);
      start_date.setMonth(
        Math.floor((12 - freq_start.getMonth() + cur_date.getMonth()) / 3) * 3 +
          freq_start.getMonth()
      );
    } else {
      start_date.setYear(cur_date.getFullYear());
      start_date.setMonth(
        Math.floor((qtr_start_date.getMonth() - cur_date.getMonth()) / 3) * 3 +
          freq_start.getMonth()
      );
    }
    end_date = new Date(start_date);
    end_date.setMonth(end_date.getMonth() + 3);
  } else if (frequency === Enums.Credit.Cycle.Frequency.year) {
    start_date.setYear(cur_date.getFullYear());

    end_date = new Date(start_date);
    end_date.setYear(end_date.getFullYear() + 1);
  }
  const data = { start_date: start_date, end_date: end_date };
  return data;
}
async function makePaymentWalletOrCredit(userId, amount, paymentType, orderId, walletDiscount) {
  const user = await UserService.findOne({ _id: userId });
  const { GST } = user;
  const { companyId } = GST;
  if (companyId) {
    if (paymentType === Enums.PaymentType.wallet) {
      await walletService.deductAmountForCompany(companyId, amount, userId, orderId, walletDiscount)
    } else if (paymentType === Enums.PaymentType.credit) {
      CompanyService.addCreditAmount(amount, companyId);
    }
  } else {
    throw {
      status: 404,
      message: "Company is not setup for orders, please contact support.",
    };
  }
}
async function addMarginToWallet(userId, amount) {
  try {
    const user = await UserService.findOne({ _id: userId });
    const { GST } = user;
    const { companyId } = GST;
    if (companyId) {
      CompanyService.addMarginAmountInWallet(amount, companyId);
    } else {
      throw {
        status: 404,
        message: "Company is not setup for orders, please contact support.",
      };
    }
  } catch (e) {
    logger.error(" Errors are ", e.message);
    throw {
      status: 412,
      message: "Error deducting amount from wallet",
    };
  }
}
async function removeMarginFromWallet(userId, amount) {
  try {
    const user = await UserService.findOne({ _id: userId });
    const { GST } = user;
    const { companyId } = GST;
    if (companyId) {
      CompanyService.removeMarginAmountFromWallet(amount, companyId);
    } else {
      throw {
        status: 404,
        message: "Company is not setup for orders, please contact support.",
      };
    }
  } catch (e) {
    logger.error(" Errors are ", e.message);
    throw {
      status: 412,
      message: "Error adding amount to wallet",
    };
  }
}
async function refundPaymentWalletOrCredit(userId, amount, paymentType, orderId) {
  const user = await UserService.findOne({ _id: userId });
  const { GST } = user;
  const { companyId } = GST;
  if (companyId) {
    if (paymentType === Enums.PaymentType.wallet) {
      walletService.refundAmountForOrder(orderId, amount, userId, companyId)
    } else if (paymentType === Enums.PaymentType.credit) {
      CompanyService.deductCreditAmount(amount, companyId);
    } else {
      throw { status: 412, message: "Not able to process refund." };
    }
  } else {
    throw { status: 412, message: "Not able to process refund." };
  }
}
async function updateCreditTransaction(
  companyId,
  periodFrequency,
  periodCredit,
  periodStart,
  periodEnd,
  currentDate,
  frequencyStart
) {
  const creditTran = await CreditTransactionService.count({
    $and: [
      {
        companyId: companyId,
      },
      {
        start: {
          $gte: periodStart,
        },
      },
      {
        end: {
          $lte: periodEnd,
        },
      },
    ],
  });
  if (creditTran > 0) {
    throw {
      status: 404,
      message:
        "Error inserting history data in Credit transaction. Dates mismatch.",
    };
  }
  //create start and end date based on frequency start date
  const { start_date, end_date } = calcCreditDates(
    currentDate,
    frequencyStart,
    periodFrequency
  );

  const newCredit = {
    companyId: companyId,
    payment: {
      processor: Enums.PaymentProcessor.Gordian,
      orderId: "",
      paymentId: "",
      method: Enums.PaymentMethod.gordian_credit,
      status: Enums.Razorpay.status.pending,
    },
    frequency: periodFrequency,
    start: periodStart,
    end: periodEnd,
    credit: periodCredit,
  };

  await CreditTransactionService.create(newCredit);

  //calculate date for current period
  update_query = {
    $set: {
      "paymentTypes.credit.currentPeriod.periodCredit": 0,
      "paymentTypes.credit.currentPeriod.start": start_date,
      "paymentTypes.credit.currentPeriod.end": end_date,
    },
    //set current credit to 0
  };
  await CompanyService.updateOne({ _id: companyId }, update_query);
}
async function handleZeroPayment(orderId, paymentType) {
  let event;
  event = Enums.Razorpay.Webhooks.payment_captured;
  //change the order status through webhook service
  //create webhook body
  const body = {
    event: event,
    //although the below information is not required, adding it for consistency and future changes.
    entity: {
      id: "",
      order_id: orderId,
      method: Enums.PaymentMethod.gordian_promocode,
      notes: {
        orderId: orderId,
      },
    },
  };
  postPaymentToWebhook(body);
}
async function handlePostPayPayment(id, orderId) {
  let event;
  event = Enums.Razorpay.Webhooks.payment_postPay;
  //change the order status through webhook service
  //create webhook body
  const body = {
    event: event,
    //although the below information is not required, adding it for consistency and future changes.
    entity: {
      id: "",
      order_id: id,
      method: "",
      notes: {
        orderId: orderId,
      },
    },
  };
  postPaymentToWebhook(body);
}
async function handleWalletPayment(userId, orderId, totalAmount, paymentType, walletDiscount) {
  let event;
  //deduct from wallet or add to credit
  try {
    await makePaymentWalletOrCredit(userId, totalAmount, paymentType, orderId, walletDiscount);
    event = Enums.Razorpay.Webhooks.payment_captured;
  } catch (e) {
    event = Enums.Razorpay.Webhooks.payment_failed;
  }
  //payment added, change the order status through webhook service
  //create webhook body
  const body = {
    event: event,
    //although the below information is not required, adding it for consistency and future changes.
    entity: {
      id: "",
      order_id: orderId,
      method:
        paymentType === Enums.PaymentType.credit
          ? Enums.PaymentMethod.gordian_credit
          : Enums.PaymentMethod.gordian_wallet,
      notes: {
        orderId: orderId,
      },
    },
  };
  postPaymentToWebhook(body);
}
function postPaymentToWebhook(body) {
  const url = process.env.SERVER_API_URL + "/webhook/walletPayments";

  var options = {
    method: "POST",
    url: url,
    headers: {
      //we can any custom api key, but we can manage tookan key is fine for now as well
      apikey: process.env.TOOKAN_WEBHOOKKEY,
      "Content-Type": "application/json",
    },
    body: body,
    json: true,
  };
  request(options, function (error, response) {
    if (error) {
      console.error(
        "TookanService::postPaymentToWebhook::Error attempting to post task."
      );
      throw { status: 500, message: "Error posting update to webhook" };
    }

    if (response.statusCode !== 202) {
      console.error(
        "TookanService::postPaymentToWebhook::Error attempting to post task.",
        response.statusCode
      );
      throw { status: 500, message: "Error posting update to webhook" };
    }
  });
}
