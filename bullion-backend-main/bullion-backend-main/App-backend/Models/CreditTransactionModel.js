const mongoose = require("mongoose");
const Enums = require("../_helpers/Enums");

const Schema = mongoose.Schema;

const SchemaOptions = {
  timestamps: {
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
};

const CreditTransactionSchema = new Schema(
  {
    companyId: Schema.Types.ObjectId,
    payment: {
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
        enum: [Enums.Razorpay.status],
      },
      required: false,
    },
    frequency: {
      type: String,
      enum: [Enums.Credit.Cycle.Frequency],
    },
    start: Date,
    end: Date,
    credit: Number,
  },
  SchemaOptions
);

const CreditTransactionModel = mongoose.model(
  "creditTransaction",
  CreditTransactionSchema
);

module.exports = CreditTransactionModel;
