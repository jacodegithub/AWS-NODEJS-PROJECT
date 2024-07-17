const mongoose = require('mongoose')
const Enums = require('../_helpers/Enums')

const Schema = mongoose.Schema

const SchemaOptions = {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
}

const userToOrderMap = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  orderRefId: {
    type: Schema.Types.ObjectId,
    ref: 'bullionorders'
  },
  orderId: {
    type: Schema.Types.String,
  },
  orderCreationTime: {
    type: Schema.Types.Date,
  }
})

const triggersSchema = new Schema({
  type: {
    type: Schema.Types.String,
    default: Enums.Triggers.Types.ALERT,
    require: true,
    enum: Enums.Triggers.Types
  },
  traderIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Trader'
  }],
  itemId: {
    type: Schema.Types.ObjectId,
    ref: 'Items',
    required: true
  },
  userIds: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  triggerRate: {
    type: Number,
    min: 0,
    required: true
  },
  triggerCondition: {
    type: Schema.Types.String,
    enum: Enums.Triggers.triggerConditions,
    required: true
  },
  rateUnitInGram: {
    type: Number,
    default: 10,
    required: true
  },
  quantity: {
    type: Number,
    min: 0,
    required: true
  },
  expiryTime: {
    type: Date
  },
  status: {
    type: Schema.Types.String,
    enum: Enums.Triggers.Status,
    default: Enums.Triggers.Status.ACTIVE,
    required: true
  },
  triggeredOrders: [{
    type: userToOrderMap,
  }]
}, SchemaOptions)

const triggersModel = mongoose.model('triggers', triggersSchema)

module.exports = triggersModel
