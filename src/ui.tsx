import {useEffect,useId,useRef,type ReactNode} from 'react';
export type TabItem={id:string;label:string;icon?:ReactNode};
export function TabBar({items,value,onChange,label,className='tabs',prefix}:{items:TabItem[];value:string;onChange:(id:string)=>void;label:string;className?:string;prefix:string}){
 const uid=useId();
 return <div className={className} role="tablist" aria-label={label} data-tabset={uid}>{items.map((item,index)=><button key={item.id} type="button" role="tab" aria-label={item.label} id={`${prefix}-tab-${item.id}`} aria-controls={`${prefix}-panel-${item.id}`} aria-selected={value===item.id} tabIndex={value===item.id?0:-1} className={value===item.id?'active':''} data-scenario-tab={prefix==='plan'?item.id:undefined} onClick={()=>onChange(item.id)} onKeyDown={event=>{let next=index;if(event.key==='ArrowRight')next=(index+1)%items.length;else if(event.key==='ArrowLeft')next=(index+items.length-1)%items.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=items.length-1;else return;event.preventDefault();onChange(items[next].id);document.getElementById(`${prefix}-tab-${items[next].id}`)?.focus();}}>{item.icon}{item.label}</button>)}</div>;
}
export const SCENARIO_TABS:TabItem[]=[{id:'current',label:'Mevcut hâl'},{id:'power',label:'Lv.100 · evrimsiz'},{id:'evolve',label:'Lv.100 · evrimli'}];
export function useModalFocus(key:string,onClose:()=>void){
 const callback=useRef(onClose);callback.current=onClose;
 useEffect(()=>{if(!key)return;const dialog=document.querySelector<HTMLElement>('[role="dialog"]');if(!dialog)return;const prior=document.activeElement as HTMLElement|null,backgrounds=Array.from(document.querySelectorAll<HTMLElement>('.sidebar,.main,.skip-link'));backgrounds.forEach(el=>el.inert=true);
 const focusables=()=>Array.from(dialog.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')).filter(el=>!el.hasAttribute('disabled')&&el.getClientRects().length>0);
 (focusables()[0]||dialog).focus();
 const handle=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();callback.current();}else if(e.key==='Tab'){const list=focusables(),first=list[0],last=list.at(-1);if(!first){e.preventDefault();return;}if(e.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){e.preventDefault();first.focus();}}};
 document.addEventListener('keydown',handle);return()=>{document.removeEventListener('keydown',handle);backgrounds.forEach(el=>el.inert=false);if(prior?.isConnected)prior.focus({preventScroll:true});};
 },[key]);
}
export function friendlyError(error:unknown){return String(error).replace(/^Error:\s*/,'').replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/,'').replace(/^Error:\s*/,'');}

