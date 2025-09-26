// utils/email.js

const nodemailer = require('nodemailer');

const sendEmail = async options => {
    // 1) Create a transporter
    const transporter = nodemailer.createTransport({
        host: "sandbox.smtp.mailtrap.io",
        port: 2525,
        auth: {
            user: "c58c3f6e2b6b0b", // Your Mailtrap username
            pass: "97df46eb373d58"  // Your Mailtrap password
        }
    });

    // 2) Define the email options
    const mailOptions = {
        from: 'Lavoro Track Support <support@lavorotrack.com>',
        to: options.email,
        subject: options.subject,
        text: options.message,
        // html: can also be included
    };

    // 3) Actually send the email
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
