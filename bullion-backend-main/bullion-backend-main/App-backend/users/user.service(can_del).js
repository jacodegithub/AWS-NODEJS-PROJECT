const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("_helpers/db");
const SMSService = new (require('./SMSService'));


module.exports = {
  authenticate,
  refreshToken,
  revokeToken,
  getAll,
  getById,
  getRefreshTokens,
  authenticatewithotp,
  findAnUser,
  verifyOtp,
  updateUserSavedAddress,
  findOne
};

async function authenticate({ email, password, ipAddress }) {
  const user =
    (await db.User.findOne({ email })) ||
    (await db.BussinessUser.findOne({ email }));

  if (!user || !user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
    console.debug("UserService::authenticate::Incorrect password for user = ", user);
    throw {
      status: 401,
      message: "Email or password is incorrect"
    };
  }

  // authentication successful so generate jwt and refresh tokens
  const jwtToken = generateJwtToken(user);
  const refreshToken = generateRefreshToken(user, ipAddress);

  // save refresh token
  await refreshToken.save();

  // return basic details and tokens
  return {
    ...basicDetails(user),
    jwtToken,
    refreshToken: refreshToken.token,
  };
}

async function authenticatewithotp({ phonenumber, otp, ipAddress }) {
  const user = await db.User.findOne({ phonenumber });

  // converting the received otp to hash & then matching it with the one stored in database.
  const smsKey = process.env.JWT_SECRET;
  const data = `${otp}`;
  const hash = crypto.createHmac("sha256", smsKey).update(data).digest("hex");
  const fullHash = `${hash}`;

  // if (fullHash !== user.otpHash) throw "Incorrect OTP";
  if (!user || user.otpHash !== fullHash ) throw "Incorrect OTP";

  // authentication successful so generate jwt and refresh tokens
  const jwtToken = generateJwtToken(user);
  const refreshToken = generateRefreshToken(user, ipAddress);

  // save refresh token
  await refreshToken.save();

  // return basic details and tokens
  return {
    ...basicDetails(user),
    jwtToken,
    refreshToken: refreshToken.token,
  };
}

async function refreshToken({ token, ipAddress }) {
  const refreshToken = await getRefreshToken(token);
  const { user } = refreshToken;

  // replace old refresh token with a new one and save
  const newRefreshToken = generateRefreshToken(user, ipAddress);
  // refreshToken.revoked = Date.now();
  // refreshToken.revokedByIp = ipAddress;
  // refreshToken.replacedByToken = newRefreshToken.token;
  // await refreshToken.save();
  await removeRefreshToken({token});

  await newRefreshToken.save();

  // generate new jwt
  const jwtToken = generateJwtToken(user);

  // return basic details and tokens
  return {
    ...basicDetails(user),
    jwtToken,
    refreshToken: newRefreshToken.token,
  };
}

async function revokeToken({ token, ipAddress }) {
  const refreshToken = await getRefreshToken(token);

  // revoke token and save
  refreshToken.revoked = Date.now();
  refreshToken.revokedByIp = ipAddress;
  await refreshToken.save();
}

async function getAll() {
  const users = await db.User.find();
  return users.map((x) => basicDetails(x));
}

async function getById(id) {
  const user = await getUser(id);
  return basicDetails(user);
}

async function getRefreshTokens(userId) {
  // check that user exists
  await getUser(userId);

  // return refresh tokens for user
  const refreshTokens = await db.RefreshToken.find({ user: userId });
  return refreshTokens;
}

// helper functions

async function getUser(id) {
  if (!db.isValidId(id)) throw "User not found";
  const user = await db.User.findById(id);
  if (!user) throw "User not found";
  return user;
}

async function getRefreshToken(token) {
  const refreshToken = await db.RefreshToken.findOne({ token }).populate(
    "user"
  );
  if (!refreshToken || !refreshToken.isActive) throw { "status": 400, "message": "Invalid token"};
  return refreshToken;
}

function removeRefreshToken(query) {
  return new Promise((resolve, reject) => {
    db.RefreshToken.deleteOne(query)
    .then((deleted) => resolve(deleted))
    .catch((err) => {
      console.error("UserService::removeRefreshToken::Failed to remove token. Error =  ", err);
      reject(err);
    });
  });
}

function generateJwtToken(user) {
  // create a jwt token containing the user id that expires in 15 minutes
  return jwt.sign({ sub: user.id, id: user.id }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
}

function generateRefreshToken(user, ipAddress) {
  // create a refresh token that expires in 7 days
  return new db.RefreshToken({
    user: user.id,
    token: randomTokenString(),
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdByIp: ipAddress,
  });
}

function randomTokenString() {
  return crypto.randomBytes(40).toString("hex");
}

function basicDetails(user) {
  const { id, fullName, phonenumber, email, role } = user;
  return { id, fullName, phonenumber, email, role };
}

async function findAnUser(userId) {
  const [ customer, businessUser ] = await Promise.all([
     db.User.findOne({"_id": userId}),
     db.BussinessUser.findOne({"_id": userId})
  ]);

  if (customer) return customer;
  if (businessUser) return businessUser;

  console.error("UserService::findAnUser::No user found", userId);
  throw {};
};

async function verifyOtp(otp, phonenumber) {
  const isOtpVerified = await SMSService.verify(otp, phonenumber);
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

async function updateUser(query, updateBody, options = {}) {
  try {
    return await db.User.findOneAndUpdate(query, updateBody, options);
  } catch(e) {
    console.error("UserService::updateUserByID::Failed to update user", e);
    throw e;
  };
};

function modifyLabelField(label) {
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

async function updateUserSavedAddress(userId, updateBody) {
  const { address, lat, lng, label, number, flatNumber, buildingName } = updateBody;
  const modifiedLabel = modifyLabelField(label);

  const query = {
    _id: userId,
    "savedAddresses.label": {
      "$ne": modifiedLabel
    }
  };

  const updateRequest = {
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
  };

  const options = { new: true };

  const updatedSavedAddress = await updateUser(query, updateRequest, options);
  if (!updatedSavedAddress || !updatedSavedAddress._id) {
    console.error("UserService::UpdateUserSavedAddress::No update occurred = ", updatedSavedAddress);
    return {
      status: 412,
      message: "Could not save address. Please try a different label"
    };
  };

  return {
    status: 200,
    message: "Address saved successfully",
    data: updatedSavedAddress.savedAddresses
  };
};

async function findOne(query, select = {}) {
  try {
    return await db.User.findOne(query, select);
  } catch(e) {
    console.info("UserService::findOne::Could not fetch user", query, e);
    throw e;
  };
};
