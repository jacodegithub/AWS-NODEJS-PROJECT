const express = require('express');
const router = express.Router();
module.exports = router;
const MiscServices = require('./../services/MiscServices');
const Utility = require('./../_helpers/Utility');
const services = new MiscServices();

router.get(
    "/:device/version/support", 
    Utility.disableCache,
    isDeviceVersionSupported
);

/**
 * @param {*} device ios, android
 * @param {*} version 
 */
async function isDeviceVersionSupported(request, response) {
    try {
        const { params, query } = request;
        const { device } = params;
        const { version } = query;
        const { status, ...data } = await services.isDeviceVersionSupported(device, version);
        return response.status(status).send(data);
    } catch(e) {
        if (e.hasOwnProperty("status")) {
            const { status, ...errors } = e;
            return response.status(status).send(errors)
        };
        return response.status(500).send({"message": "Something went wrong. Please try again", "errors": []});
    }

};