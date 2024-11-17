const redis = require('../config/ioredis');
const User = require('../models/userModel');

const maxOffenseCount = 250; // Permanent block threshold

// Block and Warning Duration Calculation
function calculateWarningAndBlockDuration(offenseCount) {
  const escalationLevels = [
    {
      threshold: 10,
      duration: 300,
      message: 'Warning: Slow down. You may be temporarily blocked.',
    },
    {
      threshold: 20,
      duration: 600,
      message:
        'Warning: Continued excessive requests will result in longer blocks.',
    },
    {
      threshold: 30,
      duration: 1800,
      message:
        'Warning: Further excessive requests will lead to a longer block.',
    },
    {
      threshold: 40,
      duration: 3600,
      message: 'Warning: You are at risk of being blocked for 1 hour.',
    },
    {
      threshold: 50,
      duration: 7200,
      message: 'Warning: You are at risk of being blocked for 2 hours.',
    },
  ];

  if (offenseCount >= maxOffenseCount) {
    return {
      duration: null, // Permanent block at max offense count
      message: 'Permanent block due to excessive offenses.',
    };
  }

  for (const level of escalationLevels) {
    if (offenseCount === level.threshold) {
      return {
        duration: level.duration,
        message: level.message,
      };
    }
  }

  // For counts above the highest threshold
  if (offenseCount > escalationLevels[escalationLevels.length - 1].threshold) {
    const extraBlocks = Math.floor((offenseCount - 50) / 10);
    const duration = 7200 * (extraBlocks + 1); // Escalate by 2 hours for every 10 offenses above 50
    return {
      duration,
      message: `Temporary block for ${duration / 60} minutes due to repeated offenses.`,
    };
  }

  return {
    duration: null,
    message: 'No additional action required.',
  };
}

// Offense Handling with Escalation and Offense Reset
async function handleOffense(req, res, next) {
  const ip = req.ip;

  try {
    const offenseCount = await redis.incr(`offense_count:${ip}`);
    await redis.expire(`offense_count:${ip}`, 86400); // 1-day expiration for offense count

    const { duration, message } = calculateWarningAndBlockDuration(offenseCount);

    // Handle responses based on offense count
    if (offenseCount === 10 || offenseCount === 20 || offenseCount >= maxOffenseCount) {
      return res.status(429).json({ message });
    }

    if (offenseCount > 50) {
      await redis.set(`block:${ip}`, true, 'EX', duration);
      return res.status(429).json({ message });
    }

    next();
  } catch (error) {
    console.error('Error in handleOffense:', error);
    next();
  }
}

// Handle user blocking
async function handleUserBlock(user, blockDuration, res) {
  const currentTime = Date.now();

  // Check if the user is already blocked
  if (user.isBlocked && user.blockExpiresAt > currentTime) {
    return res.status(403).json({ message: 'Your account has been temporarily blocked.' });
  }

  // Block the user for the specified duration
  await temporarilyBlockUser(user._id, blockDuration);
  return res.status(403).json({
    message: `Suspicious activity detected. Your account has been temporarily blocked for ${blockDuration / 1000 / 60} minutes.`,
  });
}

// User blocking function
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
      console.log(`User ${user.email} is temporarily blocked for ${blockDuration / 1000 / 60} minutes.`);
    }
  }
}

// Logging Suspicious Activity for Review
async function logSuspiciousActivity(ip, message) {
  const logKey = `suspicious_log:${ip}`;
  const timestamp = new Date().toISOString();
  await redis.lpush(logKey, `${timestamp}: ${message}`);
  await redis.expire(logKey, 86400); // Log expiry in 1 day
}

// Escalate Offense and Apply Gradual Block Duration
async function escalateOffense(ip, reason) {
  const offenseCount = await redis.incr(`offense_count:${ip}`);
  const blockDuration = calculateWarningAndBlockDuration(offenseCount);
  await redis.set(`block:${ip}`, true, 'EX', blockDuration.duration);
  await logSuspiciousActivity(ip, reason);
}

module.exports = {
  handleOffense,
  escalateOffense,
  handleUserBlock,
};
