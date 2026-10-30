// Drop arrays also use named difficulties and string skull IDs. Never interpret
// negative IDs (manuals), boosters or Japanese-only records as Global drops.
export function collectMaterialSources(drops, shops, materialIds) {
  const result = Object.fromEntries([...materialIds].map(id => [id, { rewards: [], shops: [] }]));
  for (const [group, islands] of Object.entries(drops)) for (const island of islands) {
    if (island.global !== true) continue;
    for (const [stage, values] of Object.entries(island)) {
      if (!Array.isArray(values) || /^(Japan|boosters|challengeData|gamewith)$/i.test(stage)) continue;
      for (const value of values) {
        if (!(typeof value === 'number' && value > 0 || typeof value === 'string' && /^(?:\d+-skull|skull(?:STR|DEX|QCK|PSY|INT))$/.test(value))) continue;
        const entry = result[String(value)];
        if (!entry) continue;
        const reward = { group, island: island.name, stage };
        if (!entry.rewards.some(r => r.group === group && r.island === reward.island && r.stage === stage)) entry.rewards.push(reward);
      }
    }
  }
  // These lists sell units. Only exact numeric material IDs qualify; a unit
  // being sold does not imply that its special skull is sold in the same shop.
  for (const [shop, values] of Object.entries(shops)) for (const value of values) {
    const entry = result[String(value)];
    if (entry && !entry.shops.includes(shop)) entry.shops.push(shop);
  }
  return result;
}
