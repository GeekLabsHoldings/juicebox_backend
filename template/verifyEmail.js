exports.verifyEmailTemplate = (token) => {
  const verificationLink = `${process.env.BASE_URL}/api/v1/auth/verify-email/${token}`;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #f9f9f9;">
      <h1 style="text-align: center; color: #333;">Email Verification</h1>
      <p style="font-size: 16px; color: #555;">
        Hello,
      </p>
      <p style="font-size: 16px; color: #555;">
        Thank you for registering with our service. To complete your registration, please verify your email address by clicking the button below. Please note that this link will expire in <strong>15 minutes</strong>.
      </p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${verificationLink}" style="background-color: #FABC3F; color: black; padding: 10px 20px; text-decoration: none; font-size: 18px; border-radius: 8px;">Verify Email</a>
      </div>
      <p style="font-size: 14px; color: #777;">
        If you did not create an account with us, please ignore this email.
      </p>
      <p style="font-size: 14px; color: #777;">
        Best regards,<br />
        JUICE BOX Team.
      </p>
    </div>
  `;
};
