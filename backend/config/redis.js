const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on('connect', () => console.log('✅ Redis 连接成功'));
redis.on('error', (err) => console.error('❌ Redis 错误:', err.message));

module.exports = redis;
