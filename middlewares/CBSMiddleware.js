// const User = require('../models/userModel');

// const checkIfBlocked = async (req, res, next) => {
//   const user = await User.findById(req.user.id);
//   if (user && user.isBlocked) {
//     if (user.blockExpiresAt && user.blockExpiresAt > Date.now()) {
//       return res.status(403).json({ message: 'Your account is temporarily blocked. Try again later.' });
//     } else if (user.blockExpiresAt && user.blockExpiresAt < Date.now()) {
//       // Unblock if the block period has expired
//       user.isBlocked = false;
//       user.blockExpiresAt = null;
//       await user.save();
//     }
//   }
//   next();
// };

// module.exports = checkIfBlocked;
