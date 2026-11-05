# Boss / PKA / Co-Op / Kizuna okuma zinciri — derin doğruluk denetimi

## Sürüm, kapsam ve kanıt düzeyi

İncelenen checkout `v0.5.64`, commit `3f565f2`. Kaynak ve testler okundu; mevcut Graphify grafiği mimari gezinme için kullanıldı ve ilgili yollar kaynak kodla doğrulandı. App, emulator veya canlı oyun başlatılmadı. Uygulama/test kaynakları değiştirilmedi. `.local` içerikleri salt okunur incelendi; eski teslim logları güncel şikâyetin tekrarı sayılmadı. Bu checkout içinde “K lvl doğrulanamadı” metninin olası eşleşmesi Kizuna ana ekranındaki `Kizuna başlığı, HP, Lv. veya savaş sayısı tam okunamadı; hedef tahmin edilmedi.` mesajıdır (`electron/kizuna-live.cjs:9-15`); güncel canlı tekrar kanıtı bulunmadı.

Kanıt sınıfları:

- **Kaynak koduyla kanıtlı:** kontrol akışı veya veri dönüşümü doğrudan kaynakta görülüyor.
- **Fixture/mock ile yeniden üretildi:** mevcut test fixture’ı veya sentetik, gerçek fonksiyon çağrısı aynı sonucu üretti; bu canlı kullanıcı vakası değildir.
- **Testle elendi:** mevcut test ya da salt okunur probe, belirtilen karşı örneği güvenli ret/koruma ile sonuçlandırdı.
- **Sözleşme sınırı:** manuel doğrulama gibi kullanıcı kararına bırakılmış alanda makine garantisi yok; otomatik doğrulama diye sunulmamalı.

## Okuma envanteri ve üretici → tüketici matrisi

| Akış | Üretici → normalizer | Doğrulayıcı / tamlık şartı | UI ve saklama tüketicisi | Negatif kanıt / kapsam |
|---|---|---|---|---|
| Normal Boss — canlı | `src/BossSource.tsx:24-30` → IPC `electron/main.cjs:50-56` → `electron/boss-worker-service.cjs:4-23` / `electron/boss-worker.cjs` → `electron/boss-behavior.cjs` → `electron/boss-behavior-core.cjs:49-60,260-314` | Modal başlığı/zorluk/başlangıç ve scrollbar sonu okuyucuda doğrulanır; `encounterFromTokens` Battle sırası/tekrarı ve orphan satırları reddeder, yalnız tam liste başlangıç+sonu kanıtlıysa atlanan Battle’ları `notListed` ekler. Boss genel akışında beklenen toplam Battle sayısı dış hedef kaynağından gelmez. | `BossSource` tamlık ve marquee uyarısını gösterir; Planner tüketimi ayrı UI kapısındadır; manuel Boss kaydı `src/App.tsx` üzerinden `validateState` ile profile gider. | `tests/boss-behavior.test.ts:29-65,112-161`, `tests/quest-reader-regression.test.ts`, `tests/behavior-tracking.test.ts:85-96,138`. Yanlış ekran/header, geriye giden ve eksik sonu kanıtlanamayan liste testleri var. Önceki rapordaki `textComplete` tüketici açığı bu raporda yeni bulgu olarak tekrarlanmıyor. |
| Boss — fotoğraflar | `src/BossImageImport.tsx:17-27` → `electron/main.cjs:65-66` → `electron/boss-images.cjs:22-50` → ortak `encounterFromTokens` | UI kullanıcıya tüm görüntüleri elle kontrol ettirir; normal/pka başlık, zorluk veya PKA range formdan gelir. Battle/trigger etiketleri, numeric contradiction ve REQUIREMENT ayrı kontrol edilir. Sistem fotoğraf içeriğinden boss kimliğini doğrulamıyor. | Sonuç `BossSource` içine elle onay sonrası girer; App kaydı `validateState` ile clone edilir. Kaynak görseller hash adlı yerel dosyalardır. | `tests/boss-images.test.ts:7-21`: çelişen sayılar, etiketsiz parça, kısmi restriction, dosya tipi/boyut ve ters PKA aralığı test edilir. Ters Battle fotoğraf sırası aşağıdaki probeda aşama sırasına normalize edildi. Başka göreve ait iki fotoğrafı tek manuel onayda birleştirmek için otomatik kimlik testi yoktur; bu bir otomatik kaynak doğrulaması değildir. |
| PKA — ana boss | `src/PkaBossPage.tsx:35-37` → `pkaEvent` ve `pkaGuide` IPC (`electron/main.cjs:63`) → `electron/pka-guide.cjs` + ortak sayfa parserı → `src/pka.ts:16-24 pkaProblem` | Boss adı etkinlikteki boss listesiyle eşleşir; seçilen level, gözlem zamanı ve `observation.levelRange` kontrol edilir; `complete:false` ve `textComplete:false` reddedilir. Başlangıç Battle 1 olmak zorunda değil; görünür benzersiz range başlığı başlangıç kanıtı olabilir. | `PkaBossPage` yalnız doğrulama sonrası PKA worker’ına verir; sonuç PKA sekmesinin belleğinde/cache’inde tutulur, Boss profili olarak otomatik kaydedilmez. | `tests/pka-guide.test.ts:8,25-56,71+`, `tests/pka-header-continuity.test.ts`, `tests/pka-planner.test.ts`. Battle 3’ten başlayan tam aralıkta önceki aşamalar `notListed`; eksik sonu tam kabul ettirmeyen test mevcut. |
| PKA — yan boss | Aynı PKA worker, ama seçilen `level` ile yan boss/reward context’i `PkaBossPage` state’inde ayrı doğrulanır; parser PKA Quest Guide’daki seçili level bandını çıkarır. | Ana boss ile aynı `pkaProblem`: boss adı, PKA modu, range kapsamı, tamlık ve güncel etkinlik zamanı. Tek bir önceki level veya range’in komşu göreve sızmasını kabul etmemeli. | Ana PKA sayfasının aynı worker ve doğrulama akışı; sonuç sekme state/cache kapsamındadır. | `tests/pka-guide.test.ts` range fixture’ları ve `tests/pka-header-continuity.test.ts`; güncel `.local/planner-audit-v57` native yan boss logu başarılı tarihsel okumadır, bu denetimde hata kanıtı değildir. Canlı yan boss yeniden okunmadı. |
| Co-Op — MAIN | `src/CoopPage.tsx:36` → `electron/main.cjs:44-46` → `electron/coop-target-service.cjs:3-4` target/list ve güncel Quest Rules → `electron/coop-target-core.cjs:6-9` → `electron/coop-guide.cjs:4` + ortak OCR parserı | MAIN target kimliği title/category/battle-count ve açılan boss type ile bağlanır; GUIDE sonuna gidip type tekrar okunur; `prepareCoop` `id/title/type/complete/textComplete` kontrol eder. Sadece boss davranışı verilen ve hiç Battle heading’i olmayan MAIN rehberi hedefin son Battle’ına iliştirilir; mevcut herhangi bir Battle heading’i varsa korunur. | Co-Op worker gerçek seçilen encounter’ı hesaplar; `src/CoopPage.tsx:13,17,21,27` aynı cihaz/kutu anahtarıyla sekme state’inde saklar; kalıcı app profile yazımı yoktur. | `tests/coop-target.test.ts:3-9`, `tests/coop-reader.test.ts`, `tests/coop.test.ts:14`. Target ID’de category ve level farkı; locked/changed target, başka type ve eksik text reddediliyor. Boss-only guide’in Battle 1 istememesi ve target battles=4 iken açık `BATTLE 3` heading’ini değiştirmemesi açık test sözleşmesidir; hedef sayıya bakıp bütün eksik Battle’ları uydurmak doğru olmaz. |
| Co-Op — EVENT | Aynı Co-Op target/list üreticisi; event kartındaki `Vs … Lv.N` title ve seçilen event level → `core.matchesGuide` → `coop-guide` parserı | Başlıktaki actual level veya okunan `levelRange` hedef level’i kapsamalı; Co-Op encounter ID’si hedef ve event kimliğine bağlı; `prepareCoop` kapsam dışı level’ı ve incomplete text’i reddeder. | MAIN ile aynı Co-Op worker/cache tüketicisi. | `tests/coop-target.test.ts:5,8-9`, `tests/coop.test.ts:14`: lvl 60/80 vb. title/scope, okunur başlık, type ve range sınırları. Gerçek sanitized `event-guide-60.png`, `event-scrolled.png` testleri bu platformda 65/65 alt komutunda koştuysa dahi bulgudaki sayı mevcut toplam testten ayrılmaz; test dosyalarında Windows koşuluyla skip işaretli bazı pixel testleri var. |
| Kizuna — canlı hedef ve mekanik | `src/KizunaAuto.tsx:13-15` → `electron/main.cjs:71-75` → `electron/kizuna-auto-service.cjs:5-31` internet event + live worker → `electron/kizuna-live.cjs:9-15,41+` target parserı → shared Boss parser + `kizuna-levels.cjs` range seçim/doğrulaması | Ana ekran title/iki HP/Lv/Battle sayısı birlikte okunur; seçilen difficulty/title, boss identity, son Battle ve hedef Battle count kontrol edilir (`kizuna-live.cjs:114-120`). `kizuna-guide-online.readFromTarget` fallback aynı target alanlarını kıyaslar ve `complete/textComplete/stage count/last battle` ister. Kizuna auto setup doğrulaması `applyAutomaticKizuna`→`kizunaProblem`; `textComplete` açığı önceki raporda bulunmuştu. | Kizuna UI otomatik sonucu Boss’a aktarır; `src/App.tsx` Kizuna setup ve Boss’u birlikte state’e yazar; `src/model.ts:27-66` doğrular ve `structuredClone(v)` ile saklanan extension alanlarını korur. | `tests/kizuna-auto.test.ts:88-92,121-129,154-225`, `tests/kizuna-guide-online.test.ts:32-39`; eksik Lv/HP, başka target, yanlış range ve seçili range sonunun negatif testleri. Tek kare Lv recovery boşluğu önceki raporda; burada yeni bulgu değil. |
| Kizuna — fotoğraf | Boss mekaniği için `BossSource context='kizuna'` → aynı `BossImageImport` / `boss-images.assembleImages`; bonus/etkinlik kartları için ayrı `electron/kizuna-image-service.cjs` → `electron/kizuna-images.cjs` → `src/kizuna-import.ts` identity/effects → `setupFromGuide` | Boss fotoğrafı title/difficulty/level ve manual confirmation; Kizuna bonus sayfaları event/card identity, numeric bonus parsing ve `validateKizunaSetup` ile doğrulanır. Bonus görüntü okuyucusu boss Battle parserı değildir; iki veri tipi birbirine karıştırılmıyor. | `src/kizuna.ts:kizunaProblem` boss bağlamını ve seviye/range’i kontrol eder; `src/App.tsx` setup ve varsa boss’u persist eder. | `tests/kizuna-import.test.ts`, `tests/kizuna.test.ts`, `tests/boss-images.test.ts:21`. Setup import’ta kart ID/form/çarpan ve duplicate form negatifleri; PKA range fotoğraf sınır testi. Kizuna fotoğrafında title/range içeriğinin kendisi otomatik boss identity source olarak görülmemeli. |
| Kizuna — Internet | Event/bonus kaynağı: `electron/kizuna-online.cjs:31+` → exact event dates/title, card mapping, `kizuna-online.json`; mechanics: `electron/kizuna-guide-online.cjs:5-15,64-94` Koala fixed source → `build`/shared parser → live fallback. | `matchesEvent`, publication-author, dört varyant, section order, type/difficulty/level/profile ve HP kontrolü var. **Statik hızlı dönüş dalı** yalnız `mechanics.complete` kontrol ediyor; `readFromTarget` fallback ise target battles ile stage sayısını da kıyaslıyor. | `kizuna-auto-service` event/live sonucunu `KizunaAuto`/`applyAutomaticKizuna` ve `kizunaProblem`’a verir; App state’inde Kizuna/Boss saklanır. | `tests/kizuna-guide-online.test.ts:1-39,40-91` yanlış tarih/yazar/varyant/tip/range, incomplete game fallback ve target değişikliklerini test eder. Mevcut testler `target.battles` uyuşmazlığını online fast-path’te denemiyor; aşağıdaki bug. |

## Kaynak + aktif probe ile bulunan yeni kusurlar

### 1. Kizuna online mekanik kısa yolu target battle count’u doğrulamadan complete döndürüyor

**Kaynak kanıtı:** `electron/kizuna-guide-online.cjs:8-10` Koala event eşleşince `build(...)` çağırıp yalnız `result.mechanics.complete` true ise hemen dönüyor. `build` target kimliğinin bir bölümünü (title/type/difficulty/level/HP/date) doğruluyor (`:64-72`) ve statik source’dan daima üç stage kuruyor (`:74-79`); bu sırada `context.target.battles` ile üç sayısını karşılaştırmıyor. Aynı dosyanın oyun içi fallback’i target değişim kıyasına `battles` ekliyor (`:14`) ve sonuçtan stage count + son battle number istiyor (`:15`). Böylece iki yolun completeness sözleşmesi farklı.

**Salt okunur yeniden üretim:** gerçek export `readFromTarget` çağrıldı; testteki Koala article şekli ve sabitlenmiş `Date.now=2026-10-22` kullanıldı; target `battles=4`, title/type/difficulty/level/HP geçerliydi. Probe çıktısı:

```json
{"inputBattles":4,"outputStages":3,"bossComplete":true,"textComplete":true,"mechanicsComplete":true}
```

Bu **fixture-shaped synthetic target** tekrar üretimidir, canlı oyun/gerçek internet içeriği vakası değildir. Koala event `2026-10-21`–`2026-10-25` tarihindeydi ve 2026-11-01 itibarıyla kapalıdır; dolayısıyla mevcut üretim tarihinde bu spesifik statik event yolu `matchesEvent` nedeniyle erişilmez. Bulguyu kalıcı contract guard açığıyla sınırlı tutuyorum; güncel kullanıcı hatası veya bugünkü canlı etkilenme iddiası yok. `tests/kizuna-guide-online.test.ts` normal kısa yolu doğruluyor fakat battle mismatch negatifini içermiyor.

**En küçük düzeltme:** statik profil için desteklenen Battle count’u açıkça `3` olarak belirtip `context.target.battles===3` değilse online sonucu tamamlanmış sayma; live fallback’e geç veya açık kapsam hatası dön. Generic `mainValues` 0/negatif Battle tartışmasını ayrı bir bug olarak saymıyorum.

**Kabul:** sabit event profili ve `battles` değerleri 0, 2, 4 için online mekanikler `complete:true` dönmemeli; 3 için eski kısa yol geçmeli. Yanlış sayıda live fallback ancak seçilen aynı target için tüm Battle’ları ve son Battle’ı doğrularsa geçmeli. Event tarihi kapalıyken eski article statik yoldan seçilmemeli.

### 2. Shared duration parser malformed decimal değerden yanlış tur sayısı çıkarıyor

**Kaynak kanıtı:** `electron/boss-behavior-core.cjs:35-45` `durationEffects` satırın herhangi bir yerindeki `\b(\d{1,2})\s*turn` alt dizisini alıyor. Tam numeric token sınırı yok: `1.5 turns Bind` içinden `5` çıkarılıp geçerli Bind süresi yapılabiliyor. `encounterFromTokens` uyarıyı yalnız okunamayan koşul/duration için üretir (`:292+`); bu alt dizi sessiz parse edildiğinden yanlış süre ile warning de yok.

**Gerçek export probe çıktısı:**

| Girdi | Çıkan efekt |
|---|---|
| `1.5 turns Bind` | Bind 5 tur, uyarı yok |
| `-3 turns Bind` | Parser Bind 3 çıkarıyor; **tek başına signed duration kanıtı değil** — OCR bullet tire+3’ü boşluksuz birleştirmiş olabilir |
| `0 turns Bind` | efekt yok, unreadable uyarısı |
| `100 turns Bind` | efekt yok, unreadable uyarısı |
| `1,000 turns Bind` | efekt yok, unreadable uyarısı |

Bu parser ortak olduğundan canlı Boss, PKA, Co-Op, Kizuna fallback ve fotoğraf assemble’dan gelen text’i etkileyebilir. Probe kaynak/OCR zincirinin bu bozuk stringleri ne sıklıkta ürettiğini kanıtlamaz; fakat parser’ın bu tokenları gerçek OCR/metin olarak alırsa yanlış positive effect’e çevirdiğini kanıtlar.

**En küçük düzeltme:** tam numeric token segmentasyonu uygula; `1.5` içinden alt `5` değerinin duration olarak alınmasını engelle ve malformed decimal’i unreadable bırak. Tire karakterinin negatif işaret mi, OCR’ın birleşmiş bullet’ı mı olduğuna salt metinle karar verme; gerçek OCR word/crop geometri kanıtını kullan veya ilgili satırı belirsiz bırak. Mevcut `- 3 turns Bind` bullet fixture/davranışı korunmalı.

**Kabul:** `3 turns` ve gerçek `- 3 turns Bind` bullet → 3; `1.5` → Bind gereksinimi üretmesin ve okunamayan sayı uyarısı versin. `-3` için kabul sonucu OCR’ın tireyi ayrı bullet word/geometri olarak tanıyıp tanımamasına göre belirlenmeli; bunu evrensel olarak “negatif sayı” varsayıp reddetme. `1,000`, `0`, `100` için mevcut unreadable davranışı korunmalı. Aynı tablo `durationEffects` ve `assembleImages`/`encounterFromTokens` uçtan uca doğrulansın; testler tüm shared reader consumer’larını temsil etsin.

## Aktif karşı örneklerle test edilenler ve elenen/çerçevelenen hipotezler

### Stage sırası, tekrar ve trigger bağlama

Salt okunur `assembleImages` probeda fotoğraflar sırasıyla `BATTLE 3` sonra `BATTLE 1` verildi; çıktı Battle 1, 2 (`notListed`), 3 sırasına normalize oldu ve Bind/Despair efektleri kendi stage’lerinde kaldı. Aynı fotoğraftaki tekrarlı `BATTLE 1` aynı stage altında ayrı `PREEMPTIVE` ve `TURN 2` olayları yaptı; sessiz overwrite gözlenmedi. `encounterFromTokens` normal canlı listede aynı varyantsız Battle tekrarını ve geriye giden başlığı reddediyor (`electron/boss-behavior-core.cjs:268-277`); ilgili test `tests/boss-behavior.test.ts:62-65` bunu doğruluyor. Bu nedenle “duplicate Battle daima sessizce kayboluyor” hipotezi bu denetimde desteklenmedi. Fotoğraflarda aynı başlığın gruplanması kaynak birleştirme sözleşmesidir; aynı Battle’a ait olup olmadığının kullanıcı tarafından kontrol edilmesi gerekir.

Trigger bağlama ortak token parserında satırların mevcut event’e eklenmesi, yeni Battle başlığında event pointer’ının sıfırlanması yoluyla yapılır (`electron/boss-behavior-core.cjs:268-283`). Fotoğraf probeda TURN 2 efekti Battle 1’in preemptive Bind etkisine eklenmedi; aynı Battle içinde ayrı event oldu. `tests/boss-behavior.test.ts:68-71` TURN 2 ve AFTER 2 TURNS semantiğini, `tests/boss-images.test.ts:7-10` etiketsiz parçanın reddini doğrular. Normal page path’te trigger badge’in soldaki gutter içinde olması şartı da `pageTokens`’ta var (`:49-60`); floating duration’ın trigger sayılmaması mevcut testlidir. Bulgu: bu örneklerde yanlış Battle’a bağlanma repro edilmedi.

### Sayısal sınırlar, parser kaybı ve erken ret

- `0`, 100 ve binlik ayraçlı duration sessizce mekanik üretmiyor; unreadable olarak kalıyor. Kesin kusur decimal token içinden süre çıkarılmasıdır; tireli metin ayrıca bullet bağlamıyla değerlendirilir.
- `tests/kizuna-guide-online.test.ts:25-30` sıfır HP, kalan HP > maksimum HP ve gözlem zamanı eksikliğini reddeder; `electron/kizuna-guide-online.cjs:72` HP string’ini `BigInt` olarak karşılaştırır. Çok büyük HP ham string’i burada Number’a erken çevrilmiyor; yalnız `<=1e15` ise stage HP Number olarak atanıyor (`:87`).
- `legacyKizunaHP` ham HP’yi 80 basamağa kadar saklar ve mevcut motor sınırını aşınca hesaplamayı reddeder (`src/kizuna.ts:58-64`). Bu, ham değeri tahmin/round etmekten daha güvenli; sayı hassasiyet kaybı burada gözlenmedi.
- PKA normalizer `pkaProblem` tamlık, seçili range ve güncel etkinlik başlangıç zamanını kontrol ediyor (`src/pka.ts:16-24`); fixture testleri range dışını ve partial `textComplete`’i reddediyor (`tests/pka-guide.test.ts`, `tests/pka-header-continuity.test.ts`). `tests/pka-guide.test.ts:8` Battle 3’ten başlayan kaynağı eksik Battle’lara mekanik uydurmadan kabul ediyor; eksik liste sonuyla aynı tokenları reddediyor.
- Co-Op target yanlış title/category/locked/battles=0 değerlerini `validateTarget`’ta reddediyor (`electron/coop-target-core.cjs:6-8`); aynı zamanda MAIN’ın yalnız boss-only guide’inde açık heading yoksa target’ın son savaş numarasını kullanıyor (`:9`). Bu ayrım `tests/coop-target.test.ts:3-4` ile örtüşüyor.
- Kizuna `mainValues` 0 ya da negatif battle sayısını OCR regex düzeyinde kabul edebilir (`electron/kizuna-live.cjs:13-15`), ama bu denetimde bunu ayrı bulgu yapmadım: statik web branch’e erişmek için battle count parity eksikliği daha belirgin ve doğrulanmış; live Kizuna reader’ın `selectedRangeComplete`/son Battle kontrolleri de yanlış sayıyla geçişi ayrıca engelliyor (`:114-120`). İleride mainValues için pozitif integer invariant testi eklenebilir.

### Fotoğraf kimliği ve veri saklama

- Fotoğraf UI “farklı görev veya Lv. aralığının fotoğraflarını birleştirme” diye açık uyarı verir (`src/BossImageImport.tsx:30-34`) ve title/difficulty/level/range’i kullanıcı formundan alır (`:33`). `assembleImages` sayfa bazında görselden bağımsız kimlik çıkarmıyor; bu nedenle iki fotoğrafı farklı encounter’dan olduğunu otomatik anlayamaz. Sentetik iki Battle fotoğrafı, UI’ın manuel onayı verilince tek Boss Alpha profile’ında tamamlandı. Bu **otomatik kaynak kimliği garantisi değil, açık manual-review sözleşme sınırıdır**; fotoğraflar karışıkken programmatic doğrulama diye değerlendirilmemeli. Otomatik kimlik garantisi gerekiyorsa başlık içeren sayfalarda sayfa başına kimlik çıkarımı ve eşleşmeyen sayfada ret gerekir; başlıksız crop için manuel kullanıcı beyanı yine gerekecektir.
- Saklama kaybı hipotezi read-only `validateState` probe’u ile elendi: Boss `observation` içindeki `complete`, `textComplete:false`, `levelRange:[80,99]`, marquee counter’ları, `mode:'pka'`, warnings/fingerprint ile `behaviorStatus:'notListed'` ve event’leri validate sonrası byte-semantik JSON eşit kaldı. `src/model.ts:42-66` nested alanları doğrular ve tüm `v`’yi `structuredClone` eder. `Boss` TypeScript shape’i `observation`’ı ilan etmese de runtime alanı bu dönüşümde düşmüyor.
- Co-Op session verisi ise kalıcı profile yazılmaz; `CoopPage` bellekte device/box-keyed snapshot kullanır (`src/CoopPage.tsx:13,17,21,27`). Bu bir data-loss bug’ı olarak değil, app kapanışında otomatik kalıcılık beklenmediği şeklinde anlaşılmalıdır. PKA da sayfa state/cache scope’undadır.

## Çalıştırılmış kontroller

Mevcut odaklı test komutu (kaynak değiştirmeden):

```powershell
node --import tsx --test tests/boss-images.test.ts tests/boss-behavior.test.ts tests/behavior-numbers.test.ts tests/behavior-tracking.test.ts tests/pka-guide.test.ts tests/pka-header-continuity.test.ts tests/coop-target.test.ts tests/coop-reader.test.ts tests/coop.test.ts tests/kizuna-auto.test.ts tests/kizuna-guide-online.test.ts tests/kizuna-import.test.ts tests/kizuna.test.ts tests/guides.test.ts tests/gamewith-guide.test.ts tests/quest-restrictions.test.ts tests/boss-timeline.test.ts tests/boss-worker.test.ts
```

Sonuç: **228 test, 228 passed, 0 failed, 0 skipped**. Bu, mevcut kod davranışının kontrolüdür; düzeltme sonrası kabul testi değildir. Ek read-only Node probe’ları Koala mismatch, `durationEffects` malformed sayı girdileri, image assembly out-of-order/repeated Battle ve `validateState` observation round-trip için çalıştı. App, emulator, live game ve ağ isteği başlatılmadı.

## Tekrar üretilebilir read-only probe komutları

Aşağıdaki inline `node -e` komutları PowerShell’de repo kökünde çalıştırılır. Kizuna probe’u tarihini `2026-10-22`’ye sabitleyerek artık kapalı etkinliğin statik yolunu sentetik olarak açar. Sabit tarih kaldırılırsa event eşleşmez ve live fallback’e gidilir.

### Kizuna online fast-path Battle count parity

```powershell
node -e 'const g=require("./electron/kizuna-guide-online.cjs"); const event={title:"Pirate Alliance Kizuna Clash!! Vs. Koala",url:"https://e9wiki.com/optc/en/notices/14729",startsAt:"2026-10-21T03:00:00.000Z",endsAt:"2026-10-25T13:59:00.000Z"}; const c={target:{title:"Vs. Koala",level:31,difficulty:10,enemyType:"QCK",battles:4,maxHP:"15000000",remainingHP:"12000000",observedAt:"2026-10-22T00:00:00Z"},restrictions:{status:"verified",source:"fixture",text:"No requirements",quest:"Vs. Koala",difficulty:10,warnings:[]}}; const sec=n=>`<aside>${n}</aside><li>Stage 1</li><p>- CD (10), Super Switch (10) e VS (10) ridotti a Free Spirit, Cerebral, Powerhouse.</p><li>Stage 2</li><p>- NAO;</p><p>- 3 turni di Barriera da 2 DEX Slots.</p><blockquote>Dopo una certa soglia HP (Boss Lv. 31+):</blockquote><li>Stage 3</li><p>- NAO;</p><p>- 10 turni di Bind alla colonna sinistra;</p><p>- 10 turni di Paralisi;</p><p>Interrupt - quando il NAO non è attivo (ogni volta):</p><p>- Il nemico recupera tutti gli HP;</p>`; const html=`<meta property="article:author" content="OPTC NEWS | CDR"><time datetime="2026-10-17T10:51:21+0000"></time><h1>KIZUNA CLASH VS KOALA &quot;SUPERBOSS&quot;</h1><article id="_tl_editor">${["VS QCK","VS INT","VS &quot;SUPER BOSS&quot; QCK","VS &quot;SUPER BOSS&quot; INT"].map(sec).join("")}</article>`; const now=Date.now; Date.now=()=>Date.parse("2026-10-22T00:00:00Z"); g.readFromTarget({read:async()=>c},"probe","probe",{event},()=>{},async()=>html).then(r=>{console.log(JSON.stringify({inputBattles:c.target.battles,outputStages:r.boss.stages.length,bossComplete:r.boss.observation.complete,textComplete:r.boss.observation.textComplete,mechanicsComplete:r.mechanics.complete}));Date.now=now}).catch(e=>{Date.now=now;console.error(e);process.exitCode=1});'
```

Mevcut çıktı: `{"inputBattles":4,"outputStages":3,"bossComplete":true,"textComplete":true,"mechanicsComplete":true}`. Target tamamen sentetik; `2026-10-21`–`2026-10-25` etkinlik tarihleri bugün kapalıdır.

### Ortak sayı parserı + fotoğrafta Battle sırası/tekrar

```powershell
node -e 'const c=require("./electron/boss-behavior-core.cjs"),i=require("./electron/boss-images.cjs"); const numeric=["100 turns Bind","99 turns Bind","0 turns Bind","-3 turns Bind","1,000 turns Bind","1.5 turns Bind"].map(text=>({text,...c.durationEffects(text)})); const mk=text=>i.assembleImages({title:"Fixture Boss",difficulty:10,level:null,requirement:"",noRestrictions:true,confirmed:true,pages:[{hash:"a".repeat(64),text,battle:1,trigger:""}]}); const images={reverse:mk("BATTLE 3\nPREEMPTIVE\n1 turn Bind\nBATTLE 1\nPREEMPTIVE\n2 turns Despair"),repeat:mk("BATTLE 1\nPREEMPTIVE\n2 turns Bind\nBATTLE 1\nTURN 2\n3 turns Despair")}; console.log(JSON.stringify({numeric,reverse:images.reverse.stages.map(s=>({battle:s.battleNumber,status:s.behaviorStatus,requirements:s.requirements})),repeat:images.repeat.stages.map(s=>({battle:s.battleNumber,events:s.events.map(e=>({trigger:e.trigger,turn:e.battleTurn,text:e.text}))}))},null,2));'
```

Mevcut sonuç: `1.5 turns Bind` → Bind 5; bu kesin yanlış substring kabulüdür. `-3 turns Bind` → Bind 3 gözlendi, ancak OCR’ın birleşmiş bullet olasılığı yüzünden bunu negatif sayı kusuru diye yorumlamıyorum. Zero/100/binlik ayraç → unreadable, efekt yok. Reverse photo order Battle 1, notListed Battle 2, Battle 3 olur. Repeated Battle 1’de iki trigger ayrı event olarak kalır.

### `validateState` round-trip

```powershell
node --import tsx --input-type=module -e 'import {emptyState,validateState} from "./src/model.ts"; const s=emptyState(); const b={...s.bosses[0],id:"rt",stages:[{id:"b1",name:"Battle 1",turn:0,battleNumber:1,requirements:[],behaviorStatus:"notListed",events:[]}],observation:{observedAt:"2026-10-22T00:00:00Z",quest:"Vs. QA",difficulty:null,level:null,levelRange:[80,99],complete:true,textComplete:false,marquee:{tracked:5,completed:4,partial:1},pages:7,fingerprint:"f",warnings:["warning"],mode:"pka"}}; s.bosses=[b]; const out=validateState(s,new Set()); console.log(JSON.stringify({sameObservation:JSON.stringify(out.bosses[0].observation)===JSON.stringify(b.observation),observation:out.bosses[0].observation,stage:out.bosses[0].stages[0]},null,2));'
```

Mevcut sonuç: `sameObservation:true`; `textComplete:false`, `[80,99]`, marquee counters, mode/warnings ve `notListed` stage alanı korunur.

### Fotoğrafta otomatik kimlik bulunmadığını gösteren manual-boundary probe

```powershell
node -e 'const i=require("./electron/boss-images.cjs"); const r=i.assembleImages({title:"Boss Alpha",difficulty:10,level:null,requirement:"",noRestrictions:true,confirmed:true,pages:[{hash:"a".repeat(64),battle:1,trigger:"",text:"BATTLE 1\nPREEMPTIVE\n3 turns Bind"},{hash:"b".repeat(64),battle:3,trigger:"",text:"BATTLE 3\nPREEMPTIVE\n5 turns Despair"}]}); console.log(JSON.stringify({userTitle:r.name,source:r.source,pages:2,complete:r.observation.complete,stages:r.stages.map(s=>({battle:s.battleNumber,effects:s.requirements}))},null,2));'
```

Mevcut sonuç tek `Boss Alpha`, `complete:true`; ham metinde görsel kimliği yok, bu yüzden probe yalnız manual-review güven sınırını gösterir; iki farklı makine-okunmuş kimliğin eşleşmeden geçmesi anlamına gelmez.

## Öncelik sırası

1. Shared duration parser’ın numeric token segmentasyonunu düzeltip `1.5` içinden `5` süre uydurmasını engelle; tire/bullet yorumunu OCR geometri kanıtıyla ele al.
2. Kizuna statik online profilinde beklenen Battle count’u doğrula; mevcut Koala vakanın tarihi geçmiş olduğunu ve sentetik repro olduğunu regression notunda koru.
3. Fotoğraftan otomatik kimlik garantisi ürün gereksinimi ise manuel-review sözleşmesini açık bırakmak yerine sayfa kimliği kontrolü için tasarla; bu denetimde mevcut kullanıcı uyarısı nedeniyle yeni kusur ilan edilmedi.
4. Yeni reading intake/consumer eklendiğinde `complete`, `textComplete`, `levelRange`, `behaviorStatus`, event count ve stage order alanlarını round-trip + gate matrisiyle zorunlu tut. Önceki rapordaki `textComplete` tüketici açığı ayrı bulgudur ve burada yeniden sayılmadı.
