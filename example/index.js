const { init } = require('@tonoid/helpers');
const express = require('@tonoid/express');

// const bull = require('@tonoid/bull'); // Used when published
const bull = require('..'); // Used to test this repo

const jsonStringifyConsumer = require('./queues/jsonStringify');
const apiHandler = require('./apiHandler');

init([
  bull({
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
    ],
  }),
]);
