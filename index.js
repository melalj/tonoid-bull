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
    const ioRedisClientOptions = deepmerge(
      {
        db: redisOptions.db || (parsedURL.pathname || '/0').slice(1) || defaultRedisOptions.db,
        retryStrategy: (retries) => {
          if (retries >= 10) {
            throw new Error('Redis connection retry limit exceeded');
          }
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

    const client = new Redis(redisUrl, ioRedisClientOptions);
    client.on('error', (err) => redisErrorHandler(err, 'client'));

    const subscriber = new Redis(redisUrl, ioRedisClientOptions);
    subscriber.on('error', (err) => redisErrorHandler(err, 'subscriber'));

    const bclients = {};
    const createBclientRedis = (queueName) => {
      const bclient = new Redis(redisUrl, ioRedisClientOptions);
      bclient.on('error', (err) => redisErrorHandler(err, queueName));
      bclients[queueName] = bclient;
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
              return createBclientRedis(queue.name);
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
      try {
        logger.info('  Closing redis client client...');
        await client.disconnect();
        logger.info('  Closing redis subscriber client...');
        await subscriber.disconnect();
        logger.info(`  Closing ${Object.keys(queuesObject).length} bull queues...`);
        return Promise.all(Object.keys(queuesObject).map(async (queueName) => {
          await queuesObject[queueName].close();
          if (bclients[queueName]) {
            await bclients[queueName].disconnect();
          }
        }));
      } catch (e) {
        logger.error(`  Couldn't close redis clients: ${e.message}');`);
        return null;
      }
    };

    return {
      name: ctxName,
      close,
      queues: queuesObject,
      Queue,
    };
  },
});
