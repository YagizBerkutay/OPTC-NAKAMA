import type { Character } from './model';
import type { MaterialRecord, PlannerData, PlanTeam } from './planning';

export type MaterialRoute = { path: string; currency?: string; note: string; url: string; status: 'shop-check' | 'quest' | 'recorded-reward' | 'unknown' };
const DB = 'https://github.com/2Shankz/optc-db.github.io/blob/master/common/data/drops.js';
const SHOPS = 'https://github.com/2Shankz/optc-db.github.io/blob/master/common/data/shops.js';
const KIZUNA = 'https://www.reddit.com/r/OnePieceTC/comments/1lcs6mx';
const TM = 'https://huongdanoptc.wordpress.com/evolve-2/';
const quests: Record<string, { quest: string; url: string }> = {
  '2138': { quest: 'Germa Resurrection Plan!', url: 'https://onepiecetreasurecruise.fr/Crane/Judge%20Vinsmoke.html' },
  '2139': { quest: 'Germa Resurrection Plan!', url: 'https://onepiecetreasurecruise.fr/Crane/Judge%20Vinsmoke.html' },
  '2140': { quest: 'Germa Resurrection Plan!', url: 'https://onepiecetreasurecruise.fr/Crane/Judge%20Vinsmoke.html' },
  '2141': { quest: 'Germa Resurrection Plan!', url: 'https://onepiecetreasurecruise.fr/Crane/Judge%20Vinsmoke.html' },
  '2142': { quest: 'Germa Resurrection Plan!', url: 'https://onepiecetreasurecruise.fr/Crane/Judge%20Vinsmoke.html' },
  '2232': { quest: 'Kami Rises Again!', url: 'https://onepiecetreasurecruise.fr/Crane/Ener.html' },
  '2588': { quest: "Ladies' Repose - Nami", url: 'https://onepiecetreasurecruise.fr/Crane/Nami.html' },
  '2245': { quest: 'Forward! Straw Hat Crew!', url: 'https://onepiecetreasurecruise.fr/Crane/Sanji%20Vinsmoke.html' },
  '2300': { quest: 'Forward! Straw Hat Crew!', url: 'https://onepiecetreasurecruise.fr/Crane/Franky.html' },
  '2259': { quest: 'Higuma - Mountain Bandit at Sea', url: 'https://onepiecetreasurecruise.fr/Crane/Higuma.html' },
  '2434': { quest: "Ladies' Repose - Hancock", url: 'https://onepiecetreasurecruise.fr/Crane/Boa%20Hancock.html' },
  '2448': { quest: 'Germa 66 Counterattack', url: 'https://onepiecetreasurecruise.fr/Crane/Germa.html' },
  '2450': { quest: 'Germa 66 Counterattack', url: 'https://onepiecetreasurecruise.fr/Crane/Germa.html' },
  '2452': { quest: 'Germa 66 Counterattack', url: 'https://onepiecetreasurecruise.fr/Crane/Germa.html' },
  '2454': { quest: 'Germa 66 Counterattack', url: 'https://onepiecetreasurecruise.fr/Crane/Germa.html' },
  '2681': { quest: "The World's Strongest - Bullet", url: 'https://onepiecetreasurecruise.fr/Crane/Douglas%20Bullet.html' },
  '2739': { quest: 'Perfect Superhuman', url: 'https://onepiecetreasurecruise.fr/Crane/Charlotte%20Dent-de-chien.html' },
  '2909': { quest: "The Great Pirate's Legacy", url: 'https://onepiecetreasurecruise.fr/Crane/Barbe%20Blanche.html' },
};
const shops: Record<string, [string, string]> = {
  Ray: ["Tavern → Rayleigh’s Bazaar", 'Rayleigh Points'],
  TM: ['Treasure Map → Treasure Map Exchange', 'Treasure Tickets'],
  Kizuna: ['Kizuna Clash → Exchange → Kizuna Shop', 'Kizuna Insignia'],
  Rumble: ['Pirate Rumble → Rumble Shop', 'Rumble Tickets'],
  PKA: ['Pirate King Adventures → Exchange', 'PKA Tickets'],
  Medal: ['Tavern → Medal Exchange', 'Medals'],
};
function shopRoute(shop: string, note: string, url = SHOPS): MaterialRoute {
  const [path, currency] = shops[shop] || [shop, 'Oyundaki mağazadan kontrol et'];
  return { path, currency, note, url, status: 'shop-check' };
}
export function materialInfo(id: string, name: string, targetId: string, locations: string[], record?: MaterialRecord, skullCharacterName?: string) {
  const specialId = id.match(/^(\d+)-skull$/)?.[1];
  const color = id.match(/^skull(STR|DEX|QCK|PSY|INT)$/)?.[1];
  const rare = /skull/i.test(id);
  const materialName = color ? `${color} Crystal Skull` : specialId ? `${skullCharacterName || 'Karakter'} #${specialId} özel Crystal Skull` : name || `Malzeme #${id}`;
  const routes: MaterialRoute[] = [];
  if (color) routes.push(shopRoute('Ray', 'Renk skull’u bölümünde aynı rengi seç. Karakter portreli skull bunun yerine kullanılamaz.', 'https://www.reddit.com/r/OnePieceTC/comments/1dvez2h'));
  if (specialId && quests[specialId]) {
    const q = quests[specialId];
    routes.push({ path: `Extra Island → Unlockable Quests → ${q.quest}`, note: 'Görevi açıp bu karakterin skull’unu düşür. Rehberdeki eski açma ücreti / takvim güncel Global erişimini garanti etmez; açma ekranını kontrol et.', url: q.url, status: 'quest' });
  }
  if (specialId === '2357' || specialId === '2444') routes.push(shopRoute('TM', 'Characters / skull bölümünde aynı karakterin özel skull’unu seç. Treasure Tickets, Treasure Map oynayarak kazanılır.', TM));
  // Kizuna Exchange in drops is the event reward pool, not proof of current
  // permanent shop stock. Present the shop as a check, and the pool as history.
  if (specialId && (specialId === '3519' || record?.rewards.some(r => r.group === 'Kizuna Clash' && r.stage === 'Kizuna Exchange'))) {
    routes.push(shopRoute('Kizuna', `Skull listesinden #${specialId} formuna ait ${skullCharacterName || 'karakter'} skull’unu ara. Insignia, Kizuna ödüllerinden kazanılır; ödül kutularında kullanılan Kizuna Tickets farklıdır. Yeni skull mağazaya daha sonra eklenebilir.`, specialId === '3519' ? 'https://www.reddit.com/r/OnePieceTC/comments/1068uoo' : KIZUNA));
  }
  for (const shop of record?.shops || []) routes.push(shopRoute(shop, 'Veri tabanında bu malzemenin kendisi bu mağazada listelenmiş. Güncel stok ve birim fiyatı oyundan kontrol et.'));
  const story = (record?.rewards || []).filter(r => r.group === 'Story Island');
  for (const r of story) routes.push({ path: `Adventure → Story → ${r.island} → Bölüm ${r.stage}`, note: 'Kaynakta bu bölümün drop listesinde kayıtlı. Her denemede düşmesi garanti değil.', url: DB, status: 'quest' });
  const rewards = (record?.rewards || []).filter(r => r.group !== 'Story Island');
  // Keep every named reward, but exclude historical Ambush routes from the
  // primary colored-skull instruction (retired modes are not farm guarantees).
  for (const r of rewards) routes.push({ path: `${r.group} → ${r.island} → ${r.stage}`, note: 'Veri tabanındaki görev / etkinlik ödül kaydı. Etkinliğin şu an açık olduğu veya ödül havuzunun aynı kaldığı doğrulanmış değil.', url: DB, status: 'recorded-reward' });
  if (!routes.length && locations.length) routes.push(...locations.map(path => ({ path, note: 'Veri tabanındaki drop kaydı; güncel erişim ve düşme oranı oyundan kontrol edilmeli.', url: DB, status: 'quest' as const })));
  if (!routes.length) routes.push({ path: 'Evolve / Super Evolve → malzemeye bas → Obtain / edinme bilgisi', note: rare ? `#${targetId} evrimi için bu malzemenin kesin edinme yeri kaynakta kayıtlı değil. Tüm özel skull’lar aynı mağazadan gelmez.` : 'Kesin edinme yeri kaynakta kayıtlı değil.', url: DB, status: 'unknown' });
  return { name: materialName, rare, image: record?.image, routes, url: routes[0].url, text: routes[0].path + '. ' + routes[0].note + ' Güncel stok ve fiyat doğrulanmış değil.' };
}

export function teamMaterials(team: Pick<PlanTeam, 'members' | 'reserves' | 'synergy'>, characters: Map<string, Character>, data: PlannerData) {
  const totals = new Map<string, { id: string; count: number; uses: string[]; info: ReturnType<typeof materialInfo> }>();
  for (const m of [...team.members, ...team.reserves || [],...team.synergy?.supports.map(s=>s.member)||[]]) {
    if (m.friend) continue;
    for (const edge of m.path) for (const id of edge.materials) {
      const skullId = id.match(/^(\d+)-skull$/)?.[1];
      const entry = totals.get(id) || { id, count: 0, uses: [], info: materialInfo(id, characters.get(id)?.name || '', edge.to, data.locations[id] || [], data.materialSources?.[id], characters.get(skullId || '')?.name) };
      entry.count++;
      const use = `#${edge.from} → #${edge.to}`;
      if (!entry.uses.includes(use)) entry.uses.push(use);
      totals.set(id, entry);
    }
  }
  return [...totals.values()].sort((a, b) => Number(b.info.rare) - Number(a.info.rare) || a.id.localeCompare(b.id));
}
