const bcrypt = require('bcryptjs');
const User = require('./../Models/UserModel');
const Enums = require('./../_helpers/Enums');
const Authenticator = require('./../security/authenticator');
const SMSService = require('./SMSService')
const MailService = require('./EmailService');
const WhatsappService = require('./WhatsappService');
const ReferralService = require('../services/ReferralService');
const { S3 } = require('./AWS');
const CompanyModel = require('../Models/CompanyModel');

class UserService {
  constructor() {
    this.auth = new Authenticator();
    this.sms = new SMSService();
    this.aws_s3 = new S3();
    this.mailer = new MailService();
    this.whatsapp = new WhatsappService();
  };

  async find(
    query,
    fields,
    sort = {},
    skip = 0,
    limit = 0
  ) {
    try {
      return await User.find(query, fields).sort(sort).skip(skip).limit(limit);
    } catch (e) {
      throw e;
    };
  };

  async findOne(query, fields) {
    try {
      return await User.findOne(query, fields);
    } catch (e) {
      throw e;
    };
  };

  async update(query, modifications, options) {
    try {
      return await User.updateOne(query, modifications, options);
    } catch (e) {
      throw e;
    };
  };

  async findOneAndUpdate(query, modifications, options) {
    try {
      return await User.findOneAndUpdate(query, modifications, options);
    } catch (e) {
      throw e;
    };
  };

  async create(newUser) {
    try {
      const user = new User(newUser);
      return await user.save();
    } catch (e) {
      throw e;
    }
  };

  hash(password) {
    return bcrypt.hashSync(password, 10);
  };

  areHashesMatching(password, passwordHash) {
    return bcrypt.compareSync(password, passwordHash);
  };

  async emailORPhoneExists(email, phonenumber) {
    const data = await this.findOne({
      "$or": [{ email }, { phonenumber }]
    });
    return data && data._id ? true : false;
  };

  async getCompanyDetails(user) {
    let company;
    const { role } = user
    if (role === Enums.Roles.Bussiness) {
      const { GST } = user;
      const { companyId, number } = GST;
      if (companyId) {
        const companyDetails = await CompanyModel.findOne({ _id: companyId });
        if (companyDetails) {
          const { companyName, paymentTypes } = companyDetails;
          const { wallet, onDemand, margin } = paymentTypes
          company = {
            company: companyName,
            GSTIN: number,
            wallet: wallet.allowed,
            onDemand: onDemand.allowed,
            margin: margin.allowed
          };
        }
      }
    }
    return company;
  }
  basicDetails(user) {
    const { id, fullName, phonenumber, email, role, company } = user;
    return { id, fullName, phonenumber, email, role, company };
  }

  generatedAuthResponse(userInformtion) {
    const { _id } = userInformtion;
    const { accessToken, refreshToken } = this.auth.generateTokenPairs(_id);
    const is_verified = userInformtion.role === Enums.Roles.Bussiness ? userInformtion.GST.is_verified : undefined;
    return {
      ...this.basicDetails(userInformtion),
      jwtToken: accessToken,
      refreshToken,
      is_verified: is_verified
    };
  };

  getPathToSaveGSTDoc(userId, filename) {
    return `users/${userId}/gst/${filename}`;
  };

  async handleRegistrationForBusiness(userInfo, gstNumber, businessName, gstDocument) {
    try {
      if (gstNumber && gstDocument) {
        const { _id, email, phonenumber, fullName } = userInfo;
        const { originalname, mimetype, buffer } = gstDocument;
        const filePath = this.getPathToSaveGSTDoc(_id, originalname);
        const params = this.aws_s3.createUploadParams(filePath, buffer, mimetype);
        const uploadedFile = await this.aws_s3.upload(params);

        let companyId;
        //check if company exist based on GST
        const existingCompany = await CompanyModel.findOne({ gstNumber: gstNumber })

        //if company not exist, create company
        if (!existingCompany) {
          const newCompany = await CompanyModel.create({
            companyName: businessName,
            gstNumber: gstNumber,
            gstCertificate: uploadedFile.Location,
            paymentTypes: {
              onDemand: {
                allowed: true
              },
              wallet: {
                allowed: true,
              },
              margin: {
                allowed: false
              }
            }
          });
          companyId = newCompany._id;
        }
        else {
          companyId = existingCompany._id
        }

        const updateGSTQuery = {
          "$set": {
            GST: {
              number: gstNumber,
              certificate: uploadedFile.Location,
              businessName: businessName,
              is_verified: false,
              companyId: companyId
            }
          }
        };

        const updated = await this.update({ _id }, updateGSTQuery);

        // Send an email when user registers for bussiness
        this.mailer.sendAdminMailOnRegisteringBussiness(
          fullName, email, phonenumber, gstNumber, uploadedFile.Location
        );

        return updateGSTQuery.$set.GST;
      };
    } catch (e) {
      console.error("UserService::handleRegistrationForBusiness::Uncaught exception = ", e);
      throw e;
    };
  };

  async register(requestData, requestFiles) {
    const {
      email,
      fullname,
      phonenumber,
      password,
      confirmpassword,
      role,
      gstNumber,
      businessName,
      referralCode,
    } = requestData;

    if (password !== confirmpassword) {
      throw {
        status: 401,
        message: "Passwords do not match"
      };
    };

    if (await this.emailORPhoneExists(email, phonenumber)) {
      console.error("UsersController::signUpCustomer::Existing credentials = ", email, phonenumber);
      throw {
        status: 409,
        message: "You are registering with existing credentials",
        errors: []
      };
    };

    const newUser = await this.create({
      email,
      role,
      phonenumber,
      fullName: fullname,
      passwordHash: this.hash(password)
    });

    let gstData

    if (role === Enums.Roles.Bussiness) {

      const files = Array.isArray(requestFiles) ? requestFiles : [];
      gstData = await this.handleRegistrationForBusiness(newUser, gstNumber, businessName, files[0])
        .then((data) => {
          return data
        })
        .catch((error) => { logger.error(error) });
      this.userVerification(newUser);
    };

    await this.handleReferralBonusOnCreation({ email, phoneNumber: phonenumber, name: fullname, referralCode, companyId: gstData?.companyId })

    return this.generatedAuthResponse(newUser);
  };

  async handleReferralBonusOnCreation(data) {
    await ReferralService.initiateReferralBonus(data)
  }

  async registrationInitWithPhone(phonenumber) {
    if (await this.findOne({ phonenumber })) {
      throw {
        status: 401,
        message: "Phone number is already registered. Please login.",
      };
    };

    const otp = this.sms.generateOTP();
    await this.sms.persist(phonenumber, this.sms.otpHash(otp), Enums.OTP.Events.registration)
      .then(async () => {
        await this.sms.sendSMS(phonenumber, this.sms.SMS_REGISTER_MSG(otp))
      })
      .then(async () => {
        //send whatsapp  message, if sms is successful
        this.whatsapp.sendOtpMsg(otp, phonenumber);
      })
      .catch(async (error) => {
        //send whatsapp message even if message fails
        this.whatsapp.sendOtpMsg(otp, phonenumber);
        throw error;
      })
      .catch(error => {
        throw error;
      });

    return { status: 200, phonenumber };
  };

  async verifyOtp(otp, phonenumber) {
    const isOtpVerified = await this.sms.verify(otp, phonenumber);
    if (isOtpVerified) {
      return {
        status: 200,
        message: "OTP verified"
      };
    }
    else {
      return {
        status: 401,
        message: "Matching OTP not found"
      };
    };
  };

  async registerPhoneNumberWithOTP(requestData, requestFiles) {
    const { email, fullname, phonenumber, otp, role, gstNumber, businessName, referralCode } = requestData;
    const data = `${otp}`;
    const hash = this.sms.otpHash(data);

    const dbUser = await this.emailORPhoneExists(email, phonenumber);
    if (dbUser) {
      console.error("UserService::registerPhoneNumberWithOTP:: Existing user = ", dbUser._id);
      throw {
        status: 409,
        message: "Cannot register with existing credentials"
      };
    };

    const event = Enums.OTP.Events.registration;
    const OTPverified = await this.sms.verify(otp, phonenumber, event);
    if (OTPverified !== true) {
      console.debug("UserService::registerPhoneNumberWithOTP::OTP not sent to user", otp, phonenumber);
      throw {
        status: 401,
        message: "Matching OTP not found"
      };
    };

    // Remove all assosciated numbers
    this.sms.remove({ phonenumber });

    const newUser = await this.create({
      email,
      role,
      phonenumber,
      fullName: fullname,
      otpHash: hash
    });

    if (role === Enums.Roles.Bussiness) {
      const files = Array.isArray(requestFiles) ? requestFiles : [];
      this.handleRegistrationForBusiness(newUser, gstNumber, businessName, files[0])
        .catch(() => { /** Do nothing */ });
      this.userVerification(newUser);
    };

    this.handleReferralBonusOnCreation({ email, phoneNumber: phonenumber, name: fullname, referralCode });

    return this.generatedAuthResponse(newUser);
  };

  async authenticateUsingEmailPassword(email, password) {
    const user = await this.findOne({ email });

    if (!user || !user.passwordHash || !this.areHashesMatching(password, user.passwordHash)) {
      throw {
        status: 401,
        message: "Email or password is incorrect"
      };
    };
    this.userVerification(user);
    const company = await this.getCompanyDetails(user);
    user.company = company;
    return this.generatedAuthResponse(user);
  };

  async authenticateInitWithPhone(phonenumber) {
    const user = await this.findOne({ phonenumber });
    if (!user) {
      throw {
        status: 401,
        message: "Phone number isn't registered. Please Signup first."
      }
    };

    const otp = this.sms.generateOTP();
    await this.sms.persist(phonenumber, this.sms.otpHash(otp), Enums.OTP.Events.authentication)
      .then(async () => {
        await this.sms.sendSMS(phonenumber, this.sms.SMS_SIGNIN_MSG(otp))
      })
      .then(async () => {
        //send whatsapp  message, if sms is successful
        this.whatsapp.sendOtpMsg(otp, phonenumber);
      })
      .catch(async (error) => {
        //send whatsapp message even if message fails
        this.whatsapp.sendOtpMsg(otp, phonenumber);
        throw error;
      })
      .catch(error => {
        throw error;
      });

    return { status: 200, phonenumber };
  };

  async authenticateUsingPhone(phonenumber, otp) {
    const event = Enums.OTP.Events.authentication;
    const persistedOTP = await this.sms.verify(otp, phonenumber, event);
    if (!persistedOTP) {
      throw {
        status: 401,
        message: "Incorrect OTP"
      };
    };

    const user = await this.findOne({ phonenumber });
    if (!user || !user._id) {
      console.error("UserService::authenticateUsingPhone::OTP matched but failed to find user with number = ", phonenumber);
      throw {
        status: 500,
        message: "Something went wrong. Please try again"
      };
    };
    this.userVerification(user);
    const company = await this.getCompanyDetails(user);
    user.company = company;
    return this.generatedAuthResponse(user);
  };

  modifyLabelField(label) {
    // Return the label with each word capitalized at first letter
    // and remaining word as small case 
    const splitLabels = label.split(" ");

    let labelFields = splitLabels.map((splitLabel) => {
      let temp = splitLabel.toLowerCase();
      if (temp[0]) {
        temp = temp.charAt(0).toUpperCase() + temp.slice(1);
      };
      return temp;
    });
    return labelFields.join(" ").trim();
  };

  async updateUserSavedAddress(userId, updateRequestBody) {
    const { address, lat, lng, label, number, flatNumber, buildingName } = updateRequestBody;
    const modifiedLabel = this.modifyLabelField(label);
    let message = "Error saving address";

    const updateQuery = {
      _id: userId,
      "savedAddresses.label": {
        "$eq": modifiedLabel
      }
    };

    const updateRequest = {
      "$set": {
        "savedAddresses.$": {
          address,
          location: { lat, lng },
          label: modifiedLabel,
          number,
          flatNumber,
          buildingName
        }
      }
    };

    const updateOptions = { multi: false, upsert: false };

    //update address
    var updatedSavedAddress = await this.update(updateQuery, updateRequest, updateOptions);
    //check if any record updated, if not then insert
    if (!updatedSavedAddress.nModified) {

      const addQuery = {
        _id: userId,
        "savedAddresses.label": {
          "$ne": modifiedLabel
        }
      };

      const addRequest = {
        "$push": {
          "savedAddresses": {
            address,
            location: { lat, lng },
            label: modifiedLabel,
            number,
            flatNumber,
            buildingName
          }
        }
      }
      const addOptions = { new: true };

      updatedSavedAddress = await this.findOneAndUpdate(addQuery, addRequest, addOptions);

      if (!updatedSavedAddress || !updatedSavedAddress._id) {
        console.error("UserService::UpdateUserSavedAddress::No update occurred = ", updatedSavedAddress);
        return {
          status: 412,
          message: "Could not save address. Please try a different label"
        };
      };
      message = "Address saved successfully"
    }
    else {
      message = "Address updated successfully"
    }


    return {
      status: 200,
      message: message,
      data: updatedSavedAddress.savedAddresses
    };
  };

  async deleteUserSavedAddress(userId, label) {
    const modifiedLabel = this.modifyLabelField(label);
    let message = "Error saving address";

    const updateQuery = {
      _id: userId,
      "savedAddresses.label": {
        "$eq": modifiedLabel
      }
    };

    const updateRequest = {
      "$pull": {
        "savedAddresses": {
          label: modifiedLabel
        }
      }
    };

    const updateOptions = { multi: true, upsert: false };

    //update address
    var updatedSavedAddress = await this.update(updateQuery, updateRequest, updateOptions);
    //check if any record updated, if not then insert
    if (updatedSavedAddress.nModified) {

      message = "Address Deleted successfully"
    }
    else {
      message = "No Address to remove"
    }


    return {
      status: 200,
      message: message,
      data: updatedSavedAddress.savedAddresses
    };
  };


  async refreshAccessToken(refreshToken) {
    try {
      const { sub } = this.auth.assertTokenIsValid(refreshToken);
      // Remove refresh token. Assert that it was removed
      const { deletedCount } = await this.auth.removeToken({ user: sub, token: refreshToken });
      if (deletedCount < 1) {
        console.error("UserService::refreshAccessToken::Failed to remove refreshToken from database");
        throw {
          status: 401,
          message: "Invalid refresh token"
        };
      }

      const user = await this.findOne({ _id: sub });
      if (!user) {
        console.error("UserService::refreshAccessToken::Decoded refresh token but could not find user = ", sub);
        throw {
          status: 500,
          message: "Something went wrong. Please try again"
        };
      };

      return this.generatedAuthResponse(user);
    } catch (e) {
      if (e.hasOwnProperty("status")) throw e;
      console.error("UserService::refreshAccessToken::Failed to decode refresh token");
      throw {
        status: 401,
        message: "Invalid refresh token"
      };
    };
  };

  async revokeToken(token) {
    await this.auth.removeToken({ token });
  };

  async getMargin(user) {
    const company = await CompanyModel.findById(user.GST.companyId);
    return company.paymentTypes.margin;
  }

  userVerification(user) {
    return true;
    // Non verified users can also login, for now
    // const { role } = user;
    // if(role === Enums.Roles.Bussiness){
    //     const { GST } = user;
    //     const { is_verified } = GST;
    //     if(!is_verified){
    //         console.error("UserService::UserVerification::User not verified");
    //         throw {
    //             status: 412,
    //             message: "Thank you for registering as a Business. Your account will be activated soon! This usually takes upto 24 hours."
    //         };
    //     }
    // }
  }
};

module.exports = UserService;
