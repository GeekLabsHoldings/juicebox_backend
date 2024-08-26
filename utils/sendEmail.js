const nodemailer = require('nodemailer');
const { USER_ACCOUNT, USRE_PASSWORD, EMAIL_HOST, EMAIL_PORT } = process.env;

exports.sendEmail = async (to, subject, htmlContent) => {
  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: true,
    auth: {
      user: USER_ACCOUNT,
      pass: USRE_PASSWORD,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"Juice Box" <${USER_ACCOUNT}>`,
      to,
      subject,
      html: htmlContent,
    });

  } catch (error) {
    console.log(error);
  }
};
