// mailer.js
require('dotenv').config();
const nodemailer = require('nodemailer');

// إعداد النقل (Transport) باستخدام بيانات Mailtrap من .env
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,   // مثال: sandbox.smtp.mailtrap.io
  port: process.env.EMAIL_PORT,   // مثال: 2525
  secure: false,                  // false لأن Mailtrap لا يستخدم SSL على هذا المنفذ
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// تصدير transporter لاستخدامه في ملفات أخرى
module.exports = transporter;
