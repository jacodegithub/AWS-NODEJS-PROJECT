const mongoose = require('mongoose');
const connectionOptions = { useCreateIndex: true, useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false };
mongoose.connect(process.env.MONGO_URL , connectionOptions);
mongoose.Promise = global.Promise;

const User = require('./../Models/UserModel');
const BussinessUser = require('users/bussinessuser.model');
const Trader = require('./../Models/TraderModel');
const RefreshToken = require('./../Models/refresh-token.model');

if (process.env.ENVIRONMENT === "local") {
    mongoose.set('debug', true);
};

mongoose.connection.on("connected", () => {
    console.log("Order Database is connected");
});

module.exports = {
    User,
    BussinessUser,
    Trader,
    RefreshToken,
    isValidId
};

function isValidId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}