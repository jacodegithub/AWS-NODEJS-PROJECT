const joi = require('@hapi/joi')

module.exports = {
  newReferralRequest: newReferralRequestValidation,
  rankReferralRequest: rankReferralRequestValidation,
}

const newReferralRequestSchema = joi.array()
  .items(
    joi.object({
      name: joi.string().optional(),
      phoneNumber: joi.string().required(),
      email: joi.string().optional(),
    })
  )

const rankReferralRequestSchema = joi.array().items(
  joi.object({
    givenName: joi.string(),
    familyName: joi.string(),
    emailAddresses: joi.array(),
    phoneNumbers: joi.array(),
  }))

function newReferralRequestValidation(request, response, next) {
  const options = {
    abortEarly: false,
    allowUnknown: true
  }

  const { error, value } = newReferralRequestSchema.validate(request.body, options)
  if (error) {
    next(`Validation error: ${error.details.map(x => x.message).join(', ')}`)
  } else {
    request.body = value
    next()
  }
}

function rankReferralRequestValidation(request, response, next) {
  const options = {
    abortEarly: false,
    allowUnknown: true
  }

  const { error, value } = rankReferralRequestSchema.validate(request.body, options)
  if (error) {
    next(`Validation error: ${error.details.map(x => x.message).join(', ')}`)
  } else {
    request.body = value
    next()
  }
}
