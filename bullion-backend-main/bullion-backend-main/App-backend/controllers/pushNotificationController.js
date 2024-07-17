const express = require('express');
const router = express.Router();
const logger = require('../_helpers/logger');
// const pushNotificationService = require('../services/PushNotificationService');
// const userSegmentsService = require('../services/UserSegmentService');

router.post('/push', sendNotifications);
router.post('/push/marketing', sendMarketingNotification);

async function sendNotifications(req, res, next) {
  try {
    const { userIds, content } = req.body
    if (!userIds || !content) {
      res.status(400).json({
        message: 'Bad body request'
      })
    }
    // await pushNotificationService.sendNotifications(userIds, content)
    res.status(200).json({
      message: 'Notifications sent successfully',
    })
    next()
  } catch (error) {
    logger.error('pushNotification:controller:sendNotifications', error)
    next(error)
  }
}

async function sendMarketingNotification(req, res, next) {
  try {
    const { params, content } = req;
    if (!params.queryId) {
      res.status(400).json({
        message: 'Bad queryId parameter'
      })
      return
    }
    // const userIds = await userSegmentsService.getSegmentedUsers(params.queryId)
    // await pushNotificationService.sendNotifications(userIds, content)
    res.status(200).json({
      message: `Notifications sent successfully for marketing query: ${queryId}`,
    })
  } catch (error) {
    res.status(400).json({
      message: 'Something went wrong'
    })
    logger.error(error)
    next(error)
  }
}

module.exports = router;
