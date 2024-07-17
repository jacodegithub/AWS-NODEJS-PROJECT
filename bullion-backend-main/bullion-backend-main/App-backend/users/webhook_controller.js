const express = require('express');
const router = express.Router();
const webhookService = require('./webhook_service')
// const razorpay = require('razorpay');
const { createHash } = require('crypto');
const axios = require('axios');
const ExchangeTokenService = require('../services/ExchangeTokenService');
const authorizeService = require("../_middleware/authorizeServiceAccount");
const { captureException } = require('@sentry/node');

module.exports = router;

router.post("/webhook/task-update", taskUpdateCallback);
router.post("/webhook/payments", handlePaymentsWebhook)
router.post("/webhook/walletPayments", handleWalletWebhook)
router.post("/webhook/trader/", handleTraderOrderWebhook);
router.get("/webhook/zerodha/token/", authorizeService(), handleZerodhaEncToken);
router.get("/webhook/zerodha/login/callback", handleZerodhaLoginCallback);
router.get("/webhook/zerodha/login", handleZerodhaLogin);

/**
 * Update order state based on callback
 * @param {*} request.body
 * @param {*} response 202
 */
function taskUpdateCallback(request, response) {

    if (request.body.tookan_shared_secret != process.env.TOOKAN_WEBHOOKKEY) {
        console.error("WebhookController::taskUpdateCallback:: Unauthenticated");
        return response.status(401).send({ message });
    };

    // Respond immediately to webhook
    response.status(202).send({ "message": "OK" });

    // Handle data
    const { body } = request;

    // console.debug("WebhookController::taskUpdateCallback:: Data = ", response);
    webhookService.handleTookanTaskUpdate(body)
};

/**
 * Receive a webhook from Razorpay
 * And handle it according to the status provided by them
 * @param {*} request 
 * @param {*} response 
 */
function handlePaymentsWebhook(request, response) {
    try {
        const { headers, body } = request;
        const signature = headers["x-razorpay-signature"] || "";

        // razorpay.validateWebhookSignature(JSON.stringify(body), signature, process.env.RAZORPAY_WEBHOOK_SECRET);
        const isValidSignature = null;
        if (!isValidSignature) {
            console.error("WebhookController::handlePaymentsWebhook:: Invalid signature = ", signature);
            return response.status(401).send({ "message": "Invalid signature. This endpoint needs valid authentication" });
        };

        // Respond immediately
        response.status(200).send({ "message": "OK" });

        // console.debug("WebhookController::handlePaymentsWebhook:: Data = ", response);
        webhookService.handleRazorpayWebhook(body);
    } catch (e) {
        captureException(e)
        console.error("WebhooksController::handlePaymentsWebhook::Uncaught error", e);
        return response.status(500).send({ "message": "Something went wrong. Please try again" });
    }
};

function handleWalletWebhook(request, response) {
    try {
        if (request.headers.apikey != process.env.TOOKAN_WEBHOOKKEY) {
            console.error("WebhookController::taskUpdateCallback:: Unauthenticated");
            return response.status(401).send({ message });
        };

        // Respond immediately to webhook
        response.status(202).send({ "message": "OK" });

        // Handle data
        const { body } = request;

        // console.debug("WebhookController::handlePaymentsWebhook:: Data = ", response);
        webhookService.handleWalletWebhook(body);
    } catch (e) {
        captureException(e)
        console.error("WebhooksController::handlePaymentsWebhook::Uncaught error", e);
        return response.status(500).send({ "message": "Something went wrong. Please try again" });
    }
};

function handleTraderOrderWebhook(request, response) {
    if (request.headers.api_key != null) {
        return res.status(401).json({
            message: "Please add api-key in the header"
        })
    }
    webhookService.handleTraderOrderUpdate(request, response);

}

async function handleZerodhaLoginCallback(request, response) {
    const request_token = request.query.request_token;
    if (request_token == null) {
        return response.status(400).json({
            message: "Missing request token in query parameters"
        })
    }
    const ZERODHA_API_KEY = process.env.ZERODHA_API_KEY;
    const ZERODHA_API_SECRET = process.env.ZERODHA_API_SECRET;

    const checksum_str = ZERODHA_API_KEY + request_token + ZERODHA_API_SECRET
    const checksum = createHash('sha256').update(checksum_str).digest('hex');

    try {
        zerodha_response = await axios.post("https://api.kite.trade/session/token", {
            "api_key": ZERODHA_API_KEY,
            "request_token": request_token,
            "checksum": checksum
        }, { headers: { "X-Kite-Version": "3", 'Content-Type': 'application/x-www-form-urlencoded' } })

        const access_token = zerodha_response.data.data.access_token;
        await ExchangeTokenService.save(access_token);

        return response.status(200).json({
            message: "Access Token retrieved successfully"
        })
    } catch (exception) {
        captureException(exception)
        console.error(exception.toString());
        return response.status(500).json({ message: "Internal server error" })
    }
}

async function handleZerodhaEncToken(request, response) {
    if (process.env.NODE_ENV == "production") {
        return response.status(404).json({
            message: "This feature is not available"
        })
    }

    const encrypted_token = request.query.encrypted_token;
    if (encrypted_token == null) {
        return response.status(400).json({
            message: "Missing encrypted token in query parameters"
        })
    }

    try {
        await ExchangeTokenService.saveEncrypted(encrypted_token);
        return response.status(200).json({
            message: "Encrypted Token saved successfully"
        })

    } catch (exception) {
        captureException(exception)
        console.error(exception.toString());
        return response.status(500).json({ message: "Internal server error" })
    }
}

async function handleZerodhaLogin(_request, response) {
    const ZERODHA_API_KEY = process.env.ZERODHA_API_KEY;
    const zerodhaRedirectUrl = "https://kite.zerodha.com/connect/login?v=3&api_key=" + ZERODHA_API_KEY
    return response.redirect(zerodhaRedirectUrl);
}
