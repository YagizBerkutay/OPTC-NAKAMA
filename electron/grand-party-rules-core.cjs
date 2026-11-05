const {createHash}=require('node:crypto');
const CLASSES=['Fighter','Slasher','Striker','Shooter','Free Spirit','Cerebral','Powerhouse','Driven'];
const TYPES=['STR','DEX','QCK','PSY','INT'];
const ATTRIBUTES=['Special CT Speed','Special CT','ATK','HP','DEF','SPD','RCV','Guard','CRIT','Accuracy','Shield'];
const normalize=text=>text.replace(/\bSIasher\b/g,'Slasher').replace(/\bL\s*v\s*\.\s*/gi,'Lv.').replace(/[|_]/g,'').replace(/\s+/g,' ').trim();
const signature=text=>normalize(text).toLowerCase().replace(/[^a-z0-9%+\-]/g,'');
function targets(text){
 const value=text.trim(),tags=[...value.matchAll(/\[([^\[\]]+)\]/g)];
 if(tags.length){if(value.replace(/\[[^\[\]]+\]/g,'').trim())throw Error('GP etiket sınırları doğrulanamadı.');return tags.map(m=>m[1].trim());}
 const values=value.split(/\s*(?:\/|,|\bor\b)\s*/i);
 if(!values.length||values.some(v=>![...CLASSES,...TYPES,'crew','team'].includes(v)))throw Error('GP hedefi okunamadı: '+value);
 return values.map(v=>v==='team'?'crew':v);
}
function parseGrandPartyRules(raw){
 const text=normalize(raw),leader=text.match(/^If leader is (.+?),\s*/i);
 if(!leader)throw Error('Grand Party lider koşulu tam okunamadı.');
 const leaderTargets=targets(leader[1]);
 const tail=text.match(/;?\s*During the last (\d{1,3})\s*(?:s|seconds) of battle,\s*Special CT Speed Up\s*&\s*Damage Up!\s*$/i);
 if(!tail||Number(tail[1])<1||Number(tail[1])>100)throw Error('Grand Party kural metninin sonu doğrulanamadı.');
 const body=text.slice(leader[0].length,tail.index).replace(/;\s*$/,'');
 const ending=body.match(/,?\s*GP Burst Launch Requirement\s*-(\d{1,2})%\s*,\s*GP Burst Uses\s*\+(\d)\s*(\(Special Rule will only affect the Combat Power\))?\s*$/i);
 if(!ending||Number(ending[1])<1||Number(ending[1])>90||Number(ending[2])<1||Number(ending[2])>5)throw Error('GP Burst yüzdesi / kullanım hakkı doğrulanamadı.');
 const stats=body.slice(0,ending.index),pattern=new RegExp(`((?:(?:${ATTRIBUTES.join('|')})(?:\\s*[,./&]\\s*)?)+)\\s+(Up|Down)\\s+Lv\\.(\\d{1,2})(?=\\s*[,;]|\\s*$)`,'gi');
 const effects=[];let offset=0,inherited;
 for(const match of stats.matchAll(pattern)){
  const prefix=stats.slice(offset,match.index).replace(/^\s*,\s*/,'').trim();
  if(prefix){const scope=prefix.replace(/\s+(?:teammates|characters|types?)$/i,'');inherited=targets(scope);}
  const level=Number(match[3]);if(!inherited||level<1||level>20)throw Error('GP bonus hedefi / seviyesi doğrulanamadı.');
  const attributes=[...match[1].matchAll(new RegExp(ATTRIBUTES.join('|'),'gi'))].map(m=>/^Special CT/i.test(m[0])?'Special CT':ATTRIBUTES.find(a=>a.toLowerCase()===m[0].toLowerCase()));
  effects.push({effect:match[2].toLowerCase()==='up'?'buff':'penalty',attributes,level,targeting:{targets:[...inherited]}});
  offset=match.index+match[0].length;
 }
 if(!effects.length||stats.slice(offset).replace(/[\s,;]/g,''))throw Error('GP sayısal bonusları tam çözümlenemedi.');
 const seconds=Number(tail[1]),reduction=Number(ending[1]),extraUses=Number(ending[2]);
 const season={name:'MuMu · güncel Grand Party',leaderTargets,leaderMatch:'any',effectsRequireLeader:true,extraUses,chargeMultiplier:1/(1-reduction/100),effects,note:`GP Burst dolum gereksinimi uygun liderde %${reduction} azalır. Son ${seconds} saniyedeki CT / hasar artışının miktarı belirtilmedi; sayısal bonus eklenmedi.${ending[3]?' Oyun açıklaması “Special Rule will only affect the Combat Power” ifadesini içeriyor; uyum puanı gerçek hasar veya galibiyet garantisi değildir.':''}`};
 return {version:1,mode:'grand-party',season,text,fingerprint:createHash('sha256').update(JSON.stringify(season)).digest('hex'),source:'MuMu · Grand Party · Rule Details',observedAt:new Date().toISOString()};
}
module.exports={normalize,signature,parseGrandPartyRules};
