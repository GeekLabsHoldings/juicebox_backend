const redis = require('../config/ioredis');
const useragent = require('useragent');
const createLogger = require('../utils/logger');

// Create a logger instance for this module
const logger = createLogger();

// Configuration for Rules
const RULES = {
  requestLimits: {
    globalRequestLimit: 2000,
    userRequestLimit: 100,
    timeWindow: 60, // seconds
    burstLimit: 50,
    burstWindow: 10, // seconds
    rateAdjustmentFactor: 1.2,
  },
  blocking: {
    baseBlockDuration: 10 * 60, // 10 minutes
    maxBlockDuration: 7 * 24 * 60 * 60, // 7 days
    escalationFactor: 2,
    blockDecayRate: 0.33, // Reduce block duration daily by 33%
  },
  botDetection: {
    suspiciousUserAgentPatterns: [
      /bot|crawler|spider|scraper|headless|selenium|phantomjs/i,
    ],
    logUnknownUserAgents: true,
    customBotIPs: async () => await redis.smembers('customBotIPs'),
  },
  honeypot: {
    enabled: true,
    fakeEndpoints: ['/trap-api', '/forbidden/secret'],
    hiddenFieldName: () => `fake_field_${Math.random().toString(36).slice(2)}`,
    decoyAssets: ['/fake.js', '/bait.png'],
    fakeResponseText: 'Access forbidden.',
    permanentBlockThreshold: 3,
  },
  failSafe: {
    enabled: true,
    maxAllowedRequests: 1000,
    duration: 300, // seconds
    globalFailSafeAction: async () => {
      logger.warn('Activating fail-safe. Redirecting traffic.');
      await redis.set('globalFailSafeActive', true, 'EX', 660);
    },
  },
  whitelistedIPs: async () => await redis.smembers('whitelistedIPs'),
};

// Utility: Logging
const logSuspiciousActivity = async (ip, action) => {
  await redis.xadd('activity_log', '*', 'ip', ip, 'action', action, 'timestamp', Date.now());
};

const checkIPReputation = async (ip) => {
  try {
    const response = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}`,
      {
        headers: { Key: 'YOUR_API_KEY' },
      }
    );
    const reputation = await response.json();
    return reputation?.data?.abuseConfidenceScore >= 50;
  } catch (error) {
    logger.error(`IP Reputation Check Failed for ${ip}: ${error}`);
    return false; // Default to non-malicious if check fails
  }
};

const notifyAdmin = async (ip, reason) => {
  try {
    await sendEmail('admin@example.com', `Suspicious activity detected from IP: ${ip}, Reason: ${reason}`);
    logger.info(`Admin notified for IP ${ip}: ${reason}`);
  } catch (error) {
    logger.error(`Failed to notify admin for IP ${ip}: ${error}`);
  }
};

// Middleware: Enhanced Bot Detection
const enhancedBotDetection = async (req, res, next) => {
  const ip = req.ip;
  const userAgent = req.headers['user-agent'] || 'unknown';
  let score = 0;

  try {
    // User-Agent Analysis
    if (RULES.botDetection.suspiciousUserAgentPatterns.some((pattern) => pattern.test(userAgent))) {
      score += 5;
    }

    // IP Reputation Check
    if (await checkIPReputation(ip)) {
      score += 10;
    }

    // Block Logic Based on Score
    if (score >= 10) {
      const blockDuration = RULES.blocking.baseBlockDuration * RULES.blocking.escalationFactor;
      await redis.set(`bot_block:${ip}`, true, 'EX', blockDuration);
      logger.warn(`IP ${ip} blocked due to bot detection.`);
      return res.status(403).json({ message: 'Bot detected. Access denied.' });
    }

    next();
  } catch (error) {
    logger.error(`[ERROR] Enhanced Bot Detection for IP ${ip}: ${error}`);
    res.status(503).send('Service Unavailable');
  }
};

// Middleware: Honeypot Detection
const honeypot = async (req, res, next) => {
  const ip = req.ip;
  if (RULES.honeypot.fakeEndpoints.includes(req.path)) {
    const honeypotCount = await redis.incr(`honeypot:${ip}`);
    if (honeypotCount === 1) {
      await redis.expire(`honeypot:${ip}`, 24 * 60 * 60);
    }

    if (honeypotCount >= RULES.honeypot.permanentBlockThreshold) {
      await redis.set(`block:${ip}`, true, 'EX', RULES.blocking.maxBlockDuration);
      await notifyAdmin(ip, 'Triggered honeypot threshold');
      logger.warn(`IP ${ip} permanently blocked due to honeypot activity.`);
      return res.status(403).send('Access permanently denied.');
    }

    logger.warn(`Honeypot triggered by IP ${ip}.`);
    return res.status(403).send('Access denied.');
  }
  next();
};

// Middleware: Fail-Safe Mechanism
const failSafe = async (req, res, next) => {
  const ip = req.ip;
  try {
    const whitelistedIPs = await RULES.whitelistedIPs();
    if (whitelistedIPs.includes(ip)) return next(); // Exempt whitelisted IPs

    const isFailSafeActive = await redis.get('globalFailSafeActive');
    if (isFailSafeActive) {
      logger.warn(`Fail-safe active. Redirecting IP ${ip}.`);
      return res.redirect('/maintenance.html');
    }

    const requestCount = await redis.incr('globalRequestCount');
    if (requestCount === 1) {
      await redis.expire('globalRequestCount', RULES.failSafe.duration);
    }

    if (requestCount > RULES.failSafe.maxAllowedRequests) {
      await RULES.failSafe.globalFailSafeAction();
      return res.status(503).send('Service temporarily unavailable.');
    }

    next();
  } catch (error) {
    logger.error(`[ERROR] Fail-Safe Mechanism for IP ${ip}: ${error}`);
    next();
  }
};

// Export Middleware
module.exports = { enhancedBotDetection, honeypot, failSafe };

// const redis = require('../config/ioredis');
// const useragent = require('useragent');
// const createLogger = require('../utils/logger');

// // Create a logger instance for this module
// const logger = createLogger();

// // Configuration for Rules
// const RULES = {
//   requestLimits: {
//     globalRequestLimit: 2000,
//     userRequestLimit: 100,
//     timeWindow: 60, // seconds
//     burstLimit: 50,
//     burstWindow: 10, // seconds
//     rateAdjustmentFactor: 1.2,
//   },
//   blocking: {
//     baseBlockDuration: 10 * 60, // 10 minutes
//     maxBlockDuration: 7 * 24 * 60 * 60, // 7 days
//     escalationFactor: 2,
//     blockDecayRate: 0.33, // Reduce block duration daily by 33%
//   },
//   botDetection: {
//     suspiciousUserAgentPatterns: [
//       /bot|crawler|spider|scraper|headless|selenium|phantomjs/i,
//     ],
//     logUnknownUserAgents: true,
//     customBotIPs: async () => await redis.smembers('customBotIPs'),
//   },
//   honeypot: {
//     enabled: true,
//     fakeEndpoints: ['/trap-api', '/forbidden/secret'],
//     hiddenFieldName: () => `fake_field_${Math.random().toString(36).slice(2)}`,
//     decoyAssets: ['/fake.js', '/bait.png'],
//     fakeResponseText: 'Access forbidden.',
//     permanentBlockThreshold: 3,
//   },
//   failSafe: {
//     enabled: true,
//     maxAllowedRequests: 1000,
//     duration: 300, // seconds
//     globalFailSafeAction: async () => {
//       logger.warn('Activating fail-safe. Redirecting traffic.');
//       await redis.set('globalFailSafeActive', true, 'EX', 660);
//     },
//   },
//   whitelistedIPs: async () => await redis.smembers('whitelistedIPs'),
// };

// // Utility: Logging
// const logActivity = async (type, details) => {
//   logger.info({ type, details, timestamp: new Date() });
// };

// // Middleware: Enhanced Bot Detection
// const enhancedBotDetection = async (req, res, next) => {
//   const ip = req.ip;
//   const userAgentString = req.headers['user-agent'] || "unknown";
//   const now = Date.now();
//   const blockKey = `bot_block:${ip}`;

//   // Define invalid User-Agent strings
//   const invalidUserAgents = ["", "unknown", "Mozilla/5.0"];

//   try {
//     // Check if IP is already blocked
//     const blockStatus = await redis.get(blockKey);

//     if (blockStatus) {
//       const remainingTime = Math.ceil((parseInt(blockStatus) - now) / 1000);
//       res.setHeader("Retry-After", remainingTime);
//       return res
//         .status(403)
//         .json({ message: `Blocked. Retry after ${remainingTime} seconds.` });
//     }

//     // Parse the User-Agent string using useragent
//     const agent = useragent.parse(userAgentString);
//     const isBot =
//       RULES.botDetection.suspiciousUserAgentPatterns.some((pattern) =>
//         pattern.test(userAgentString.toLowerCase())
//       ) ||
//       invalidUserAgents.includes(userAgentString) ||
//       agent.device.family === "Spider" ||
//       agent.device.family === "Bot";

//     if (isBot) {
//       // Block the IP and log activity
//       const blockDuration = RULES.blocking.baseBlockDuration;
//       await redis.set(
//         blockKey,
//         now + blockDuration * 1000,
//         "EX",
//         blockDuration
//       );
//       await logActivity("BOT_DETECTION", { ip, userAgent: userAgentString });
//       return res.status(403).json({ message: "Bot detected. Access denied." });
//     }

//     next();
//   } catch (err) {
//     logger.error("[ERROR] Bot Detection:", err);
//     return res.status(503).send("Service unavailable.");
//   }
// };

// // Middleware: Honeypot Detection
// const honeypot = async (req, res, next) => {
//   const ip = req.ip;
//   const redisKey = `honeypot:${ip}`;

//   try {
//     // Await the resolved array of whitelisted IPs
//     const whitelistedIPs = await RULES.whitelistedIPs();

//     // Check if the IP is in the whitelist
//     if (whitelistedIPs.includes(ip)) return next();

//     const isHoneypotTrigger =
//       RULES.honeypot.fakeEndpoints.includes(req.path) ||
//       RULES.honeypot.decoyAssets.some((asset) => req.path.includes(asset));

//     if (isHoneypotTrigger) {
//       const honeypotInfo = JSON.parse((await redis.get(redisKey)) || '{}');
//       honeypotInfo.triggers = (honeypotInfo.triggers || 0) + 1;

//       if (honeypotInfo.triggers >= RULES.honeypot.permanentBlockThreshold) {
//         await redis.set(
//           redisKey,
//           JSON.stringify(honeypotInfo),
//           'EX',
//           RULES.blocking.maxBlockDuration,
//         );
//         return res
//           .status(403)
//           .json({ message: 'Permanently blocked due to honeypot triggers.' });
//       }

//       const blockDuration =
//         honeypotInfo.triggers * RULES.blocking.baseBlockDuration;
//       await redis.set(
//         redisKey,
//         JSON.stringify(honeypotInfo),
//         'EX',
//         blockDuration,
//       );
//       return res.status(403).json({ message: RULES.honeypot.fakeResponseText });
//     }

//     next();
//   } catch (err) {
//     logger.error('[ERROR] Honeypot Detection:', err);
//     next();
//   }
// };

// // Middleware: Fail-Safe Mechanism
// const failSafe = async (req, res, next) => {
//   try {
//     const failSafeStatus = await redis.get('globalFailSafeActive');
//     if (failSafeStatus) {
//       return res
//         .status(503)
//         .json({ message: 'Service temporarily unavailable.' });
//     }

//     const requestCount = await redis.incr('globalRequestCount');
//     if (requestCount === 1) {
//       await redis.expire('globalRequestCount', RULES.failSafe.duration);
//     }

//     if (requestCount > RULES.failSafe.maxAllowedRequests) {
//       await RULES.failSafe.globalFailSafeAction();
//       return res
//         .status(503)
//         .json({ message: 'Service temporarily unavailable.' });
//     }

//     next();
//   } catch (err) {
//     logger.error('[ERROR] Fail-Safe Mechanism:', err);
//     next();
//   }
// };

// // Export Middleware
// module.exports = { enhancedBotDetection, honeypot, failSafe };
