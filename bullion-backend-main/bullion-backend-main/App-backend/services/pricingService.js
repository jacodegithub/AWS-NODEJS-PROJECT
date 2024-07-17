const PriceModel = require('../Models/PricesModel')
// const walletService = require('../users/wallet_service')
const Enums = require('../_helpers/Enums')
const logger = require('../_helpers/logger')
const { captureException } = require('@sentry/node')

module.exports = { calculateCost }

async function calculateCost(originDestinationDistance, user) {
    try {
        let PRICING_MODEL
        let walletPlan
        const companyId = user.GST?.companyId

        // if (companyId) {
        //     walletPlan = await walletService.getWalletPlanForCompany(companyId)
        // }

        const surgedPricedModel = await getSurgePriceModelIfEnabled(walletPlan?._id)
        if (surgedPricedModel) {
            PRICING_MODEL = surgedPricedModel
        } else {
            PRICING_MODEL = await PriceModel.findOne({ title: Enums.PricingModels.NORMAL, walletPlan: walletPlan?._id })
        }
        const { baseDistance, perKMFare, title } = PRICING_MODEL

        const totalDistance = Math.ceil(originDestinationDistance)
        const amount = perKMFare * Math.max(baseDistance, totalDistance)

        return { amount, perKMFare, fareType: title }
    } catch (error) {
        captureException(error)
        logger.error(error)
        throw error
    }
};

async function getSurgePriceModelIfEnabled(walletPlan) {
    const nowIST = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })

    const hours = new Date(nowIST).getHours()
    const minutes = new Date(nowIST).getMinutes()

    const minutesFromMidnight = hours * 60 + minutes

    const priceModel = await PriceModel.findOne({
        walletPlan,
        $or: [
            { autoApplyAfterMinutes: { $lte: minutesFromMidnight } },
            { surgeEnabled: true }]
    })
    if (priceModel) {
        return priceModel
    }
}
