const redisClient = require('../config/redis');

const lazyRevalidation = async (key, queryFn, ttl = 3600) => {
  try {
    const cachedData = await redisClient.get(key);

    if (cachedData) {
      // Return cached data and revalidate asynchronously
      setTimeout(async () => {
        try {
          const freshData = await queryFn();
          await redisClient.set(key, JSON.stringify(freshData), { EX: ttl });
        } catch (error) {
          console.error('Error during lazy revalidation:', error);
        }
      }, 0);

      return JSON.parse(cachedData);
    }

    // If no cache exists, query fresh data
    const freshData = await queryFn();
    await redisClient.set(key, JSON.stringify(freshData), { EX: ttl });
    return freshData;

  } catch (error) {
    console.error('Redis lazy revalidation error:', error);
    throw new ApiError('Cache retrieval failed', 500);
  }
};

module.exports = lazyRevalidation;
