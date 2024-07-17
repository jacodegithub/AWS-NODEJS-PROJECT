const mongoose = require('mongoose');
const Enums = require('../_helpers/Enums');

const Schema = mongoose.Schema;

const SchemaOptions = {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
};

const MarginTransactionSchema = new Schema({
    orderId: String,
    userId: {
        type: Schema.Types.ObjectId,
        ref: "Users"
    },
    traderId: {
        type: Schema.Types.ObjectId,
        ref: "Traders"
    },
    amount: Number,
    statusHistory: [{
        status: {
            type: String,
            enum: Enums.MarginActions
        },
        createdAt: Date
    }]
}, SchemaOptions);

const MarginTransactionModel = mongoose.model("MarginTransaction", MarginTransactionSchema);
module.exports = MarginTransactionModel;
