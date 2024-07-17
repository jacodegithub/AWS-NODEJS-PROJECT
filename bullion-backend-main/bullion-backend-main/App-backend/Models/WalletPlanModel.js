const mongoose = require('mongoose');
const Enums = require('../_helpers/Enums');

const { Schema } = mongoose;

const mongooseOptions = {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
};

const schema = new Schema({
    id: {
        type: String,
        required: true,
        unique: true // Unique property may be required considering that you can share coupons but not IDs
    },
    title: {
        type: String,
    },
    description: {
        type: String,
    },
    expiryDays: Number,
    discount: {
        value: {
            type: Number,
            required: true
        },
        category: {
            type: String,
            required: true,
            enum: [ 
                Enums.Coupon.Type.percent, 
                Enums.Coupon.Type.fixed
            ],
            default: Enums.Coupon.Type.fixed,
        },
        // Maximum discount applicable
        maxDiscount: {
            type: Number
        },
    },
    isValid: {
        type: Boolean,
        default: true
    }

})

const PlanSchema = new Schema(schema, mongooseOptions);
const WalletPlanModel = mongoose.model('walletplans', PlanSchema);
module.exports = WalletPlanModel;
