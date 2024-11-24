const redis = require('../config/ioredis');
const useragent = require('useragent');
const logger = require('../utils/logger').createLogger();
const logActivity = require('../utils/logger').logActivity;
const RULES = require('../config/rules');

const botDetection = async (req, res, next) => {
  const ip = req.ip;
  const userAgentString = req.headers['user-agent'] || 'unknown';
  const now = Date.now();
  const blockKey = `bot_block:${ip}`;

  try {
    const blockStatus = await redis.get(blockKey);
    if (blockStatus) {
      const remainingTime = Math.ceil((parseInt(blockStatus) - now) / 1000);
      res.setHeader('Retry-After', remainingTime);
      return res
        .status(403)
        .json({ message: `Blocked. Retry after ${remainingTime} seconds.` });
    }

    const agent = useragent.parse(userAgentString);
    const isBot =
      RULES.botDetection.suspiciousUserAgentPatterns.some((pattern) =>
        pattern.test(userAgentString.toLowerCase()),
      ) ||
      agent.device.family === 'Spider' ||
      agent.device.family === 'Bot';

    if (isBot) {
      const blockDuration = RULES.blocking.baseBlockDuration;
      await redis.set(
        blockKey,
        now + blockDuration * 1000,
        'EX',
        blockDuration,
      );
      await logActivity('BOT_DETECTION', { ip, userAgent: userAgentString });
      return res.status(403).json({ message: 'Bot detected. Access denied.' });
    }

    next();
  } catch (err) {
    logger.error('[ERROR] Bot Detection:', err);
    return res.status(503).send('Service unavailable.');
  }
};

module.exports = botDetection;

// const redis = require('../config/ioredis');
// const useragent = require('useragent');
// const RULES = require('../config/rules');
// const createLogger = require('../utils/logger');
// const logActivity = require('../utils/logger').logActivity;

// const logger = createLogger();

// module.exports = async (req, res, next) => {
//   const ip = req.ip;
//   const userAgent = req.headers['user-agent'] || 'unknown';
//   const blockKey = `bot_block:${ip}`;
//   const now = Date.now();

//   try {
//     // Check if already blocked
//     const blockStatus = await redis.get(blockKey);
//     if (blockStatus) {
//       const remaining = Math.ceil((parseInt(blockStatus) - now) / 1000);
//       res.setHeader('Retry-After', remaining);
//       return res.status(403).json({ message: `Blocked. Retry after ${remaining}s.` });
//     }

//     // Detect bots
//     const isBot = RULES.botDetection.suspiciousUserAgentPatterns.some((pattern) =>
//       pattern.test(userAgent.toLowerCase())
//     );

//     if (isBot) {
//       const blockDuration = RULES.blocking.baseBlockDuration;
//       await redis.set(blockKey, now + blockDuration * 1000, 'EX', blockDuration);
//       await logActivity('BOT_DETECTION', { ip, userAgent });
//       return res.status(403).json({ message: 'Bot detected. Access denied.' });
//     }

//     next();
//   } catch (err) {
//     logger.error('[ERROR] Bot Detection:', err);
//     res.status(503).send('Service unavailable.');
//   }
// };
