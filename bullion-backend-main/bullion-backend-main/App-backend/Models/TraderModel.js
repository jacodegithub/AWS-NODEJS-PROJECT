const mongoose = require("mongoose")
const Enums = require('./../_helpers/Enums');
const Utility = require('./../Models/UtilityModels');
const { Schema } = mongoose;

const Trader = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    phonenumber: {
        type: String,
        unique: true
    },
    isEnabled: {
        type: Boolean,
        default: false
    },
    email: {
        type: String,
        required: true
    },
    passwordHash: {
        type: String,
        required: false
    },
    items: [{
        itemId: {
            type: Schema.Types.ObjectId,
            ref: "items"
        },
        gordianMarkup: {
            type: Number,
            default: 0
        },
        maxQuantity: {
            type: Number,
            default: 500
        },
        minQuantity: {
            type: Number,
            default: 100
        },
        markup: {
            type: Number
        },
        exchangeTradingSymbol: {
            type: String,
            required: true,
        },
        quoteUnitInGram: {
            type: Number,
            default: 10,
            required: true
        },
        step: {
            type: Number,
            default: 100
        }
    }],
    logo_url: {
        type: String,
        required: true
    },
    autoAcceptOrders: {
        type: Boolean,
        default: false
    },
    supportEmails: [{ type: String, default: [] }],
    margin: {
        type: {
            type: String,
            required: true,
            enum: [Enums.Trader.MarginType.absolute, Enums.Trader.MarginType.percentage],
            default: Enums.Trader.MarginType.percentage
        },
        value: {
            type: Number,
            required: true,
            default: 10
        },
        required: {
            type: Boolean,
            default: false
        },
        exemption: {
            allowed: Boolean,
            limit: Number,
            current: Number
        }
    },
    apiDetails: {
        key: String,
        url: String,
        loginCredentials: {
            endpoint: String,
            username: { key: { type: String, default: "username" }, value: String },
            password: { key: { type: String, default: "password" }, value: String }
        },
        lastAuthenticationTime: Date,
        JWTValidityMs: Number,
        rate: {
            endpoint: String,
            checksumKey: String,
            quoteKey: String,
            timeStampKey: String,
            timeStampType: {
                type: String,
                enum: [
                    Enums.Trader.RateSource.timeStampTypes.ISO,
                    Enums.Trader.RateSource.timeStampTypes.dateTime,
                    Enums.Trader.RateSource.timeStampTypes.epoch,
                    Enums.Trader.RateSource.timeStampTypes.other
                ]
            },
            quoteExpirySeconds: Number,
        },
        order: {
            endpoint: String,
            fieldAssocs: Object
        }
    },
    savedAddresses: [{
        address: {
            type: String,
            required: true
        },
        location: Utility.MandatoryLatLngSchema,
        label: {
            type: String,
            required: true
        },
        number: {
            type: String
        },
        buildingName: {
            type: String,
            required: false
        }
    }],
    isAPIEnabled: {
        type: Boolean,
        required: true,
        default: false
    },
})

const TraderModel = mongoose.model('Trader', Trader);
module.exports = TraderModel;
