require('dotenv').config();
const crypto = require('crypto');
const transporter = require('./mailer');

// تجربة البريد الإلكتروني
async function forgotPasswordTest(email) {
  // أنشئ رمز إعادة التعيين
  const resetToken = crypto.randomBytes(20).toString('hex');
  const resetTokenHashed = crypto.createHash('sha256').update(resetToken).digest('hex');

  // رابط إعادة التعيين
  const resetUrl = `http://localhost:${process.env.PORT}/reset-password.html?token=${resetToken}`;
  const message = `
لقد طلبت إعادة تعيين كلمة المرور. 
الرجاء الضغط على الرابط التالي لإعادة تعيينها. 
هذا الرابط صالح لمدة 15 دقيقة:

${resetUrl}
`;

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'إعادة تعيين كلمة المرور - TimbraFast',
      text: message,
      html: `<p>لقد طلبت إعادة تعيين كلمة المرور.</p>
             <p>اضغط على الرابط التالي لإعادة التعيين (صالح لمدة 15 دقيقة):</p>
             <a href="${resetUrl}">${resetUrl}</a>`,
    });

    console.log('Email sent successfully:', info.response);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

// اختبار
forgotPasswordTest('any@mailtrap.io'); // ضع البريد الذي تتابعه في Mailtrap Inbox
