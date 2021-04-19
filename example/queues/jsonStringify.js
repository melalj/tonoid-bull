/* eslint-disable no-await-in-loop */

module.exports = ({ queue }) => {
  queue.process(async (job) => {
    // Do something with job.data
    // For the sake of the example we simulate a long task
    job.log('Computing data');
    for (let i = 0; i < 10; i += 1) {
      job.progress(i * 10);
      job.log(`Process ${i}...`);
      await new Promise((r) => setTimeout(r, 1000));
    }
    job.progress(100);
    return JSON.stringify(job.data);
  });
};
