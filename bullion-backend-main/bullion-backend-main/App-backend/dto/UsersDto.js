const joi = require('@hapi/joi');
const { validateRequestBody } = require('./commonValidators');
const Enum = require('./../_helpers/Enums');

module.exports = {
  UpdateSavedAddrRequest,
  EmailPasswordRegistrationRequest,
  PhoneNumberOTPRegistrationRequest,
  InitPhoneNumberRegisterORAUthRequest,
  EmailPasswordAuthenticationRequest,
  PhoneNumberOTPAuthenticationRequest
};

function UpdateSavedAddrRequest(req, res, next) {
  const schema = joi.object({
    address: joi.string().required(),
    lat: joi.number().required(),
    lng: joi.number().required(),
    label: joi.string().required(),
    number: joi.string().required(),
    flatNumber: joi.string().optional(),
    buildingName: joi.string().optional()
  });

  const { error, v } = schema.validate(req.body, { allowUnknown: true });
  if (error) {
    next(`Validation error: ${error.details.map(x => x.message).join(', ')}`);
  } else {
    next();
  };
};

const registrationFieldsValidation = {
  fullname: joi.string().required(),
  email: joi.string().required(),
  phonenumber: joi.string().required(),
  gstNumber: joi.string(),
  businessName: joi.string().optional(),
  role: joi.string().valid(Enum.Roles.Bussiness, Enum.Roles.Customer).default(Enum.Roles.Customer),
  referralCode: joi.string().optional(),
};

function EmailPasswordRegistrationRequest(req, res, next) {
  const schema = joi.object({
    ...registrationFieldsValidation,
    password: joi.string().required(),
    confirmpassword: joi.string().required()
  });
  validateRequestBody(next, req, schema);
};

function InitPhoneNumberRegisterORAUthRequest(req, res, next) {
  const schema = joi.object({
    phonenumber: joi.string().required()
  });
  validateRequestBody(next, req, schema);
};

function PhoneNumberOTPRegistrationRequest(req, res, next) {
  const schema = joi.object({
    ...registrationFieldsValidation,
    otp: joi.string().required(),
  });
  validateRequestBody(next, req, schema);
};

function EmailPasswordAuthenticationRequest(req, res, next) {
  const schema = joi.object({
    email: joi.string().required(),
    password: joi.string().required()
  });
  validateRequestBody(next, req, schema);
};

function PhoneNumberOTPAuthenticationRequest(req, res, next) {
  const schema = joi.object({
    phonenumber: joi.string().required(),
    otp: joi.string().required()
  });
  validateRequestBody(next, req, schema);
};
