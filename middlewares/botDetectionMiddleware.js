const redis = require('../config/ioredis');

// Central Configuration for Dynamic Rules
const RULES = {
  requestLimit: 100,
  timeWindow: 60,
  burstLimit: 20,
  burstWindow: 5,
  baseBlockDuration: 15 * 60,
  maxBlockDuration: 30 * 24 * 60 * 60,
  escalationFactor: 2,
  suspiciousUserAgentPatterns: [/bot/i, /crawler/i, /spider/i],
  honeypotEnabled: true,
  failSafeRate: 0.1,
  honeypot: {
    fakeEndpoints: ['/hidden-api', '/private/debug'],
    hiddenFieldName: 'hidden_token',
    decoyAssets: ['/hidden-asset.js', '/private/resource.png'],
    fakeResponseText: 'This is a honeypot trap.',
    permanentBlockThreshold: 5,
  },
};

// Fail-safe: fallback behavior
const failSafeFallback = (req, res, next) => {
  console.warn(`Fail-safe triggered for IP: ${req.ip}, path: ${req.path}`);
  next();
};

// Utility: Calculate Dynamic Block Duration
function calculateBlockDuration(previousDuration, escalationFactor) {
  return Math.min(previousDuration * escalationFactor, RULES.maxBlockDuration);
}

// Middleware: Advanced Bot Detection
async function botDetection(req, res, next) {
  const ip = req.ip;
  const userAgent = req.headers['user-agent'] || 'unknown';
  const now = Date.now();
  const redisKey = `bot:${ip}`;
  const redisBlockKey = `block:${ip}`;

  try {
    // Fail-safe if Redis is down
    if (!redis.status || redis.status !== 'ready') {
      return failSafeFallback(req, res, next);
    }

    // Check Block Status
    const blockStatus = await redis.get(redisBlockKey);
    if (blockStatus) {
      const { level, expiresAt, duration } = JSON.parse(blockStatus);
      console.log(
        `Block info for ${ip}: Level: ${level}, Expires At: ${new Date(expiresAt).toISOString()}, Duration: ${duration}`,
      );
      if (expiresAt > now) {
        const blockMessage =
          level === 'PERMANENT_BLOCK'
            ? 'Your IP is permanently blocked.'
            : 'Your IP is temporarily blocked.';
        return res.status(403).json({ message: blockMessage });
      }
    }

    // User-Agent Analysis
    if (
      RULES.suspiciousUserAgentPatterns.some((pattern) =>
        pattern.test(userAgent),
      )
    ) {
      const duration = calculateBlockDuration(
        RULES.baseBlockDuration,
        RULES.escalationFactor,
      );
      await escalateBlocking(ip, redisBlockKey, 'TEMPORARY_BLOCK', duration);
      return res.status(403).json({
        message: 'Suspicious activity detected. Access temporarily blocked.',
      });
    }

    // Request Pattern Analysis
    const requestData = await redis.get(redisKey);
    let requestInfo = requestData
      ? JSON.parse(requestData)
      : { count: 0, firstRequestAt: now, violations: 0 };

    // Burst Check
    if (now - requestInfo.firstRequestAt <= RULES.burstWindow * 1000) {
      requestInfo.count += 1;
      if (requestInfo.count > RULES.burstLimit) {
        const duration = calculateBlockDuration(
          RULES.baseBlockDuration,
          ++requestInfo.violations,
        );
        await escalateBlocking(ip, redisBlockKey, 'TEMPORARY_BLOCK', duration);
        return res
          .status(429)
          .json({ message: 'Too many requests. You are temporarily blocked.' });
      }
    } else {
      requestInfo.count = 1; // Reset for next burst window
    }

    // Rate Limiting
    requestInfo.count += 1;
    if (requestInfo.count > RULES.requestLimit) {
      const duration = calculateBlockDuration(
        RULES.baseBlockDuration,
        ++requestInfo.violations,
      );
      await escalateBlocking(ip, redisBlockKey, 'TEMPORARY_BLOCK', duration);
      return res
        .status(429)
        .json({ message: 'Rate limit exceeded. Slow down.' });
    }

    // Time Window Reset
    if (now - requestInfo.firstRequestAt > RULES.timeWindow * 1000) {
      requestInfo = { count: 1, firstRequestAt: now, violations: 0 };
    }

    // Save Request Data
    await redis.set(
      redisKey,
      JSON.stringify(requestInfo),
      'EX',
      RULES.timeWindow,
    );

    next();
  } catch (err) {
    console.error('Bot detection middleware error:', err);
    failSafeFallback(req, res, next);
  }
}

// Escalate Blocking Logic
async function escalateBlocking(ip, redisBlockKey, level, duration) {
  const blockInfo = {
    level,
    expiresAt: Date.now() + duration * 1000,
    duration, // Track current duration for future adjustments
  };
  await redis.set(redisBlockKey, JSON.stringify(blockInfo), 'EX', duration);
  console.log(`IP ${ip} escalated to ${level} for ${duration} seconds`);
}

// Honeypot Middleware
async function honeypot(req, res, next) {
  if (!RULES.honeypotEnabled) return next();

  const ip = req.ip;
  const redisKey = `honeypot:${ip}`;

  // Detect Honeypot Interactions
  if (
    RULES.honeypot.fakeEndpoints.includes(req.path) ||
    RULES.honeypot.decoyAssets.some((asset) => req.path.includes(asset))
  ) {
    console.log(`Honeypot triggered by IP: ${ip}`);

    // Track and escalate honeypot interaction
    const honeypotData = await redis.get(redisKey);
    let honeypotInfo = honeypotData
      ? JSON.parse(honeypotData)
      : { triggers: 0, lastTriggeredAt: Date.now() };

    honeypotInfo.triggers += 1;
    honeypotInfo.lastTriggeredAt = Date.now();

    // Escalate blocking for repeated interactions
    if (honeypotInfo.triggers >= RULES.honeypot.permanentBlockThreshold) {
      await escalateBlocking(
        ip,
        redisKey,
        'PERMANENT_BLOCK',
        RULES.maxBlockDuration,
      );
      return res.status(403).json({ message: 'Access permanently denied.' });
    }

    const duration = calculateBlockDuration(
      RULES.baseBlockDuration,
      honeypotInfo.triggers,
    );
    await escalateBlocking(ip, redisKey, 'HONEYPOT_TRIGGER', duration);

    // Save Honeypot Interaction Data
    await redis.set(
      redisKey,
      JSON.stringify(honeypotInfo),
      'EX',
      RULES.timeWindow,
    );

    return res.status(403).json({ message: RULES.honeypot.fakeResponseText });
  }

  next();
}

module.exports = {
  botDetection,
  honeypot,
};
