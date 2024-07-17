const express = require('express');
const router = express.Router();
const Enums = require('../_helpers/Enums');
const logger = require('../_helpers/logger');
const authorizeTrader = require('../_middleware/authorizeTrader');
const notificationService = require('../services/webNotificationService');
const notificationDto = require('../dto/webNotificationDto');

router.post('/web/subscribe', authorizeTrader(), notificationDto.subscriptionRequest, subscribe);
router.post('/web/unsubscribe', authorizeTrader(), unsubscribe);

async function subscribe(request, response) {
  try {
    const traderId = request.user.id
    const subscription = request.body
    await notificationService.saveSubscription(traderId, Enums.UserTypes.Trader, subscription)
    return response.status(200).json({
      message: 'Subscribed successfully',
    })
  } catch (err) {
    logger.error('Failed to subscribe with error: ', err)
    return response.status(500).json({
      message: 'Failed to subscribe',
    })
  }
}

async function unsubscribe(request, response) {
  return response.status(200).json({
    message: 'Unsubscribed successfully',
  })
}

module.exports = router;
