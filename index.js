const Queue = require('bull');

const defaultRedisConfig = {
  ...(process.env.REDIS_URL
    ? { url: process.env.REDIS_URL }
    : {
      host: process.env.REDIS_HOST || 'redis',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD,
      db: process.env.BULL_REDIS_DB || process.env.REDIS_DB || 0,
    }
  ),
};

module.exports = ({
  redis = defaultRedisConfig,
  queues = [],
}) => ({
  name: 'bull',
  init: async () => {
    // Redis options
    let redisOpts = {};
    if (redis.url) {
      const parsedURL = new URL(redis.url);
      redisOpts = {
        host: parsedURL.hostname || 'redis',
        port: Number(parsedURL.port || 6379),
        password: parsedURL.password ? decodeURIComponent(parsedURL.password) : null,
        db: process.env.BULL_REDIS_DB || (parsedURL.pathname || '/0').substr(1) || '0',
      };
    } else {
      redisOpts = {
        host: redis.host,
        port: redis.port,
        password: redis.password,
        db: process.env.BULL_REDIS_DB || redis.db,
      };
    }

    const queuesObject = {};

    // Start queues
    queues.filter((q) => q.name && q.consumer).forEach((queue) => {
      queuesObject[queue.name] = new Queue(queue.name, {
        redis: redisOpts,
        ...(queue.options || {}),
      });
      queue.consumer({ queue: queuesObject[queue.name], queues: queuesObject });
    });

    const close = () => {
      Object.keys(queuesObject).forEach((queueName) => {
        queuesObject[queueName].close();
      });
    };

    return {
      close,
      queues: queuesObject,
      Queue,
    };
  },
});