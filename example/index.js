const { init } = require('@tonoid/helpers');
const express = require('@tonoid/express');

const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const bull = require('@tonoid/bull');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/bullBoard');

const jsonStringifyConsumer = require('./queues/jsonStringify');
const apiHandler = require('./apiHandler');

(async () => {
  await init([
    bull({
      middleware: ({ queuesObject }) => {
        createBullBoard({
          queues: Object.keys(queuesObject).map((k) => new BullAdapter(queuesObject[k])),
          serverAdapter,
        });
      },
      queues: [
        {
          name: 'jsonStringify',
          consumer: jsonStringifyConsumer,
        },
      ],
    }),
    express({
      endpoints: [
        { path: '/', handler: apiHandler },
        // You can remove the below section if you do not want a dashboard
        {
          path: '/bullBoard',
          handler: () => serverAdapter.getRouter(),
          middleware: (req, res, next) => {
            const reject = () => {
              res.setHeader('www-authenticate', 'Basic');
              res.sendStatus(401);
            };

            if (!req.headers.authorization) return reject();

            const [username, password] = Buffer.from(req.headers.authorization.replace('Basic ', ''), 'base64').toString().split(':');

            if (
              username !== process.env.BULL_DASHBOARD_USERNAME
              || password !== process.env.BULL_DASHBOARD_PASSWORD
            ) return reject();
            return next();
          },
        },
      ],
    }),
  ]);
})();
