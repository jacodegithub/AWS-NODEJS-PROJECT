const express = require("express");
const router = express.Router();
const customerAuthorize = require("../_middleware/authorize");
const AdminService = require("./adminUser.service");
const Enums = require("../_helpers/Enums");
const logger = require("../_helpers/logger");
const serviceConfigModel = require('../Models/ServiceConfigModel');
const UserModel = require("../Models/UserModel");
const pushNotificationService = require("../services/PushNotificationService");
const serviceNames = require("../_helpers/serviceNames");
const { captureException } = require("@sentry/node");
const { createAndSendInvoice } = require("./InvoiceService");
const OrderModel = require("../Models/OrderModel");

router.get(
  "/admin/getOrderList",
  customerAuthorize(Enums.Roles.Admin),
  getOrderList
);
router.get(
  "/admin/getRiderLocation",
  customerAuthorize([Enums.Roles.Admin]),
  getRiderLocation
);
router.get(
  "/admin/getDeviceLocation",
  customerAuthorize([Enums.Roles.Admin]),
  getDeviceLocation
);
router.get(
  "/admin/getRiderAndDeviceId",
  customerAuthorize([Enums.Roles.Admin]),
  getRiderAndDeviceId
);
router.get(
  "/admin/getTransactions",
  customerAuthorize(Enums.Roles.Admin),
  getTransactions
);
router.get(
  "/admin/promocodes",
  customerAuthorize(Enums.Roles.Admin),
  getPromocodes
);
router.put(
  "/admin/editPromocodes",
  customerAuthorize(Enums.Roles.Admin),
  editPromocodes
);
router.post(
  "/admin/addNewPromocode",
  customerAuthorize(Enums.Roles.Admin),
  addPromocode
);
router.patch("/admin/serviceability/:serviceName",
  customerAuthorize(Enums.Roles.Admin),
  toggleServiceability
);
router.post("/admin/invoice/:orderId/generate",
  customerAuthorize(Enums.Roles.Admin),
  generateInvoice
);

module.exports = router;

async function getOrderList(req, res, next) {
  try {
    const data = await AdminService.getOrderList();
    const response = {
      status: 200,
      data,
      message: "Orders fetched successfully",
    };
    return res.status(200).send(response);
  } catch (e) {
    return res
      .status(500)
      .send({ message: "Something went wrong. Please try again" });
  }
}

async function getPromocodes(req, res, next) {
  try {
    const data = await AdminService.getPromocodeList();
    const response = {
      status: 200,
      data,
      message: "Promocodes fetched successfully",
    };
    return res.status(200).send(response);
  } catch (e) {
    return res
      .status(500)
      .send({ message: "Something went wrong. Please try again" });
  }
}

async function editPromocodes(req, res, next) {
  try {
    const data = await AdminService.updatePromocode(req.body);
    const response = {
      status: 201,
      data,
      message: "Promocodes updated successfully",
    };
    return res.status(200).send(response);
  } catch (e) {
    return res
      .status(500)
      .send({ message: "Something went wrong. Please try again" });
  }
}

async function addPromocode(req, res, next) {
  try {
    const data = await AdminService.addPromocode(req.body);
    const response = {
      status: 201,
      data,
      message: "Promocodes updated successfully",
    };
    return res.status(200).send(response);
  } catch (e) {
    return res.status(500).send({ message: e });
  }
}

async function getTransactions(req, res, next) {
  try {
    const { page, limit, search } = req.query;
    const data = await AdminService.getTransactions(
      page,
      Number(limit),
      search
    );
    const response = {
      status: 200,
      data,
      count: await AdminService.getTransactionCount(search),
      message: "Transactions fetched successfully",
    };
    return res.status(200).send(response);
  } catch (e) {
    return res
      .status(500)
      .send({ message: "Something went wrong. Please try again" });
  }
}

async function getRiderAndDeviceId(req, res, next) {
  try {
    const orderId = req.query.orderId;
    if (!orderId) {
      throw {
        status: 422,
        message: "OrderId required.",
      };
    }
    const data = await AdminService.getRiderAndDeviceId(orderId);
    const response = {
      status: 200,
      data,
      message: "Gps location fetched successfully",
    };
    return res.status(200).send(response);
  } catch (e) {
    if (e.hasOwnProperty("status") && e.hasOwnProperty("message")) {
      const { status, ...error } = e;
      return res.status(status).send(error);
    }
    res.status(500).send({ message: "Something went wrong. Please try again" });
  }
}

async function getRiderLocation(req, res, next) {
  try {
    const riderId = req.query.riderId;
    if (!riderId) {
      throw {
        status: 422,
        message: "OrderId required.",
      };
    }
    const { data } = await AdminService.getRiderLocation(riderId);
    const response = {
      status: 200,
      data,
      message: "Gps location fetched successfully",
    };
    return res.status(200).send(response);
  } catch (e) {
    if (e.hasOwnProperty("status") && e.hasOwnProperty("message")) {
      const { status, ...error } = e;
      return res.status(status).send(error);
    }
    res.status(500).send({ message: "Something went wrong. Please try again" });
  }
}

async function getDeviceLocation(req, res, next) {
  try {
    const deviceId = req.query.deviceId;
    if (!deviceId) {
      throw {
        status: 422,
        message: "deviceNumber required.",
      };
    }
    const data = await AdminService.getDeviceLocation(deviceId);
    const response = {
      status: 200,
      data,
      message: "Gps location fetched successfully",
    };
    return res.status(200).send(response);
  } catch (e) {
    if (e.hasOwnProperty("status") && e.hasOwnProperty("message")) {
      const { status, ...error } = e;
      return res.status(status).send(error);
    }
    res.status(500).send({ message: "Something went wrong. Please try again" });
  }
}

async function toggleServiceability(req, res, next) {
  try {
    const { enabled } = req.body
    const { serviceName } = req.params
    const { nModified } = await serviceConfigModel.updateOne({ serviceName }, { enabled })
    let status
    (enabled === true) ? status = 'enabled' : status = 'disabled'
    res.status(200).json({
      message: serviceName + ' is now ' + status
    })

    if (nModified > 0 && serviceName === serviceNames.delivery) {
      logger.info('Sending serviceability notifications to users')
      const userList = await UserModel.find({ role: Enums.Roles.Bussiness }, { _id: 1 })
      const userIds = userList.map(user => user._id)
      let notifStatus
      const disabledNotif = {
        title: "Delivery services unavailable at the moment.",
        body: "We're experiencing a high volume of orders right now, so we're unable to accept new ones. We'll let you know as soon as we're back in action!"
      }

      const enabledNotif = {
        title: "Delivery services back online! 🟢",
        body: "We're back online. You can now place delivery orders."
      }
      let notification
      (enabled === true) ? notification = enabledNotif : notification = disabledNotif
      await pushNotificationService.sendNotifications(userIds, notification)
    }


  } catch (error) {
    logger.error(error)
    // next(error)
  }
}

async function generateInvoice(req, res, next) {
  try {
    const { orderId } = req.params
    const order = await OrderModel.findOne({ orderId })
    if (order?.invoiceUrl) {
      return res.status(200).json({
        message: "Invoice already exists for this order"
      })
    }
    if (order) {
      await createAndSendInvoice(orderId)
      return res.status(200).json({
        message: "Invoice created and sent successfully"
      })
    }
    else {
      return res.status(200).json({
        message: "Order with given id not found"
      })
    }
  } catch (error) {
    captureException(error)
    logger.error(error)
    next(error)
  }
}
