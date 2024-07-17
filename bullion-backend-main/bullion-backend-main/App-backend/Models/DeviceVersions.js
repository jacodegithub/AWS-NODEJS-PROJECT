const mongoose = require('mongoose');
const { model, Schema } = mongoose;

const timestamps = { createdAt: 'createdAt', updatedAt: 'updatedAt' };
const options = { timestamps };

const schema = new Schema({
    device: {
        type: String,
        required: true,
        enum: ["ios", "android"],
        default: "android"
    },
    changesDescription: {
        type: String,
        required: true,
        // This will be mostly changed manually directly in DB but
        // putting the maxLength here for documenting purposes
        maxLength: 250,
        trim: true,
        default: "Bug fixes and improvement"
    },
    version: {
        minimum: {
            type: String,
            required: true
        },
        current: {
            type: String,
            required: true
        }
    }
}, options);

const modelName = "deviceversion";
const devVersionModel = model(modelName, schema);

async function findOne(filter = {}) {
    return await devVersionModel.findOne(filter);
};

module.exports = {
    findOne
};
