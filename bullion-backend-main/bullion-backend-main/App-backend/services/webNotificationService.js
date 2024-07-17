const webpush = require('web-push');
const logger = require('../_helpers/logger');
const Enums = require('../_helpers/Enums');
const NotificationSubscriptionModel = require('../Models/NotificationSubscriptionModel');

async function sendPushNotification(userId, userType = Enums.UserTypes.Trader, notificationTitle, notificationBody) {
  const notification = JSON.stringify({
    title: notificationTitle,
    options: {
      body: notificationBody,
    }
  });
  const userSubscription = await fetchSubscriptions(userId, userType)
  userSubscription.map(async (subscription) => {
    try {
      await triggerWebPush(subscription, notification)
    } catch (err) {
      logger.error('error', err)
      logger.error('Failed to send push notification for subscription: ', subscription)
    }
  })
}

async function triggerWebPush(subscription, notification) {
  const vapidDetails = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  };

  const options = {
    TTL: process.env.PUSH_NOTIFICATION_TTL || 10000,
    vapidDetails: vapidDetails
  };

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
  return await webpush.sendNotification(subscription, notification, options)
}

async function fetchSubscriptions(userId, userType = Enums.UserTypes.Trader) {
  const query = { userId: userId, userType: userType }
  const userSubscription = await NotificationSubscriptionModel.findOne(query)
  return userSubscription.subscriptions
}

async function saveSubscription(userId, userType = Enums.UserTypes.Trader, newSubscription) {
  const userSub = await NotificationSubscriptionModel.upsert(userId, userType, newSubscription)
  return userSub
}

async function deleteSubscription(traderId, subscription) {
  // TODO: Implement unsubscription
}

module.exports = { saveSubscription, deleteSubscription, sendPushNotification }
