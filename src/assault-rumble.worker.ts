import {runAssaultJob} from './assault-solver';
import type {AssaultJob} from './assault-rumble';
self.onmessage=async(event:MessageEvent<AssaultJob>)=>{try{await runAssaultJob(event.data,message=>self.postMessage(message));}catch(error){self.postMessage({error:error instanceof Error?error.message:'Assault kadrosu hesaplanamadı.'});}};
