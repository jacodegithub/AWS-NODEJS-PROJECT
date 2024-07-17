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

const WalletTransactionSchema = new Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },

    payment: {
      paymentType: {
        type: String,
        enum: [Enums.PaymentType],
      },
      processor: {
        type: String,
        enum: [Enums.PaymentProcessor],
      },
      orderId: {
        type: String,
        required: false,
      },
      paymentId: {
        type: String,
        required: false,
      },
      paymentNumber: {
        type: Number,
        required: false,
      },
      failedPayments: [
        {
          id: String,
          method: String,
        },
      ],
      method: {
        type: String,
        enum: [Enums.PaymentMethod],
      },
      status: {
        type: String,
        enum: [
          Enums.Razorpay.status.captured,
          Enums.Razorpay.status.pending,
          Enums.Razorpay.status.failure,
          Enums.Razorpay.status.refunded,
        ],
      },
      required: false,
    },

    promoCode: Schema.Types.ObjectId,
    metadata: {
      orderId: String,
      deductionDetails: [{
        walletId: {
          type: mongoose.Types.ObjectId,
          ref: 'wallets'
        },
        amount: Number,
      }],
      walletDiscount: Number,
      transactionType: String
    },
    amount: Number,
    amountWithGST: Number,
    gst: Number,
    userId: {
      type: Schema.Types.ObjectId,
      index: true,
      ref: "Users",
    },
    companyId: {
      type: Schema.Types.ObjectId,
      index: true,
      ref: "Companies",
    },
    comment: String,
  },
  SchemaOptions
);

const WalletTransactionModel = mongoose.model(
  "walletTransactions",
  WalletTransactionSchema
);
module.exports = WalletTransactionModel;
