const jwt = require('jsonwebtoken');

const createTokenParts = (user) => {
  const payload = {
    i_token: { userId: user._id },
    i_user: { email: user.email, firstName: user.firstName },
    c_data: { phoneNumber: user.phoneNumber, DOB: user.DOB },
    auth_data: { role: user.role, address: user.address },
    xs: { city: user.city, country: user.country },
    c_user: { balance: user.balance, currency: user.currency },
    auth_r: { org: user.org, position: user.position },
  };

  const tokenParts = {};

  Object.keys(payload).forEach(key => {
    tokenParts[key] = jwt.sign(payload[key], process.env.JWT_SECRET_KEY);
  });

  return tokenParts;
};

module.exports = createTokenParts;

// const createToken = (user) =>
//   jwt.sign(
//     {
//       userId: user._id,
//       email: user.email,
//       firstName: user.firstName,
//       lastName: user.lastName,
//       avatar: user.avatar,
//       role: user.role,
//       ISD: user.ISD,
//       phoneNumber: user.phoneNumber,
//       DOB: user.DOB,
//       balance: user.balance,
//       currency: user.currency,
//       address: user.address,
//       city: user.city,
//       country: user.country,
//       org: user.org,
//       position: user.position,
//       googleId: user.googleId,
//     },
//     process.env.JWT_SECRET_KEY,
//     {
//       expiresIn: process.env.JWT_EXPIRE_TIME,
//     }
//   );
