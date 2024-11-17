const Redis = require('ioredis');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const User = require('../models/userModel');
const config = require('config');
const winston = require('winston');
const client = require('prom-client');

// **Metrics for Monitoring**
const blockCount = new client.Counter({
  name: 'blocked_ips',
  help: 'Number of blocked IP addresses',
});
const offenseCount = new client.Counter({
  name: 'offense_attempts',
  help: 'Number of suspicious activities detected',
});

// **Logger**
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    // new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/suspicious_activity.log' }),
  ],
});

// **Redis Client**
const redisConfig = config.get('redis');
const redis = new Redis(redisConfig);

// **Utility: Log Suspicious Activity**
async function logSuspiciousActivity(ip, message) {
  const logKey = `suspicious_log:${ip}`;
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp}: ${message}`;
  await redis.lpush(logKey, logEntry);
  await redis.expire(logKey, 86400 * 7); // Logs expire after 7 days
  logger.info({ ip, message });
}

// **Utility: Calculate Block Duration**
function calculateBlockDuration(offenseCount) {
  const durations = [600, 1800, 3600, 7200, 86400, 259200, 604800]; // Escalating durations
  return durations[Math.min(offenseCount - 1, durations.length - 1)];
}

// **Helper: Handle Offenses**
async function handleOffenses(ip, res, weight = 1) {
  const offenseKey = `offense_count:${ip}`;
  const offenseCount = await redis.incrby(offenseKey, weight);
  await redis.expire(offenseKey, config.get('offense.resetAfterSeconds')); // Offenses reset after 24 hours
  offenseCount.inc(); // Increment offense metric

  if (offenseCount === 1) {
    await logSuspiciousActivity(ip, 'Warning issued for suspicious behavior.');
    return res
      .status(429)
      .json({ message: 'Warning: Suspicious activity detected.' });
  } else if (offenseCount <= 5) {
    const blockDuration = calculateBlockDuration(offenseCount);
    await redis.set(`block:${ip}`, true, 'EX', blockDuration);
    blockCount.inc(); // Increment block metric
    await logSuspiciousActivity(
      ip,
      `Temporary block for ${blockDuration / 60} minutes.`,
    );
    return res.status(429).json({
      message: `Temporary block for ${blockDuration / 60} minutes.`,
    });
  } else if (offenseCount > 5) {
    await redis.set(`permanent_block:${ip}`, true, 'EX', 31536000); // 1-year block
    await logSuspiciousActivity(
      ip,
      'Permanent block due to repeated offenses.',
    );
    return res
      .status(403)
      .json({ message: 'IP permanently blocked for 1 year.' });
  }
}

// Helper Handle user blocking
async function handleUserBlock(user, blockDuration, res) {
  const currentTime = Date.now();

  // Check if the user is already blocked
  if (user.isBlocked && user.blockExpiresAt > currentTime) {
    return res
      .status(403)
      .json({ message: 'Your account has been temporarily blocked.' });
  }

  // Block the user for the specified duration
  await temporarilyBlockUser(user._id, blockDuration);
  return res.status(403).json({
    message: `Suspicious activity detected. Your account has been temporarily blocked for ${blockDuration / 1000 / 60} minutes.`,
  });
}

// Helper User blocking function
async function temporarilyBlockUser(userId, blockDuration) {
  const user = await User.findById(userId);
  if (user) {
    const currentTime = Date.now();

    // If the user is already blocked and the block duration has expired, reset their status
    if (user.isBlocked && user.blockExpiresAt <= currentTime) {
      user.isBlocked = false;
      user.blockExpiresAt = null;
      await user.save();
      console.log(`Block expired for user ${user.email}. Status reset.`);
    }

    // If the user is not blocked, block them for the specified duration
    if (!user.isBlocked) {
      user.isBlocked = true;
      user.blockExpiresAt = currentTime + blockDuration; // Use the passed duration
      await user.save();
      console.log(
        `User ${user.email} is temporarily blocked for ${blockDuration / 1000 / 60} minutes.`,
      );
    }
  }
}

// **Middleware: Behavior Protection**
async function behaviorProtection(req, res, next) {
  const ip = req.ip;
  const userAgent = req.get('User-Agent') || 'unknown';

  const suspiciousChecks = [
    {
      name: 'Honeypot Access',
      condition: () => ['/fake-login', '/fake-signup'].includes(req.path),
      weight: 3,
    },
    {
      name: 'Missing User-Agent',
      condition: () => !userAgent || userAgent.length < 5,
      weight: 2,
    },
    {
      name: 'No Content-Type on POST',
      condition: () => req.method === 'POST' && !req.headers['content-type'],
      weight: 2,
    },
  ];

  let totalWeight = 0;
  for (const { name, condition, weight } of suspiciousChecks) {
    if (condition()) {
      await logSuspiciousActivity(ip, `Triggered: ${name}`);
      totalWeight += weight;
    }
  }

  if (totalWeight > 0) {
    return handleOffenses(ip, res, totalWeight);
  }

  const [tempBlock, permBlock] = await Promise.all([
    redis.get(`block:${ip}`),
    redis.get(`permanent_block:${ip}`),
  ]);

  if (permBlock) {
    return res
      .status(403)
      .json({ message: 'IP permanently blocked for 1 year.' });
  }

  if (tempBlock) {
    return res
      .status(429)
      .json({ message: 'Temporary block for suspicious activity.' });
  }

  next();
}

// **Middleware: Rate Limiting**
const rateLimiterConfig = config.get('rateLimiter');
const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: rateLimiterConfig.keyPrefix,
  points: rateLimiterConfig.points,
  duration: rateLimiterConfig.duration,
  blockDuration: rateLimiterConfig.blockDuration,
});

async function rateLimitMiddleware(req, res, next) {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch {
    await logSuspiciousActivity(req.ip, 'Rate limit exceeded.');
    res
      .status(429)
      .json({ message: 'Too many requests, please try again later.' });
  }
}

// **Middleware: Honeypot Protection**
async function honeypot(req, res, next) {
  const honeypotRoutes = ['/fake-login', '/fake-signup'];
  if (honeypotRoutes.includes(req.path)) {
    return handleOffenses(req.ip, res, 3); // Offense weight for honeypot routes
  }
  next();
}

// Track Suspicious Activity Based on Request Frequency
async function trackSuspiciousActivity(req, res, next) {
  const ip = req.ip;
  const key = `requests:${ip}`;
  const SUSPICIOUS_THRESHOLD = 20;
  const BLOCK_THRESHOLD = 30;

  const count = parseInt(await redis.get(key), 10) || 0;

  // Handle suspicious activity
  if (count >= SUSPICIOUS_THRESHOLD) {
    if (req.user) {
      const user = await User.findOne({ email: req.user.email });
      if (user) {
        const blockDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
        return await handleUserBlock(user, blockDuration, res);
      }
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(403).json({ message: 'Suspicious activity detected.' });
  }

  // Handle block threshold
  if (count >= BLOCK_THRESHOLD) {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const user = await User.findOne({ email: req.user.email });
    if (user) {
      const blockDuration = 60 * 60 * 1000; // 1 hour in milliseconds
      return await handleUserBlock(user, blockDuration, res);
    }
    return res.status(404).json({ message: 'User not found' });
  }

  // Increment the request count
  redis.setex(key, 10, count + 1);
  next();
}

// **Export Middleware**
module.exports = {
  behaviorProtection,
  rateLimitMiddleware,
  honeypot,
  trackSuspiciousActivity,
};
