const bcrypt = require("bcryptjs");
const express = require("express");
const router = express.Router();
const Joi = require("@hapi/joi");
const multer = require('multer');
const _uploader = multer();
const crypto = require("crypto");
const validateRequest = require("_middleware/validate-request");
const authorize = require("_middleware/authorize");
const DTO = require('./../dto/UsersDto');
const MailService = new (require("./EmailService"))();
const UserService = new (require('./UserService'))();
const PromoService = require('./promocodes.service.js')
const OrderService = require('./orders_service.js');
const { generateAndStoreReferralCodeForUser } = require("../services/ReferralService.js");
const ObjectId = require('mongodb').ObjectID;

// routes

router.post(
  "/signup-customer",
  _uploader.array('files', 1),
  DTO.EmailPasswordRegistrationRequest,
  signupCustomer
);
router.post("/authenticate", DTO.EmailPasswordAuthenticationRequest, authenticate);

// Registration with mobile phone
router.post("/otp-sender", DTO.InitPhoneNumberRegisterORAUthRequest, OtpSender);
router.post("/otp/verify/registration", DTO.PhoneNumberOTPAuthenticationRequest, verifyOTPSentToPhone)
router.post(
  "/signup-customer-with-opt",
  _uploader.array('files', 1),
  DTO.PhoneNumberOTPRegistrationRequest,
  signupCustomerWithOtp
);

router.get('/getAllorders', getAllOrders);

// Authentication with mobile phone
router.post("/otp-sender-login", DTO.InitPhoneNumberRegisterORAUthRequest, OtpSenderLogin);
router.post("/authenticate-with-otp", DTO.PhoneNumberOTPAuthenticationRequest, authenticateWithOpt);

router.post("/refresh-token", refreshToken);

// Not modded
router.post("/revoke-token", authorize(), revokeTokenSchema, revokeToken);
router.post("/reset-password", getRetsetLinks);
router.post("/new-password", getNewPassword);

// Update the user's saved address
router.get("/saved-addresses", authorize(), fetchUserSavedAddress);
router.patch("/saved-addresses", authorize(), DTO.UpdateSavedAddrRequest, updateUserSavedAddress);
router.delete("/saved-addresses", authorize(), deleteUserSavedAddress);
router.get("/get-address", authorize(), fetchUserAddress);

// fetch all promo codes
router.get("/getAllPromoCodes", authorize(), getAllPromoCodes);

// get margin for user's company
router.get("/margin", authorize(["Bussiness"]), getMargin);

// Catch all routes need to be put in the end
router.get("/:id", authorize(), getById);

// Fetch user details based on token
router.get("/", authorize(), getUserDetails);

module.exports = router;


async function getAllOrders(req, res) {
  const orders = await OrderService.find({ orderStatus: 'pending', 'payment.status': 'captured' });
  res.status(200).json({
    message: `Orders fetched, ${orders.length}`,
    orders
  })
}

async function signupCustomer(req, res, next) {
  try {
    const { body, files } = req;
    const registeredUserResponse = await UserService.register(body, files);
    const { refreshToken } = registeredUserResponse;
    setTokenCookie(res, refreshToken);
    return res.status(200).send(registeredUserResponse);

  } catch (e) {
    if (e.hasOwnProperty("status") && e.hasOwnProperty("message")) {
      const { status, ...error } = e;
      return res.status(status).send(error);
    };
    console.error("UsersController::SignUpCustomer:: Internal Server Error = ", e);
    return res.status(500).send({ "message": "Something went wrong. Please try again" });
  }
};

async function signupCustomerWithOtp(req, res, next) {
  try {
    const { body, files } = req;
    const response = await UserService.registerPhoneNumberWithOTP(body, files);
    const { refreshToken } = response;
    setTokenCookie(res, refreshToken);
    res.status(200).send(response);

  } catch (err) {
    if (err.hasOwnProperty("status")) {
      const { status, ...error } = err;
      return res.status(status).send(error);
    };
    console.error("UsersController::signupCustomerWIthOtp::Uncaught exception", err);
    return res.status(500).send({ "message": "Something went wrong. Please try again" });
  };
}

async function authenticateWithOpt(req, res, next) {
  try {
    const { body } = req;
    const { phonenumber, otp } = body;
    const response = await UserService.authenticateUsingPhone(phonenumber, otp);
    const { refreshToken } = response;
    setTokenCookie(res, refreshToken);
    return res.status(200).send(response);
  } catch (e) {
    if (e.hasOwnProperty("status")) {
      const { status, ...error } = e;
      return res.status(status).send(error);
    };
    console.error("UsersController::authenticateWithOpt::Uncaught exception", err);
    return res.status(500).send({ "message": "Something went wrong. Please try again" });
  };
};

async function authenticate(req, res, next) {
  try {
    const { body } = req;
    const { email, password } = body;
    const response = await UserService.authenticateUsingEmailPassword(
      email,
      password
    );
    const { refreshToken } = response;
    setTokenCookie(res, refreshToken);
    res.status(200).send(response);
  } catch (e) {
    if (e.hasOwnProperty("status") && e.hasOwnProperty("message")) {
      const { status, ...error } = e;
      return res.status(status).send(error);
    }
    console.error("UserController::authenticate::Unhandled exception", e);
    res.status(500).send({ message: "Something went wrong. Please try again" });
  }
}

async function refreshToken(req, res, next) {
  try {
    const { body } = req;
    const token = body.refreshToken;
    if (!token) {
      console.debug(
        "UsersController::refreshToken:: No refresh token found = ",
        token
      );
      return res.status(401).send({ message: "Invalid refresh token" });
    }
    const refreshedTokens = await UserService.refreshAccessToken(token);
    const { refreshToken } = refreshedTokens;
    setTokenCookie(res, refreshToken);
    return res.status(200).send(refreshedTokens);
  } catch (err) {
    const refreshToken = undefined;
    setTokenCookie(res, refreshToken);
    if (err && err.hasOwnProperty("status")) {
      const { status, ...error } = err;
      return res.status(status).send(error);
    }
    console.error("UserController::refreshToken::Uncaught exception = ", err);
    return res
      .status(500)
      .send({ message: "Something went wrong. Please try again" });
  }
}

function revokeTokenSchema(req, res, next) {
  const schema = Joi.object({
    token: Joi.string().empty(""),
  });
  validateRequest(req, next, schema);
}

function revokeToken(req, res, next) {
  // accept token from request body or cookie
  const token = req.body.token || req.cookies.refreshToken;
  const ipAddress = req.ip;

  if (!token) return res.status(400).json({ message: "Token is required" });

  // users can revoke their own tokens and admins can revoke any tokens
  if (!req.user.ownsToken(token)) {
    return res.status(401).json({ message: "Unauthorized3" });
  }

  UserService.revokeToken(token)
    .then(() => res.json({ message: "Token revoked" }))
    .catch(next);
}

async function getById(req, res, next) {
  // regular users can get their own record and admins can get any record
  try {
    const { params, user } = req;
    if (params.id !== user.id) {
      throw {
        status: 403,
        message: "You are not allowed to access this resource",
      };
    };
    const userInfo = await UserService.findOne({ _id: params.id });
    if (!userInfo) {
      console.error("UsersController::getByID:: Failed to find user = ", params.id, user.id);
      throw {
        status: 404,
        message: "Unable to fetch user",
      };
    }
    return res.status(200).send(user);
  } catch (e) {
    if (e.hasOwnProperty("status") && e.hasOwnProperty("message")) {
      const { status, ...error } = e;
      return res.status(status).send(error);
    }
    console.error("UserController::getById::Unhandled exception", e);
    res.status(500).send({ message: "Something went wrong. Please try again" });
  }
}

async function getMargin(req, res, next) {
  try {
    const margin = await UserService.getMargin(req.user);
    return res.status(200).json({
      margin
    })
  } catch (error) {
    console.error(error)
    next(error)
  }
}

// helper functions

function setTokenCookie(res, token) {
  // create http only cookie with refresh token that expires in 7 days
  const cookieOptions = {
    httpOnly: true,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };
  res.cookie("refreshToken", token, cookieOptions);
}

function getCryptoRandomBytes() {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(32, (err, buffer) => {
      if (err) {
        return reject(err);
      }

      resolve(buffer.toString("hex"));
    });
  });
}

async function getRetsetLinks(req, res, next) {
  try {
    const { body } = req;
    const { email } = body;

    if (!email || email.length < 1) {
      console.error("UsersController::getResetLink::Illegal value for email");
      return res.status(400).send({ message: "Invalid email ID" });
    }

    // const token = buffer.toString("hex");
    const token = await getCryptoRandomBytes();
    const user = await UserService.findOne({ email });
    if (!user) {
      console.error(
        "UsersController::getResetLink::Failed to find user = ",
        user
      );
      throw {
        status: 422,
        message: "Failed to send password reset link", // Do not allow user email enumeration
      };
    }

    user.resetToken = token;
    user.expireToken = Date.now() + 3600000;

    const subject = "password reset";
    const html = `<p>You requested for password reset</p>
                  <h5>click in this <a href="${process.env.SERVER_URL}/reset/${token}">link</a> to reset password</h5>`;

    await user.save();
    MailService.send(user.email, subject, html);
    res.json({ message: "check your email" });
  } catch (e) {
    if (e && e.hasOwnProperty("status")) {
      const { status, ...error } = e;
      return res.status(status).send(error);
    }
    console.error("UsersController::getResetLink::Uncaught exception = ", e);
    return res.status(500).send({
      message: "Something went wrong. Please try again",
    });
  }
}

function getNewPassword(req, res) {
  const newPassword = req.body.newPassword;
  const sentToken = req.body.token;
  UserService.findOne({ resetToken: sentToken })
    .then((user) => {
      if (!user) {
        return res.status(422).json({ error: "Try again session expired" });
      }
      bcrypt.hash(newPassword, 10).then((passwordHash) => {
        user.passwordHash = passwordHash;
        user.resetToken = undefined;
        user.expireToken = undefined;
        user.save().then((saveduser) => {
          res.json({ message: "password updated success" });
        });
      });
    })
    .catch((err) => {
      console.log(err);
    });
}

async function OtpSender(req, res) {
  try {
    const { body } = req;
    const { phonenumber } = body;
    const { status, ...data } = await UserService.registrationInitWithPhone(
      phonenumber
    );
    return res.status(status).send(data);
  } catch (e) {
    if (e.hasOwnProperty("status")) {
      const { status, ...error } = e;
      return res.status(status).send(error);
    }
    let message = "Something went wrong. Please try again";
    if (e.message)
      message = e.message;
    console.error("UserController::OtpSender::Uncaught error", e);
    return res
      .status(500)
      .send({ message: message });
  }
}

async function OtpSenderLogin(req, res) {
  try {
    const { body } = req;
    const { phonenumber } = body;
    const { status, ...response } = await UserService.authenticateInitWithPhone(
      phonenumber
    );
    return res.status(status).send(response);
  } catch (err) {
    if (err.hasOwnProperty("status")) {
      const { status, ...error } = err;
      return res.status(status).send(error);
    }
    let message = "Something went wrong. Please try again";
    if (err.message)
      message = err.message;
    console.error("UsersController::OTPSenderLogin::Uncaught error", err);
    return res
      .status(500)
      .send({ message: message });
  }
}

async function verifyOTPSentToPhone(request, response) {
  try {
    const { body } = request;
    const { otp, phonenumber } = body;
    const { status, ...data } = await UserService.verifyOtp(otp, phonenumber);
    return response.status(status).send(data);
  } catch (e) {
    if (e.hasOwnProperty("status") && e.hasOwnProperty("message")) {
      const { status, ...error } = e;
      return response.status(status).send(error);
    }
    console.error("UsersController::verifyOTPSentToPhone::Unhandled error", e);
    return response
      .status(500)
      .send({ message: "Something went wrong. Pleae try again" });
  }
}

async function updateUserSavedAddress(request, response) {
  try {
    const { user, body } = request;
    const { id } = user;

    const { status, ...resp } = await UserService.updateUserSavedAddress(
      id,
      body
    );
    return response.status(status).send(resp);
  } catch (e) {
    if (e.hasOwnProperty("status") && e.hasOwnProperty("message")) {
      const { status, ...error } = e;
      return response.status(status).send(error);
    }
    console.error(
      "UsersController::updateUserSavedAddress::unhandled error",
      e
    );
    return response
      .status(500)
      .send({ message: "Something went wrong. Please try again" });
  }
}

async function deleteUserSavedAddress(request, response) {
  try {
    const { user } = request;
    const { id } = user;
    const { label } = request.query;

    const { status, ...resp } = await UserService.deleteUserSavedAddress(id, label);
    return response.status(status).send(resp);
  } catch (e) {
    if (e.hasOwnProperty("status") && e.hasOwnProperty("message")) {
      const { status, ...error } = e;
      return response.status(status).send(error);
    }
    console.error(
      "UsersController::deleteUserSavedAddress::unhandled error",
      e
    );
    return response
      .status(500)
      .send({ message: "Something went wrong. Please try again" });
  }
}

async function fetchUserSavedAddress(request, response) {
  try {
    const { user } = request;
    const { id } = user;
    let savedUser = (await UserService.findOne({ _id: id }))._doc;

    let savedAddresses = [];
    if (savedUser.hasOwnProperty("savedAddresses")) {
      savedAddresses = savedUser["savedAddresses"];
    }

    return response.status(200).send({
      message: "Fetched your saved addresses",
      data: savedAddresses,
    });
  } catch (e) {
    if (e && e.hasOwnProperty("status")) {
      const { status, ...error } = e;
      return response.status(status).send(error);
    }
    console.error(
      "UsersController::fetchUserSavedAddres::Uncaught error",
      error
    );
    return response
      .status(500)
      .send({ message: "Something went wrong. Please try again" });
  }
}

async function filterPromoCodesByUserCreation(userId, promoCodes) {
  const user = await UserService.findOne({ _id: ObjectId(userId) });
  const userCreatedAt = (!user.created_at) ? (new Date(null)) : (user.created_at);
  const filteredPromoCodes = promoCodes.filter((promoCode) => {
    if (!promoCode.quota.userCreatedAfter) {
      return true
    } else {
      return promoCode.quota.userCreatedAfter < userCreatedAt
    }
  })

  return filteredPromoCodes
}

async function filterPromoCodesByExistingOrders(userId, promoCodes) {
  const promoCodeIds = promoCodes.map((promoCode) => ObjectId(promoCode._id))

  const queryOrdersWithPromoCodes = {
    userId: ObjectId(userId),
    promoCode: { $in: promoCodeIds },
    "orderStatus": {
      "$in": [
        "completed",
        "pending",
        "ongoing"
      ]
    }
  }
  const orders = await OrderService.find(queryOrdersWithPromoCodes);

  const validPromoCodes = promoCodes.filter((promoCode) => {
    const perUserCount = promoCode.quota?.perUser
    if (!perUserCount) {
      return true
    } else {
      const applicableOrders = orders.filter((order) => {
        return order.promoCode == promoCode._id
      })
      return perUserCount > applicableOrders.length
    }
  })

  return validPromoCodes
}

async function getAllPromoCodes(request, response) {
  const { user } = request
  const { id } = user
  try {
    const promoCodes = await PromoService.find({}, select = { id: 1, _id: 1, title: 1, description: 1 }, sort = { "updatedAt": -1 })
    const filteredByUserCreation = await filterPromoCodesByUserCreation(id, promoCodes)
    const validPromoCodes = await filterPromoCodesByExistingOrders(id, filteredByUserCreation)

    if (validPromoCodes.length > 0) {
      // return response.status(200).send(validPromoCodes)
      // Don't return promo codes till the frontend is fixed
      return response.status(404).send({ message: "No promo code found" })
    } else {
      return response.status(404).send({ message: "No promo code found" })
    }
  } catch (e) {
    logger.error("UsersController::getAllPromoCodes::Unhandled error", e);
    return response.status(500).send({ message: "Something went wrong" })
  }
}

async function fetchUserAddress(request, response) {
  try {
    const { user } = request;
    const { id } = user;
    const { label } = request.query
    let savedUser = (await UserService.findOne({ _id: id }));

    const { savedAddresses } = savedUser;
    if (!savedAddresses || savedAddresses.length === 0) {
      throw {
        status: 412,
        message: "No address saved for the user",
      };
    }
    const address = savedAddresses.find(c => c.label === label);
    if (!address) {
      throw {
        status: 412,
        message: "Address not found",
      };
    }

    return response.status(200).send({
      message: "Fetched your saved address",
      address: address.address,
      label: address.label,
      buildingName: address.buildingName,
      number: address.number,
      location: {
        lat: address.location.lat,
        lng: address.location.lng
      }
    });
  } catch (e) {
    if (e && e.hasOwnProperty("status")) {
      const { status, ...error } = e;
      return response.status(status).send(error);
    }
    console.error(
      "UsersController::fetchUserSavedAddress::Uncaught error",
      error
    );
    return response
      .status(500)
      .send({ message: "Something went wrong. Please try again" });
  }
}

async function getUserDetails(request, response) {
  try {
    let { user } = request;

    if (user) {

      if (!user.referralCode) {
        let referralCode = await generateAndStoreReferralCodeForUser(user._id)
        user.referralCode = referralCode
      }

      return response.status(200).send({ data: user });
    } else {
      return response.status(401).send({ data: 'Unauthorized Access Token' });
    }
  } catch (e) {
    console.error(
      "UsersController::getUserDetails::Uncaught error", e
    );

    if (e && e.hasOwnProperty("status")) {
      const { status, ...error } = e;
      return response.status(status).send(error);
    }

    return response
      .status(500)
      .send({ message: "Something went wrong. Please try again" });
  }
}
