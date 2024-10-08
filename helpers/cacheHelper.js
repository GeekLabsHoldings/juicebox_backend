const redisClient = require('../config/redis');

const lazyRevalidation = async (key, queryFn, ttl = 3600) => {
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
  } else {
    // No cache, fetch fresh data
    const freshData = await queryFn();
    await redisClient.set(key, JSON.stringify(freshData), { EX: ttl });
    return freshData;
  }
};

module.exports = { lazyRevalidation };
