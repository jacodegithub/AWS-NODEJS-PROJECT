const OrderService = require("./orders_service");
const Order = require("./../Models/OrderModel");
const UserService = require("./UserService");
const PromoService = require("./promocodes.service");
const { getOffset } = require("../_helpers/Utility");
const TookanService = new (require("./TookanService"))();
const DeviceService = new (require("./DeviceService"))();

module.exports = {
  getOrderList,
  getRiderLocation,
  getDeviceLocation,
  getRiderAndDeviceId,
  getTransactions,
  getTransactionCount,
  getPromocodeList,
  updatePromocode,
  addPromocode,
};

async function getOrderList() {
  try {
    let dt = new Date();
    dt.setDate(dt.getDate() - 10);
    const query = { orderStatus: "ongoing", created_at: { $gte: dt } };
    const orders = await OrderService.find(
      query,
      undefined,
      { created_at: -1 },
      0,
      100
    );
    return orders;
  } catch (e) {
    console.error("AdminUser::GetList::Uncaught error", e);
    throw e;
  }
}

async function getTransactionCount(search) {
  try {
    const reg = new RegExp(search, "i");
    const query = search ? { orderId: { $regex: reg } } : {};
    const count = await OrderService.count(query);
    return count;
  } catch (e) {
    console.error("AdminUser::GetTransactionsList::Uncaught error", e);
    throw e;
  }
}

async function getPromocodeList() {
  try {
    const promocodes = await PromoService.find();
    return promocodes;
  } catch (e) {
    console.error("AdminUser::GetPromocodeList::Uncaught error", e);
    throw e;
  }
}

async function addPromocode(data) {
  try {
    const promo = await PromoService.add(data);
    return promo;
  } catch (e) {
    console.error("AdminUser::AddPromocodeList::Uncaught error", e);
    throw e;
  }
}

async function updatePromocode(data) {
  try {
    const getModifications = (data) => {
      const modifications = {};
      Object.keys(data).map((k) => {
        if (typeof data[k] == "object") {
          Object.keys(data[k]).map((sk) => {
            modifications[`${k}.${sk}`] = data[k][sk];
          });
        } else {
          modifications[k] = data[k];
        }
      });
      return modifications;
    };
    const promocodes = await PromoService.updateOne(
      { _id: data._id },
      { $set: getModifications(data) }
    );
    return promocodes;
  } catch (e) {
    console.error("AdminUser::UpdatePromocodeList::Uncaught error", e);
    throw e;
  }
}

async function getTransactions(page, limit, search) {
  try {
    const reg = new RegExp(search, "i");
    const query = search ? { orderId: { $regex: reg } } : {};
    const orders = await OrderService.find(
      query,
      undefined,
      { created_at: -1 },
      getOffset(page, limit),
      limit
    );
    const User = new UserService();
    return Promise.all(
      orders.map(async function (order) {
        const user = await User.findOne({ _id: order.userId });
        return {
          id: order.orderId,
          userId: order["userId"],
          user: user.fullName,
          status: order.orderStatus,
          distance: order.distance,
          senderDetails: {
            senderAdd: order.senderAdd,
            senderBuilding: order.senderBuilding,
            senderContact: order.senderContact,
          },
          receiverDetails: {
            receiverAdd: order.receiverAdd,
            receiverBuilding: order.receiverBuilding,
            receiverContact: order.receiverContact,
          },
          insurance: order.insurance,
          deliveryCosts: order.deliveryCosts,
          invoiceUrl: order.invoiceUrl,
        };
      })
    );
  } catch (e) {
    console.error("AdminUser::GetTransactionsList::Uncaught error", e);
    throw e;
  }
}

async function getRiderLocation(fleet_id) {
  try {
    const location = await TookanService.getAgentLocation(fleet_id);
    const result = DeviceService.addTimeInResponse(location, fleet_id);
    return result;
  } catch (e) {
    console.error(
      `AdminUser::getRiderLocation::Error fetching Fleet gps location::${e.body.message}`
    );
    throw {
      status: 422,
      message: e.body.message,
    };
  }
}

async function getDeviceLocation(deviceNumber) {
  try {
    const result = await DeviceService.getDeviceLocation(deviceNumber);
    return result;
  } catch (e) {
    console.error(
      `AdminUser::getRiderLocation::Error fetching Fleet gps location::${e.body.message}`
    );
    throw {
      status: 422,
      message: e.body.message,
    };
  }
}

async function getRiderAndDeviceId(orderId) {
  try {
    const task = await TookanService.getTaskFromOrderId(orderId);
    const fleet_id = task.data[0].fleet_id;
    if (!fleet_id) {
      throw {
        status: 422,
        body: {
          message: "No rider found.",
        },
      };
    }
    const profile = await TookanService.getAgentProfile(fleet_id);
    const riderName = DeviceService.getNameFromProfile(profile);
    const riderPhone = DeviceService.getPhoneFromProfile(profile);
    const tags = await TookanService.getAgentTags(fleet_id);
    const boxId = DeviceService.getBoxIdFromTags(tags.data, "box");
    const result = {
      riderId: parseFloat(fleet_id),
      riderName: riderName,
      riderPhone: riderPhone,
      boxId: parseFloat(boxId),
    };
    return result;
  } catch (e) {
    console.error(
      `AdminUser::getRiderLocation::Error fetching Fleet gps location::${e.body.message}`
    );
    throw {
      status: 422,
      message: e.body.message,
    };
  }
}
