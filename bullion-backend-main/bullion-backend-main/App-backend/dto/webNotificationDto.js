const joi = require('@hapi/joi');
const { validateRequestBody } = require('./commonValidators');

function subscriptionRequest(req, res, next) {
  const schema = joi.object({
    endpoint: joi.string().required(),
    expirationTime: joi.date().optional().allow(null),
    keys: joi.object().required(),
  });
  validateRequestBody(next, req, schema);
}

module.exports = {
  subscriptionRequest
}
