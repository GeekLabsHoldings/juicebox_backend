const redis = require('../config/ioredis');
const User = require('../models/userModel');

// Helper: Unblock an IP
async function unblockIP(ip) {
  await Promise.all([
    redis.del(`block:${ip}`),          // Remove temporary block
    redis.del(`permanent_block:${ip}`), // Remove permanent block
    redis.del(`offense_count:${ip}`), // Reset offense count
  ]);
  return `IP ${ip} unblocked successfully.`;
}

// Helper: Unblock a User
async function unblockUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  user.isBlocked = false;
  user.blockExpiresAt = null;
  await user.save();
  return `User ${user.email} unblocked successfully.`;
}

module.exports = {
  unblockUser,
  unblockIP,
};
