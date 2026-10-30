import {useState,type ComponentProps} from 'react';
import {TabBar} from './ui';
import PkaBossPage from './PkaBossPage';
import PkaRumblePage from './PkaRumblePage';
export default function PkaPage(props:Omit<ComponentProps<typeof PkaBossPage>,'slot'|'onBusy'>){
 const [slot,setSlot]=useState<'main'|'side'|'rumble'>('main'),[busy,setBusy]=useState(false);
 return <><fieldset disabled={busy} style={{border:0,padding:0,margin:0}}><TabBar prefix="pka-target" label="PKA karşılaşması" items={[{id:'main',label:'Ana boss'},{id:'side',label:'Diğer boss'},{id:'rumble',label:'PKA Rumble'}]} value={slot} onChange={id=>setSlot(id as typeof slot)}/></fieldset><div role="tabpanel" id={'pka-target-panel-'+slot} aria-labelledby={'pka-target-tab-'+slot}>{slot==='rumble'?<PkaRumblePage {...props} onBusy={setBusy}/>:<PkaBossPage key={slot} {...props} slot={slot} onBusy={setBusy}/>}</div></>;
}
