const mongoose = require('mongoose');
const { Schema } = mongoose;

const schema = new Schema({
    serviceName: {
        type: String,
        unique: true
    },
    enabled: {
        type: Boolean,
        default: false,
    },
    config: {
        type: Object
    }
});

const ServiceConfigModel = mongoose.model('ServiceConfig', schema);

module.exports = ServiceConfigModel;
