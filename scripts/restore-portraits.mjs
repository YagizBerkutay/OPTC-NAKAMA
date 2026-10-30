import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const meta = JSON.parse(await fs.readFile('public/data/recognition.json', 'utf8'));
const missing = [];
for (const item of meta.templates) {
  try { await fs.access(`public/portraits/${item.key}.webp`); }
  catch { missing.push(item); }
}
let cursor = 0, done = 0;
const failures = [];
async function work() {
  while (cursor < missing.length) {
    const item = missing[cursor++];
    try {
      if (!/^\d+(?:-[12])?$/.test(item.key) || !/^api\/images\/thumbnail\/(glo|jap)\/[\d/]+(?:-[12])?\.png$/.test(item.source)) throw Error('Unexpected reference path');
      let png;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch('https://raw.githubusercontent.com/2Shankz/optc-db.github.io/master/' + item.source, { signal: AbortSignal.timeout(30000) });
          if (!response.ok) throw Error('HTTP ' + response.status);
          png = Buffer.from(await response.arrayBuffer());
          break;
        } catch (error) { if (attempt === 2) throw error; }
      }
      await sharp(png).flatten({ background: '#000' }).removeAlpha().resize(112,112,{fit:'fill'}).webp({quality:85}).toFile(path.join('public/portraits', item.key + '.webp'));
    } catch (error) { failures.push({key:item.key,error:error.message}); }
    done++;
    if (done % 250 === 0 || done === missing.length) console.log(`${done}/${missing.length}; failed ${failures.length}`);
  }
}
await Promise.all(Array.from({length:16},work));
await fs.mkdir('.local', {recursive:true});
await fs.writeFile('.local/portrait-restore.json', JSON.stringify({total:missing.length,done,failures},null,2));
if (failures.length) process.exitCode = 1;
