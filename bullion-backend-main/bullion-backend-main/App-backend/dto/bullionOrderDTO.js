const joi = require('@hapi/joi');
const Enums = require('./../_helpers/Enums');
const { validateRequestQuery, validateRequestBody } = require('./commonValidators');

module.exports = {
  newBullionOrderRequest,
  updateBullionOrderRequest,
  newTriggerRequest
};

const receiverSchema = joi.object({
  receiverName: joi.string().required(),
  receiverAdd: joi.string().required(),
  receiverFlat: joi.string().optional(),
  receiverBuilding: joi.string().required().allow(""),
  receiverContact: joi.string().required(),
  receiverLocation: joi.object({
    lat: joi.number().required(),
    lng: joi.number().required(),
  }).required(),
})

const itemSchema = joi.object({
  payment: joi.object({
    paymentRef: joi.string().optional()
  }).optional()
})

function newBullionOrderRequest(req, res, next) {
  const schema = joi.object({
    receiverDetails: receiverSchema.optional(),
    itemId: joi.string().required(),
    quantity: joi.number().required(),
    traderId: joi.string().required(),
    quote: joi.number().required(),
    expiryTime: joi.string().required(),
    quoteUnitInGram: joi.number().required(),
    checksum: joi.string().required(),
  });

  const options = {
    abortEarly: false,
    allowUnknown: true
  };

  const { error, value } = schema.validate(req.body, options);
  if (error) {
    next(`Validation error: ${error.details.map(x => x.message).join(', ')}`);
  } else {
    req.body = value;
    next();
  };
};

function updateBullionOrderRequest(req, res, next) {
  const schema = joi.object({
    receiverDetails: receiverSchema.optional(),
    item: itemSchema.optional(),
  });

  const options = {
    abortEarly: false,
    allowUnknown: true
  };

  const { error, value } = schema.validate(req.body, options);
  if (error) {
    next(`Validation error: ${error.details.map(x => x.message).join(', ')}`);
  } else {
    req.body = value;
    next();
  };
}

function newTriggerRequest(req, res, next) {
  const schema = joi.object({
    type: joi.string().valid(Enums.Triggers.Types.ALERT, Enums.Triggers.Types.LIMIT_ORDER).default(Enums.Triggers.Types.ALERT),
    itemId: joi.string().required(),
    traderIds: joi.array().required(),
    triggerRate: joi.number().required(),
    quantity: joi.number().when('type', {
      is: Enums.Triggers.Types.LIMIT_ORDER,
      then: joi.required(),
      otherwise: joi.optional(),
    })
  });

  const options = {
    abortEarly: false,
    allowUnknown: true
  };

  const { error, value } = schema.validate(req.body, options);
  if (error) {
    next(`Validation error: ${error.details.map(x => x.message).join(', ')}`);
  } else {
    req.body = value;
    next();
  };
}
