const mongoose = require('mongoose');
const { Schema } = mongoose;

const schema = new Schema({
    noticeName: {
        type: String,
        unique: true
    },
    title: {
        type: String
    },
    body: {
        type: String
    }
});

const noticesModel = mongoose.model('notices', schema);

module.exports = noticesModel;
