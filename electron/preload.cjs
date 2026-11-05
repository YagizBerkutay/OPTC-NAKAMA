const { contextBridge,ipcRenderer }=require('electron');
contextBridge.exposeInMainWorld('nakama',{
    coopTarget:input=>ipcRenderer.invoke('coop:target',input),
    coopRead:input=>ipcRenderer.invoke('coop:read',input),cancelCoop:()=>ipcRenderer.invoke('coop:cancel'),onCoopProgress:callback=>{const listener=(_,text)=>callback(text);ipcRenderer.on('coop:progress',listener);return()=>ipcRenderer.removeListener('coop:progress',listener);},
    pkaRumbleRead:input=>ipcRenderer.invoke('pka:rumble',input),cancelPkaRumble:()=>ipcRenderer.invoke('pka:cancelRumble'),onPkaRumbleProgress:callback=>{const listener=(_,text)=>callback(text);ipcRenderer.on('pka:rumbleProgress',listener);return()=>ipcRenderer.removeListener('pka:rumbleProgress',listener);},
  pkaEvent:refresh=>ipcRenderer.invoke('pka:event',refresh),pkaGuide:input=>ipcRenderer.invoke('pka:guide',input),cancelPka:()=>ipcRenderer.invoke('pka:cancel'),onPkaProgress:callback=>{const listener=(_,text)=>callback(text);ipcRenderer.on('pka:progress',listener);return()=>ipcRenderer.removeListener('pka:progress',listener);},
  bossImages:images=>ipcRenderer.invoke('boss:readImages',images),bossFromImages:input=>ipcRenderer.invoke('boss:assembleImages',input),
  kizunaImages:images=>ipcRenderer.invoke('kizuna:readImages',images),cancelKizunaImages:()=>ipcRenderer.invoke('kizuna:cancelImages'),
  onKizunaImageProgress:callback=>{const listener=(_event,text)=>callback(text);ipcRenderer.on('kizuna:imageProgress',listener);return()=>ipcRenderer.removeListener('kizuna:imageProgress',listener);},
  kizunaAuto:input=>ipcRenderer.invoke('kizuna:auto',input),kizunaTarget:input=>ipcRenderer.invoke('kizuna:target',input),cancelKizunaAuto:()=>ipcRenderer.invoke('kizuna:cancelAuto'),
  onKizunaAutoProgress:callback=>{const listener=(_event,text)=>callback(text);ipcRenderer.on('kizuna:autoProgress',listener);return()=>ipcRenderer.removeListener('kizuna:autoProgress',listener);},
  confirmGuide:(url,input)=>ipcRenderer.invoke('guides:confirm',url,input),
  reportDiagnostic:payload=>ipcRenderer.invoke('diagnostics:report',payload),openDiagnostics:()=>ipcRenderer.invoke('diagnostics:open'),
  bossBehavior:(exe,device)=>ipcRenderer.invoke('boss:readBehavior',exe,device),ambush:boss=>ipcRenderer.invoke('boss:ambush',boss),cancelBossBehavior:()=>ipcRenderer.invoke('boss:cancelBehavior'),onBossProgress:callback=>{const listener=(_,text)=>callback(text);ipcRenderer.on('boss:progress',listener);return ()=>ipcRenderer.removeListener('boss:progress',listener);},
  rumbleRules:(exe,device)=>ipcRenderer.invoke('rumble:readRules',exe,device),cancelRumbleRules:()=>ipcRenderer.invoke('rumble:cancelRules'),onRumbleProgress:callback=>{const listener=(_,text)=>callback(text);ipcRenderer.on('rumble:progress',listener);return ()=>ipcRenderer.removeListener('rumble:progress',listener);},
  assaultRead:input=>ipcRenderer.invoke('assault:read',input),cancelAssault:()=>ipcRenderer.invoke('assault:cancel'),onAssaultProgress:callback=>{const listener=(_,text)=>callback(text);ipcRenderer.on('assault:progress',listener);return()=>ipcRenderer.removeListener('assault:progress',listener);},
  grandPartyRules:input=>ipcRenderer.invoke('grand-party:readRules',input),cancelGrandPartyRules:()=>ipcRenderer.invoke('grand-party:cancelRules'),onGrandPartyProgress:callback=>{const listener=(_,text)=>callback(text);ipcRenderer.on('grand-party:progress',listener);return()=>ipcRenderer.removeListener('grand-party:progress',listener);},
  guides:()=>ipcRenderer.invoke('guides:index'),guide:(url,refresh=false)=>ipcRenderer.invoke('guides:encounter',url,refresh),
  openExternal:url=>ipcRenderer.invoke('app:openExternal',url),
  load:()=>ipcRenderer.invoke('state:load'),save:payload=>ipcRenderer.invoke('state:save',payload),
  recognize:(dataUrl,grid)=>ipcRenderer.invoke('recognition:scan',dataUrl,grid),boxScroll:(exe,device,geometry)=>ipcRenderer.invoke('adb:boxScroll',exe,device,geometry),
  pickAdb:()=>ipcRenderer.invoke('adb:pick'),discoverAdb:()=>ipcRenderer.invoke('adb:discover'),devices:exe=>ipcRenderer.invoke('adb:devices',exe),connect:(exe,device)=>ipcRenderer.invoke('adb:connect',exe,device),screenshot:(exe,device)=>ipcRenderer.invoke('adb:screenshot',exe,device),dataPath:()=>ipcRenderer.invoke('app:dataPath')
});
