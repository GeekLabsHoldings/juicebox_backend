// const redis = require('../config/ioredis');
// const { createLogger } = require('../utils/logger');
// const { getClientIp } = require('request-ip');
// const crypto = require('crypto');
// const schedule = require('node-schedule');

// // Logger instance
// const logger = createLogger();

// // Configuration Constants
// const RULES = {
//   blocking: {
//     baseBlockDuration: 10 * 60, // 10 minutes in seconds
//     maxBlockDuration: 7 * 24 * 60 * 60, // 7 days in seconds
//   },
//   botDetection: {
//     suspiciousUserAgentPatterns: [
//       /bot|crawler|spider|scraper|headless|selenium|phantomjs/i, // Original patterns
//       /python-requests|http\.client|urllib|java\/\d|node-fetch/i, // Programming languages and libraries
//       /wget|curl|powershell|libwww-perl|mechanize/i, // Command-line tools and scripts
//       /chrome\/\d+\.\d+.*headless/i, // Headless Chrome detection
//       /^Mozilla\/5\.0.*Selenium/i, // Selenium disguised as Mozilla
//       /go-http-client/i, // Go language HTTP clients
//       /axios|okhttp|guzzlehttp|restsharp/i, // Popular HTTP client libraries
//       /puppeteer|playwright|headlessbrowser/i, // Headless browser automation tools
//       /aiohttp|scrapy|twisted/i, // Python frameworks for scraping
//       /feedfetcher|googlebot|bingbot|yandexbot|baiduspider/i, // Search engine bots (if not whitelisted)
//       /ApacheBench|phantomjs|jsdom/i, // Benchmarking tools and simulated browsers
//       /cfnetwork|libcurl|fetch/i, // Networking libraries
//     ],
//     customBotIPs: async () => redis.smembers('customBotIPs'),
//   },
  // honeypot: {
  //   fakeEndpoints: () =>
  //     Array.from({ length: 3 }, () => `/trap-${crypto.randomUUID()}`),
  //   decoyAssets: () =>
  //     Array.from({ length: 3 }, () => `/asset-${crypto.randomUUID()}`),
  //   fakeFieldNames: () => {
  //     const fields = ['username', 'email', 'password', 'phoneNumber'];
  //     return fields.reduce((acc, field) => {
  //       acc[field] = Buffer.from(
  //         `${field}_${crypto.randomBytes(4).toString('hex')}`,
  //       ).toString('base64');
  //       return acc;
  //     }, {});
  //   },
  // },
//   whitelistedIPs: async () => redis.smembers('whitelistedIPs'),
// };

// // Schedule regular honeypot rotation
// schedule.scheduleJob('0 * * * *', () => {
//   RULES.honeypot.fakeEndpoints = () => [
//     `/trap-${crypto.randomUUID()}`,
//     `/bait-${crypto.randomUUID()}`,
//     `/secret-${crypto.randomUUID()}.json`,
//   ];
//   RULES.honeypot.decoyAssets = () => [
//     `/fake-${crypto.randomUUID()}.js`,
//     `/trap-${crypto.randomUUID()}.png`,
//   ];
//   logger.info('Honeypot traps rotated successfully.');
// });

// // Utility Functions
// const generateDecoyResponse = () => {
//   const randomFields = ['firstName', 'lastName', 'email', 'avatar'];
//   return randomFields.reduce((acc, field) => {
//     acc[field] =
//       field === 'avatar'
//         ? `/avatars/${crypto.randomUUID()}.png`
//         : `${field}-${crypto.randomBytes(4).toString('hex')}@fake.com`;
//     return acc;
//   }, {});
// };

// const calculateBlockDuration = (abuseScore) => {
//   const { baseBlockDuration, maxBlockDuration } = RULES.blocking;
//   const scaledDuration =
//     baseBlockDuration +
//     ((maxBlockDuration - baseBlockDuration) * abuseScore) / 100;
//   return Math.min(scaledDuration, maxBlockDuration);
// };

// const checkIPReputation = async (ip) => {
//   try {
//     const whitelistedIPs = await RULES.whitelistedIPs();
//     if (whitelistedIPs.includes(ip)) return false;

//     const ipData = JSON.parse((await redis.get(`ipReputation:${ip}`)) || '{}');
//     return ipData.abuseScore || 0;
//   } catch (err) {
//     logger.error(`Error checking IP reputation: ${err.message}`);
//     return 0;
//   }
// };

// const updateIPReputation = async (ip, event) => {
//   try {
//     const ipData = JSON.parse((await redis.get(`ipReputation:${ip}`)) || '{}');
//     const currentScore = ipData.abuseScore || 0;

//     const increment =
//       {
      //   honeypot: 20,
      //   bot: 30,
      //   malicious: 10,
      // }[event] || 0;

//     const newScore = Math.min(currentScore + increment, 100);
//     await redis.set(
//       `ipReputation:${ip}`,
//       JSON.stringify({
//         abuseScore: newScore,
//         reportCount: (ipData.reportCount || 0) + 1,
//         lastReported: new Date().toISOString(),
//       }),
//       'EX',
//       RULES.blocking.maxBlockDuration,
//     );

//     return newScore;
//   } catch (err) {
//     logger.error(`Error updating IP reputation: ${err.message}`);
//     return 0;
//   }
// };

// // Middleware
// const enhancedBotDetection = async (req, res, next) => {
//   const ip = getClientIp(req);
//   const userAgent = req.headers['user-agent'] || 'unknown';

//   try {
//     const isBot = RULES.botDetection.suspiciousUserAgentPatterns.some(
//       (pattern) => pattern.test(userAgent),
//     );

//     const abuseScore = await checkIPReputation(ip);

//     if (isBot || abuseScore >= 30) {
//       logger.warn(`Throttling IP: ${ip} due to suspicious behavior.`);
//       res.set('Retry-After', 30);
//     }

//     if (abuseScore >= 50) {
//       const newScore = await updateIPReputation(
//         ip,
//         isBot ? 'bot' : 'malicious',
//       );
//       const blockDuration = calculateBlockDuration(newScore);

//       await redis.set(`bot_block:${ip}`, true, 'EX', blockDuration);
//       logger.warn(
//         `Blocked IP: ${ip} for ${Math.ceil(blockDuration / 60)} minutes`,
//       );

//       return res.status(403).json({
//         message: `Access denied. Blocked for ${Math.ceil(blockDuration / 60)} minutes.`,
//       });
//     }

//     next();
//   } catch (err) {
//     logger.error(`Error in enhanced bot detection: ${err.message}`);
//     res.status(503).send('Service unavailable.');
//   }
// };

// const honeypot = async (req, res, next) => {
//   const ip = getClientIp(req);

//   try {
//     const fakeEndpoints = RULES.honeypot.fakeEndpoints();
//     const decoyAssets = RULES.honeypot.decoyAssets();

//     const isHoneypotTrigger =
//       fakeEndpoints.includes(req.path) ||
//       decoyAssets.some((asset) => req.path.includes(asset));

//     if (isHoneypotTrigger) {
//       const newScore = await updateIPReputation(ip, 'honeypot');
//       const blockDuration = calculateBlockDuration(newScore);

//       await redis.set(`honeypot_block:${ip}`, true, 'EX', blockDuration);
//       logger.warn(
//         `Honeypot triggered. Blocked IP: ${ip} for ${Math.ceil(blockDuration / 60)} minutes`,
//       );

//       return res.status(403).json({
//         message: 'Access forbidden.',
//         decoyData: generateDecoyResponse(),
//         fakeFields: RULES.honeypot.fakeFieldNames(),
//       });
//     }

//     next();
//   } catch (err) {
//     logger.error(`Error in honeypot detection: ${err.message}`);
//     next();
//   }
// };

// module.exports = { enhancedBotDetection, honeypot };

const redis = require('../config/ioredis');
const fetch = require('node-fetch');
const { createLogger } = require('../utils/logger');
const { getClientIp } = require('request-ip');

// Create a logger instance for this module
const logger = createLogger();

// Rules Configuration
const RULES = {
  blocking: {
    baseBlockDuration: 10 * 60, // 10 minutes
    maxBlockDuration: 7 * 24 * 60 * 60, // 7 days
    escalationFactor: 2,
    blockDecayRate: 0.33, // Reduce block duration daily by 33%
  },
  botDetection: {
    suspiciousUserAgentPatterns: [
      /bot|crawler|spider|scraper|headless|selenium|phantomjs/i, // Original patterns
      /python-requests|http\.client|urllib|java\/\d|node-fetch/i, // Programming languages and libraries
      /wget|curl|powershell|libwww-perl|mechanize/i, // Command-line tools and scripts
      /chrome\/\d+\.\d+.*headless/i, // Headless Chrome detection
      /^Mozilla\/5\.0.*Selenium/i, // Selenium disguised as Mozilla
      /go-http-client/i, // Go language HTTP clients
      /axios|okhttp|guzzlehttp|restsharp/i, // Popular HTTP client libraries
      /puppeteer|playwright|headlessbrowser/i, // Headless browser automation tools
      /aiohttp|scrapy|twisted/i, // Python frameworks for scraping
      /feedfetcher|googlebot|bingbot|yandexbot|baiduspider/i, // Search engine bots (if not whitelisted)
      /ApacheBench|phantomjs|jsdom/i, // Benchmarking tools and simulated browsers
      /cfnetwork|libcurl|fetch/i, // Networking libraries
    ],
    logUnknownUserAgents: true,
    customBotIPs: async () => redis.smembers('customBotIPs'),
  },
  honeypot: {
    enabled: true,
    fakeEndpoints: ['/trap-api', '/forbidden/secret'],
    hiddenFieldName: () => `fake_field_${Math.random().toString(36).slice(2)}`,
    decoyAssets: ['/fake.js', '/bait.png'],
    fakeResponseText: 'Access forbidden.',
    permanentBlockThreshold: 3,
  },
  whitelistedIPs: async () => redis.smembers('whitelistedIPs'),
};

// Utility: Log Activity
const logActivity = async (type, details) => {
  logger.info({ type, details, timestamp: new Date() });
};

const calculateBlockDuration = (abuseScore) => {
  const { baseBlockDuration, maxBlockDuration } = RULES.blocking;
  const scaledDuration =
    baseBlockDuration +
    ((maxBlockDuration - baseBlockDuration) * abuseScore) / 100;
  return Math.min(scaledDuration, maxBlockDuration);
};

// Utility: Check IP Reputation
const checkIPReputation = async (ip) => {
  try {
    if (!process.env.ABUSEIPDB_API_KEY) {
      logger.warn('AbuseIPDB API key is not set.');
      return false;
    }

    const response = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}`,
      {
        headers: {
          Key: process.env.ABUSEIPDB_API_KEY,
          Accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `AbuseIPDB request failed with status: ${response.status}`,
      );
    }

    const reputation = await response.json();
    return reputation?.data?.abuseConfidenceScore >= 50;
  } catch (err) {
    logger.error('[ERROR] IP Reputation Check:', err.message);
    return false;
  }
};

// Middleware: Enhanced Bot Detection
const enhancedBotDetection = async (req, res, next) => {
  const ip = getClientIp(req);
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

    const isBot = RULES.botDetection.suspiciousUserAgentPatterns.some(
      (pattern) => pattern.test(userAgentString),
    );

    const isMaliciousIP = await checkIPReputation(ip);

    if (isBot || isMaliciousIP) {
      const abuseScore = isBot ? 50 : isMaliciousIP ? 75 : 0;
      const blockDuration = calculateBlockDuration(abuseScore);
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
    logger.error('[ERROR] Enhanced Bot Detection:', err.message);
    return res.status(503).send('Service unavailable.');
  }
};

// Middleware: Honeypot Detection
const honeypot = async (req, res, next) => {
  const ip = getClientIp(req);
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

      const abuseScore = Math.min(honeypotInfo.triggers * 20, 100);
      const blockDuration = calculateBlockDuration(abuseScore);

      if (honeypotInfo.triggers >= RULES.honeypot.permanentBlockThreshold) {
        await redis.set(
          redisKey,
          JSON.stringify(honeypotInfo),
          'EX',
          RULES.blocking.maxBlockDuration,
        );
        return res
          .status(403)
          .json({ message: 'Permanently blocked due to honeypot triggers.' });
      }
      await redis.set(
        redisKey,
        JSON.stringify(honeypotInfo),
        'EX',
        blockDuration,
      );
      return res.status(403).json({ message: RULES.honeypot.fakeResponseText });
    }

    next();
  } catch (err) {
    logger.error('[ERROR] Honeypot Detection:', err);
    next();
  }
};

// Export Middleware
module.exports = { enhancedBotDetection, honeypot };
