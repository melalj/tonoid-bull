const Queue = require('bull');
const Redis = require('ioredis');

const { URL } = require('url');

function isValidUrl(string) {
  try {
    // eslint-disable-next-line no-new
    new URL(string);
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = ({
  redisOptions = {
    url: process.env.BULL_REDIS_URL || process.env.REDIS_URL,
    host: process.env.BULL_REDIS_HOST || process.env.REDIS_HOST || 'redis',
    port: process.env.BULL_REDIS_PORT || process.env.REDIS_PORT || 6379,
    username: process.env.BULL_REDIS_USERNAME || process.env.REDIS_USERNAME,
    password: process.env.BULL_REDIS_PASSWORD || process.env.REDIS_PASSWORD,
    db: process.env.BULL_REDIS_DB || process.env.REDIS_DB,
    extendOptions: {
      // https://github.com/OptimalBits/bull/issues/1873
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    },
  },
  bullBoard = null,
  middleware = () => {},
  queues = [],
  ctxName = 'bull',
}) => ({
  name: ctxName,
  init: async ({ logger }) => {
    // Redis options
    const parsedURL = isValidUrl(redisOptions.url) ? new URL(redisOptions.url) : {};
    const redisUsername = parsedURL.username || redisOptions.username;
    const redisPassword = parsedURL.password || redisOptions.password;
    const redisClientOptions = {
      host: parsedURL.hostname || redisOptions.host,
      port: Number(parsedURL.port || redisOptions.port),
      username: redisUsername ? decodeURIComponent(redisUsername) : undefined,
      password: redisPassword ? decodeURIComponent(redisPassword) : undefined,
      db: redisOptions.db || (parsedURL.pathname || '/0').slice(1) || '0',
      ...redisOptions.extendOptions,
    };

    const client = new Redis(redisClientOptions);
    const subscriber = new Redis(redisClientOptions);

    const queuesObject = {};

    // Start queues and reuse redis connections
    queues.filter((q) => q.name).forEach((queue) => {
      queuesObject[queue.name] = new Queue(queue.name, {
        ...(queue.options || {}),
        createClient(type) {
          switch (type) {
            case 'client':
              return client;
            case 'subscriber':
              return subscriber;
            case 'bclient':
              return new Redis(redisClientOptions);
            default:
              throw new Error('Unexpected connection type: ', type);
          }
        },
      });
      if (queue.consumer) {
        queue.consumer({ queue: queuesObject[queue.name], queues: queuesObject });
      }
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
    await middleware({ queues, queuesObject, redisOptions });

    const close = async () => {
      logger.info('  Closing redis client client...');
      await client.quit();
      logger.info('  Closing redis subscriber client...');
      await subscriber.quit();
      logger.info(`  Closing ${Object.keys(queuesObject).length} bull queues...`);
      return Promise.all(Object.keys(queuesObject).map((queueName) => (
        queuesObject[queueName].close()
      )));
    };

    return {
      close,
      queues: queuesObject,
      Queue,
    };
  },
});
