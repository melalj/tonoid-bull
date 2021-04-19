module.exports = ({ queue }) => {
  queue.process(async (job) => {
    // Do something with job.data
    job.progress(10);
    job.log('Computing data');
    await new Promise((r) => setTimeout(r, 1000));
    job.log('Almost there');
    job.progress(90);
    return JSON.stringify(job.data);
  });
};
