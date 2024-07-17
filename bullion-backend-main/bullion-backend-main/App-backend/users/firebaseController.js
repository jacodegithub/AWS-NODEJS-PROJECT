const express = require('express');
const router = express.Router();
const authorize = require('./../_middleware/authorize');
// const fireBaseService = require('./../users/fireBaseService');

module.exports = router;

router.post("/register-device", authorize(), async(request, response) => {
    try {
        response.status(202).send({}); // early return considering client needs no data below
        const { user, body } = request;
        const { deviceId } = body;
        // await fireBaseService.getUserAndDevice(user, deviceId);
    } catch(error) {
        if (error.hasOwnProperty("status") && error.hasOwnProperty("message")) {
            const { status, ...e } = error;
            return response.status(status).send(e);
        };
        console.error("FirebaseController:: POST /register-device :: unhandled error", error);
        return response.status(500).send({"message": "Something went wrong. Please try again"});
    };

});