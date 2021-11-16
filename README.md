# @tonoid/bull

![npm](https://img.shields.io/npm/dt/@tonoid/bull.svg) ![npm](https://img.shields.io/npm/v/@tonoid/bull.svg) ![npm](https://img.shields.io/npm/l/@tonoid/bull.svg) ![Bull](https://img.shields.io/david/melalj/tonoid-bull.svg)
[![GitHub stars](https://img.shields.io/github/stars/melalj/tonoid-bull.svg?style=social&label=Star&maxAge=2592003)](https://github.com/melalj/tonoid-bull)

Bull plugin for [@tonoid/helpers](https://github.com/melalj/tonoid-helpers) - handling messaging queues and background tasks

## Init options

- `redis.host`: (defaults: `process.env.BULL_REDIS_HOST || process.env.REDIS_HOST || 'mongo'`) Redis host.
- `redis.port`: (defaults: `process.env.BULL_REDIS_PORT || process.env.REDIS_PORT || 27017`) Redis port.
- `redis.password`: (defaults: `process.env.BULL_REDIS_PASSWORD || process.env.REDIS_PASSWORD || 'mongo'`) Redis password.
- `redis.db`: (defaults: `process.env.BULL_REDIS_DB || process.env.REDIS_DB || 'admin'`) Redis database.
- `redis.url`: (defaults: `process.env.BULL_REDIS_URL || process.env.REDIS_URL`) Redis url, if set it overrides other auth options.
- `middleware`: function to manipulate `{ queues, queuesObject, redis }`, useful if you're using admin ui like @bull-board
- `queues`: (Array) Available queues
- `queues[].name`: (string - required) Queue name
- `queues[].consumer`: (function({ queue, queues } - optional) - required) Consumer function to progress the queue

## Exported context attributes

- `.queues`: Object containing all queues (useful to add to a queue)

## Usage example

```js
const { context, init } = require('@tonoid/helpers');
const bull = require('@tonoid/bull');

const jsonStringifyQueue = ({ queue }) => {
  queue.process(async (job) => {
    // Do something with job.data
    job.progress(10);
    job.log('Computing data');
    await new Promise((r) => setTimeout(r, 1000));
    job.log('Almost there');
    job.progress(90);
    return JSON.stringify(job.data);
  });
}

(async () => {
  await init([
    bull({
      redis: {
        url: 'redis://locahost:6379',
      },
      queues: [
        { name: 'jsonStringify', consumer: jsonStringifyConsumer },
      ],
    }),
  ]);

  const job = await context.bull.jsonStringify.add({ foo: 'bar' });
  const result = await job.finished();
  console.log(result);
})();

```

## Credits

This module is maintained by [Simo Elalj](https://twitter.com/simoelalj) @[tonoid](https://www.tonoid.com)
