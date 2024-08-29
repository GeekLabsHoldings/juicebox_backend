const nodemailer = require('nodemailer');

exports.sendEmail = async (to, subject, htmlContent) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true,
    auth: {
      user: process.env.USER_ACCOUNT,
      pass: process.env.USRE_PASSWORD,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Juice Box" <${process.env.USER_ACCOUNT}>`,
      to,
      subject,
      html: htmlContent,
    });

  } catch (error) {
    console.log(error);
  }
};
