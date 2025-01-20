const redis = require('../config/ioredis');
const fetch = require('node-fetch');
const { getClientIp } = require('request-ip');

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
    console.log('ERROR IP Reputation Check:', err.message);
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

      return res.status(403).json({ message: 'Bot detected. Access denied.' });
    }

    next();
  } catch (err) {
    console.log('ERROR Enhanced Bot Detection:', err.message);
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
    console.log('ERROR Honeypot Detection:', err);
    next();
  }
};

// Export Middleware
module.exports = { enhancedBotDetection, honeypot };
