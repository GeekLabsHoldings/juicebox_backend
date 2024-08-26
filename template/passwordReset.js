exports.passwordResetTemplate = (resetCode) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #dddddd; border-radius: 10px; background-color: #f9f9f9;">
      <h2 style="color: #333333;">Password Reset Request</h2>
      <p>Hello,</p>
      <p>We received a request to reset your password. Use the code below to reset your password. This code is valid for 10 minutes.</p>
      <div style="text-align: center; margin: 20px 0;">
        <p style="font-size: 24px; font-weight: bold; color: #FABC3F;">${resetCode}</p>
      </div>
      <p>If you did not request a password reset, please ignore this email or contact support if you have any concerns.</p>
      <p>Thank you,</p>
      <p>JUICE BOX Team</p>
    </div>
  `;
};
