
// Services for Locus
// https://documenter.getpostman.com/view/10830658/TVsx9Qqe#26bb827d-2a32-418b-8d56-48a39d0c5c6f

const Enums = require('./../_helpers/Enums');
const request = require('request');

class LocusService {
    constructor() {
        const username = process.env.LOCUS_USERNAME;
        const password = process.env.LOCUS_PASSWORD;
        this.auth = { username, password };
        this.CLIENT_ID = `gordian-demo`;
        this.LOCUS_BASE_URL = `https://locus-api.com/v1/client/${this.CLIENT_ID}`;
        this.TASK_CREATE_URL = `${this.LOCUS_BASE_URL}/mpmdtask`;
        this.TASK_GET_URL = `${this.LOCUS_BASE_URL}/task`;
        this.CANCEL_TASK = `${this.LOCUS_BASE_URL}/task`;
        this.BLR_SECURE_TEAM = process.env.LOCUS_BLR_SECURE_TEAM;
        this.BLR_REGULAR_TEAM = process.env.LOCUS_BLR_REGULAR_TEAM;
        this.BLR_SECURE_AUTO_ACCEPT = process.env.LOCUS_BLR_SECURE_TEAM_AUTO_ACCEPT || true;
        this.BLR_REGULAR_AUTO_ACCEPT = process.env.LOCUS_BLR_REGULAR_TEAM_AUTO_ACCEPT || false;

        this.GET_CANCEL_TASK_URL = (taskId) => `${this.CANCEL_TASK}/${taskId}/status`;
    };

    formatDeliveryCostNotes(deliveryCosts = {}) {
        const tiers = deliveryCosts.hasOwnProperty("tiers") ? deliveryCosts["tiers"] : [];
        let items = [];

        tiers.map(({ amount }) => {
            //, bonus
            items.push({
                // item: label,
                item: `Earnings = ${amount}`,
                //\nBonus = ${bonus}\nTotal = ${amount + bonus}
                format: "TEXT"
            })
        });

        return items;
    };

    createTaskBody(savedOrder) {

        const startTime = new Date();
        let endTime;
        let maxDropTime;
        let teamId;
        let AUTO_ACCEPT;

        const {
            orderId, deliveryMethod, amount, currency,
            senderName, senderContact, senderFlat, senderLocation, senderAdd,
            receiverName, receiverContact, receiverFlat, receiverLocation, receiverAdd,
            deliveryCosts
        } = savedOrder;

        const LINE_ITEM_ID = `${orderId}-line-item-1`;
        const LINE_ITEM_NAME = `Line Item 1 for order ID ${orderId}`;
        const LINE_ITEM_QUANTITY = 1;
        const AUTO_ASSIGN = false;
        const CITY = "Bangalore";
        const COUNTRY_CODE = "IN";
        const TRANSACTION_DURATION = 60 * 5;
        const PICKUP_AMOUNT = 0;
        const PICKUP_ADDR = senderAdd;
        const DROP_ADDR = receiverAdd;
        const DROP_AMOUNT = 0;
        const PICK_UP_EXCHG_TYPE = "COLLECT";
        const DROP_EXCHG_TYPE = "GIVE";
        const VOL_VALUE = "1";
        const VOL_UNIT = "ITEM_COUNT";
        let deliveryNotes = [];

        if (deliveryMethod === Enums.DeliveryMethod.REGULAR) {
            teamId = this.BLR_REGULAR_TEAM;
            endTime = new Date(Date.now() + (1000 * 3600 * 1.5));
            maxDropTime = new Date(Date.now() + (1000 * 3600 * 3));
            AUTO_ACCEPT = this.BLR_REGULAR_AUTO_ACCEPT;
            deliveryNotes = this.formatDeliveryCostNotes(deliveryCosts);
        } else if (deliveryMethod === Enums.DeliveryMethod.SECURE) {
            // teamId = "blr-normal";
            teamId = this.BLR_SECURE_TEAM;
            endTime = new Date(Date.now() + (1000 * 3600 * 0.75));
            maxDropTime = new Date(Date.now() + (1000 * 3600 * 1.5));
            AUTO_ACCEPT = this.BLR_SECURE_AUTO_ACCEPT;
        } else {
            console.error("LocusService::createTaskBody::Invalid delivery method = ", deliveryMethod);
            return reject({
                status: 400,
                message: "Unknown delivery method for order"
            });
        };

        const locusTask = {
            teamId,
            taskId: orderId,
            lineItems: [{
                id: LINE_ITEM_ID,
                name: LINE_ITEM_NAME,
                quantity: LINE_ITEM_QUANTITY,
                // price: { amount, currency }
            }],
            autoAssign: AUTO_ASSIGN,
            pickupContactPoint: {
                name: senderName,
                number: senderContact,
            },
            pickupLocationAddress: {
                placeName: senderFlat,
                formattedAddress: PICKUP_ADDR,
                city: CITY,
                countryCode: COUNTRY_CODE,
            },
            pickupLatLng: senderLocation,
            pickupSlots: [{
                start: startTime.toISOString(),
                end: endTime.toISOString(),
            }],
            pickupTransactionDuration: TRANSACTION_DURATION,
            pickupAmount: {
                amount: {
                    amount: PICKUP_AMOUNT,
                    currency: Enums.Currency.INR,
                    symbol: Enums.Currency.INR_SYMBOL
                },
                exchangeType: PICK_UP_EXCHG_TYPE,
            },
            dropContactPoint: {
                name: receiverName,
                number: receiverContact,
            },
            pickupAppFields: {
                items: deliveryNotes
            },
            dropAppFields: {
                items: deliveryNotes
            },
            dropLocationAddress: {
                placeName: receiverFlat,
                formattedAddress: DROP_ADDR,
                city: CITY,
                countryCode: COUNTRY_CODE,
            },
            dropLatLng: receiverLocation,
            dropSlots: [{
                start: endTime.toISOString(),
                end: maxDropTime.toISOString(),
            }],
            dropTransactionDuration: TRANSACTION_DURATION,
            dropAmount: {
                amount: {
                    amount: DROP_AMOUNT,
                    currency: Enums.Currency.INR,
                    symbol: Enums.Currency.INR_SYMBOL,
                },
                exchangeType: DROP_EXCHG_TYPE,
            },
            volume: {
                value: VOL_VALUE,
                unit: VOL_UNIT,
            },
            taskAppConfig: {
                autoAccept: AUTO_ACCEPT
            }
        };
        return locusTask;
    };

    /**
     * 
     * @param {*} savedOrder 
     * @returns 
     * - address
     * - checkLists
     * - creationTime
     * - eta 
     * - orderDetail
     * - status
     * - statusUpdates
     * - taskGraph
     *      - visits<Array of 2 elements: Pickup and Drop>
     *          - [0] , [1] 
     *              - trackLink
     */
    createTask(savedOrder) {
        return new Promise((resolve, reject) => {
            const { orderId } = savedOrder
            // const TASK_CREATE_URL = `${this.TASK_CREATE_URL}/${orderId}-task-1`
            const TASK_CREATE_URL = `${this.TASK_CREATE_URL}/${orderId}`
            const requestBody = {
                auth: this.auth,
                body: this.createTaskBody(savedOrder),
                json: true
            }

            request.put(TASK_CREATE_URL, requestBody, function (err, response, body) {
                if (err) {
                    console.error("LocusService::createTask::Error attempting to create task for order = ", orderId);
                    return reject(err);
                };

                if (response.statusCode !== 200) {
                    console.error("LocusService::createTask::Failed to create task ", response.statusCode);
                    return reject(response);
                };

                // console.debug("LocusService::createTask::Task created successfully", response);
                resolve(body);
            });
        });
    };

    getTask(taskId) {
        return new Promise((resolve, reject) => {
            const GET_TASK_URL = `${this.TASK_GET_URL}/${taskId}`;
            const requestBody = {
                auth: this.auth,
                json: true
            };

            request.get(GET_TASK_URL, requestBody, function (error, response, body) {
                if (error) {
                    console.error("LocusService::getTask::Error attempting to fetch task = ", taskId);
                    return reject(err);
                };

                if (response.statusCode !== 200) {
                    console.error("LocusService::getTask::Failed to fetch task ", response.statusCode);
                    return reject(response);
                };

                // console.debug("LocusService::getTask::Task fetched successfully", response);
                resolve(body);
            });
        });
    };

    getTrackLink(locusTask) {
        let response = { pickUpTrackLink: undefined, dropTrackLink: undefined };
        if (locusTask && locusTask.hasOwnProperty("taskGraph")) {
            const { taskGraph } = locusTask;
            const { visits } = taskGraph;
            const [pickUpVisit, dropVisit] = visits;
            response.pickUpTrackLink = pickUpVisit["trackLink"];
            response.dropTrackLink = dropVisit["trackLink"];
        };
        return response;
    };

    cancelTask(taskId) {
        return new Promise((resolve, reject) => {
            const url = this.GET_CANCEL_TASK_URL(taskId);
            const status = Enums.Locus.TASK_STATUS.CANCELLED;
            const triggerTime = new Date();
            const requestBody = {
                auth: this.auth,
                body: { status, triggerTime },
                json: true
            };

            request.post(url, requestBody, function (err, response, body) {
                if (err) {
                    console.error("LocusService::cancelTask:: Failed to cancel task. Task ID = ", taskId);
                    return reject(err);
                };

                if (response.statusCode !== 200) {
                    console.error("LocusService::cancelTask:: Response failed with non-200 response", response.statusCode);
                    return reject(err);
                };

                console.debug("LocusService::cancelTask:: Task cancelled successfully. Task ID = ", taskId);
                resolve(body);
            });
        });
    };
};

module.exports = LocusService;
