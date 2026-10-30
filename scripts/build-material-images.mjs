import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const data = JSON.parse(await fs.readFile('public/data/planner.json', 'utf8'));
const tree = JSON.parse(await fs.readFile('.local/material-tree.json', 'utf8')).tree;
const needed = new Set(Object.values(data.units).flatMap(u => u.evolutions.flatMap(e => e.materials)));
const source = new Map();
for (const region of ['jap', 'glo']) for (const f of tree) {
  if (f.type !== 'blob' || !f.path.startsWith(`api/images/thumbnail/${region}/`)) continue;
  const id = path.basename(f.path, '.png');
  if (needed.has(id) && /^\d+-skull$/.test(id)) source.set(id, f.path);
}
for (const color of ['STR', 'DEX', 'QCK', 'PSY', 'INT']) source.set('skull' + color, `api/images/common/skull-${color}.png`);
await fs.mkdir('public/materials', { recursive: true });
await fs.mkdir('.local/material-icons', { recursive: true });
const images = {}, failures = [], jobs = [...source], revision = JSON.parse(await fs.readFile('.local/material-tree.json', 'utf8')).sha;
let cursor = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (cursor < jobs.length) {
    const [id, file] = jobs[cursor++];
    try {
      const cache = `.local/material-icons/${id}.png`;
      let bytes;
      try { bytes = await fs.readFile(cache); } catch {
        const r = await fetch(`https://raw.githubusercontent.com/2Shankz/optc-db.github.io/${revision}/${file}`, { signal: AbortSignal.timeout(30000) });
        if (!r.ok) throw Error('HTTP ' + r.status);
        bytes = Buffer.from(await r.arrayBuffer()); await fs.writeFile(cache, bytes);
      }
      await sharp(bytes).resize(96, 96, { fit: 'contain' }).webp({ quality: 90 }).toFile(`public/materials/${id}.webp`);
      images[id] = `./materials/${id}.webp`;
    } catch (e) { failures.push({ id, error: String(e) }); }
  }
}));
for (const id of needed) if (/^\d+$/.test(id)) {
  const file = `portraits/${id.padStart(4, '0')}.webp`;
  try { await fs.access('public/' + file); images[id] = './' + file; } catch {}
}
await fs.writeFile('public/data/material-images.json', JSON.stringify({ revision, images }));
console.log(JSON.stringify({ images: Object.keys(images).length, skullImages: Object.keys(images).filter(id => /skull/.test(id)).length, failures }));
if (failures.length) process.exitCode = 1;
