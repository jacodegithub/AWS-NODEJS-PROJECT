const triggerNotificationToUser = require('../users/fireBaseService').triggerNotificationToUser;
/**
 * @param {*} userIds: array of userIds to whom the notification will be sent
 * @param {*} content: an object of following keys: title, body, image
 */
async function sendNotifications(userIds, content) {
    // What about error handling? triggerNotificationToUser doesn't return us anything
    const { title, body, image } = content
    for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];
        await triggerNotificationToUser(userId, title, body, image)
    }
}

module.exports = {
    sendNotifications
}
