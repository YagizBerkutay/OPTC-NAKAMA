# Ortak OCR ve piksel hattı — derin denetim (2026-11-01)

## Kapsam ve yöntem

Uygulama ve emulator çalıştırılmadı. `electron/` OCR/capture/pixel okuyucuları, ilgili testler ve mevcut Graphify AST ilişkileri incelendi; kaynak ve test dosyaları değiştirilmedi. Graphify `graphify-out/graph.json` (1,852 node) üzerinden ortak OCR, marquee, scrollbar ve scroll-anchor ilişkileri sorgulandı; sonuçlar kaynakla karşılaştırıldı. Geçici fault-injection dosyaları `.local/` altında tutuldu.

İncelenen bileşenler: `adb.cjs`; `windows-ocr-client.cjs` ve `windows-ocr.ps1`; `rule-ocr.cjs`, `rule-glyph.cjs`, `ocr-cache.cjs`; `line-ocr.cjs` (PSM 7 line, PSM 6 block); `behavior-page.cjs`, `marquee-row-ocr.cjs`; `marquee-panorama.cjs`, `behavior-tracking.cjs`, `quest-scroll-anchor.cjs`, `scrollbar.cjs`; `behavior-effect-ocr.cjs`, `starting-state-ocr.cjs`, `requirement-pixels.cjs`, `requirement-marquee.cjs`, `quest-restrictions.cjs`.

## Yeni bulgular

### 1. Tesseract timeout sonrası eski worker kapanırken yenisi başlayabiliyor — deferred mock ile yeniden üretildi

- `electron/line-ocr.cjs:10` `close()` eski worker için `terminate()` çağırıyor ve promise’ı döndürüyor. Timeout callback’i `:19` bu `close()` çağrısını await etmiyor; `Promise.race` reject olup `:22–23` sıradaki işi serbest bırakınca `start()` yeni worker kurabiliyor.
- Probe `.local/tesseract-restart-probe.cjs` eski worker’ın `terminate()` promise’ını bilerek askıda tuttu: timeout reject oldu, eski terminate başlamıştı, yeni factory ikinci worker’ı başlattı; yeni okuma başarılı oldu. Bu kaynak sırasının doğrulanmasıdır; gerçek Tesseract terminate süresi veya gerçek bellek sızıntısı ölçülmedi.
- Etki sınırı: yalnız timeout/close sırasında geçici iki worker yaşam süresi örtüşebilir. **Leak/OOM kanıtı yok.** Yeni bir mekanik okuma yanlışı gösterilmedi.
- En küçük iyileştirme: kapatılan worker’ın retire promise’ını sahiplik bazında saklayıp yeni worker başlamadan önce beklemek. Sonsuza dek çözülmeyen terminate promise’ı tüm sonraki okumaları kalıcı kilitlememeli; retire beklemesine de deadline/error recovery verilmeli. Kabul: deferred terminate testinde aynı client eski worker’ın kapanma sonucunu yönettiği sırada kontrolsüz ikinci worker başlatmaz; terminate hiç çözülmezse sonraki iş belirlenmiş hata yolundan çıkar; iptal ve sonraki temiz restart çalışır.

### 2. REQUIREMENT toplama tam ekran görüntülerini 30 saniye boyunca bellekte tutuyor — gerçek arşivle miktarı ölçüldü, OOM görülmedi

- `electron/quest-restrictions.cjs:104–108` 30 saniyelik basılı tutma esnasında her screenshot’ı tüm ekran PNG `Buffer`’ı olarak `images` listesine ekliyor. `electron/requirement-pixels.cjs:2–6` ancak hold bitince listeden dar şerit crop’ları oluşturuyor; ham ekranlar fonksiyon sürerken hâlâ referanslı.
- Mevcut `.local/cp9-requirement-0529-final/` tanılama yakalaması 19 adet 900×1600 RGBA ekran görüntüsü içeriyor: toplam **38,620,397 byte**, ortalama **2,032,652 byte/kare**. Bu capture seti gerçek sonucun tanı verisidir; test fixture sayılmaz. Bu, tek okuma sırasında en az bu kadar sıkıştırılmış ekran verisinin tutulabildiğini kanıtlar. RSS/peak heap ve canlı uygulama bellek etkisi ölçülmedi.
- Bu bir kaynak tutma/memory budget riski, doğrulanmış OOM değil. Eski karara göre kare sayısına sabit limit koymuyorum. En küçük iyileştirme: capture sırasında yalnız REQUIREMENT ROI’sini/crop’u saklayıp tam frame buffer’ını bırakmak; akış döngüsünün 30s hold koşulu ve her örneğin mevcut numerik/piksel doğrulaması korunmalı. Kabul: aynı recorded 19-frame cycle aynı doğrulama sonucunu verir ve saklanan byte toplamı tam ekran PNG toplamından belirgin düşük olur; cap eklenmez.

### 3. WinRT iç timeout’u devam eden native işlemi iptal etmiyor — kaynak riskidir, runtime reproduction yok

- `electron/windows-ocr.ps1:15–18` `AsTask()` sonucunda `Wait(20000)` kullanıyor. `false` durumunda exception atıyor; orijinal WinRT operation üzerinde `Cancel()` çağrısı yok. `Read-OCRImage` `:28–36` bu exception’da bitmap ve stream’i dispose ediyor, server `:38–45` hatalı cevabı yazıp aynı process/engine ile sonraki isteğe geçiyor.
- Kaynaktan çıkan risk: 20s’de tamamlanmamış `RecognizeAsync` arka planda sürüyorsa bitmap dispose sonrası tamamlanması ve aynı engine ile yeni işin başlaması mümkün. Bu interleaving canlıda/Windows fault-injection’da test edilmedi; yanlış okuma, kaynak sızıntısı veya OOM olarak sunulmuyor.
- Minimum iyileştirme eğer timeout gerçek testte doğrulanırsa: WinRT operation’ın cancellation API’sini kullanıp bitiş/cancel sonrası dispose etmek; operation iptal edilemiyorsa bu process’i sağlıksız sayıp sonlandırmak ve yeni process’te devam etmek. Kabul: timeout’tan sonra eski operation yeni OCR işiyle çakışmaz; queued çağrılar tanımlı ret/restart semantiğine uyar; aynı engine sessizce bozuk durumda kullanılmaz.

## Invariant matrisi

| Alan | Sonuç | Kanıt ve sınır |
|---|---|---|
| OCR cache başarısız iş | Doğrulandı | `tests/ocr-cache.test.ts` “failed OCR retries normally…” ilk rejection’ın cache’te kalmadığını ve yeni okumanın tekrar denendiğini kanıtlıyor. |
| Cache identity ve mutasyon | Doğrulandı | `tests/ocr-cache.test.ts` aynı image+options işini coalesce ediyor, pixel/scale/crop değişince ayrı okuma yapıyor, caller mutation’ını cache’ten izole ediyor. Key yalnız hash(image)+scale+crop (`ocr-cache.cjs:4–9`). Page / line / block cache’leri ayrı wrapper/closure’larda; mode birbirine karışmıyor (`rule-ocr.cjs:19`, `line-ocr.cjs:27–28`). Crop property-order varyasyonu ayrıca test edilmedi. |
| Cache eviction | Kısmen doğrulandı | 1-entry LRU eviction testi var; production 16 entry / 8 MiB limitini ve bu byte eşiğinin davranışını gerçek OCR result boyutlarıyla ölçen test yok (`ocr-cache.cjs:2,8`). |
| Windows OCR aynı process’te concurrency | Doğrulandı | `tests/windows-ocr-client.test.ts` bir client process’ine iki isteği yazıp cevapları ters sırada veriyor; id eşleşmeleri korunuyor. UTF-8 parçalı reply testi geçiyor. |
| Malformed response/process exit | Doğrulandı ama çoklu pending kapsamı sınırlı | Test bozuk JSON ve beklenmedik exit’i tek pending işte reddediyor. Kaynak `stop()` mevcut bütün `pending` işlerini reject ediyor (`windows-ocr-client.cjs:5,17`); malformed cevaptan sonra birden fazla pending için ayrı test yok. |
| Timeout sonrası eski Windows process cevabı | Doğrulandı | `.local/ocr-client-fault-probe.cjs`: ilk child timeout ile kill edildi, ikinci process açıldı; eski child’dan geç reply ikinci işi çözmedi, yeni child’ın cevabı kabul edildi. Worker identity guard `windows-ocr-client.cjs:11,14` bunu sağlıyor. |
| Worker restart / queue (Tesseract) | Çoğunlukla doğrulandı | `tests/line-ocr.test.ts` serialized queue, active+queued close rejection, timeout/error/idle sonrası clean worker ve in-flight initialization cleanup testlerini geçiriyor. Deferred probe, timeout sonrası asynchronous terminate tamamlanmadan restart’ın başlayabildiğini ayrıca kanıtladı (bulgu 1). |
| Scale ve crop koordinatları | Probe ile doğrulandı | `.local/ocr-coordinate-probe.cjs` gerçek WinRT OCR’da `scale=2`, origin crop kullanarak aynı “Lv.10” kutusunu tam crop offset’iyle geri verdi: x/y delta **0 px**. `line-ocr.test.ts` scale2 bbox dönüşümünü ayrıca sınar. Odd-width fractional-scale rounding için ayrı sınır testi yok; teorik fark subpixel düzeyinde. |
| Alpha/background | Gerçek fixture’da güvenli; transparent giriş kontratı test edilmedi | Dört gerçek oyun fixture’ı RGBA, alpha min=max=255. Transparent PNG probe `ocrBuffer` ile görünmez metin döndürmedi. Ancak `readStrip()` `removeAlpha()` sonrası RGB eşiklediğinden tamamen alpha=0/white RGB sentetik girişte 2,400/2,400 pikseli foreground saydı. ADB `screencap -p` kaynak görüntüsünün alpha’sı 255 olmalı; canlı MuMu bu denetimde çalıştırılmadı. Transparent input production kusuru olarak kanıtlanmadı; capture boundary’de opaque assertion/flatten daha net bir invariant olur. |
| Panorama genişliği/memory bound | Doğrulandı | `marquee-panorama.cjs:89` 4,096 px panorama limitini aşınca incomplete error veriyor; crop yüksekliği gövde/row’dan sınırlandırılıyor; OCR sheet 3 kanallı siyah arka planla kurulur (`:125–129`). Gerçek cycle fixture testleri tamamlandı. Çok sayıda maksimum genişlik satır için peak RSS ölçülmedi. |
| Numeric confidence/fallback | Doğrulandı | Düşük confidence numeric word ve çatışan sayılar reddediliyor; 4/40 open-top gerçek fixture ve percentage fallback regresyonları hedefli testlerde geçti. Kod sayısal uyuşmazlığı `complete` yapmıyor. |
| Capture / OCR sınırları | Koddan doğrulandı | ADB PNG için header check ve maxBuffer **16 MiB**, `timeout=15s` (`adb.cjs:27`); full-image WinRT OCR kaynağı max **4096×4096** (`rule-ocr.cjs:7–10`); Windows client request timeout **30s** (`windows-ocr-client.cjs:3,23`), PowerShell WinRT await **20s** (`windows-ocr.ps1:15–18`), Tesseract per-read **30s** (`line-ocr.cjs:7,19`). Sınırlar gerçek emulator/live frame’e uygulanarak ölçülmedi. |
| Scroll-anchor tekrarlı metin | Sentetik stres ölçümü; bug sayılmadı | `.local/scroll-anchor-stress.cjs`: tamamen siyah görüntü ve 10/20/30 yinelenen satırla fallback 0.373/1.235/2.754s; RSS delta +26.6/−12.2/+57.5 MB (GC nedeniyle oynak); sonuç her defasında null/reject-safe. Kodda shift×row×pixel taraması ve candidate başına buffer var (`quest-scroll-anchor.cjs:36–49`). Bu synthetic worst case; gerçek ekran baseline’ı yok ve bir production performance bug olarak yükseltilmiyor. Mevcut recorded fallback regresyonu yaklaşık 258ms test süresinde geçti. |

## Graf ve test kapsamı

Graf sorgusu ortak `createOCRClient`, `rule-ocr`, `line-ocr`, `ocr-cache`, `createPixelMarquee`, `horizontalShift`, `stationaryTextScrollEvidence`, `scrollbar` ve çağıran Boss/Kizuna/PKA test bağlarını gösterdi; graph kaynak kodundaki güncel davranışın yerine kullanılmadı.

Geniş hedefli komut:

```text
npx tsx --test tests/windows-ocr-client.test.ts tests/line-ocr.test.ts tests/ocr-cache.test.ts tests/marquee-panorama.test.ts tests/scroll-alignment.test.ts tests/quest-scroll-anchor.test.ts tests/behavior-tracking.test.ts tests/behavior-effect-ocr.test.ts tests/requirement-marquee.test.ts tests/requirement-pixels.test.ts tests/preemptive-ocr.test.ts tests/starting-state-ocr.test.ts tests/rule-glyph.test.ts
```

Sonuç: **104 test, 104 geçti, 0 başarısız, 0 atlandı; 29.4535 saniye.** Native Windows OCR fixture testleri de bu Windows makinede geçti. Tam repo suite/build çalıştırılmadı.

Ek `.local` probes:

- `node .local/ocr-client-fault-probe.cjs` — stale old-process reply yeni read’e sızmadı.
- `node .local/ocr-coordinate-probe.cjs` — crop+scale OCR origin dönüşüm farkı 0 px.
- `node .local/ocr-alpha-probe.cjs` — alpha=0 görünmez text WinRT OCR’da boş çıktı.
- `node .local/tesseract-restart-probe.cjs` — timeout sonrası eski terminate promise bitmeden yeni worker başladı; temiz yeniden okuma başarılı.
- `node .local/scroll-anchor-stress.cjs` — yalnız sentetik ölçüm, bug kabul edilmedi.
- Önceki aynı-image probe `node .local/marquee-read-audit-probe.cjs` — production cache wrapper’ıyla aynı fingerprint ikinci denemede backend OCR 0/0.

## Plan için öneri

1. En küçük somut kaynak iyileştirme adayı: Tesseract retire/terminate ömrünü yeni worker’a bağlamak; sınırsız gecikmede kalıcı kilitlenme oluşturmayan hata yoluyla.
2. REQUIREMENT hold’unda full frame’leri tutmak yerine aynı piksel/validasyon semantiğiyle dar ROI saklama seçeneğini gerçek recorded cycle ve peak-RSS ölçerek değerlendirmek. Sabit frame cap önerilmiyor.
3. WinRT 20s operation timeout, yalnız gerçek fault injection ile orphan operation/engine overlap doğrulanırsa düzeltilmeli. Bu rapor runtime bug iddiası yapmıyor.
4. Alpha=255 capture invarianti ADB sınırında doğrulanabilir; alpha’sız/transparent fixture’larda threshold algoritmasını üretim hatası olarak görmedim.

Önceki denetimdeki in-flight user cancel bulgusu burada yeniden açılmadı. Handoff’taki son canlı boss tekrarının yapılmamış olması bug değil, doğrulama boşluğu olarak kaldı. Uygulama/test kodu, Graphify grafı ve emulator değiştirilmedi.

## Çapraz inceleme: PKA/Assault waiter yarışı, dosya truncation ve progress kimliği

Bağımsız integration raporundaki üç iddiayı kaynakla kontrol ettim. PKA iptal sonrası iki waiter yarışı `.local/audit-pka-cancel-restart.cjs` ile **3 capture, en yüksek 2 eşzamanlı capture** olarak gözlendi; Assault’ta aynı okuma-only gate probe’u da **3/2** verdi (`electron/pka-rumble.cjs:39–43,69`; `electron/assault-rumble.cjs:13–16,75`). Böylece service invariant kusuru runtime/mock düzeyinde doğrulandı; normal testler hâlâ **15/15 geçti** (`npx tsx --test tests/pka-rumble.test.ts tests/assault-reader.test.ts`, 3.235s), fakat iki waiter senaryosunu kapsamaz. En küçük fix senkron tek reservation/queue veya ikinci waiter reject’idir; regression aynı anda yalnız bir yeni capture/input’a izin vermeli, eski işin `finally`’si yeni token’ı silmemeli. `src/PkaRumblePage.tsx:18,32–36` ve `AssaultRumblePage.tsx:16,39–45` cancel sonrası busy/reading’i hemen bırakabildiği için kullanıcı hızlı retry ile yolu açabilir; UI generation guards sonuçları korur ama service I/O örtüşmesini önlemez.

100 dosya limiti kesindir: `src/BoxScanner.tsx:47` seçimi `slice(0,100)` ile kırpıyor, tamamlanınca bütün görseller taranmış gibi genel metin veriyor. `:56` bu metni `role="status"` olarak erişilebilir biçimde duyurur; dolayısıyla bu erişilebilirlik eksikliği değil, 101+ seçimde atlanan dosya sayısının kullanıcıya açıklanmaması/yanlış tamamlanma bilgisi. Kaynak doğrulandı, 101 dosyalı renderer probe’u yok. Minimal düzeltme toplam seçim sayısını ve kalan dosyayı bildirmek veya seçim başında limiti reddetmek; kabulde hiçbir batch tam seçim işlendi dememeli.

Progress kimliksizliği kaynakta doğrulandı (`electron/main.cjs:47,59`; `electron/preload.cjs:5,16`; `src/PkaRumblePage.tsx:21`; `src/AssaultRumblePage.tsx:18`): main/preload yalnız string geçiriyor, renderer sadece `reading.current` kontrol ediyor. Eski queued IPC progress’in yeni read sırasında teslimi runtime’da/probe’da **üretilmedi**; bu yalnız progress metnini geçici olarak yanlış gösterebilir, worker/result generation guards ayrı duruyor. Her iki sayfada progress `role="status"` olduğundan metin screen reader’a da sunulur; stale durum varsa yanlış metin erişilebilir biçimde duyurulur. Minimal düzeltme ancak reproduction/ürün gereği varsa run ID’yi invoke/progress boyunca taşımak ve renderer’da eşleşmeyeni atmak; regresyon testinde A’nın gecikmiş progress’i B’nin durumunu değiştirmemeli.

## Çapraz inceleme: duration token sınırı ve Kizuna battle parity

Doğruluk raporundaki duration probe’u kaynaktan tekrar çalıştırdım (`electron/boss-behavior-core.cjs:42`): `1.5 turns Bind` yanlışlıkla Bind 5 üretir; decimal noktasından sonra eşleşen `5` tam süre token’ı değildir. `-3 turns Bind` → 3 ve `- 3 turns Bind` → 3 çıktıları doğrulandı; ilk biçim eksi süre kanıtı sayılmaz, çünkü `-` sıkışmış bullet OCR’ı olabilir. En küçük düzeltmenin kabul koşulu `1.5`’i mekanik olarak kabul etmeyip unreadable’a alması ve varsa gerçek OCR fixture’ında `-3`/`- 3` bullet biçimlerini bozmamasıdır; işaret sınırı tek başına `-3`’ü reddetmek için yeterli değil.

Kizuna sentetik HTML probe’u tekrar çalıştı: target `battles:4` iken statik Koala online profile 3 stage ve complete/textComplete/mechanicsComplete=true döndürdü. Akış farkı kaynakta da var: statik profile dönüşü `electron/kizuna-guide-online.cjs:8-9` mekanik tamamlılığını yeterli sayıyor; oyun içi fallback ise `:14-15` target battle sayısı ve son Battle numarasını karşılaştırıyor. Bu Koala olayı 2026-10-25’te bittiği için bugün çalışabilir bug değil; statik profil sözleşmesi için latent doğrulama boşluğu. Kabul/regresyon, uygun aktif profil fixture’ında target-stage uyumsuzluğunun sessizce complete olmamasını ve bugün canlı etkinlik iddiası yapılmamasını kapsamalı.
