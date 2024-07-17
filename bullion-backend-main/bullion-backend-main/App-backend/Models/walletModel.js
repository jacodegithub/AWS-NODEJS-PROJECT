const mongoose = require("mongoose");
const Enums = require("./../_helpers/Enums");
const Utility = require("./../Models/UtilityModels");

const Schema = mongoose.Schema;

const SchemaOptions = {
    timestamps: {
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
};

const walletSchema = new Schema({
    status: {
        type: String,
        enum: [Enums.Wallet.Status]
    },
    walletPlan: {
        type: Schema.Types.ObjectId,
        ref: "walletplans"
    },
    expiry: {
        type: Date,
        required: true
    },
    currentAmount: Number,
    rechargedBy: {
        type: Schema.Types.ObjectId,
        ref: "Users",
    },
    companyId: {
        type: Schema.Types.ObjectId,
        ref: "Companies",
    },
},
    SchemaOptions
);

const walletSchemaModel = mongoose.model("wallet", walletSchema);
module.exports = walletSchemaModel;
