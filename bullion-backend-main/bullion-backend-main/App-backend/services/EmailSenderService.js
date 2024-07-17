const WhatsappService = new (require("../users/WhatsappService"))();
const EmailService = new (require('../users/EmailService'))();
const { captureException } = require("@sentry/node");
const Enums = require("../_helpers/Enums");
const logger = require("../_helpers/logger");


module.exports = {
  sendOrderConfirmationMail
}

async function sendOrderConfirmationMail(customerOrder, traderOrder, orderType) {
  try {
    const { email } = customerOrder.userId;
    const subject = "New order Attempt";
    const cc = process.env.ADMIN_EMAIL;
    const { html, attachments } = generateOrderConfirmationHTML(
      customerOrder,
      customerOrder,
      orderType
    );

    await EmailService.send(email, subject, html, undefined, attachments, cc);

    if (orderType === Enums.Order.Type.product) {
      const item = traderOrder.itemId;
      const traderEmail = traderOrder.traderId.email;
      const subject = "Bullion - New Order";
      const cc = process.env.ADMIN_EMAIL;
      const { html, attachments } = generateTraderOrderConfirmationHTML(
        traderOrder,
        traderOrder
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
        customerOrder.userId.phonenumber, //user phone
        customerOrder.orderId,
        customerOrder.traderId.name, //trader name
        customerOrder.itemId.name, // item name
        customerOrder.quantity,
        customerOrder.quote,
        customerOrder.bullionAmount,
        customerOrder.totalAmount, //TODO: change it to total amount
        customerOrder.created_at.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      );

      WhatsappService.notifyTradersOnNewOrder(
        traderOrder.traderId.phonenumber, //trader phone
        traderOrder.traderId.name, //trader name
        traderOrder.itemId.name, // item name
        traderOrder.quantity,
        traderOrder.quote,
        traderOrder.amountPayableToTrader,
        traderOrder.created_at.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
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

function generateOrderConfirmationHTML(newOrder, orderData = {}, orderType) {
  const user = orderData.userId

  var html = `
    <div style="text-align: center;margin-bottom: 10px;background-color: rgb(251, 251, 251);">
    <img src="cid:HeaderLogo.png" alt="Logo" style="width: 200px" />
    </div>
    <center>
    <div style="text-align: left; width: 60%; line-height: 27px">
    <font style="color: #008863">
    Your order details are below.
    </font><br /><br />`;
  if (orderType === Enums.Order.Type.delivery) {
    const isInsured = !newOrder.insurance.alreadyInsured;
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
      html += `Invoice Value: ₹ ${newOrder.insurance.amount || "N/A"}<br />
                  Insurance applied: ${isInsured ? "Yes" : "No"}<br />
                  Insurance amount paid: ${isInsured ? newOrder.currency : ""} ${isInsured ? (newOrder.insuranceCharges).toFixed(2) : "N/A"}<br />
                  Total amount paid: ₹ ${newOrder.amount}`;
    }
    else {
      html += `Total amount paid: ₹ ${newOrder.amount}`;
    }
  }
  else {
    html += `Name :${user.fullName}<br />
              Email Id: ${user.email}<br />
              Contact No: ${user.phonenumber}<br />
              Item: ${orderData.itemId.name}<br />
              Trader: ${orderData.traderId.name}<br />
              Quote: ${orderData.quote}<br />
              Bullion Quantity: ${newOrder.quantity}<br />
              Bullion Amount: ₹ ${newOrder.totalAmount}<br />`;

  }

  html += `<br /><br /></div></center>`;

  const { footer, attachments } = emaiFooter();

  html = html + footer;

  return { html, attachments };
};

function generateTraderOrderConfirmationHTML(newOrder, orderData = {}) {
  let html = `
      <div style="text-align: center;margin-bottom: 10px;background-color: rgb(251, 251, 251);">
          <img src="cid:HeaderLogo.png" alt="Logo" style="width: 200px" />
      </div>
      <center>
          <div style="text-align: left; width: 60%; line-height: 27px">
              <font style="color: #008863">
              Order details are below.
              </font><br /><br />
              Trader: ${orderData.traderId.name}<br />
              Item: ${orderData.itemId.name}<br />
              Bullion Quantity: ${newOrder.quantity}<br />
              Quote: ${orderData.quote}<br />
              Bullion Amount: INR ${newOrder.amountPayableToTrader}<br />
              Order Id: ${newOrder.orderId}
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
    path: __dirname + "/../images/Logo.png",
    cid: "HeaderLogo.png",
  }, {
    filename: "Instagram.png",
    path: __dirname + "/../images/Instagram.png",
    cid: "Instagram.png",
  }, {
    filename: "linkedin.png",
    path: __dirname + "/../images/linkedin.png",
    cid: "linkedin.png",
  }];

  return { footer, attachments }
}
