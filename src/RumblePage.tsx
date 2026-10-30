import {lazy,Suspense,useState} from 'react';
import type {ComponentProps} from 'react';
import PlannerPage from './PlannerPage';
import {TabBar} from './ui';
const AssaultRumblePage=lazy(()=>import('./AssaultRumblePage'));
export default function RumblePage(props:Omit<ComponentProps<typeof PlannerPage>,'kind'>){
 const [mode,setMode]=useState('pirate');
 return <><TabBar prefix="rumble-mode" label="Rumble oyun modu" items={[{id:'pirate',label:'Pirate Rumble'},{id:'assault',label:'Assault Rumble'}]} value={mode} onChange={setMode}/><div role="tabpanel" id={'rumble-mode-panel-'+mode} aria-labelledby={'rumble-mode-tab-'+mode}>{mode==='pirate'?<PlannerPage {...props} kind="rumble"/>:<Suspense fallback={<p role="status">Assault Rumble hazırlanıyor…</p>}><AssaultRumblePage state={props.state} catalog={props.catalog} onEdit={props.onEdit}/></Suspense>}</div></>;
}
