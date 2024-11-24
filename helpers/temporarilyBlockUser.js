const User = require('../models/userModel');

const temporarilyBlockUser = async (userId, blockDuration) => {
  const user = await User.findById(userId);
  if (user) {
    const currentTime = Date.now();
    if (!user.isBlocked || user.blockExpiresAt <= currentTime) {
      user.isBlocked = true;
      user.blockExpiresAt = currentTime + blockDuration;
      user.offenseCount = (user.offenseCount || 0) + 1;
      await user.save();
    }
  }
};

module.exports = temporarilyBlockUser;
