const mongoose = require('mongoose')

const SchemaOptions = {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
}

const insuranceAmountUsageSchema = mongoose.Schema({
    insuranceAmount: {
        type: Number,
        required: true
    },
    usedAmount: {
        type: Number,
        required: true
    },
    alertThreshold: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        required: true,
        default: 'INACTIVE'
    }
}, SchemaOptions)

const insuranceAmountUsageModel = mongoose.model('insuranceAmountUsages', insuranceAmountUsageSchema)

module.exports = insuranceAmountUsageModel
