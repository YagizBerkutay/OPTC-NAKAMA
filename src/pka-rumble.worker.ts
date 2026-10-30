import {runPkaRumbleJob} from './pka-rumble-solver';
import type {PkaRumbleJob} from './pka-rumble';
self.onmessage=async(event:MessageEvent<PkaRumbleJob>)=>{try{await runPkaRumbleJob(event.data,message=>self.postMessage(message));}catch(error){self.postMessage({error:error instanceof Error?error.message:'PKA Rumble kadrosu hesaplanamadı.'});}};
