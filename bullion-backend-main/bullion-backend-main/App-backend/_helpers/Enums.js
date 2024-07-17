module.exports = {
  DeliveryMethod: {
    REGULAR: "regular",
    SECURE: "secure"
  },
  DeliveryTiers: {
    TIER_ONE: 'tierOne',
    TIER_TWO: 'tierTwo',
    TIER_THREE: 'tierThree'
  },
  Locus: {
    EventType: {
      TASK_STATUS_UPDATE: "TASK_STATUS_UPDATE",
      TASK_ETA_UPDATE: "TASK_ETA_UPDATE",
      TASK_PAYMENT_UPDATE: "TASK_PAYMENT_UPDATE",
      TASK_LINE_ITEM_TRANSACTION_UPDATE: "TASK_LINE_ITEM_TRANSACTION_UPDATE"
    },
    TASK_STATUS: {
      CREATED: "CREATED",
      RECEIVED: "RECEIVED",
      WAITING: "WAITING",
      ACCEPTED: "ACCEPTED",
      STARTED: "STARTED",
      COMPLETED: "COMPLETED",
      CANCELLED: "CANCELLED",
      ERROR: "ERROR"
    }
  },
  Tookan: {
    Template: {
      REQUEST_RECEIVED: "REQUEST_RECEIVED",
      REQUEST_ACCEPTED: "REQUEST_ACCEPTED",
      AGENT_STARTED: "AGENT_STARTED",
      AGENT_ARRIVED: "AGENT_ARRIVED",
      SUCCESSFUL: "SUCCESSFUL",
      FAILED: "FAILED"
    }
  },
  Currency: {
    INR: "INR",
    INR_SYMBOL: "₹"
  },
  Roles: {
    Bussiness: 'Bussiness',
    Customer: 'Customer',
    Admin: 'Admin',
    Trader: 'Trader'
  },
  Razorpay: {
    Webhooks: {
      payment_authorized: 'payment.authorized',
      payment_captured: 'payment.captured',
      payment_failed: 'payment.failed',
      payment_postPay: 'payment.postPay'
    },
    status: {
      captured: 'captured',
      failure: 'failure',
      pending: 'pending',
      refunded: 'refunded'
    }
  },
  Environment: {
    Development: "development",
    Staging: "staging",
    Production: "production"
  },
  PaymentProcessor: {
    Razorpay: 'razorpay',
    Gordian: "gordian"
  },
  Coupon: {
    Type: {
      percent: "percent",
      fixed: "fixed"
    }
  },
  MarginActions: {
    blocked: 'blocked',
    released: 'released',
    forefieted: 'forefieted'
  },
  Order: {
    Status: {
      created: 'created',
      pending: 'pending',
      ongoing: 'ongoing',
      completed: 'completed',
      failure: 'failure',
      cancelled: 'cancelled',
      booked: "booked"
    },
    Type: {
      delivery: "delivery",
      product: "product"
    }
  },
  OTP: {
    Events: {
      registration: "registration",
      authentication: "authentication"
    }
  },
  Products: {
    Categories: {
      misc: "misc",
      bullion: "bullion"
    }
  },
  Triggers: {
    Types: {
      ALERT: "alert",
      LIMIT_ORDER: "limitorder",
    },
    triggerConditions: {
      currentPriceLessThanLimit: "currentPriceLessThanLimit",
      currentPriceMoreThanLimit: "currentPriceMoreThanLimit"
    },
    Status: {
      ACTIVE: "active",
      TRIGGERED: "triggered",
      DEACTIVATED: "deactivated",
    }
  },
  Device: {
    ios: 'ios',
    android: 'android'
  },
  PaymentMethod: {
    card: "card",
    debit_card: "debit_card",
    credit_card: "credit_card",
    upi: "upi",
    netbank: "netbank",
    gordian_wallet: "gordian_wallet",
    gordian_credit: "gordian_credit",
    gordian_promocode: "gordian_promocode"
  },
  PaymentType: {
    onDemand: "onDemand",
    wallet: "wallet",
    credit: "credit",
    postPay: "postPay",
    booking: "booking"
  },
  Credit: {
    Cycle: {
      Frequency: {
        //week:"week",
        month: "month",
        quarter: "quarter",
        year: "year"
      }
    }
  },
  Trader: {
    MarginType: {
      absolute: "absolute",
      percentage: "percentage"
    },
    MarkupType: {
      absolute: "absolute",
      percentage: "percentage"
    },
    RateSource: {
      api: "api",
      mcx: "mcx",
      timeStampTypes: {
        ISO: "ISO",
        epoch: "epoch",
        dateTime: "dateTime",
        other: "other"
      }
    },
    OrderConfimationMethod: {
      api: "api",
      retool: "retool"
    }
  },
  bullionOrderStatus: {
    orderCreated: "orderCreated",
    orderAccepted: "orderAccepted",
    orderReadyForDispatch: "orderReadyForDispatch",
    paidByCustomer: "paidByCustomer",
    paymentAccepted: "paymentAccepted",
    paidToTrader: "paidToTrader",
    paymentRefunded: "paymentRefunded",
    traderRejected: "traderRejected",
    adminDeleted: "adminDeleted"
  },
  UserTypes: {
    Trader: 'Trader',
    User: 'User',
  },
  OrderTypePrefix: {
    Bullion: "bullion",
    Delivery: "ord",
  },
  PricingModels: {
    NORMAL: "NORMAL",
    SURGE: "SURGE"
  },
  Wallet: {
    Status: {
      ACTIVE: "ACTIVE",
      DISABLED: "DISABLED",
      EXPIRED: "EXPIRED"
    },
    TransactionTypes: {
      RECHARGE: "RECHARGE",
      REFERRAL_BONUS: "REFERRAL_BONUS",
      MANUAL_RECHARGE: "MANUAL_RECHARGE",
      DEBIT: "DEBIT",
      CASHBACK: "CASHBACK",
      REFUND: "REFUND",
      ADJUSTMENT: "ADJUSTMENT"
    }
  },
  Company: {
    BusinessCategories: {
      JEWELLERY: 'JEWELLERY',
      FOREX: 'FOREX'
    }
  },
  ReferralStatus: {
    NOT_INITIATED: "NOT_INITIATED",
    INVITED: "INVITED",
    ACCEPTED: "ACCEPTED",
    COMPLETED: "COMPLETED",
    EXPIRED: "EXPIRED",
  },
}
