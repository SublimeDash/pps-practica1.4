const { performance } = require('node:perf_hooks');
const url = 'http://127.0.0.1:3000/api/health';
const times = [];
let failures = 0;

async function one() {
  const start = performance.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const body = await r.json();
    if (!r.ok || body.ok !== true) failures++;
  } catch {
    failures++;
  } finally {
    times.push(performance.now() - start);
  }
}

async function main() {
  const start = performance.now();
  for (let round = 0; round < 5; round++) {
    await Promise.all(Array.from({ length: 10 }, one));
  }
  const total = performance.now() - start;
  times.sort((a, b) => a - b);
  const middle = Math.floor(times.length / 2);
  console.log({
    requests: times.length, concurrency: 10, errors: failures,
    totalMs: Math.round(total),
    medianMs: Math.round((times[middle - 1] + times[middle]) / 2),
    maxMs: Math.round(times[times.length - 1])
  });
  if (failures > 0) process.exitCode = 1;
}
main().catch(() => { process.exitCode = 1; });