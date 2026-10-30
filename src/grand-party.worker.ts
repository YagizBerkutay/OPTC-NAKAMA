import { SCENARIOS } from './planning';
import { planGrandParty, type GPRequest } from './grand-party';
self.onmessage=(event:MessageEvent<GPRequest>)=> {
  try {
    const groups=[];
    for(const scenario of SCENARIOS) {
      self.postMessage({progress:scenario.name+' · üç kadro ve lider birlikte aranıyor…'});
      groups.push(planGrandParty(event.data,scenario.id,message=>self.postMessage({progress:message})));
      self.postMessage({partial:[...groups]});
    }
    self.postMessage({groups});
  }catch(error){self.postMessage({error:String(error)});}
};
