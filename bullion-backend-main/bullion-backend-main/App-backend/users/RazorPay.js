const razorpay = require("razorpay");
const Enums = require("../_helpers/Enums");
require("dotenv").config();

class Razorpay {
  constructor() {
    const key_id = process.env.RAZORPAY_KEY;
    const key_secret = process.env.RAZORPAY_SECRET;
    this.razorpay = new razorpay({ key_id, key_secret });
  }

  async create(amount, currency, receipt, paymentType = Enums.PaymentType.onDemand, payment_capture = 1) {
    return await this.razorpay.orders.create({
      amount,
      currency,
      receipt,
      payment_capture,
      notes: {
        gordian: "Order",
        orderId: receipt,
        paymentType: paymentType
      }
    });
  }

  async refund(paymentId, amount, options = {}) {
    const opt = { amount, ...options };
    return await this.razorpay.payments.refund(paymentId, opt);
  }

  async createPaymentLink(amount, currency, OrderId, phone) {
    try {
      return await this.razorpay.paymentLink.create({
        amount: amount,
        currency: currency,
        accept_partial: false,
        description: "New Gordian Order",
        reference_id: OrderId,
        customer: {
          //name: name,
          //email: "abc.xyz@example.com",
          contact: phone, //"+919000090000"
        },
        notify: {
          sms: true,
          email: false,
          //whatsapp: true,
        },
        reminder_enable: true,
        notes: {
          gordian: "Payment Link",
          orderId: OrderId,
          paymentType: Enums.PaymentType.postPay
        },
        //callback_url: "https://example-callback-url.com/",
        //callback_method: "get"
      });
    } catch (e) {
      console.error(" Errors creating razorpay payment link: ", e.error.description);
      throw {
        status: 500,
        message: "Errors creating razorpay payment link:" + e.error.description,
      };
    }
  }

  async fetchPaymentLink(paymentLinkId) {
    return await this.razorpay.paymentLink.fetch(paymentLinkId);
  }
}

module.exports = Razorpay;
