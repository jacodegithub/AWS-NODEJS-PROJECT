function validate(schema, data, options = {}) {
    const schemaOptions = {
        abortEarly: true,
        allowUnknown: false,
        stripUnkown: false,
        ...options
    };
    return schema.validate(data, schemaOptions);
};

function validateRequestBody(_next, _request, schema, options) {
    const { body } = _request;
    const { error, value } = validate(schema, body, options);
    if (error) {
        _next(`Validation error: ${error.details.map(x => x.message).join(', ')}`);
    } else {    
        _request.body = value;
        _next();
    };
};

function validateRequestQuery(_next, _request, schema, options = {}) {
    const { query } = _request;
    const { error, value } = validate(schema, query, options);

    if (error) {
        _next(`Validation error: ${error.details.map(x => x.message).join(', ')}`);
    } else {    
        _request.query = value;
        _next();
    };
};

module.exports = {
    validateRequestBody,
    validateRequestQuery
};
