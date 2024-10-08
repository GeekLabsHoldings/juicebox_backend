const redisClient = require('../config/redis');

const cacheMiddleware = (key, ttl = 3600) => async (req, res, next) => {
  try {
    const cachedData = await redisClient.get(key);
    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData));
    }

    // Store response in cache after sending it to the client
    res.sendResponse = res.json;
    res.json = async (body) => {
      await redisClient.set(key, JSON.stringify(body), { EX: ttl });
      res.sendResponse(body);
    };

    next();
  } catch (err) {
    console.error('Redis Cache Error:', err);
    next(); // Proceed if Redis fails
  }
};

module.exports = cacheMiddleware;
