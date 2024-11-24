const { RateLimiterRedis } = require('rate-limiter-flexible');
const User = require('../models/userModel');
const redis = require('../config/ioredis');
const requestIp = require('request-ip');
const { createLogger } = require('../utils/logger');

// Logger setup
const logger = createLogger('rateLimiter.log');

// Rate limiter configuration
const rateLimiterConfig = {
  keyPrefix: 'rate-limit',
  points: 20, // Allowed requests per window
  duration: 10, // Window duration in seconds
  warningThreshold: 10,
  baseTemporaryBlockDuration: 10 * 60, // 10 minutes
  escalationFactor: 1.5,
  decayTime: 30 * 60, // Reset offenses after 30 minutes
};

// Rate limiter instance
const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: rateLimiterConfig.keyPrefix,
  points: rateLimiterConfig.points,
  duration: rateLimiterConfig.duration,
});

// Get real client IP
const getClientIp = (req) => requestIp.getClientIp(req) || req.ip;

// Handle offenses and dynamic blocking
async function handleOffense(ip, res) {
  const offenseKey = `offense_count:${ip}`;
  const offenseData = JSON.parse((await redis.get(offenseKey)) || '{}');
  const currentOffenses = offenseData.count || 0;
  const lastOffenseTime = offenseData.timestamp || 0;

  const now = Date.now();
  offenseData.count =
    now - lastOffenseTime > rateLimiterConfig.decayTime * 1000
      ? 1
      : offenseData.count +
        Math.ceil(
          Math.log10(currentOffenses + 1) * rateLimiterConfig.escalationFactor,
        );

  offenseData.timestamp = now;

  const blockDuration = Math.round(
    rateLimiterConfig.baseTemporaryBlockDuration *
      Math.pow(rateLimiterConfig.escalationFactor, offenseData.count),
  );

  await redis.set(`rate_block:${ip}`, 'temporary', 'EX', blockDuration);
  await redis.set(
    offenseKey,
    JSON.stringify(offenseData),
    'EX',
    rateLimiterConfig.decayTime,
  );

  logger.warn(
    `IP ${ip} temporarily blocked for ${blockDuration / 60} minutes.`,
  );
  return res.status(429).json({
    message: `You have been temporarily blocked. Retry after ${blockDuration / 60} minutes.`,
  });
}

// Middleware: Rate limiting
const rateLimitMiddleware = async (req, res, next) => {
  const ip = getClientIp(req);

  const blockStatus = await redis.get(`rate_block:${ip}`);
  if (blockStatus) {
    return res.status(429).json({
      message:
        blockStatus === 'permanent'
          ? 'Access permanently denied.'
          : 'Access temporarily denied. Try again later.',
    });
  }

  try {
    await rateLimiter.consume(ip);
    next();
  } catch (rateLimiterRes) {
    await handleOffense(ip, res);
  }
};

// Middleware: Suspicious activity tracking
const trackSuspiciousActivity = async (req, res, next) => {
  const ip = getClientIp(req);
  const user = req.user;

  const requestKey = `requests:${ip}`;
  const requestCount = parseInt(await redis.get(requestKey), 10) || 0;

  const offenseCount =
    requestCount > rateLimiterConfig.warningThreshold
      ? Math.floor(requestCount / rateLimiterConfig.warningThreshold)
      : 0;

  if (requestCount >= rateLimiterConfig.warningThreshold) {
    if (user) {
      const userRecord = await User.findById(user._id);
      if (userRecord) {
        await temporarilyBlockUser(userRecord, offenseCount + 1);
        return res.status(403).json({
          message: 'Suspicious activity detected. User temporarily blocked.',
        });
      }
    }
    return res.status(403).json({
      message: 'Suspicious activity detected. Temporary block applied.',
    });
  }

  redis.setex(requestKey, 30 - offenseCount, requestCount + 1);
  next();
};

// Temporary user block
async function temporarilyBlockUser(user, offenseCount) {
  const now = Date.now();
  const blockDuration = Math.round(
    rateLimiterConfig.baseTemporaryBlockDuration *
      Math.pow(rateLimiterConfig.escalationFactor, offenseCount),
  );

  user.isBlocked = true;
  user.blockExpiresAt = now + blockDuration;
  await user.save();

  logger.info(
    `User ${user.email} blocked for ${blockDuration / 60 / 1000} minutes due to suspicious activity.`,
  );
}

module.exports = {
  rateLimitMiddleware,
  trackSuspiciousActivity,
};
