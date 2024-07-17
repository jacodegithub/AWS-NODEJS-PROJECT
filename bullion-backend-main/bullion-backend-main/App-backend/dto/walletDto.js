const joi = require('@hapi/joi');
const { validateRequestBody } = require('./commonValidators');

module.exports = {
    rechargeRequest
};

function rechargeRequest(req, res, next) {
    const schema = joi.object({
        amount: joi.number().required()
    });
    validateRequestBody(next, req, schema);
};