const categoriesData = require("./../_helpers/ProductCategories");
const Enum = require('./../_helpers/Enums');
const OrderModel = require("./../Models/OrderModel");
const MapsService = require('./GoogleMapsService');
const EmailService = new (require('./EmailService'))();
const UserService = new (require('./UserService'))();
const couponService = new (require('./CouponsService'))();
const PaymentService = require('./paymentService');

const AWSServices = require('./AWS');
const AWSS3 = new AWSServices.S3();
//const LocusService = new (require('./LocusService'))();
const SettingsService = new (require('./SettingsService'))();

// const Razorpay = require('./RazorPay');
// const razorpay = new Razorpay();
const utils = require('./../_helpers/Utility');
const Enums = require("./../_helpers/Enums");
const WhatsappService = new (require("./WhatsappService"))();
const TookanService = new (require("./TookanService"))();
const BullionService = require('../services/BullionService');
// const walletService = require('./wallet_service')
const logger = require("../_helpers/logger");
const WalletPlanModel = require("../Models/WalletPlanModel");
const TraderModel = require("../Models/TraderModel");
const { generateQuoteChecksum } = require("../_helpers/checksum");
const ItemsModel = require("../Models/ItemsModel");
const CompanyService = new (require("./CompanyService"))();
const insuranceService = require('../services/insuranceService')
const { taxConstants, insuranceProhibitedBusinessCategories } = require("../config.json");
const traderService = require("../services/TraderService");
const UserModel = require("../Models/UserModel");
const pricingService = require("../services/pricingService");
const CompanyModel = require("../Models/CompanyModel");
const { captureException } = require("@sentry/node");
const ObjectId = require('mongodb').ObjectID;

let BASE_PRICE = 0;
let MIDDLE_PRICE = 0;
let FINAL_PRICE = 0;
let EXTRA_DISTANCE_CHARGE = 30;
let cityCentreExtraCostDistance = 7;
let securePrices, regularPrices, priceModelList;

// // Execute this function onLoad
// (function() {
//     utils.getDerivedPrices()
//     .then(({ BasePrice, MiddlePrice, FinalPrice }) => {
//         BASE_PRICE = BasePrice;
//         MIDDLE_PRICE = MiddlePrice;
//         FINAL_PRICE = FinalPrice;
//     })
//     .catch((err) => {
//         // If error is found exit the process
//         logger.error("OrdersService::Init::Failed to update derived prices");
//         process.exit(1);
//     });
// })();

// Execute this function onLoad
//TODO: #4 modify pricing to get by user role @nitin
(function () {
  // utils.getPricing()
  //     .then((deliveryPricesList) => {
  //         deliveryPricesList.map((priceList) => {
  //             if (priceList.deliveryMethod === Enum.DeliveryMethod.REGULAR) {
  //                 if (priceList.base && priceList.baseDistance)
  //                     regularPrices = priceList;
  //             } else if (priceList.deliveryMethod === Enum.DeliveryMethod.SECURE) {
  //                 if (priceList.base && priceList.baseDistance)
  //                     securePrices = priceList;
  //             };
  //         });

  //         if (!(securePrices && regularPrices)) {
  //             logger.error("OrdersService::AnonymousFunction::Could not set secure & regular price");
  //             throw deliveryPricesList;
  //         };
  //     })
  //     .catch((err) => {
  //         // If error is found exit the process
  //         logger.error("OrdersService::Init::Failed to update derived prices");
  //         process.exit(1);
  //     });
  utils.getPricing()
    .then((deliveryPricesList) => {
      priceModelList = deliveryPricesList;
      if ((priceModelList.length == 0)) {
        logger.error("OrdersService::AnonymousFunction::Could not set priceList");
        throw deliveryPricesList;
      };
    })
    .catch((err) => {
      // If error is found exit the process
      logger.error("OrdersService::Init::Failed to update derived prices");
      process.exit(1);
    });
})();

module.exports = {
  placeOrder,
  getCategories,
  getEstimatedCost,
  fetchUsersOrders,
  validateCoupon,
  applyCoupon,
  generateOrderConfirmationHTML,
  cancelOrder,
  find,
  count,
  findOne,
  findOneAndUpdate,
  findOneWithDetail,
  apiFormatGetOrder,
  getLatLongFromAddressByGoogleApi,
  checkoutOrder,
  fetchAllOrdersbyQuery,
  updateOrder,
  sendNotificationOnStatusChange
}

async function create(newOrder) {
  try {
    const order = new OrderModel(newOrder);
    await order.save();
    return order;
  } catch (e) {
    captureException(e)
    logger.error("OrdersService::create::Unhandler error", e);
    logger.error(" Errors are ", e.errors)
    throw {
      "status": 500,
      "message": "Something went wrong. Please try again"
    };
  };
};

async function find(query, select = undefined, sort = undefined, skip = 0, limit = 10) {
  try {
    return await OrderModel
      .find(query)
      .select(select)
      .sort(sort)
      .skip(skip)
      .limit(limit);
  } catch (e) {
    logger.error("OrdersService::find::Uncaught error", e);
    throw e;
  };
};

async function findAll(query, select = undefined, sort = undefined, skip = 0, limit = 10) {
  try {
    return await OrderModel
      .find(query)
      .select(select)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("userId")
      .populate({
        path: 'item.traderId',
        model: 'Trader'
      })
  } catch (e) {
    logger.error("OrdersService::find::Uncaught error", e);
    throw e;
  };
};

async function findOneWithDetail(query, select = undefined, sort = undefined, skip = 0, limit = 10) {
  try {
    return await OrderModel
      .findOne(query)
      .select(select)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("userId")
      .populate({
        path: 'item.id',
        model: 'Items'
      })
      .populate({
        path: 'item.traderId',
        model: 'Trader'
      })
  } catch (e) {
    logger.error("OrdersService::find::Uncaught error", e);
    throw e;
  };
};

async function count() {
  try {
    return await OrderModel.count()
  } catch (e) {
    logger.error("OrdersService::find::Uncaught error", e);
    throw e;
  }
}

async function findOne(query, select = {}, orderType = Enums.Order.Type.delivery) {
  try {
    if (orderType === Enums.Order.Type.delivery) {
      return await OrderModel
        .findOne(query)
        .select(select);
    } else if (orderType === Enums.Order.Type.product) {
      return await OrderModel
        .findOne(query)
        .select(select)
        .populate({
          path: 'item.traderId',
          model: 'Trader',
        })
        .populate({
          path: 'item.id',
          model: 'Items',
        });
    }
  } catch (e) {
    logger.error("OrdersService::findOne::Uncaught error", e);
    throw e;
  };
};

async function findOneAndUpdate(query, update, options = {}) {
  try {
    return await OrderModel.findOneAndUpdate(query, update);
  } catch (e) {
    logger.error("OrdersService::findOneAndUpdate::Uncaught error", e);
    throw e;
  };
};

async function count(query) {
  try {
    return await OrderModel.find(query).count();
  } catch (e) {
    logger.error("OrdersService::findOneAndUpdate::Uncaught error", e);
    throw e;
  };
};

function getAmountForRazorPay(amount, currency, reverseConversion = false) {
  // Blindly assuming currency is INR
  if (reverseConversion === true) {
    return amount / 100;
  };
  return amount * 100;
};

function getCategoryByRole(role, categoryId) {
  // Find list of categories for user's role
  // Check if category found ( and is valid )
  // Return category if valid
  role = typeof (role) === "string" ? role = role.toLowerCase() : "";
  let categoryFound = undefined;
  const categoriesByRole = categoriesData["categories"][role];

  if (!categoriesByRole) {
    logger.error(`OrdersService::get_category::No categories for the role = ${role} `)
    throw {
      "status": 422,
      "message": "Please choose a valid category",
      "errors": []
    };
  };

  for (let i = 0; i < categoriesByRole.length; i++) {
    if (categoriesByRole[i].id == categoryId) {
      categoryFound = categoriesByRole[i];
      break;
    };
  };

  if (!(categoryFound)) {
    logger.error(`OrdersService::get_category::Category not found = ${categoryId} `)
    throw {
      "status": 422,
      "message": "Please choose a valid category",
      "errors": []
    };
  };

  return categoryFound
};

/**
 *
 * @param {*} role
 * @param {*} category
 * @param {*} deliveryMethod
 * @returns {
 *     category: Valid category with { label, id, is_insured }
 * }
 */
async function validatedOrder(user, newOrderRequest) {
  const role = user.role
  const { categoryId, deliveryMethod, orderType } = newOrderRequest;

  ["orgLat", "orgLng"].forEach((coord) => {
    if (isNaN(newOrderRequest[coord])) {
      logger.error("OrdersService::validatedOrder::Invalid co-ordinate = ", coord, " value = ", newOrderRequest[coord]);
      throw {
        "status": 422,
        "message": `You have passed an invalid co-ordinate ${coord} with value = ${newOrderRequest[coord]} `,
        "errors": []
      }
    }
  });

  validationResult = { "category": undefined };

  // Ensure user chooses a legal category
  const validatedCategory = getCategoryByRole(role, categoryId);
  validationResult.category = validatedCategory;

  if (deliveryMethod !== Enum.DeliveryMethod.REGULAR && deliveryMethod !== Enum.DeliveryMethod.SECURE) {
    // Invalid order type selected
    logger.error(`OrdersService::validatedOrder::Invalid delivery method selected = ${deliveryMethod}`)
    throw {
      "status": 422,
      "message": "Please choose a valid method of delivery",
      "errors": []
    };
  };

  if (orderType === Enums.Order.Type.delivery) {
    ["destLat", "destLng"].forEach((coord) => {
      if (isNaN(newOrderRequest[coord])) {
        logger.error("OrdersService::validatedOrder::Invalid co-ordinate = ", coord, " value = ", newOrderRequest[coord]);
        throw {
          "status": 422,
          "message": `You have passed an invalid co-ordinate ${coord} with value = ${newOrderRequest[coord]} `,
          "errors": []
        }
      }
    });

  }

  return validationResult;
};

function sendNotificationOnStatusChange(orderId, status) {
  findOneWithDetail({ orderId: orderId })
    .then((orderData) => {
      const item = orderData._doc.item;
      switch (status) {
        case Enums.bullionOrderStatus.paidToTrader: {
          //send whatsapp to trader
          let statusHistory = item.statusHistory.find(c => c.status === Enums.bullionOrderStatus.paidToTrader)
          let statusDate = (statusHistory) ? statusHistory.createdAt : orderData.created_at
          WhatsappService.notifyTraderOnPayment(
            item.traderId.phonenumber, //trader phone
            orderId,
            item.traderId.name, //trader name
            item.id._doc.name, // item name
            item.quantity,
            item.quote,
            item.bullionAmount,
            item.totalAmount, //TODO: change this to total amount
            statusDate.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
          );
          break;
        }
        case Enums.Order.Status.ongoing: {
          WhatsappService.notifyUserOnDispatch(
            orderData._doc.userId.phonenumber, //user phone
            orderId,
            item.traderId.name, //trader name
            item.id._doc.name, // item name
            item.quantity
          );
          break;
        }
      }
    })
    .catch((err) => {
      captureException(err)
      logger.error(
        "OrdersService::sendNotificationOnStatusChange::Failed to send msg",
        err
      );
    });
}

async function sendOrderConfirmationMail(userId, mailRequest) {
  const orderData = await findOneWithDetail({ orderId: mailRequest._doc.orderId });

  try {
    const { email } = orderData._doc.userId;
    const subject = "New order Attempt";
    const cc = process.env.ADMIN_EMAIL;
    const { html, attachments } = generateOrderConfirmationHTML(
      mailRequest,
      orderData
    );

    await EmailService.send(email, subject, html, undefined, attachments, cc);

    if (mailRequest.orderType === Enums.Order.Type.product) {
      const item = orderData._doc.item;
      const traderEmail = item.traderId.email;
      const subject = "Bullion - New Order";
      const cc = process.env.ADMIN_EMAIL;
      const { html, attachments } = generateTraderOrderConfirmationHTML(
        mailRequest,
        orderData
      );

      // Send Email to Trader
      await EmailService.send(
        traderEmail,
        subject,
        html,
        undefined,
        attachments,
        cc
      );

      // Send whatsapp msg if product order
      WhatsappService.notifyCustomerOnNewOrder(
        orderData._doc.userId.phonenumber, //user phone
        orderData._doc.orderId,
        item.traderId.name, //trader name
        item.id._doc.name, // item name
        item.quantity,
        item.quote,
        item.bullionAmount,
        item.totalAmount, //TODO: change it to total amount
        orderData._doc.created_at.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      );

      WhatsappService.notifyTradersOnNewOrder(
        item.traderId.phonenumber, //trader phone
        item.traderId.name, //trader name
        item.id._doc.name, // item name
        item.quantity,
        item.quote,
        item.totalAmount,
        orderData._doc.created_at.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      );
    }
  } catch (err) {
    captureException(err)
    logger.error(
      "OrdersService::sendOrderConfirmationMail::Failed to send notifications to the user",
      err
    );
  }
}

function generateOrderConfirmationHTML(newOrder, orderData = {}) {
  const user = orderData._doc.userId

  const isInsured = !newOrder._doc.insurance.alreadyInsured;
  var html = `
    <div style="text-align: center;margin-bottom: 10px;background-color: rgb(251, 251, 251);">
        <img src="cid:HeaderLogo.png" alt="Logo" style="width: 200px" />
    </div>
    <center>
        <div style="text-align: left; width: 60%; line-height: 27px">
            <font style="color: #008863">
            Your order details are below.
            </font><br /><br />`;
  if (newOrder.orderType === Enums.Order.Type.delivery) {
    html += `Name :${newOrder.name || user.fullName}<br />
            Email Id: ${newOrder.email || user.email}<br />
            Contact No: ${newOrder.contact1 || user.phonenumber}<br />

            Sender's Address: ${newOrder.senderAdd}<br />
            Sender's Full Address: ${newOrder.senderFullAddress || "N/A"}<br />
            Sender's Contact No: ${newOrder.senderContact}<br />

            Receiver's Address: ${newOrder.receiverAdd}<br />
            Receiver's Full Address: ${newOrder.receiverFullAddress || "N/A"}<br />
            Receiver's Contact: ${newOrder.receiverContact}<br />
        ${newOrder.promoCode ? "Promo Code: " + newOrder.promoCode.toUpperCase() + "<br />" : ""}`;

    if (user.role === 'Bussiness') {
      html += `Invoice Value: ${newOrder._doc.currency} ${newOrder._doc.insurance.amount || "N/A"}<br />
                Insurance applied: ${isInsured ? "Yes" : "No"}<br />
                Insurance amount paid: ${isInsured ? newOrder._doc.currency : ""} ${isInsured ? (newOrder.insuranceCharges).toFixed(2) : "N/A"}<br />
                Total amount paid: ${newOrder._doc.currency} ${newOrder._doc.amount}`;
    }
    else {
      html += `Total amount paid: ${newOrder._doc.currency} ${newOrder._doc.amount}`;
    }
  }
  else {
    html += `Name :${user.fullName}<br />
            Email Id: ${user.email}<br />
            Contact No: ${user.phonenumber}<br />
            Item: ${orderData._doc.item.id._doc.name}<br />
            Trader: ${orderData._doc.item.traderId.name}<br />
            Quote: ${orderData._doc.item.quote}<br />
            Bullion Quantity: ${newOrder.item.quantity}<br />
            Bullion Amount: ${newOrder._doc.currency} ${newOrder._doc.item.totalAmount}<br />
            Delivery Amount: ${newOrder._doc.currency} ${newOrder._doc.amount}<br />
            Insurance Amount: ${newOrder._doc.currency} ${newOrder._doc.amount}<br />`;

  }

  html += `<br /><br /></div></center>`;

  const { footer, attachments } = emaiFooter();

  html = html + footer;

  return { html, attachments };
};

function generateTraderOrderConfirmationHTML(newOrder, orderData = {}) {
  const isInsured = !newOrder._doc.insurance.alreadyInsured;
  let html = `
    <div style="text-align: center;margin-bottom: 10px;background-color: rgb(251, 251, 251);">
        <img src="cid:HeaderLogo.png" alt="Logo" style="width: 200px" />
    </div>
    <center>
        <div style="text-align: left; width: 60%; line-height: 27px">
            <font style="color: #008863">
            Order details are below.
            </font><br /><br />
            Trader: ${orderData._doc.item.traderId.name}<br />
            Item: ${orderData._doc.item.id._doc.name}<br />
            Bullion Quantity: ${newOrder.item.quantity}<br />
            Quote: ${orderData._doc.item.quote}<br />
            Bullion Amount: ${newOrder._doc.currency} ${newOrder._doc.item.totalAmount}<br />
            Order Id: ${newOrder._doc.orderId}
        <br /><br /></div>
    </center>`;

  const { footer, attachments } = emaiFooter();

  html = html + footer;

  return { html, attachments };
};

function emaiFooter() {
  const footer = `<div style="background-color: rgb(251, 251, 251);">
                    <center>
                        <div style="width: 60% ; text-align: left ; padding-top: 20px;">
                            <a href="https://www.instagram.com/gordian.technologies/" target="_blank">
                                <img src="cid:Instagram.png" alt="Instagram" style="width: 3% ; margin-right: 10px">
                            </a>
                            <a href="https://www.linkedin.com/company/gordian-technologies-private-limited/" target="_blank">
                                <img src="cid:linkedin.png" alt="linkedin" style="width: 3%;">
                            </a>
                            <br /><br />
                            Gordian Technologies Pvt. Ltd.<br />
                            <a href="mailto:support@gordian.in">support@gordian.in</a>
                        </div>
                    </center>
                </div>`;

  const attachments = [{
    filename: "Logo.png",
    path: __dirname + "/images/Logo.png",
    cid: "HeaderLogo.png",
  }, {
    filename: "Instagram.png",
    path: __dirname + "/images/Instagram.png",
    cid: "Instagram.png",
  }, {
    filename: "linkedin.png",
    path: __dirname + "/images/linkedin.png",
    cid: "linkedin.png",
  }];

  return { footer, attachments }
}

function getPathToSaveOrderInsurance(orderId, filename) {
  return `orders/${orderId}/insurance/${filename}`;
};

async function uploadInsuranceDocument(orderId, document) {
  try {
    const { originalname, mimetype, buffer } = document;
    const filePath = getPathToSaveOrderInsurance(orderId, originalname);
    const params = AWSS3.createUploadParams(filePath, buffer, mimetype);
    const uploadedFile = await AWSS3.upload(params);
    return uploadedFile;
  } catch (e) {
    captureException(e)
    logger.error("OrdersService::uploadInsuranceDocument::Upload failed = ", e);
    throw e;
  }
};


/**
 * Place a new order for both customer and business
 * @param {*} user Request user ( populated after authentication )
 * @param {*} body Request body { // List params }
 */
async function placeOrder(user, body, files) {
  const { role, id } = user;
  const {
    categoryId,
    isInsured, insuranceAmount,
    orgLat, orgLng,
    destLat, destLng,
    promoCode,
    receiverContact,
    sendLinkTo,
    paymentType,
    orderType,
    item,
  } = body;
  let { deliveryMethod, alreadyInsured } = body;

  const currency = Enum.Currency.INR;
  let insurance = undefined;
  const orderId = `ord_${Math.round(new Date().getTime() + Math.random())}`;
  let insuranceApplied = false;
  role !== Enum.Roles.Bussiness ? (insuranceApplied = false) : (insuranceApplied = isInsured);

  await validatedOrder(user, body);


  // Business categories that are insured mandate security
  if (insuranceAmount > 0) {
    if (orderType === Enums.Order.Type.delivery) {
      await validateFiles(files, alreadyInsured, id);
      await validateInsurance(alreadyInsured, id);
    }
    else {
      //Temp check, If user verified then Insurance is FALSE else MANDATORY
      const user = await UserService.findOne({ _id: id });
      const { GST } = user;
      const { is_verified } = GST;
      alreadyInsured = is_verified ? true : false;
    }
    if (Array.isArray(files) && files.length > 0) {
      const uploadedFile = await uploadInsuranceDocument(orderId, files[0]);
      const { Location } = uploadedFile;
      insurance = {
        selected: true,
        alreadyInsured: alreadyInsured,
        amount: insuranceAmount,
        document_urls: [Location],
      };
    } else {
      insurance = {
        selected: true,
        alreadyInsured: alreadyInsured,
        amount: insuranceAmount,
        document_urls: [],
      };
    }
    deliveryMethod = Enum.DeliveryMethod.SECURE;
  }



  const checkout = await checkoutOrder(user, {
    insuranceAmount,
    orgLat, orgLng,
    destLat, destLng,
    alreadyInsured,
    paymentType, promoCode,
    orderType,
    item,
  })

  const { distance, insuranceCharges, totalAmount, priceData, amountByDistance } = checkout;
  const appliedCoupon = checkout.couponId;

  let payment, paymentProcessorOrderId, paymentLink;

  let skipOnDemandPayment = false;

  if (totalAmount === 0 && orderType === Enums.Order.Type.delivery) {
    skipOnDemandPayment = true;
    payment = {
      //If amount is 0, no need to set it as wallet or postpaid.
      paymentType: Enums.PaymentType.onDemand,
      processor: Enum.PaymentProcessor.Gordian,
      orderId: orderId,
    };
  } else if (paymentType === Enums.PaymentType.onDemand) {
    // const newRazorPayOrder = await razorpay.create(
    //   totalAmount * 100,
    //   currency,
    //   orderId
    // );
    // paymentProcessorOrderId = newRazorPayOrder["id"];
    // payment = {
    //   paymentType: paymentType,
    //   processor: Enum.PaymentProcessor.Razorpay,
    //   orderId: newRazorPayOrder["id"],
    // };
  } else if (paymentType === Enums.PaymentType.postPay) {
    //generate razorpay link and send it to the customer
    const phone = utils.phoneNumberFormatRazorPay(sendLinkTo);
    // const newPaymentLink = await razorpay.createPaymentLink(
    //   totalAmount * 100,
    //   currency,
    //   orderId,
    //   phone
    // );
    // paymentProcessorOrderId = newPaymentLink["id"];
    // paymentLink = newPaymentLink["short_url"];
    // payment = {
    //   paymentType: paymentType,
    //   processor: Enum.PaymentProcessor.Razorpay,
    //   orderId: paymentProcessorOrderId,
    //   paymentNumber: sendLinkTo,
    // };
    skipOnDemandPayment = true;
  }
  //   else if(paymentType === Enums.PaymentType.booking){
  //     //if this is just booking order, deduct margin amount from wallet
  //     const itemMarginAmount = updatedItem.marginAmount;
  //     await PaymentService.addMarginToWallet(id,itemMarginAmount);
  //   }
  else {
    //apply wallet discount
    // const walletDiscount = await calcWalletDiscount(id, amount);
    // totalAmount = totalAmount - walletDiscount;
    // //total wallet transaction amount should not be less than 59
    // totalAmount = (orderType === Enums.Order.Type.regular && totalAmount < 59) ? 59 : totalAmount;
    //check if wallet/credit is acceptable
    await PaymentService.checkPayment(id, paymentType, totalAmount);
    payment = {
      paymentType: paymentType,
      processor: Enum.PaymentProcessor.Gordian,
      orderId: orderId,
    };
    skipOnDemandPayment = true;
  }

  // Persist the order to the database
  const newOrderRequest = {
    ...body,
    insurance,
    orderStatus: paymentType === Enums.PaymentType.booking ? Enums.Order.Status.booked : Enum.Order.Status.created,
    amount: totalAmount,
    currency,
    senderLocation: { lat: orgLat, lng: orgLng },
    receiverLocation: { lat: destLat, lng: destLng },
    payment: payment,
    orderId,
    userId: id,
    promoCode: appliedCoupon,
    productCategoryID: categoryId,
    distance: distance,
    priceData,
    insuranceCharges,
    amountByDistance,
  };
  const newOrder = await create(newOrderRequest);
  logger.debug(
    `OrdersService::placeOrder::Order created successfully with ID = ${newOrder._id}, orderId = ${orderId}`
  );

  // const { senderAdd, receiverAdd, senderContact, receiverContact } = body;
  //TODO: To change Insurance amount
  sendOrderConfirmationMail(id, { ...body, ...newOrder, insuranceCharges });

  if (paymentType !== Enums.PaymentType.booking) {
    if (totalAmount === 0) {
      await PaymentService.handleZeroPayment(orderId, paymentType);
    } else if (paymentType === Enums.PaymentType.postPay) {
      await PaymentService.handlePostPayPayment(paymentProcessorOrderId, orderId);
      WhatsappService.sendPaymentLink(
        totalAmount,
        paymentLink,
        sendLinkTo
      )
    } else if (
      paymentType === Enums.PaymentType.wallet ||
      paymentType === Enums.PaymentType.credit
    ) {
      await PaymentService.handleWalletPayment(
        id,
        orderId,
        totalAmount,
        paymentType,
        checkout.walletDiscount
      );
    }
  }


  return {
    status: 201,
    message: "Your order was successfully placed",
    orderId,
    paymentProcessorOrderId: paymentProcessorOrderId,
    skipOnDemandPayment: skipOnDemandPayment,
  };
};

async function checkAndAutoAcceptProductOrder(orderId) {
  const order = await OrderModel
    .findOne({ orderId: orderId })
    .select({})
    .populate({
      path: 'item.traderId',
      model: 'Trader'
    })

  order.item.statusHistory.push({
    status: Enums.bullionOrderStatus.orderAccepted,
    createdAt: new Date()
  })

  const updateBody = {
    "$set": {
      "item.statusHistory": order.item.statusHistory,
      "item.currentStatus": Enums.bullionOrderStatus.orderAccepted,
    }
  }
  const updatedOrder = await OrderModel.findOneAndUpdate({ orderId: orderId }, updateBody)
  await updatedOrder.save()
  return order
}

/**
 * Get the list of categories for the user
 * Based on their role
 * @param {*} role [ Business, Customer ]
 */
function getCategories(role) {
  let _role = role.toLowerCase();
  const { categories } = categoriesData;
  const category_list = categories[_role];

  if (!category_list) {
    logger.error(`OrderService::getCategories::FATAL::category not found for role = ${_role}`);
    throw {
      "status": 404,
      "message": "Category not found"
    }
  };

  return category_list
};


/**
 *
 * @param {*} origins      Array< orgLat, orgLng>
 * @param {*} destinations Array< destLat, destLng>
 * @param {*} deliveryMethod
 * @returns amount
 */
async function computeCostFromOriginToDestination(origins, destinations, user) {

  const [orgLat, orgLng] = origins;
  const [destLat, destLng] = destinations;

  const originToDestinationResponse = await MapsService.getTravelDistance(orgLat, orgLng, destLat, destLng);
  let { distance } = originToDestinationResponse;
  // Value is in METERs and divided by 1000 to yield KMs
  const originToDestinationDistance = Math.ceil(distance["value"] / 1000);

  // redunant as of June 2021
  // const cityCenterLat = 12.976206283637087;
  // const cityCenterLng = 77.56565606290876;
  // const originToCityCentreResponse = await MapsService.getTravelDistance(cityCenterLat, cityCenterLng, orgLat, orgLng);
  // var { distance } = originToCityCentreResponse;
  // // Value is in METERs
  // const cityCentertoOriginDistance = distance["value"]/ 1000;

  let { amount, perKMFare, fareType } = await pricingService.calculateCost(originToDestinationDistance, user);
  return { amount, distance: originToDestinationDistance, perKMFare, fareType };
};

/**
 * Get estimated cost
 * @param {*} origins Array
 * @param {*} destinations Array
 */
async function getEstimatedCost(origins, destinations, deliveryMethod, role) {
  const { amount, distance } = await computeCostFromOriginToDestination(origins, destinations, deliveryMethod, role);
  return { amount, distance };
};

function formatFetchOrderResponse(order) {
  return order;
};

async function fetchUsersOrders(userId, filterOptions) {
  const { page, limit, status } = filterOptions;
  let query = { userId };
  if (Array.isArray(status) && status.length > 0) {
    query["orderStatus"] = { "$in": status };
  };
  query["item.currentStatus"] = { $ne: Enums.bullionOrderStatus.adminDeleted }
  const select = {};
  const sort = { "created_at": -1 };
  const offset = utils.getOffset(page, limit);

  /** Parse and construct query object here */
  const orders = await find(query, select, sort, offset, limit);
  const data = orders.map((order) => formatFetchOrderResponse(order))
  return { status: 200, data, message: "Fetched orders successfully" };
};

async function fetchAllOrdersbyQuery(query, skip = 0, limit = 10) {
  const select = {};
  const sort = { "created_at": -1 };
  const orders = await findAll(query, select, sort, skip, limit);
  return orders;
}

async function validateCoupon(coupon, amount, userId, insuranceEstimate) {
  if (!coupon || coupon.length < 1) {
    logger.debug("OrdersService::validateCoupon::Invalid Coupon = ", coupon);
    throw { "status": 400, "message": "No such coupon exists" };
  };

  amount = Number(amount);
  insuranceEstimate = Number(insuranceEstimate);
  if (Number.isNaN(amount) || amount < 1) {
    logger.debug("OrdersService::validateCoupon:: Invalid amount = ", amount);
    throw { status: 400, message: "Invalid amount: Must be equal/ greater than 1" };
  };

  const { totalAmount, basicDiscount, _coupon } = await applyCoupon(amount, coupon, userId, insuranceEstimate);
  if (!_coupon || !_coupon._id) {
    logger.debug("OrdersService::validateCoupon:: No coupon found = ", _coupon);
    throw { "status": 404, "message": "No such coupon exists" };
  };

  const { discount } = _coupon;
  const { value, category, minAmount, maxDiscount, minOrderAmount } = discount;

  let totalDiscount = amount - totalAmount;
  //if discount is 100%, remove insurance charges a well
  if (totalAmount === 0 && insuranceEstimate > 0) {
    totalDiscount = totalDiscount + insuranceEstimate;
  }

  return {
    status: 200,
    message: "Fetched coupon successfully",
    data: {
      value,
      category,
      discount: {
        value,
        category,
        minAmount,
        maxDiscount,
        minOrderAmount
      },
      basicDiscount, // unconstrained discount
      totalAmount,   // total amount customer pays
      totalDiscount  // amount - total discount applied
    }
  };
};

/**
 *
 * @param {*} amount
 * @param {*} coupon
 * @returns { totalAmount <int>, appliedCoupon <couponID>, _coupon}
 */
async function applyCoupon(amount, coupon, userId, insuranceEstimate) {
  let appliedCoupon = undefined;
  let totalDiscount = 0;
  let totalAmount = amount;
  let basicDiscount = 0; // For UI

  // No coupon returns an unformatted amount with applied coupon not defined
  if (!coupon || typeof coupon !== 'string' || coupon.length < 1)
    return { totalAmount, appliedCoupon, _coupon: undefined };

  // User has input a coupon
  const query = { id: coupon.toUpperCase() }; // Should I uppercase the coupon?
  const promotionCoupon = await couponService.findOne(query);

  if (!promotionCoupon || !promotionCoupon._id) {
    logger.debug("OrdersService::applyCoupon::Coupon code not found = ", coupon);
    throw { status: 404, message: "No such coupon exists" };
  };

  couponService.assertCouponIsValid(promotionCoupon);
  couponService.assertCouponIsValidForPricing(promotionCoupon, amount);

  //Check if User previously applied this coupon
  const couponId = promotionCoupon._id.toString();
  const perUserCount = promotionCoupon.quota.perUser;
  const queryOrder = {
    userId: ObjectId(userId),
    promoCode: ObjectId(couponId),
    "orderStatus": {
      "$in": [
        "completed",
        "pending",
        "ongoing"
      ]
    }
  };
  const order = await OrderModel.count(queryOrder);

  if (perUserCount > 0 && order >= perUserCount) {
    logger.debug("CouponsService::applyCoupon:: Coupon count per user exceed by user for userId= ", userId, " with coupon = ", coupon);
    throw { status: 412, message: "Coupon already applied by User" };
  }

  //check if user is created after certain date only
  const user = await UserService.findOne({ _id: ObjectId(userId) });
  //if user created date is not there, set to js default date, i.e. 1/1/1970
  const created_at = (!user.created_at) ? (new Date(null)) : (user.created_at);

  const userCreatedAfter = promotionCoupon.quota.userCreatedAfter;
  if (userCreatedAfter && created_at < userCreatedAfter) {
    logger.debug("CouponsService::applyCoupon:: User is created before coupon's userCreatedAfter date for userId= ", userId, " with coupon = ", coupon);
    throw { status: 412, message: "Coupon is for new user only" };
  }


  const { _id, discount } = promotionCoupon;
  const { value, category, maxDiscount, minAmount } = discount;

  if (category === Enum.Coupon.Type.percent) {
    basicDiscount = couponService.calculateDiscountByPercent(amount, value);
  } else {
    basicDiscount = couponService.calculateDiscountByUnit(amount, value);
  };



  totalDiscount = basicDiscount;
  if (maxDiscount && totalDiscount > maxDiscount)
    totalDiscount = maxDiscount;

  //If coupon code is INDSC,take off insurance charges
  if (insuranceEstimate > 0 && coupon.toUpperCase() === "INDSC") {
    totalDiscount = insuranceEstimate;
  }

  totalDiscount = Math.ceil(totalDiscount)
  totalAmount = amount - totalDiscount;

  if (totalAmount < 1) {
    logger.warn("OrdersService::applyCoupon:: Final amount lt 1 = ", totalAmount, "Original amount = ", amount, "coupon = ", coupon);
    totalAmount = 0;
  };

  // Ensure minimum amount fulfilled during checkout
  // If minimum amount exceeds total amount, assume checkout amount as minimum amount
  // If you don't check for minAmount being LESSER THAN amount
  // User can end up paying more WITH coupon than without
  if (minAmount >= totalAmount && minAmount <= amount) {
    totalAmount = minAmount;
  };

  return {
    totalAmount,
    basicDiscount,
    appliedCoupon: _id,
    _coupon: promotionCoupon
  };
};

async function cancelOrder(orderId, userId) {
  const query = { orderId };
  const existingOrder = await findOne(query);

  if (!existingOrder) {
    logger.debug("OrdersService::cancelOrder::No such order = ", orderId);
    throw {
      status: 404,
      message: "No such order found"
    };
  };

  if (existingOrder.userId && String(existingOrder.userId) !== userId) {
    logger.debug("OrdersService::cancelOrder::Order does not belong to user =", userId, "it belongs to owner = ", existingOrder.userId);
    throw {
      status: 404,
      message: "No such order found"
    };
  };

  const { orderStatus, payment, amount, currency, promoCode } = existingOrder;

  if (orderStatus && orderStatus !== Enum.Order.Status.pending) {
    logger.debug("OrdersService::cancelOrder::Order cannot be cancelled. It has not been captured = ", orderId, payment);
    throw {
      status: 412,
      message: "Your order cannot be cancelled now"
    };
  };
  const { paymentType } = payment;

  if (amount > 0) {
    if (paymentType === Enums.PaymentType.onDemand) {
      if (!(payment.status && payment.status === Enum.Razorpay.status.captured && payment.paymentId)) {
        logger.debug("OrdersService::cancelOrder::Order cannot be cancelled. It has status = ", orderStatus);
        throw {
          status: 412,
          message: "Your order cannot be cancelled now"
        };
      };
      const razorpayAmount = getAmountForRazorPay(amount, currency);
      // await razorpay.refund(payment.paymentId, razorpayAmount);
    }
    else if (paymentType === Enums.PaymentType.wallet || paymentType === Enums.PaymentType.credit) {
      await PaymentService.refundPaymentWalletOrCredit(userId, amount, paymentType, orderId);
    }
  }
  // refund is dependent on razorpay account having money
  // this refund is first attempted
  // after which other tasks are attempted
  const locusTaskDetails = await TookanService.getTask(orderId);
  await TookanService.cancelTask(locusTaskDetails);


  const updateBody = {
    "$set": {
      "payment.status": Enum.Razorpay.status.refunded,
      orderStatus: Enum.Order.Status.cancelled
    }
  };

  const updatedOrder = await findOneAndUpdate(query, updateBody);

  //update promoCode, decrement total by 1
  if (promoCode) {
    couponService.decrementCouponUse(promoCode);
  }

  return {
    status: 200,
    message: "Order successfully cancelled",
    data: {
      order: updatedOrder
    }
  };
};

async function validateFiles(files, alreadyInsured, userId) {
  let invoiceRequired = false;
  //check if invoice is required
  //check if user is validated, if not then invoice is required

  if (alreadyInsured) {
    const insurance = await SettingsService.checkInvoiceRequiredForNonInsurance();
    invoiceRequired = (insurance === 'true');
  }
  else {
    const nonInsurance = await SettingsService.checkInvoiceRequiredForInsurance();
    invoiceRequired = (nonInsurance === 'true');
  }

  if (invoiceRequired) {
    if (!files || files.length === 0) {
      logger.debug("ValidateFiles::No file uploaded");
      throw {
        status: 412,
        message: "Please upload invoice",
        "errors": []
      };
    }
  }

  return true;
};
async function validateInsurance(alreadyInsured, userId) {
  const user = await UserService.findOne({ _id: userId });
  const { GST } = user;
  const { is_verified } = GST;
  if (!is_verified && alreadyInsured) {
    logger.debug("ValidateInsurance::Insurance not taken");
    throw {
      status: 412,
      message: `Please avail insurance on the app as KYC for your account is not complete. Contact customer care for more details.`,
      "errors": []
    };
  }
}
async function getLatLongFromAddressByGoogleApi(address) {

  const { lat, lng } = await MapsService.getLatLongFromAddress(address);
  if (!lat || !lng) {
    throw { status: 404, message: "Address not found" };
  }
  return {
    status: 201,
    data: {
      lat: lat,
      lng: lng
    }
  }
};

function apiFormatGetOrder(order, tookan) {
  const response = {
    senderLocation: {
      lat: order.senderLocation.lat,
      lng: order.senderLocation.lng
    },
    receiverLocation: {
      lat: order.receiverLocation.lat,
      lng: order.receiverLocation.lng
    },
    payment: {
      paymentType: order.payment.paymentType,
      processor: order.payment.processor,
      orderId: order.payment.orderId,
      failedPayments: order.payment.failedPayments
    },
    insurance: {
      alreadyInsured: order.insurance.alreadyInsured,
      amount: order.insurance.amount,
    },
    tracking: {
      currentTaskStatus: order.tracking.currentTaskStatus,
      statusMarked: order.tracking.statusMarked,
      pickUpTrackLink: tookan ? tookan.pickUpTrackLink : undefined,
      dropTrackLink: tookan ? tookan.pickUpTrackLink : undefined
    },
    orderStatus: order.orderStatus,
    currency: order.currency,
    senderAdd: order.senderAdd,
    senderFlat: order.senderFlat,
    senderBuilding: order.senderBuilding,
    senderContact: order.senderContact,
    receiverAdd: order.receiverAdd,
    receiverFlat: order.receiverFlat,
    receiverBuilding: order.receiverBuilding,
    receiverContact: order.receiverContact,
    amount: order.amount,
    orderId: order.orderId,
    created_at: order.created_at,
    updated_at: order.updated_at
  }
  return response;
};

async function updateOrder(user, body, orderId) {

  const query = { orderId: orderId };
  let objForUpdate = {};
  if (body.receiverName) objForUpdate.receiverName = body.receiverName;
  if (body.receiverAdd) objForUpdate.receiverAdd = body.receiverAdd;
  if (body.receiverFlat) objForUpdate.receiverFlat = body.receiverFlat;
  if (body.receiverBuilding) objForUpdate.receiverBuilding = body.receiverBuilding;
  if (body.receiverContact) objForUpdate.receiverContact = body.receiverContact;
  if (body.destLat && body.destLng) {
    const existingOrder = await findOne(query);
    // TODO: recalc the delivery amount for orderType products.
    //find distance based on new destination
    const { senderLocation } = existingOrder
    const { role } = user;
    const { distance } = await computeCostFromOriginToDestination([senderLocation.lat, senderLocation.lng], [body.destLat, body.destLng], Enums.DeliveryMethod.SECURE, role);
    objForUpdate.receiverLocation = { lat: body.destLat, lng: body.destLng }
    objForUpdate.distance = distance;
  }
  const order = await findOneAndUpdate(query, objForUpdate);
  return {
    status: 200,
    message: "Your order updated successfully",
    order: order
  };
}

async function checkoutOrder(user, body) {
  const { role, id } = user;
  const {
    insuranceAmount,
    orgLat, orgLng,
    destLat, destLng,
    alreadyInsured,
    paymentType, promoCode,
    orderType,
    item,
  } = body;
  let totalAmount, walletDiscount = 0, walletPlan, insuranceCharges = 0, couponDiscount = 0, itemAmount = 0, deliveryAmount = 0, couponId
  let priceData = await computeCostFromOriginToDestination([orgLat, orgLng], [destLat, destLng], user);
  let calcDeliveryAmount = priceData.amount;
  let distance = priceData.distance
  if (role === Enums.Roles.Bussiness) {

    if (paymentType === Enums.PaymentType.wallet) {
      let walletData = await calcWalletDiscount(id, calcDeliveryAmount);
      walletDiscount = walletData.walletDiscount
      walletPlan = walletData.walletPlan
      priceData.walletPlan = walletPlan
    }

    if (alreadyInsured) {
      await insuranceService.checkIfInsuranceIsMandatory(user, insuranceAmount)
    }

    if (insuranceAmount !== undefined && !alreadyInsured) {
      await insuranceService.checkInsuranceEligibility(user)
      insuranceCharges = await insuranceService.calcInsuranceAmount(insuranceAmount, user)
    }
  }

  if (promoCode) {
    const calcCoupon = await applyCoupon(calcDeliveryAmount, promoCode, id);
    couponDiscount = calcDeliveryAmount - calcCoupon.totalAmount;
    couponId = calcCoupon.appliedCoupon;
  }
  if (orderType === Enums.Order.Type.product) {
    totalAmount = deliveryAmount + insuranceCharges
  } else {
    deliveryAmount = (calcDeliveryAmount < 59) ? 59 : calcDeliveryAmount;
    totalAmount = deliveryAmount - walletDiscount - couponDiscount + insuranceCharges;
    totalAmount = (totalAmount < 0) ? 0 : totalAmount
    totalAmount = Math.ceil(totalAmount)
  }
  return {
    status: 201,
    message: "checkout details",
    amount: deliveryAmount,         //to be removed once all the mobile app code is updated
    deliveryAmount: deliveryAmount,
    couponCode: promoCode,
    couponDiscount: couponDiscount,
    couponId: couponId,
    amountByDistance: calcDeliveryAmount,
    walletDiscount: walletDiscount,
    insuranceCharges: insuranceCharges,
    totalAmount: totalAmount,
    // TODO: Ideally there should only be one item,
    // added this so as not to break the other checkoutOrder flow
    distance: distance,
    priceData
  }
};

async function calcWalletDiscount(userId, amount) {
  //find companyId
  let totalDiscount = 0;
  let walletPlan
  try {
    const user = await UserService.findOne({ _id: userId });
    const { GST } = user;
    const { companyId } = GST;

    //find company walletPlan, if any
    // if (companyId) {
    //   walletPlan = await walletService.getWalletPlanForCompany(companyId)

    //   if (walletPlan) {
    //     const { discount } = walletPlan;
    //     const { category, value, maxDiscount } = discount;
    //     let discountAmount = 0
    //     if (category === Enums.Coupon.Type.percent) {
    //       discountAmount = (amount * value / 100)
    //     }
    //     else {
    //       discountAmount = amount - value
    //     }
    //     if (discountAmount > maxDiscount)
    //       discountAmount = maxDiscount

    //     totalDiscount = Math.floor(discountAmount);
    //   }
    // }
  }
  catch (e) {
    captureException(e)
  }

  return { walletDiscount: totalDiscount, walletPlan };
}
