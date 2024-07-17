const mongoose = require('mongoose');
const Enums = require('./../_helpers/Enums');

const Schema = mongoose.Schema;
const PriceSchema = new Schema({
    title: String,
    surgeEnabled: {
        type: Boolean,
        default: false
    },
    autoApplyAfterMinutes: {
        type: Number
    },
    baseDistance: {
        type: Number,
        required: true
        // in kilometer
    },
    perKMFare: {
        type: Number,
        min: 0
    },
    walletPlan: {
        type: mongoose.Types.ObjectId,
        ref: 'walletplans'
    }

})

const PriceModel = mongoose.model('priceplan', PriceSchema);
module.exports = PriceModel;
