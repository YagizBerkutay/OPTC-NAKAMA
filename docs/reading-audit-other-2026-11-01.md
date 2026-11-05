# OPTC Nakama — diğer okuma akışları denetimi

**Tarih:** 2026-11-01  
**Checkout:** `C:/Users/berku/Projects/OPTC-Nakama`  
**Sürüm / commit:** `0.5.64` / `3f565f2`  
**Kapsam:** PKA, Kizuna, Rumble kuralları ve bonuslar, kutu/roster görsel tanıma, ortak OCR, tanılama ve test mimarisi. Kaynak ve test kodu değiştirilmedi; gerçek uygulama/emulator çalıştırılmadı.

## Bulgular

### 1. Okuma tamamlığı farklı akışlarda farklı kapılanıyor — doğrulanmış kusur

Boss davranış ayrıştırıcısı `complete` ile kayan metin `textComplete` alanlarını ayrı üretir. Kizuna’nın native okuma servisi eksik metni reddeder (`electron/kizuna-guide-online.cjs:13-16`), PKA bunu `src/pka.ts:20` içindeki `pkaProblem` kapısında, Co-Op ise `src/coop.ts:22` içinde reddeder. Buna karşılık genel Boss planlama kapısı yalnız `observation.complete === false` değerini kontrol eder (`src/PlannerPage.tsx:121,155`); Kizuna’nın `kizunaProblem` ve otomatik kurulum/onay yolları da `textComplete` değerini doğrulamıyor (`src/kizuna.ts:51-61`, `src/kizuna-auto.ts:35`). Bu yüzden tamamlanmış sayfa listesiyle birlikte eksik bir kayan satır, bazı Boss/Kizuna yollarında planlamaya geçebilir.

**Asgari düzeltme:** `textComplete === false` değerini Boss ve Kizuna için ortak uygunluk kapısında reddet. Alanı hiç taşımayan eski profilleri geriye dönük koru. Kabul ölçütü: `complete:true, textComplete:false` planı ve otomatik onayı durdurmalı; tam metinli ve eski alanı olmayan kayıtlar mevcut davranışı korumalı.

### 2. Kizuna internet kaynağı tek, tarihi geçmiş etkinlik profiline bağlı — doğrulanmış kapsam sınırı

`electron/kizuna-guide-online.cjs:2-16` yalnız Koala etkinliğini ve 2026-10-21–25 UTC aralığını tanır. 1 Kasım itibarıyla bu eşleşme kasıtlı olarak başarısız olur. Akış hedefi önce oyundan okur, ardından sabit kaynak eşleşmezse oyun içi genel rehbere döner; genel rehber ancak metin tamamı, savaş sayısı ve son savaş numarası eşleşirse kabul edilir. Mevcut testler bitmiş etkinliğin reddini ve eşleşmeyen/eksik kaynakta oyun rehberi fallback’ini doğrular (`tests/kizuna-guide-online.test.ts`).

**Asgari ilk adım:** Kullanıcıya sabit internet kapsamının seçili etkinliği kapsamadığını açıkça göster ve mevcut oyun içi fallback’i kullan. Etkinlik eşleşen yeni profilleri yalnız kaynak ve tarih doğrulaması hazır olduğunda ekle; kapsam dışı seviyelere başka varyantın mekaniklerini taşıma.

Handoff, daha eski gerçek 3★ QCK genel OCR denemesinde üç savaş ve liste sonunun görüldüğünü ancak Bind sayısının okunmadığını, bu yüzden kaydın reddedildiğini belirtiyor. Bu geçmiş başarısızlıktır; aynı ekranın 0.5.64’te yine başarısız olduğu bu denetimde yeniden çalıştırılmadı. Mevcut katı reddetme kapısı doğru davranıyor. Sonraki OCR iyileştirmesi, yalnız tekrarlanabilen gerçek pikseller ve bağımsız sayı doğrulamasıyla kabul edilmelidir.

### 3. Tanılama asimetrisi var; genel hata günlüğü de mevcut — sınırı doğrulanmış mimari boşluk

`electron/main.cjs:21` tüm IPC hatalarını uygulama günlüğüne yazar. Kizuna otomatik akışında `electron/main.cjs:72` ilerleme ve sonuç özeti de günlüğe girer; Rumble ve Co-Op progress olayları yalnız renderer’a iletilir (`main.cjs:42-48`). PKA rehberi ve genel Boss okuması `boss-worker-service` üzerinden özel okuyucu tanılamasını alır (`main.cjs:50,57`; `electron/boss-worker-service.cjs:10-17`): son adım, sonuç/hata, OCR kareleri ve sayfa hizalama örnekleri saklanır (`electron/diagnostics.cjs:11-35`). Rumble’ın `createAssaultService` akışı uygulama sürecinde çalışır (`electron/assault-rumble.cjs:104`); onun ve Kizuna’nın progress/result/error özetleri vardır, fakat boss’a özgü kare/alignment recorder’ı bu akışlara bağlanmamıştır. Dolayısıyla “hiç log yok” değil, aynı ayrıntı seviyesinde OCR yeniden oynatma izi yok.

**Asgari düzeltme:** Gerekirse tanılamayı ortak reader/worker’a opt-in biçimde bağla; run kimliği, son adım, hedef, `complete/textComplete` ve ilk/son kareyle sınırla. Genel IPC günlüğünün mevcut kayıt işlevini koru. Kabul: hata/iptal/sonraki iş arasında kayıt karışmamalı; profil değişmemeli; mevcut özetler çalışmalı.

### 4. Rumble NPC türü ve bazı kurallar/bonus değerleri kapsam dışında — yeni bug değil

`electron/rumble-info.cjs:15-18` düşman türlerini `[]` bırakır; mevcut okuma karakter adı, statlar, sınıflar ve detay panellerini toplar. `enemy.complete:false` kalır. Handoff’daki son Shanks okumasında INFO türleri okunmamış, ek direnç kısmen eksik ve sonuç tamamlanmamıştı. Tür veya formu koleksiyon kartından türetmek güvenli değil; bilinmeyen ile doğrulanmış boş değer kullanıcıya ayırt edilebilir olmalı.

Assault Rules akışı `electron/assault-rumble.cjs:47-48` bonusların toplanma/çarpılma biçimini ve son saniye CT/hasar artışının miktarını bilinmeyen bırakıp uyarı ekliyor. Bu, teyit edilmeyen sayıyı kullanmama davranışıdır. Tam bonus ve geç faz değerleri için kaynak metin/ekran kanıtı ve ayrı regresyon gerekir.

PKA akışı da oyun rehberinde katılım `REQUIREMENT` koşulu bulunmadığını varsaymak yerine kısıtlamayı `unverified` bırakır (`electron/pka-guide.cjs:168-170`); planlama bunu uyarı olarak taşır. Bu sınırlamayı yanlış “tam okundu”ya çevirmemek gerekir.

### 5. Kutu tanıma akışı muhafazakâr; belirgin konu ikon kapsamı

`electron/recognition-core.cjs:29-39` görsel tanımayı `confident/review/unknown` durumlarına ayırır. `src/BoxScanner.tsx:57` varsayılan olarak yalnız net eşleşmeleri seçer ve benzerlik puanının olasılık olmadığını açıklar; aday seçme ve ID ile düzeltme de vardır. İncelenen testler eşit görsellerde insan incelemesini, farklı formları, hatalı ekranı/ızgarayı ve kaydırılmış ekranları kapsar.

Handoff’ta katalogda **414 ikon şablonunun eksik** kaldığı ve son Broggy 4665 ikonunun eklenip test edildiği yazıyor. Bu mevcut yanlış eşleşme kusuru değil, veri kapsamı sınırıdır. Eşik düşürmek yerine yeni kullanıcı örnekleri ve katalog kapsama raporu eklemek uygun.

## Ortak OCR mimarisi ve test kanıtı

- `electron/rule-ocr.cjs` Windows OCR sürecini; `electron/line-ocr.cjs` Tesseract satır/blok okumayı kullanır. İkisi de aynı `ocr-cache.cjs` yaklaşımını kendi okuyucuları için uygular. Güvenilir okuma gereken sayı/etiketlerde ayrı görünüm ve uzlaşma kontrolleri vardır.
- PKA ve Kizuna ekran rehberleri ortak `behavior-page` / `boss-behavior-core` / kayan piksel birleştirme modüllerini kullanır. Kutu tanıma ise OCR’dan ayrı, ikon descriptor eşleştirmesidir.
- Bu denetimde test çalıştırıldı:  
  `npx tsx --test tests/kizuna-guide-online.test.ts tests/recognition.test.ts tests/assault-reader.test.ts tests/diagnostics.test.ts`
- Sonuç: **36 test, 35 geçti, 1 skip, 0 hata**, 54.9 saniye. Skip edilen test, yalnız yerel `.local/recognition-reported-crop.png` mevcutsa çalışan tanınmış hatalı crop fixture’ıdır. Kizuna testi eski etkinliği/fallback’i ve eksik metin reddini; tanıma testleri gerçek yerel ekran fixture’larını; Assault testi Rules okumasını ve iptali; diagnostics testi boss recorder’ı doğruladı. Bu denetim canlı MuMu okuması yapmadı.

## Graphify kaydı

- Komut: `graphify . --code-only --no-cluster --no-viz`
- Graphify sürümü: `0.9.92`; AST graph `graphify-out/graph.json`, **1,852 node**.
- Kapsam: **316 kod dosyası** AST ile işlendi. **13 doküman ve 5,342 görsel** `--code-only` nedeniyle atlandı; 7 desteklenmeyen dosya uzantısı da işlenmedi. LLM/semantik çıkarım veya clustering çalıştırılmadı.
- Graphify çıktısı repoda `git status` altında `?? graphify-out/` olarak görünüyor; gitignore tarafından yok sayılmıyor. Bu yerel mimari grafıdır, uygulama kaynağı değildir. Serena sembol arama aracı bu oturumda bulunmadığından Graphify sorguları kaynak koduyla doğrulandı.

## Sınırlar

İnternet kaynağı ve tarih kapsamı için harici güncel kaynak doğrulaması yapılmadı. Canlı oyun/emulator kullanılmadı. Bilinen Rumble/bonus ve ikon eksikleri kusur olarak sınıflandırılmadı; bu alanlarda ancak yeni kaynak kanıtı ve fixture ile kapsam genişletilmelidir.
