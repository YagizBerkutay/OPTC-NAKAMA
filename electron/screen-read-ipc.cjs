function registerScreenRead(handle,withScreenRead,channel,deviceOf,invoke){
 handle(channel,(...args)=>withScreenRead(deviceOf(...args),()=>invoke(...args)));
}

function registerScreenshot(handle,channel,invoke){
 handle(channel,(...args)=>invoke(...args));
}

module.exports={registerScreenRead,registerScreenshot};
