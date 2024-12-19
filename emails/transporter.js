require("dotenv").config()
const nodemailer = require("nodemailer")


const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.transporter_email_user,
        pass: process.env.transporter_email_passcode
    }
});

module.exports = { transporter }