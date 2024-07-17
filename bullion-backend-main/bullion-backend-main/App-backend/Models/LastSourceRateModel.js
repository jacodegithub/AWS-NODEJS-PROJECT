const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const SchemaOptions = {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
};

const lastSourceRateSchema = new Schema({
    source: {
        type: String,
        unique: true
    },
    forceEnable: {
        type: Boolean,
        default: false
    },
    rate: Number,
}, SchemaOptions);

const lastSourceRateModel = mongoose.model("lastsourcerate", lastSourceRateSchema);
module.exports = lastSourceRateModel;
