const Razorpay = require("razorpay");
var nodemailer = require("nodemailer");
const express = require("express");
const router = express.Router();
require("dotenv").config();
const request = require("request");
const logger = require("../_helpers/logger");

// let key_id = process.env.RAZORPAY_KEY;
// let key_secret = process.env.RAZORPAY_SECRET;
const OrderModel = require("../Models/OrderModel");
const UserModel = require("./../Models/UserModel");
const PriceModel = require("../Models/PricesModel");
const Utility = require('./../_helpers/Utility');
const Enums = require("../_helpers/Enums");
//const LocusService = new (require('./../users/LocusService'))(); no longer needed
const orderService = require('./../users/orders_service')
const EmailService = new (require('./EmailService'))();
const TookanService = new (require("./TookanService"))();
router.get("/", (req, res) => {
  res.json({ message: "API Working" });
});

var BasePrice, MiddlePrice, FinalPrice, distance;

router.post("/orderForm", async (req, res) => {
  try {
    // This API is now redundant. The webhook handles the locus creation 
    // And the client side is aware of payment success state
    return res.status(200).send({
      "message": "This API is depreceated but has responded successfully"
    });

    const { orderId } = req.body;
    const orderDetails = await OrderModel.findOne({ orderId });

    if (!orderDetails) {
      return res.status(400).json({
        message: "OrderId not found."
      })
    }

    const paymentId = orderDetails.paymentId;
    // const response = await razorpay.orders.fetchPayments(paymentId)
    const response = await razorpay.orders.fetchPayments(orderId)


    if (response.items[0] && response.items[0].status == 'captured') {
      const statusUpdated = await OrderModel.updateOne({ paymentId }, { paymentStatus: "completed" });
      if (!statusUpdated) {
        return res.status(500).json({
          message: "Unable to update database with order status"
        });
      }
      const startTime = new Date();
      let endTime;
      let maxDropTime;
      let teamId;
      if (orderDetails.deliveryMethod === Enums.DeliveryMethod.REGULAR) {
        teamId = "blr-secure";
        endTime = new Date(Date.now() + (1000 * 3600 * 1.5));
        maxDropTime = new Date(Date.now() + (1000 * 3600 * 3));
      } else if (orderDetails.deliveryMethod === Enums.DeliveryMethod.SECURE) {
        teamId = "blr-normal";
        endTime = new Date(Date.now() + (1000 * 3600 * 0.75));
        maxDropTime = new Date(Date.now() + (1000 * 3600 * 1.5));
      } else {
        return res.status(400).json({
          message: "Unknown delivery method for order"
        });
      }
      request.put(`https://locus-api.com/v1/client/gordian-demo/mpmdtask/${orderDetails.orderId}-task-1`, {
        auth: {
          username: process.env.LOCUS_USERNAME,
          password: process.env.LOCUS_PASSWORD,
        },
        body: {
          teamId,
          taskId: orderDetails.orderId,
          lineItems: [
            {
              id: `${orderDetails.orderId}-line-item-1`,
              name: `Line Item 1 for order ID ${orderDetails.orderId}`,
              quantity: 1,
              price: {
                amount: orderDetails.amount,
                currency: "INR",
              }
            }
          ],
          autoAssign: false,
          pickupContactPoint: {
            name: orderDetails.senderName,
            number: orderDetails.senderContact,
          },
          pickupLocationAddress: {
            placeName: orderDetails.senderFlat,
            formattedAddress: `${orderDetails.senderFlat}, ${orderDetails.senderBuilding}`,
            city: "Bangalore",
            countryCode: "IN",
          },
          pickupLatLng: orderDetails.senderLocation,
          pickupSlots: [
            {
              start: startTime.toISOString(),
              end: endTime.toISOString(),
            }
          ],
          pickupTransactionDuration: 300,
          pickupAmount: {
            amount: {
              amount: 0,
              currency: "INR",
              symbol: "₹",
            },
            exchangeType: "COLLECT",
          },
          dropContactPoint: {
            name: orderDetails.receiverName,
            number: orderDetails.receiverContact,
          },
          dropLocationAddress: {
            placeName: orderDetails.receiverFlat,
            formattedAddress: `${orderDetails.receiverFlat}, ${orderDetails.receiverBuilding}`,
            city: "Bangalore",
            countryCode: "IN",
          },
          dropLatLng: orderDetails.receiverLocation,
          dropSlots: [
            {
              start: endTime.toISOString(),
              end: maxDropTime.toISOString(),
            }
          ],
          dropTransactionDuration: 300,
          dropAmount: {
            amount: {
              amount: 0,
              currency: "INR",
              symbol: "INR",
            },
            exchangeType: "GIVE",
          },
          volume: {
            value: "1",
            unit: "ITEM_COUNT",
          },
        },
        json: true
      }, (err, response, body) => {
        res.status(200).json({
          message: "Your order has been placed successfully."
        });
      });
    } else {
      res.status(400).json({
        message: "Payment not successfull"
      })
    }
  } catch(e) {
    logger.error("Orders::confirmOrder::Unhandled error", e);
    return res.status(500).send({"message": "Something went wrong. Please try again"});
  }
});

router.post("/rateOrder", async (req, res) => {
  const orderId = req.body.orderId;
  const rating = req.body.rating;
  try {
    let order = await OrderModel.findByIdAndUpdate(orderId, {
        rating
    });
    await order.save();
    res.json({
      message: "Order rated successfully"
    });
  } catch (err) {
    res.status(500).json({
      message: "Could not update order rating"
    });
  }
});

// const razorpay = new Razorpay({
//   key_id: key_id,
//   key_secret: key_secret,
// });

// Gets the prices from variables collection & stores them in the variales;
const GetPrices = () => {
  PriceModel.find({})
    .then((response) => {
      BasePrice = response[0].BasePrice;
      MiddlePrice = response[0].MiddlePrice;
      FinalPrice = response[0].FinalPrice;
    })
    .catch((error) => {
      logger.log("Error, cannot get the prices");
    });
};

const CalculateCost = (body, senderLat, senderLon) => {
  return new Promise((resolve, reject) => {
    let amount;
    const status = body["rows"][0]["elements"][0]["status"];
    if (status == "ZERO_RESULTS") {
      reject('ZERO_RESULTS');
      return;
    }
    // var estimatedDistance = Math.ceil(
    //   1.609344 * parseInt(body["rows"][0]["elements"][0]["distance"]["text"])
    // );

    let estimatedDistance = body["rows"][0]["elements"][0]["distance"]["value"];
    estimatedDistance /= 1000; // Distance is in meters
    estimatedDistance = Math.ceil(estimatedDistance);

    if (estimatedDistance <= 5) {
      amount = BasePrice;
    } else if (estimatedDistance > 5 && estimatedDistance <= 10) {
      amount = MiddlePrice;
    } else {
      amount = MiddlePrice + (estimatedDistance - 10) * FinalPrice;
    }

    const centralLat = 12.976206283637087, centralLon = 77.56565606290876;
    request(`https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=${centralLat},${centralLon}&destinations=${senderLat},${senderLon}&key=${process.env.GOOGLE_APIKEY}`, function (error, response, body) {
      if (error) {
        return reject(error);
      }

      body = JSON.parse(body);

      const status = body["rows"][0]["elements"][0]["status"];
      if (status == "ZERO_RESULTS") {
        return reject('ZERO_RESULTS');
      }
      // var centralDistance = Math.ceil(
      //   1.609344 * parseInt(body["rows"][0]["elements"][0]["distance"]["text"])
      // );

      let centralDistance = body["rows"][0]["elements"][0]["distance"]["value"];
      centralDistance /= 1000; // distance is in meters

//       if (centralDistance > 7) {
//         amount += 30;
//       }

      amount = Math.round(amount);
      distance = estimatedDistance;
      resolve(amount);
    });
  });
}

  router.post("/getEstimate", (req, res) => {
    GetPrices();
    request(
      `https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=${req.body.senderLat},${req.body.senderLon}&destinations=${req.body.receiverLat},${req.body.receiverLon}&key=${process.env.GOOGLE_APIKEY}`,
      async function (error, response, body) {
        body = JSON.parse(body);
        try {
          let amount = await CalculateCost(body, req.body.senderLat, req.body.senderLon);

          res.json({
            amount,
            distance,
          });
        } catch (err) {
          if (err == "ZERO_RESULTS") {
            return res.status(400).json({
              message: "ZERO_RESULTS"
            });
          } else {
            return res.status(400).json({
              message: err.toString()
            });
          }
        }
      }
    );
  });

  router.post("/razorpay", async (req, res) => {
    const { body } = req;
    const { senderLat, senderLon, receiverLat, receiverLon, forCovidRelief } = body;
    let { promoCode, deliveryMethod } = body;
    let data = Object.assign({}, body);
    let amount = 0;
    
    if (forCovidRelief === true) {
      promoCode = process.env.COVID_PROMO_CODE || "COVIDRELIEF";
    };

    deliveryMethod = typeof deliveryMethod === 'string'? deliveryMethod.toLowerCase() : undefined;
    if (deliveryMethod && 
      deliveryMethod !== Enums.DeliveryMethod.REGULAR && 
      deliveryMethod !== Enums.DeliveryMethod.SECURE
    )
      return res.status(400).send({"message": "Invalid delivery method"});

    GetPrices();
    request(
      `https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=${senderLat},${senderLon}&destinations=${receiverLat},${receiverLon}&key=${process.env.GOOGLE_APIKEY}`,
      async function (error, response, mapsResponseBody) {
        mapsResponseBody = JSON.parse(mapsResponseBody);
        try {
          amount = await CalculateCost(mapsResponseBody, req.body.senderLat, req.body.senderLon);
        } catch (err) {
          if (err == "ZERO_RESULTS") {
            return res.status(400).json({
              message: "ZERO_RESULTS"
            });
          } else {
            return res.status(400).json({
              message: err.toString()
            });
          }
        }
        // deducting the amount for the promo code from the total amount calculated.      
        // amount -= promoAmount;
        let { totalAmount, appliedCoupon } = await orderService.applyCoupon(amount, promoCode);

        const payment_capture = 1;
        const currency = "INR";
        // const orderId = uuid.v4().toString();
        const orderId = `ord_${Math.round((new Date().getTime() + Math.random()))}`;
        const options = {
          amount: totalAmount * 100,
          currency,
          receipt: orderId,
          payment_capture,
        };

        // try {
        //   const response = await razorpay.orders.create(options);

        //   var date = new Date();
        //   data.date = date;
        //   data.orderStatus = 'pending';
        //   data.orderId = orderId;
        //   data.amount = totalAmount;
        //   data.payment = {
        //     processor: Enums.PaymentProcessor.Razorpay,
        //     orderId: response.id
        //   };
        //   data.senderLocation = { lat: senderLat, lng: senderLon };
        //   data.receiverLocation = { lat: receiverLat, lng: receiverLon };
        //   data.promoCode = appliedCoupon;
        //   data.deliveryMethod = deliveryMethod;
        //   data.amountByDistance = amount;

        //   const newForm = new OrderModel(data);
        //   await newForm.save();

        //   res.json({
        //     orderId: orderId,
        //     paymentProcessorOrderId: response.id
        //   });

        //   // Send confirmation email to gordian employees ( aka @Dhanush )
        //   const bcc = process.env.ADMIN_EMAIL;
        //   const confirmationEmailRecipient = process.env.ADMIN_SUPPORT_MAIL;
        //   const subject = "Gordian - New Order Attempt";
        //   const { html, attachments } = orderService.generateOrderConfirmationHTML({...body, ...data});
        //   EmailService.send(confirmationEmailRecipient, subject, html, undefined, attachments, bcc)
        //   .catch((err) => {/** Do nothing */});
        // } catch (error) {
        //   logger.log("Orders:: Post /razorpay", error);
        //   return res.status(500).send({"message": "Something went wrong. Please try again"});
        // }
      }
    );
  });

  // function generateOrderConfirmationHTML(newOrder) {
  //   const html = `
  //     <div style="
  //       text-align: center;
  //       margin-bottom: 10px;
  //       background-color: rgb(251, 251, 251);
  //     ">
  //       <img src="cid:HeaderLogo.png" alt="Logo" style="width: 20%" />
  //     </div>
  //     <center>
  //       <div style="text-align: left; width: 60%; line-height: 27px">
  //           <font style="color: #008863">
  //           Thank you for choosing Gordian for your secured delivery. We will get back to you once your order has been confirmed. Your order details are as follows. 
  //           </font><br /><br />
  //           Name :${newOrder.name}<br />
  //           Email Id: ${newOrder.email}<br />
  //           Contact No: ${newOrder.contact1}<br />
  //           Sender's Address: ${newOrder.senderAdd  }<br />
  //           Sender's Full Address: ${newOrder.senderFullAddress}<br />
  //           Sender's Contact No: ${newOrder.senderContact}<br />
  //           Receiver's Address: ${newOrder.receiverAdd}<br />
  //           Receievr's Full Address: ${newOrder.receiverFullAddress}<br />
  //           Receiver's Contact: ${newOrder.receiverContact}<br /><br />

  //           If you want to cancel your order, then write to us at dhanush@gordian.in or contact us at +918762918529
  //       </div>
  //     </center>
  //     <div style="background-color: rgb(251, 251, 251);">
  //       <center>
  //           <div style="width: 60% ; text-align: left ; padding-top: 20px;">
  //               <a href="https://www.instagram.com/gordian.technologies/" target="_blank">
  //                   <img src="cid:Instagram.png" alt="Instagram" style="width: 3% ; margin-right: 10px">
  //               </a>
  //               <a href="https://www.linkedin.com/company/gordian-technologies-private-limited/" target="_blank">
  //                   <img src="cid:linkedin.png" alt="linkedin" style="width: 3%;">
  //               </a>
  //               <br /><br />
  //               Gordian Technologies Pvt. Ltd.<br />
  //               <a href="mailto:support@gordian.in">support@gordian.in</a>
  //           </div>
  //       </center>
  //     </div>`;

  //   const attachments = [
  //       {
  //         filename: "Logo.png",
  //         path: __dirname + "/images/Logo.png",
  //         cid: "HeaderLogo.png",
  //       },
  //       {
  //         filename: "Instagram.png",
  //         path: __dirname + "/images/Instagram.png",
  //         cid: "Instagram.png",
  //       },
  //       {
  //         filename: "linkedin.png",
  //         path: __dirname + "/images/linkedin.png",
  //         cid: "linkedin.png",
  //       },
  //     ];

  //     return { html, attachments };
  // };

  router.post("/sendConfirmMsg", (req, res) => {
    return res.status(202);
  });

  router.post("/sendConfirmMsgAdmin", (req, res) => {
    const api = process.env.TEXTLOCAL_KEY;
    const message = req.body.message;
    const sender = req.body.sender;
    const contact = req.body.contact;
    const address = req.body.address;

    const url = `${address}apikey=${api}&numbers=${contact}&message=${message}&sender=${sender}`;

    request(url, (error, response, body) => {
      if (error)
        logger.log('Error while sending message.')
      else
        logger.log("Message has been sent to the person");
    });
  });

  // This route gets the details of the user specified.
  router.get("/getDetails", async (req, res) => {
    const user = await UserModel.findById(req.body.userId);
    if (!user) {
      res.status(404).json({
        message: "Can't find user details, please try again.",
      });
    }
    res.json(user);
  });

router.get(
  "/getOrderDetails", 
  Utility.disableCache,
  async (req, res) => 
  {
  try {
    const { query } = req;
    const { orderId} = query;

    if (typeof orderId !== 'string' || orderId.length <= 1 || orderId === "null") {
      logger.error("Orders::getOrderDetails::Invalid orderID = ", orderId);
      return res.status(422).send({"message": "Invalid orderId"});
    };
    
    // const taskId = `${orderId}-task-1`;
    const taskId = `${orderId}`;
    const locusTaskDetails = await TookanService.getTask(taskId);
    
    const { eta, trackLink } = locusTaskDetails;//eta and tracklink properties not available in Tookan service
    const { pickUpTrackLink, dropTrackLink } = TookanService.getTrackLink(locusTaskDetails);

    return res.status(200).send({
      message: "Fetched order getDetails",
      data: {
        eta, 
        trackLink,
        pickUpTrackLink,
        dropTrackLink
      }
    });
  } catch(e) {
    if (e && e.hasOwnProperty("statusCode")) {
      // status code returned from locus
      if (e.statusCode === 404) {
        logger.error("Orders::GET /getOrderDetails:: Order not found", e.body);
        return res.status(404).send({"message": "Order not found"});
      };
    };
    logger.error("Orders::GET /getOrderDetails:: Unhandled error", e.body);
    return res.status(500).send({"message": "Something went wrong. Please try again"});
  };
});

  // get all the orders that are completed.
  router.get("/completedOrders", async (req, res) => {
    const user = await OrderModel.find({
      userId: req.body.userId,
      orderStatus: Enums.Locus.TASK_STATUS.COMPLETED,
    });

    if (!user) {
      res.status(404).json({
        message: "Can't find any orders.",
      });
    }
    res.json(user);
  });

  router.get("/cancelledOrders", async (req, res) => {
    const user = await OrderModel.find({
      userId: req.body.userId,
      orderStatus: Enums.Locus.TASK_STATUS.CANCELLED,
    });

    if (!user) {
      res.status(404).json({
        message: "Can't find any orders.",
      });
    }
    res.json(user);
  });

  // This route is used to save the pickup address of the user.
  router.post("/savePickupDetails", async (req, res) => {
    const { userId, senderName, senderAdd, senderBuilding, senderContact } = req.body;

    try {
      await UserModel.findByIdAndUpdate(userId, {
        senderName,
        senderAdd,
        senderFlat,
        senderBuilding,
        senderContact,
      });
      res.status(200).json({
        message: "Data saved successfully",
      });
    } catch (error) {
      res.status(400).json({
        message: `Error while saving data. Error is: ${error}`,
      });
    }
  });

  // This route is used to save the drop address for the user.
  router.post("/saveDropDetails", async (req, res) => {
    const { userId, receiverName, receiverAdd, receiverBuilding, receiverContact } = req.body;

    try {
      await UserModel.findByIdAndUpdate(userId, {
        receiverName,
        receiverAdd,
        receiverFlat,
        receiverBuilding,
        receiverContact,
      });
      res.status(200).json({
        message: "Data saved successfully",
      });
    } catch (error) {
      res.status(400).json({
        message: `Error while saving data. Error is: ${error}`,
      });
    }
  });

  router.post('/cancelOrder', async (req, res) => {
    const { orderId } = req.body;
    try {
      let order = await OrderModel.findOne({
        orderId
      });

      if (!order) {
        return res.status(400).json({
          message: "Unable to find that order"
        })
      }

      if (order.orderStatus !== Enums.Locus.TASK_STATUS.STARTED) {
        return res.status(400).json({
          message: "Cannot cancel an order after it is picked up"
        });
      }

      // await razorpay.payments.refund(order.payment.paymentId, {
      //   amount: order.amount * 100
      // });
      order.orderStatus = Enums.Locus.TASK_STATUS.CANCELLED;
      await order.save();
      res.status(200).json({
        message: 'Order Cancelled'
      })
    } catch (error) {
      res.status(400).json({
        message: "Can't cancel the order. Please try again."
      })
    }
  })

  module.exports = router;
