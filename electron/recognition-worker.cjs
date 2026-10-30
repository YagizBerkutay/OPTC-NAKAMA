const {parentPort,workerData}=require('node:worker_threads');
const {recognize}=require('./recognition-core.cjs');
recognize(workerData.dataUrl,workerData.grid,workerData.dataDir).then(result=>parentPort.postMessage({result})).catch(e=>parentPort.postMessage({error:e.message}));
