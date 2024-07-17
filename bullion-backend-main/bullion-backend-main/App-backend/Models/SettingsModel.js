const mongoose = require('mongoose');
const { Schema } = mongoose;

const schema = new Schema({
    key: {
        type: String,
    },
    value: {
        type: String,
    }    
});

const SettingsModel = mongoose.model('Settings', schema);

module.exports = SettingsModel;