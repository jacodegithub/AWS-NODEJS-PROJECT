const ExchangeTokenService = require('./ExchangeTokenService')
const NodeCache = require('node-cache')
const axios = require('axios');
const lastSourceRateModel = require('../Models/LastSourceRateModel');

const quoteCache = new NodeCache({ stdTTL: 2 }) // Expire keys after 2 seconds of timeout
const ORDER_QUOTE_API = 'https://api.kite.trade/quote?';
const ZERODHA_API_VERSION = '3'
const GOLD_INSTRUMENT = 'GOLD23DECFUT'

async function getSellingPrice(instrument, index = "MCX") {
    if (quoteCache.has(instrument)) {
        return quoteCache.get(instrument)
    }

    return sellingPrice(instrument, index)
}

async function sellingPrice(instrument, index) {
    const apiKey = process.env.ZERODHA_API_KEY
    const accessToken = await ExchangeTokenService.get()

    try {
        const currentDate = new Date();
        const lastSavedRate = await lastSourceRateModel.findOne({ source: "MCX" })

        if (lastSavedRate.forceEnable) {
            return lastSavedRate.rate; // return stored rate
        }
        if (currentDate.getDay() === 6) { // check if today is Saturday
            return lastSavedRate.rate; // return stored rate
        }

        const response = await axios.get(ORDER_QUOTE_API + "i=" + index + ":" + instrument,
            {
                headers: {
                    "X-Kite-Version": ZERODHA_API_VERSION,
                    "Authorization": "token " + apiKey + ":" + accessToken
                }
            })

        const instrumentPrice = response.data.data[index + ':' + instrument]
        const ltp = instrumentPrice['depth']['sell'][0].price;

        const query = { source: "MCX" };
        const update = { $set: { rate: ltp } };
        const options = { upsert: true };
        await lastSourceRateModel.updateOne(query, update, options);

        if (ltp === 0) {
            throw {
                status: 500,
                message: "Unable to fetch rates from the Exchange. Market might be closed.",
            };
        }
        else {
            quoteCache.set(instrument, ltp)
            return ltp
        }

    }
    catch (e) {
        console.error(e);
        throw (e);
    }
}

module.exports = { getSellingPrice }
