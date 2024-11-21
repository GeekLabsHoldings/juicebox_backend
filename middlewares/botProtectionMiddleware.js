const { RateLimiterRedis } = require('rate-limiter-flexible');
const User = require('../models/userModel');
const redis = require('../config/ioredis');
const createLogger = require('../utils/logger');

// Create a logger instance for this module
const logger = createLogger('rateLimiter.log');

// Centralized Configuration
const rateLimiterConfig = {
  keyPrefix: 'rate-limit',
  points: 20, // Allowed requests per window
  duration: 10, // Window in seconds
  warningThreshold: 10,
  baseTemporaryBlockDuration: 10 * 60, // 10 minutes
  escalationFactor: 1.5, // Exponential backoff factor for blocks
  decayTime: 30 * 60, // Reset offense count after inactivity (30 mins)
};

// Create RateLimiter Instance
const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: rateLimiterConfig.keyPrefix,
  points: rateLimiterConfig.points,
  duration: rateLimiterConfig.duration,
});

// Helper: Handle Offense and Escalation
async function handleOffense(ip, res) {
  const offenseKey = `offense_count:${ip}`;
  const offenseData = JSON.parse((await redis.get(offenseKey)) || '{}');
  const currentOffenses = offenseData.count || 0;
  const lastOffenseTime = offenseData.timestamp || 0;

  const now = Date.now();
  if (now - lastOffenseTime > rateLimiterConfig.decayTime * 1000) {
    // Reset offense count after decay time
    offenseData.count = 1;
  } else {
    // Increment offense count with dynamic scoring
    offenseData.count += Math.ceil(
      Math.log10(currentOffenses + 1) * rateLimiterConfig.escalationFactor,
    );
  }
  offenseData.timestamp = now;

  // Save updated offense data
  await redis.set(
    offenseKey,
    JSON.stringify(offenseData),
    'EX',
    rateLimiterConfig.decayTime,
  );

  const blockDuration = Math.round(
    rateLimiterConfig.baseTemporaryBlockDuration *
      Math.pow(rateLimiterConfig.escalationFactor, offenseData.count),
  );

  // Apply block
  await redis.set(`rate_block:${ip}`, 'temporary', 'EX', blockDuration);
  logger.warn(`IP ${ip} blocked for ${blockDuration / 60} minutes.`);
  return res.status(429).json({
    message: `You have been temporarily blocked. Please try again after ${blockDuration / 60} minutes.`,
  });
}

// Helper: Reset Offense Count for a Specific IP
async function resetOffenseForNormalBehavior(ip) {
  const offenseKey = `offense_count:${ip}`;
  const offenseData = JSON.parse((await redis.get(offenseKey)) || '{}');
  
  if (!offenseData.count) return; // No offenses recorded for this IP

  const lastOffenseTime = offenseData.timestamp || 0;
  const now = Date.now();

  // If the IP has behaved well for the decay period
  if (now - lastOffenseTime > rateLimiterConfig.decayTime * 1000) {
    // Reset offense count
    await redis.del(offenseKey);
    logger.info(`Offense count for IP ${ip} has been reset due to improved behavior.`);
  }
}

// Middleware: Rate Limiting with Dynamic Offense Management
const rateLimitMiddleware = async (req, res, next) => {
  const ip = req.ip;
  const userId = req.user?.id || ip;
  const endpointKey = `${userId}:${req.path}`;

  try {
    const requestCount = await redis.incr(endpointKey);
    if (requestCount === 1) {
      await redis.expire(endpointKey, RULES.requestLimits.timeWindow);
    }

    if (requestCount > RULES.requestLimits.userRequestLimit) {
      logger.warn(`Rate limit exceeded for user ${userId} on endpoint ${req.path}.`);
      return res.status(429).json({ message: 'Too many requests. Try again later.' });
    }

    next();
  } catch (error) {
    logger.error(`[ERROR] Rate Limiter for ${endpointKey}: ${error}`);
    res.status(503).send('Service Unavailable');
  }
};


/* Middleware: Track Suspicious Activity */
async function handleUserBlock(user, offenseCount, res) {
  const currentTime = Date.now();

  // Escalate block duration dynamically based on offense count
  const baseBlockDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
  const escalationFactor = 1.5; // Adjust penalty multiplier
  const blockDuration = Math.round(
    baseBlockDuration * Math.pow(offenseCount, escalationFactor),
  );

  // Check if the user is already blocked
  if (user.isBlocked && user.blockExpiresAt > currentTime) {
    return res.status(403).json({
      message: `Your account has been temporarily blocked. Please wait ${Math.ceil(
        (user.blockExpiresAt - currentTime) / 1000 / 60,
      )} minutes before trying again.`,
    });
  }

  // Block the user for the calculated duration
  await temporarilyBlockUser(user._id, blockDuration);
  return res.status(403).json({
    message: `Suspicious activity detected. Your account has been temporarily blocked for ${blockDuration / 1000 / 60} minutes.`,
  });
}

async function temporarilyBlockUser(userId, blockDuration) {
  const user = await User.findById(userId);
  if (user) {
    const currentTime = Date.now();

    // Reset status if block has expired
    if (user.isBlocked && user.blockExpiresAt <= currentTime) {
      user.isBlocked = false;
      user.blockExpiresAt = null;
      user.offenseCount = 0; // Reset offense count
      await user.save();
      console.log(`Block expired for user ${user.email}. Status reset.`);
    }

    // Block the user if not already blocked
    if (!user.isBlocked) {
      user.isBlocked = true;
      user.blockExpiresAt = currentTime + blockDuration;
      user.offenseCount = (user.offenseCount || 0) + 1; // Increment offense count
      await user.save();
      console.log(
        `User ${user.email} is temporarily blocked for ${blockDuration / 1000 / 60} minutes.`,
      );
    }
  }
}

async function trackSuspiciousActivity(req, res, next) {
  const ip = req.ip;
  const key = `requests:${ip}`;
  const SUSPICIOUS_THRESHOLD = 20; // Dynamic thresholds can also be calculated
  const BLOCK_THRESHOLD = 30;

  const count = parseInt(await redis.get(key), 10) || 0;

  // Fetch offense count and dynamically adjust thresholds
  const offenseCount =
    count >= SUSPICIOUS_THRESHOLD
      ? Math.floor(count / SUSPICIOUS_THRESHOLD)
      : 0;

  // Handle suspicious activity
  if (count >= SUSPICIOUS_THRESHOLD) {
    if (req.user) {
      const user = await User.findOne({ email: req.user.email });
      if (user) {
        return await handleUserBlock(user, offenseCount, res);
      }
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(403).json({ message: 'Suspicious activity detected.' });
  }

  // Handle block threshold
  if (count >= BLOCK_THRESHOLD) {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const user = await User.findOne({ email: req.user.email });
    if (user) {
      return await handleUserBlock(user, offenseCount + 1, res);
    }
    return res.status(404).json({ message: 'User not found' });
  }

  // Increment the request count dynamically
  const expiry = Math.max(10, 30 - offenseCount); // Reduce expiry time with offenses
  redis.setex(key, expiry, count + 1);
  next();
}

// **Export Middleware**
module.exports = {
  rateLimitMiddleware,
  trackSuspiciousActivity,
};

// const { RateLimiterRedis } = require('rate-limiter-flexible');
// const User = require('../models/userModel');
// const redis = require('../config/ioredis');
// const createLogger = require('../utils/logger');

// // Create a logger instance for this module
// const logger = createLogger('rateLimiter.log');

// // Centralized Configuration
// const rateLimiterConfig = {
//   keyPrefix: 'rate-limit',
//   points: 20, // Allowed requests per window
//   duration: 10, // Window in seconds
//   warningThreshold: 10,
//   baseTemporaryBlockDuration: 10 * 60, // 10 minutes
//   escalationFactor: 1.5, // Exponential backoff factor for blocks
//   decayTime: 30 * 60, // Reset offense count after inactivity (30 mins)
// };

// // Create RateLimiter Instance
// const rateLimiter = new RateLimiterRedis({
//   storeClient: redis,
//   keyPrefix: rateLimiterConfig.keyPrefix,
//   points: rateLimiterConfig.points,
//   duration: rateLimiterConfig.duration,
// });

// // Helper: Handle Offense and Escalation
// async function handleOffense(ip, res) {
//   const offenseKey = `offense_count:${ip}`;
//   const offenseData = JSON.parse((await redis.get(offenseKey)) || '{}');
//   const currentOffenses = offenseData.count || 0;
//   const lastOffenseTime = offenseData.timestamp || 0;

//   const now = Date.now();
//   if (now - lastOffenseTime > rateLimiterConfig.decayTime * 1000) {
//     // Reset offense count after decay time
//     offenseData.count = 1;
//   } else {
//     // Increment offense count with dynamic scoring
//     offenseData.count += Math.ceil(
//       Math.log10(currentOffenses + 1) * rateLimiterConfig.escalationFactor,
//     );
//   }
//   offenseData.timestamp = now;

//   // Save updated offense data
//   await redis.set(
//     offenseKey,
//     JSON.stringify(offenseData),
//     'EX',
//     rateLimiterConfig.decayTime,
//   );

//   const blockDuration = Math.round(
//     rateLimiterConfig.baseTemporaryBlockDuration *
//       Math.pow(rateLimiterConfig.escalationFactor, offenseData.count),
//   );

//   // Apply block
//   await redis.set(`rate_block:${ip}`, 'temporary', 'EX', blockDuration);
//   logger.warn(`IP ${ip} blocked for ${blockDuration / 60} minutes.`);
//   return res.status(429).json({
//     message: `You have been temporarily blocked. Please try again after ${blockDuration / 60} minutes.`,
//   });
// }

// // Helper: Reset Offense Count for a Specific IP
// async function resetOffenseForNormalBehavior(ip) {
//   const offenseKey = `offense_count:${ip}`;
//   const offenseData = JSON.parse((await redis.get(offenseKey)) || '{}');
  
//   if (!offenseData.count) return; // No offenses recorded for this IP

//   const lastOffenseTime = offenseData.timestamp || 0;
//   const now = Date.now();

//   // If the IP has behaved well for the decay period
//   if (now - lastOffenseTime > rateLimiterConfig.decayTime * 1000) {
//     // Reset offense count
//     await redis.del(offenseKey);
//     logger.info(`Offense count for IP ${ip} has been reset due to improved behavior.`);
//   }
// }

// // Middleware: Rate Limiting with Dynamic Offense Management
// const rateLimitMiddleware = async (req, res, next) => {
//   const ip = req.ip;

//   // Check existing block
//   const blockStatus = await redis.get(`rate_block:${ip}`);
//   if (blockStatus) {
//     const blockMessage =
//       blockStatus === 'permanent'
//         ? 'Access permanently denied.'
//         : 'Access temporarily denied. Try again later.';
//     return res.status(blockStatus === 'permanent' ? 403 : 429).json({
//       message: blockMessage,
//     });
//   }

//   try {
//     // Consume points from rate limiter
//     await rateLimiter.consume(ip);

//     // Check if the IP has behaved normally and reset offenses
//     await resetOffenseForNormalBehavior(ip);
    
//     next();
//   } catch (rateLimiterRes) {
//     // Handle offenses if rate limit exceeded
//     await handleOffense(ip, res);
//   }
// };

// /* Middleware: Track Suspicious Activity */
// async function handleUserBlock(user, offenseCount, res) {
//   const currentTime = Date.now();

//   // Escalate block duration dynamically based on offense count
//   const baseBlockDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
//   const escalationFactor = 1.5; // Adjust penalty multiplier
//   const blockDuration = Math.round(
//     baseBlockDuration * Math.pow(offenseCount, escalationFactor),
//   );

//   // Check if the user is already blocked
//   if (user.isBlocked && user.blockExpiresAt > currentTime) {
//     return res.status(403).json({
//       message: `Your account has been temporarily blocked. Please wait ${Math.ceil(
//         (user.blockExpiresAt - currentTime) / 1000 / 60,
//       )} minutes before trying again.`,
//     });
//   }

//   // Block the user for the calculated duration
//   await temporarilyBlockUser(user._id, blockDuration);
//   return res.status(403).json({
//     message: `Suspicious activity detected. Your account has been temporarily blocked for ${blockDuration / 1000 / 60} minutes.`,
//   });
// }

// async function temporarilyBlockUser(userId, blockDuration) {
//   const user = await User.findById(userId);
//   if (user) {
//     const currentTime = Date.now();

//     // Reset status if block has expired
//     if (user.isBlocked && user.blockExpiresAt <= currentTime) {
//       user.isBlocked = false;
//       user.blockExpiresAt = null;
//       user.offenseCount = 0; // Reset offense count
//       await user.save();
//       console.log(`Block expired for user ${user.email}. Status reset.`);
//     }

//     // Block the user if not already blocked
//     if (!user.isBlocked) {
//       user.isBlocked = true;
//       user.blockExpiresAt = currentTime + blockDuration;
//       user.offenseCount = (user.offenseCount || 0) + 1; // Increment offense count
//       await user.save();
//       console.log(
//         `User ${user.email} is temporarily blocked for ${blockDuration / 1000 / 60} minutes.`,
//       );
//     }
//   }
// }

// async function trackSuspiciousActivity(req, res, next) {
//   const ip = req.ip;
//   const key = `requests:${ip}`;
//   const SUSPICIOUS_THRESHOLD = 20; // Dynamic thresholds can also be calculated
//   const BLOCK_THRESHOLD = 30;

//   const count = parseInt(await redis.get(key), 10) || 0;

//   // Fetch offense count and dynamically adjust thresholds
//   const offenseCount =
//     count >= SUSPICIOUS_THRESHOLD
//       ? Math.floor(count / SUSPICIOUS_THRESHOLD)
//       : 0;

//   // Handle suspicious activity
//   if (count >= SUSPICIOUS_THRESHOLD) {
//     if (req.user) {
//       const user = await User.findOne({ email: req.user.email });
//       if (user) {
//         return await handleUserBlock(user, offenseCount, res);
//       }
//       return res.status(404).json({ message: 'User not found' });
//     }
//     return res.status(403).json({ message: 'Suspicious activity detected.' });
//   }

//   // Handle block threshold
//   if (count >= BLOCK_THRESHOLD) {
//     if (!req.user) {
//       return res.status(401).json({ message: 'User not authenticated' });
//     }

//     const user = await User.findOne({ email: req.user.email });
//     if (user) {
//       return await handleUserBlock(user, offenseCount + 1, res);
//     }
//     return res.status(404).json({ message: 'User not found' });
//   }

//   // Increment the request count dynamically
//   const expiry = Math.max(10, 30 - offenseCount); // Reduce expiry time with offenses
//   redis.setex(key, expiry, count + 1);
//   next();
// }

// // **Export Middleware**
// module.exports = {
//   rateLimitMiddleware,
//   trackSuspiciousActivity,
// };
