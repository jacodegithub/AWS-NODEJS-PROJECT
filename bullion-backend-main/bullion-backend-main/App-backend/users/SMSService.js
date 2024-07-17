const request = require('request');
const crypto = require("crypto");
const OTPModel = require("./../Models/SignupOtp");

module.exports = class SMSService {
    constructor() {
        this.SMS_REGISTER_MSG = otp => `${otp} is your one time password to sign up on Gordian. Do not share your OTP with anyone`;
        this.SMS_SIGNIN_MSG   = otp => `${otp} is your one time password to sign in on Gordian. Do not share your OTP with anyone`;
    };

    sendSMS(phoneNumber, message) {
        return new Promise((resolve, reject) => {
            let url = `https://enterprise.smsgupshup.com/GatewayAPI/rest`;
            url += `?method=SendMessage`;
            url += `&send_to=${phoneNumber}`;
            url += `&msg=${message}`;
            url += `&msg_type=TEXT`;
            url += `&userid=${process.env.GUPSHUP_ID}`;
            url += `&auth_scheme=plain`;
            url += `&password=${process.env.GUPSHUP_PWD}`;
            url += `&v=1.1`;
            url += `&format=text`;

            request(url, function (error, response, body) {
                if (error) {
                    console.error("SMSService::sendSMS::Error sending SMS", error);
                    return reject(error);
                }

                // console.debug("SMSService::sendSMS::success", response, body)
                resolve({response});
            });
        });
    };
    
    otpHash(otp) {
        const secret = process.env.JWT_SECRET;
        return String(crypto.createHmac("sha256", secret).update(otp).digest("hex"));
    };

    generateOTP() {
        return String(Math.floor(100000 + Math.random() * 900000));
    };

    remove(deletionQuery) {
        return new Promise((resolve, reject) => {
            OTPModel.deleteOne(deletionQuery)
            .then((removed) => resolve(removed))
            .catch((err) => {
                console.error("SMSService::remove::Failed to remove doc", deletionQuery, err);
                reject(err);
            });
        })
    };

    /**
     * OTPs are alive for a few number of minutes
     * Within this window, Whatever OTP is persisted to DB
     * Can be used to verify the user
     */
    async verify(otp, phonenumber, event) {
        try {
            const hash = this.otpHash(otp);
            let query = { phonenumber };
            if (typeof event === 'string' && event.length > 1) {
                query["event"] = event;
            };

            // @TODO: Export OTPModel to a different function
            const queriedOTPs = await OTPModel.find(query);
            for(let i = 0; i < queriedOTPs.length; i++) {
                if (queriedOTPs[i]["otpHash"] === hash) {
                    return true;
                };
            };
            console.debug("SMSService::verify::Queried OTP does not match hash"); 

            return false;
        } catch(e) {
            console.error("SMSService::verify::Unhandled error", e);
            return false;
        };
    };

    async persist(phonenumber, otpHash, event) {
        const doc = new OTPModel({ 
            phonenumber, 
            otpHash,
            event,
            createdAt: new Date() 
        });

        const record = await doc.save(doc);
        if (!record || !record._id) {
            console.error("SMSService::persist::Failed to persist phone number and OTP = ", record);
            throw record;
        };
        console.info("SMSService::persist:: OTP assosciated with phone number successfully");
        return record;
    };
};