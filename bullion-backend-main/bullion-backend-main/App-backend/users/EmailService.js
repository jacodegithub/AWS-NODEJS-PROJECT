const nodemailer = require('nodemailer');
const Enums = require('./../_helpers/Enums');

module.exports = class EmailService {
    constructor() {
        const service = "gmail";
        this.transporter = nodemailer.createTransport({
            service,
            auth: {
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    };


    send(receiverEmail, subject, html = "", text = "", attachments = [], bcc = undefined) {
        return new Promise((resolve, reject) => {
            subject = (process.env.ENVIRONMENT !== Enums.Environment.Production) ? process.env.ENVIRONMENT + " - " + subject : subject;
            const mailOptions = {
                from: process.env.EMAIL,
                to: receiverEmail,
                bcc,
                subject,
                html,
                attachments,
                text
            }

            this.transporter.sendMail(mailOptions)
            .then((mailSent) => {
                // console.debug("EmailService::send::Mail sent", mailSent);
                resolve(mailSent);
            }).catch((err) => {
                console.error("EmailService::send::Failed to send mail", err);
                reject(err);
            })
        })
    };

    sendAdminMailOnRegisteringBussiness(name, email, number, gstNumber, gstCertURL) {
        const to = process.env.ADMIN_SUPPORT_MAIL;
        const bcc = process.env.ADMIN_EMAIL;
        let subject = (process.env.ENVIRONMENT !== Enums.Environment.Production) ? process.env.ENVIRONMENT + " - " : "";
        subject += "New Bussiness Registered";
        let text = "This mail is auto-generated. A new bussiness user has registered.";
        text += "\n\n User Information is:";
        text += "\n Name: "+ name;
        text += "\n Email: " + email;
        text += "\n Phone number: " + number;
        text += "\n GST Number: " + gstNumber;
        text += "\n GST Certificate uploaded to: " + gstCertURL;
        this.send(to, subject, undefined, text, undefined, bcc)
        .catch(() => { console.error("EmailService::sendAdminMailOnRegisteringBussiness::Failed to send mail")});
    };
};