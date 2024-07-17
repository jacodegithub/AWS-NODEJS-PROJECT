const mongoose = require('mongoose');

const LatLngSchema = {
    lat: {
        type: Number,
        // required: true
    },
    lng: {
        type: Number,
        // required: true
    }
};

const MandatoryLatLngSchema = {
    lat: {
        ...LatLngSchema["lat"],
        required: true
    },
    lng: {
        ...LatLngSchema["lng"],
        required: true
    }
};

module.exports = {
    LatLngSchema,
    MandatoryLatLngSchema
};
