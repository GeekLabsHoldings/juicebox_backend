const { RateLimiterRedis } = require('rate-limiter-flexible');
const User = require('../models/userModel');
const redis = require('../config/ioredis');
const config = require('config');
const winston = require('winston');

// **Logger**
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/suspicious_rate.log' }),
  ],
});

// **Utility: Log Suspicious Activity**
async function logSuspiciousActivity(ip, message) {
  const logKey = `suspicious_rate:${ip}`;
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp}: ${message}`;
  await redis.lpush(logKey, logEntry);
  await redis.expire(logKey, 300); // Logs expire after 5 minutes
  logger.info({ ip, message });
}

// **Middleware: Rate Limiting**
const rateLimiterConfig = config.get('rateLimiter');
const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: rateLimiterConfig.keyPrefix,
  points: rateLimiterConfig.points,
  duration: rateLimiterConfig.duration,
  blockDuration: rateLimiterConfig.blockDuration,
});

async function rateLimitMiddleware(req, res, next) {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch {
    await logSuspiciousActivity(req.ip, 'Rate limit exceeded.');
    res
      .status(429)
      .json({ message: 'Too many requests, please try again later.' });
  }
}

/* Middleware: Track Suspicious Activity */
async function handleUserBlock(user, blockDuration, res) {
  const currentTime = Date.now();

  // Check if the user is already blocked
  if (user.isBlocked && user.blockExpiresAt > currentTime) {
    return res
      .status(403)
      .json({ message: 'Your account has been temporarily blocked.' });
  }

  // Block the user for the specified duration
  await temporarilyBlockUser(user._id, blockDuration);
  return res.status(403).json({
    message: `Suspicious activity detected. Your account has been temporarily blocked for ${blockDuration / 1000 / 60} minutes.`,
  });
}

async function temporarilyBlockUser(userId, blockDuration) {
  const user = await User.findById(userId);
  if (user) {
    const currentTime = Date.now();

    // If the user is already blocked and the block duration has expired, reset their status
    if (user.isBlocked && user.blockExpiresAt <= currentTime) {
      user.isBlocked = false;
      user.blockExpiresAt = null;
      await user.save();
      console.log(`Block expired for user ${user.email}. Status reset.`);
    }

    // If the user is not blocked, block them for the specified duration
    if (!user.isBlocked) {
      user.isBlocked = true;
      user.blockExpiresAt = currentTime + blockDuration; // Use the passed duration
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
  const SUSPICIOUS_THRESHOLD = 20;
  const BLOCK_THRESHOLD = 30;

  const count = parseInt(await redis.get(key), 10) || 0;

  // Handle suspicious activity
  if (count >= SUSPICIOUS_THRESHOLD) {
    if (req.user) {
      const user = await User.findOne({ email: req.user.email });
      if (user) {
        const blockDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
        return await handleUserBlock(user, blockDuration, res);
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
      const blockDuration = 60 * 60 * 1000; // 1 hour in milliseconds
      return await handleUserBlock(user, blockDuration, res);
    }
    return res.status(404).json({ message: 'User not found' });
  }

  // Increment the request count
  redis.setex(key, 10, count + 1);
  next();
}

// **Export Middleware**
module.exports = {
  rateLimitMiddleware,
  trackSuspiciousActivity,
};
