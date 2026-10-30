import {solvePve,solveRumble} from './engine';
self.onmessage=(event)=>{try {const {kind,args}=event.data;const result=kind==='pve'?solvePve(...args as Parameters<typeof solvePve>):solveRumble(...args as Parameters<typeof solveRumble>);self.postMessage({result});}catch(e){self.postMessage({error:e instanceof Error?e.message:'Hesaplama başarısız.'});}};
