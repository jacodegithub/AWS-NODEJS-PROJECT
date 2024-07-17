const mongoose = require('mongoose');
const Enums = require('./../_helpers/Enums')
const Utility = require("./../Models/UtilityModels");

const Schema = mongoose.Schema;

const SchemaOptions = {
  toJSON: { virtuals: true },
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
};

const bullionOrdersSchema = new Schema({
  itemId: {
    type: Schema.Types.ObjectId,
    ref: "Items"
  },
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  traderId: {
    type: Schema.Types.ObjectId,
    ref: "Trader",
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    require: true
  },
  bullionAmount: {
    type: Number,
    min: 0
  },
  amountPayableToTrader: Number,
  quantity: {
    type: Number,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  tcs: {
    type: Number,
    require: true
  },
  marginAmount: {
    type: Number,
  },
  quote: {
    type: Number,
    required: true
  },
  gordianMarkup: Number,
  totalGordianMarkup: Number,
  expiryTime: {
    type: Date,
    required: true
  },
  quoteUnitInGram: {
    type: Number,
    required: true
  },
  checksum: {
    type: String,
    required: true
  },
  traderMarkup: {
    type: Number,
  },
  currentStatus: String,
  statusHistory: [{
    status: {
      type: String,
      enum: Object.values(Enums.bullionOrderStatus)
    },
    createdAt: Date
  }],
  receiverName: String,
  receiverAdd: String,
  receiverFlat: String,
  receiverBuilding: String,
  receiverContact: Number,
  receiverLocation: Utility.LatLngSchema,

  senderName: String,
  senderAdd: String,
  senderFlat: String,
  senderBuilding: String,
  senderContact: Number,
  senderLocation: Utility.LatLngSchema,

  payment: {
    paymentRef: String
  },
  metadata: {
    type: Object,
  },
}, SchemaOptions)

bullionOrdersSchema.virtual('orderType').get(() => 'product');

const bullionOrderModel = mongoose.model("bullionorders", bullionOrdersSchema)

module.exports = bullionOrderModel
