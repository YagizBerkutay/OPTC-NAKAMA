import {runPlanningJob,type PlanningJob} from './planning-jobs';
self.onmessage = async(event: MessageEvent<PlanningJob>) => {
  try {
    await runPlanningJob(event.data,message=>self.postMessage(message));
  }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Takım hesaplanamadı.' }); }
};
