const express = require('express')
const router = express.Router()
const ReferralService = require('../services/ReferralService')
const LeadService = require('../services/LeadService')
const logger = require('../_helpers/logger')
const authorize = require('../_middleware/authorize')
const ReferralDto = require('../dto/ReferralDto')

router.get('/', authorize(), getReferrals)
router.post('/', authorize(), ReferralDto.newReferralRequest, createReferrals)
router.get('/leads', authorize(), getLeads)

async function getReferrals(request, response, next) {
  try {
    const userId = request?.user?._id
    const referrals = await ReferralService.getReferralsForUser(userId)
    return response.status(200).json({ data: referrals, message: 'Fetched referrals created by the user' })
  } catch (err) {
    logger.error('Unhandled exception in ReferralController::getReferrals', err)
    next(err)
  }
}

async function createReferrals(request, response, next) {
  try {
    const user = request?.user
    const referralBody = request?.body
    const referral = ReferralService.createReferrals(user, referralBody)
    return response.status(200).json({ data: referral, message: 'Referral created successfully' })
  } catch (err) {
    logger.error('Unhandled exception in ReferralController::createReferrals', err)
    next(err)
  }
}

async function getLeads(_request, response, next) {
  try {
    const leads = await LeadService.getLeadPhoneNumbers()
    return response.status(200).json({ data: leads, message: 'Offline Leads' })
  } catch (err) {
    logger.error('Unhandled exception in ReferralController::getLeads', err)
    next(err)
  }
}

module.exports = router
