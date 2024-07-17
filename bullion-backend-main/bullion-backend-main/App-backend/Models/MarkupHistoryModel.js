const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const SchemaOptions = {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
};

const markupHistorySchema = new Schema({
    markupHistory: [{
        value: {
            type: Number,
            required: true
        },
        created_at: Date
    }],
    traderId: {
        type: Schema.Types.ObjectId,
        ref: 'traders'
    },
    itemId: {
        type: Schema.Types.ObjectId,
        ref: 'items'
    }
}, SchemaOptions);

const lastSourceRateModel = mongoose.model("markuphistory", markupHistorySchema);
module.exports = lastSourceRateModel;
