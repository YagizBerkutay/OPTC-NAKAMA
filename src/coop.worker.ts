import {runCoopJob,type CoopJob} from './coop';
self.onmessage=async(event:MessageEvent<CoopJob>)=>{try{await runCoopJob(event.data,message=>self.postMessage(message));}catch(e){self.postMessage({error:e instanceof Error?e.message:'Co-Op kadrosu kurulamadı.'});}};
