# Bütün okuma sisteminin güvenilirlik planı — 2026-11-01

Durum (2026-11-02): v0.5.68 root tarafından düzeltildi, paketlendi ve açıldı. Bu tur MuMu açıktı; canlı Rumble okuması ve son kaynak revizyonuyla 12 sayfalık PKA okuması tamamlandı. Önceki v65–67 kayıtları kanıt geçmişi olarak korunur.

## Follow-up — v0.5.68 gerçek hata kurtarma

- Aktif Block C'nin gerçek görüntüsü 2x okumada `HP U` / kapanmamış `[Giant` ile bildirilen sayısal hatayı üretiyor; 3x tam metni okuyor. Tam bölüm parse hatası artık aynı karede alternatif ölçeklerle deneniyor. Sayısal doğrulama ve bölüm kimliği korunuyor; gerçek parse girdisi kayda giriyor. PREVIOUS RANKING yükleme geçişi hemen yanlış ekran sayılmıyor.
- Canlı PKA'da üstten kırpılan aralığın merkezinden türetilmiş sayı crop'u rakamları kesiyordu. Kalan bandın tamamı okunuyor; dash pikselleri ve native/Tesseract sayı eşleşmesi zorunlu. Soluk 4 turluk Blow Away için ikinci düzen doğrulaması netleştirilmiş aynı görüntüde de çalışıyor. Eşik düşürme veya tahmin yok.
- Önceki üç canlı denemede yakalanan hatalar sonrası final kaynak okuması: Vs. Mr. Ya 100–149, 12 sayfa, 5 aşama, 27/27 kayan satır, textComplete:true. Koşullu Battle 4 ATK Down metni notlarda var; mekanik yorumu hâlâ uyarılı. Diğer modlar bu tur canlı doğrulanmadı.
- 621 test geçti / 1 mevcut skip / 0 hata; odaklı 95/95, build, ASAR native 4/4 yeni + 8/8 mevcut, paket UI ve kaynak/paket byte kontrolü geçti. Gerçek profil 843 kart / 10 boss değişmedi. V68 çalışıyor, masaüstü kısayolu güncel. Ayrıntılar `docs/HANDOFF.md` ve `.local/reading-repair-v68/` içinde; alt agent kullanılmadı.

## Follow-up — v0.5.67 PKA settle and failure evidence

- Real v0.5.66 runs `4b7cc587-f932-416d-99b3-f30c97196a02` and `02b6251a-a330-40eb-b69a-daf7f139f302` failed during PKA guide reading. Their per-run frame/OCR evidence and source/copy hashes are preserved in `.local/reading-implementation-final/regression-v66-20261101-report.md` and its run folders. MuMu had no attached ADB device; no live retry was performed.
- v0.5.67 now requires verified zero pixel shift for PKA settle; a stable scrollbar reading only corroborates the decision, and exact expanded range remains the first-page proof. A run-scoped failed-pair recorder preserves both images plus nullable measured/scrollbar/header/range metadata, or omits both images when either is missing/over 8 MiB. In the saved 457 px fixture, the scrollbar estimate is unavailable (`null`) while independent alignment reports a 457 px shift, so the page is rejected as settled; this is not a replay of the latest full live run.
- Verification: bounded full suite 617 total (616 passed, 1 skipped, 0 failed); focused PKA/marquee 63/63; build passed; native package QA 8/8; content check 5,346 source-aligned files / 78,661,986 bytes, six public data files, 168 unpacked files, zero forbidden private paths; isolated-profile UI gates passed with no renderer errors. Real profile payload and SQLite/WAL/SHM hashes are unchanged. No real fight input or live scan was performed.
- The v0.5.67 real-profile app launch is PID 28660 (`.local/reading-implementation-final/v67-visible-state.json`); the desktop shortcut and backup are in `.local/reading-implementation-final/shortcut-v67.json`. No foreground claim is made because Windows denied the single foreground attempt. Full local delivery evidence: `.local/reading-implementation-final/delivery-v67.md`.

## Uygulama ve teslim sonucu — v0.5.65

| İş | Teslim edilen davranış | Kanıt |
| --- | --- | --- |
| D1 | Boss planı ve Kizuna doğrulama/auto-confirm açık textComplete:false değerini reddeder; eski eksik alan uyumluluğu korunur. | Regresyonlar ve final paket UI: kısmi Boss 0 worker, tam Boss 1 worker, kısmi Kizuna 0 worker. |
| D2 | Süre regex'i 1.5 içinden 5, harf/fraction içinden alt sayı seçmez; geçerli bullet biçimi korunur. | Negatif sayı-token tablosu, ortak parser/consumer testleri, ASAR parser kontrolü. |
| D3 | PKA/Assault iptal sonrası tek restart rezervasyonu atomiktir; ikinci bekleyen iş reddedilir. | İki okuyucuda kırmızı/yeşil ve iki-waiter regresyonu. |
| D4 | Aynı cihazın ekran bağımlı reader/scroll dizisi tek sahipli; farklı cihaz ve salt screenshot serbest. Native worker cancel güvenli unwind bekler. | Gerçek IPC kayıt helper/gate testleri, worker cancel/drain testleri. Undrained cihaz güvenli kabul edilmez. |
| D5 | Geçici Kizuna alanı ve Quest Guide başlığı yeniden okunur; yanlış hedef/sayı çelişkisi reddedilir. Bilinçli yıldız değişiminde yeni varyant değerleri alınır. | Eksik Lv./HP/başlık ve yanlış ekran testleri; 10★ 15m → 7★ 8m regresyonu. |
| D6 | Per-read signal page/line/block/cache/panorama/PKA/REQUIREMENT/Kizuna OCR yollarına taşınır. Bir coalesced waiter iptali diğerini bozmaz; geç sonuç ve temp cleanup doğru işe aittir. | Deferred OCR, native client/retired process ve temp dosya lifecycle testleri. |
| D7 | 100/N dosya işlendiği ve kalan sayı açık gösterilir; sınır korunur. | Final paket UI: 101 seçildi, 100 recognize çağrısı ve 1 kaldı mesajı. |
| D8 | Statik online Kizuna profilinin aşama sayısı hedef Battle sayısıyla eşleşmelidir; aksi halde fallback. | Koala sentetik tarihli parity testi; bugünkü kapalı etkinlik için yeni kaynak iddiası yok. |
| D9 | Tesseract eski worker kapanmadan yenisini açmaz; retirement timeout açık hata verir, gerçek kapanış sonrası reuse çalışır. | Deferred terminate/reuse testleri ve native paket Tesseract testi. |
| Tanılama | Boss/Kizuna/Rumble/Assault/PKA kareleri run dizinlerine ayrıldı; tamamlanan son 8 okuma tutulur, aktif okumalar korunur. Atlanan büyük PNG eski kareyle eşleştirilmez; polling run kotasını tüketmez. | Retention/üç-kare/constructor failure testleri; paket content kontrolü. |
| ROI | REQUIREMENT hold yalnız aynı caption crop'unu ve kaynak geometrisini saklar; önce/sonra kimlik kontrolü korunur. | 19 arşiv PNG'sinde 38.620.397 → 739.924 byte (%98,08 azalma). Ayrı 26-kare tam cycle source ve ASAR full/ROI doğrulaması aynı caption+QCK/PSY üretti. Bu RSS/OOM veya süre iddiası değil. |

Son doğrulama: tam 606 test, 605 pass, 1 mevcut yerel recognition crop eksikliği skip, 0 fail. TypeScript/Vite build ve 65 CJS syntax kontrolü geçti. Son ASAR'da 5346 dist/electron dosyası, 78.654.130 byte kaynakla birebir; 6 public data kaynağı ve 168 unpacked dosyası kontrol edildi, 0 özel profil/SQLite/testgörseli yolu. Altı native paket kontrolü gerçek Windows OCR/Tesseract/Sharp/asset ve REQUIREMENT eşdeğerliğiyle geçti. Paket UI izole OPTC_TEST_PROFILE kullandı, ADB/reader sınırları mocklandı, renderer hatası 0 ve gerçek DB dosya hash'i değişmedi.

Paket: C:/Users/berku/Projects/OPTC-Nakama/release/v0.5.65/win-unpacked/OPTC Nakama.exe. Masaüstü kısayolu bu pakete yöneltildi; önceki kısayol .local/reading-implementation-final altında yedekli. Açık gerçek v0.5.64 penceresi kapatılmadı; yeni sürüm için eski pencereyi kapatıp kısayolu yeniden açmak gerekir.

Kalan sınırlar: canlı MuMu boss okuması yapılmadı. REQUIREMENT mevcut 30 s basılı tutma / 35 s ADB timeout'u sırasında iptal bu girdinin bitmesini bekleyebilir; Boss/Co-Op cancel drain 40 s, Kizuna 30 s. Bunlar toplam okuma/sayfa/frame cap'i değildir. WinRT internal timeout/scroll worst-case/transparent giriş gibi kanıtlanmamış riskler ve bilinen katalog/NPC/etkinlik kapsamı bu teslimde yeni garantiye çevrilmedi.

Kesin komut ve çıktılar .local/reading-implementation-final altında: tests.tap.log, build.log, package.log, ui-packaged.log, native-package-verified-stdout.log, content-verification.json, shortcut.json. Önceki başarısız native probe varsayımları ayrı loglarda korundu; final sonuçlarına eklenmedi. Plan öncesi inceleme kanıtları aşağıdadır.
## Amaç ve yaklaşım

İlk tur bildirilen boss/Lv./kayan yazı sorunlarına yakındı. Kullanıcının düzeltmesi üzerine ikinci tur bütün okuma zincirini, bu şikâyetlerden bağımsız yanlış kabul, eksik işlem, kaynak yaşam döngüsü, eşzamanlılık, veri saklama ve performans açısından taradı. Üç GPT-6 Luna ajanı inceleme ve güvenli test/probe yaptı; ana ajan yalnız kapsamı yönetti, kanıtları değerlendirdi ve bu planı hazırladı.

Checkout C:/Users/berku/Projects/OPTC-Nakama, sürüm 0.5.64, commit 3f565f2. D:/optc app bu hostta yok; aktif yol mevcut handoff ile doğrulandı. Başlangıç çalışma ağacı temizdi. İnceleme aşamasında app/emulator başlatılmadı; canlı oyun girdisi, kullanıcı profili, kaynak/test dosyası, sürüm/paket/dağıtım değişmedi. Sonraki uygulama aşamasının değişiklik ve doğrulaması yukarıdaki teslim tablosundadır.

Ana karar: önce yanlış veya eksik verinin doğru kabul edildiği kapıları ve cihaz girdisi üreten işlerin sahipliğini düzelt; ardından geçici okuma hatalarından kurtarma, tanılama ve ölçülmüş kaynak maliyetleri. OCR motorunu değiştirmek veya bütün okuyucuları yeniden yazmak için kanıt yok.

## Kanıt düzeyleri

- Tekrar üretildi: gerçek production fonksiyonu fixture/mock/sentetik girdiyle belirtilen sonucu verdi; canlı kullanıcı vakası demek değildir.
- Kaynakta doğrulandı: erişilebilir kontrol/veri yolu gösterildi; UI veya canlı tekrar ayrıca belirtilir.
- Ölçüm/risk: kaynak maliyeti veya güvence eksikliği var; yanlış sonuç/çökme yeniden üretilmedi.
- Elendi: belirli karşı örneği mevcut test/probe güvenle reddetti. Bütün olasılıkların güvenli olduğu iddia edilmez.
- Kapsam sınırı: manuel kullanıcı onayı, eksik katalog veya modellenmeyen mekanik; otomatik doğrulanmışlıkla karıştırılmaz.

Kullanıcının son K lvl hatasının birebir güncel kaydı bulunmadı. Bu plan olası yolları gösterir; son olayın kesin nedenini iddia etmez.

## Okuma envanteri ve incelenen sınırlar

| Yol | Üretici ve tüketici sınırı | Denetlenen konular / kanıt raporu |
| --- | --- | --- |
| Normal boss canlı | BossSource → IPC/worker → ortak token/parser → Boss UI/planner | Başlık/zorluk, liste başı/sonu, Battle sırası, satır bütünlüğü, hesaplama kapısı; correctness + ilk boss raporu |
| Boss fotoğraf | BossImageImport → boss-images → ortak parser → manuel onay/kayıt | Ters sıra, tekrar, trigger, sayı çelişkisi, kaynak kimliğinin manuel sınırı; correctness |
| PKA ana ve yan boss | Etkinlik/hedef → pka-guide → pkaProblem → ayrı sekme/worker | Boss adı, zaman, seçili seviye aralığı, omitted stages, tamlık, remount; correctness |
| Co-Op MAIN | Görev/tip seçimi + güncel Rules → guide → prepareCoop | Target/category/type, boss-only guide ve son Battle ilişkisi, yanlış hedef; correctness |
| Co-Op EVENT | Görev/seviye seçimi → range guide → Co-Op worker | Exact level/range, target kimliği ve eksik metin reddi; correctness |
| Kizuna canlı | Event + live target → seçili zorluk/seviye → shared guide → setup | Başlık/HP/Lv./Battle sayısı, tek kare kaybı, fallback, otomatik onay; correctness |
| Kizuna boss/bonus fotoğrafları | Boss fotoğrafı veya ayrı bonus okuyucusu → ilgili validator → setup/profile | Mekanik ile bonus yollarının ayrımı, kart/form/sayı kapsamı, manuel kimlik; correctness |
| Kizuna internet | Exact event/bonus kaynağı + statik mekanik profil → live fallback | Tarih/yazar/varyant/type/HP/level ve Battle parity, kapsam dışı kaynak; correctness |
| Rumble Rules | Rules IPC/service → doğrulama → renderer | Tek iş, yanlış ekran, iptal, phase ve kısmi kurallar; integration |
| Assault / Rumble INFO | Seçilen NPC → stats/selected skills/resistance → worker | Kimlik, bütün roster ile tek NPC ayrımı, seçili seviye, cancel/restart; integration |
| PKA Rumble | Roster + INFO + bonus → context doğrulaması → worker/cache | Rakip sürekliliği, iki bekleyen iş yarışı, revision/box/generation anahtarı; integration |
| Kutu dosya içe aktarımı | FileList → recognition worker → review → açık kullanıcı eklemesi | Dosya/piksel/grid sınırları, 100 dosya kesilmesi, candidate state ve veri koruma; integration |
| Kutu canlı tarama | ADB capture/scroll → recognition → review | Character Box kimliği, unmount, devam eden boxScroll ve başka okuyucuya geçiş; integration |
| Ortak OCR/piksel | Windows/WinRT + Tesseract → cache → crop/panorama/scroll kanıtı | Worker/protokol/queue/timeout, fallback/confidence, koordinatlar, alpha, tekrar metin, bellek; ocr |
| IPC/ADB ve job lifecycle | Main/preload/service/worker → device input/renderer | Sender ve girdi sınırları, aktif iş sahipliği, stale result/progress, cleanup; integration |
| Saklama ve yeniden açma | validateState/save queue/SQLite → UI restore/cache | Observation/range/status round-trip, fail-closed eski/bozuk state, catalog SHA/box/generation; correctness + integration |

Her rapor kesin dosya/satırları ve yeniden çalıştırma komutlarını içerir. Matris bütün yolların canlı uçtan uca test edildiği anlamına gelmez.

## Öncelikli düzeltmeler

### D1 — P0: Liste sonu ve metin bütünlüğünü birlikte doğrula

complete ile textComplete ayrı. Boss hesaplama kapıları ve Kizuna validator/auto-confirm açık textComplete:false değerini atlıyor; PKA/Co-Op bunu reddediyor. Gerçek applyAutomaticKizuna/kizunaProblem probe'u complete:true,textComplete:false için autoConfirmed:true ve boş engel döndürdü. Üretici helper'ın bu kombinasyonu ürettiği mevcut testle sabit. Boss UI kısmı kaynak kanıtı. Kizuna native/online fallback daha sıkı; bütün canlı intake yolları kusurlu denmemeli.

Dosyalar: electron/boss-behavior-core.cjs:263-280; src/PlannerPage.tsx:121,155; src/kizuna.ts:51-65; src/kizuna-auto.ts:35. Referans: src/pka.ts:20, src/coop.ts:22.

Minimum: bu tüketici/onay kapılarına açık false reddi ekle; kısmi sonucu inceleme için koru, eksik satırı göster. Yeni genel servis/refaktör gerekmez.

Kabul: complete:true/textComplete:false plan ve onayı durdurur; complete:false her koşulda durur; iki true diğer kontrollerle geçer. Alanı olmayan eski kayıtlar mevcut uyumluluk kararıyla ayrıca sınanır ve doğrulanmış metin diye etiketlenmez. Kaydet/yükle bayrakları korur.

### D2 — P1: Ortak duration parser tam sayı tokenını doğrulasın

Production durationEffects/encounterFromTokens probe'unda 1.5 turns Bind → Bind 5 ve -3 turns Bind → Bind 3, uyarı yok. Regex tokenın tümünü doğrulamak yerine içindeki alt sayıyı eşliyor. Canlı görülme sıklığı bilinmiyor. -3 yazımı sıkışmış liste işareti de olabilir; işaretin anlamı bağlam olmadan varsayılmamalı. Kesin problem decimal parçanın sessizce geçerli süreye dönüşmesi.

Dosya: electron/boss-behavior-core.cjs:35-45,292+. Etki ortak parserı kullanan canlı/fotoğraf/PKA/Co-Op/Kizuna fallback yollarına yayılabilir.

Minimum: süre alanını tam token sınırıyla parse et; bozuk sayıyı unreadable bırak. Liste işareti normalizasyonu ancak kaynak/geometri kanıtıyla yapılmalı; işareti koşulsuz silme. Geçerli madde işaretli satırları yanlış reddetme.

Kabul: 3 turns ve mevcut madde işaretli 3 satırları davranışını korur; -3 biçimini koşulsuz reddetme. 1.5, 0, 100 ve 1,000 uydurma gereksinime dönüşmez. durationEffects, encounterFromTokens ve photo assemble aynı tabloyla sınanır. Mevcut sayısal çelişki/confidence korumaları kalır.

### D3 — P1: PKA/Assault iptal-sonrası başlatmayı atomik yap

İptal edilen işin finished promise'ini iki read birden bekleyip ardından ikisi active token kurabiliyor. PKA ve Assault read-only gated-capture probe'ları 3 toplam capture / aynı anda en fazla 2 capture verdi; diğer Luna bağımsız tekrar etti. Normal UI'deki tetik sıklığı ölçülmedi; servis sözleşmesinin bozulması kanıtlandı.

Dosyalar: electron/pka-rumble.cjs:39-43,69; electron/assault-rumble.cjs:13-16,75.

Minimum: await öncesinde yeni başlatma hakkını ayır veya ek bekleyeni açıkça reddet. Eski işin finally bloğu yeni tokenı temizleyemesin; eski tokenın cancel'ı yeni işi iptal etmesin.

Kabul: A capture beklerken cancel, ardından B ve C read; en fazla biri yeni capture/input'a ulaşır, diğeri sıra bekler veya açık ret alır. Sonraki normal okuma çalışır. Tek-retry mevcut testleri bu iki-waiter regresyonunun yerine geçmez.

### D4 — P1: Aynı cihazda okuyucu geçişinin sahipliğini doğrula

Kaynakta UI busy iken gezinme açık; sayfa değişince eski component unmount oluyor. BoxScanner cleanup local stop/gen değiştiriyor, fakat başlamış boxScroll IPC'sini iptal etmiyor. Main'deki okuyucular ayrı servisler, ADB helper bağımsız execFile çağrıları açıyor. Box scroll devam ederken başka reader'a geçmek kaynakta erişilebilir bir pencere; canlı cihaz arızası veya deterministik uçtan uca interleaving bu turda üretilmedi.

Dosyalar: src/App.tsx:293-316,722-805; src/BoxScanner.tsx:12,28-45; electron/main.cjs:36-60,67-75; electron/adb.cjs:16-43.

Önce minimum mocked test: boxScroll askıda, unmount, aynı cihazda yeni reader; yeni reader eski ekrana bağlı girdi bitmeden işlem yapabiliyor mu? Çözüm bu pencereye göre seçilsin: güvenli iptal/handoff veya yalnız cihaz girdisi dizisine sahiplik. Salt capture için kör global kilit veya gezinmeyi tümden kapatma önerilmiyor.

Kabul: eski girdi tamamlanmadan/güvenle iptal olmadan yeni okuyucu ekran bağımlı input üretmez; idle gezinme anlık kalır; farklı cihazlar gereksiz bloke olmaz. Cancel ve progress/result aynı run'a bağlıdır.

### D5 — P1: Geçici eksik Lv./kimlik karesini güvenli kurtar

Tanınmış Kizuna ekranında başlık/HP/Lv./Battle alanlarından biri eksikse mainValues hemen hata verebiliyor; unknown/loading retry buna uygulanmıyor. Ortak boss okuyucunun pending-modal döngüsü de kimliksiz kareyi hemen reddediyor. Kaynakta kanıtlı kurtarma boşlukları; son kullanıcı vakasına birebir bağlanmadı.

Dosyalar: electron/kizuna-live.cjs:9-15,41-44; electron/boss-behavior.cjs:64.

Minimum: eksik OCR, başka hedef ve gerçek sayısal çelişki ayrı sonuçlar olsun. Sadece eksik/geçiş karesinde capture/OCR tekrarla; hedef/ekran ve sayı kanıtı oluşmadan girdi gönderme. Mevcut yerel kurtarma politikasını kullan; toplam/sayfa/frame zaman sınırı ekleme. Hata eksik alanı söylesin.

Kabul: geçici eksik Lv. aynı hedefte toparlanır; kalıcı eksik açık hata/eksik sonuç; değişen boss/Lv./HP ve yanlış uygulama ret. Sayısal Lv. olmayan normal rehber bozulmaz.

### D6 — P1: İptali çalışan OCR işine bağla

Mevcut cancel bayrak değiştiriyor; kontrol OCR await sonrası. Deferred OCR probe iptalden sonra yanıt gelene kadar scan'in beklediğini gösterdi. Tek istek timeout'u 30 saniye; gerçek kullanıcının iptal gecikmesi ölçülmedi.

Minimum: job-scoped abort/sahiplik; global worker'ı kapatarak bağımsız işi bozma. Geç gelen iptal edilmiş result ve progress yeni state'i değiştirmesin.

Kabul: unresolved OCR mock'unda iptal 30 saniye beklemeden sonuçlanır (yerel test hedefi 1 saniye); bağımsız iş korunur; sonraki iş temiz çalışır; iptalden sonra input yok. Bu tüm okumaya süre sınırı değildir.

### D7 — P2: Kutu içe aktarımda atlanan dosyayı açık göster

src/BoxScanner.tsx:47 FileList'i slice(0,100) ile kesiyor; kalan dosya sayısı final mesaja taşınmıyor. Kaynakta doğrulandı ve çapraz incelendi; 101 dosyalı renderer testi yapılmadı. Sorun status alanının erişilemezliği değil, kısmi işlemin tamamlandı gibi anlaşılabilmesi.

Minimum: sınırı işlem başlamadan açıkça bildir/reddet veya ilk 100/N sonucunu ve kalanı göster. Yeni sınırsız iş kuyruğu gerekmez.

Kabul: 101 dosyada açık ret veya 100 işlendi/1 kaldı; tüm 101 okunmuş gibi mesaj yok; kalanları sonraki batch'te kullanıcı başlatabilir.

### D8 — P2: Online kaynak ile hedef Battle sayısını eşleştir

Kizuna statik online hızlı yolu target.battles=4 için üç stage ve complete/textComplete/mechanics.complete=true döndürdü. Tarih 22 Ekim'e sabitlenmiş fixture-shaped sentetik hedef kullanıldı. Koala kaynak dönemi 21-25 Ekim; bugün kapalı olduğundan bu spesifik yol güncel tarihte erişilmez. Bu kalıcı kaynak/hedef guard açığı; bugünkü canlı hata iddiası değil.

Dosya: electron/kizuna-guide-online.cjs:8-15,64-96. Live fallback Battle sayısını zaten kıyaslıyor.

Minimum: statik profil desteklediği sayıyı hedefle eşleştirsin; uyuşmazsa incomplete/fallback. Desteklenmeyen kaynaktan mekanik taşınmasın.

Kabul: 0/2/4 için üç aşamalı kaynak complete olmaz; 3 normal geçer; yanlış tarih/variant/type/level/HP korumaları kalır.

### D9 — P2: Tesseract terminate/restart yaşam döngüsünü yönet

line-ocr.cjs:10,19-23 timeout reject sonrası eski terminate promise çözülmeden yeni worker başlayabiliyor. Deferred mock iki Luna tarafından tekrarlandı; gerçek overlap süresi/leak/OOM veya yanlış OCR sonucu gösterilmedi.

Minimum: retire işini sahiplikle yönet; yeni worker başlamadan kapanma sonucu ele alınsın. Asla çözülmeyen terminate de bütün gelecekteki okumaları kalıcı kilitlemesin; tanımlı I/O recovery yolu olsun.

Kabul: deferred terminate sırasında kontrolsüz worker çoğalması yok; kapanma takılırsa açık hata/temiz restart; aktif+queued cancel ve normal reuse korunur.

## Ölçüm ve doğrulama bekleyen işler

| Konu | Kanıt / sınır | Sonraki en küçük adım |
| --- | --- | --- |
| REQUIREMENT belleği | Gerçek arşivde 19 adet 900x1600 PNG toplam 38.620.397 byte. Hold sırasında full frame tutuluyor, ROI sonra çıkarılıyor. Peak RSS/OOM ölçülmedi. | Aynı ROI + orijinal boyut/button geometrisini capture anında saklamayı ölç. Mevcut kimlik kanıtları hold öncesi/sonrası; bunları koru. Gelecekte per-frame kimlik gerekirse kompakt header ROI ekle. Aynı 19 kare aynı doğrulama sonucu üretmeli; sabit frame cap yok. |
| Progress run ID | PKA/Assault string-only progress; eski event'in yeni işte görünmesi henüz tekrar üretilmedi. Result generation korumaları ayrı. | A cancel/B start ardından A'nın queued progress'ini teslim eden test; yalnız ondan sonra minimum ID eşleştirmesi. Stale durum metnini yanlış hesap sonucuyla karıştırma. |
| WinRT iç timeout | Wait(20000) sonrası Cancel yok, dispose ve server loop devam ediyor. İşlemin gerçekten sürüp çakışması runtime'da gösterilmedi. | Native fault injection ile operation lifetime ölç; gerekiyorsa cancel/sağlıksız process restart. Sızıntı/çakışma olmuş gibi sunma. |
| Scroll-anchor maliyeti | Sentetik tekrar satırları 10/20/30 için yaklaşık 0,373/1,235/2,754 saniye; hepsi güvenli ret. Gerçek rehber baseline yok. | Gerçek repeat-heavy kayıtta evre profili; ancak ölçülmüş darboğaz varsa candidate/crop işini azalt. RSS delta leak kanıtı değil. |
| Transparent giriş ve rounding | Gerçek RGBA fixture'ları opaque; crop/scale probe delta 0px. Sentetik alpha0 foreground davranışı var, üretim kusuru gösterilmedi. | Capture opacity sözleşmesi ve fractional/odd-width sınır testi; tüm gerçek girişler bozuk varsayılmasın. |
| Fotoğraf kaynak kimliği | Başlık/form alanları ve bütün görüntülerin aynı görev olması kullanıcı tarafından onaylanıyor; sayfa başına otomatik identity yok. | Mevcut manuel sınırı görünür tut; otomatik garanti istenirse başlık ROI eşleştirmesi ekle, başlıksız crop için manuel beyanı koru. |

## Sağlamlığı doğrulanan ve elenen şüpheler

- OCR cache reddedilen işi kalıcı tutmuyor; image/options/scale/crop ayrımı, aynı-key coalescing, clone izolasyonu ve LRU mevcut testlerde geçti. İlk turdaki aynı görüntünün pahalı backend OCR'ı sürekli tekrarladığı şüphesi elendi: ikinci fingerprint 0 page/0 line backend çağrı.
- Windows client out-of-order/bozuk/UTF-8 parçalı yanıt, process exit/timeout/restart ve eski süreç cevabını ayırıyor. Çoklu pending malformed response gibi ek sınırlı test boşlukları OCR matrisinde açık.
- Crop+scale origin dönüşümü gerçek WinRT probe'unda 0px fark verdi. Bu bütün fractional ölçekleri kapsamaz.
- Reverse photo sırası ve tekrarlı Battle/trigger probe'larında sessiz overwrite veya yanlış event bağlama görülmedi. Canlı parser geriye giden/uygunsuz tekrar başlıklarını reddediyor.
- validateState observation round-trip complete/textComplete/range/marquee/mode/warnings ve notListed alanlarını korudu. Bozuk/uyumsuz kayıt read-only açılıyor; save queue sıralı. Yeni DB kaybı veya catalog SHA/box cache sızıntısı üretilmedi.
- PKA ve Co-Op incomplete text'i reddediyor; seçili range/type/title negatifleri mevcut. Battle1'in isteğe bağlı yokluğu ile liste başlangıç/son kanıtı ayrılmış.
- Rumble'da per-NPC complete ile gözlenen roster completeEnemies ayrı anlamlar. Eksik tek INFO detayını bütün roster okundu yanlışı diye sayacak kanıt bulunmadı.

## Bilinen kapsam sınırları

Kizuna Koala internet profili bugün kapsam dışı; tarih koruması doğru. Önce kaynak kapsanmıyor ile OCR başarısız ayrımı ve mevcut fallback nedeni gösterilmeli. Yeni etkinlik desteği gerçek kaynakla doğrulanmalı.

Rumble NPC types=[] ve bazı Assault bonus birleşmesi/geç faz büyüklükleri bilinmiyor; katalog kartından NPC bilgisi türetilmemeli. Uyarılar doğrulanmış skora dönüşmemeli. Kutu handoff'undaki 414 eksik ikon veri kapsamıdır, yeni canlı tarama sayısı değildir. Eşik gevşetmek yerine gerçek ikon/crop kapsamı geliştirilmeli.

Eski Mihawk Lv5 b/D ve Lv150 duration4 düzeltmeleri güncel açık bug diye yeniden sayılmadı. Güncel tam native/live tekrarın yapılmamış olması doğrulama sınırıdır.

## Uygulama sırası ve teslim kapısı

1. D1 metin bütünlüğü ve D2 sayı token sınırı: önce başarısız karşı örnek/regresyon, sonra en küçük tüketici/parser düzeltmeleri.
2. D3 atomik read reservation. D4 için deterministik aynı-cihaz handoff testi; kaynakta görülen pencereye göre en dar çözüm.
3. D5 geçici-kare kurtarma ve D6 job-scoped OCR iptali; yanlış hedef ve iptalden sonra girdi üretmeme negatif testleri.
4. Mevcut tanılamayı Kizuna/Rumble'a taşı: genel log zaten var, gereken frame/alignment replay. Run kimliği, eksik alan/satır, complete/textComplete, capture/OCR süreleri, benzersiz hash/path; yerel ve sınırlı saklama, otomatik yükleme yok.
5. D7 dosya sayımı ve D8 online parity gibi küçük bağımsız düzeltmeler; D9 ve ROI maliyetini ölçerek yaşam döngüsü/bellek iyileştirmesi.
6. İlgili regresyonlar, sonra tam test paketi ve TS/Vite build. Dağıtılacaksa final ASAR'da native fixture testleri. Son revizyonda uygun bilgi ekranlarında normal boss, aralıklı PKA/Co-Op, Kizuna ve Rumble okumaları; süre/kurtarma/eksik satır aynı koşullarda karşılaştırılmalı.

Toplam/sayfa/frame okuma cap'i, sayı tahmini, kontrolleri gevşetme, OCR motor değişikliği, blanket global lock ve geniş refaktör varsayılan çözüm değil. İyileştirme her giriş ve tüketiciyi tamamlamalı; şikâyet edilen tek bossun geçmesi kabul ölçütü değil.

## Yapılan doğrulama ve dosyalar

Derin doğruluk grubu 228/228; OCR/piksel grubu 104/104; entegrasyon grubu 37/37; bağımsız PKA/Assault çapraz grubu 15/15 geçti. Gruplar örtüşür; benzersiz test toplamı diye toplanmadı. Komutlar, probe girdileri ve çıktıları raporlarda. Bunlar mevcut davranış testleri; bulunan açıklar düzeltilmiş değildir. İlk turda ayrıca 149 geçti/1 yerel crop yokluğu skip vardı.

Graphify ilk tur AST-only 316 kod dosyası/1.852 düğüm; ikinci tur mevcut grafı kullanıp kaynakla doğruladı. LLM/ücretli semantik çıkarım yok. graphify-out/ untracked ve gitignore dışında. .local probe dosyaları ignored. Uygulama/test koduna dokunulmadı, build veya paket/live doğrulama bu plan turunda yapılmadı.

Ayrıntılı ikinci tur raporları:

- docs/reading-audit-deep-correctness-2026-11-01.md: üretici→tüketici matrisi, parser ve online parity probe'ları, round-trip ve fotoğraf sınırları.
- docs/reading-audit-deep-ocr-2026-11-01.md: OCR/piksel invariant matrisi, gerçek ve sentetik ölçümler, bağımsız entegrasyon çapraz incelemesi.
- docs/reading-audit-deep-integration-2026-11-01.md: servis/IPC/ADB/UI/storage matrisi, race/file cap, bağımsız OCR/ROI çapraz incelemesi.

İlk raporlar reading-audit-boss, reading-audit-marquee ve reading-audit-other dosyalarında kanıt geçmişi olarak korunur. Sonraki uygulama başlangıcı D1/D2 regresyonları ve D3 reservation karşı örneğidir; bu tur yalnız derin inceleme ve plan teslimidir.
