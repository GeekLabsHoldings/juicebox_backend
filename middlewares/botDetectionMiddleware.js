const rateLimit = require('express-rate-limit');
const redis = require('../config/ioredis');
const User = require('../models/userModel');
const {
  handleOffense,
  escalateOffense,
  handleUserBlock,
} = require('../helpers/botDetectionHelper');

// Rate Limiter Function
const dynamicRateLimiter = (
  limit,
  windowMs,
  message = 'Too many requests, please slow down.',
) =>
  rateLimit({
    windowMs,
    max: limit,
    handler: (req, res) => res.status(429).json({ message }),
  });

// Adaptive Bot Protection Middleware
async function botProtection(req, res, next) {
  try {
    const ip = req.ip;
    const userAgent = req.get('User-Agent') || 'unknown';
    const now = Date.now();

    const pipeline = redis.pipeline();
    pipeline.get(`block:${ip}`);
    pipeline.get(`user_agent:${ip}`);
    pipeline.zadd(`sliding_window:${ip}`, now, now);
    pipeline.zremrangebyscore(`sliding_window:${ip}`, 0, now - 10000); // 10 seconds sliding window
    pipeline.zcard(`sliding_window:${ip}`);
    const [isBlocked, lastUserAgent, , , requestCount] = await pipeline.exec();

    // Check if IP is blocked
    if (isBlocked[1]) {
      return res
        .status(429)
        .json({ message: 'Temporary block due to suspicious activity.' });
    }

    // If User-Agent changes frequently, escalate offense
    if (lastUserAgent[1] && lastUserAgent[1] !== userAgent) {
      await escalateOffense(ip, 'Suspicious User-Agent detected.');
      return res
        .status(429)
        .json({ message: 'Temporary block for suspicious behavior.' });
    }

    // Update User-Agent tracking
    await redis.set(`user_agent:${ip}`, userAgent, 'EX', 300);

    // Handle excessive request rate
    if (parseInt(requestCount[1], 10) > 20) {
      await handleOffense(req, res, next);
      return;
    }

    next();
  } catch (error) {
    console.error('Error in botProtection:', error);
    next();
  }
}

// Honeypot Middleware for Tracking Automated or Malicious Access
async function honeypot(req, res, next) {
  const honeypotRoutes = ['/fake-login', '/fake-signup'];
  const ip = req.ip;

  if (honeypotRoutes.includes(req.path)) {
    await escalateOffense(ip, 'Triggered honeypot route.');
    return res
      .status(403)
      .json({ message: 'Access blocked for suspicious activity.' });
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

module.exports = {
  dynamicRateLimiter,
  botProtection,
  honeypot,
  trackSuspiciousActivity,
};
