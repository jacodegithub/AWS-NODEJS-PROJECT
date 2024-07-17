const { parentPort } = require('worker_threads')
const Enums = require('../_helpers/Enums')
const logger = require('../_helpers/logger')
require('dotenv').config()
const mongoose = require('mongoose')
const { referralExpiryMs } = require('../config.json').referralConfig
const referralModel = require('../Models/ReferralModel');

(async () => {
    try {
        await connectDb()

        await markReferralsAsExpired()

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

async function markReferralsAsExpired() {
    try {
        const referralExpirythreshold = new Date(Date.now() - referralExpiryMs)

        console.log(referralExpirythreshold)

        const result = await referralModel.updateMany(
            {
                $and: [{ created_at: { $lte: referralExpirythreshold } },
                { status: Enums.ReferralStatus.INVITED }]
            },
            { $set: { status: Enums.ReferralStatus.EXPIRED } })

        logger.info(`${result.nModified} referrals marked as expired.`)
    } catch (error) {
        logger.error1('Error marking referrals as expired:', error)
    } finally {
        mongoose.connection.close()
    }
}
