const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Utility = require('./../Models/UtilityModels');
const Enums = require('./../_helpers/Enums');

const schema = new Schema({
    // @TODO: Split full name fields
    fullName: { 
        type: String 
    },
    email: { 
        type: String, 
        unique: true 
    },
    phonenumber: {
        type: String, 
        unique: true 
    },
    passwordHash: {
        type: String
    },
    role: { 
        type: String,
        required: true,
        enum: [ Enums.Roles.Customer, Enums.Roles.Bussiness ],
        default: Enums.Roles.Customer  
    },
    // Assumption: This field is used to assosciate user with phone number OTP
    otpHash: {
        type: String 
    },
    resetToken: { 
        type: String 
    },
    expireToken: Date,

    /** May need to remove/ refactor below fields */
    senderName: String,
    senderAdd: String,
    senderBuilding: String,
    receiverName: String,
    senderContact: Number,
    receiverAdd: String,
    receiverBuilding: String,
    receiverContact: Number,
    accountType: String,
    /**  */

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
        _id: false
    }],
    GST: {
        number: {
            type: String
            // required only iff user.role is bussiness
        },
        certificate: {
            type: String
        }
    }
});

schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
        delete ret.passwordHash;
    }
});

const UserModel = mongoose.model("User", schema);
module.exports = UserModel;