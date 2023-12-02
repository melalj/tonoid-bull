const deepmerge = require('deepmerge');
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

const defaultRedisOptions = {
  url: process.env.BULL_REDIS_URL || process.env.REDIS_URL,
  db: process.env.BULL_REDIS_DB || process.env.REDIS_DB || '0',
  errorHandler: () => {},
  extendOptions: {},
};

module.exports = ({
  redisOptions = defaultRedisOptions,
  bullBoard = null,
  middleware = () => {},
  queues = [],
}, ctxName = 'bull') => ({
  name: ctxName,
  init: async ({ logger }) => {
    // Redis options
    const redisUrl = redisOptions.url || defaultRedisOptions.url;
    const redisErrorHandler = redisOptions.errorHandler || defaultRedisOptions.errorHandler;

    const parsedURL = isValidUrl(redisUrl) ? new URL(redisUrl) : {};
    const redisClientOptions = deepmerge(
      {
        db: redisOptions.db || (parsedURL.pathname || '/0').slice(1) || defaultRedisOptions.db,
        reconnectStrategy: (retries) => {
          if (retries >= 10) return false;
          return retries * 500 + 100;
        },
      },
      {
        ...redisOptions.extendOptions,
        // https://github.com/OptimalBits/bull/issues/1873
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    );

    const client = new Redis(redisUrl, redisClientOptions);
    client.on('error', (err) => redisErrorHandler(err, 'client'));

    const subscriber = new Redis(redisUrl, redisClientOptions);
    client.on('error', (err) => redisErrorHandler(err, 'subscriber'));

    const createBclientRedis = () => {
      const bclient = new Redis(redisUrl, redisClientOptions);
      bclient.on('error', (err) => redisErrorHandler(err, 'bclient'));
      return bclient;
    };

    // Start queues and reuse redis connections
    const queuesObject = {};
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
              return createBclientRedis();
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
      name: ctxName,
      close,
      queues: queuesObject,
      Queue,
    };
  },
});
