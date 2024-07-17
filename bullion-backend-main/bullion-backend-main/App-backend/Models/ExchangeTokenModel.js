const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const options = {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
};

const ExchangeToken = new Schema({
    encryptedToken: {
        type: String,
        required: true,
    },
}, options)

const ExchangeTokenModel = mongoose.model('ExchangeToken', ExchangeToken)
module.exports = ExchangeTokenModel;
