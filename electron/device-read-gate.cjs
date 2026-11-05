function createDeviceReadGate(validateDevice){
 const active=new Set(),undrained=new Set();
 return async function withDeviceRead(device,operation){
  if(typeof operation!=='function')throw Error('MuMu ekran işlemi geçersiz.');
  const serial=validateDevice(device).replace(/^localhost:/,'127.0.0.1:');
  if(undrained.has(serial))throw Error('Bu MuMu cihazındaki önceki okuma güvenli biçimde sonlanmadı. Uygulamayı yeniden başlat.');
  if(active.has(serial))throw Error('Aynı MuMu cihazında başka bir ekran okuması sürüyor. İşlem bitince yeniden dene.');
  active.add(serial);
  try{return await operation();}catch(error){if(error?.code==='SCREEN_READ_UNDRAINED')undrained.add(serial);throw error;}finally{active.delete(serial);}
 };
}
module.exports={createDeviceReadGate};
