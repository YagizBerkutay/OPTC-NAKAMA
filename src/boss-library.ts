import type { Boss, Effect, Stage,BossObservation } from './model';
export type EncounterStage = Stage & { notes: string; hp?: number };
export type Encounter = Omit<Boss, 'stages'> & { stages: EncounterStage[]; difficulty: string; reviewed: string; notes: string; blockedSpecialPatterns?: string[];observation?:BossObservation };
const stage = (number: number, name: string, requirements: Effect[], notes: string, hp?: number): EncounterStage => ({ id: `stage-${number}`, name: `Aşama ${number} · ${name}`, turn: number - 1, requirements, notes, hp });
const entry = (id: string, name: string, difficulty: string, source: string, stages: EncounterStage[], notes: string, blockedSpecialPatterns?: string[]): Encounter => ({ id, name, difficulty, source, stages, notes, blockedSpecialPatterns, reviewed: '2026-10-04', training: false });
// Only named, sourced variants belong here. Unknown/latest event cycles are never inferred from a boss name.
export const BOSS_LIBRARY: Encounter[] = [
  entry('arena-mihawk-11', 'Arena Mihawk', '11★ · Moria / Doflamingo rotası', 'https://onepiecetreasurecruise.fr/Arene/Mihawk.html', [
    stage(3, 'Moria', [{ mechanic: 'damageReduction', turns: 2 }, { mechanic: 'threshold', turns: 2 }], '5M HP. Uzarsa kaptan dışı üyelerde stun.', 5000000),
    stage(4, 'Doflamingo', [{ mechanic: 'despair', turns: 6 }, { mechanic: 'bind', turns: 8 }, { mechanic: 'atkDown', turns: 5 }], '10M HP; sağ kolon Bind. 4 PSY orb bariyeri 2 tur. Uzarsa heal-to-damage, special kullanım limiti; düşük HP’de captain swap.', 10000000),
    stage(5, 'Mihawk', [{ mechanic: 'damageReduction', turns: 6 }, { mechanic: 'threshold', turns: 6 }, { mechanic: 'defenseUp', turns: 10 }], '60M HP, BLOCK orblar, yalnız normal saldırı hasarı. Chain lock veya DEF düşüren special buff silme + 10 tur Silence + 3 tur ship bind tetikler. Uzayan dövüşte Despair, EOT hasar; düşük HP’de savunma.', 60000000),
  ], 'Barajlar, BLOCK orblar, stun, NAO ve karşı saldırılar ayrıca kontrol edilmeli. Rebecca rastgele çıkarsa cooldown sıfırlanır; plan bu rastgele yardımı varsaymaz.', ['(?:locks?|sets?) (?:the )?chain multiplier', 'reduces? (?:the )?(?:enemies.*?DEF|DEF of|defense of)']),
  entry('arena-fransuke-11', 'Arena Fransuke (Franky)', '11★ · Usohachi / O-Robi / Zorojuro', 'https://onepiecetreasurecruise.fr/Arene/Fransuke.html', [
    stage(3, 'Usohachi ve O-Robi', [], 'İki düşman, ayrı ayrı 1.5M HP. Chain lock 1.1×, EOT 5000 hasar; special limiti 2. Uzayan dövüşte Paralysis ve kötü orblar.', 3000000),
    stage(4, 'Zorojuro', [{ mechanic: 'bind', turns: 5 }, { mechanic: 'despair', turns: 5 }], '15M HP; üst / orta sıra Bind, cooldown geri alma 1 tur, BLOCK. Uzarsa Hunger / DEX bariyeri.', 15000000),
    stage(5, 'Fransuke', [{ mechanic: 'bind', turns: 5 }, { mechanic: 'damageReduction', turns: 5 }], '40M HP, QCK’ye dönüşür, NAO, orta / alt sıra Bind. Orb değiştiren / tüketen special BLOCK tetikler. Her tur HP kesme; düşük HP’de stun.', 40000000),
  ], 'Special limiti, cooldown geri alma, orblar ve NAO otomatik doğrulanmaz. Orb special karşı saldırısına dikkat et.'),
  entry('raid-mihawk-40', 'Clash Mihawk', 'Master · 40 stamina', 'https://op-tc-eng-version.blogspot.com/p/mihawk-raid.html', [
    stage(3, 'Marine', [], 'Ön saldırı 2202 hasar; penguinde stall yapılabilir.'),
    stage(4, 'Pirates ve Sea Stallion', [], 'İlk saldırılarında 6 tur Bind. Önce korsanları / Sea Stallion’ı yen; Bind ön saldırı değildir.'),
    stage(5, 'Mihawk', [], '1.18M HP; ön saldırı 4000, normal saldırı 10000, <%20 HP’de 25000 hasar.', 1180000),
  ], 'Bu eski Clash varyantı Arena Mihawk’tan farklıdır. Hazır mekanik yoksa sonuç yalnız kaptan / rol uyumuna göre sıralanır.'),
  entry('raid-enel-60', 'Clash Enel', 'Ultimate · 60 stamina', 'https://op-tc-eng-version.blogspot.com/2016/01/clash-god-enel-ultimate-walkthrough.html?m=0', [
    stage(3, 'Skypiea Priests', [{ mechanic: 'bind', turns: 1 }], 'PSY Bind ve PSY’ye karşı savunma; düşman tipine göre hedef değişir.'),
    stage(4, 'Goat Priests / Seahorse', [], 'Seahorse saldırırsa 6 tur Bind; diğerleri renk bazlı 2 tur Bind. İlk saldırıdan önce temizle.'),
    stage(5, 'Enel', [{ mechanic: 'defenseUp', turns: 3 }], 'QCK; 4M HP. Debuff koruması 3 tur; orbları karıştırır. <%50 HP kesme, <%20 ağır special.', 4000000),
  ], 'Her 3 turda 1800 sabit yıldırım hasarı. Tip bazlı Bind / savunma koşullarını rehberden kontrol et.'),
  entry('skull-enel', 'Enel skull görevi', 'Kami Rises Again! · rehberdeki boss rotası', 'https://onepiecetreasurecruise.fr/Crane/Ener.html', [
    stage(3, 'Enel', [{ mechanic: 'paralysis', turns: 2 }], '1.19M HP; damage reduction special buff silme tetikler.', 1190000),
    stage(4, 'Enel', [{ mechanic: 'atkDown', turns: 3 }], '1.12M HP; orb karıştırma.', 1120000),
    stage(5, 'Enel', [{ mechanic: 'damageReduction', turns: 3 }], 'STR / DEX / QCK hasarını azaltır; uzarsa Silence 2 tur.', 1435000),
    stage(6, 'Enel', [{ mechanic: 'defenseUp', turns: 1 }], '2 PERFECT bariyeri; 1 tur sonra ölümcül saldırı. Delay / damage reduction buff siler.', 566600),
    stage(7, 'Enel', [{ mechanic: 'threshold', turns: 3 }], '8.039M HP; threshold 5000. Düşük HP’de Bind etkileri. Ölünce 401959 HP ile canlanır; 26 hit bariyeri, Despair 5, Paralysis 2, bazı tiplere Silence 20.', 8039180),
  ], 'Canlanma ayrı dövüştür; aşağıdaki special planı canlanmayı otomatik çözmez. Güncel Global erişimi Extra Island / Kizuna’dan kontrol edilmeli.'),
];

export { materialInfo } from './evolution-materials';
