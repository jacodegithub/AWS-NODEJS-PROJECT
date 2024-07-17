const mongoose = require('mongoose');
const Enums = require('./../_helpers/Enums')
const Utility = require("./../Models/UtilityModels");

const Schema = mongoose.Schema;

const SchemaOptions = {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
};

const OrderSchema = new Schema({
  name: String,
  email: {
    type: String,
  },
  contact1: Number,

  senderName: String,
  senderAdd: String,
  senderFlat: String,
  senderBuilding: String,
  senderContact: Number,
  senderLocation: Utility.LatLngSchema,

  receiverName: String,
  receiverAdd: String,
  receiverFlat: String,
  receiverBuilding: String,
  receiverContact: Number,
  receiverLocation: Utility.LatLngSchema,

  approval: String,

  orderId: {
    type: String,
    required: true,
    unique: true
  },
  payment: {
    paymentType: {
      type: String,
      enum: [Enums.PaymentType]
    },
    processor: {
      type: String,
      enum: [Enums.PaymentProcessor]
    },
    orderId: {
      type: String,
      required: false
    },
    paymentId: {
      type: String,
      required: false
    },
    paymentNumber: {
      type: Number,
      required: false
    },
    failedPayments: [{
      id: String,
      method: String
    }],
    method: {
      type: String,
      enum: [Enums.PaymentMethod]
    },
    status: {
      type: String,
      enum: [
        Enums.Razorpay.status.captured,
        Enums.Razorpay.status.pending,
        Enums.Razorpay.status.failure,
        Enums.Razorpay.status.refunded
      ]
    },
    required: false
  },

  promoCode: Schema.Types.ObjectId,

  orderStatus: {
    type: String,
    enum: Object.values(Enums.Order.Status),
    default: Enums.Order.Status.created
  },
  distance: Number,
  amountByDistance: {
    type: Number,
    min: 0
  },
  priceData: {
    amount: { type: Number, required: true },
    perKMFare: { type: Number, required: true },
    fareType: { type: String, required: true },
    walletDiscount: { type: Number },
    walletPlan: { type: Schema.Types.ObjectId, ref: 'walletplans' }
  },
  insuranceCharges: Number,
  amount: Number,
  invoiceUrl: String,
  currency: {
    type: String,
    required: true,
    default: Enums.Currency.INR,
    enum: [Enums.Currency.INR]
  },
  userId: {
    type: Schema.Types.ObjectId,
    index: true,
    ref: "User"
  },
  productCategoryID: String,
  deliveryMethod: {
    type: String,
    required: true,
    enum: [Enums.DeliveryMethod.REGULAR, Enums.DeliveryMethod.SECURE],
    default: Enums.DeliveryMethod.SECURE
  },
  // Insurance, If selected - requires an invoice to be uploaded
  insurance: {
    selected: Boolean,
    alreadyInsured: Boolean,
    amount: {
      type: Number,
      min: 0
    },
    document_urls: {
      type: [String],
      default: undefined
    }
  },
  orderType: {
    type: String,
    enum: Enums.Order.Type
  },
  bullionOrderId: {
    type: Schema.Types.ObjectId,
    ref: 'bullionorders'
  },
  /** Used for the tracking of the order from point A to poin B */
  tracking: {
    currentTaskStatus: {
      type: String,
      default: Enums.Locus.TASK_STATUS.CREATED,
      enum: [
        Enums.Locus.TASK_STATUS.CREATED,
        Enums.Locus.TASK_STATUS.RECEIVED,
        Enums.Locus.TASK_STATUS.WAITING,
        Enums.Locus.TASK_STATUS.ACCEPTED,
        Enums.Locus.TASK_STATUS.STARTED,
        Enums.Locus.TASK_STATUS.COMPLETED,
        Enums.Locus.TASK_STATUS.CANCELLED,
        Enums.Locus.TASK_STATUS.ERROR
      ]
    },
    // track all statuses so far
    statusMarked: {
      type: [String],
      enum: [
        Enums.Locus.TASK_STATUS.CREATED,
        Enums.Locus.TASK_STATUS.RECEIVED,
        Enums.Locus.TASK_STATUS.WAITING,
        Enums.Locus.TASK_STATUS.ACCEPTED,
        Enums.Locus.TASK_STATUS.STARTED,
        Enums.Locus.TASK_STATUS.COMPLETED,
        Enums.Locus.TASK_STATUS.CANCELLED,
        Enums.Locus.TASK_STATUS.ERROR
      ]
    },
    fleetId: Number,
    boxId: Number,
    riderName: String,
    riderPhone: String
  },
  rating: Number,
  deliveryCosts: {
    tiers: [{
      label: {
        type: Schema.Types.String,
        required: true,
        enum: [
          Enums.DeliveryTiers.TIER_ONE,
          Enums.DeliveryTiers.TIER_TWO,
          Enums.DeliveryTiers.TIER_THREE
        ]
      },
      amount: {
        type: Schema.Types.Number,
        required: true
      },
      bonus: {
        type: Schema.Types.Number,
        required: true
      },
      _id: false
    }]
  }
}, SchemaOptions);

const OrderModel = mongoose.model("OrderForm", OrderSchema);
module.exports = OrderModel;
