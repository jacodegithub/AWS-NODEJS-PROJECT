const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const options = {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
};

const schema = new Schema({
    user: { 
        type: Schema.Types.ObjectId, 
        ref: 'User',
        required: true 
    },
    token: {
        type: String,
        required: true
    },
    expires: {
        type: Date,
        required: true
    },
    createdByIp: String,
    revoked: Date,
    revokedByIp: String,
    replacedByToken: String
}, options);

schema.virtual('isExpired').get(function () {
    return Date.now() >= this.expires;
});

schema.virtual('isActive').get(function () {
    return !this.revoked && !this.isExpired;
});

schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
        delete ret.id;
        delete ret.user;
    }
});

schema.index({"user": -1});
schema.index({"expires": 1}, { expireAfterSeconds: 0 });


module.exports = mongoose.model('RefreshToken', schema);