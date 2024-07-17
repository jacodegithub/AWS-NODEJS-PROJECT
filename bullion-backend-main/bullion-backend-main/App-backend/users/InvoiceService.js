const ZohoService = new (require("./ZohoService"))();
const OrderService = require("./orders_service");
const UserService = new (require("./UserService"))();
const CompanyService = new (require("./CompanyService"))();
const Enums = require("./../_helpers/Enums");
const logger = require("../_helpers/logger");
const { captureException } = require("@sentry/node");

module.exports = {
  createAndSendInvoice,
};

async function createAndSendInvoice(order_id) {
  //get order details
  const order = await OrderService.findOneWithDetail({
    orderId: order_id,
  });
  const { userId, amount, orderId, payment, orderType } = order;
  const { paymentType } = payment;
  if (orderType === Enums.Order.Type.delivery && (amount === 0 || paymentType === Enums.PaymentType.wallet)) {
    logger.info("Amount is 0, no need to send invoice");
    return true;
  }
  if (!userId) {
    throw {
      status: 409,
      message: `User not found for order_id:${orderId}`,
    };
  }
  const user = order._doc.userId._doc;
  if (!user) {
    throw {
      status: 409,
      message: `User not exist for order_id:${orderId}`,
    };
  }
  const { role, email, phonenumber, fullName, GST } = user;

  //if company is CaratLane, do not create invoice
  if (GST) {
    const { companyId } = GST;
    if (companyId) {
      const { companyName } = await CompanyService.findOne({
        _id: companyId.toString(),
      });

      if (companyName && companyName.toLowerCase() === "caratlane") {
        //return, do not crete or send invoice
        return;
      }
    }
  }

  // await ZohoService.refreshToken();
  const access_token = await ZohoService.refreshToken().catch((err) => {
    captureException(err)
    throw {
      status: 409,
      message: `Error getting zoho access token for order_id:${orderId}, error:${err}`,
    };
  });
  const contact = await ZohoService.getContact(email, access_token).catch(
    (err) => {
      captureException(err)
      throw {
        status: 409,
        message: `Error getting contact from zoho for order_id:${orderId}, error:${err}`,
      };
    }
  );
  if (!contact) {
    logger.info("Contact does not exist in zoho, create contact");

    let gst_no;

    if (role === Enums.Roles.Bussiness) {
      const { GST } = user;
      gst_no = GST.number;
      if (!gst_no) {
        throw {
          status: 409,
          message: `GST number not found for order_id:${orderId}, error:${err}`,
        };
      }
      //zoho gst search is not accessible from code
      //can use this if there is any other way of finding details through gst number

      // const gstDetails = await ZohoService.getGstDetails(number, access_token).catch(
      //   (err) => {
      //     throw {
      //       status: 409,
      //       message: `Error getting gst details from zoho for order_id:${orderId}`,
      //     };
      //   }
      // );
    }
    const zohoUser = await ZohoService.createContact(
      fullName,
      email,
      phonenumber,
      role,
      gst_no,
      access_token
    ).catch((err) => {
      captureException(err)
      throw {
        status: 409,
        message: `Error creating contact in zoho for order_id:${orderId}, error:${err}`,
      };
    });
    customer_id = zohoUser.contact.contact_id;
  } else {
    customer_id = contact.contact_id;
  }
  //get taxes
  const taxes = await ZohoService.getTaxes(access_token).catch((err) => {
    captureException(err)
    throw {
      status: 409,
      message: `Error getting taxes from zoho for order_id:${orderId}, error:${err}`,
    };
  });
  let body;
  if (orderType === Enums.Order.Type.delivery) {
    //get gst18 taxId  from zoho
    const taxGst18 = taxes.taxes.filter((c) => c.tax_name === "GST18")[0];
    if (!taxGst18) {
      throw {
        status: 409,
        message: `Tax Gst18 not found on zoho for order_id:${orderId}, error:${err}`,
      };
    }
    const { amountBeforeTax, adjustment } = ZohoService.calcAmountBeforeTax(amount, taxGst18.tax_percentage);

    body = ZohoService.newDeliveryInvoiceBody(
      orderId,
      customer_id,
      taxGst18.tax_id,
      taxGst18.tax_name,
      taxGst18.tax_percentage,
      amountBeforeTax,
      adjustment
    );
  } else {
    const taxGST3 = taxes.taxes.filter((c) => c.tax_name === "GST3")[0];
    if (!taxGST3) {
      throw {
        status: 409,
        message: `Tax GST3 not found on zoho for order_id:${orderId}, error:${err}`,
      };
    }
    const { item } = order;
    const { bullionAmount, quantity } = item;
    const itemName = order._doc.item.id._doc.name;
    //create invoice body
    const { amountBeforeTax, deliveryAmountBeforeTax, adjustment } = ZohoService.calcAmountBeforeTax(bullionAmount, taxGST3.tax_percentage, amount);
    let deductTCS = false;
    if (order?.item?.tcs != 0) { deductTCS = true };
    body = ZohoService.newProductInvoiceBody(
      orderId,
      customer_id,
      taxGST3.tax_id,
      taxGST3.tax_name,
      taxGST3.tax_percentage,
      itemName,
      quantity,
      amountBeforeTax,
      deliveryAmountBeforeTax,
      adjustment,
      deductTCS
    );
  }
  //create invoice
  const invoice = await ZohoService.createInvoice(access_token, body).catch(
    (err) => {
      captureException(err)
      throw {
        status: 409,
        message: `Error creating invoice in zoho for order_id:${orderId}, error:${err}`,
      };
    }
  );
  //save invoice
  const query_invoice = { orderId: order_id };
  let update_query_invoice = {
    $set: {
      invoiceUrl: invoice.invoice_url,
    },
  };
  await OrderService.findOneAndUpdate(
    query_invoice,
    update_query_invoice
  ).catch((err) => {
    captureException(err)
    throw {
      status: 409,
      message: `Error saving invoice for order_id:${orderId}, error:${err}`,
    };
  });

  //send invoice
  await ZohoService.sendEmail(
    invoice.invoice_id,
    invoice.invoice_number,
    invoice.email,
    access_token
  ).catch((err) => {
    captureException(err)
    throw {
      status: 409,
      message: `Error sending email invoice from zoho for order_id:${orderId}, error:${err}`,
    };
  });
  return invoice;
}
