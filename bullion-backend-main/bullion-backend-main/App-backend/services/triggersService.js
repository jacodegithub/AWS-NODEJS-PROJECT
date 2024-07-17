const triggersModel = require('../Models/triggersModel')
const ObjectID = require('mongodb').ObjectID;
const ItemsModel = require('../Models/ItemsModel')
const notificationService = require('./PushNotificationService')
const Enums = require('../_helpers/Enums')
const UserModel = require('../Models/UserModel')
const { placeBullionOrder } = require('./BullionService')
const logger = require("../_helpers/logger");
const WhatsappService = new (require('../users/WhatsappService'))()

let localCurrentQuotes = {}

async function createTrigger(triggerData, userId) {
  const { triggerRate, itemId, quantity, traderIds, type } = triggerData
  const query = {
    type: type,
    triggerRate: triggerRate,
    itemId: ObjectID(itemId),
    quantity: quantity,
    status: Enums.Triggers.Status.ACTIVE,
    traderIds: { $all: traderIds?.map((traderId) => ObjectID(traderId)) }
  }

  const existingActiveTrigger = await triggersModel.findOne(query)

  if (existingActiveTrigger) {
    await triggersModel.updateOne({
      _id: existingActiveTrigger._id
    }, { $addToSet: { userIds: userId } })
  }
  else {
    triggerData.triggerCondition = Enums.Triggers.triggerConditions.currentPriceLessThanLimit
    triggerData.userIds = [userId]
    await triggersModel.create(triggerData)
  }
}

function triggerPopulateHelper(query) {
  return query
    .populate({
      path: "userIds", select: [
        "_id",
        "email",
        "fullName",
        "phonenumber",
      ]
    })
    .populate({
      path: "itemId",
      select: [
        "_id",
        "commodityName",
        "baseTradingWeightInGram",
        "baseTradingWeightUnitSymbol",
        "name",
        "type",
        "exchangeTradingSymbol",
      ]
    })
    .populate({
      path: "traderIds",
      select: [
        "_id",
        "name",
        "logo",
        "email",
      ]
    })
}

async function getTriggersForAdmin() {
  const query = triggersModel.find({})
    .sort({ created_at: -1 })
  const orders = triggerPopulateHelper(query);

  return orders
}

async function getTriggersForUser(userId) {
  const query = triggersModel.find({
    userIds: { $all: [userId] },
    status: {
      $ne: Enums.Triggers.Status.DEACTIVATED
    }
  }, {
    type: 1,
    traderIds: 1,
    userIds: 1,
    rateUnitInGram: 1,
    status: 1,
    itemId: 1,
    triggerRate: 1,
    quantity: 1,
    triggerCondition: 1,
    created_at: 1,
    updated_at: 1,
    triggeredOrders: { $elemMatch: { userId: ObjectID(userId) } }
  }).sort({ created_at: -1 })
  const orders = triggerPopulateHelper(query);
  return orders
}

async function monitorTriggers(currentQuotes) {
  localCurrentQuotes = currentQuotes
  const items = await ItemsModel.find({})
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const itemCurrentQuotes = currentQuotes[item?._id] || null

    const filteredItemQuotes = itemCurrentQuotes?.filter((itemQuote) => (itemQuote?.quote != null))

    if (filteredItemQuotes) {
      const { currentMinQuote } = getExtremeQuotes(filteredItemQuotes, item)
      await triggerIfCurrentPriceLessThanLimit(currentMinQuote)
    }
  }
}

function getExtremeQuotes(itemQuotes, item) {
  const currentMinQuote = itemQuotes.reduce((minQuote, currentQuote) =>
    (standardQuote(currentQuote) < standardQuote(minQuote) ? currentQuote : minQuote), itemQuotes[0])
  const currentMaxQuote = itemQuotes.reduce((maxQuote, currentQuote) =>
    (standardQuote(currentQuote) > standardQuote(maxQuote) ? currentQuote : maxQuote), itemQuotes[0])
  return { currentMaxQuote, currentMinQuote }
}

function standardQuote(currentQuote) {
  const { quote, quoteUnitInGram, baseTradingWeightInGram } = currentQuote

  if ((quote === null) || (quoteUnitInGram === null) || (baseTradingWeightInGram === null)) {
    return NaN;
  }
  return quote * baseTradingWeightInGram / quoteUnitInGram
}

async function triggerIfCurrentPriceLessThanLimit(currentMinQuote) {
  triggerAlerts(currentMinQuote)
  triggerLimitOrders(currentMinQuote)
}

async function triggerAlerts(currentMinQuote) {
  const standardizedQuote = standardQuote(currentMinQuote)
  const alerts = await triggersModel.find({
    triggerRate: { $gte: standardizedQuote },
    type: Enums.Triggers.Types.ALERT,
    status: Enums.Triggers.Status.ACTIVE,
    itemId: currentMinQuote.itemId
  })
  if (alerts.length > 0) {
    const alertIds = alerts.map((alert) => { return alert._id })
    sendAlertPushNotifications(currentMinQuote.itemName, alerts, standardizedQuote)
    sendWhatsappMessageToUsers(alerts, currentMinQuote)
    await triggersModel.updateMany({
      _id: { $in: alertIds },
      type: Enums.Triggers.Types.ALERT
    },
      { $set: { status: Enums.Triggers.Status.TRIGGERED } })
  }
}

async function sendWhatsappMessageToUsers(alerts, currentMinQuote) {
  const { itemName, trader } = currentMinQuote
  for (let i = 0; i < alerts.length; i++) {
    const alert = alerts[i]
    const userIdSet = new Set(alert.userIds)
    const uniqueUsers = Array.from(userIdSet)
    const users = await UserModel.find({ _id: { $in: uniqueUsers } })

    for (let j = 0; j < users.length; j++) {
      const user = users[j].toJSON()
      const ISTDateTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      await WhatsappService.notifyCustomerAlertTriggered(user.phonenumber, itemName, trader.name, alert.triggerRate, standardQuote(currentMinQuote), ISTDateTime)
    }
  }
}

async function triggerLimitOrders(currentMinQuote) {
  const standardizedQuote = standardQuote(currentMinQuote)
  const limitOrders = await triggersModel.find({
    triggerRate: { $gte: standardizedQuote },
    type: Enums.Triggers.Types.LIMIT_ORDER,
    status: Enums.Triggers.Status.ACTIVE,
    itemId: currentMinQuote.itemId
  })
  for (let i = 0; i < limitOrders.length; i++) {
    const limitOrder = limitOrders[i]
    const { itemId, traderIds } = limitOrder.toJSON()
    const stringifiedTraderIds = traderIds.map((traderId) => traderId.toString())
    logger.info('TraderIds', stringifiedTraderIds);

    if (stringifiedTraderIds?.includes(currentMinQuote?.trader?._id)) {
      placeBullionOrderForLimitOrder(limitOrder, currentMinQuote)
    } else {
      const minQuote = minTraderQuoteForLimitOrder(itemId, stringifiedTraderIds);
      if (minQuote && (minQuote?.quote <= limitOrder.triggerRate)) {
        placeBullionOrderForLimitOrder(limitOrder, minQuote)
      }
    }
  }
}

function minTraderQuoteForLimitOrder(itemId, traderIds) {
  const itemQuotes = localCurrentQuotes[itemId]
  const traderQuotes = itemQuotes
    .filter((quote) => traderIds?.includes(quote?.trader?._id))

  const minQuoteForTrader = traderQuotes.reduce((minQuote, currentQuote) =>
  ((standardQuote(currentQuote) < standardQuote(minQuote))
    ? currentQuote
    : minQuote), traderQuotes[0])

  return minQuoteForTrader
}

async function placeBullionOrderForLimitOrder(limitOrder, currentMinQuote) {
  const { userIds, itemId, quantity } = limitOrder
  const { quote, expiryTime, quoteUnitInGram, checksum, trader } = currentMinQuote
  const triggeredOrders = []
  for (let i = 0; i < userIds.length; i++) {
    logger.info('Placing Limit Order')
    const userId = userIds[i]
    const order = await placeBullionOrder({
      userId,
      itemId,
      quantity,
      traderId: trader._id,
      quote,
      expiryTime,
      quoteUnitInGram,
      checksum
    })

    const triggeredOrder = {
      userId: userId,
      orderRefId: order._id,
      orderId: order.orderId,
      orderCreationTime: order.created_at
    };
    triggeredOrders.push(triggeredOrder);
  }

  await triggersModel.updateOne({ _id: limitOrder._id },
    {
      $set: {
        status: Enums.Triggers.Status.TRIGGERED,
        triggeredOrders: triggeredOrders,
      }
    })

  sendLimitOrderPushNotifications(limitOrder, currentMinQuote)
}

async function sendAlertPushNotifications(itemName, alerts, standardizedQuote) {
  logger.info('Sending Alerts')
  for (let i = 0; i < alerts.length; i++) {
    const trigger = alerts[i]
    const userIds = trigger.userIds
    const notification = {
      title: 'Your alert for ' + itemName + ' is triggered',
      body: 'Current cheapest price: ₹' + standardizedQuote + ' | Trigger: ₹' + trigger.triggerRate
    }
    notificationService.sendNotifications(userIds, notification)
  }
}

async function sendLimitOrderPushNotifications(limitOrder, currentMinQuote) {
  const { quote, quoteUnitInGram, itemName } = currentMinQuote
  const { quantity, userIds, triggerRate } = limitOrder
  const bullionAmount = Math.round(quantity * (quote / quoteUnitInGram))

  const notification = {
    title: 'Your limit order for ' + itemName + ' is placed',
    body: 'Order placed at price: ₹' + quote +
      ' | Quantity: ' + quantity + 'gm' +
      '\n\n\nTrigger Price: ₹' + triggerRate +
      '\n\n\nTotal Price: ₹' + bullionAmount
  }

  logger.info('Sending push notification for limit-order', notification)
  notificationService.sendNotifications(userIds, notification)
}

async function deactivateTrigger(userId, triggerId) {
  const trigger = await triggersModel.findOne({ userIds: { $all: [userId] }, _id: ObjectID(triggerId) })

  if ((!trigger) || trigger?.status !== Enums.Triggers.Status.ACTIVE) {
    logger.info('Skipping Trigger status update')
    return
  }

  if ((trigger.userIds.length === 1) && (trigger.userIds.includes(userId)) && (trigger.status === Enums.Triggers.Status.ACTIVE)) {
    // Deactivate trigger when it's active and belongs to only this user
    logger.info(`Deactivating the trigger ${trigger?._id}`)
    await triggersModel.updateOne({
      _id: trigger._id
    }, { status: Enums.Triggers.Status.DEACTIVATED })

  } else {
    logger.info(`Removing user ${userId} from the trigger ${trigger?._id}`)
    await triggersModel.updateOne({
      _id: trigger._id
    }, { $pullAll: { userIds: [userId] } })
  }
}

module.exports = { monitorTriggers, createTrigger, getTriggersForUser, getTriggersForAdmin, deactivateTrigger }
