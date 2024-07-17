const insuranceAmountUsageModel = require('../Models/insuranceAmountUsageModel')
const companyModel = require('../Models/CompanyModel')
const userModel = require('../Models/UserModel')
const orderModel = require('../Models/OrderModel')
const { insuranceProhibitedBusinessCategories, insuranceConfig } = require('../config.json')
const logger = require('../_helpers/logger')
const Enums = require('../_helpers/Enums')
const { captureException } = require('@sentry/node')

async function increaseUsedAmount(amount) {
    try {
        await insuranceAmountUsageModel.updateOne({ status: 'ACTIVE' }, { $inc: { usedAmount: amount } })
    } catch (error) {
        captureException(error)
        logger.error(error)
        throw error
    }
}

async function getInsuranceUsageCount() {
    try {
        return await insuranceAmountUsageModel.findOne({ status: 'ACTIVE' })
    } catch (error) {
        captureException(error)
        logger.error(error)
        throw error
    }
}

async function calcInsuranceAmount(insuranceAmount = 0, user) {
    const companyId = user.GST?.companyId
    if (companyId) {
        const users = await userModel.find({ 'GST.companyId': companyId })
        const userIds = users.map((userData) => userData._id)
        const { completed, ongoing } = Enums.Order.Status
        const orderCount = await orderModel.find({ userId: { $in: userIds }, orderStatus: { $in: [completed, ongoing] } }).count()
        const { percentageCharges, flatFee, flatFeeOrderCount } = insuranceConfig
        if (orderCount < flatFeeOrderCount) {
            const INSURANCE_RATE_PER_LAKH = flatFee
            return Math.ceil(insuranceAmount / 100000) * INSURANCE_RATE_PER_LAKH
        }
        return Math.ceil(insuranceAmount / 100 * percentageCharges)
    } else {
        throw { status: 500, message: 'CompanyId does not exists for this businessUser' }
    }
}

async function checkInsuranceEligibility(user) {
    const companyId = user.GST?.companyId
    if (companyId) {
        const company = await companyModel.findById(companyId)
        if (isBusinessCategoryProhibited(company.businessCategory)) {
            throw {
                status: 403,
                message: 'Transit Insurance provided by ICICI facilitated through Gordian is not available for your account.'
            }
        }
    }
}

async function checkIfInsuranceIsMandatory(user, amount) {
    const { companyId, is_verified } = user.GST
    const { insuranceMandatoryLimit } = insuranceConfig
    const company = await companyModel.findById(companyId)
    if (company) {
        if (isBusinessCategoryProhibited(company.businessCategory) === false) {
            if ((amount >= insuranceMandatoryLimit && (is_verified !== true))) {
                throw {
                    status: 403,
                    message: 'Transit Insurance is mandatory for amount greater than ₹' + insuranceMandatoryLimit + ' for your account.'
                }
            }
        }
    } else {
        throw {
            status: 403,
            message: 'Your account is not associated with any company. Please contact RM.'
        }
    }
}

function isBusinessCategoryProhibited(companyBusinessCategory) {
    if (companyBusinessCategory) {
        return insuranceProhibitedBusinessCategories.includes(companyBusinessCategory)
    }
    return false // allow insurance if businessCategory is not set
}

module.exports = {
    increaseUsedAmount,
    getInsuranceUsageCount,
    checkInsuranceEligibility,
    calcInsuranceAmount,
    checkIfInsuranceIsMandatory
}
