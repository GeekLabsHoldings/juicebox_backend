// const User = require('../models/userModel');
// const redisClient = require('../config/redis');

// const SUSPICIOUS_THRESHOLD = 10; // E.g., 10 requests in 10 seconds
// const BLOCK_THRESHOLD = 20; // E.g., 20 requests triggers block

// const temporarilyBlockUser = async (userId) => {
//   const user = await User.findById(userId);
//   if (user) {
//     user.isBlocked = true;
//     user.blockExpiresAt = Date.now() + 24 * 60 * 60 * 1000; // Block for 24 hours
//     await user.save();
//   }
// };

// const sendWarning = (ip) => {
//   console.log(`Suspicious activity detected from IP: ${ip}. Sending warning...`);
// };

// const blockUser = (ip) => {
//   console.log(`Blocking IP: ${ip}`);
// };

// const trackSuspiciousActivity = async (req, res, next) => {
//   const ip = req.ip;
//   const key = `requests:${ip}`;

//   redisClient.get(key, async (err, count) => {
//     if (err) return next(err);

//     count = count ? parseInt(count) : 0;

//     if (count >= SUSPICIOUS_THRESHOLD) {
//       sendWarning(ip);
//     }

//     if (count >= BLOCK_THRESHOLD) {
//       const user = await User.findOne({ email: req.user.email });
//       await temporarilyBlockUser(user._id);
//       return res.status(403).json({ message: 'Your account has been temporarily blocked.' });
//     }

//     redisClient.setex(key, 10, count + 1);
//     next();
//   });
// };

// module.exports = trackSuspiciousActivity;
