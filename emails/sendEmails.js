require("dotenv").config()
const { transporter } = require("./transporter");

const sendEmail = async(email, subject, message) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.transporter_email_user,
            to: email,
            subject: subject,
            html: message
        })
        console.log('Email enviado:', info.response);
        return true
    } catch (error) {
        console.log(error)
        return false
    }
};

module.exports = { sendEmail }
