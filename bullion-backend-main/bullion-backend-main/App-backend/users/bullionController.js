const express = require("express");
const router = express.Router();
const bullionService = require("../services/BullionService");
const orderService = require("./orders_service");
const Enums = require("../_helpers/Enums");
const authorize = require("./../_middleware/authorize");
const checkServiceability = require("../_middleware/serviceability");
const usersDTO = require("./../dto/UsersDto");
const ordersDTO = require("./../dto/OrdersDto");
const authorizeTrader = require("../_middleware/authorizeTrader");
const webhookService = require('./webhook_service');
const zerodhaService = require("../services/ZerodhaService");
const TraderModel = require("../Models/TraderModel");
const InvoiceService = require("./InvoiceService");
const logger = require("../_helpers/logger");
const authorizeService = require("../_middleware/authorizeServiceAccount");
const OrderModel = require("../Models/OrderModel");
const bullion = require("../_helpers/serviceNames").bullion;

const { orderCreated, orderAccepted, paidToTrader, orderReadyForDispatch, paidByCustomer, paymentAccepted, paymentRefunded, adminDeleted } = Enums.bullionOrderStatus;
const allowedbullionOrderStatusTransitions = require("../config.json").allowedbullionOrderStatusTransitions

router.get("/items/", getItems);
router.get("/items/:itemId/quotes", checkServiceability(bullion), getItemQuotes);
router.get("/traders/:traderId/items/:itemId/quote", checkServiceability(bullion), getSingleQuote);
router.get("/traders", getTraders);
router.get("/traders/:id", getTraderbyId);
router.get("/quotes/:exchangeTradingSymbol", authorizeTrader(), getGoldQuote);
router.post("/authenticate/traders", usersDTO.EmailPasswordAuthenticationRequest, authenticate);
router.post("/traders/refresh-token", refreshToken);
router.patch("/service/traders/:traderId", authorizeService(), updateMarkup); //TODO: Separate service related routes into a controller file
router.patch("/traders/:traderId", authorizeTrader(), updateMarkup);
router.get("/bullion/orders/", authorize(), getAllOrders);
router.get("/bullion/invoice/:orderId", authorize(['Admin']), genInvoice);
router.post("/bullion/orders/tasks", authorize(['Admin']), createTookanTask);
router.get("/bullion/orders/traders/", authorizeTrader(), getAllOrders);
router.patch("/bullion/orders/address/", authorizeTrader(), updatePickupAddress);
router.patch("/trader/orders/:orderId", authorizeTrader(), ordersDTO.updateOrder, updateOrder);
router.patch("/admin/orders/:orderId", authorize(["Admin"]), ordersDTO.updateOrder, updateOrder);

async function getItems(_request, response, next) {
  try {
    const items = await bullionService.getItems({ _id: { $ne: '6536531668a5d2fdd7d32cad' } }); // do not show silver
    if (items) {
      return response.status(200).json(items);
    }
    return response.status(404).json({
      error: "No items found, please try again later",
    });
  } catch (error) {
    next(error);
  }
}

async function updateMarkup(request, response, next) {
  try {
    const { markupValue, itemId } = request.body;
    const traderId = request.params.traderId;

    await bullionService.updateMarkup(traderId, itemId, markupValue)

    return response.status(200).json({
      message: "Markup updated successfully"
    })

  } catch (error) {
    next(error)
  }
}

async function getTraders(_request, response, next) {
  try {
    const traders = await bullionService.getTraders();
    if (traders) {
      return response.status(200).json(traders);
    }
    return response.status(404).json({
      error: "No traders found, please try again later",
    });
  } catch (error) {
    next(error)
  }
}

async function getGoldQuote(request, response, next) {
  try {
    const exchangeTradingSymbol = request.params.exchangeTradingSymbol;
    const quote = await zerodhaService.getSellingPrice(exchangeTradingSymbol);
    return response.status(200).json({
      rate: quote
    });
  }
  catch (error) {
    next(error)
  }

}

async function getTraderbyId(request, response, next) {
  try {
    const trader = await bullionService.getTraderbyId(request.params.id);
    if (trader) {
      return response.status(200).json(trader);
    }
    return response.status(404).json({
      error: "No trader found with given Id",
    });
  }
  catch (error) {
    next(error);
  }
}

async function getItemQuotes(request, response, next) {
  try {
    quotes = await bullionService.getQuotes(request.params.itemId);
    return response.status(200).json(quotes);

  } catch (error) {
    next(error)
  }
}

async function getAllOrders(request, response, next) {
  try {
    let orders;
    const { limit } = request.query
    let limitInt = 10;
    if (limit) {
      limitInt = parseInt(limit)
    }
    if (request.user.role == Enums.Roles.Admin) {
      orders = await orderService.fetchAllOrdersbyQuery({
        orderType: Enums.Order.Type.product,
        "item.currentStatus": { $ne: adminDeleted }
      }, 0, limitInt);
    } else {
      const userId = request.user._id;
      orders = await orderService.fetchAllOrdersbyQuery({
        orderType: Enums.Order.Type.product,
        "item.traderId": userId,
        "item.currentStatus": { $ne: adminDeleted }
      }, 0, limitInt);
    }
    return response.status(200).json(orders);

  } catch (error) {
    next(error)
  }
}

async function authenticate(req, res, next) {
  try {
    const { body } = req;
    const { email, password } = body;
    const response = await bullionService.authenticateUsingEmailPassword(
      email,
      password
    );
    res.status(200).send(response);
  } catch (e) {
    if (e.hasOwnProperty("status") && e.hasOwnProperty("message")) {
      const { status, ...error } = e;
      return res.status(status).send(error);
    }
    console.error("UserController::authenticate::Unhandled exception", e);
    res.status(500).send({ message: "Something went wrong. Please try again" });
  }
}

async function refreshToken(req, res, next) {
  try {
    const { body } = req;
    const token = body.refreshToken;
    if (!token) {
      console.debug(
        "BullionController::traderRefreshToken:: No refresh token found = ",
        token
      );
      return res.status(401).send({ message: "Invalid refresh token" });
    }
    const refreshedTokens = await bullionService.refreshAccessToken(token);
    return res.status(200).send(refreshedTokens);
  } catch (err) {
    if (err && err.hasOwnProperty("status")) {
      const { status, ...error } = err;
      return res.status(status).send(error);
    }
    console.error(
      "BullionController::traderRefreshToken::Uncaught exception = ",
      err
    );
    return res
      .status(500)
      .send({ message: "Something went wrong. Please try again" });
  }
}

async function getSingleQuote(request, response, next) {
  try {
    const { traderId, itemId } = request.params;
    const trader = await bullionService.getTraderbyId(traderId);
    const item = await bullionService.getItemById(itemId)
    const quote = await bullionService.getQuote(trader, item);
    return response.status(200).json(quote);
  } catch (error) {
    next(error)
  }
}

async function updateOrder(request, response, next) {
  try {
    const orderId = request.params.orderId;
    const query = { orderId: orderId };
    const { status } = request.body.item;
    const order = await orderService.findOne(query);
    const userRole = request.user.role;
    if (order) {
      let itemCurrentStatus = order.item.currentStatus;
      let allowedStatuses = allowedbullionOrderStatusTransitions[userRole][itemCurrentStatus];
      if (allowedStatuses && allowedStatuses.includes(status)) {
        const statusObj = {
          status: status,
          createdAt: new Date(),
        };
        const updateObject = {
          $set: { "item.currentStatus": status },
          $push: { "item.statusHistory": statusObj },
        };
        await orderService.findOneAndUpdate(query, updateObject).then(
          orderService.sendNotificationOnStatusChange(orderId, status)
        )
        if (status === orderAccepted) {
          await orderService.updateMarginExemption(order)
        }
        else if (status === paidToTrader) {
          await InvoiceService.createAndSendInvoice(orderId)
          await orderService.clearMarginExemption(order)
        }
        else if (status === orderReadyForDispatch) {
          createTookanOrder(orderId)
            .then(() => logger.info('Tookan order created successfully'))
            .catch(() => logger.error("Failed to create tooken order"))
        }
        return response.status(200).json({
          message: "Order status changed successfully"
        })

      } else {
        return response.status(401).json({
          error: "Current status change not allowed for this user"
        })
      }

    }
    else {
      return response.status(404).json({
        error: "Order with given id not found"
      })
    }
  }
  catch (error) {
    next(error)
  }


}

async function updatePickupAddress(request, response, next) {
  try {
    const { orderIds, address, buildingName, number, location } = request.body
    for (let i = 0; i < orderIds.length; i++) {
      const orderId = orderIds[i];
      const query = { orderId }
      const order = await orderService.findOne(query);
      const updateObject = {
        senderAdd: address,
        senderBuilding: buildingName,
        senderContact: number,
        senderLocation: location
      }
      if (order) {
        await orderService.findOneAndUpdate(query, updateObject)
      }
    }

    return response.status(200).json({
      message: "Address changed successfully"
    })

  } catch (e) {
    next(e)
  }
}

function createTookanOrder(orderId) {
  const body = {
    event: Enums.Razorpay.Webhooks.payment_captured,
    payload: {
      payment: {
        entity: {
          id: "", // payment_id
          order_id: "", //payment order_id
          method: Enums.PaymentMethod.gordian_wallet, //payment methof
          notes: {
            orderId: orderId, //gordian orderId
            paymentType: Enums.PaymentType.booking,
          },
        },
      },
    },
  };
  webhookService.handleRazorpayWebhook(body);
}

async function genInvoice(request, response, next) {
  const orderId = request.params.orderId;
  try {
    const order = await OrderModel.findOne({
      orderId: orderId
    });
    if (order) {
      InvoiceService.createAndSendInvoice(orderId)
      return response.status(200).json({
        message: "Invoice generation triggered"
      })
    }
    else {
      return response.status(404).json({
        message: "Order with given orderId not found"
      })
    }
  } catch (error) {
    logger.error(error)
    next(error)
  }
}

async function createTookanTask(request, response, next) {
  const orderId = request.body.orderId
  try {
    const order = await OrderModel.findOne({
      orderId: orderId
    });
    if (order) {
      createTookanOrder(orderId)
      return response.status(200).json({
        message: "Tookan task triggered"
      })
    }
    else {
      return response.status(404).json({
        message: "Order with given orderId not found"
      });
    }

  } catch (error) {
    logger.error(error)
    next(error)
  }
}

module.exports = router;
