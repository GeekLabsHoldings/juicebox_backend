const jwt = require('jsonwebtoken');

const createToken = (user) =>
  jwt.sign(
    {
      userId: user._id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
      ISD: user.ISD,
      phoneNumber: user.phoneNumber,
      DOB: user.DOB,
      balance: user.balance,
      currency: user.currency,
      address: user.address,
      city: user.city,
      country: user.country,
      org: user.org,
      position: user.position,
    },
    process.env.JWT_SECRET_KEY,
    {
      expiresIn: process.env.JWT_EXPIRE_TIME,
    }
  );

module.exports = createToken;
