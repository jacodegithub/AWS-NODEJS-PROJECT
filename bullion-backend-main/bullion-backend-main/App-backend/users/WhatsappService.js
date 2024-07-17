const request = require("request");

module.exports = class WhatsappService {
  constructor() {
    this.Template_Login_Otp = `login_otp`;
    this.Template_Signup_Otp = `signup_otp`;
    this.Template_PaymentLink = `pay_on_delivery_1`;
    this.Template_PaymentConfirmed = `pay_on_delivery_confirmed_1`;
    this.Template_location_to_rider = `location_to_rider_1`;
    this.Template_Wallet_Update = `wallet_account_updatev2`;
    this.Template_Trader_New_Order = `bullion_trader_new_order`;
    this.Template_Trader_Payment_Received = `bullion_trader_paymentreceived`;
    this.Template_Customer_New_Order = `bullion_customer_order_placed`;
    this.Template_Customer_Order_Dispatch = `bullion_customer_order_despatched`;
    this.Template_Bullion_Trigger_Alert = `bullion_trigger_alert`;
    this.Template_Referral_To_Referree_v2 = `referral_to_referree_v2`;
    this.Template_Referral_To_Referree_Nobusinessname_v1 = `referral_to_referree_nobsuinessname_v1`;
  }

  sendWhatsapp(message) {
    return new Promise((resolve, reject) => {
      var options = {
        method: "POST",
        url: "https://live-server-7554.wati.io/api/v1/sendTemplateMessages",
        headers: {
          Authorization: `Bearer ${process.env.WATI_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: message,
      };
      request(options, function (error, response) {
        if (error) {
          console.error("SMSService::sendWhatsapp::Error whatsapp", error);
          return reject(error);
        }
        if (response.statusCode !== 200) {
          console.error(
            "SMSService::sendWhatsapp::Error ",
            response.statusCode
          );
          return reject(response);
        }

        resolve({ response });
      });
    });
  }

  formatPhoneNumberForWati(phone) {
    if (phone.length >= 10) {
      phone = phone.substring(phone.length - 10);
    } else {
      throw {
        status: 412,
        message: "Invalid phone number",
      };
    }
    phone = "91" + phone;
    return phone;
  }

  sendOtpMsg(otp, phone) {
    const body = JSON.stringify({
      template_name: this.Template_Signup_Otp,
      broadcast_name: "Broadcast_api_msg",
      receivers: [
        {
          whatsappNumber: this.formatPhoneNumberForWati(phone),
          customParams: [
            {
              name: "1",
              value: otp,
            },
          ],
        },
      ],
    });
    return this.sendWhatsapp(body);
  }

  sendPaymentLink(amount, paymentLink, phone) {
    const body = JSON.stringify({
      template_name: this.Template_PaymentLink,
      broadcast_name: "pay_on_delivery_1",
      receivers: [
        {
          whatsappNumber: this.formatPhoneNumberForWati(phone),
          customParams: [
            {
              name: "1",
              value: amount,
            },
            {
              name: "2",
              value: paymentLink,
            },
          ],
        },
      ],
    });
    return this.sendWhatsapp(body);
  }

  notifyPaymentReceivedToAgent(amount, phone) {
    const body = JSON.stringify({
      template_name: this.Template_PaymentConfirmed,
      broadcast_name: "pay_on_delivery_confirmed_1",
      receivers: [
        {
          whatsappNumber: this.formatPhoneNumberForWati(phone),
          customParams: [
            {
              name: "1",
              value: amount,
            },
          ],
        },
      ],
    });
    return this.sendWhatsapp(body);
  }

  sendLocationToRider(
    order_id,
    phone,
    senderAdd,
    senderLocation,
    receiverAdd,
    receiverLocation,
    tookan_order_id
  ) {
    var body = JSON.stringify({
      template_name: this.Template_location_to_rider,
      broadcast_name: this.Template_location_to_rider,
      receivers: [
        {
          whatsappNumber: this.formatPhoneNumberForWati(phone),
          customParams: [
            {
              name: "1",
              value: order_id,
            },
            {
              name: "2",
              value: senderAdd,
            },
            {
              name: "3",
              value:
                "https://maps.google.com/?q=" +
                senderLocation.lat +
                "," +
                senderLocation.long,
            },
            {
              name: "4",
              value: receiverAdd,
            },
            {
              name: "5",
              value:
                "https://maps.google.com/?q=" +
                receiverLocation.lat +
                "," +
                receiverLocation.long,
            },
            {
              name: "6",
              value: tookan_order_id,
            },
          ],
        },
      ],
    });
    return this.sendWhatsapp(body);
  }

  notifyForWalletRecharge(receiversArray, amount) {
    const array = [];
    for (const receiver of receiversArray) {
      const obj = {
        whatsappNumber: this.formatPhoneNumberForWati(receiver),
        customParams: [
          {
            name: "amount",
            value: amount,
          },
        ],
      };
      array.push(obj);
    }
    const body = JSON.stringify({
      template_name: this.Template_Wallet_Update,
      broadcast_name: this.Template_Wallet_Update,
      receivers: array,
    });
    return this.sendWhatsapp(body);
  }

  notifyTradersOnNewOrder(phone, trader, item, qty, price, amount, datetime) {
    const body = JSON.stringify({
      template_name: this.Template_Trader_New_Order,
      broadcast_name: this.Template_Trader_New_Order,
      receivers: [
        {
          whatsappNumber: this.formatPhoneNumberForWati(phone),
          customParams: [
            {
              name: "trader",
              value: trader,
            },
            {
              name: "item",
              value: item,
            },
            {
              name: "qty",
              value: qty,
            },
            {
              name: "price",
              value: price,
            },
            {
              name: "amount",
              value: amount,
            },
            {
              name: "datetime",
              value: datetime,
            },
          ],
        },
      ],
    });
    return this.sendWhatsapp(body);
  }

  notifyCustomerOnNewOrder(
    phone,
    orderId,
    trader,
    item,
    qty,
    price,
    amount,
    totalAmount,
    datetime
  ) {
    const body = JSON.stringify({
      template_name: this.Template_Customer_New_Order,
      broadcast_name: this.Template_Customer_New_Order,
      receivers: [
        {
          whatsappNumber: this.formatPhoneNumberForWati(phone),
          customParams: [
            {
              name: "orderid",
              value: orderId
            },
            {
              name: "trader",
              value: trader,
            },
            {
              name: "item",
              value: item,
            },
            {
              name: "qty",
              value: qty,
            },
            {
              name: "price",
              value: price,
            },
            {
              name: "amount",
              value: amount,
            },
            {
              name: "amountpaid",
              value: totalAmount
            },
            {
              name: "datetime",
              value: datetime,
            },
          ],
        },
      ],
    });
    return this.sendWhatsapp(body);
  }

  notifyTraderOnPayment(
    phone,
    orderId,
    trader,
    item,
    qty,
    price,
    amount,
    totalAmount,
    datetime
  ) {
    const body = JSON.stringify({
      template_name: this.Template_Trader_Payment_Received,
      broadcast_name: this.Template_Trader_Payment_Received,
      receivers: [
        {
          whatsappNumber: this.formatPhoneNumberForWati(phone),
          customParams: [
            {
              name: "orderid",
              value: orderId
            },
            {
              name: "trader",
              value: trader,
            },
            {
              name: "item",
              value: item,
            },
            {
              name: "qty",
              value: qty,
            },
            {
              name: "price",
              value: price,
            },
            {
              name: "amount",
              value: amount,
            },
            {
              name: "amountpaid",
              value: totalAmount
            },
            {
              name: "datetime",
              value: datetime,
            },
          ],
        },
      ],
    });
    return this.sendWhatsapp(body);
  }

  notifyUserOnDispatch(
    phone,
    orderId,
    trader,
    item,
    qty,
  ) {
    const body = JSON.stringify({
      template_name: this.Template_Customer_Order_Dispatch,
      broadcast_name: this.Template_Customer_Order_Dispatch,
      receivers: [
        {
          whatsappNumber: this.formatPhoneNumberForWati(phone),
          customParams: [
            {
              name: "orderid",
              value: orderId
            },
            {
              name: "trader",
              value: trader,
            },
            {
              name: "item",
              value: item,
            },
            {
              name: "qty",
              value: qty,
            }
          ],
        },
      ],
    });
    return this.sendWhatsapp(body);
  }

  notifyCustomerAlertTriggered(
    phone,
    itemName,
    traderName,
    triggerRate,
    currentRate,
    timeStamp
  ) {
    const body = JSON.stringify({
      template_name: this.Template_Bullion_Trigger_Alert,
      broadcast_name: this.Template_Bullion_Trigger_Alert,
      receivers: [
        {
          whatsappNumber: this.formatPhoneNumberForWati(phone),
          customParams: [
            {
              name: "item",
              value: itemName
            },
            {
              name: "triggerrate",
              value: triggerRate,
            },
            {
              name: "currentrate",
              value: currentRate,
            },
            {
              name: "tradername",
              value: traderName,
            },
            {
              name: "timestamp",
              value: timeStamp,
            }
          ],
        },
      ],
    });
    return this.sendWhatsapp(body);
  }

  notifyReferral(
    phone,
    userFullName,
    referrerId,
    userGSTBusinessName,
    numMonths,
  ) {
    const body = JSON.stringify({
      template_name: this.Template_Referral_To_Referree_v2,
      broadcast_name: this.Template_Referral_To_Referree_v2,
      receivers: [
        {
          whatsappNumber: this.formatPhoneNumberForWati(phone),
          customParams: [
            {
              name: "user_fullname",
              value: userFullName
            },
            {
              name: "user_gst_businessname",
              value: userGSTBusinessName,
            },
            {
              name: "numberofmonths",
              value: numMonths,
            },
            {
              name: "code",
              value: referrerId,
            },
          ],
        },
      ],
    });
    return this.sendWhatsapp(body);
  }

  notifyReferralWithoutBusinessName(
    phone,
    userFullName,
    referralCode,
    numMonths,
  ) {
    const body = JSON.stringify({
      template_name: this.Template_Referral_To_Referree_Nobusinessname_v1,
      broadcast_name: this.Template_Referral_To_Referree_Nobusinessname_v1,
      receivers: [
        {
          whatsappNumber: this.formatPhoneNumberForWati(phone),
          customParams: [
            {
              name: "user_fullname",
              value: userFullName
            },
            {
              name: "numberofmonths",
              value: numMonths,
            },
            {
              name: "code",
              value: referralCode,
            },
          ],
        },
      ],
    });
    return this.sendWhatsapp(body);
  }
};
