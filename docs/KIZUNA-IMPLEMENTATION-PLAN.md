# Kizuna Clash takım kurma: araştırma ve uygulama planı

Tarih: 21 Ekim 2026. Global sürüm hedefleniyor. Aynı gün kaynak ve kod denetiminden geçirilmiş plan. İlk araştırma ve plan denetiminde v0.5.36 değiştirilmedi; kullanıcının sonraki uygulama talebiyle başlayan v0.5.37 kapsamı bölüm 10'da izleniyor.

## 1. Karar

Kizuna'yı mevcut PvE doğrulayıcısının üzerine, etkinliğe özel bağlam ve amaç ekleyerek kuracağız. Normal boss'ta geçiş, bilet kazanma ve Super Boss kaynağı kazanma; Super Boss'ta saldırı başına gerçekleşebilir katkı; SOS'ta kalan HP'yi bitirme ayrı hedeflerdir. Bilet ile token tek puanda toplanmaz. Bir ödül çarpanı geçilemeyen savunmayı, kullanılamayan special'ı veya hasar vermeden ölümü telafi edemez. Her debuff'ın kaldırılması şart değildir: etkisiz kalan, güvenle katlanılan veya geçerli bir yolla aşılan etki de aksiyon iziyle kanıtlanabilir.

İlk kullanılabilir sürüm: tek doğrulanmış Global etkinlik, normal boss'un seçili varyant/seviyesi ve mevcut kutuyla modellenebilen bir geçiş planı. Ödül kuralları da biliniyorsa bilet/token için ayrı alternatifler eklenir. Bütün seviyelerin tablosunu veya normal hesapta etkisi olmayan bir Super Boss kuralını beklemek gerekmez. Seçilen normal kadro Tandem/EX/VS gibi bir aksiyona dayanıyorsa o aksiyon bu ilk sürümde doğrulanmak zorundadır; sırf Super aşaması sonraya bırakıldı diye hazır sayılmaz. Arama bütçesi ve desteklenen yeteneklerle bulunan en iyi aday, matematiksel olarak tüm olası kadroların optimumu diye sunulmaz.

## 2. Araştırma kanıtları ve geçerlilik sınırları

### Kizuna'daki “artılar”

| Etki | Takım planına etkisi | Veri kuralı |
|---|---|---|
| Bilet ödülü artışı | Normal boss çiftliğinde aynı güvenilir geçişi daha değerli yapabilir | Sezon, görev, pozisyon, arkadaş kaptan ve istifleme/yuvarlama kapsamı doğrulanır |
| Super Boss token/coin artışı | Normal boss'tan kaynak kazanma hedefini etkileyebilir | Bilet çarpanı ve hasar çarpanı ile aynı alan değildir |
| Etkinlik ATK/HP/RCV artışı | Normal karakter sıralamasını ve HP koşullarını değiştirebilir | Hangi stat, hangi karakter/form, hangi savaşta olduğu ayrı tutulur |
| Special cooldown indirimi | Sınıf/tip dışındaki karaktere uygulanır sanılırsa gereken special hazır olmaz | Etkinlik karakter bonusu ile Battle 1 aksiyonu ayrı kaynaklardır |
| Etkinliğe özel captain veya tüm tiplere üstünlük | Normal kart metninden farklı kaptan/renk hesabı gerekebilir | Kaynak açıkça vermiyorsa normal karta eklenmez |
| Alliance / Kizuna Support | Stat katkısı sağlayabilir; bazı katkılar rastgele tetiklenir | Gerçek görülen katsayı ve garantili/olasılıklı durum ayrılır |
| Damage Limit Break | Hasar tavanını ve en iyi hasar kartını değiştirebilir | Kartın kalıcı yeteneği ile etkinlik özel etkisi karıştırılmaz |

Bonus türlerinin birlikte bulunduğu gerçek bir örnek GameWith'in Marco/Ace Kizuna kaydıdır: ödül, token, stat, cooldown, tip üstünlüğü ve değişen captain ayrı anlatılır. Bunlar o tarihî etkinliğin değerleridir; yeni sezonun varsayılanı değildir. [Kaynak: Blackbeard Super Boss rehberi](https://xn--pck6bvfc.gamewith.jp/article/show/316381)

**Yeni bilgi:** Resmî Global mektup, 19 Ekim 2026 (PST) Ver.16.2 sonrasında düzenlenen Kizuna'larda uygun karakterlere etkinlik özel etkisi olarak **Damage Limit Break** ekleneceğini bildiriyor. Sayısal tavan, hedef, istifleme ve uygulama sırası bu metinde açıklanmıyor; uygulamada Help ve sezonun Special Effects açıklamasıyla doğrulanmalı. [Resmî duyuru, 15 Ekim](https://optc-ww.channel.or.jp/news/2729/)

### Boss ve seviye bağlamı zorunlu

- Eski genel rehber üç tipli döngüyü anlatıyor; incelenen Queen sayfasında iki normal ve iki Super Boss bağlantısı görüldü. Bağlantı listesi etkinliğin bütün varyantlarını kapsadığını kanıtlamaz. Ne üç renk ne de iki renk evrensel kural yapılacak; Global etkinlikten doğrulanan liste kullanılacak. Genel rehberin rastgele Kizuna Support açıklaması da tarihî sistem bilgisi olup güncel katsayı kanıtı değildir. [Genel sistem rehberi](https://xn--pck6bvfc.gamewith.jp/article/show/148537), [Queen Super Boss, Eylül 2026](https://xn--pck6bvfc.gamewith.jp/article/show/578015)
- Gerçek bir Kizuna kaydında Battle 1 belirli sınıfların special cooldown'unu, switch sayısını ve VS göstergesini ayrı ayrı artırıyor; aynı boss'un Lv.31 sonrası mekanikleri farklı. “Herkese 15 hazırlık turu” bu davranışı doğru modellemez. [Mihawk & Perona normal boss kaydı](https://xn--pck6bvfc.gamewith.jp/article/show/511156)
- Normal / Super Boss, tam HP / SOS kalan HP, güçlük ve seviye birbirinin yerine geçmez. Super Boss için ittifakın yüksek ortak HP'li hedefe katkı amacı ayrı tutulmalı. [Alliance Kizuna açıklaması](https://huongdanoptc.wordpress.com/kizuna-2/)
- Eski bir resmî JP duyurusu farklı güçlüklerin seviye artışına farklı sınırlar getirildiğini gösteriyor. Güncel Global'e bu eski sayıları taşımayacağız; fakat tek evrensel, sınırsız HP büyümesi formülü de yazmayacağız. [Bandai, 15 Eylül 2024](https://optc-ww.channel.or.jp/news/519/)

**Kaynak kalitesi uyarısı:** Bazı GameWith sayfalarında yazının kendi tarihî boss içeriği ile ortak “güncel etkinlik” kutusu farklı tarih/sezon gösteriyor. Son güncelleme tarihi tek başına etkinlik kimliği değildir. JP rehberi Global'e sessizce uygulanmayacak. `3-2` gibi bir başlık da tek başına “aynı savaşın ikinci turu” olarak yorumlanmayacak; seviye bandı, varyant ve PREEMPTIVE/TURN etiketi kaynakla birlikte çözülmeli. Anlamı belirsiz bölüm taslak kalır.

Resmî duyuru bir özelliğin ilan edildiğine kanıttır; güncel oyundaki sayısal formülün doğrulandığı anlamına gelmez. Topluluk rehberi, geçmiş etkinlik örneği ve güncel Global oyun görüntüsü ayrı kaynak türleridir. Her sayısal kural/katılım koşulu için kaynak bölümü veya görsel kesiti, ham metin, bölge, etkinlik/sürüm, gözlem zamanı ve alan bazında doğrulama durumu tutulur. Bir “Global ile eşleşiyor” onayı eksik çarpanları veya HP formülünü doğrulamaz. Booster adı/portresi katalogdaki kesin kart ID'si ve formuyla eşleşmeden hesaba girmez; aynı adlı veya 6+ kart bonusu kendiliğinden devralmaz.

## 3. Bir oyuncunun izlediği takım kurma sırası

1. **Hedefi seç:** Normal güvenli geçiş, Normal bilet verimi, Normal'den Super giriş kaynağı kazanma, Super Boss katkısı veya SOS bitirme. Ardından etkinlik / boss tipi / güçlük / seviye / kalan HP.
2. **Giriş ve uygunluk:** Yasak karakterler, sınıf/tip/kimlik/Support sınırlamaları; kaptan ve arkadaşın da geçerli olması. Gerçek mevcut form kontrol edilir.
3. **Aşamaları çıkar:** Battle 1 hazırlığı; Battle 2'de HP/skill/orb/switch kurulumu; boss savunmaları, tüm hedefler, seviye değişimleri ve ölüm/interrupt/sonraki tur aksiyonları.
4. **Gerekli çözümleri yerleştir:** En az alternatifi olan mekaniklerden başla. Giderici, doğrulanmış captain/sailor direnci, yasal Support, switch veya gerçekten geçerli hasar bypass'ı arasında slot tasarrufu ara. Bind/silence altındaki giderici hazır kabul edilmez. Kullanılmayacak special üzerindeki silence gibi sonucu etkilemeyen bir debuff, otomatik olarak bir giderici slotu gerektirmez.
5. **Hasar çekirdeğini kur:** Kaptan kapsamı, doğru tip ve Weakness Class/Type; ATK, orb, affinity, chain, base ATK ve diğer bağımsız etkiler. Aynı kategorinin buff'ları körlemesine çarpılmaz. Etkinlik güçlüsü normal listede düşük görünse de aday havuzundan atılmaz.
6. **Eylem sırasını kur:** Önceki aşamadan taşınan buff/orb/HP, special limitleri, switch sayacı, VS/Rush göstergesi; sonra special/ST/SC/EX/Tandem/Rush/Last Tap vb. yalnız gerçek koşulları ve seviyeleri sağlanınca. Düşman interrupt'ı tetiklenirse etkisi o anda uygulanır; yalnız planı geçersiz kılıyorsa yol reddedilir. Faydalı veya güvenle katlanılan interrupt da mümkün olduğundan her tetik otomatik engel değildir.
7. **Gerçekleştirilebilir saldırıyı hesapla:** Slot veya timing bariyeri, NAO, defans türleri, sınırlı vuruş, hasar tavanı, tap sırası ve her hedefin HP'si. Gerekiyorsa sonraki turdaki saldırıyı ve hayatta kalmayı da ekle.
8. **Amaç için sırala:** Normal'de bitirme şartını sağlayanlar arasında seçilen ödül / işlem kolaylığı; Super Boss'ta ulaşılabilen penceredeki katkı ve doğrulanmış giriş maliyeti; SOS'ta kalan HP'yi bitirme. Bilinmeyen düşman HP'siyle “yeterli hasar” etiketi verilmez. Farklı para birimleri arasında dönüşüm oranı uydurulmaz.

Örnek, tamamen temsili rakamlarla: boss 90M HP ise güvenilir 100M hasar + 1,5× bilet takımı, 140M + 1× takımından daha iyi çiftlik önerisi olabilir. Boss 120M olunca ilk takım güvenilir bitirme şartını kaybeder. Bu, bilet puanını büyük seçerek çözülemez.

## 4. Mevcut kodun durumu ve gerekli ekler

| Mevcut yer | Yeniden kullanılacak parça | Kizuna için eksik |
|---|---|---|
| `src/model.ts`, `boss-library.ts` | Boss, Stage, events, restrictions | Etkinlik kimliği, varyant, boss seviye bandı, kalan HP, bonus kapsamı |
| `src/planning.ts`, `planning-jobs.ts` | Seçili senaryo worker'ı, erken önizleme, zorunlu çözücü koruma | Açık Kizuna yönlendirmesi, bağlamlı aday üretimi, hedefe göre terminal/ödül değerlendirme, cache anahtarı |
| `src/pve-combat.ts`, `engine.ts`, `boss-timeline.ts` | Special alt kümeleri, sezgisel kullanım sırası, cooldown, bariyer, buff ve HP denetimi | Gerçek aksiyon/çok tur yürütücüsü, başlangıç kaynakları, ileri aksiyon state'i, hasar limitleri; mevcut akış bunların tam simülatörü değil |
| `src/skill-levels.ts`, `skill-analysis.ts` | Kart seviyeleri, form ve koşul metni, yetenek denetimi | Kizuna-only ve boss-Lv koşullarının açık değerlendirilmesi |
| `electron/gamewith-guide.cjs` | Kaynak metni koruyan kontrollü çeviri | Eski parser bazı boss başlıklarına Battle 5 atıyor; incelenen Kizuna'nın üç aşamalı düzeni/seviye bandı ve yeni div/tab formatı doğrudan destekli değil; aşama sayısı evrenselleştirilmez |
| `BossImageImport`, `BossSource` | Fotoğraf, düzenlenebilir OCR, kısmi veri / koşul onayı | Kizuna etkinlik/bonus paneli, normal/super ve boss-Lv aralığı |

Mevcut hasar raporu Gemi/CC/Last Tap/Tandem/Rush/Territory ek hasarını varsaymadığını açıkça söylüyor; Weakness Class katsayısı da bilinmiyorsa eklenmiyor. Bu hâliyle “Super Boss'ta olabilecek en güçlü kadro” motoru sayılmaz. Aynı metni yalnız listede göstermek, yeteneğin hesaplandığı anlamına gelmeyecek.

**Entegrasyon kapısı:** `PlanRequest.kind` yalnız `teams | boss | rumble` kabul ediyor (`planning.ts:36`); `timedBoss` yalnız `kind === 'boss'` dalında hazırlanıyor (`:387`). Sadece bir `kizuna` sekmesi eklemek yetmez: mevcut genel PvE dalına düşüp boss'suz kadro üretebilir. UI → tipli iş/worker → session → aday projeksiyonu → karşılaşma yürütücüsü → sonuç/teşhis → kaydetme/dışa aktarma zincirinin tamamı Kizuna bağlamını taşımalı. Bilinmeyen iş türü, eksik varyant veya geçersiz bağlam genel kadroya düşmek yerine açık hata vermeli. Ortak PvE kuralları ve Support/kimlik denetimi paylaşılacak; ikinci bağımsız hasar motoru kopyalanmayacak.

`engine.ts` hazır special alt kümelerini ve `usableOrder` sezgisini tarıyor; bütün special/atak sıralarını veya ileri aksiyonları yürütmüyor. `boss-timeline.ts` yalnız açık TURN bilgisinden zaman penceresi çıkarıyor; başlık son ekini tur saymama koruması zaten var ve korunmalı. Mevcut pencerelere sabit hazırlık turu eklemek Kizuna simülasyonu yerine geçmez.

## 5. Veri ve hesaplama tasarımı

### Etkinlik kaydı

- `KizunaEvent`: Global sezon kimliği, tarihler/saat dilimi, oyun/rehber sürümü, boss adı, kaynaklar ve yalnız gözlemlenmiş varyant listesi; listenin tamlığı ayrıca belirtilir.
- `KizunaVariant`: karşılaşma modu (`preliminary / normal / super`), güçlük, düşmanlar/tipler, açık seviye aralıkları ve mekanik değişimleri. Yardım/SOS, karşılaşma modundan ayrı `accessMode` alanıdır; izin verilen kombinasyonlar etkinlik kuralından gelir. Başlıktan veya tip döngüsünden seviye tahmini yapılmaz. Aralıklar desteklendiği söylenen kapsamda boşluksuz/çelişkisiz olur; sınırların dahil olup olmadığı ve değişimin ekleme mi değiştirme mi olduğu açık yazılır.
- `KizunaContext`: etkinlik/varyant revizyonu, gerçek boss seviyesi, orijinal maksimum HP, güncel kalan HP + gözlem zamanı, hedef, gelişim senaryosu, gemi/socket ve doğrulanmış arkadaş kaptan durumu; alliance etkisi ve ayrı opsiyonel Kizuna Support senaryosu. Yardımcı kaptan kullanıcının kendi kopyası gibi varsayılmaz; sahiplik dışı istenen arkadaş ile gerçekten bulunan arkadaş ayrılır.
- `KizunaBonus`: kesin kart kimliği/formu veya açık hedef grubu; stat, ticket, token, cooldown, captain override, tip üstünlüğü, damage-cap etkisi; mod/pozisyon/arkadaş/Support kapsamı; istifleme ve yuvarlama kuralı; alan bazında kaynak kanıtı. Bilinmeyen katsayı `1` diye doğrulanmaz; bir modun bonusu diğerine taşınmaz.
- `KizunaRewardRule`: ödül türü ve para birimi, hangi başarı/katkı durumunda kazanıldığı, taban/çarpan/yuvarlama, ilk geçiş/ek drop ayrımı ve giriş maliyeti. Bilet verimi ile Super giriş kaynağı verimi ayrı amaçlar veya Pareto alternatifleridir.
- `AbilityCondition`: kart metnindeki gerçek kapsam; etkinlik/mod, preliminary istisnası, boss-Lv, orijinal maksimum HP'ye bağlı ilerleme eşiği ve savaş içi güncel HP yüzdesi ayrı koşul türleridir. Seviye/sayaç koşullu captain, sailor, special, Support ve ileri aksiyonlar aynı bağlamla değerlendirilir. “Kizuna-only” tek başına bütün modlarda etkin veya preliminary'de kapalı anlamına gelmez; örneğin [Kinemon kartındaki preliminary hariç koşulu](https://xn--pck6bvfc.gamewith.jp/article/show/250070) o kartın açık metnidir.
- Owned kayıtlar değiştirilmez. Kizuna profilleri isteğe bağlı yeni alanla, eski kutuları açabilen doğrulama/default ile saklanır. Ham büyük sayı, kaynak, kapsam ve revizyon önizleme/worker/kaydetme/dışa aktarmada korunur; desteklenmeyen şema sessizce eski boss biçimine indirgenmez.

**SOS ayrımı:** Lv.31 boss'un kalan HP'si Lv.30'un HP'sinden düşük olsa bile Lv.31 mekanikleri ve orijinal maksimum HP koşulları korunur. Kalan HP yalnız bitirme hesabını ve gerçekten güncel HP'ye bakan koşulları değiştirir. Savaş içi yüzde için hangi maksimum HP paydasının kullanıldığı kaynakla belirlenir. Eski SOS görüntüsü güncel kalan HP diye sunulmaz; yeniden doğrulanmadan bitirme garantisi verilmez.

### Eksik verinin hangi sonucu engellediği

Tek bir `verified` bayrağı yerine uygunluk, aksiyon/mekanik, hasar, ödül ve kaynak kapsamı ayrı durum taşır. Engel kullanılan aksiyon ve seçilen hedefe uygulanır:

| Belirsizlik | Sonuca etkisi |
|---|---|
| Giriş koşulu veya kullanılan kartın yasal formu/kimliği bilinmiyor | Yasal ve hazır kadro iddiasını engeller; yalnız açık eksikli taslak |
| Kullanılan giderici/aksiyon, zorunlu tetik veya hayatta kalma hesabı eksik | O yürütme yolunu doğrulanmış çözüm saymayı engeller; başka kanıtlı yol aranır |
| Boss HP/DEF, ilgili weakness veya hasar tavanı bilinmiyor | Etkilenen hasar aralığı ve bitirme iddiası belirsiz; kesin etkilenmeyen bir alt sınır kanıtlanabiliyorsa ayrıca gösterilir |
| Bilet/token istifleme veya yuvarlama bilinmiyor | İlgili ödül optimizasyonunu engeller; bağımsız olarak hesaplanabilen normal geçişi engellemez |
| Seçilen kadronun kullanmadığı bonus/ileri aksiyon eksik | Diğer hesapları kapatmaz; fakat bütün kartları kapsayan maksimum iddiası verilemez |
| Mevcut level/cooldown/ileri yetenek seviyesi bilinmiyor | Mevcut hâl hazır sayılmaz; açık varsayımlı hedef geliştirme planı ayrı sunulur |

Sonuçta “eksik taslak”, “modellenen mekanikler karşılandı”, “verilen girdilerle tahmini geçiş/katkı” ve “oyunda gözlenen sonuç” ayrılır. Lv.100 hedefi bugünkü kutunun hazır olduğu anlamına gelmez. Son kutu denetiminde 693 kaydın mevcut seviyeleri bilinmiyordu; bu eksikliği varsayılan değerle kapatıp hazır etiketi vermemek gerekir.

### Savaş durumu

Cooldown, savaş içi ve toplam geçen tur, switch birikimi, VS/Rush göstergesi, form, HP ve orb/buff ayrı tutulur. Başlangıç formu ve göstergeler kayıt/görüntüden gelir; bilinmeyen gösterge dolu sayılmaz. Battle 1 her kaynağı kendi hedef grubuna bir kez uygular; stage geçişi sahte 15 tur üretmez. `readyTurn` tek başına bu kaynakların tamamını temsil edemez. Genel planner'ın varsayılan stall hazırlığı Kizuna'ya taşınmaz; beklenen her tur düşman cevabıyla birlikte planlanır.

Yürütücü, kaynakla doğrulanan sırayı kaydeden tipli bir aksiyon izi üretir: aşamaya giriş/pasif/preemptive → oyuncu aksiyonu ve kullanım şartı → etkiler ve varsa interrupt → seçilen hedeflere tap sırası → düşman/turn-end etkileri → sonraki tur/aşama. Bu özet içindeki ayrıntılı etki önceliği kart/oyun kanıtından gelir; bütün etkiler için tek evrensel sıra uydurulmaz. Switch, form değişimi, Support tetiklenmesi, single-use ve yeniden special kullanımı gerçek state'i değiştirir; her butona basış tur geçirmez. Düşman ölünce sonraki gereksiz aksiyonlar yapılmaz; revive/defeated davranışı ve kalan hedefler işlenmeden aşama geçilmiş sayılmaz. Buff süresi, kalıcı sahne etkisi ve stage geçişinde silinen etki ayrı tutulur.

Bonusun uygulanma sırası kanıtla tanımlanır; kartın temel/LB/LLB statına, Support ve gemiye iki kere eklenmez. Kaptanın HP koşulu doğru sıradaki gerçek HP'den hesaplanır. Olasılıklı ekstra stat baseline'da kapalıdır; etkinleşmiş alternatif ayrı gösterilir.

Hasar raporu ham hesap, düşman savunması sonrası, kişi/vuruş/tur/toplam cap sonrası ve kalan HP'ye kadar yararlı hasarı ayırır. Etkinlik Damage Limit Break ile kartın kalıcı aynı adlı yeteneği ayrı işlenir. İlgili cap kapsamı ve yuvarlama sırası doğrulanır; yalnız nihai toplamı yuvarlamak yeterli değildir. Olumlu olasılıkların üst sınırı gerçekleşebilir hasar diye sıralanmaz; kullanılan alt/üst sınırın hangi bilinmeyenlerden geldiği gösterilir.

Sayı hassasiyeti ilk veri girişinden korunur: `Stage.hp: number` ve GameWith `jpNumber()` dönüşümü büyük sayıyı zaten kaybedebileceğinden, sonradan BigInt'e geçmek çözüm değildir. HP/hasar tam değerleri ondalık string olarak alınır/saklanır; hesapta kanıtlanmış yuvarlama ile büyük tamsayı veya sabit hassasiyet kullanılır. Kesirli çarpan da hassasiyetli temsil edilir; kontrolsüz `Number`/32-bit dönüşümü yapılmaz. Kısaltılmış ekran HP'si tam sayı değil aralıktır. Eski motora adaptör yalnız güvenli aralığı kabul eder; JSON'da decimal string, girişte uzunluk/aralık doğrulaması uygulanır. Desteklenmeyen sayı veya formül açıkça raporlanır.

HP yalnız ekrandaki sayıyla veya o sezon/varyanta ait doğrulanmış taban+büyüme+yuvarlama/cap kuralıyla bulunur. `1.04^Lv` gibi tarihî formül varsayılan değildir. “Bu takımla şu Lv'ye kadar” ancak aralığın tamamındaki HP/mekanikler doğrulanırsa söylenir.

### Sıralama

- Ortak kapı: yasal kadro, erişilebilir aksiyonlar ve hedefe uygun yürütme yolu. Her etki `kaldırıldı / etkisiz / güvenle katlanıldı / geçerli yolla aşıldı / engel / belirsiz` durumlarından birini alır. Mevcut `missing.length` sıralaması tek başına bu kararın yerine geçmez.
- Normal çiftlik: gerekli tüm hedefler, revive/defeated aşamaları ve ödül için gereken hayatta kalma sağlanır. Bu takımlar içinde seçilen tek ödül türü ve kolay kullanım değerlendirilir. Taban, maliyet veya istifleme bilinmiyorsa toplam ödül/verim uydurulmaz; yalnız doğrulanan çarpan/kapsam gösterilir. Farklı güçlükler ancak aynı para birimi ve doğrulanmış maliyetle kıyaslanır.
- Super: hedef terminali tam kazanım yerine geçerli katkı olabilir. Tam boss'u tekte kesmek veya normal savaşın bütün debuff'larını kaldırmak ön şart değildir. Kabul edilen katkının hangi anda kaydedildiği ve ölüm/yenilgi sonrası sayılıp sayılmadığı doğrulanır; aksi halde “ölmeden önce vurur, sayılır” varsayımı yapılmaz. Kısmi katkı, kalan HP bitirme ve tam zafer ayrı etiketlenir.
- SOS: güncel kalan HP ve aynı boss-Lv mekanikleri. Başkasının kadrosundaki booster kendi ödül bonusuna eklenmez; kendi seçilmiş crew/arkadaş kapsamı kanıtlanır.
- Pareto alternatifler: yüksek ödül, yüksek güvenilir hasar, kolay uygulama. Tek keyfî puanla biri diğerinin zorunlu şartını satın alamaz. Kaynak vermeden yüzde kazanma olasılığı üretilmez.

### Arama ve performans bütçesi

Önce uygunluk ve en az alternatifi olan gerçek engeller; sonra çözücü/hasar/bonus sinerjisiyle aday üretimi; son olarak aynı yürütücüyle doğrulama. Kritik giderici, bonus veya cap sağlayıcısı yalnız düşük ATK diye ilk 24 kartın dışında bırakılmaz. Arama genişliği ve budama ölçülür; teorik üst sınır kullanılıyorsa güvenli olduğu kanıtlanır. Tüm sıraları kaba kuvvet taramak yerine aynı savaş durumuna ulaşan yollar birleştirilir; amaç/ödül/single-use farkları kaybedilmez.

Seçili varyant + gelişim + amaç hesaplanır; diğerleri istek üzerine. Başlangıç hedefi, uygun bir aday bulunduğu işlerde ilk tamamen doğrulanmış adayın 5 saniye içinde görünmesi ve 20 saniyelik yapılandırılabilir arama bütçesidir; bunlar henüz ölçülmüş başarı değildir. Süre dolunca sadece doğrulaması bitmiş en iyi adaylar gösterilir, aday yoksa açık neden verilir. İptal hedefi 1 saniyedir; worker hesap ortasında da sonlandırılabilir. Hedef sürelerin tutmadığı durumda sonuç gizlice eksik doğrulamayla hızlandırılmaz.

Ölçüm: aynı 693 kayıtlı kutunun özel ve dondurulmuş kopyası, sabit varyant/amaç/gelişim ve katalog revizyonuyla paketli uygulamada en az 5 soğuk + 5 sıcak koşu; ilk doğrulanmış sonuç, toplam süre, bellek, p50 ve p95 raporlanır. Bu küçük örneklem kapasite garantisi değildir. Cache anahtarı kutu/seviye/form/cooldown/yetenek seviyesi, arkadaş durumu, gemi/socket/CC/Support, katalog, etkinlik/bonus/HP gözlem revizyonu, amaç ve yürütücü sürümünü içerir. Yeniden tıklama veya yeni sonuç eski işi iptal eder; eski worker cevabı yeni seçimin üstüne yazamaz.

## 6. Veri alma ve ekran akışı

1. **Kaynak seç:** önce etkinlik başlığı ve Global tarih/normal-super/tip/seviye ile eşleşen internet kaydı. Kart yetenekleri mevcut sürümlü katalogdan; sezon booster listesi ayrı sezon kaydından.
2. **Eksikse fotoğraf:** etkinlik Special Effects / önerilen karakterler, giriş koşulları, boss tipi-güçlük-Lv ve bütün ilgili BEHAVIOR parçaları. Batch/paste, düzenlenebilir metin, kaynak görseli ve seviye bandı mevcut akışta tutulur.
3. **İsteğe bağlı MuMu:** sadece açık bilgi ekranları; önce kimlik, sonra ilgili panel. Küçük örtüşmeli kaydırma; yalnız eksik kısmı yeniden oku. Kayan satırın başlangıcı ve bitişi bir döngüde kanıtlanamazsa eksik kaydet; sonsuz bekleme veya çelişen sayıları tahminle birleştirme yok. Başlangıç bütçesi toplam 90 saniye, en fazla 10 sayfa ve belirsiz parça başına 2 yeniden denemedir; gerçek ekran ölçümüyle ayarlanır. Süre dolunca tamamlanan parçalar saklanır, eksik kısmın fotoğrafı istenir veya oradan devam edilir. İş iptal edilebilir; satın alma, token harcama veya savaş başlatma yok.
4. **Kontrol ekranı:** kaynaktan gelen bonuslar ve kapsamları; eksik/belirsiz olanlar; JP eşleşmesi ve farklı Lv bandı uyarısı. Kaynak metni sessizce doğrulanmış sayılmaz.
5. **Sonuç:** varyant başına ayrı kadro; hedef seviye, orijinal/kalan HP ve kayıt zamanı, çözümler, ayrı ödül türleri, hasar aralığı, cap, friend/Support/gemi gereksinimi, aşama başına işlem ve tap sırası. Her adım neden gerekli olduğunu ve başarısız olursa hangi sonraki tur davranışıyla karşılaşılacağını gösterir. Tek turda bitirme kanıtlanmadıysa sonraki tur atlanmaz. Yeni mekanik/bonus/seviye gelince önceki bağlamın sonucu tekrar kullanılmaz.

Gelişim sekmeleri korunur: Mevcut hâl, Lv.100 hedefi evrimsiz, Lv.100 hedefi + ulaşılabilir evrim. 150 varsayımı ve otomatik combined başlangıcı yok. Eksik tablet/LLB/Support/Rush/Tandem seviyesi gösterilir. Evrim önerilerinde gerekli nadir malzeme ve edinme kaynağı mevcut malzeme sistemiyle gösterilir.

İlk olarak seçili varyant + seçili gelişim hesaplanır; diğerleri istenince. Aynı kartın bağımsız renk savaşlarında kullanılamayacağı şeklinde bir GP kuralı eklenmez; gerçek etkinlik kısıtı varsa ayrıca uygulanır. “Bütün renkleri tek takımla” ancak her varyant ayrı doğrulamadan geçerse seçenek olur.

## 7. Uygulama sırası ve yayın kapıları

| Aşama | İş | Bitme kanıtı |
|---|---|---|
| A — Sınırlı gerçek etkinlik dosyası | Seçili Global sezonun tek normal varyantı ve istenen Lv için giriş/mekanik/HP/ilgili bonus kanıtını topla; bilinmeyenleri işaretle | Etkinlik/Global/varyant eşleşmesi ve seçilen hesapta gerekli alanlar kanıtlı; ilgisiz Super cap veya bütün seviye tablosu bu aşamayı bloke etmez |
| B — Bağlam ve veri girişi | Tipli UI/worker yönlendirmesi, model/saklama, büyük sayı girişi, Kizuna rehber adaptörü ve fotoğraflar | Eksik/yanlış iş genel kadroya düşmez; sezon/mod/Lv karışmaz, eski kutu açılır; yeni div/tab ve eksik başlık Battle 5'e atanmaz |
| C — Normal yürütme ve aday arama | Başlangıç kaynakları, bağlamlı yetenekler, gerçek tur/form/interrupt, hedef terminali; seçilen kartların kullandığı ileri aksiyonlar | Bir açık destek kapsamında mekanik, hasar ve hayatta kalma bağımsız örneklerle tutar; mevcut/Lv.100 senaryoları ve belirsizlik etiketleri doğru |
| D — Ayrı normal ödül hedefleri | Güvenli geçiş, bilet ve Super giriş kaynağı alternatifleri; pozisyon/friend kapsamı, istifleme/yuvarlama | Geçemeyen yüksek bonus takımı ödül önerisine çıkmaz; her para birimi kendi kanıtlı formülüyle, eksik ödül verisi geçişten ayrı |
| E — Super / SOS genişletme | İlgili cap/limit-break, ileri aksiyonlar, weakness/supertype, yüksek sayılar, katkı kaydı ve SOS terminali | Her yayımlanan varyant/Lv/aksiyon için kaynak ve bağımsız hesap izi; en az iki tipte kapsam çeşitliliği testi, fakat bu bütün sezonları doğrulamaz |
| F — Her yayın için paket ve regresyon | Süre/iptal/cache, kaynak ve eski PvE/Rumble/GP/Support/form/okuma korumaları | Kaynak paketle eşleşir, kutu değişmez; tam/odaklı test ve TypeScript/build, paketli akış + ölçülen süreler raporlanır; canlı sonuç ayrı belirtilir |

Önce A/B/C ve o sürüm için F; ödül kanıtı hazırsa D ile küçük, işe yarayan sürüm çıkar. D veya E'yi beklerken tamamen hesaplanabilen normal geçiş bloke edilmez. F yalnız en sonda yapılmaz, her paketin kapısıdır. Her yayında desteklenen mod/varyant/Lv, kart aksiyonları ve dışarıda kalan yetenekleri gösteren kapsam tablosu bulunur. Desteklenmeyen güçlü kartlar havuzdan çıkarılmışsa “en güçlü” yerine “hesaplanabilen adaylar arasında bulunan en iyi” denir.

### Bağımsız kabul örnekleri

- Aynı kartın açık “Kizuna, preliminary hariç” etkisi yalnız o kapsamda açılır; preliminary istisnası olmayan karta bu yasak otomatik aktarılmaz. Normal/Super/SOS ve normal PvE karşılaştırması her kartın literal koşuluyla yapılır; boss-Lv aralığının iki yanındaki değerler ayrı test edilir.
- Lv.30/31 geçişi, maksimum HP'ye bağlı ilerleme ve savaş içi HP yüzdesi ayrı test edilir. Lv.31 SOS'un kalan HP'si düşük diye Lv.30 davranışına dönmez; HP kaydı eskidiyse bitirme iddiası düşer.
- Sınıf dışındaki üyeye Battle 1 cooldown/switch/VS kredisi verilmez; rewind ve special-bind sonrasında hazır olma yeniden hesaplanır.
- Gösterilen 5 tur giderme, kullanılan başlangıç formunun gerçekten verdiği 5 turdur; Support hedef/kimlik ve Law + Law/Bepo çakışması korunur.
- Kayan yazı veya `3-2` etiketi seviyeyi/tetiği belirsiz bırakıyorsa yanlış turn planı üretmez; boş faz ve farklı varyant ayırt edilir.
- Stage 2'de taşınan buff ve orb gerçek kalan süre/interrupt ile Stage 3'e ulaşır; normal attack only altında special hasarı eklenmez.
- Slot bariyeri gerçek orb/adet/tap sırasıyla, timing bariyeri uygun timing ile test edilir; sırf timing bariyeri var diye gereksiz giderici aranmaz. Resilience'ı aşan bitiriş ilgili bağışıklık/NAO şartıyla doğrulanır; giderilmeden güvenle aşılan etkiler eksik giderici diye cezalandırılmaz.
- Super Type ve Weakness Class/Type çarpanı kaynakla doğrulanır; bilinmeyen katsayı güvenilir hasar hanesine eklenmez.
- Rush/Tandem/Last Tap/EX/VS için gerekli seviye, sayaç, orb ve sıra eksikken en yüksek seviye etkisi hazır sayılmaz.
- Stat boost, ödül boost'u ve yeni damage-cap etkisi iki kez uygulanmaz; rastgele Kizuna Support kapalı baseline'dan ayrı kalır.
- Çok hedefli aşamada HP'ler tek düşmana toplanmaz; hedef/atak sırası ve revive sonrası aksiyonlar korunur. 32-bit, `Number.MAX_SAFE_INTEGER` ve üstündeki tam değerlerde giriş → worker → hesap → kayıt/dışa aktarma kayıpsızlık testi yapılır; kısaltılmış HP tam sayı sayılmaz. Vuruş başı cap/yuvarlama elle hesaplanmış küçük örneklerle kıyaslanır.
- Normal'de eksik hasarlı yüksek bilet takımı geçiş önerisine çıkmaz; Super'da yeterli kısmi katkı tam zafer diye yazılmaz; SOS kalan HP kaydı eskidiyse uyarır.
- Kutu/arkadaş/form/seviye/sezon/bonus/hedef değişince cache yenilenir; mevcut 3 gelişim sekmesi ve Rumble/GP sonuçları etkilenmez.
- Eksik ödül kuralı yalnız ödül iddiasını, seçilen takıma etkisi olmayan ileri aksiyon yalnız kapsam iddiasını etkiler. Bilinmeyen giriş koşulu ise legal kadro onayını engeller. Super kısmi katkı normal tam-geçiş filtresinde elenmez; yalnız üst sınırdan oluşan hasar güvenilir katkı sayılmaz.
- Bozuk/eksik Kizuna iş türü reddedilir; genel takım çözümüne düşmez. Süre aşımı/iptal sonrası yarım hesap sonuçlaşmaz, eski iş yeni seçimi ezmez. Orijinal kutu ve eski şema açılışı değişmez; özel kutu içeriği ortak fixture'a kopyalanmaz.

Beklenen sonuçlar aynı parser veya aday projeksiyonu tekrar çağrılarak üretilmez. Kartın ham form metni ve koşulu, kaynak ekranı ve bağımsız elle hesaplanan küçük örnekler oracle olur. Gerçek savaş karşılaştırması ancak kullanıcı savaşı oynadığında veya ayrıca yetki verdiğinde toplanır; otomatik test token harcamaz. Bir fixture'ın geçmesi gerçek savaş zaferi, iki tip testi bütün kart yeteneklerinin doğrulanması değildir.

## 8. Henüz doğrulanmamış veya yapılmamış olanlar

Güncel Global etkinliğin tam booster kadrosu, yeni Damage Limit Break'in sayısal/istifleme kuralları, seçili boss'un bütün seviyelerde HP/mechanic tablosu ve gerçek savaş hasar kıyası araştırma sırasında oyundan toplanmadı. İnternette her sezon için tek ve eksiksiz Global API doğrulanamadı. Eski rehberlerdeki sabit çarpan/seviye sayıları sisteme varsayılan girilmeyecek. İlk uygulama kapsamı aşağıdadır; bütün plan tamamlanmış değildir.

## 9. Plan denetiminde düzeltilenler

21 Ekim kaynak/kod denetiminde şu açıklar giderildi:

1. SOS kalan HP, boss seviyesi, ilerleme HP eşiği ve savaş içi HP koşulları ayrıldı; düşük kalan HP eski seviye mekaniklerine döndürmüyor.
2. Preliminary için bütün Kizuna yeteneklerini kapatan yanlış genel kabul kaldırıldı; kaynakların bölge/tarih ve alan bazında kanıt sınırı netleşti. Queen bağlantı sayısı tam varyant listesi sayılmıyor.
3. Normal bitirme, Super katkı ve farklı ödüller ayrı terminal/hedeflere bağlandı; bütün debuff'ları mutlaka kaldırma yaklaşımı yerine kanıtlı etkisizleştirme/yürütme eklendi.
4. Yeni sekmenin mevcut `kind` yönlendirmesinde boss'suz genel kadroya düşme riski, gerçek aksiyon yürütücüsünün eksikliği ve büyük sayıların parser'da kaybolması uygulama bağımlılığı olarak işlendi.
5. Eksik veri için hedefe göre kapılar tanımlandı; ilgisiz Super/ödül belirsizliği ilk normal sürümü engellemiyor, gerekli ileri aksiyonlar da sonraki aşamaya ötelenmiyor.
6. Arama/okuma/iptal bütçeleri, kapsam etiketi, bağımsız test oracle'ı ve her sürümde regresyon/paket kapısı eklendi. Belirtilen süreler hedef; uygulama hızı veya savaş başarısı bu doküman değişikliğiyle doğrulanmış değildir.

## 10. İlk uygulama kapsamı · v0.5.37

Kullanıcı son hasar/bonus kontrollerinden sonra sekmeyi yapmaya başlamayı istedi. İlk uygulama normal / SOS için bir başlangıç akışıdır; A–F'nin tamamlanması değildir. Güncel Global etkinlik kaydı otomatik bulunmuş sayılmaz; kullanıcı rehberini ve kaynak kapsamını doğrular. Arayüz mevcut One Piece/HCI renk ve bileşenlerini kullanır.

| Hesap / akış | İlk sürüm kapsamı |
|---|---|
| Etkinlik ATK/HP/RCV | Kaynakla doğrulanmış kesin ID / başlangıç formu; yalnız desteklenen flat katkılardan sonra stat çarpımı sırası da kanıtlıysa eklenir. Bilinmeyen işlemde bonus hariç hesap, açık uyarı. Support'tan aktarılan statları kaynak karakterin etkinlik bonusuyla şişirmez. |
| Başlangıç CD ve Battle 1 | Kart bonusu ile aşama olayı ayrıdır. İlk hazır tur kaydı varsa başlangıç bonusu yeniden eklenmez; Battle 1 yalnız kaynakta belirtilen tip/sınıflara bir kez uygulanır. Switch / VS göstergesi henüz yürütülmez. |
| Special hasar boost'ları | Ortak PvE motorunun kapsamlı olmayan ATK, orb, affinity, base ATK, chain / savunma ve HP değerlendirmesi paylaşılır. Aynı kategori körlemesine çarpılmaz. Captain koşulları, sınıf/renk dirençleri, Super orb, Territory, Rush/Tandem/Last Tap ve tüm sıra koşulları tamamlanmış değildir. |
| Ödül | Bilet ve Super kaynak hedefi ayrı; yalnız kapsam ve çarpımlı istifleme kanıtlıysa çarpan gösterilir. Ödül tabanı/yuvarlama/maliyet olmadan kesin adet veya kaynak başına verim yok. Geçersiz kadro daha yüksek ödülle öne çıkamaz. |
| SOS / HP | Güncel kalan HP ve gözlem zamanı gerekir; seviye aralığı ve orijinal HP kaydı korunur. Büyük sayı metni kayıpsız saklanır; eski motora 10^15 üzeri HP verilmez. SOS'a özgü bütün HP koşullu kart dalları henüz modellenmez. |
| Girdi | Var olan fotoğraf / kayıtlı profil ve sınırlı online parser. Belirsiz Kizuna boss başlığı Battle 5'e çevrilmez; desteklenmeyen div/tab formatında fotoğraf gerekir. Special Effects bonuslarını otomatik OCR etme ve Kizuna canlı kaydırması sonraki iştir. |
| Sonuç ve arama | Üç gelişim, 0 varsayılan stall, ayrı event raporu, kaydetme/dışa aktarma, ilk dar arama ardından geniş arama ve 20 sn UI sonlandırma. Erken adayın savaş değerlendirmesi yapılır; tamamlanmış ilk aday varsa süre sonunda korunur. Maksimum/garanti iddiası yok. |

Son kaynak kontrolünde resmi kart tanıtımı; buff artırma/yeniden yazma, tag koşulu, Support dahil toplam cost, Rush tap sırası ve Super Switch sonrası EX gibi farklı hasar şartlarını açıkça ayırıyor. Bu, her boost'u tek genel katsayı gibi uygulamamak için ek kanıttır; o kartın etkinliğe özel bonus listesi anlamına gelmez. [Resmî kart yetenekleri](https://optc-ww.channel.or.jp/news/2319/). Resmî Nisan mektubu Super tip slotlarını da ayrı bir sistem olarak tanıtıyor; JP duyurusundan bütün Global katsayılar çıkarılmadı. [Resmî slot açıklaması](https://optc-ww.channel.or.jp/news/2025/).

Sonraki kapsam: güncel Global Special Effects kanıtlı veri dosyası / otomatik bonus girişi, yeni Kizuna online format adaptörü ve kart bazlı Kizuna-only / boss-Lv dalları; ardından gerçek aksiyon yürütücüsü, Super katkı terminali ve kanıtlı damage-cap / ileri aksiyonlar. Bunlar bitmeden bütün kutunun maksimum Kizuna hasarı doğrulanmış sayılmayacak. İlk sürümün test/paket ve canlı sınırları `HANDOFF.md` içinde kaydedilir.


## 11. v0.5.38 — görüntüden veri alma

Kullanıcı uzun elle giriş akışını reddetti. Birincil akış rehberden hedefi doldurma ve Special Effects görüntülerini okuma oldu. MuMu düğmesi yalnız mevcut ekranı yakalar; gezinmez, kaydırmaz, kaynak harcamaz. Dosya seçme / bırakma / Ctrl+V ile 1–6 PNG/JPEG/WebP alınır. Ayrı iptal edilebilir worker en fazla 90 saniye çalışır; Boss ve Rumble okuyucularının işiyle karışmaz.

Tam kart ID / katalog adı veya çerçeveli portre eşleştirmesi kullanılır. Kısa ortak ad bir kart versiyonu sayılmaz. Canlı Global Trusty Characters düzeninde açıklama ikonların üstündedir; bu başlıkta üst blok, Special Effects örnek düzeninde alt blok kullanılır. Satırlara bölünmüş açıklamalar birleştirilir. “When on the crew” ile “When owned” ayrılır; sahiplik satırları yalnız kaynak bilgisi olarak saklanır ve kadro yeri / aktif üye bonusu sayılmaz. Farklı ekran düzeninde eşleştirme görüntüyle kontrol edilmelidir. Eksik / çelişen çarpanlar aktarımı engeller. Belirsiz kartlar ad / tip / yıldızla düzeltilir; okunan metindeki sayılar yerinde düzeltilebilir. Bir kontrolle satırlar toplu uygulanır.

Okunan kartlar doğrulansa da listenin tamamı doğrulanmış sayılmaz (`bonusCoverage:partial`). Görünmeyen kartlara ilişkin kapsam / ödül iddiası yapılmaz. Koşullu ve desteklenmeyen ek etkiler kaybolmaz. Stat işlem sırası ve ödül birleşme formülü OCR’dan otomatik kanıtlanmaz; bu bilinmeyenler önceki sınırlara tabidir. Güncel Global etkinliğin internetten tam bonus ithali henüz yoktur; desteklenen çevrimiçi boss rehberi yolu korunmuştur. Super Boss yürütmesi ve cap hesabı bu değişiklikle tamamlanmış sayılmaz.

## 12. v0.5.39 — otomatik kaynak bulma ve canlı Kizuna rehberi

Birincil işlem “Kizuna’yı otomatik getir”. Uygulama E9'un Global duyuru dizininden tarihe uyan tek Vs. etkinliğini bulur; kullanıcı URL aramaz. Bonus açıklamasının kendi kart bağlantıları korunur. E9 iç kimliği doğrudan oyun No. sayılmaz; kart sayfasındaki kesin No. ile eşlenir. Normal 10★/7★ veya Super 13★ bilgi seçimi ayrıdır. Geçerli internet kaynağı bulunamazsa MuMu LIST yedeği denenir. Sahiplik satırları aktif kadro bonusuna dönüşmez.

MuMu'da Kizuna ana ekranı açıkken uygulama seçili hedefin Lv., tipi, tam HP metni ve yıldızını okur; TIPS'i basılı tutarak açar, QUEST INFO'nun yüklenmesini bekler ve BEHAVIOR'u kaydırır. Katılım koşulu, başlangıç hazırlığı, her savaşın etkileri ve açık boss-Lv. aralıkları kaynağıyla korunur. Örneğin 1–20, 21–30 ve 31+ blokları bir savaşta birlikte uygulanmaz; `3-2` tek başına ikinci tur değildir. Seçili son savaş aralığı bir sonraki açık aralıkla bittiğinde tarama durabilir; diğer seviyelerin tamamı okunmuş sayılmaz. Ekranda bulunmayan seviye / HP veya eksik kayan satır tamamlanmış gibi tahmin edilmez.

İşlem ağ/cihaz aşamalarını ve geçen süreyi gösterir, iptal edilebilir. Ağ hatası veya canlı rehber hatası diğer kaynağın başarılı sonucunu kaybetmez. Kutu verileri ağa gönderilmez ve otomatik oyun savaşı başlatılmaz. Bonus ve boss profili birlikte kaydolur; sekmeye dönünce yeni tarama gerekmez. URL, fotoğraf ve elle düzeltme araçları yedek ayrıntılardır.

Bu sürüm veri toplamayı otomatikleştirir. Kaynakta sayısal olarak doğrulanmayan hasar tavanı, stat işlem sırası, ödül istifleme, sahiplik ödül hesabı ve ileri aksiyon yürütmesi önceki kapsam sınırlarını korur; Super bilgi okuması tam Super kadro hesabı değildir. Gerçek cihaz / paket doğrulaması ve kalan OCR sınırları `HANDOFF.md`'de tutulur.
