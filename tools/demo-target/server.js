import express from 'express';

const app = express();
const PORT = process.env.DEMO_TARGET_PORT || 4000;

let isStatusFailing = false;

app.get('/ok', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Healthy endpoint' });
});

app.get('/fail', (_req, res) => {
  res.status(500).json({ status: 'error', message: 'Internal Server Error' });
});

app.get('/slow', (_req, res) => {
  setTimeout(() => {
    res.status(200).json({ status: 'slow', message: 'Delayed response' });
  }, 2000);
});

app.all('/toggle', (_req, res) => {
  isStatusFailing = !isStatusFailing;
  res.status(200).json({
    message: `Status endpoint state toggled. Now returning HTTP ${isStatusFailing ? 500 : 200}`,
    isFailing: isStatusFailing,
  });
});

app.get('/status', (_req, res) => {
  if (isStatusFailing) {
    res.status(500).json({ status: 'error', message: 'Failing status' });
  } else {
    res.status(200).json({ status: 'ok', message: 'Healthy status' });
  }
});

app.listen(PORT, () => {
  console.log(`[DemoTarget] Local target server running on http://localhost:${PORT}`);
  console.log(`  GET /ok       => HTTP 200`);
  console.log(`  GET /fail     => HTTP 500`);
  console.log(`  GET /slow     => 2s delay, HTTP 200`);
  console.log(`  GET /status   => HTTP 200 (or 500 when toggled)`);
  console.log(`  POST /toggle  => Flips /status between 200 & 500`);
});
