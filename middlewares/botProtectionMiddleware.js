const { RateLimiterRedis } = require('rate-limiter-flexible');
const User = require('../models/userModel');
const redis = require('../config/ioredis');
const createLogger = require('../utils/logger');

// Create a logger instance for this module
const logger = createLogger('rateLimiter.log');

// Rate Limiter Configuration
const rateLimiterConfig = {
  keyPrefix: 'rate-limit',
  points: 20, // Allowed requests per duration
  duration: 10, // Time window in seconds
  warningThreshold: 10, // Requests triggering warnings
  temporaryBlockDuration: 15 * 60, // 15 minutes in seconds
  permanentBlockThreshold: 5, // Offense count for permanent block
  permanentBlockDuration: 24 * 60 * 60, // 24 hours in seconds
  frequentRequestInterval: 500, // Frequent requests threshold in milliseconds
};

// Create RateLimiter Instance
const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: rateLimiterConfig.keyPrefix,
  points: rateLimiterConfig.points,
  duration: rateLimiterConfig.duration,
});

// Helper: Log Suspicious Activity
async function logActivity(ip, message) {
  const timestamp = new Date().toISOString();
  const logKey = `suspicious_activity:${ip}`;
  const logEntry = `${timestamp}: ${message}`;

  // Log to Redis
  await redis.lpush(logKey, logEntry);
  await redis.expire(logKey, rateLimiterConfig.temporaryBlockDuration);

  // Log to file
  logger.info({ ip, message });
}

// Helper: Handle Offense and Block Logic
async function handleOffense(ip, currentOffenses, res) {
  currentOffenses++;
  const offenseKey = `offenses:${ip}`;

  if (currentOffenses >= rateLimiterConfig.permanentBlockThreshold) {
    await redis.set(
      `block_rate:${ip}`,
      'permanent',
      'EX',
      rateLimiterConfig.permanentBlockDuration,
    );
    await logActivity(ip, 'User permanently blocked due to repeated offenses.');
    return res.status(403).json({ message: 'Access permanently denied.' });
  }

  const blockDuration =
    Math.pow(2, currentOffenses) * rateLimiterConfig.temporaryBlockDuration;
  await redis.set(`block_rate:${ip}`, 'temporary', 'EX', blockDuration);
  await redis.set(
    offenseKey,
    currentOffenses,
    'EX',
    rateLimiterConfig.permanentBlockDuration,
  );

  await logActivity(
    ip,
    `User temporarily blocked for ${blockDuration / 60} minutes due to exceeding rate limits.`,
  );
  return res
    .status(429)
    .json({ message: 'Access temporarily denied. Try again later.' });
}

// Middleware: Rate Limiting and Frequent Request Detection
const rateLimitMiddleware = async (req, res, next) => {
  const ip = req.ip;
  const offenseKey = `offenses:${ip}`;
  const frequentKey = `frequent:${ip}`;
  const currentOffenses = parseInt(await redis.get(offenseKey), 10) || 0;
  const now = Date.now();

  // Check for existing block
  const blockStatus = await redis.get(`block_rate:${ip}`);
  if (blockStatus === 'permanent') {
    return res.status(403).json({ message: 'Access permanently denied.' });
  }
  if (blockStatus === 'temporary') {
    return res
      .status(429)
      .json({ message: 'Access temporarily denied. Try again later.' });
  }

  try {
    // Consume a point from rate limiter
    await rateLimiter.consume(ip);

    // Check for frequent requests
    const lastRequestTime = parseInt(await redis.get(frequentKey), 10) || 0;
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest <= rateLimiterConfig.frequentRequestInterval) {
      await logActivity(ip, 'Frequent requests detected.');
      await handleOffense(ip, currentOffenses, res);
      return;
    }

    // Update the frequent request tracking key
    await redis.set(frequentKey, now, 'EX', rateLimiterConfig.duration);

    next();
  } catch (rateLimiterRes) {
    // Offense escalation and blocking logic
    await handleOffense(ip, currentOffenses, res);
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
