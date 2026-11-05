# Kayan yazı okuma denetimi — 2026-11-01

Kapsam: boss davranış kayan yazı/panorama, pixel tracking, OCR doğrulama, retry ve cancel. Kaynak koduna dokunulmadı; uygulama/emulator çalıştırılmadı. Graphify graph başlangıçta bulunmadı; başka bir iş aynı anda `graphify-out/` üretmiş olabilir, bu denetim ona dokunmadı.

## Bulgular

### 1. Cancel, devam eden OCR isteğini durdurmuyor — doğrulanmış kontrol akışı

- `electron/boss-behavior.cjs:109` sadece `active.cancelled=true` ayarlıyor. Pixel collector her `await` sonrasında `check()` çağırıyor (`electron/marquee-panorama.cjs:129–147, 157–165`), fakat devam eden Windows/Tesseract OCR isteği iptal sinyali almıyor.
- OCR okuyucuları ayrı 30 saniyelik tek-istek timeout’u kullanıyor (`electron/windows-ocr-client.cjs:3,23`; `electron/line-ocr.cjs:7,18–19`). Boss servisinin `closeOCR`/`closeLineOCR` çağrısı cancel’a bağlı değil (`electron/boss-behavior.cjs:111–115`; cleanup yalnız `rule-ocr.cjs:19`). Böylece takılan tek OCR isteğinde iptal ancak yanıt/timeout sonrası görülebilir.
- Regresyon açığı: `tests/marquee-panorama.test.ts:70–73` iptali `wait` sırasında sınar; aktif OCR await’i sırasında iptali ve sonraki okumanın çalışmasını sınamaz. Deferred OCR probe, iptal işaretlendikten sonra mock OCR çözülene kadar scan’in beklediğini ve çözülür çözülmez sonraki `check()` ile reject olduğunu gösterdi.
- `tests/windows-ocr-client.test.ts` explicit `close()` ile aktif işi iptal edebildiğini gösterir; boss service cancel bu close’a bağlı değildir.
- En küçük iyileştirme: job-scoped iptal/abort ya da okuyucu sahipliği/lease tasarımı. Paylaşılan global worker’ı doğrudan kapatmak, aynı OCR istemcisinin başka çağrılarını veya kuyruğunu bozabilir. Kabul: geciken OCR mock’u cancel çağrısından hemen sonra sonlanır, satır incomplete kalır, bağımsız bekleyen iş korunur ve aynı servisle sonraki okuma çalışır.

### 2. Aynı okunamayan görüntü başarıyla reddediliyor; üretimde OCR tekrarı cache tarafından önleniyor

- Kaynakta duplicate-fingerprint kontrolü `electron/marquee-panorama.cjs:148–149`’da alternatif OCR’lardan sonra yapılıyor. İzole, cache’siz test mock’ları ikinci recognize çağrısında callback’leri tekrar görür; fakat üretim `rule-ocr.cjs:19` ve `line-ocr.cjs:33` her iki okuyucuda da aynı girdi/ölçek için 16 kayıtlı LRU cache kullanıyor.
- Read-only probe `.local/marquee-read-audit-probe.cjs`, gerçek `marquee-cycle` fixture’ını ve production `cacheOCR` wrapper’ını kullandı. Üç okunamayan satırda ilk deneme 12 underlying page OCR + 6 underlying line OCR çağrısı yaptı. Aynı fingerprint’in ikinci çağrısında wrapper 18 page / 8 line çağrısı gördü, ancak underlying OCR sayısı **0 page / 0 line** oldu; mevcut kesin incomplete hatası döndü. Yani aynı fingerprint üzerinde production OCR motorunun tekrar çalıştığı doğrulanmadı.
- Sonuç: bu, mevcut halde performans P1’i değil. Kontrol sırası cache’ye gereksiz wrapper/JS/pixel-strip işi yaptırıyor olabilir; ancak aynı pikselde OCR maliyeti bulgusu geri çekildi ve öncelikli değişiklik önermiyorum. Gelecekte optimize edilirse kabul: aynı panel için backend OCR çağrısı sıfır kalmalı, değişen fingerprint normal kurtarma kullanmalı, incomplete satır complete olmamalı.

## Sayısal doğrulama: güncel koruma var; tarihsel kusur çözülmüş

- Handoff `docs/HANDOFF.md:30–31` 13 sayfalık Lv150 canlı okumada `a turn(s)` biçiminde yanlış tamamlanan süreyi kayıt ediyor ve çözümün sonrasındaki tam final canlı tekrarın yapılmadığını açıkça belirtiyor. Bunu güncel kusur gibi sunmuyorum.
- Güncel kod `marquee-panorama.cjs:132–145` rakam yerine harf ihtimalini/eksik sayıyı reddediyor; hatalıysa aynı strip’i line ve block layout ile doğrulamaya çalışıyor, sayı çakışmasını blokluyor.
- `tests/pka-header-continuity.test.ts:6` gerçek open-top `4` fixture’ında `4 turn(s)` geri kazanımını, ayrıca `4`/`40` çakışmasında reddi test ediyor. `tests/marquee-panorama.test.ts:161–164` iki görünümün aynı harf-benzeri sayıyı okumasının eksik rakamı tamamlayamayacağını doğruluyor.

## Mevcut örüntü ve maliyet kanıtı

- Ana akış `collectPixelMarquee` her bekleyen satır için 80 ms bekleyip piksel-only capture yapıyor (`electron/marquee-panorama.cjs:157–165`); sınırsız toplam okuma eski handoff kararına uygun. Herhangi bir toplam cap önermiyorum. Progress satır/pending ve capture sayısını gösteriyor; hata sınıfları ve OCR aşama süreleri için aynı ayrıntıda ölçüm görünmüyor.
- Handoff `docs/HANDOFF.md:160` aynı 13 satırlı canlı sayfanın 22.127 saniye/17 capture’da tamamlandığını ve 10★ Koala Lv8 tam okumanın 266.320 saniye/7 sayfa/36/36 kayan satır olduğunu kaydediyor.
- `docs/HANDOFF.md:151–152` v0.5.53’te benzer CP-9 okuması için native kaynak 123.529 saniye, paketlenmiş UI 300.535 saniye yazıyor. Bu eski ölçümler farklı koşullar/revizyonlarda alındı ve evre bazlı profil yok; 2,43× fark doğrudan OCR regresyonu kanıtı değildir. Yalnız paket/ortam farklarının ve maruz kalan uzun beklemenin ölçüme değer olduğunu gösterir.
- `boss-behavior.cjs:86–89` normal aralıkta 4 capture’dan 3’ünde piksel-only yol kullanıyor; tam sayfa OCR her frame’de yapılmıyor. Bu, tekrar maliyetini azaltan mevcut tasarım.

## Önerilen öncelik

1. Cancel sinyalini aktif OCR I/O’suna job-scoped biçimde bağla; in-flight cancel regresyonu ekle. Paylaşılan worker’ı global kapatmanın başka okuyucuları bozma riskini test et.
2. Aynı-fingerprint hızlı ret performans değişikliği öncelikli değil: probe mevcut production cache’inde ikinci backend OCR olmadığını gösterdi.
3. Bir sonraki hedefli doğrulamada güncel final revizyonun gerçek bir kayan boss satırını tekrar okuyup sayısal satırları bağımsız görsel incele. Handoff’taki final canlı tekrar yapılmadı notu bug değil, doğrulama boşluğu.

## Doğrulama komutları ve sonuçları

- Probe: `node .local/marquee-read-audit-probe.cjs` — 3 okunamayan satırda ilk deneme 12 page + 6 line backend OCR; aynı fingerprint’in ikinci denemesinde 0 + 0 backend OCR (cache hit). Deferred OCR probe’da cancel’dan hemen sonra promise settled=false; mock OCR resolve edildikten sonra `check()` ile `probe cancelled` reject.
- Hedefli testler: `npx tsx --test tests/marquee-panorama.test.ts tests/pka-header-continuity.test.ts tests/windows-ocr-client.test.ts` — **49 test, 49 geçti, 0 başarısız, 0 atlandı; 19.5866 saniye**.
- İncelenen gerçek tek-I/O limitleri: Windows OCR client `timeout=30000ms` (`electron/windows-ocr-client.cjs:3`); line/block OCR `timeout=30000ms` (`electron/line-ocr.cjs:7`). Boss cancel çalışan istek içinde ancak await döndükten sonra check edilir; testteki deferred mock gerçek 30 saniyeyi bekletmedi, yalnız sıra/bağlantıyı kanıtladı. Gerçek kullanıcı cancel latency ölçülmedi.
- Canlı son-revizyon boss okuması bu denetimde yapılmadı; handoff’taki “final canlı tekrar yapılmadı” notu bug değil, doğrulama boşluğu olarak tutuldu. Uygulama kodu/testleri değiştirilmedi; app/emulator çalıştırılmadı.
