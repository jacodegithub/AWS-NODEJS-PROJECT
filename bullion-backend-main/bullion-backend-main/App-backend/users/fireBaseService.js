// const fbAdmin = require('firebase-admin');
const firebaseDeviceModel = require('./../Models/FirebaseDevices');
const logger = require('../_helpers/logger');

// Instead of using a service account, load the service account keys as environment variables
// fbAdmin.initializeApp({
//     credential: fbAdmin.credential.cert({
//         "type": process.env.FIREBASE_CONFIG_TYPE,
//         "project_id": process.env.FIREBASE_CONFIG_PROJECT_ID,
//         "private_key_id": process.env.FIREBASE_CONFIG_PRIVATE_KEY_ID,
//         "private_key": process.env.FIREBASE_CONFIG_PRIVATE_KEY,
//         "client_email": process.env.FIREBASE_CONFIG_CLIENT_EMAIL,
//         "client_id": process.env.FIREBASE_CONFIG_CLIENT_ID,
//         "auth_uri": process.env.FIREBASE_CONFIG_AUTH_URI,
//         "token_uri": process.env.FIREBASE_CONFIG_TOKEN_URI,
//         "auth_provider_x509_cert_url": process.env.FIREBASE_CONFIG_AUTH_PROVIDER_CERT_URL,
//         "client_x509_cert_url": process.env.FIREBASE_CONFIG_CLIENT_CERT_URL
//     })
// });

module.exports = {
    sendNotification,
    getUserAndDevice,
    triggerNotificationToUser
};

/**
 * Firebase payload
 * {
 *     message: {
 *          notification: {
 *              title,
 *              body,
 *              image
 *          },
 *          data: {
 *              // List of <key:value> pairs
 *          },
 *          fcmOptions: { // },
 *          // ONLY one of the below,
 *          token,
 *          topic,
 *          condition
 *     }
 * } 
 */

/** Send a push notification message using firebase */
async function sendCloudMessage(message) {
    try {
        // await fbAdmin.messaging().send(message)
        const response = null;
        logger.debug("FirebaseService::sendCloudMessage:: Message sent", response)
        // console.debug("FirebaseService::sendCloudMessage:: Message sent", response);
    } catch (error) {
    }
};

/**
 * Send a notification to the registration device 
 * @param {*} token FCM Registration token | Device ID
 * @param {*} title Notification Title
 * @param {*} body  Notification body text
 * @param {*} image Image URL to be provided within the notification
 */
async function sendNotification(token, title, body, image = undefined) {
    const message = {
        token,
        notification: { title, body, image }
    };

    await sendCloudMessage(message);
};

async function triggerNotificationToUser(userId, title, body, image = undefined) {
    const query = { userId };
    const persistedDevices = await firebaseDeviceModel.findOne(query);
    const deviceIDs = Array.isArray(persistedDevices?.devices) ? persistedDevices.devices : [];

    for (let i = 0; i < deviceIDs.length; i++) {
        const deviceId = deviceIDs[i];
        await sendNotification(deviceId, title, body, image)
    }

};

async function getUserAndDevice(user, deviceId) {
    try {
        const { id } = user;
        // const { deviceId } = request;

        if (!(typeof deviceId === 'string' && deviceId.length > 0)) {
            console.error("FirebaseService::getUserAndDevice::Invalid device ID = ", deviceId);
            throw {
                status: 422,
                message: "Invalid deviceID",
                errors: []
            };
        };

        return await firebaseDeviceModel.getUserAndDeviceID(id, deviceId);
    } catch (e) {
        throw e;
    };
};
