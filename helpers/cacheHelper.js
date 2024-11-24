const redisClient = require('../config/redis');

const lazyRevalidation = async (cacheKey, fetchFn, ttl = 3600) => {
  try {
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      setTimeout(async () => {
        try {
          const freshData = await fetchFn();
          await redisClient.set(cacheKey, JSON.stringify(freshData), { EX: ttl });
        } catch (error) {
          throw error;
        }
      }, 0);

      return JSON.parse(cachedData);
    }

    const freshData = await fetchFn();
    await redisClient.set(cacheKey, JSON.stringify(freshData), { EX: ttl });
    return freshData;

  } catch (error) {
    throw new ApiError('Cache retrieval failed', 500);
  }
};

module.exports = lazyRevalidation;

// const redisClient = require('../config/redis');

// const lazyRevalidation = async (key, queryFn, ttl = 3600) => {
//   try {
//     const cachedData = await redisClient.get(key);

//     if (cachedData) {
//       setTimeout(async () => {
//         try {
//           const freshData = await queryFn();
//           await redisClient.set(key, JSON.stringify(freshData), { EX: ttl });
//         } catch (error) {
//           console.error('Error during lazy revalidation:', error);
//         }
//       }, 0);

//       return JSON.parse(cachedData);
//     }

//     const freshData = await queryFn();
//     await redisClient.set(key, JSON.stringify(freshData), { EX: ttl });
//     return freshData;

//   } catch (error) {
//     console.error('Redis lazy revalidation error:', error);
//     throw new ApiError('Cache retrieval failed', 500);
//   }
// };

// module.exports = lazyRevalidation;
