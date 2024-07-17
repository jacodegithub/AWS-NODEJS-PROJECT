const Enum = require('./../_helpers/Enums');
const OrderModel = require("./../Models/OrderModel");
//const LocusService = new (require("./LocusService"))();
const EmailService = new (require("./EmailService"))();
const CouponService = new (require("./CouponsService"))();
const orderService = require('./orders_service');
const bullionService = require('../services/BullionService')
const firebaseService = require('./fireBaseService');
const Enums = require('./../_helpers/Enums');
const UserService = new (require('./UserService'))();
const TookanService = new (require("./TookanService"))();
const DeviceService = new (require("./DeviceService"))();
const InvoiceService = require("./InvoiceService");
const WhatsappService = new (require("./WhatsappService"))();
const logger = require("../_helpers/logger");
const WalletTransactionModel = require('../Models/WalletTransactionModel');
const CompanyService = new (require('./CompanyService'))();
const WalletService = require("./wallet_service");
const insuranceService = require('../services/insuranceService');
const config = require('../config.json')
const reportingEmails = config.reportingEmails

module.exports = {
    handleTookanTaskUpdate,
    handleRazorpayWebhook,
    handleTraderOrderUpdate,
    checkAndNotifyInsuranceThresholdBreach,
    //it is not actually a webhook, but put it here for code consistency
    handleWalletWebhook
}

/**
 * Fetch 
 * @param {*} request
 * eventType   
 *  . type Allowed Values: TASK_STATUS_UPDATE, TASK_ETA_UPDATE, TASK_PAYMENT_UPDATE, TASK_LINE_ITEM_TRANSACTION_UPDATE
 * task
 *  . clientId
 *  . taskId
 *  . status
 *      . status: Allowed Values: RECEIVED, WAITING, ACCEPTED, STARTED, COMPLETED, CANCELLED, ERROR
 *      . triggerTime
 *      .assignedUser
 *  . assignedUser
 *  . statusUpdates
 *      . status
 * timestamp 
 * @param {*} response 202
 */
function handleTookanTaskUpdate(request) {
    if (!request || !request.hasOwnProperty("template_key") || !request.hasOwnProperty("task_state")) {
        logger.error("WebhookService::handleTookanTaskUpdate::No data received = ");
        return;
    };

    const { template_key, task_state, order_id, full_tracking_link, fleet_id } = request;
    const type = template_key;

    logger.debug("WebhookService::handleLocusTaskUpdate:: task status update");
    handleTaskStatusUpdate(type, order_id, full_tracking_link, task_state, fleet_id);

};

// @TODO: Split this function to seperate file
async function updateOrder(query, update_query) {
    try {
        const updatedOrder = await OrderModel.findOneAndUpdate(query, update_query, { new: true });
        if (!updatedOrder || !updatedOrder._id) throw { "message": "Failed to update order", "errors": [{ updatedOrder }] };
        // logger.debug("WebhookService::updateOrder: document updated", updated);
        return updatedOrder;
    } catch (err) {
        logger.error(JSON.stringify(err))
        logger.error("WebhookService::updateOrder::document failed to update", err);
        throw { "status": 500 };
    };
};

async function updateWalletTransaction(query, update_query) {
    try {
        const updatedTransaction = await WalletTransactionModel.findOneAndUpdate(query, update_query, { new: true });
        if (!updatedTransaction || !updatedTransaction._id) throw { "message": "Failed to update wallet transaction", "errors": [{ updatedTransaction }] };
        // logger.debug("WebhookService::updateOrder: document updated", updated);
        return updatedTransaction;
    } catch (err) {
        logger.error("WebhookService::walletTransaction::document failed to update", err);
        throw { "status": 500 };
    };
};

function updateTaskWithStatusRequest(status) {
    return {
        "$set": { "tracking.currentTaskStatus": status },
        "$addToSet": { "tracking.statusMarked": status }
    };
};

function handleTaskStatusUpdate(status, orderId, full_tracking_link, taskState, fleet_id) {
    manageTaskStatusUpdateLifecycle(status, orderId, full_tracking_link, taskState, fleet_id)
        .catch((e) => {/** do nothing */ });
};

async function manageTaskStatusUpdateLifecycle(status, orderId, full_tracking_link, taskState, fleet_id) {
    //const { taskId, status } = task;
    const query = { orderId: orderId }
    const _status = status;

    const orderPlaced = await orderService.findOne(query);
    if (!orderPlaced || !orderPlaced._id) {
        logger.error(`WebhookService::manageTaskStatusUpdateLifecycle:: Status ${_status}:: Order not found. Order = ${orderId}`);
        return;
    }
    const { userId } = orderPlaced;
    if (!userId) {
        logger.error(`WebhookService::manageTaskStatusUpdateLifecycle:: Status ${_status}:: User not found. Order = ${orderId}`);
    }
    const orderCreator = await UserService.findOne({ "_id": userId });
    if (!orderCreator || !orderCreator._id || !orderCreator.email) {
        logger.error(`WebhookService::manageTaskStatusUpdateLifecycle:: Status ${_status}:: User not found. Order = ${orderId}`);
    }
    const userEmail = orderCreator.email;

    switch (_status) {
        case Enum.Tookan.Template.REQUEST_RECEIVED: {
            notifyOrderCreatorWithTrackLinks(userEmail, orderId, full_tracking_link);
            await firebaseService.triggerNotificationToUser(userId, "Request Received", "We have received your request. A rider will be assigned shortly.")
            break;
        };

        case Enum.Tookan.Template.REQUEST_ACCEPTED: {
            await notifyRider(orderId);
            if (orderPlaced.orderType === Enums.Order.Type.product) {
                // TODO: send correct order status depending on the orderType.
                // We have hardcoded  to send Enums.Order.Status.ongoing
                bullionService.sendNotificationOnStatusChange(orderId, Enums.Order.Status.ongoing)
            }
            break;
        };
        case Enum.Locus.TASK_STATUS.WAITING: {
            break;
        };

        case Enum.Locus.TASK_STATUS.ACCEPTED: {
            break;
        };

        case Enum.Tookan.Template.AGENT_STARTED: {
            let updateQuery = {
                orderStatus: Enums.Order.Status.ongoing,
                ...updateTaskWithStatusRequest(_status)
            };
            await updateOrder(query, updateQuery);
            await startDeviceTransaction(orderId, fleet_id);
            await firebaseService.triggerNotificationToUser(userId, "Rider Assigned", "Your order has been assigned to a rider. He is on his way to the pickup location.")
            break;
        };

        case Enum.Tookan.Template.SUCCESSFUL: {
            //Task Status is Successful in Pickup Success and Delivery Success
            //taskState is Successfull in Delivery success, so mark order complete if delivery is success
            if (taskState === Enum.Tookan.Template.SUCCESSFUL) {
                let updateQuery = {
                    orderStatus: Enums.Order.Status.completed,
                    ...updateTaskWithStatusRequest(_status)
                };
                await updateOrder(query, updateQuery);
                //await updateWalletWithMargin(userId,orderId);
                if (orderPlaced.orderType === Enums.Order.Type.product) {
                    await WalletService.addCashback(orderId);
                }
                else {
                    await InvoiceService.createAndSendInvoice(orderId)
                        .catch((err) => {
                            logger.error(`WebhookService::DeliverySuccess::SendInvoice:: Error sending invoice. Error = ${err}`);
                            EmailService.send(process.env.ADMIN_EMAIL, "Error sending invoice", undefined, "Error sending zoho invoice")
                                .catch((err) => {
                                    logger.error(`WebhookService::DeliverySuccess::SendInvoice:: Error sending error email. Error = ${err}`);
                                });
                        });
                }
                await firebaseService.triggerNotificationToUser(userId, "Drop Complete", "Your order has been delivered successfully! Hope that you had a great experience, please leave a review for us on Google/PlayStore/AppStore.");
            }
            else {
                const { insurance } = orderPlaced
                if (!insurance.alreadyInsured && insurance.selected) {
                    await insuranceService.increaseUsedAmount(insurance.amount)
                }
                await checkAndNotifyInsuranceThresholdBreach()
                await firebaseService.triggerNotificationToUser(userId, "Pickup Complete", "Your order has been picked up successfully. The delivery executive is on his way to the drop location, please ensure that the recipient is available to receive the parcel")
            }
            break;
        };

        // case Enum.Locus.TASK_STATUS.CANCELLED: {
        //     let updateQuery = { 
        //         orderStatus: Enums.Order.Status.cancelled,
        //         ...updateTaskWithStatusRequest(_status)
        //     };
        //     await updateOrder(query, updateQuery);
        //     // logger.info("WebhookService::manageTaskStatusUpdateLifecycle:: `cancelled` status");
        //     break;
        // };

        case Enum.Tookan.Template.FAILED: {
            let updateQuery = {
                orderStatus: Enums.Order.Status.failure,
                ...updateTaskWithStatusRequest(_status)
            };
            await updateOrder(query, updateQuery);
            // logger.info("WebhookService::manageTaskStatusUpdateLifecycle:: `error` status");
            break;
        };

        default: {
            logger.info("WebhookService::manageTaskStatusUpdateLifecycle:: Unhandled status transition = ", _status);
        };
    };
};

async function checkAndNotifyInsuranceThresholdBreach() {
    try {
        const insuranceUsageData = await insuranceService.getInsuranceUsageCount()
        const { insuranceAmount, usedAmount, alertThreshold } = insuranceUsageData
        const usage = usedAmount / insuranceAmount * 100
        if (usage > alertThreshold) {
            notifyInsuranceThresholdBreach(usedAmount, insuranceAmount)
        }
    } catch (error) {
        logger.error(error)
    }
}

async function notifyInsuranceThresholdBreach(usedAmount, insuranceAmount) {
    const subject = 'URGENT | Insurance Usage Threshold Reached'
    let text = "Dear Team, \n";
    text += "We have breached the the threshold for insurance amount usage. Following are the details: \n";
    text += "\n usedAmount: " + usedAmount;
    text += "\n insuranceAmount: " + insuranceAmount
    text += "\n\n\n\n\n This email is auto generated, please do not reply."

    logger.info('Insurance Amount threshold reached!')
    EmailService.send(reportingEmails, subject, '', text)
}

function handleTaskPaymentUpdate() { };

function handleTaskETAUpdate() { };

/**   ---------- Razorpay webhook update methods --------- */

/**
 * @TODO Ideally, put this into a persistent queue
 * The database WILL fail. The service WILL crash. 
 * To handle payments consistently ensure they are persistent and queued to be processed 
 * @param {*} webhookBody 
 * - account_id
 * - contains
 * - entity
 * - event
 * - payload
 *   - payment
 *     - entity
 *       - acquirer_data
 *       - amount
 *       - amount_refunded
 *       - captured
 *       - id
 *       - method <payment method>
 *       - status
 * 
 */
function handleRazorpayWebhook(webhookBody) {
    // logger.debug("WebhookService::handleRazorpayWebhook:: Body received = ", webhookBody);
    const { event, payload } = webhookBody;
    const { payment } = payload;
    const { entity } = payment;
    const { notes } = entity;
    const { paymentType } = notes;

    switch (event) {
        case Enum.Razorpay.Webhooks.payment_captured: {
            if (paymentType === Enums.PaymentType.wallet) {
                handleWalletPaymentAsCaptured(entity);
            }
            else {
                handlePaymentAsCaptured(entity);
            }
            break;
        };

        case Enum.Razorpay.Webhooks.payment_failed: {
            if (paymentType === Enums.PaymentType.wallet) {
                handleWalletPaymentAsFailure(entity);
            }
            else {
                handlePaymentAsFailure(entity);
            }
            break;
        };

        // case Enum.Razorpay.Webhooks.payment_authorized: {
        // };

        default: {
            logger.error("WebhookService::handleRazorpayWebhook:: Illegal  razorpay event = ", event);
            break;
        };
    }
};

function handleWalletWebhook(webhookBody) {

    const { event, entity } = webhookBody;

    switch (event) {
        case Enum.Razorpay.Webhooks.payment_captured: {
            handlePaymentAsCaptured(entity);
            break;
        };

        case Enum.Razorpay.Webhooks.payment_failed: {
            handlePaymentAsFailure(entity);
            break;
        };

        case Enum.Razorpay.Webhooks.payment_postPay: {
            handlePaymentAsCaptured(entity, Enums.Razorpay.status.pending);
            break;
        }

        // case Enum.Razorpay.Webhooks.payment_authorized: {
        // };

        default: {
            logger.error("WebhookService::handleWalletWebhook:: Illegal  wallet event = ", event);
            break;
        };
    }
};

function sendPaymentConfirmationMail(paymentId, locusTaskAck) {
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const subject = "Payment captured";
    let text = "";
    text += "This mail is auto generated \n";
    text += `An order ( id = ${paymentId} was captured from razorpay \n`;
    text += `A locus task was attempted. Task created is: ${locusTaskAck}`;

    EmailService.send(ADMIN_EMAIL, subject, undefined, text)
        .catch(() => {/** Do nothing */ });
};

function sendPaymentFailureMail(paymentId) {
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const subject = "Payment failure";
    let text = "";
    text += "This mail is auto generated \n";
    text += `An order ( id = ${paymentId}) failed to be captured`;

    EmailService.send(ADMIN_EMAIL, subject, undefined, text)
        .catch(() => {/** Do nothing */ });
};

function notifyOrderCreatorWithTrackLinks(email, orderId, full_tracking_link) {
    //const { pickUpTrackLink, dropTrackLink } = LocusService.getTrackLink(locusTask);        
    const subject = `Gordian - Order Confirmed - Track your order`;
    // let text = "";
    // text += "This mail is auto generated \n";
    // text += "You can track your order using the below links \n";
    // text += "Pickup Link: " + pickUpTrackLink + "\n";
    // text += "Drop Link: " + dropTrackLink + "\n";

    const html =
        `<div style="text-align: center; margin-bottom: 10px; background-color: rgb(251, 251, 251);">
        <img src="cid:HeaderLogo.png" alt="Logo" style="width: 20%" />
    </div>
    <center>
        <div style="text-align: left; width: 60%; line-height: 27px">
            <font style="color: #008863">
            Thank you for choosing Gordian to secure your delivery. Your delivery is confirmed and the delivery executive is on his way. 

            You can find the details of the order and the tracking links below <br /><br />
            Please track your order here: ${full_tracking_link} 

            For any support, contact us on support@gordian.in or reach us at +91 8762918529
        </div>
    </center>
    <div style="background-color: rgb(251, 251, 251);">
        <center>
            <div style="width: 60% ; text-align: left ; padding-top: 20px;">
                <a href="https://www.instagram.com/gordian.technologies/" target="_blank">
                    <img src="cid:Instagram.png" alt="Instagram" style="width: 3% ; margin-right: 10px">
                </a>
                <a href="https://www.linkedin.com/company/gordian-technologies-private-limited/" target="_blank">
                    <img src="cid:linkedin.png" alt="linkedin" style="width: 3%;">
                </a>
                <br /><br />
                Gordian Technologies Pvt. Ltd.<br />
                <a href="mailto:support@gordian.in">support@gordian.in</a>
            </div>
        </center>
    </div>`;

    const attachments = [{
        filename: "Logo.png",
        path: __dirname + "/images/Logo.png",
        cid: "HeaderLogo.png",
    }, {
        filename: "Instagram.png",
        path: __dirname + "/images/Instagram.png",
        cid: "Instagram.png",
    }, {
        filename: "linkedin.png",
        path: __dirname + "/images/linkedin.png",
        cid: "linkedin.png",
    }];

    EmailService.send(email, subject, html, undefined, attachments)
        .catch(() => {
            logger.error("WebhookService::notifyOrderCreatorWithTrackLinks::Failed to trigger track link emails for orderId = ", orderId);
        });
};

async function notifyRider(orderId) {
    try {
        const task = await TookanService.getTaskFromOrderId(orderId);
        const pickup_job_id = task.data[0].job_id;
        //const delivery_job_id = task.data[1].job_id
        const fleet_id = task.data[0].fleet_id;
        TookanService.getAgentProfile(fleet_id)
            .then(async (agent) => {
                const phone = agent.data.fleet_details[0].phone;
                const order = await OrderModel.findOne({ orderId: orderId });
                const senderLocation = {
                    lat: order.senderLocation.lat,
                    long: order.senderLocation.lng,
                };
                const receiverLocation = {
                    lat: order.receiverLocation.lat,
                    long: order.receiverLocation.lng,
                };
                const { senderFlat, senderBuilding, senderAdd } = order
                const { receiverFlat, receiverBuilding, receiverAdd } = order

                const senderAddress = [senderFlat, senderBuilding, senderAdd].filter(Boolean).join(", ");
                const receiverAddress = [receiverFlat, receiverBuilding, receiverAdd].filter(Boolean).join(", ");
                //send whatsapp msg
                WhatsappService.sendLocationToRider(
                    orderId,
                    phone,
                    senderAddress,
                    senderLocation,
                    receiverAddress,
                    receiverLocation,
                    pickup_job_id
                );
            })
            .catch((err) => {
                logger.error(
                    "WebhookService::notifyRider::getAgentProfile::Error fetching agent profile = ",
                    err
                );
            });
    } catch (err) {
        logger.error(
            "WebhookService::HandlePaymentAsCaptured::Error on task = ",
            err
        );
    }
}

async function notifyCompanyUsers(amount, companyId) {
    try {
        const users = await UserService.find({
            "GST.companyId": companyId,
        });
        const phones = users.map((c) => c.phonenumber);
        //send whatsapp msg
        WhatsappService.notifyForWalletRecharge(phones, amount);
    } catch (err) {
        logger.error(
            "WebhookService::HandlePaymentAsCaptured::Error on task = ",
            err
        );
    }
}

function handlePaymentAsCaptured(webhookPayload, paymentStatus = Enum.Razorpay.status.captured) {
    const { id, order_id, method, notes } = webhookPayload;
    //const query = { "payment.orderId": order_id };
    const { orderId } = notes;
    let locusTaskCreated = false;
    const query = { "orderId": orderId };

    // Add a task to Locus
    update_query = {
        "$set": {
            "payment.paymentId": id,
            "payment.status": paymentStatus,
            "payment.method": method,
            "payment.orderId": order_id,
            "orderStatus": Enum.Order.Status.pending
        }
    };

    updateOrder(query, update_query)
        .then(async (updatedOrder) => {
            // Update the coupon usage by one
            const { userId, promoCode } = updatedOrder;
            CouponService.incrementCouponUse(promoCode);

            if (process.env.ENVIRONMENT !== Enum.Environment.Development) {
                const { payment, amount } = updatedOrder;
                const { paymentType } = payment;
                if (paymentStatus === Enum.Razorpay.status.captured && paymentType === Enums.PaymentType.postPay) {
                    if (paymentType === Enums.PaymentType.postPay) {
                        return TookanService.getTaskFromOrderId(orderId)
                            .then(async (task) => {
                                const pickup_job_id = task.data[0].job_id
                                const delivery_job_id = task.data[1].job_id
                                const fleet_id = task.data[0].fleet_id
                                TookanService.updateTaskPaymentStatus(pickup_job_id, paymentType, paymentStatus)
                                    .then(async () => {
                                        TookanService.updateTaskPaymentStatus(delivery_job_id, paymentType, paymentStatus)
                                            .then(async () => {
                                                TookanService.getAgentProfile(fleet_id)
                                                    .then(async (agent) => {
                                                        //send whatsapp msg
                                                        WhatsappService.notifyPaymentReceivedToAgent(amount, agent.data.fleet_details[0].phone);
                                                    })
                                                    .catch((err) => {
                                                        logger.error("WebhookService::HandlePaymentAsCaptured::postPay::Error fetching agent profile = ", err);
                                                    })
                                            }).catch((err) => {
                                                logger.error("WebhookService::HandlePaymentAsCaptured::postPay::Error updating tookan payment status = ", err);
                                            })
                                    }).catch((err) => {
                                        logger.error("WebhookService::HandlePaymentAsCaptured::postPay::Error updating tookan payment status = ", err);
                                    })
                            }).catch((err) => {
                                logger.error("WebhookService::HandlePaymentAsCaptured::postPay::Error fetching tookan task = ", err);
                            })
                    }
                }
                else {
                    return TookanService.createTask(updatedOrder)
                        .then(async () => {
                            locusTaskCreated = true;
                            const subject = "Gordian - New Order";
                            const existingUser = await UserService.findOne({ "_id": userId });
                            const promo = await CouponService.findOne({ "_id": promoCode });
                            const { html, attachments } = generateOrderConfirmationHTML(updatedOrder, existingUser, promo);
                            EmailService.send(existingUser.email, subject, html, undefined, attachments, process.env.ADMIN_EMAIL);
                        });
                }
            }
        }).catch((err) => {
            logger.error(JSON.stringify(err))
            logger.error("WebhookService::HandlePaymentAsCaptured::Failed to create Locus task = ", err);
            /** Do nothing */
        })
        .finally(() => {
            if (paymentStatus = Enum.Razorpay.status.captured)
                sendPaymentConfirmationMail(id, locusTaskCreated);
        });
};
function handleWalletPaymentAsCaptured(webhookPayload) {
    //update user's company wallet
    const { id, order_id, method, notes } = webhookPayload;
    const { orderId } = notes;
    const query = { "transactionId": orderId };

    // Add a task to Locus
    update_query = {
        "$set": {
            "payment.paymentId": id,
            "payment.status": Enum.Razorpay.status.captured,
            "payment.method": method,
            "payment.orderId": order_id
        }
    };

    updateWalletTransaction(query, update_query)
        .then(async (updatedTransaction) => {
            const companyId = updatedTransaction.companyId;
            const amount = updatedTransaction.amount
            await WalletService.addNewWalletForCompany(amount, companyId)
            const users = await UserService.find({ "GST.companyId": companyId });
            const emails = users.map((c) => c.email);
            //const { email } = await UserService.findOne({ _id: updatedTransaction.userId });
            const { html, attachments } = generateWalletConfirmationHTML(updatedTransaction);
            const subject = "Gordian - Wallet recharge Success";
            EmailService.send(emails, subject, html, undefined, attachments, process.env.ADMIN_EMAIL);
            await notifyCompanyUsers(amount, companyId);
        })
        .catch((err) => {
            logger.error("WebhookService::HandleWalletPaymentAsCaptured::Error =", err);
            EmailService.send(process.env.ADMIN_EMAIL, "Error in WebhookService HandleWalletPaymentAsCaptured", undefined, err);
        });
}
function handlePaymentAsFailure(webhookPayload) {
    const { id, method, notes } = webhookPayload;
    const { orderId } = notes;
    const query = { "orderId": orderId };
    const update_query = {
        "$set": {
            "payment.status": Enum.Razorpay.status.failure
        },
        "$push": {
            "payment.failedPayments": {
                id,
                method
            }
        }
    };

    updateOrder(query, update_query)
        .catch(() => {/** Do nothing **/ })
        .finally(() => {
            sendPaymentFailureMail(id)
        })
};
function handleWalletPaymentAsFailure(webhookPayload) {
    const { id, method, notes } = webhookPayload;
    const { orderId } = notes;
    const query = { "transactionId": orderId };
    const update_query = {
        "$set": {
            "payment.status": Enum.Razorpay.status.failure
        },
        "$push": {
            "payment.failedPayments": {
                id,
                method
            }
        }
    };

    updateOrder(query, update_query)
        .catch(() => {/** Do nothing **/ })
        .finally(() => {
            sendPaymentFailureMail(id)
        })
};
function generateOrderConfirmationHTML(newOrder, user = {}, promoCode) {
    const { insurance, payment } = newOrder;
    const isInsured = !insurance.alreadyInsured;
    const { paymentType } = payment;
    const paymentText = (paymentType === Enums.PaymentType.postPay) ? "PostPaid" : "PrePaid";
    var html = `
    <div style="text-align: center;margin-bottom: 10px;background-color: rgb(251, 251, 251);">
        <img src="cid:HeaderLogo.png" alt="Logo" style="width: 20%" />
    </div>
    <center>
        <div style="text-align: left; width: 60%; line-height: 27px">
            <br />
                Name :${user.fullName}<br />
                Email Id: ${user.email}<br />
                Contact No: ${user.phonenumber}<br />

                Sender's Address: ${newOrder.senderAdd}<br />   
                Sender's Contact No: ${newOrder.senderContact}<br />

                Receiver's Address: ${newOrder.receiverAdd}<br />
                Receiver's Contact: ${newOrder.receiverContact}<br />
                Payment Type: ${paymentText}<br />
                ${promoCode ? "Promo Code: " + promoCode.id + "<br />" : ""}`;


    if (user.role === 'Bussiness') {
        html += `Invoice Value: ${newOrder.currency} ${insurance.amount || "N/A"}<br />
                Insurance applied: ${isInsured ? "Yes" : "No"}<br />
                Total amount paid: ${newOrder.currency} ${newOrder.amount}`;
    }
    else {
        html += `Total amount paid: ${newOrder.currency} ${newOrder.amount}`;
    }

    html += `<br /><br /></div>
    </center>
    <div style="background-color: rgb(251, 251, 251);">
        <center>
            <div style="width: 60% ; text-align: left ; padding-top: 20px;">
                <a href="https://www.instagram.com/gordian.technologies/" target="_blank">
                    <img src="cid:Instagram.png" alt="Instagram" style="width: 3% ; margin-right: 10px">
                </a>
                <a href="https://www.linkedin.com/company/gordian-technologies-private-limited/" target="_blank">
                    <img src="cid:linkedin.png" alt="linkedin" style="width: 3%;">
                </a>
                <br /><br />
                Gordian Technologies Pvt. Ltd.<br />
                <a href="mailto:support@gordian.in">support@gordian.in</a>
            </div>
        </center>
    </div>`;

    const attachments = [{
        filename: "Logo.png",
        path: __dirname + "/images/Logo.png",
        cid: "HeaderLogo.png",
    }, {
        filename: "Instagram.png",
        path: __dirname + "/images/Instagram.png",
        cid: "Instagram.png",
    }, {
        filename: "linkedin.png",
        path: __dirname + "/images/linkedin.png",
        cid: "linkedin.png",
    }];
    return { html, attachments };
};
function generateWalletConfirmationHTML(transaction) {
    const { amount, userId, companyId } = transaction;
    var html = `
    <div style="text-align: center;margin-bottom: 10px;background-color: rgb(251, 251, 251);">
        <img src="cid:HeaderLogo.png" alt="Logo" style="width: 20%" />
    </div>
    <center>
        <div style="text-align: left; width: 60%; line-height: 27px">
            <br />
                Amount of INR ${amount} added to your company wallet`
    html += `<br /><br /></div>
    </center>
    <div style="background-color: rgb(251, 251, 251);">
        <center>
            <div style="width: 60% ; text-align: left ; padding-top: 20px;">
                <a href="https://www.instagram.com/gordian.technologies/" target="_blank">
                    <img src="cid:Instagram.png" alt="Instagram" style="width: 3% ; margin-right: 10px">
                </a>
                <a href="https://www.linkedin.com/company/gordian-technologies-private-limited/" target="_blank">
                    <img src="cid:linkedin.png" alt="linkedin" style="width: 3%;">
                </a>
                <br /><br />
                Gordian Technologies Pvt. Ltd.<br />
                <a href="mailto:support@gordian.in">support@gordian.in</a>
            </div>
        </center>
    </div>`;

    const attachments = [{
        filename: "Logo.png",
        path: __dirname + "/images/Logo.png",
        cid: "HeaderLogo.png",
    }, {
        filename: "Instagram.png",
        path: __dirname + "/images/Instagram.png",
        cid: "Instagram.png",
    }, {
        filename: "linkedin.png",
        path: __dirname + "/images/linkedin.png",
        cid: "linkedin.png",
    }];

    return { html, attachments };
};
async function startDeviceTransaction(order_id, fleet_id) {
    const orderPlaced = await orderService.findOne({ orderId: order_id });
    if (orderPlaced) {
        const { senderContact, receiverContact } = orderPlaced;
        TookanService.getAgentTags(fleet_id)
            .then(async (tags) => {

                const boxId = DeviceService.getBoxIdFromTags(tags.data, "box");

                DeviceService.startDeviceTransaction(boxId, order_id, senderContact, receiverContact)
                    .then((result) => {
                        return true;
                    }).catch((e) => {
                        logger.error("WebhookService::startDeviceTransaction::Error starting transaction on box = " + e.body.Message);
                        sendTransStartFailureMail(order_id, fleet_id, senderContact, receiverContact, e.body.Message);
                    });
            }).catch((e) => {
                logger.error("WebhookService::startDeviceTransaction::Error accessing tags = " + e.message);
                sendTransStartFailureMail(order_id, fleet_id, senderContact, receiverContact, e.message);
            })
    }
};
function sendTransStartFailureMail(order_id, fleet_id, senderContact, receiverContact, error) {
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const API_URL = process.env.SERVER_API_URL;
    const subject = "Error starting transaction on box";
    let text = "";
    text += `This mail is auto generated \n\n`;
    text += `Error starting transaction on box.\n`;
    text += `API URL: ${API_URL} \n`;
    text += `Order Id : ${order_id} \n`;
    text += `Fleet Id : ${fleet_id} \n`;
    text += `Sender Phone : ${senderContact} \n`;
    text += `Receiver Phone : ${receiverContact} \n`;
    text += `Error message : ${error} \n`;

    EmailService.send(ADMIN_EMAIL, subject, undefined, text)
        .catch(() => {/** Do nothing */ });
};

async function handleTraderOrderUpdate(request, response) {
    const api_key = request.header.api_key;
    const { traderId, orderId, status } = request.body;
    const trader = await TraderModel.findOne({ _id: traderId });

    // if (trader && trader.api_key == api_key) {
    //     updateOrderStatus(orderId, status);

    // }
    // else {
    //     response.status(404).json({
    //         message: "Wrong API Key"
    //     })
    // }

    return response.status(200).json({
        message: "Status Update Successful"
    })
}
// async function updateWalletWithMargin(userId,orderId){
//     try{
//         const order = await orderService.findOne({orderId: orderId});
//         if(order.orderType === Enums.Order.Type.product && order.item.marginAmount > 0)
//         {
//             const company = await UserService.findOne({_id:userId});
//             if(company.GST && company.GST.companyId){
//                 const companyId = company.GST.companyId;
//                 const marginAmount = order.item.marginAmount
//                 CompanyService.removeMarginAmountFromWallet(marginAmount,companyId)
//             }
//         }
//     }catch(e){
//         logger.error("Error adding margin amount to wallet", e)
//     }
// }
function updateOrderStatus(orderId, status) {
    // OrderModel.findOne({
    //     _id: orderId
    // }).then((order) => {
    //     order.status = status
    //     order.save().then(response.status(200).json({ "message": "Status update successful" }))
    // })

    return
}
