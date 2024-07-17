const mongoose = require('mongoose');
const Enums = require('./../_helpers/Enums');

const Schema = mongoose.Schema;
const SignupOTP = new Schema({
    phonenumber: {
      type: Number,
      required: true
    },
    otpHash: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: new Date(),
      expires: "20m"
    },
    event: {
      type: String,
      enum: [Enums.OTP.Events.registration, Enums.OTP.Events.authentication]
    }
})

const SignupOTPModel = mongoose.model('SignupOTP', SignupOTP);
module.exports = SignupOTPModel;