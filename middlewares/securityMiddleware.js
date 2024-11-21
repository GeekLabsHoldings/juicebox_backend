const redis = require('../config/ioredis');
const RULES = require('../config/rules');
const { logActivity } = require('../utils/logger');
const { notifyAdmin } = require('../utils/notifications');
const { checkIPReputation } = require('../services/ipReputation');

module.exports = async (req, res, next) => {
  const ip = req.ip;
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    // Whitelist check
    const whitelistedIPs = await RULES.whitelistedIPs();
    if (whitelistedIPs.includes(ip)) return next();

    // Honeypot detection
    const honeypotKey = `honeypot:${ip}`;
    const isHoneypot = RULES.honeypot.fakeEndpoints.includes(req.path) ||
                       RULES.honeypot.decoyAssets.some((asset) => req.path.includes(asset));

    if (isHoneypot) {
      const triggers = (JSON.parse(await redis.get(honeypotKey))?.triggers || 0) + 1;
      const blockDuration = triggers * RULES.blocking.baseBlockDuration;
      await redis.set(honeypotKey, JSON.stringify({ triggers }), 'EX', blockDuration);

      if (triggers >= RULES.honeypot.permanentBlockThreshold) {
        await notifyAdmin(ip, 'Triggered honeypot threshold.');
        return res.status(403).json({ message: 'Permanently blocked.' });
      }

      return res.status(403).json({ message: RULES.honeypot.fakeResponseText });
    }

    // Bot detection
    const isBot = RULES.botDetection.suspiciousUserAgentPatterns.some((pattern) =>
      pattern.test(userAgent)
    );
    if (isBot) {
      await redis.set(`bot_block:${ip}`, Date.now(), 'EX', RULES.blocking.baseBlockDuration);
      await logActivity('BOT_DETECTED', { ip, userAgent });
      return res.status(403).json({ message: 'Bot detected. Access denied.' });
    }

    // IP reputation check
    if (await checkIPReputation(ip)) {
      await logActivity('MALICIOUS_IP_DETECTED', { ip });
      return res.status(403).json({ message: 'Malicious activity detected. Access denied.' });
    }

    next();
  } catch (err) {
    const logger = require('../utils/logger')('securityMiddleware.log');
    logger.error(`[ERROR] Security Middleware: ${err.message}`);
    next();
  }
};
