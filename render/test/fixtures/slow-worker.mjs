// Stands in for dist/worker.mjs in the render timeout test, so the test doesn't depend on how fast the machine renders.
// A job whose diagram has `slow: true` never finishes (it blocks the thread, like a runaway render); others answer at once.
import { parentPort } from 'node:worker_threads'

parentPort.on('message', ({ id, raw }) => {
  if (raw?.slow) for (;;);
  parentPort.postMessage({ id, ok: true, bytes: new TextEncoder().encode('<svg/>') })
})
