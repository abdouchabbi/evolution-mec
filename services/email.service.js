const nodemailer = require("nodemailer");
const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM } = process.env;

const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT) || 2525,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

module.exports = async function sendEmail({ to, subject, html }) {
    return transporter.sendMail({ from: EMAIL_FROM || "no-reply@localhost", to, subject, html });
};
