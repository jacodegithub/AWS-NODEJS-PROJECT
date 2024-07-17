const joi = require('@hapi/joi');
const Enums = require('./../_helpers/Enums');
const { validateRequestQuery, validateRequestBody } = require('./commonValidators');

module.exports = {
    newOrderRequest,
    getEstimateRequest,
    fetchOrderRequest,
    apiNewOrderRequest,
    checkoutRequest,
    updateOrder,
    updateOrderPayment
};

function newOrderRequest(req, res, next) {
    const schema = joi.object({
        categoryId: joi.string().default(Enums.Products.Categories.misc),
        deliveryMethod: joi.string().valid(Enums.DeliveryMethod.REGULAR, Enums.DeliveryMethod.SECURE).default(Enums.DeliveryMethod.SECURE),
        isInsured: joi.boolean().default(false),
        orgLat: joi.number().required(),
        orgLng: joi.number().required(),
        destLat: joi.number().optional(),
        destLng: joi.number().optional(),

        senderName: joi.string().optional(),
        senderAdd: joi.string().optional(),
        senderFlat: joi.string().optional().allow(""),
        senderBuilding: joi.string().optional().allow(""),
        senderContact: joi.string().optional(),

        receiverName: joi.string().optional(),
        receiverAdd: joi.string().optional(),
        receiverFlat: joi.string().optional().allow(""),
        receiverBuilding: joi.string().optional().allow(""),
        receiverContact: joi.string().optional(),

        promoCode: joi.string().optional(),
        insuranceAmount: joi.number().optional().min(1),
        alreadyInsured:joi.boolean().default(false),
        paymentType:joi.string().default(Enums.PaymentType.onDemand).valid(...Object.values(Enums.PaymentType)).optional(),
        sendLinkTo:joi.string().optional(),
        orderType: joi.string().default(Enums.Order.Type.delivery).valid(Enums.Order.Type.delivery, Enums.Order.Type.product),
        item: joi.object({
            itemId: joi.string().optional(),
            quantity: joi.number().optional(),
            traderId: joi.string().optional(),
            quote: joi.number().optional(),
            expiryTime: joi.string().optional(),
            checksum: joi.string().optional(),
        })
    });

    const options = {
        abortEarly: false,
        allowUnknown: true
    };

    const { error, value } = schema.validate(req.body, options);
    if (error) {
        next(`Validation error: ${error.details.map(x => x.message).join(', ')}`);
    } else {
        req.body = value;
        next();
    };
};

function getEstimateRequest(req, res, next) {
    const schema = joi.object({
        origins: joi.array().items(joi.number().required()),
        destinations: joi.array().items(joi.number().required())
    })

    const { error, value } = schema.validate(req.query, { allowUnknown: true});
    if (error) {
        next(`Validation error: ${error.details.map(x => x.message).join(', ')}`);
    } else {
        req.query = value;
        next();
    }
};

function checkoutRequest(req, res, next) {
    const schema = joi.object({
        orgLat: joi.number().required(),
        orgLng: joi.number().required(),
        destLat: joi.number().required(),
        destLng: joi.number().required(),
        promoCode: joi.string().optional(),
        insuranceAmount: joi.number().optional().min(1),
        alreadyInsured:joi.boolean().default(false),
        paymentType:joi.string().default(Enums.PaymentType.onDemand).valid(Enums.PaymentType.onDemand,Enums.PaymentType.wallet, Enums.PaymentType.credit, Enums.PaymentType.postPay).optional(),
        orderType: joi.string().default(Enums.Order.Type.delivery).valid(Enums.Order.Type.delivery, Enums.Order.Type.product),
    })

    validateRequestBody(next,req,schema,{allowUnknown: true})
};

function fetchOrderRequest(req, res, next) {
    const schema = joi.object({
        page: joi.number().min(1).default(1),
        limit: joi.number().min(0).default(1).max(10),
        status: joi.array().items(joi.string()
        .valid(
            Enums.Order.Status.created,
            Enums.Order.Status.pending, 
            Enums.Order.Status.ongoing, 
            Enums.Order.Status.completed, 
            Enums.Order.Status.cancelled, 
            Enums.Order.Status.failure,
            Enums.Order.Status.booked,
        ))
    });
    validateRequestQuery(next, req, schema);
};

function apiNewOrderRequest(req, res, next) {
    const schema = joi.object({
        categoryId: joi.string().default(Enums.Products.Categories.misc),
        deliveryMethod: joi.string().valid(Enums.DeliveryMethod.REGULAR, Enums.DeliveryMethod.SECURE).default(Enums.DeliveryMethod.SECURE),
        isInsured: joi.boolean().default(false),
        orgLat: joi.number().optional().min(0).allow(null),
        orgLng: joi.number().optional().min(0).allow(null),
        destLat: joi.number().optional().min(0).allow(null),
        destLng: joi.number().optional().min(0).allow(null),

        senderName: joi.string().optional(),
        senderAdd: joi.string().required(),
        senderFlat: joi.string().optional().allow(""),
        senderBuilding: joi.string().optional().allow(""),
        senderContact: joi.string().required(),

        receiverName: joi.string().optional(),
        receiverAdd: joi.string().required(),
        receiverFlat: joi.string().optional().allow(""),
        receiverBuilding: joi.string().optional().allow(""),
        receiverContact: joi.string().required(),

        promoCode: joi.string().optional(),
        insuranceAmount: joi.number().optional().min(1),
        alreadyInsured:joi.boolean().default(false),
        paymentType: joi.string().valid(Enums.PaymentType.wallet, Enums.PaymentType.credit).default(Enums.PaymentType.wallet)
    });

    const options = {
        abortEarly: false,
        allowUnknown: true
    };

    const { error, value } = schema.validate(req.body, options);
    if (error) {
        next(`Validation error: ${error.details.map(x => x.message).join(', ')}`);
    } else {
        req.body = value;
        next();
    };
};

function updateOrder(req,res,next){
    const schema = joi.object({
        destLat: joi.number().optional().min(0).allow(null),
        destLng: joi.number().optional().min(0).allow(null),
        receiverName: joi.string().optional(),
        receiverAdd: joi.string().optional(),
        receiverFlat: joi.string().optional().allow(""),
        receiverBuilding: joi.string().optional().allow(""),
        receiverContact: joi.string().optional(),
        item: joi.object({
            status: joi.string().optional().valid(...Object.values(Enums.bullionOrderStatus)),
            payment: joi.object({
                paymentRef: joi.string().optional()
            })
        }).optional()
    });

    const options = {
        abortEarly: false,
        allowUnknown: false
    };

    const { error, value } = schema.validate(req.body, options);
    if (error) {
        next(`Validation error: ${error.details.map(x => x.message).join(', ')}`);
    } else {
        req.body = value;
        next();
    };
}

function updateOrderPayment(req,res,next){
    const schema = joi.object({
        item: joi.object({
            status: joi.string().optional().valid(...Object.values(Enums.bullionOrderStatus)),
            payment:joi.object({
                paymentRef: joi.string().optional()
            })
        })
    });

    const options = {
        abortEarly: false,
        allowUnknown: false
    };

    const { error, value } = schema.validate(req.body, options);
    if (error) {
        next(`Validation error: ${error.details.map(x => x.message).join(', ')}`);
    } else {
        req.body = value;
        next();
    };
}
