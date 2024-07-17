const express = require("express");
const router = express.Router();
const bullionService = require("../services/BullionService");
const Enums = require("../_helpers/Enums");
const authorize = require("./../_middleware/authorize");
const checkServiceability = require("../_middleware/serviceability");
const usersDTO = require("./../dto/UsersDto");
const ordersDTO = require("./../dto/OrdersDto");
const bullionOrdersDTO = require("../dto/bullionOrderDTO")
const authorizeTrader = require("../_middleware/authorizeTrader");
const zerodhaService = require("../services/ZerodhaService");
const logger = require("../_helpers/logger");
const authorizeService = require("../_middleware/authorizeServiceAccount");
const {
  monitorTriggers, createTrigger, getTriggersForAdmin, getTriggersForUser, deactivateTrigger
} = require("../services/triggersService");
const bullion = require("../_helpers/serviceNames").bullion;

router.get("/items/", getItems);
router.get("/traders", getTraders);
router.get("/traders/:id", getTraderbyId);
router.post("/authenticate/traders", usersDTO.EmailPasswordAuthenticationRequest, authenticate);
router.post("/traders/refresh-token", refreshToken);
router.post("/orders/", authorize(), checkServiceability(bullion), bullionOrdersDTO.newBullionOrderRequest, createBullionOrder);
router.patch("/orders/:orderId", authorize(), bullionOrdersDTO.updateBullionOrderRequest, updateBullionOrder);
router.get("/orders/:orderId", authorize(), getBullionOrder);
router.post("/triggers/", authorize(), bullionOrdersDTO.newTriggerRequest, createNewTrigger)
router.get("/triggers/", authorize(), getTriggers);
router.delete("/triggers/:triggerId", authorize(), deleteTrigger);
router.get("/orders/", authorize(), getAllOrders);
router.get("/orders/traders/", authorizeTrader(), getAllOrders);
router.patch("/orders/address/", authorizeTrader(), updatePickupAddress);
router.patch("/trader/orders/:orderId", authorizeTrader(), ordersDTO.updateOrder, updateBullionOrderStatus);
router.patch("/admin/orders/:orderId", authorize(["Admin"]), ordersDTO.updateOrder, updateBullionOrderStatus);
router.post("/triggers/submit-rates/", receiveQuoteDetails)

async function getItems(_request, response, next) {
  try {
    const items = await bullionService.getItems();
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

async function createBullionOrder(request, response, next) {
  try {
    const orderBody = request.body
    orderBody.userId = request.user._id
    const createdOrder = await bullionService.placeBullionOrder(orderBody)
    return response.status(201).json({
      message: "Order created successfully",
      data: { orderId: createdOrder.orderId }
    })
  } catch (error) {
    logger.error('Exception in BullionControllerV2::createBullionOrder', error)
    next(error)
  }
}

async function updateBullionOrder(request, response, next) {
  try {
    const orderId = request.params.orderId;
    const receiverDetails = request.body.receiverDetails;
    const item = request.body.item;
    const userId = request.user._id;
    const userRole = request.user.role;
    let updatedOrder = null;

    if (item) {
      const paymentRef = item?.payment?.paymentRef || ""
      await bullionService.addPaymentReference(orderId, paymentRef, userId)
      updatedOrder = await bullionService.updateOrderStatus(orderId, Enums.bullionOrderStatus.paidByCustomer, userRole)
    }

    if (receiverDetails) {
      updatedOrder = await bullionService.updateOrderReceiverAddress(orderId, request.body, userId)
    }

    if (updatedOrder) {
      return response.status(200).json({
        message: "Order updated",
        data: { orderId: updatedOrder.orderId }
      })
    } else {
      return response.status(404).json({
        message: "Order not found",
        data: { orderId: orderId }
      })
    }

  } catch (error) {
    logger.error(error)
    next(error)
  }
}

async function getBullionOrder(request, response, next) {
  try {
    const { user, params } = request;
    const { orderId } = params;
    const { id } = user;
    const order = await bullionService.getBullionOrder(id, orderId)
    if (order) {
      return response.status(200).json({
        message: "Order found",
        data: { order }
      })
    } else {
      return response.status(404).json({
        message: "Order not found",
      })
    }
  } catch (error) {
    logger.error(error)
    next(error)
  }
}

async function createNewTrigger(request, response, next) {
  try {
    const orderBody = request.body
    const userId = request.user._id

    const limitOrder = await createTrigger(orderBody, userId)

    return response.status(201).json({
      data: { triggerId: limitOrder?._id },
      message: orderBody.triggerType + " order created successfully"
    })
  } catch (error) {
    logger.error(error)
    next(error)
  }
}

async function getTriggers(request, response, next) {
  try {
    let orders;

    if (request.user.role == Enums.Roles.Admin) {
      orders = await getTriggersForAdmin()
    } else {
      const userId = request.user._id;
      orders = await getTriggersForUser(userId);
    }

    return response.status(200).json(orders);

  } catch (error) {
    next(error)
  }
}

async function deleteTrigger(request, response, next) {
  try {
    const { user, params } = request;
    const { triggerId } = params;
    const { id } = user;
    await deactivateTrigger(id, triggerId)

    return response.status(200).json({
      message: "Trigger Deactivated",
    })
  } catch (error) {
    logger.error(error)
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

async function receiveQuoteDetails(request, response, next) {
  const currentPrices = request.body
  try {
    monitorTriggers(currentPrices)
  } catch (error) {
    logger.error("Error while triggering alerts :" + error)
  }
  return response.status(200).json({
    message: "Ack"
  })
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

async function getAllOrders(request, response, next) {
  try {
    let orders;

    if (request.user.role == Enums.Roles.Admin) {
      orders = await bullionService.getOrdersForAdmin()
    } else {
      const userId = request.user._id;
      const queryParams = request?.query
      orders = await bullionService.getOrdersForUser(userId, queryParams);
    }

    return response.status(200).json({ data: orders, message: "Fetched Bullion Orders" });

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

async function updateBullionOrderStatus(request, response, next) {
  try {
    const orderId = request.params.orderId;
    const { status } = request.body.item;
    const userRole = request.user.role;
    await bullionService.updateOrderStatus(orderId, status, userRole)

    return response.status(200).json({
      message: "Order was updated successfully"
    })

  }
  catch (error) {
    next(error)
  }


}

async function updatePickupAddress(request, response, next) {
  try {
    await bullionService.updatePickupAddress(request.body)

    return response.status(200).json({
      message: "Address changed successfully"
    })

  } catch (e) {
    next(e)
  }
}

module.exports = router;
