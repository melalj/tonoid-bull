# @tonoid/bull

![npm](https://img.shields.io/npm/dt/@tonoid/bull.svg) ![npm](https://img.shields.io/npm/v/@tonoid/bull.svg) ![npm](https://img.shields.io/npm/l/@tonoid/bull.svg) ![David](https://img.shields.io/david/melalj/tonoid-bull.svg)
[![GitHub stars](https://img.shields.io/github/stars/melalj/tonoid-bull.svg?style=social&label=Star&maxAge=2592003)](https://github.com/melalj/tonoid-bull)

Bull plugin for [@tonoid/helpers](https://github.com/melalj/tonoid-helpers) - handling messaging queues and background tasks

## Init options

- `host`: (defaults: `process.env.REDIS_HOST || 'mongo'`) Redis host.
- `port`: (defaults: `process.env.REDIS_PORT || 27017`) Redis port.
- `password`: (defaults: `process.env.REDIS_PASSWORD || 'mongo'`) Redis password.
- `db`: (defaults: `process.env.REDIS_DB || 'admin'`) Redis database.
- `url`: (defaults: `process.env.REDIS_URL`) Redis url, if set it overrides other auth options.

## Exported context attributes

- `.getValue(key)`: Get a value from redis cache
- `.setValue(key, value, ttl)`: Set a value in redis cache
- `.delValue(key)`: Delete a value in redis cache

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

  await context.redis.setValue('foo', 'bar');
  const fooValue = await context.redis.getValue('foo');
  console.log(fooValue);
})();

```

## Credits

This module is maintained by [Simo Elalj](https://twitter.com/simoelalj) @[tonoid](https://www.tonoid.com)
