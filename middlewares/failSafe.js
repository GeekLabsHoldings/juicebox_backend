const redis = require('../config/ioredis');
const RULES = require('../config/rules');
const logger = require('../utils/logger');

module.exports = async (req, res, next) => {
  try {
    const failSafeStatus = await redis.get('globalFailSafeActive');
    if (failSafeStatus) return res.redirect('/maintenance.html');

    const requestCount = await redis.incr('globalRequestCount');
    if (requestCount === 1) await redis.expire('globalRequestCount', RULES.failSafe.duration);

    if (requestCount > RULES.failSafe.maxAllowedRequests) {
      await RULES.failSafe.globalFailSafeAction();
      return res.status(503).json({ message: 'Service temporarily unavailable.' });
    }

    next();
  } catch (err) {
    logger.error('[ERROR] Fail-Safe Mechanism:', err);
    next();
  }
};
