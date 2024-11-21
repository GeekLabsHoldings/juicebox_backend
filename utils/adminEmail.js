const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.USER_ACCOUNT,
    pass: process.env.USRE_PASSWORD,
  },
});

const sendEmail = async (to, subject, text, html = null) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    });
  } catch (err) {
    const logger = require('./logger')('emailErrors.log');
    logger.error(`[ERROR] Failed to send email: ${err.message}`);
    throw new Error('Email notification failed');
  }
};

module.exports = { sendEmail };
