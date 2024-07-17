const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const SchemaOptions = {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
};

const LeadSchema = new Schema({
  companyName: {
    type: Schema.Types.String,
  },
  name: {
    type: Schema.Types.String,
  },
  phoneNumber: {
    type: Schema.Types.String,
  },
  referralCount: {
    type: Number,
    default: 0
  }
}, SchemaOptions)

LeadSchema.index({ phoneNumber: 1 }, { unique: true })
const leadModel = mongoose.model('leads', LeadSchema)

module.exports = leadModel
