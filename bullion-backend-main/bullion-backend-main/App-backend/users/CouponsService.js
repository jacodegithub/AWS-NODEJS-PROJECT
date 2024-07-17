const CouponsModel = require('./../Models/PromoModel');

class CouponService {
    constructor() {
        this.couponsModel = CouponsModel;
    };

    async find(query, select = {}, sort = {}, skip = 0, limit = 0) {
        return await this.couponsModel
        .find(query, select)
        .sort(sort)
        .skip(skip)
        .limit(limit);
    };

    async findOne(query) {
        return await this.couponsModel.findOne(query);
    };

    async updateOne(query, updateBody, options = {}) {
        return await this.couponsModel.updateOne(query, updateBody, options);
    };

    calculateDiscountByPercent(totalAmount, percentageDiscount) {
        if (percentageDiscount > 100) {
            percentageDiscount = 100
        } else if (percentageDiscount < 0) {
            percentageDiscount = 0;
        };
        
        // Total discount
        return (percentageDiscount/ 100) * totalAmount;
    };

    calculateDiscountByUnit(totalAmount, totalDiscount) {
        if (totalDiscount < 0)
            totalDiscount = 0;
    
        return totalDiscount;
    };

    assertCouponIsValid(coupon) {
        const { expires, quota } = coupon;
        const { total, limit } = quota;

        if (expires < new Date()) {
            console.error("CouponsService::assertCouponIsValid:: coupon has expired = ", coupon);
            throw {
                status: 412,
                message: "Invalid coupon: Coupon has expired"
            };
        };

        if (limit > 0 && total >= limit) {
            console.error("CouponsService::assertCouponIsValid::Coupon usage exceeded = ", coupon);
            throw {
                status: 412,
                message: "Invalid coupon: Coupon usage exceeded"
            };
        };
    };

    assertCouponIsValidForPricing(coupon, amount) {
        const { id, discount } = coupon;
        const { minOrderAmount } = discount;

        if (amount < minOrderAmount) {
            console.debug("CouponsService::assertCouponIsValidForPricing:: Amount lesser than coupon minimum amount for coupon = ", id, " having min order amount = ", minOrderAmount, " and amount = ", amount);
            throw { status: 412, message: "Coupon cannot be applied: Trip amount is lesser than coupon's minimum" };
        };
    };

    assertCouponIsValidForUser(coupon) {};

    incrementCouponUse(couponId) {
        if (couponId) {
            const query = { _id: couponId };
            const updateQuery = { 
                "$inc": { "quota.total": 1 }
            };        

            this.updateOne(query, updateQuery)  
            .catch((err) => {
                console.error("CouponsService::incrementCouponUse::Failed to increment coupon = ", couponId, "\n Error = ", err);
            });
        };
    };

    decrementCouponUse(couponId) {
        if (couponId) {
            const query = { _id: couponId };
            const updateQuery = { 
                "$inc": { "quota.total": -1 }
            };        

            this.updateOne(query, updateQuery)  
            .catch((err) => {
                console.error("CouponsService::decrementCouponUse::Failed to decrement coupon = ", couponId, "\n Error = ", err);
            });
        };
    };
};

module.exports = CouponService;