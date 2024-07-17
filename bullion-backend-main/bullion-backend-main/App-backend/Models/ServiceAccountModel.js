const mongoose = require('mongoose');
const { Schema } = mongoose;

const schema = new Schema({
    serviceName: {
        type: String,
        unique: true
    },
    apiKey: {
        type: String
    },
    enabled: {
        type: Boolean,
        default: false
    }
});

const serviceAccountModel = mongoose.model('serviceaccount', schema);

module.exports = serviceAccountModel;
