const { parentPort } = require('worker_threads')
const Enums = require('../_helpers/Enums')
const logger = require('../_helpers/logger')
const EmailService = new (require('../users/EmailService'))();
require('dotenv').config()
const mongoose = require('mongoose')
const walletModel = require('../Models/walletModel')
const UserModel = require('../Models/UserModel')
const OrderModel = require('../Models/OrderModel')
const referralModel = require('../Models/ReferralModel')
const { referralConfig, reportingEmails } = require('../config.json')
const walletService = require('../users/wallet_service');

(async () => {
    try {
        await connectDb()

        await checkAndDisburseBonusToEligibleReferrals()

        if (parentPort) parentPort.postMessage('done')
        else process.exit(0)
    } catch (error) {
        logger.error(error)
    }
})()

async function connectDb() {
    const connectionOptions = { useCreateIndex: true, useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false }
    mongoose.connect(process.env.MONGO_URL, connectionOptions)

    mongoose.connection.on('connected', () => {
        logger.info('cron Database is connected')
    })
}

async function checkAndDisburseBonusToEligibleReferrals() {
    const acceptedReferrals = await referralModel.find({ status: Enums.ReferralStatus.ACCEPTED })
    const eligibleUsers = []
    for (let i = 0; i < acceptedReferrals.length; i++) {
        const referral = acceptedReferrals[i]
        const user = await UserModel.findOne({
            $or: [
                { phonenumber: referral.phoneNumber },
                { email: referral.email }
            ]
        })

        const userOrders = await OrderModel.find({ userId: user._id, orderStatus: { $ne: Enums.Order.Status.cancelled } })

        if (userOrders.length > 0) {
            await disburseReferralBonusToReferrer(referral)
            eligibleUsers.push(referral.referrerId)
        }
    }

    const emailSubject = 'Referral Bonus Disbursal Stats'
    const emailText = 'Referral Bonus was disbursed to following userIds: \n\n' + eligibleUsers.toString()
    await EmailService.send(reportingEmails, emailSubject, null, emailText)

}

async function disburseReferralBonusToReferrer(referral) {
    const referrerCompanyId = await UserModel.findById(referral.referrerId)
    if (referrerCompanyId) {
        logger.info(`Disbursing referral bonus to referrer with userId: ${referral.referrerId}`)
        const comment = `Referral Bonus for user with phonenumber: ${referral.phoneNumber}`
        await walletService.addNewWalletForCompany(referral.referrerBonus, referrerCompanyId, referral.referrerId, false, referralConfig.bonusAmountExpiryMs, comment)
        await referralModel.findOneAndUpdate({ _id: referral._id }, { status: Enums.ReferralStatus.COMPLETED })
    }
    else {
        logger.error(`No companyId found for user with id: ${referral.referrerId}`)
    }
}
