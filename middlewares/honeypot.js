const redis = require('../config/ioredis');
const RULES = require('../config/rules');
const logger = require('../utils/logger');
const { notifyAdmin } = require('../utils/notifications');

module.exports = async (req, res, next) => {
  const ip = req.ip;
  const redisKey = `honeypot:${ip}`;

  try {
    const whitelistedIPs = await RULES.whitelistedIPs();
    if (whitelistedIPs.includes(ip)) return next();

    const isHoneypotTrigger =
      RULES.honeypot.fakeEndpoints.includes(req.path) ||
      RULES.honeypot.decoyAssets.some((asset) => req.path.includes(asset));

    if (isHoneypotTrigger) {
      const honeypotInfo = JSON.parse((await redis.get(redisKey)) || '{}');
      honeypotInfo.triggers = (honeypotInfo.triggers || 0) + 1;

      if (honeypotInfo.triggers >= RULES.honeypot.permanentBlockThreshold) {
        await redis.set(redisKey, JSON.stringify(honeypotInfo), 'EX', RULES.blocking.maxBlockDuration);
        await notifyAdmin(ip, 'Triggered honeypot threshold.');
        return res.status(403).json({ message: 'Permanently blocked due to honeypot triggers.' });
      }

      const blockDuration = honeypotInfo.triggers * RULES.blocking.baseBlockDuration;
      await redis.set(redisKey, JSON.stringify(honeypotInfo), 'EX', blockDuration);
      return res.status(403).json({ message: RULES.honeypot.fakeResponseText });
    }

    next();
  } catch (err) {
    logger.error('[ERROR] Honeypot Detection:', err);
    next();
  }
};
