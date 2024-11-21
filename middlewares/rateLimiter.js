// middlewares/rateLimiter.js
const redis = require('../config/ioredis');
const RULES = require('../config/rules');
const createLogger = require('../utils/logger');

const logger = createLogger('rateLimiter.log');

module.exports = async (req, res, next) => {
  const ip = req.ip;
  const endpointKey = `${ip}:${req.path}`;

  try {
    const requestCount = await redis.incr(endpointKey);
    if (requestCount === 1) await redis.expire(endpointKey, RULES.requestLimits.timeWindow);

    if (requestCount > RULES.requestLimits.userRequestLimit) {
      return res.status(429).json({ message: 'Too many requests. Try again later.' });
    }

    next();
  } catch (err) {
    logger.error('[ERROR] Rate Limiter:', err);
    res.status(503).send('Service unavailable.');
  }
};
