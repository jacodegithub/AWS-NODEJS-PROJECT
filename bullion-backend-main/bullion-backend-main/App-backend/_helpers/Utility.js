const PricesModel = require('./../Models/PricesModel');

module.exports = {
    getOffset,
    getDerivedPrices,
    getPricing,
    disableCache,
    phoneNumberFormatRazorPay
};

function getOffset(page, limit) {
    return ( page - 1 ) * limit;
};

function getDerivedPrices() {
    return new Promise((resolve, reject) => {
        PricesModel.find().then((data) => {
            if (!Array.isArray(data)) throw data;
            if (data.length === 0) throw data;
            const [ datum ] = data;
            const { BasePrice, MiddlePrice, FinalPrice } = datum;
            resolve({BasePrice, MiddlePrice, FinalPrice });
        }).catch((err) => {
            console.error("HelperUtility::getDerivedPrices:: Failed to obtain prices", err);
            return reject(err);
        });
    });
};

function getPricing() {
    return new Promise((resolve, reject) => {
        PricesModel.find()
        .then((data) => {
            if (!Array.isArray(data)) {
                console.error("Utility::getPricing:: Data not in form of array. Data = ", data);
                reject(data);
            };

            if (data.length === 0) {
                console.error("Utility::getPricing:: No data found");
                reject({});
            };

            // Expecting to receive two elements
            // if (data.length !== 2) {
            //     console.error("Utility::getPricing:: Data found but with length NOT equal to 2. Data length is ", data.length);
            //     reject(data);
            // };

            resolve(data);
        }).catch((err) => {
            console.error("HelperUtility::getPricing:: Failed to obtain prices", err);
            reject(err);
        })
    });
};

// Straight up copy pasted from
// https://github.com/helmetjs/nocache/blob/main/index.ts 
function disableCache(expressResonse, expressResonse, expressNext) {
    expressResonse.setHeader("Surrogate-Control", "no-store");
    expressResonse.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    expressResonse.setHeader("Pragma", "no-cache");
    expressResonse.setHeader("Expires", "0");    
    expressNext();
};

function phoneNumberFormatRazorPay(phoneNumber)
{
    if (phoneNumber.length > 10)
    {
        phoneNumber = phoneNumber.substring(phoneNumber.length - 10);
    }
    phoneNumber = "+91" + phoneNumber;
    return phoneNumber;
}; 