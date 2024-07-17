const { parentPort } = require('worker_threads')
const Enums = require('../_helpers/Enums')
const logger = require('../_helpers/logger')
require('dotenv').config()
const mongoose = require('mongoose')
const walletModel = require('../Models/walletModel');

(async () => {
    try {
        await connectDb()

        await markWalletsAsExpired()

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

async function markWalletsAsExpired() {
    try {
        const now = new Date()

        const result = await walletModel.updateMany(
            {
                $and: [{ expiry: { $lte: now } },
                { status: Enums.Wallet.Status.ACTIVE }]
            },
            { $set: { status: Enums.Wallet.Status.EXPIRED } })

        logger.info(`${result.nModified} wallets marked as expired.`)
    } catch (error) {
        logger.error1('Error marking wallets as expired:', error)
    } finally {
        mongoose.connection.close()
    }
}
