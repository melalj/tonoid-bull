const { init } = require('@tonoid/helpers');
const express = require('@tonoid/express');
const bull = require('@tonoid/bull');
const bullBoard = require('bull-board');

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

          if (!(username === 'admin' && password === 'admin')) return reject();
          return next();
        },
      },
    ],
  }),
]);
