const {parentPort,workerData}=require('node:worker_threads');
require('./kizuna-images.cjs').read(workerData.images,text=>parentPort.postMessage({type:'progress',text})).then(result=>parentPort.postMessage({type:'result',result}),e=>parentPort.postMessage({type:'error',message:e.message}));
