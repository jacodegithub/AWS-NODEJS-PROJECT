const request = require("request");
const Enums = require("./../_helpers/Enums");
const zohoTaxDetails = require("../config.json").zohoTaxDetails;

module.exports = class ZohoService {
  constructor() {
    this.ADMIN_EMAIL = process.env.ADMIN_EMAIL;

    this.ZOHO_BASE_URL = process.env.ZOHO_BASEURL;
    this.ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;

    this.REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
    this.CLIENT_ID = process.env.ZOHO_CLIENT_ID;
    this.CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
    this.REDIRECT_URL = process.env.ZOHO_REDIRECT_URL;
    this.ROLE_CUSTOMER = {
      customer_type: "individual",
      gst_treatment: "consumer",
    };
    this.ROLE_BUSINESS = {
      customer_type: "business",
      gst_treatment: "business_gst",
    };
    this.CONTACTS = `${this.ZOHO_BASE_URL}/contacts`;
    this.GST_DETAILS = `${this.ZOHO_BASE_URL}/search/gstin`;
    this.CREATE_INVOICE = `${this.ZOHO_BASE_URL}/invoices`;
    this.GET_TAXES = `${this.ZOHO_BASE_URL}/settings/taxes`;
  }

  refreshToken() {
    return new Promise((resolve, reject) => {
      let url = `https://accounts.zoho.com/oauth/v2/token`;
      url += `?refresh_token=${this.REFRESH_TOKEN}`;
      url += `&client_id=${this.CLIENT_ID}`;
      url += `&client_secret=${this.CLIENT_SECRET}`;
      url += `&redirect_uri=${this.REDIRECT_URL}`;
      url += `&grant_type=refresh_token`;
      var options = {
        method: "POST",
        url: url,
        json: true,
      };
      request(options, function (error, response) {
        if (error || response.statusCode !== 200) {
          return reject(response);
        }
        resolve(response.body.access_token);
      });
    });
  }

  // accessToken() {
  //   return new Promise((resolve, reject) => {
  //     const value = zohoCache.get("access-token");
  //     if (value == undefined) {
  //       // handle miss!
  //       let url = `https://accounts.zoho.com/oauth/v2/token`;
  //       url += `?refresh_token=${this.REFRESH_TOKEN}`;
  //       url += `&client_id=${this.CLIENT_ID}`;
  //       url += `&client_secret=${this.CLIENT_SECRET}`;
  //       url += `&redirect_uri=${this.REDIRECT_URL}`;
  //       url += `&grant_type=refresh_token`;
  //       var body = {
  //         json: true,
  //       };
  //       request.post(url, body, function (error, response, body) {
  //         if (error || response.statusCode !== 200) {
  //           reject(response.body);
  //         }
  //         zohoCache.set("access-token", response.body.access_token);
  //         resolve(zohoCache.get("access-token"));
  //       });
  //     } else {
  //       resolve(value);
  //     }
  //   });
  // }

  getContact(email, access_token) {
    return new Promise((resolve, reject) => {
      var options = {
        method: "GET",
        url: `${this.CONTACTS}?organization_id=${this.ZOHO_ORG_ID}&email=${email}`,
        headers: {
          Authorization: `Zoho-oauthtoken ${access_token}`,
        },
        json: true,
      };
      request(options, function (error, response) {
        if (error || response.statusCode !== 200) {
          console.error(
            `ZohoService::getContact::Error after refresh token ${response.statusCode} and ${error}`
          );
          return reject(response);
        }
        resolve(response.body.contacts[0]);
      });
    });
  }

  newCustomerBody(name, email, mobile, role, gst_no) {
    const firstName = name.split(" ").slice(0, -1).join(" ");
    const lastName = name.split(" ").slice(-1).join(" ");
    let body;

    if (role === Enums.Roles.Bussiness) {
      body = {
        contact_name: name,
        contact_type: "customer",
        customer_sub_type: this.ROLE_BUSINESS.customer_type,
        is_taxable: true,
        gst_treatment: this.ROLE_BUSINESS.gst_treatment,
        gst_no: gst_no,
        place_of_contact: "KA",
        contact_persons: [
          {
            first_name: firstName,
            last_name: lastName,
            mobile: mobile,
            email: email,
            is_primary_contact: true,
          },
        ]
        // ,
        // billing_address: {
        //   address: gst.address,
        //   state_code: gst.state_code2,
        //   city: gst.city,
        //   state: gst.state_code,
        //   zip: gst.pin,
        // },
        // legal_name: gst.legal_name,
        // trader_name: gst.trade_name,
      };
    } else {
      body = {
        contact_name: name,
        contact_type: "customer",
        customer_sub_type: this.ROLE_CUSTOMER.customer_type,
        is_taxable: true,
        gst_treatment: this.ROLE_CUSTOMER.gst_treatment,
        contact_persons: [
          {
            first_name: firstName,
            last_name: lastName,
            mobile: mobile,
            email: email,
            is_primary_contact: true,
          },
        ],
      };
    }

    return body;
  }

  newDeliveryInvoiceBody(orderId, customer_id, tax_id, tax_name, tax_percentage, amountBeforeTax, adjustment) {
    //const { amountBeforeTax, adjustment } = this.calcAmountBeforeTax(amount);
    const body = {
      customer_id: customer_id,
      line_items: [
        {
          item_id: "",
          project_id: "",
          time_entry_ids: [],
          product_type: "service",
          hsn_or_sac: 9983,
          name: "Intra-City Delivery Services",
          description: "OrderID: " + orderId,
          item_order: 1,
          bcy_rate: amountBeforeTax,
          rate: amountBeforeTax,
          quantity: 1,
          unit: " ",
          discount_amount: 0,
          discount: 0,
          tax_id: tax_id,
          tax_name: tax_name,
          tax_type: "tax_group",
          tax_percentage: tax_percentage,
          gst_treatment_code: "",
          item_total: amountBeforeTax,
          item_custom_fields: [],
          tags: [],
          documents: [],
        },
      ],
      notes: "orderId: " + orderId + " \nLooking forward for your business.",
      terms: "Terms & Conditions apply",
      is_inclusive_tax: false,
      shipping_charge: 0,
      adjustment: adjustment,
      adjustment_description: (!isNaN(adjustment) && adjustment !== 0) ? "Rounding off" : "",
    };

    return body;
  }

  newProductInvoiceBody(orderId, customer_id, tax_id, tax_name, tax_percentage, itemName, quantity, productAmountBeforeTax, deliveryAmountBeforeTax, adjustment, deductTCS = false) {
    const body = {
      customer_id: customer_id,
      line_items: [
        {
          item_id: "",
          project_id: "",
          time_entry_ids: [],
          product_type: "service",
          hsn_or_sac: 7108,
          name: itemName,
          description: "OrderID: " + orderId,
          item_order: 1,
          bcy_rate: parseFloat((productAmountBeforeTax / quantity).toFixed(4)),
          rate: parseFloat((productAmountBeforeTax / quantity).toFixed(4)),
          quantity,
          unit: " ",
          discount_amount: 0,
          discount: 0,
          tax_id: tax_id,
          tax_name: tax_name,
          tax_type: "tax_group",
          tax_percentage: tax_percentage,
          gst_treatment_code: "",
          item_total: productAmountBeforeTax,
          item_custom_fields: [],
          tags: [],
          documents: [],
        },
        {
          item_id: "",
          project_id: "",
          time_entry_ids: [],
          product_type: "service",
          hsn_or_sac: 7108,
          name: "Delivery charges",
          description: "",
          item_order: 1,
          bcy_rate: deliveryAmountBeforeTax,
          rate: deliveryAmountBeforeTax,
          quantity: 1,
          unit: " ",
          discount_amount: 0,
          discount: 0,
          tax_id: tax_id,
          tax_name: tax_name,
          tax_type: "tax_group",
          tax_percentage: tax_percentage,
          gst_treatment_code: "",
          item_total: deliveryAmountBeforeTax,
          item_custom_fields: [],
          tags: [],
          documents: [],
        },
      ],
      notes: "orderId: " + orderId + " \nLooking forward for your business.",
      terms: "Terms & Conditions apply",
      is_inclusive_tax: false,
      shipping_charge: 0,
      adjustment: adjustment,
      adjustment_description: (!isNaN(adjustment) && adjustment !== 0) ? "Rounding off" : "",
    };

    if (deductTCS) {
      body.tcs_tax_id = zohoTaxDetails.tcsTaxId;
      body.tcs_percent = zohoTaxDetails.tcs
    }

    return body;
  }

  sendEmailBody(invoice_number, email) {
    const body = {
      send_from_org_email_id: true,
      to_mail_ids: [email],
      subject: `Invoice from Gordian Technologies (Invoice#: ${invoice_number})`,
      body: "Dear Customer,<br><br><br><br>Thanks for your business.<br><br><br><br>The invoice is attached with this email.<br><br>It was great working with you. Looking forward to working with you again.<br><br><br>Regards<br>Gordian Technologies<br>",
    }
    return body;
  }

  gstDetails(gstModel) {
    const per_add = gst_api_response.pradr.addr;
    const gst = {
      gst_no: gstModel.gstin,
      business_name: gstModel.business_name,
      trade_name: gstModel.trade_name,
      address:
        per_add.bno +
        " " +
        per_add.flno +
        " " +
        per_add.bno +
        " " +
        per_add.dst,
      location: loc,
      city: city,
      state: stcd,
      state_code: gstModel.stjCd,
      state_code2: gstModel.stjCd.slice(0, 2).toUpperCase(),
      pin: pncd,
    };
    return gst;
  }

  calcAmountBeforeTax(amount, taxPercentage, deliveryAmount = 0) {
    let amountBeforeTax, deliveryAmountBeforeTax, taxAmount, taxDeliveryAmount, adjustment
    const tax = taxPercentage / 100

    deliveryAmount = 0;

    amountBeforeTax = amount / (1 + tax)
    amountBeforeTax = parseFloat(amountBeforeTax.toFixed(4));

    deliveryAmountBeforeTax = deliveryAmount / (1 + tax)
    deliveryAmountBeforeTax = parseFloat(deliveryAmountBeforeTax.toFixed(4));

    taxAmount = amountBeforeTax * (tax / 2)
    taxAmount = parseFloat(taxAmount.toFixed(4))

    taxDeliveryAmount = deliveryAmountBeforeTax * (tax / 2)
    taxDeliveryAmount = parseFloat(deliveryAmountBeforeTax.toFixed(4))

    adjustment = amount - (amountBeforeTax + (2 * (taxAmount)) + taxDeliveryAmount + taxDeliveryAmount);
    adjustment = parseFloat(adjustment.toFixed(4));

    return { amountBeforeTax, deliveryAmountBeforeTax, adjustment };

  }

  createContact(name, email, mobile, role, gst_no, access_token) {
    return new Promise((resolve, reject) => {
      var options = {
        method: "POST",
        url: `${this.CONTACTS}?organization_id=${this.ZOHO_ORG_ID}`,
        headers: {
          Authorization: `Zoho-oauthtoken ${access_token}`,
        },
        body: this.newCustomerBody(name, email, mobile, role, gst_no),
        json: true,
      };

      request(options, function (error, response) {
        if (error || response.statusCode !== 201) {
          console.error(
            `ZohoService::getContact::Error after refresh token ${response.statusCode} and ${error}`
          );
          return reject(response);
        }
        resolve(response.body);
      });
    });
  }
  //zoho gst api is not accessible from code.

  // getGstDetails(gstNumber,access_token) {
  //   return new Promise((resolve, reject) => {
  //     var options = {
  //       method: "GET",
  //       url: `${this.GST_DETAILS}?gstin=${gstNumber}&organization_id=${this.ZOHO_ORG_ID}`,
  //       headers: {
  //         Authorization: `Zoho-oauthtoken ${access_token}`,
  //       },
  //       json: true,
  //     };

  //     request(options, function (error, response) {
  //       if (error || response.statusCode !== 200) {
  //         console.error(
  //           `ZohoService::getGstDetails::Error after refresh token ${response.statusCode} and ${error}`
  //         );
  //         return reject(response);
  //       }
  //       resolve(response.body);
  //     });
  //   });
  // }
  createInvoice(access_token, body) {
    return new Promise((resolve, reject) => {
      var options = {
        method: "POST",
        url: `${this.CREATE_INVOICE}?organization_id=${this.ZOHO_ORG_ID}`,
        headers: {
          Authorization: `Zoho-oauthtoken ${access_token}`,
        },
        body: body,
        json: true,
      };

      request(options, function (error, response) {
        if (error || response.statusCode !== 201) {
          console.error(
            `ZohoService::getGstDetails::Error after refresh token ${response.statusCode} and ${error}`
          );
          return reject(response);
        }
        resolve(response.body.invoice);
      });
    });
  }
  sendEmail(invoice_id, invoice_number, email, access_token) {
    return new Promise((resolve, reject) => {
      var options = {
        method: "POST",
        url: `${this.CREATE_INVOICE}/${invoice_id}/email?organization_id=${this.ZOHO_ORG_ID}`,
        headers: {
          Authorization: `Zoho-oauthtoken ${access_token}`,
        },
        body: this.sendEmailBody(invoice_number, email),
        json: true,
      };

      request(options, function (error, response) {
        if (error || response.statusCode !== 200) {
          console.error(
            `ZohoService::sendEmail::Status code: ${response.statusCode} and error: ${error}`
          );
          return reject(response);
        }
        resolve(response.body);
      });
    });
  }
  getTaxes(access_token) {
    return new Promise((resolve, reject) => {
      var options = {
        method: "GET",
        url: `${this.GET_TAXES}?organization_id=${this.ZOHO_ORG_ID}`,
        headers: {
          Authorization: `Zoho-oauthtoken ${access_token}`,
        },
        json: true,
      };

      request(options, function (error, response) {
        if (error || response.statusCode !== 200) {
          console.error(
            `ZohoService::getTaxes::Error getting taxes ${response.statusCode} and ${error}`
          );
          return reject(response);
        }
        resolve(response.body);
      });
    });
  }
};
