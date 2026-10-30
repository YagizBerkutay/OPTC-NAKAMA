# Kadro oluşturma ve boss verisi iyileştirme planı

Tarih: 20 Ekim 2026. Durum: araştırma ve uygulama planı; uygulama kodu/veri paketi değiştirilmedi. Çalışan sürüm v0.5.34.

## Karar

Kadro kurmayı insanın izlediği sıraya taşı: göreve girebilme → aşamaları ve tetikleri anlama → engelleri aşacak eylemleri planlama → kaptan/üye/Support uyumu → gerçek sıra ve kaynaklarla hasar/sağkalım → alternatifler. Karakter metni, boss metni ve hesaplama birbirinden ayrı doğrulanmalı. Daha iyi OCR, eksik yetenek modelini tek başına düzeltmez.

Karakterler için kaynak veri; bosslar için görev/zorluk/seviyesi doğrulanmış yazılı rehber öncelikli. Kapsamı eksik bosslarda toplu ekran görüntüsü yükleme birinci sınıf alternatif olacak. MuMu kaydırmalı tarama korunacak; tekrar tekrar bütün rehberi okutmak zorunlu olmayacak.

## 1. İncelemeden elde edilen kanıt

- `scripts/update-catalog.mjs` zaten 2Shankz OPTC Database'den units/details/cooldowns/evolutions/tags/families/rumble dosyalarını alıyor. Karakter yetenekleri şu anda da OCR'dan hesaplanmıyor. Yerel planner kaydı 9 Ekim kaynak revizyonundan 10 Ekim'de üretilmiş. Kontrol edilen güncel upstream revizyonu 16 Ekim tarihli `dca801e642c394d631c906350f2b23f394136fe9`; veri güncelliği de ele alınmalı.
- Genel ekranın `planning.worker.ts` toplu işlemi 13 kategori için `plan()` çağırıyor; `plan()` her defasında üç geliştirme senaryosunu hesaplıyor. Toplam 39 arama var; kategori sonucu ancak o kategorinin üç senaryosu bittikten sonra ilerleme gönderiyor. Tek takım isteğinde de seçili sekme yerine üç senaryonun tamamı bekleniyor.
- 693 karakterlik gerçek kutu, salt okunur profil ve CPU profiliyle ölçüldü. Mevcut senaryoda 693, evrimli hedefte 941 aday var. Aday hazırlama yalnızca 48–66 ms. Asıl süre çözüm aramasında. CPU örneklerinde `pve-synergy`, yetenek koşulları, isim/tag ve Support eşleştirmeleri öne çıkıyor.

| Senaryo | Karma kadro | STR kadro |
|---|---:|---:|
| Mevcut hâl | 18,5 sn | 12,6 sn |
| Lv.100 evrimsiz hedef | 47,6 sn | 33,3 sn |
| Lv.100 + evrim hedefi | 50,1 sn | 39,3 sn |

Karma üç senaryo toplamı yaklaşık 116 sn. Bunlar profilleme açıkken Node üzerinde alınmış tek ölçüm serisidir; paketli arayüz p95 ölçümü veya bütün 13 kategorinin süresi değildir. Ham sonuçlar `.local/planner-audit-20261020.json`, CPU profili aynı adlı `.cpuprofile` dosyasında.

- `solveAdventure()` kaptanları ilk 18, üyeleri ilk 24, kısmi ekipleri ilk 22 seçenekle sınırlıyor. Bariyer için özel koruma var; bütün zorunlu mekaniklerin çözüm adayları aynı şekilde korunmuyor. Bu, gerekli bir karakterin tam aşama değerlendirmesinden önce elenebilmesi için somut risk.
- Genel kadrolarda nihai boss hasarı/sağkalım yeniden değerlendirmesi çalışmıyor; genel öneri uyum puanı. Boss yolunda önce yaklaşık arama, sonra sınırlı finalistlerin savaş değerlendirmesi var. Dolayısıyla puanı yüksek takımın gerçekten en yüksek hasarı verdiği kanıtlanmış değil.
- Katılım koşulları ve son aşama eksikliği bugün bazı hesapları durduruyor. Yeni yol bu doğrulamaları kaldırmayacak; eksik alanı yerinde tamamlama sunacak.
- OCR backend'i her `ocrBuffer()` çağrısında PowerShell süreci açıp Windows OCR çalıştırıyor. Tam ekran okumasına ek etiket/sayı/başlangıç durumu düzeltmeleri ve kayan metin örnekleri de var. Süreç açma maliyetinin toplam payı ayrıca ölçülmeli; henüz hız kazancı iddiası yok.

## 2. İnternette ne var, neyi değiştirebiliriz?

| Veri | Kontrol edilen kaynak | Kullanım kararı |
|---|---|---|
| Karakter stat, captain, special, sailor, Support ve gelişim | [2Shankz OPTC Database](https://github.com/2Shankz/optc-db.github.io) | Mevcut içe aktarmayı sürdür; revizyonu, alan eksiklerini ve form/LLB dallarını denetle. |
| Güncel karakter ayrıntıları | [E9 Wiki Sanji #4654](https://www.e9wiki.com/optc/en/characters/17616) | Special, sailor, Support, LB, Rumble ayrıntıları görünür. Karşılaştırma/yedek kaynak olarak değerlendir. Toplu veri API'si ve otomatik aktarımın kapsamı doğrulanmadan ana kaynağı değiştirme. |
| Yazılı boss davranışları | [GameWith Marco 10★](https://xn--pck6bvfc.gamewith.jp/article/show/263248) | Aşama, HP/hasar ve tetik bilgileri var. Japonca isim/JP sürümü ile Global görev kimliği ve zorluğu doğrulanarak bir adaptör ve onaylanmış karşılaşma kaydı üretilebilir. |
| Diğer görev rehberleri | [Fransız Arène arşivi](https://onepiecetreasurecruise.fr/Arene.html), [Crâne arşivi](https://onepiecetreasurecruise.fr/Crane.html) | Mevcut adaptör yalnız bu iki arşivi tarıyor. Bunlar bütün Clash/PKA görevlerinin kaynağı değil. |

E9 URL'sindeki `17616`, oyundaki kart numarası `4654` değil; bütün kaynaklarda oyun kimliğine açık eşleme gerekli. Yeni veri geldi diye bütün eski kayıtları veya sahiplik verisini değiştirme. Sanji örneğinin mevcut special metni E9 ile anlam bakımından uyumlu: bu örnekte sorun metnin internette bulunmaması değil.

Her bossun güncel Global sürümünü, tam PKA seviyesini ve bütün tetiklerini veren tek eksiksiz, doğrulanmış yapılandırılmış kaynak bulunmuş değil. İnternet entegrasyonunu böyle bir kapsama sahipmiş gibi tasarlama. Aynı isimli başka görev/zorluk, kaynak uyuşmazlığı veya yalnız seviye aralığı bulunduğunda açıkça göster; eksik HP'yi başka zorluktan doldurma.

## 3. Karakter bilgisi için tek hesaplanabilir model

Kaynak metnini her ekip karşılaştırmasında yeniden regex ile çözmek yerine veri sürümü ve kart durumu başına bir kez ayrıştır:

- Kimlik, form, tip/sınıf/tag, aktif captain dalı, Lv/LLB/LB ve gerçek special seviyesi.
- Etki hedefi, miktarı, süresi, tetik koşulu, kullanma maliyeti, cooldown, bir defalık kullanım ve etkilerin uygulanma sırası.
- Captain, sailor, special, switch/super switch, Super/EX, VS, Rush, Last Tap, Super Tandem, potential ve Support için ayrı kaynak/aktivasyon kaydı. Kaynakta olmayan veya yorumlanamayan etkiyi desteklenmiş sayma.
- Çözümlenen / kısmen çözümlenen / desteklenmeyen maddelerin kart bazlı kapsam raporu. Kritik eksikte yalnız ilgili kart ve paragrafı düzeltme yolu.
- Mevcut hâl, Lv.100 evrimsiz ve Lv.100 + ulaşılabilir evrim ayrı kalır. Maksimum stat, başlangıçta combined form/özel alan/özel orb hazır demek değildir. Evrim malzemesi ve edinme açıklaması korunur.
- Gerçek gelişimler bilinmiyorsa düşük varsayım açık kalır. Gem, gelişim malzemesi veya başka sahiplik bilgisi uydurulmaz. Arkadaş kaptan ve gemi önerisinin bulunabilirliği ayrıca belirtilir.

Mevcut modülleri bu modele aşamalı taşı; ayrı parser ve ayrı puanlama kopyaları ekleme. PvE ile Rumble/GP kurallarını aynı yetenek modeline karıştırma.

## 4. İnsan gibi kadro kurma sırası

1. **Görevi ve giriş koşullarını belirle.** Global, oyun modu, görev kimliği, yıldız, seçili Lv./aralık ve etkinlik sürümü. Tip/sınıf, cost, yıldız, isim yasakları ve destek slotlarına uygulanıp uygulanmadığı. Nihai evrim ve arkadaş kaptan da kontrol edilir.
2. **Bütün aşamaları olay çizelgesine çevir.** Starting state, preemptive, aynı aşamadaki sonraki turlar, HP eşikleri, special karşı saldırıları, ölüm/dirilme ve harita etkileri. Başlığın boş olması ile metnin eksik olması ayrılır. `3-2` gibi alt başlıklar ham etiket ve görünen tetikle korunur; yalnız sayısından tur/alternatif anlamı uydurulmaz.
3. **Her zorunlu engel için çözüm seçeneklerini çıkar.** Kaç tur, kim etkileniyor, hangi sırada aşılabilir, hangi karakter bunu zamanında yapabilir? Önce nadir çözümü olan engeller; birden fazla işi yapan karakterler. Doğrudan kaldırma, bağışıklık, doğrulanmış pasif, yasal Support veya savunmayı gerçekten aşabilen hasar gibi alternatifleri aynı ihtiyacın çözümleri olarak değerlendir.
4. **Kaptan çifti ve çekirdek çözücüleri birlikte seç.** Yalnız ATK sırasındaki ilk 24 üyeye bakma. Her çözülebilir ihtiyacın adaylarını koru; kimlik çakışmaları, uygun form, hedef kapsamı ve cooldown ile olanaksız dalları erkenden ele.
5. **Boş slotları uyum ve saldırıyla tamamla.** ATK/orb/affinity/chain/base ATK/direnç/alan etkileri; aynı kategoride çakışma ve üstüne yazma; gerçekten aktive edilebilen ileri yetenekler. Support hedefleri, kimlikleri ve bir defalık tetikleri ile geminin gerçek bonusu.
6. **Tur ve eylem sırasını doğrula.** Bağlı/rewind yemiş üye special açamaz. İlk dual special'ın etkisi ile special sonrası form değişimi farklı adımlardır. Special limiti, bind satırı, orb üretme-kilitleme, switch sayacı ve arkadaşın hazır olma durumu dikkate alınır.
7. **Hasar ve hayatta kalmayı birlikte dene.** DEF Up/Threshold/DR, NAO, bariyerler, hasar sınırı, düşman HP/DEF; kendi HP kesintisi, PERFECT başına yanma, poison orb, preemptive, tur sonu ve ölüm sonrası hasar. Tek tur hasarı yetmiyorsa sonraki tur tetiklerini ve alınacak hasarı içeren yol aranır. Zorunlu ölümü yüksek puan telafi edemez.
8. **Geçerli takımları sırala.** Önce giriş koşulları ve yaşayabilme; sonra bütün zorunlu engellerin aşılması; sonra tutarlı saldırı hasarı, tur sayısı ve uygulama kolaylığı. Bilinmeyen veriye göre güçlenmiş varsayımı üstünlük sayma. Evrensel matematiksel optimum iddiası yerine arama bütçesi ve doğrulama kapsamı göster.

Özel kabul örnekleri: 98 tur Resilience'ı süre azaltarak kaldırmak zorunlu olmayabilir; mevcut kurallarda onu gerçekten aşan hasar/bitiriş ve bağışıklık birlikte doğrulanır. Timing bariyerde oyuncunun uygun vuruş yapması talimatlandırılır; sırf bunun için gereksiz slot harcanmaz. Slot bariyerde gereken sayıda gerçek orb ve vuruş sırası sağlanır. Bir aşamadaki çözüm sonraki aşamanın special'ını gereksiz tüketmez.

## 5. Genel kadro ekranının amacı

Boss seçmeden tek bir evrensel en iyi takım yok. STR/Fighter vb. öneriler için varsayımları görünen ortak karşılaştırma senaryosu kullan; ilk hedef tek tur hasarı veya dengeli kullanım olarak açık seçilir. Genel takımın yanına çözdüğü mekanikler, zayıf kaldığı mekanikler, captain kapsamı ve ileri yetenek aktivasyonu yazılır. Boss seçilince aynı takım yeniden o görevin çizelgesinden geçirilir.

İlk görünümde seçili kategori ve seçili gelişim sekmesini hesapla. Diğer sekmeler istenince çalışsın; istenirse hepsi oluşturulsun. Toplu 13 kategori ayrı bir işlem; sonuçlar hazır oldukça kartlar görünür. Tıklayınca boş ekran yerine mevcut sonuç, hesaplanan aşama, geçen süre ve çalışan iptal düğmesi gösterilir. Eski sonuçlar kutu/veri/boss değişince güncelmiş gibi kullanılamaz.

## 6. Hız planı

- Ayrıştırılmış yetenekler, kimlik/tag üyeliği ve Support hedef eşleşmesini kart durumu başına hazırla. İç döngülerde isim normalleştirme/regex tekrarlarını azalt; tip/sınıf/kimlik ve mekanik kapsamlarını bit kümeleri veya basit önhesaplanmış tablolarla karşılaştır.
- Aynı veri/kutu senaryosu için aday profilleri ve uyum tablolarını kategoriler arasında paylaş. Ekip değerlendirmesini form/seviye/sıra/slot ve boss sürümünü içeren anahtarla önbellekle. Sıralamanın önemli olduğu sonuçları yalnız sıralanmış ID kümesine göre önbellekleme.
- Önce zorunlu çözümleri kapsayan küçük ekip çekirdekleri; sonra saldırı seçenekleri. Kısmi ekibin kalan slotlarla ihtiyacı karşılama şansı yoksa erken ele. Yalnız aynı koşullarda gerçekten baskın seçenekleri ele; pahalı simülasyonu uygulanabilir finalistlere ayır.
- Worker içinde ilerleme veren, iptal edilebilir parçalar; zaman bütçesi bittiğinde eldeki en iyi doğrulanmış sonucu göster. Daha derin arama kullanıcının seçeneği olur. Worker kullanmak tek başına algoritmayı hızlandırmış sayılmaz.
- İlk hedef: aynı kutuda seçili kategori/sekmede ilk geçerli sonuç 5 sn içinde, önbellekten dönüş 300 ms içinde; derin arama varsayılan bütçesi 20 sn. Bunlar kabul hedefidir, kazanılmış hız değildir. Soğuk/sıcak p50/p95 ve belleği paketli uygulamada en az 5 tekrarla ölç; doğruluk pahasına hedef tutturma.

## 7. Boss verisi ve fotoğraf akışı

Üç giriş aynı doğrulanabilir Encounter modeline dönüştürülür:

1. **Rehberden bul:** tam görev + zorluk + Global/etkinlik eşleşen kaydı indir veya önbellekten aç. Kaynak, güncelleme ve eksik alan görünür; her hesapta internet veya MuMu şart olmaz.
2. **Fotoğraf yükle/yapıştır:** başlık-zorluk/Lv., kırmızı REQUIREMENT açıklaması ve BEHAVIOR parçalarını toplu sürükle-bırak veya panodan ekle. Her resimde görünen Battle/tetik kaydedilir; sırası kullanıcıca değiştirilebilir. Eksik veya çelişkili alan yalnız ilgili görsel üzerinde düzeltilir; kaynak görsel saklanır. Başlıksız parçanın hangi savaşa ait olduğu sorulur/tanımlanır, tahminle birleştirilmez.
3. **MuMu'dan otomatik oku:** önce aynı görev ve sürüm için onaylı kayıt var mı kontrol et. Yalnız yeni/değişmiş satırları OCR'a gönder; kayan satırın görüntüsünün değişimini hafif piksel takibiyle izle. OCR süreç açma maliyeti yüksek çıkarsa tek kalıcı Windows OCR oturumu ve kuyruk kullan. Kaynak altın testler geçmeden backend değiştirme.

Tek fotoğraf, ekran dışına taşan kayan metnin görünmeyen kısmını içermez. Böyle satırlarda başını ve sonunu gösteren ek fotoğraf veya o satırın kısa video/burst kaydı gerekir. Tam döngü kanıtı yoksa süre doldu diye tamamlandı sayma. Süre bütçesinden sonra bütün taramayı çöpe atmak yerine okunanları tut, eksik satırları göster ve yalnız onları tamamlama sun. Kapsam eksikse doğrulanmış savaş planı ile taslak ayrımı korunur.

Fotoğraf yolu ADB kaydırma, yüklenme ve başa dönme beklemelerini kaldırabilir; OCR ve kayan metin doğrulamasını kaldırmaz. Aynı görev üzerinde toplam kullanıcı emeği dahil süre karşılaştırılmadan daha hızlı olduğu iddia edilmez.

## 8. Uygulama sırası ve tamamlanma ölçütü

| Paket | İş | Bitme kanıtı |
|---|---|---|
| A — Ölçüm ve veri kapsamı | Mevcut ölçümü paketli akışta tekrarla, seçili senaryo/kategori zamanlaması ekle, veri revizyonu/form alanı denetimi | Soğuk/sıcak süreler; bağımsız karakter beklentileri; sahiplik verisi değişmemiş |
| B — Paylaşılan model ve arama | Tek yetenek modeli, önhesaplama/önbellek, zorunlu çözüm adaylarını koruma, erken geçersizlik elemesi | Kötü takımın neden reddedildiğini gösteren fixture; seçili sonuçta hız hedefi ve doğruluk regresyonları |
| C — Gerçek eylem/hasar kontrolü | Tur sırası, form geçişi, tekrar kullanım, karşı saldırı/ölüm ve bariyer/slot/ileri yetenek koşulları | Marco, Luffytaro ve Crocodile örneklerinde gerekli etkilerin gerçek başlangıç durumunda çalışması; bilinen ölüm yollarının reddi |
| D — Veri girişi | Doğrulanmış internet rehberi adaptörü + toplu fotoğraf + eksik satır tamamlama; aynı Encounter modeli | Aynı bossun kaynak/metin/fotoğraf yolları aynı aşama/koşulu üretir; başka zorluk/seviye karışmaz |
| E — OCR maliyeti ve yayın | Gerekirse kalıcı OCR süreci, yalnız değişen bölge işleme; paketli karşılaştırma | Eski tüm okuma fixture'ları; yeni sayı/başlık çelişkileri; iptal/zaman sınırı; kullanıcı verisi ve kısayol korunmuş |

Rumble/GP yeniden yazımı bu PvE değişikliğinin içine alınmaz; mevcut kurallar, hasar ve kadro regresyonları yayın kapısında çalışır. Yeni PvE modelinin ortak stat/kimlik veri hazırlığı yararlıysa sonradan ayrı ölçümle paylaşılır.

Kalite kapısı: giriş koşullarına aykırı ekip sıfır; bilinen zorunlu engeli aşamayan ekibi hazır diye gösterme sıfır; bilinen ölüm yoluna hazır öneri sıfır. Support hedef/kimlik çakışması ve combined başlangıç varsayımı sıfır. Eksik veri nedeniyle çözülemeyen ekip, eksik alanı ve mümkün düzeltmeyi açıklar. Test beklentileri aynı parser'dan türetilmez; oyundaki metin ve bağımsız sayısal örneklerle yazılır.

## 9. Uygulama kaydı — v0.5.35 (21 Ekim 2026)

Uygulandı: seçili senaryo için parça parça worker işleri ve önizleme; sınırlandırılmış paylaşımlı parser/eşleşme önbellekleri; zorunlu mekanik çözücülerini aramada koruma; genel takım adaylarında gerçek special/cooldown değerlendirmeli hasar karşılaştırması; boss takımında zorunlu mekanik kapsamını hasar bonuslarından önce sıralama; çözülemeyen captain/special koşullarını denetim listesinde gösterme. Dual kartlar kayıtlı/varsayılan başlangıç formunda kalır. Bu, sınırlı arama ve ortak kıyas senaryosudur; evrensel optimum veya tam savaş simülatörü değildir.

Boss girişi: GameWith'in yazılı aksiyon tabloları önbellekten/URL'den okunur, Global görev ve zorluk kullanıcıca eşleştirilir, çevrilmeyen mekanik metni korunur. Fotoğrafları toplu yükleme/yapıştırma; düzenlenebilir OCR, Battle/tetik atama, REQUIREMENT onayı, PKA Lv. aralığı, tüm listeyi gözden geçirme işareti ve profil içindeki kaynak görsel kaydı eklendi. MuMu OCR'ı ve eski sayı/başlık/kaydırma korumaları duruyor; aynı pikselin tekrarı için sınırlı geçici cache eklendi.

21 Ekim doğrulaması: testler 302 geçti, 1 atlandı; TypeScript ve Vite build geçti. Kaynak ve paket UI testleri kopya 693 karakterlik profil üzerinde geçti: genel güç senaryosunda ilk aday 3,8/4,4 sn, son sonuç 10,8/12,9 sn; cache'li sekme değişiminin DOM güncellemesi 1,3/1,8 ms. Gizli test penceresinde iki animation frame 1,7–2,0 sn sürdüğünden bu süre uygulama hesaplaması olarak ölçülmedi. Fotoğraf OCR/PKA aralığı, GameWith eşleştirme onayı ve profilin değişmemesi doğrulandı. Paket worker'ı 11 mevcut OCR/kimlik/kaydırma guard'ını geçti. Paketli Marco 10★ testi üç senaryoda geçti; Lv.100 evrimsiz ve evrimli takım Battle 4'e başlangıç formundan en az 5 tur DEF Up ve Threshold giderme koydu. Mevcut hâl eksik taslak; geliştirme hedefleri tam kazanım olarak doğrulanmadı. Bu gerçek oyun zaferi testi değildir.

Kalanlar: paketli soğuk/sıcak p50/p95 ve bellek için beş tekrar; genel hasar sırası bilinmeyen düşman tipi/orbları olan ortak senaryoda; internet rehberlerinin tüm Global görevleri kapsaması, GameWith yaş/geçerlilik kontrolü ve E9 toplu aktarımı; tüm karakter yeteneklerini ve her boss'ta ölüm yollarını simüle etme; 13 kategori/karşılaştırmalı en iyi kadro için kapsamlı benchmark. Kullanılabilir olmayan tetik, HP/poison/Perfect, orb ve gelişmiş yetenek durumlarının hepsi modellenmiş değil. Kalıcı OCR süreci veya video/marquee burst yakalama eklenmedi. Bilinmeyenleri bilinmiyor tut. Planın 5 sn ilk sonuç / 300 ms cache / 20 sn derin arama hedefleri yalnız seçili genel power işi için tek paket koşusunda ölçüldü; beş koşu yüzdelik veya boss/kategori garantisi değildir.

Karakter verisi upstream OPTC Database revision `dca801e642c394d631c906350f2b23f394136fe9` (2026-10-16). Rumble/Grand Party solver bu PvE değişikliğinde yeniden yazılmadı. Hiçbir kadro için kazanma garantisi verilmez.

### Rumble Rules follow-up — v0.5.36 (2026-10-21)

User reported `rumble:readRules` stopped at Block B and the reader was moving too far to recognize the block. The path-specific production log confirmed the failure at `rumble-rules.cjs` after five independent screenshots. The reader performed a 38%-height swipe (82%→44%) per attempt and never joined pages; a short block heading could leave the viewport before its ending text became visible. Current MuMu was on a Pirate King Adventure result modal during the fix, so no live game input was sent.

Changed Rumble Rules to a 12%-height, 450 ms swipe, up to ten observations, and stop immediately if a previously visible target heading leaves the viewport. It reports an explicit retry error instead of continuing blind scrolling. Regression test failed on old behavior, then passed for a Block B section completed after one small swipe and for stopping after a lost heading. Focused Rules suite 13/13; full suite 304 passed, 1 skipped; TypeScript/Vite passed. v0.5.36 packaged byte-for-byte (59 verified files), packaged worker reproduced Block B with the small swipe, all existing 11 OCR guards passed, and the cloned test profile remained unchanged. Live MuMu Rules re-read remains unverified because the emulator showed a PKA result screen.

Bu belgede yeni bir takımın oyunda kazanacağı veya tüm yeteneklerin şimdiden modellendiği iddia edilmiyor. İnternet kaynaklarının tüm Global görevlerini kapsaması, E9 toplu aktarımı ve hedef sürelerin gerçekleşmesi uygulama sırasında doğrulanacak.

## 10. Assault Rumble — canlı ekrana dayalı uygulama planı (27 Ekim 2026)

Durum: aşağıdaki planın Rules / INFO okuma ve aday kadro oluşturma akışı v0.5.54'te uygulandı. Tam rakip kadrosu, kesin Assault Score ve hareket / sağkalım simülasyonu henüz tamam değil; sonuçlar bu sınırlarla aday olarak gösteriliyor. Son uygulama ve ölçüm kanıtları bölüm 10.7'de tutulur. İnceleme ve uygulamada savaş başlatılmadı, oyun kadrosu düzenlenmedi.

### 10.1. Doğrulanan ihtiyaç ve mevcut açıklar

MuMu `127.0.0.1:16384`, 900×1600: Assault Rumble ana ekranı, Assault Lv.1. Rules, Help, boss INFO ve SETUP pencereleri incelendi. SETUP beş ana + en fazla üç yedek, toplam 300 maliyet ve sekiz kayıtlı takım alanı gösteriyor. Bunlar Grand Party'nin üç takımı ve ortak lideriyle aynı yapı sayılmayacak.

Rules panelinde görülen mevcut kurallar:

| Kapsam | Gelen hasar artışı | Gelen hasar azalışı |
| --- | --- | --- |
| Shanks boss takımı | QCK %30; Driven %30 | DEX %30 |
| Hancock boss takımı | QCK %30; Striker %30 | DEX %30 |
| Mihawk boss takımı | QCK %30; Driven %30 | DEX %30 |
| Bütün boss takımları | [Giant] / [World Government] %40; [Domi Reversi] %20 | — |

Son 30 saniyede Special CT Speed / Damage Up var; büyüklük yazmıyor. Aynı karakterin birden fazla bonusu karşılaması halinde toplama/çarpma ve etiket grubunun eşleşme kuralları bu panelden tek başına kesinleşmiyor. Kuralları ayrı maddeler olarak sakla; %30 + %30'u kanıtsız biçimde %60 veya ×1,69 yapma.

Help doğrulamaları: Damage Score toplam verilen hasardan, Life Score kalan ekip HP'sinden türetiliyor; Life Score Assault seviyesine göre değişiyor. Assault Lv., Defeat ve Trusty bonusları var. Her boss için en yüksek Assault Score toplamı Total Score'u oluşturuyor. MAX seviyede bütün düşmanları Break durumuna sokmak ve süre bitene kadar hasara devam etmek gerekiyor. Tam sayısal puan dönüşümü / yuvarlama henüz doğrulanmadı.

Trusty listesi mevcut ekranda ×1,4 ve ×1,15 **sahip olma** bonusları gösteriyor. Help de sadece sahip olmanın yeterli olduğunu doğruluyor. Bu bonus uğruna zayıf kartı aktif/yedek kadroya yerleştirme. Kesin kart ID'si, form kapsamı, birden fazla Trusty'nin birleşmesi ve oyunun toplam çarpanı ayrıca doğrulanacak; her kopyayı ayrı bonus sayma.

Kod bulguları:

- `electron/rumble-rules-core.cjs` ve `src/rumble-rules.ts` yalnız Block A/B/C, Championship, Exhibition tanıyor. Assault metni mevcut modele zorlanamaz.
- `electron/rumble-rules.cjs` normal Rules → Underway yolunu ve en fazla on sayfayı kullanıyor. Assault'un Special Rules Effect penceresi için ayrı, tamamlanma kanıtına dayalı okuyucu gerekiyor.
- `src/rumble-planner.ts` bilinmeyen mod koşullarını puanlamıyor. `Assault Rumble` koşulları bugün bu yüzden dışarıda. Mevcut saldırı indeksi rakip ve gerçek savaş hareketlerini simüle etmiyor; Assault Score olarak gösterilemez.
- Veri paketinde 5.087 ünite, 4.655 Rumble kaydı ve Rumble verisinde Assault Rumble ifadesi bulunan 88 ünite var. Veri revizyon tarihi 16 Ekim; ekranda görülen yeni boss / Trusty formlarını pakette var kabul etme.
- Boss INFO'daki special / ability / behavior / target priority / resistance satırlarında DETAILS düğmeleri var. Special DETAILS, **sabit ve seviyelere ayrılmış** metin açıyor: mevcut örnek Shanks, special Lv.1 / CT29; Lv.2 ayrı bir sonraki bölüm. Seviye başlıklarını birbirine katmak veya on seviyenin hepsini taramak gereksiz ve yanlış.

### 10.2. Kullanıcı akışı ve veri sınırları

Pirate Rumble bölümüne ayrı **Assault Rumble** sekmesi ekle. Normal hücum/savunma ayarlarını koru; Assault'un hedefi ve kuralları ayrı olsun. Kullanıcı MuMu ana ekranında tek düğmeye bassın: **Kuralları oku ve kadro kur**. Sistem Rules'u, gereken boss INFO / DETAILS alanlarını açsın, SETUP sınırlarını doğrulasın, kaynakları alsın ve başlangıç ekranına dönsün. CHALLENGE, Auto Edit, Select All, karakter değiştirme veya güçlendirme işlemi yapılmasın.

Varsayılan sonuç seçili boss için; Shanks / Hancock / Mihawk arasında geçiş ve bütün bossları hesaplatma seçeneği olsun. Her boss kendi kuralları ve gözlenen Assault seviyesiyle değerlendirilir. Aynı karakterin farklı boss denemelerinde kullanılmasını Grand Party gibi kendiliğinden yasaklama; bir denemedeki kimlik / kart kopyası / VS tarafı çakışmalarını koru. Oyunun çapraz boss kullanım kısıtı bulunursa onu açık veriye dönüştür.

Küçük, doğrulanan bir `AssaultContext` modeli ekle: mod ve Global bağlamı; etkinlik kimliği / normalize kural parmak izi; seçili boss ve Assault seviyesi; bosslara ait hedefli yüzde maddeleri; son süre kuralı; Trusty sahiplik maddeleri; limitler; rakip gözlemi; ham metin / görüntü referansı / kaynak tarihi; alan bazında tamamlanma ve belirsizlik. Assault seviyesi, karakter seviyesi ve ability/special seviyeleri ayrı alanlar olsun. Paneldeki üç gün sayacından kesin etkinlik tarihi üretme.

Rules tamamen okunmadan **kurala göre doğrulanmış** sonuç üretme. Okunan kurallarla aday kurulabilirken rakip ayrıntısı eksikse adayın eksik alanını göster; HP/DEF/direnç bilinmiyorsa kesin hasar, galibiyet veya tam Assault Score verme. İptal / hata, son başarılı veriyi silmesin; eski sonucu güncel diye göstermesin.

### 10.3. Hızlı ve güvenilir okuma

1. Önce mod, pencere başlığı, boss ve level bölgesini doğrula. Her input öncesi Global OPTC ve beklenen ekranı kontrol et. Rules ana ekrandan veya açık Rules penceresinden başlayabilsin.
2. Statik Rules panelini tek kırpımda oku. Metnin başı, sonu ve sayısal maddeler tamamlanıyorsa kaydırma yapma. Uzun metinde gerçek scrollbar / son bölüm ve örtüşme kanıtıyla ilerle; sabit toplam süre, kare veya sayfa sınırı ekleme. İptal ve tek ADB/OCR isteğinin kilitlenme korumasını koru.
3. Metni sayı / işaret / hedef / kapsam maddelerine ayır. Satır sonundaki etiketleri birleştir; her yüzdeyi doğru boss ve hasarın yönüyle ilişkilendir. Görünür mürekkebi olmayan kelime kutusu veya sayısal şüphe varsa yalnız ilgili satırı bağımsız yerel okuyucuyla tekrar oku. Yeni bağımlılık / bulut OCR gerekmez.
4. INFO'da önce DETAILS aç; gerçek seçili skill seviyesinin bölümünü oku. Sonraki Lv. başlığı bölüm sınırıdır. Ability, behavior pattern, target priority ve resistance için aynı yolu izle. Special / Super Special sekmelerini ve mevcut açılma koşullarını ayır. Başka açık pencereye kör Back basma.
5. Yalnız sabit ayrıntı penceresi olmayan gerçek kayan satırda mevcut ortak piksel birleştirmeyi kullan; gerekli `readOCR` ve bağımsız `readLineOCR` bağımlılıklarını fabrika düzeyinde sağla. Tamamlanan pikselleri tekrar tekrar OCR'a gönderme.
6. Aynı etkinliğin kuralları / değişmeyen kart ayrıntıları önbelleğe alınsın. Boss / seviye değiştiğinde ilgili rakip bağlamı yenilensin. Gelişim sekmesi veya filtre değişince bütün ekranlar yeniden okutulmasın. Önbellek anahtarı mod, etkinlik kuralları, boss, seviye, veri revizyonu ve ilgili kutu değerlerini kapsasın; devam eden aynı okuma tek işte birleştirilsin. Yeni hesap öncesi hafif ekran / kural kimliği kontrolü eski etkinliği engellesin.

Gerçek örnek: Rules kırpımı ilk OCR'da 1.315 ms sürdü, ancak görünür **40%** tamamen atlandı. Bağımsız ilk tam satır denemesi önceki satırın mürekkebi nedeniyle `040%` üretti; fiziksel rakam alanının doğru sınır ve boşlukla okunması `40%` verdi. Bu, mevcut otomatik toparlamanın zaten tamam olduğu anlamına gelmez. Uygulamada elle sabit koordinat verilmeden eksik mürekkep alanının bulunması ve iki okuyucunun tutarlı sayıya ulaşması test edilecek. Tek hızlı OCR çıktısı güven kapısı değildir.

### 10.4. Assault'a göre takım seçimi

Mevcut `makeRumbleContext` / aday oluşturma / worker altyapısını genişlet; ikinci bir karakter veri sistemi kurma. Mod ve rakip bilgisi açık değerlendirme bağlamı olsun; varsayılan normal Rumble davranışı değişmesin. `rumbleCondition`, hedef seçimi, direnç, EX/Super Special ve zaman koşullarına bu bağlamı taşı. Grand Party çağrıları da aynı imza değişikliğinin gerileme kontrollerine dahil olsun.

- Rumble ability, normal special, LLB ile açılan doğru kayıt, Super Special tetikleri ve gerçekten sağlanan Assault-only etkileri değerlendir. PvE captain / PvE Support / VS etkisi / Last Tap, Rumble etkisi yerine geçmesin; VS kartının kullanılabilir Rumble tarafı ve tek fiziksel kart kimliği ayrı korunsun.
- Zarar veren çekirdek, ona ulaşan ATK/CT desteği, DEF düşürme ve direnç aşma, gerçek iyileştirme / korunma birlikte seçilsin. HP kesme ve DoT doğrudan bitiriciyle aynı sayılmasın; Shanks örneğindeki yüzde hasar direnci gibi rakip verisi katsayılara etki etsin.
- Kısmi aday puanlamasında gerekli koşullu taşıyıcı / destekler korunmalı; yalnız ham ATK veya Combat Power'a göre ilk birkaç kartı tutmak yasak. Tip, sınıf, etiket ve farklı hasar rolü adayları yeterli çeşitlilikle saklansın. Bonus almayan fakat bütün ekibin CT'sini / sağkalımını iyileştiren üye erkenden elenmesin.
- Beş aktif ve en fazla üç yedek birlikte optimize edilsin. Yedek başlangıçta aktif buff vermesin. Giriş tetiği, kompozisyon sayacı, sub değiştiren special, yedek sırası ve maliyet ayrı hesaplansın. Emir / pozisyon / yedek sırası önemli sonuçlar için sırasız ID kümesi önbellek anahtarı olmasın.
- **İlerleme:** mevcut seviyede bütün düşmanları yenebilme, süre ve kalan HP. **MAX skor:** Break sonrası hasar devamı, toplam hasar, kalan HP ve Defeat koşulu. Boss HP'sine ulaşınca MAX hasarını kesme; son 30 saniye kuralını sayısal büyüklüğü bilinmeden uydurma buffla büyütme.
- Trusty sahiplik çarpanı bir denemede adaylar arasında sabitse sıralamayı değiştirmez. Ayrı açıklansın; bonus kartı kadroya mecbur etme. Damage + Life → Assault Score dönüşümü, bonusların birleşmesi ve yuvarlama doğrulanmadan kesin puan üretme. Önce hasar / sağkalım açısından baskın olmayan birkaç aday göster; doğrulanmış formül gelince gerçek toplam hedefi sırala. Birleşme belirsizliğinde alternatif yorumlara duyarlılığı raporla.
- Kutudaki mevcut durum, aynı formda tam geliştirme ve evrimli geliştirme senaryoları korunsun. Bilinmeyen mevcut ability/special/EX seviyeleri maksimum kabul edilmesin; gereken geliştirmeler sonuçta ayrı gösterilsin.

Çıktı: boss / Assault seviyesi / okunan bonuslar; beş aktif ve sıralı yedekler; maliyet; her seçimin hasar ve destek gerekçesi; uygulanan / uygulanmayan koşullar; risk ve eksikler. Normal Rumble special'ları otomatik çalışıyorsa elle saniye saniye basma talimatı üretme. Kullanıcının gerçekten kontrol ettiği sıra veya aktif Super Special varsa, doğrulanan tetik / zaman penceresini açıkla; hareket ve CT simülasyonu yokken kesin saniye iddia etme.

### 10.5. Uygulama sırası, dosyalar ve doğrulama

| Sıra | Teslim | Başlıca temas noktaları | Kabul kanıtı |
| --- | --- | --- | --- |
| 1 | Bağlam / parser / Rules okuyucu | Yeni `src/assault-rumble.ts`, `electron/assault-rumble-core.cjs`, `electron/assault-rumble.cjs`; `main.cjs`, `preload.cjs`, `storage.ts` köprüsü | Gerçek Rules resmi bütün boss maddelerini, %40 ve son 30 saniyeyi eksiksiz çıkarır; normal Rumble verisini kabul etmez; açık modal / iptal / geri dönüş çalışır |
| 2 | Boss ve kaynak tamamlama | INFO / DETAILS state machine, mevcut OCR / recognition / katalog / kaynak yardımcıları | Seçili Lv.1 metnine Lv.2/10 etkisi karışmaz; Shanks karakter INFO verisi bütün rakip takımı olmuş gibi sunulmaz; eksik boss / Trusty ID'si uydurulmaz |
| 3 | Takım motoru | `rumble-planner.ts`, `planning.ts`, `planning-jobs.ts`, gerekiyorsa ayrı Assault worker işi | Aynı kutu üç boss için farklı hedef kurallarını uygular; mode-only etkiler yalnız Assault'ta açılır; maliyet / kopya / form / yedek koşulları korunur; ilerleme ve MAX hedefleri ayrılır |
| 4 | Kullanıcı ekranı | Mevcut Rumble girişinde ayrı sekme; küçük `AssaultRumblePage.tsx`; sonuç / iptal bileşenleri | Tek tıkla okuma → hesap → gerekçeli sonuç; gelişim sekmesi değişimi tekrar tam OCR başlatmaz; eski işin cevabı yeni bossu ezmez |
| 5 | Paket ve performans | Gerçek crop fixture'ları, odaklı testler, ayrı profilde paketli Electron testi | Aşağıdaki hız / doğruluk ölçümleri ve gerçek MuMu okuması; kutu / ayar / Kizuna / boss kayıtları değişmeden kalır |

Bir kaynak bilgisi eksikse uygulama kullanıcıya link aratmasın: önce tam kart ID'si / formu / Global / etkinlik / seviye eşleşen yerel kaynak, gerekirse mevcut izinli kaynak mekanizmasıyla otomatik internet tamamlama. İnternet metni güncel Rules'un yerine geçmesin. Aynı isimli başka kartı veya yeni boss için eski etkinlik profilini kullanma. Kaynaklar çelişirse eksik alanı açık tut.

Gerekli regresyonlar: üç bossun kurallarını karıştırma; yüzde Up/Down yönü; tek karakterde birden fazla eşleşme; bir satırda eksik %40; kesilmiş etiket / kapanış; 100/400 gibi bozuk yüzde; yanlış ekran veya okuma sırasında boss/seviye değişimi; uzun fakat ilerleyen okuma; iptal sonrası temiz yeni iş; Trusty sahipliği ve kopya; aynı kaynağın çift sayılmaması; normal Rumble / Grand Party'de Assault etkisinin kapanması; boss direnci / sınıf hedefi; Lv.1-Lv.2 ayrımı; koşullu hasar kaynağının aday havuzunda kalması; yedek sırası ve giriş tetiği; MAX Break hasarı; başlangıçta hiç hasar special'ı olmayan destek döngüsünün yanlış öne çıkmaması.

Hız hedefleri, uygulanmış sonuç değildir: sıcak önbellekte kural kontrolü ve ilk sonuç yaklaşık 1 saniye; soğuk Rules + seçili boss ayrıntısı 5–15 saniye, ilk hesap sonucu 5 saniye içinde, daha derin arama 20 saniyelik ayrı hesap bütçesinde. **Hesap bütçesi okuma kesme sınırı değildir.** Önce seçili boss ve gelişimi hesapla; kalan bosslar istenince veya ilk sonuçtan sonra düşük öncelikte. İşleri iptal edilebilir tut; aday profili / hedef üyeliği / efekt ayrıştırması bir kez, ucuz eleme → çeşitli beam adayları → finalist doğrulaması sırasıyla çalışsın. Bütün evrim ve üç boss kombinasyonlarını başlangıçta körlemesine tarama.

En az beş soğuk ve beş sıcak paketli koşuda p50/p95, yakalama sayısı, OCR sayısı, okuma / aday hazırlama / arama süreleri ve tepe bellek ölçülsün. Hedef süreyi doğruluk uğruna geçmişse gerçek süreyi göster; eksik metni tamamlanmış sayma. Aynı bağlamda daha derin arama önceki en iyi geçerli sonucu korusun. Son doğrulama gerçek MuMu akışı ve paketli IPC/worker üzerinden yapılsın; parser testi tek başına yeterli değil.

### 10.6. Bu planın kanıtları ve açık noktaları

Kanıtlar `.local/assault-rumble-plan/`: `current.png`, `rules-top.png`, `rules-trusty.png`, `rules-ocr.json`, `rules-numeric-line.json`, `rules-numeric-recovery.json`, `help-*.png`, `info-top.png`, `info-special-details.png`, `setup-settled.png`, `catalog-audit.json`, `rumble-baseline.log`. İnceleme sonunda MuMu ana ekrana geri bırakıldı. Bunlar yerel inceleme dosyalarıdır; tam ekranlar hesap bilgisi içerdiği için dağıtılan test fixture'ı olarak kullanılmaz, önce yalnız gerekli bölge kırpılır.

İlk planlama aşamasındaki normal Rules / saldırı motoru temel kontrolü: `npx tsx --test tests/rumble-rules.test.ts tests/rumble-offense.test.ts` → 24/24 geçti. O aşamada sadece plan / handoff belgeleri güncellenmişti. Sonraki uygulamanın doğrulaması aşağıda ayrıca kayıtlıdır; bu kontroller oyun içinde kazanılacağı anlamına gelmez.

Resmî karakter kaynağı, Assault'a özgü special / Super Special dallarının varlığını ayrıca destekliyor: [Bandai Namco — Brook / Franky / Jinbe](https://optc-ww.channel.or.jp/news/2549/). Mevcut etkinlik kurallarının birinci kaynağı kullanıcının açık Global oyun ekranıdır. Henüz kesinleşmeyenler: bonus birleştirme, tam Score katsayıları / yuvarlama, bütün üç bossun gerçek kadrosu ve seviye ölçeklemesi, Trusty kart kimlikleri / form kapsamı, Super Special'ın mevcut kullanıcı kontrolü ve tüm konum / hareket fiziği. Bunlar uygulamanın açık veri alanları ve doğrulama işleri olarak kalacak.

### 10.7. Uygulanan kapsam ve doğrulama (v0.5.54)

- Pirate Rumble → Assault Rumble sekmesi, tek düğmeyle Rules / Trusty / seçili INFO / beş sabit DETAILS / SETUP okuması ve worker hesabı eklendi. Okuma toplam süre, kare veya sayfa sayısıyla kesilmiyor; iptal ve kilitlenen tek işlem koruması var. Açık tanınan modalden toparlanabiliyor; Global paket ve taze ekran kontrolü her oyuna girişten önce uygulanıyor. Hareket listesinde savaş veya takım düzenleme işlemi yok.
- Rules parser'ı bütün boss, hedef, yüzde ve yön maddelerini tamamlanmış olarak istiyor. Gerçek görüntüde atlanan %40, bağımsız satır ve sayısal kırpım uyuşmasıyla kurtarılıyor. Sabit DETAILS'te altın seviye başlıkları fiziksel sınır veriyor; Lv.1'e Lv.2 metni katılmıyor. RGBA ters çevirmenin alfa kanalını bozması gerçek fixture ile giderildi. Tam hesap ekranları dağıtılmıyor; test fixture'ları yalnız gereken alanı içeriyor.
- Şu an okunan Shanks NPC'si Free Spirit / Cerebral; koleksiyon kartının Slasher sınıfı veya INT tipi kopyalanmıyor. INFO HP6357, DEF155, SPD205, RCV479 bağımsız doğrulandı; ATK ve tip doğrulanmadığı için boş. Seçili A1/S1 metinleri, standart %85 yüzde hasarı direnci ve bağışıklıklar kullanılıyor; kilitli ek direnç uygulanmıyor. DoT bağışıklığı DoT puanını ve katkı işaretini kapatıyor, aynı special'in doğrudan hasarı korunuyor. Free Spirit gibi özel boss hedefleri eşleşen aktif/yedekler için görünür risk uyarısı veriyor; bu uyarı sayısal gelen hasar / sağkalım simülasyonu değildir.
- Ortak Rumble aday / form / maliyet / yedek motoru açık Assault bağlamıyla kullanılıyor. Diğer Rumble / Grand Party yollarına Assault etkileri sızmıyor. Bonusların alt yorumu ana arama, üst yorumu ayrıca alternatif arama; farklı kadrolar ve belirsizlik aralığı gösteriliyor. Önce geçerli beşli, sonra yedek ve alternatif sonuç gelir. Mevcut / aynı form geliştirme / evrimli geliştirme; boss, kategori ve hedef kontrolleri aynı okumayı yeniden başlatmaz. Sonuç önbelleği kutu / kaynak / hedef değişimiyle geçersizleşir. İptal sonrası eski yanıt yeni işi ezmez; okuma hatası eski sonucu güncellik uyarısıyla korur.
- Trusty kadro zorunluluğu yapılmıyor. Mevcut yeni ikonlar tam ID ile doğrulanamadığından toplam bonus uydurulmuyor. Hancock / Mihawk seçeneği kendi Rules maddelerini kullanıyor; INFO okunmadıysa seviyesi ve rakip ayrıntıları eksik olarak gösteriliyor. Üç bossun her birinin tam rakip kadrosu, kesin skor katsayıları, bütün hareket / Super Special tetikleri ve NPC'ye karşı sayısal sağkalım hâlâ açık. Yerel kart metni NPC'nin yerine geçirilmez; doğrulanmamış internet metni de güncel Rules yerine kullanılamaz.
- Kaynak doğrulaması: `tests-release-final.log` → 496 test, 495 başarılı / 1 mevcut atlanan / 0 hata; `build-release-final.log` → TS / Vite başarılı. Paketli 75 kaynak / veri / varlık dosyası ve manifest kaynakla eşleşir. Gerçek SQLite profili 818 kutu kaydı, 10 boss, ayar ve Kizuna dahil başlangıç anlık görüntüsüyle birebir karşılaştırılır. Son paketli arayüz / canlı MuMu ve ölçüm raporları `.local/assault-v54/` altında tutulur; bunlar özel yerel QA dosyalarıdır.

Son paketli kaynak ve arayüz testleri (`ui-source-final.log`, `ui-packaged-final.log`) gerçek worker ile üç bossu, tekrar OCR yapılmayan filtre / senaryoları, eski iptal cevabının atılmasını, hatada önceki sonucun korunmasını, mod ayrımını, DoT bağışıklığını ve görünür sınıf hedefi uyarısını geçti. `native-ui-final.log` / `native-ui-result.json`, gerçek MuMu → paketli IPC / OCR → arayüz / worker zincirini geçti. MuMu ana ekrana döndü; uygulama önerilen kadroda açık. Masaüstü kısayolu v0.5.54'e güncellendi.

Gerçek818 kayıtlı kutuyla ölçülen son süreler:

| Ölçüm | Örnek | p50 | p95 |
| --- | --- | --- | --- |
| Yeni worker: ilk geçerli beşli | 5 | 5,579 sn | 5,994 sn |
| Yeni worker: yedek / alternatif araması dahil | 5 | 15,098 sn | 15,727 sn |
| Aynı kutu / kurallarda önbellekli UI senaryo geçişi | 5 | 78,8 ms | 155,5 ms |

p50/p95 en yakın sıra yöntemiyle, beş ölçüm üzerinden hesaplandı. Son gerçek tek tık tam okuma + hesap **98,276 sn** sürdü; o akışın okuma sonrası ilk worker adayı2,779 sn, bitişi14,831 sn. Beş worker ölçümü beş ayrı soğuk tam rehber okuması değildir. **Tam okumanın5–15 sn hedefi ve beş yeni worker'ın5 sn p95 ilk-aday hedefi karşılanmadı.** Okuma / yakalama / OCR çağrı sayıları bu son paketli akışta ayrıca enstrümante edilmedi; aşama ilerlemeleri ve bütün süreler kaydedildi. Süre kazanımı için doğrulama kapısı gevşetilmedi veya toplam okuma sınırı eklenmedi. Electron süreç başına tepe working set: Browser417,6 MiB, Tab395,7 MiB; bunlar aynı anda ölçülmüş toplam tepe bellek değildir.

Kalan işler: tüm NPC takımını / seviye ölçeklemesini ve sayısal gelen hasarı doğrulamak, kesin Score / bonus birleşimi ve yeni Trusty formlarını kaynakla tamamlamak, tam okuma darboğazlarını ayrı ölçmek. Mevcut teslim bu açıkları belirten kurala dayalı aday üretimidir; bütün plan hedeflerinin veya kazanacak takımın tamamlandığı iddiası değildir.

## 11. Pirate King Adventures — ayrı bölüm (v0.5.55)

PKA, sol menüde ayrı **Pirate King Adventures** bölümü olarak uygulanır. Bir düğmeyle güncel Global duyurusu ve MuMu’daki hedef seviyenin Quest Guide’ı alınır, ortak PvE worker’ıyla kutudan adaylar kurulur. Seviye, ilerleme / ek drop önceliği, açık Bonus Hex durumu, tip / sınıf ve üç gelişim senaryosu ayrı seçilir. Aynı rehber aralığındaki değişiklikler yeniden OCR başlatmaz. Manuel iptal, eski cevapların atılması, başarısız okumada eski sonucun güncellik uyarısıyla korunması ve cihaz değişiminde bağlamın geçersizleşmesi vardır.

Güncel kaynak [Global PKA Vs. Mr. Ya duyurusu](https://e9wiki.com/optc/en/notices/14779), Türkiye saatiyle 27 Ekim 2026 06:00 – 22 Kasım 2026 16:59 dönemidir. Sekiz gruptaki 39 kart tam No. ile eşleşir; isim benzerliğinden kart seçilmez. Stat / başlangıç CD / kadro ek drop / olasılık / sahiplik Hime / koşullu Bonus Hex / DLB ayrı alanlardır. Ek drop, bütün ödülleri çoğaltan çarpan değildir. Aynı evrim ağacında bilinen sahiplik bir kez sayılır; satılmış kartların eksik geçmişi toplam sahiplikmiş gibi sunulmaz. Kaynak önbelleğinin parmak izi, ID türetmesi ve dönemi doğrulanır; iptal edilmiş eski istek yeni kaydı ezemez.

PKA statları ve başlangıç CD’si mevcut savaş hesabına taşınır; normal Boss Planı / Kizuna / Rumble’a sızmaz. Pozitif düz Support / sailor statlarına belirsiz ek çarpan verilmez; arkadaş kaptan, Buddy katsayıları ve DLB hasar tavanı doğrulanmadan eklenmez. Bonus Hex sadece kullanıcı haritada aktif olduğunu belirttiğinde uygulanır. Altı yeni kartın (4663–4668) yetenekleri katalogda yoktur; açıkça gösterilir ve bu kartlar yetenekleri uydurularak aday yapılmaz. PKA Rumble Hex normal Pirate Rumble Rules’u devralmaz; bu bölüm PvE görevini kapsar.

MuMu’da yalnız bilgiye erişilir: doğrulanan PKA ana ekranı → Edit Crew → GUIDE → QUEST GUIDE → hedef Lv. akordeonu. Savaş / Start Adventure / takım değiştirme / geliştirme yoktur. Seviye uçları iki yerel okumayla doğrulanır; açık sarı başlıkta kaybolan ilk 1 yalnız aynı kapalı başlıktan önceden alınan tam kanıtla taşınır. Bir, iki ve üç basamaklı aralıklar desteklenir. Toplam okuma süresi / kare / sayfa sınırı yoktur; iptal ve kilitlenen tek işlem korumaları sürer.

Gerçek görüntü regresyonları: farklı font rasterizasyonlarında atlanan **ATK %40 Down**, bağımsız satır / ikili görüntü ve farklı düzen çözümlemesiyle doğrulanır. Sayı kanıtı piksel birleştirme sonrasında da korunur; nihai `atkDown:1` gereksinimine ulaşması test edilir. Sağdan giren **99 turn** parçası sabit TURN başlığı değildir; gerçek başlık konumu gerekir. PKA da ortak hizalama ve önceki doğrulanmış satırları yeniden kullanır. Sadece scrollbar veya benzer metin hizalama kanıtı sayılmaz. Dağıtılan fixture’lar yalnız ilgili oyun rehberi alanlarını içerir; tam hesap görüntüleri özel `.local/pka-v55/` altında kalır.

Sınırlar: Lv.1–59 rehberinde kesin HP / ATK / temel DEF bulunmadığından galibiyet ve sağkalım doğrulanmaz. Blow Away konum / direnç çözümü modelde yoktur ve **eksik taslak** olarak görünür; uzaklaştırılan üyelerin altılı saldırı / special planı güvenli kabul edilmez. B1 / B2’nin listelenmeyen davranışları ve Lv.100+ Character Tag gibi koşullar uydurulmaz. Sonraki iş: bu kaynak eksiklerini otomatik tamamlamak, Blow Away’nin süre / konum / geri dönüş / direnç etkisini savaş durumuna katmak ve Buddy / DLB / arkadaş bonus kapsamını gerçek oyun kaynağıyla kesinleştirmek. Bunlar tamamlanmadan kazanacak kadro veya bütün PKA bonuslarının sayısal olarak modellendiği iddia edilemez.

Son doğrulama: 513 testte512 başarılı /1 mevcut atlanan /0 hata, TS / Vite başarılı. Nihai paket78 kaynak / veri / varlık ve manifest alanıyla eşleşir; gerçek profil818 kutu kaydı /10 boss, ayarlar ve Kizuna dahil değişmemiştir. Kaynak ve paketli Electron testleri gerçek worker, tek okuma sonrası senaryolar, seviye hata toparlaması, iptal yarışı, eski sonucu koruma ve mod ayrımını geçti. Gerçek paketli MuMu zinciri Mr. Ya Lv.1–59 için5sayfa /5aşama /7tam kayan satır okudu; nihai gereksinimde ATK Down1 korunur. Son tam oyun rehberi okuması + hesap70,341sn; okuma sonrası worker ilk aday4,126sn, tamamlanma12,297sn. İnternet etkinlik önbelleği sıcaktı; bunlar tek ölçümdür, beş soğuk deneme veya p95 değildir. Masaüstü kısayolu ve açık gerçek uygulama v0.5.55’e geçti. Kanıtlar `.local/pka-v55/` altında; ayrıntılı durum `docs/HANDOFF.md` başında.

### 11.1. Lv.79 takılması ve ana ekrandan başlama düzeltmesi (v0.5.56)

Kullanıcının gerçek Lv.79 okumasında `60 7 9'` başlığı 266 kare boyunca kayan satır kuyruğunda kaldı. Üstten kesilmiş turuncu başlıkta ok yönü genişlemeyi kanıtlamadığından `expanded=false` doğruydu; fakat aynı nedenle başlık içerik alanından çıkarılmıyordu. Başlığı genişlemiş varsaymak yerine fiziksel başlık alt sınırı hem metin çıkarımında hem piksel satırı keşfinde kullanılır. Ok kırpılmış olsa da turuncu bant sınırdır; görünür tam banttaki kimlik / iki okuyuculu seviye kontrolü ve doğrulanmış önceki sayfaya hizalama ayrı korunur. Gerçek kesilmiş Lv.60–79 görüntüsü, farklı üst kesimleri, yedi seviye bandı ve bir sonraki bant sınırını dışarıda tutma regresyonları eklendi.

Ana PKA ekranından başlarken görülen `PKA ana ekranı değişti` hatası da gerçek animasyon görüntüleriyle üretildi: eski kontrol8kareden5’ini tanıdı. Tam karede doğru görülen logo / stamina etiketi dar kırpımda kaybolunca geçerli kanıt atılıyordu; başlangıçta eksik stamina sözcüğü de kırpımla toparlanamıyordu. Aynı karedeki geçerli etiketler korunur, eksik etiketler sabit üç bölgede farklı ölçekte aranır; beş PKA işareti ve modal / Global paket / Edit Crew kontrolleri sürer. Farklı karelerin metni birleştirilmez. Yeni canlı örneklem8/8; eski hatalı üç animasyon karesi yalnız gereken bölgeleri içeren fixture’larla kapsanır.

Kaynak native Lv.79 okuması84,569sn’de beş aşamayı tamamladı. Aralık60–79; B3 Top-Row Bind3 ve Blow Away2, B4 DEF×20000/3tur ve99tur NAO, B5 Special Bind3 veATK%50Down3 korunur. Lv.1–59 mekanikleri bu seviyeye taşınmaz. Kaynak arayüz testi gerçek worker / senaryo / geçersiz seviye / iptal yarışı / önceki sonucu koruma / profil korumasını geçti. Son tam suite516test:515başarılı,1mevcut atlanan,0hata; TS/Vite başarılı. Paketli ana ekran → rehber → Lv.79 → worker zinciri ve son dağıtım kanıtları `.local/pka-v56/` altında; son durum handoff başına yazılır. Toplam okuma süresi / kare / sayfa sınırı eklenmedi. Önceki Blow Away / Buddy / DLB / eksik boss statı sınırları bu okuyucu düzeltmesinden bağımsız olarak devam eder.
