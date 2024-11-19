const redis = require('../config/ioredis');
const User = require('../models/userModel');

// Helper: Unblock an IP
async function unblockIP(ip) {
  // Remove block-related keys for the IP in Redis
  await Promise.all([
    redis.del(`block_bot:${ip}`),          // Remove temporary block for bot behavior
    redis.del(`block_rate:${ip}`), // Remove temporary block for rate limiting
  ]);
  return `IP ${ip} unblocked successfully.`;
}

// Helper: Unblock a User
async function unblockUserById(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  user.isBlocked = false;
  user.blockExpiresAt = null;
  await user.save();
  return `User ${user.email} unblocked successfully.`;
}

// Helper: Get IP from the request
function getIpFromRequest(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
}

module.exports = {
  unblockUserById,
  unblockIP,
  getIpFromRequest,
};
