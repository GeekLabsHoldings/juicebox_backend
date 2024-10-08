const redis = require('redis');

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 5000),
  },
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

(async () => {
  await redisClient.connect();
})();

module.exports = redisClient;
