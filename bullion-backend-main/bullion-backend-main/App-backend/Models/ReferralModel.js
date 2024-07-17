const mongoose = require('mongoose')
const Enums = require('./../_helpers/Enums')

const Schema = mongoose.Schema

const SchemaOptions = {
  timestamps: {
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
}

const referralSchema = new Schema({
  referrerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referralCode: {
    type: String,
    required: true
  },
  name: {
    type: Schema.Types.String
  },
  bonusAmount: {
    type: Number
  },
  referrerBonus: {
    type: Number
  },
  phoneNumber: {
    type: Schema.Types.String,
    required: true
  },
  email: {
    type: Schema.Types.String
  },
  status: {
    type: Schema.Types.String,
    enum: Object.values(Enums.ReferralStatus)
  }
}, SchemaOptions)

referralSchema.index({ phoneNumber: 1, referrerId: 1 }, { unique: true })
const referralModel = mongoose.model('referrals', referralSchema)

module.exports = referralModel
