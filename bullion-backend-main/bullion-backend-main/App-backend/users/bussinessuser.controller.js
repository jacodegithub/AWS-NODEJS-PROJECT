const bcrypt = require('bcryptjs');
const db = require('../_helpers/db');
const express = require('express');
const router = express.Router();
const Joi = require('@hapi/joi');
const validateRequest = require('_middleware/validate-request');
const authorize = require('_middleware/bussiness_authorize')
const customerAutorize = require('../_middleware/authorize')
const Role = require('_helpers/role');
const userService = require('./bussinessuser.services');
const insuranceService = require('../services/insuranceService')
const logger = require('../_helpers/logger.js');
const LogsService = require('./LogsService.js');
var nodemailer = require("nodemailer");
const crypto = require('crypto');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, new Date().toISOString() + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  //reject a file
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('This type of file is not acceptable!!'), false);
  }

}

const upload = multer({
  storage: storage,
  limits: {
    fieldSize: 1024 * 1024 * 5
  },
  fileFilter: fileFilter
});
const BussinessUser = require('./bussinessuser.model');

var transpoter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// routes
// router.post('/authenticate-bussiness', authenticateSchemaBussiness, authenticatebussiness);
router.post('/getInsuranceEstimate', customerAutorize(), getInsuranceEstimate);
router.post('/signup-Bussiness', upload.single('gstcertificatefilepath'), signupSchemaBussiness, signupBussiness);
router.post('/refresh-token', refreshToken);
// router.post('/revoke-token', authorize(), revokeTokenSchema, revokeToken);
router.get('/:id', authorize(), getById);
router.get('/:id/refresh-tokens', authorize(), getRefreshTokens);
router.post('/reset-passwordofbussiness', getRetsetLinksofbussiness);
router.post('/new-passwordofbussiness', getNewPasswordofbussiness);

module.exports = router;

async function signupBussiness(req, res, next) {
  console.log(req.file);
  const { email, fullname, phonenumber, gstnumber, billingaddress1, billingaddress2, city, postalcode, password, confirmpassword, role } = req.body
  const gstcertificatefilepath = req.file.path
  const existinguserwithEmail = await BussinessUser.findOne({ email });
  const existinguserwithPhone = await BussinessUser.findOne({ phonenumber });

  if (existinguserwithPhone) {
    return res.status(409).json({
      message: "Phone number is already exist!"
    })
  }

  if (existinguserwithEmail) {
    return res.status(409).json({
      message: "Email id already exist!"
    })
  }

  if (password !== confirmpassword) {
    return res.status(401).json({ message: "passwords don't match" })
  }
  const bussinessuser = new db.BussinessUser({
    fullName: fullname,
    phoneNumber: phonenumber,
    email: email,
    gstNumber: gstnumber,
    gstCertificate: gstcertificatefilepath,
    billingAddress1: billingaddress1,
    billingAddress2: billingaddress2,
    city: city,
    postalCode: postalcode,
    passwordHash: bcrypt.hashSync(password, 10),
    role: role,
  });
  await bussinessuser.save();
  const ipAddress = req.ip;
  userService.authenticate({ email, password, ipAddress })
    .then(({ refreshToken, ...user }) => {
      setTokenCookie(res, refreshToken);
      res.json(user);
    })
    .catch(next);
}


function signupSchemaBussiness(req, res, next) {
  const schema = Joi.object({
    fullname: Joi.string().required(),
    phonenumber: Joi.string().required(),
    gstnumber: Joi.string().required(),
    billingaddress1: Joi.string().required(),
    billingaddress2: Joi.string().required(),
    city: Joi.string().required(),
    postalcode: Joi.string().required(),
    email: Joi.string().required(),
    password: Joi.string().required(),
    confirmpassword: Joi.string().required(),
    role: Joi.string().required(),
  });
  validateRequest(req, next, schema);
}

// function authenticateSchemaBussiness(req, res, next) {
//     const schema = Joi.object({
//         email: Joi.string().required(),
//         password: Joi.string().required()
//     });
//     validateRequest(req, next, schema);
// }

// function authenticatebussiness(req, res, next) {
//     const { email, password } = req.body;
//     const ipAddress = req.ip;
//     userService.authenticate({ email, password, ipAddress })
//         .then(({ refreshToken, ...user }) => {
//             setTokenCookie(res, refreshToken);
//             // res.json(user);
//             res.json({ refreshToken, ...user });
//         })
//         .catch(next);
// }

function refreshToken(req, res, next) {
  const token = req.cookies.refreshToken;
  const ipAddress = req.ip;
  userService.refreshToken({ token, ipAddress })
    .then(({ refreshToken, ...user }) => {
      setTokenCookie(res, refreshToken);
      res.json(user);
    })
    .catch(next);
}

// function revokeTokenSchema(req, res, next) {
//     const schema = Joi.object({
//         token: Joi.string().empty('')
//     });
//     validateRequest(req, next, schema);
// }

// function revokeToken(req, res, next) {
//     // accept token from request body or cookie
//     const token = req.body.token || req.cookies.refreshToken;
//     const ipAddress = req.ip;

//     if (!token) return res.status(400).json({ message: 'Token is required' });

//     // users can revoke their own tokens and admins can revoke any tokens
//     if (!req.user.ownsToken(token)) {
//         return res.status(401).json({ message: 'Unauthorized' });
//     }

//     userService.revokeToken({ token, ipAddress })
//         .then(() => res.json({ message: 'Token revoked' }))
//         .catch(next);
// }

// function getAll(req, res, next) {
//     userService.getAll()
//         .then(users => res.json(users))
//         .catch(next);
// }

function getById(req, res, next) {
  // regular users can get their own record and admins can get any record
  if (req.params.id !== req.user.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  userService.getById(req.params.id)
    .then(user => user ? res.json(user) : res.sendStatus(404))
    .catch(next);
}

function getRefreshTokens(req, res, next) {
  // users can get their own refresh tokens and admins can get any user's refresh tokens
  if (req.params.id !== req.user.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  userService.getRefreshTokens(req.params.id)
    .then(tokens => tokens ? res.json(tokens) : res.sendStatus(404))
    .catch(next);
}

// helper functions

function setTokenCookie(res, token) {
  // create http only cookie with refresh token that expires in 7 days
  const cookieOptions = {
    httpOnly: true,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  };
  res.cookie('refreshToken', token, cookieOptions);
}

function getRetsetLinksofbussiness(req, res, next) {
  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.log(err)
    }
    const token = buffer.toString("hex")
    BussinessUser.findOne({ email: req.body.email })
      .then(BussinessUser => {
        if (!BussinessUser) {
          return res.status(422).json({ error: "User dont exists with that email" })
        }
        BussinessUser.resetToken = token
        BussinessUser.expireToken = Date.now() + 3600000
        BussinessUser.save().then((result) => {
          transpoter.sendMail({
            to: BussinessUser.email,
            from: process.env.EMAIL,
            subject: "password reset",
            html: `
                    <p>You requested for password reset</p>
                    <h5>click in this <a href="${process.env.EMAIL}/reset/${token}">link</a> to reset password</h5>
                    `
          })
          res.json({ message: "check your email" })
        })

      })
  })
};

function getNewPasswordofbussiness(req, res) {
  const newPassword = req.body.newPassword
  const sentToken = req.body.token
  BussinessUser.findOne({ resetToken: sentToken })
    .then(BussinessUser => {
      if (!BussinessUser) {
        return res.status(422).json({ error: "Try again session expired" })
      }
      bcrypt.hash(newPassword, 10).then(passwordHash => {
        BussinessUser.passwordHash = passwordHash
        BussinessUser.resetToken = undefined
        BussinessUser.expireToken = undefined
        BussinessUser.save().then((saveduser) => {
          res.json({ message: "password updated success" })
        })
      })
    }).catch(err => {
      console.log(err)
    })
}

async function getInsuranceEstimate(req, res, next) {
  try {
    // is the user is not the business user
    if (req.user.role !== 'Bussiness') {
      return res.status(401).json({
        message: 'Unauthorized'
      })
    }

    const { amount, alreadyInsured } = req.body;
    if (!amount) {
      return res.status(400).json({ message: 'Amount is required' });
    }
    else {
      if (alreadyInsured) {
        if (amount >= 2000000) {
          saveLog(req.user.id, amount);
          return res.status(501).json({ message: 'Orders can be placed only for invoice value less than Rs. 20 lacs' });
        }
        else {
          const insuranceAmount = 0;
          return res.status(200).json({
            message: "Already Insured, Insurance amount is 0.",
            data: [
              {
                insuranceAmount,
                amount
              }
            ]
          });
        }
      }
      else {
        if (amount >= 1000000) {
          saveLog(req.user.id, amount);
          return res.status(501).json({ message: 'Orders can be placed only for invoice value less than Rs. 10 lacs' });
        }
        else {
          const user = req.user
          await insuranceService.checkInsuranceEligibility(user)
          const insuranceAmount = await insuranceService.calcInsuranceAmount(amount, user)
          return res.status(200).json({
            message: "Insurance amount calculated",
            data: [
              {
                insuranceAmount,
                amount
              }
            ]
          });
        }
      }
    }
  } catch (e) {
    if (e.hasOwnProperty("status")) {
      const { status, ...error } = e;
      return res.status(status).send(error)
    };

    logger.error(e)
    next(e)
  }
}

async function saveLog(userId, amount) {
  try {
    const newLogRequest = {
      estimate: {
        userId: userId,
        amount: amount
      }
    }
      ;
    const newLog = await LogsService.create(newLogRequest);
    console.debug(`BusinessController::SaveLog::Order created successfully with ID = ${newLog._id}`);
  }
  catch (e) {
    console.debug(`BusinessController::ErrorSavingLog = ${e}`);
  }
}
