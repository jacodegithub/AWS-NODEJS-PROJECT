const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema({
    fullName: { type: String },
    phoneNumber: { type: Number },
    email: { type: String, unique: true },
    gstNumber: { type: String, required: true },
    gstCertificate: { type: String, required: true },
    billingAddress1: {type: String, required: true },
    billingAddress2: {type: String, required: true },
    city: { type: String, required: true },
    postalCode: {type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true },
    resetToken: { type: String },
    expireToken: Date,
    senderName: String,
    senderAdd: String,
    senderBuilding: String,
    receiverName: String,
    senderContact: Number,
    receiverAdd: String,
    receiverBuilding: String,
    receiverContact: Number,
    accountType: String

});

schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
        delete ret.passwordHash;
        delete ret.confirmPasswordHash;
    }
});

module.exports = mongoose.model('BussinessUser', schema);