const ctx = require('@tonoid/helpers').context;

module.exports = ({ getRouter, asyncHandler }) => {
  const router = getRouter();

  router.get('/trigger', asyncHandler(async (req, res) => {
    const job = await ctx.bull.queues.jsonStringify.add({ req });
    res.send(job);
  }));
};
