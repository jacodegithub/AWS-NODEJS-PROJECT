const OrderModel = require('../Models/OrderModel')
const ReferralModel = require('../Models/ReferralModel')
const UserModel = require('../Models/UserModel')
const Enums = require('../_helpers/Enums')
const logger = require('../_helpers/logger')
const referralConfig = require('../config.json').referralConfig
const _ = require('lodash')
const WhatsappService = new (require('../users/WhatsappService'))()
const walletService = require('../users/wallet_service')
const CompanyModel = require('../Models/CompanyModel')
const { customAlphabet } = require('nanoid')
const { incrementReferralCountForLead } = require('./LeadService')

module.exports = {
  getReferralsForUser,
  createReferrals,
  initiateReferralBonus,
  generateAndStoreReferralCodeForUser
}

async function getReferralsForUser(userId) {
  const [referrals] = await ReferralModel.aggregate([
    { $match: { referrerId: userId } },
    {
      $group: {
        _id: null,
        totalReferrals: { $sum: 1 },
        completedReferrals: {
          $sum: {
            $cond: { if: { $eq: ['$status', 'COMPLETED'] }, then: 1, else: 0 }
          }
        },
        totalEarnings: {
          $sum: {
            $cond: { if: { $eq: ['$status', 'COMPLETED'] }, then: '$referrerBonus', else: 0 }
          }
        },
        referrals: { $push: '$$ROOT' }
      }
    }
  ])
  if (referrals) {
    return referrals
  } else {
    return {
      totalReferrals: 0,
      orderedReferrals: 0,
      totalEarnings: 0,
      referrals: []
    }
  }
}

async function createReferrals(user, referralBody) {
  const userId = user?._id

  let referralCode = user.referralCode
  if (!referralCode) {
    referralCode = await generateAndStoreReferralCodeForUser(userId)
  }

  const referrals = await referralBody.map(async (r) => {
    const request = {
      ...r,
      referrerId: userId,
      referralCode,
      status: Enums.ReferralStatus.INVITED,
      bonusAmount: referralConfig.bonusAmountINR,
      referrerBonus: referralConfig.referrerBonusINR
    }

    try {
      const validatedPhoneNumber = validateReferralPhone(request?.phoneNumber)
      sendReferralWhatsappMessages(user, validatedPhoneNumber, referralCode)
      await incrementReferralCountForLead(validatedPhoneNumber)
      const referral = await ReferralModel.create({ ...request, phoneNumber: validatedPhoneNumber })

      return referral
    } catch (err) {
      logger.warn('Got an exception in ReferralService::createReferrals', err)
      logger.warn('Continuing creating the rest of the referrals in the request payload')
    }
  })

  return referrals
}

async function generateAndStoreReferralCodeForUser(userId) {
  const nanoid = customAlphabet('123456789ABCDEFGHIKLMNOPQRSTUVWXYZ', 6)
  const referralCode = nanoid()
  await UserModel.findOneAndUpdate({ _id: userId }, { referralCode })

  return referralCode
}

async function getDurationSinceOldestOrder(companyId) {
  const userList = await UserModel.find({ 'GST.companyId': companyId })
  const companyUserIds = userList.map((user) => user._id)
  const [oldestOrder] = await OrderModel.find({ userId: { $in: companyUserIds } }, { created_at: 1 }).sort({ created_at: 1 }).limit(1)
  return oldestOrder?.created_at
}

async function sendReferralWhatsappMessages(user, referralPhonenumber, referralCode) {
  const companyId = user?.GST?.companyId
  const company = await CompanyModel.findById(companyId)
  const timeSinceOldestOrder = await getDurationSinceOldestOrder(companyId)
  let numberOfMonths
  if (timeSinceOldestOrder) {
    numberOfMonths = getMonthDifference(timeSinceOldestOrder, new Date())
  } else {
    numberOfMonths = 'a few'
  }
  const GSTBusinessName = user?.GST?.businessName
  const companyName = company?.companyName
  const businessName = (GSTBusinessName) || companyName

  if (businessName) {
    await WhatsappService.notifyReferral(referralPhonenumber, user.fullName, referralCode, businessName, numberOfMonths)
  } else {
    await WhatsappService.notifyReferralWithoutBusinessName(referralPhonenumber, user.fullName, referralCode, numberOfMonths)
  }
}

function getMonthDifference(dt2, dt1) {
  let diff = (dt2.getTime() - dt1.getTime()) / 1000
  diff /= (60 * 60 * 24 * 7 * 4)
  return Math.abs(Math.round(diff))
}

async function initiateReferralBonus({ email, phoneNumber, name, referralCode, companyId }) {
  const referralsForPhoneNumber = await ReferralModel
    .find({
      phoneNumber,
      status: Enums.ReferralStatus.INVITED
    })
    .sort({ created_at: 1 })

  let referral

  switch (referralsForPhoneNumber.length) {
    case 0:
      if (referralCode) {
        const referrer = await UserModel.findOne({ referralCode })
        if (referrer) {
          logger.info(`No existing referrals for new user: ${phoneNumber}, creating a new one attributed to user with referralCode: ${referralCode}`)
          referral = await ReferralModel.create({
            name,
            email,
            phoneNumber,
            referrerId: referrer._id,
            referralCode,
            bonusAmount: referralConfig.bonusAmountINR,
            referrerBonus: referralConfig.referrerBonusINR,
            status: Enums.ReferralStatus.ACCEPTED
          })
          await grantReferralBonus(referral, companyId)
        }
      }
      break

    case 1:
      await ReferralModel.findOneAndUpdate({ _id: referralsForPhoneNumber[0]._id }, { status: Enums.ReferralStatus.ACCEPTED })
      grantReferralBonus(referralsForPhoneNumber[0], companyId)
      break

    default:
      logger.info(`More than one referral found for user: ${phoneNumber}\nGranting referral bonus to the first referral for user: ${referralCode}`)
      await ReferralModel.findOneAndUpdate({ _id: referralsForPhoneNumber[0]._id }, { status: Enums.ReferralStatus.ACCEPTED })
      grantReferralBonus(referralsForPhoneNumber[0], companyId)
      break
  }
}

async function grantReferralBonus(referral, companyId) {
  if (companyId) {
    const referralBonus = referral.bonusAmount
    const referralBonusExpiryMs = referralConfig.bonusAmountExpiryMs
    logger.info('Adding referral bonus for company: ' + companyId + ' referred by userId: ' + referral.referrerId)
    const comment = `Referred by user with ID: ${referral.referrerId}`
    await walletService.addNewWalletForCompany(referralBonus, companyId, null, false, referralBonusExpiryMs, comment)
  } else {
    throw Error({
      message: 'CompanyId not generated for this user. To have a wallet, you need to be a businessUser'
    })
  }
}

function validateReferralPhone(phoneNumber) {
  if (phoneNumber.length === 10) {
    return phoneNumber
  } else if (_.startsWith(phoneNumber, '+91')) {
    return phoneNumber.slice(3)
  } else {
    throw new Error(`Malformed referral phone number: ${phoneNumber}`)
  }
}
