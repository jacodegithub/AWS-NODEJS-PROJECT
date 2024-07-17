const mongoose = require('mongoose');
const Enums = require('../_helpers/Enums');
const logger = require('../_helpers/logger');

const Schema = mongoose.Schema;

const SchemaOptions = {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
};

const NotificationSubscriptionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: 'userType',
  },
  userType: {
    type: String,
    required: true,
    enum: [Enums.UserTypes.User, Enums.UserTypes.Trader],
  },
  subscriptions: [{
    endpoint: String,
    expirationTime: Date,
    keys: Object,
  }],
}, SchemaOptions);

async function findOne(query) {
  try {
    const model = await NotificationSubscriptionModel.findOne(query);
    return await NotificationSubscriptionModel.populate(model, { path: 'subscriptions' })
  } catch (error) {
    logger.error("NotificationSubscriptionModel::findOne::uncaught error", error);
    throw error;
  };
};

async function upsert(userId, userType, newSubscription) {
  try {
    const query = { userId: userId, userType: userType }
    let existingSub = await NotificationSubscriptionModel.findOne(query)
    if (existingSub) {
      const index = existingSub.subscriptions.findIndex((s) => s.endpoint === newSubscription.endpoint)

      if (index !== -1) {
        // Update in place
        existingSub.subscriptions[index] = newSubscription
      } else {
        // Add newSubscription to the array
        existingSub.subscriptions.push(newSubscription)
      }
      await NotificationSubscriptionModel.updateOne(query, existingSub)
    } else {
      await NotificationSubscriptionModel.create({
        userId: userId,
        userType: Enums.UserTypes.Trader,
        subsriptions: [newSubscription]
      })
    }
  } catch (error) {
    logger.error("NotificationSubscriptionModel::findOne::uncaught error", error);
    throw error;
  }
}

const NotificationSubscriptionModel = mongoose.model("NotificationSubscription", NotificationSubscriptionSchema);
module.exports = { findOne, upsert };
