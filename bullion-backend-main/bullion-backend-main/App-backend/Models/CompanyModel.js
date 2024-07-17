const mongoose = require("mongoose");
const Enums = require("../_helpers/Enums");

const Schema = mongoose.Schema;

const SchemaOptions = {
  timestamps: {
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
};

const CompanySchema = new Schema(
  {
    companyName: String,
    gstNumber: String,
    businessCategory: {
      type: String,
      enum: Enums.Company.BusinessCategories
    },
    gstCertificate: String,
    paymentTypes: {
      onDemand: {
        allowed: Boolean,
      },
      wallet: {
        allowed: Boolean,
        currentAmount: Number,
        marginAmount: Number,
        walletPlan: {
          type: Schema.Types.ObjectId, 
          ref: "walletplans"
        },
      },
      credit: {
        allowed: Boolean,
        creditLimit: Number,
        currentPeriod:{
          periodCredit: Number,
          start: Date,
          end: Date
        },
        cycle: {
          frequency: {
            type: String,
            required: false,
            enum: [ Enums.Credit.Cycle.Frequency ],
          },
          startDate: Date,
          autoReset: {
            type: Boolean,
            default: false,
          },
        },
      },
      margin: {
        allowed: {
          type: Boolean,
          default: false
        },
        available: Number,
        blocked: Number,
        forfeited: Number
      }
    },
  },
  SchemaOptions
);

const CompanyModel = mongoose.model("companies", CompanySchema);

module.exports = CompanyModel;
