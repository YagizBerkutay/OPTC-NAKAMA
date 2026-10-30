import sharp from 'sharp';
import fs from 'node:fs/promises';
// Only the generic English Character Box banner is retained; no account data.
const area={x:145/900,y:281/1600,width:484/900,height:62/1600};
const rgb=await sharp('.local/recognition-box.png').extract({left:145,top:281,width:484,height:62}).resize(24,4,{fit:'fill'}).removeAlpha().raw().toBuffer();
await fs.writeFile('public/data/box-banner.json',JSON.stringify({version:1,area,rgb:rgb.toString('base64')}));
console.log('Generic Character Box banner reference saved (account data excluded).');
