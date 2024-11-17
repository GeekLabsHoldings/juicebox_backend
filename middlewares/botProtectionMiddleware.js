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
const honeypotHitCount = new client.Counter({
  name: 'honeypot_hits',
  help: 'Number of honeypot routes accessed',
});
const userAgentViolationCount = new client.Counter({
  name: 'user_agent_violations',
  help: 'Number of suspicious User-Agent strings detected',
});

// **Logger**
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
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
  const durations = [600, 1800, 3600, 7200, 86400, 259200, 604800];
  return durations[Math.min(offenseCount - 1, durations.length - 1)];
}

// **Utility: Calculate Honeypot Offense Weight**
async function calculateHoneypotWeight(ip, route) {
  const honeypotKey = `honeypot:${ip}:${route}`;
  const currentCount = parseInt(await redis.get(honeypotKey), 10) || 0;
  const updatedCount = currentCount + 1;
  await redis.set(honeypotKey, updatedCount, 'EX', 60); // Reset count after 1 minute
  return Math.pow(2, Math.min(updatedCount, 10));
}

// **Helper: Handle Offenses**
async function handleOffenses(ip, res, weight = 1) {
  const offenseKey = `offense_count:${ip}`;
  const offenseCount = await redis.incr(offenseKey, weight);
  await redis.expire(offenseKey, config.get('offense.resetAfterSeconds'));
  offenseCount.inc();

  if (offenseCount === 1) {
    await logSuspiciousActivity(ip, 'Warning issued for suspicious behavior.');
    return res
      .status(429)
      .json({ message: 'Warning: Suspicious activity detected.' });
  } else if (offenseCount <= 5) {
    const blockDuration = calculateBlockDuration(offenseCount);
    await redis.set(`block:${ip}`, true, 'EX', blockDuration);
    blockCount.inc();
    await logSuspiciousActivity(
      ip,
      `Temporary block for ${blockDuration / 60} minutes.`,
    );
    return res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Temporary block for suspicious activity.',
      retryAfter: `${blockDuration / 60} minutes`,
      helpLink: 'https://creativejuicebox.com/help/rate-limiting',
    });
  } else {
    await redis.set(`permanent_block:${ip}`, true, 'EX', 31536000); // 1-year block
    await logSuspiciousActivity(
      ip,
      'Permanent block due to repeated offenses.',
    );
    return res.status(403).json({
      error: 'PERMANENT_BLOCK',
      message: 'Your IP has been permanently blocked.',
      helpLink: 'https://creativejuicebox.com/help/account-security',
    });
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
  const honeypotRoutes = ['/fake-login', '/fake-signup'];
  const suspiciousUserAgents = ['malicious-bot', 'scanner', 'curl'];

  console.log(
    `Behavior protection triggered for IP: ${ip}, User-Agent: ${userAgent}`,
  );

  let totalWeight = 0;

  if (suspiciousUserAgents.some((ua) => userAgent.includes(ua))) {
    await logSuspiciousActivity(
      ip,
      `Suspicious User-Agent detected: ${userAgent}`,
    );
    userAgentViolationCount.inc();
    totalWeight += 3;
  }

  if (honeypotRoutes.includes(req.path)) {
    const weight = await calculateHoneypotWeight(ip, req.path);
    honeypotHitCount.inc();
    totalWeight += weight;
  }

  if (totalWeight > 0) {
    return handleOffenses(ip, res, totalWeight);
  }

  const [tempBlock, permBlock] = await Promise.all([
    redis.get(`block:${ip}`),
    redis.get(`permanent_block:${ip}`),
  ]);

  console.log(`Temp block: ${tempBlock}, Perm block: ${permBlock}`);

  if (!tempBlock && !permBlock) {
    console.log(`No blocks found for IP: ${ip}`);
  }

  if (tempBlock) {
    return res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Temporary block for suspicious activity.',
      retryAfter: `${calculateBlockDuration(offenseCount) / 60} minutes`,
      helpLink: 'https://creativejuicebox.com/help/rate-limiting',
    });
  }

  if (permBlock) {
    return res.status(403).json({
      error: 'PERMANENT_BLOCK',
      message: 'Your IP has been permanently blocked.',
      helpLink: 'https://creativejuicebox.com/help/account-security',
    });
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
    console.log(`Rate limit check for IP: ${req.ip}`);
    await rateLimiter.consume(req.ip);
    next();
  } catch {
    console.log(`Rate limit exceeded for IP: ${req.ip}`);
    await logSuspiciousActivity(req.ip, 'Rate limit exceeded.');
    res
      .status(429)
      .json({ message: 'Too many requests, please try again later.' });
  }
}

// **Middleware: Honeypot Protection with Exponential Backoff**
async function honeypot(req, res, next) {
  const honeypotRoutes = ['/fake-login', '/fake-signup'];
  if (honeypotRoutes.includes(req.path)) {
    const ip = req.ip;
    const weight = await calculateHoneypotWeight(ip, req.path);
    return handleOffenses(ip, res, weight); // Use dynamic weight
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
