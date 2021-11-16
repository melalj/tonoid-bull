const Queue = require('bull');
const Redis = require('ioredis');

const defaultRedisConfig = {
  ...((process.env.BULL_REDIS_URL || process.env.REDIS_URL)
    ? { url: process.env.BULL_REDIS_URL || process.env.REDIS_URL }
    : {
      host: process.env.BULL_REDIS_HOST || process.env.REDIS_HOST || 'redis',
      port: Number(process.env.BULL_REDIS_PORT || process.env.REDIS_PORT || 6379),
      password: process.env.BULL_REDIS_PASSWORD || process.env.REDIS_PASSWORD,
      db: process.env.BULL_REDIS_DB || process.env.REDIS_DB || 0,
    }
  ),
};

module.exports = ({
  redis = defaultRedisConfig,
  bullBoard = null,
  middleware = () => {},
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

    const client = new Redis(redisOpts);
    const subscriber = new Redis(redisOpts);

    const queuesObject = {};

    // Start queues and reuse redis connections
    queues.filter((q) => q.name && q.consumer).forEach((queue) => {
      queuesObject[queue.name] = new Queue(queue.name, {
        ...(queue.options || {}),
        createClient(type) {
          switch (type) {
            case 'client':
              return client;
            case 'subscriber':
              return subscriber;
            case 'bclient':
              return new Redis(redisOpts);
            default:
              throw new Error('Unexpected connection type: ', type);
          }
        },
      });
      queue.consumer({ queue: queuesObject[queue.name], queues: queuesObject });
    });

    // Attach Bull Board (v2)
    if (bullBoard && bullBoard.BullAdapter) {
      const { router } = bullBoard.createBullBoard(
        Object.keys(queuesObject)
          .map((k) => new bullBoard.BullAdapter(queuesObject[k])),
      );
      // eslint-disable-next-line no-param-reassign
      bullBoard.router = router;
    }

    // Add Queue middleware
    await middleware({ queues, queuesObject, redis });

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
