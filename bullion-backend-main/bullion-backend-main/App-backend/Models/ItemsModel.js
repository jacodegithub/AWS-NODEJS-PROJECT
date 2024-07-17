const mongoose = require('mongoose');
const TraderModel = require('./TraderModel');

const Schema = mongoose.Schema;
const Items = new Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  traders: {
    type: [mongoose.Types.ObjectId],
    ref: TraderModel
  },
  exchangeTradingSymbol: {
    type: String,
    required: true,
  },
  commodityName: {
    type: String,
    required: true,
    default: "GOLD"
  },
  baseTradingWeightInGram: {
    type: Number,
    required: true,
    default: 10,
  },
  baseTradingWeightUnitSymbol: {
    type: String,
    required: true,
    default: "g",
  }
})

// TODO: The model should be singular
const ItemsModel = mongoose.model('Items', Items);
module.exports = ItemsModel;
