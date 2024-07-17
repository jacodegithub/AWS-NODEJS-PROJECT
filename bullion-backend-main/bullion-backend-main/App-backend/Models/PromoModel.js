const mongoose = require('mongoose');
const Enum = require('./../_helpers/Enums');
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
    // category: {
    //     type: String,
    //     required: true,
    //     enum: [ 
    //         Enum.Coupon.Type.percent, 
    //         Enum.Coupon.Type.fixed
    //     ],
    //     default: Enum.Coupon.Type.fixed,
    // },
    discount: {
        value: {
            type: Number,
            required: true
        },
        category: {
            type: String,
            required: true,
            enum: [ 
                Enum.Coupon.Type.percent, 
                Enum.Coupon.Type.fixed
            ],
            default: Enum.Coupon.Type.fixed,
        },
        // The minimum price for an order during checkout
        minAmount: {
            type: Number,
            min: 1,
            default: 1
        },
        // Maximum discount applicable
        // Could not be required for flat
        maxDiscount: {
            type: Number
        },
        // Minimum order amount for coupon to be availed
        minOrderAmount: {
            type: Number
        },
    },
    // For tracking
    quota: {
        // Total number of coupon uses
        total: {
            type: Number,
            default: 0
        },
        // Upper limit on coupon use
        limit: {
            type: Number,
            default: -1
        },
        // limit per user
        perUser:{
            type:Number,
            default:-1
        },
        //Only for Users created after certain date
        userCreatedAfter:{
            type: Date
        }
    },
    expires: {
        type: Date
    },
    user: {
        id: {
            type: Schema.Types.ObjectId
        },
        role: {
            type: String,
            enum: [ 
                Enum.Roles.Bussiness, 
                Enum.Roles.Customer
            ]
        }
    },
    isValid: {
        type: Boolean,
        default: true
    }
});

const PromoSchema = new Schema(schema, mongooseOptions);
const PromoModel = mongoose.model('PromoCodes', PromoSchema);

module.exports = PromoModel;