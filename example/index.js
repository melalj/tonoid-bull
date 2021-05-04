const { init } = require('@tonoid/helpers');
const express = require('@tonoid/express');
const bull = require('@tonoid/bull');

const { createBullBoard } = require('bull-board');
const { BullAdapter } = require('bull-board/bullAdapter');

const bullBoard = {
  createBullBoard,
  BullAdapter,
  router: () => {},
};

const jsonStringifyConsumer = require('./queues/jsonStringify');
const apiHandler = require('./apiHandler');

init([
  bull({
    bullBoard,
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
        handler: () => bullBoard.router,
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
