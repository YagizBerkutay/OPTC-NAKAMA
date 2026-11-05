# OPTC Nakama v0.5.65 — Okuma güvenilirliği ve Kizuna hedef doğrulama

v0.5.65, eksik kayan boss metninde normal Boss kadrosunu ve Kizuna onayını durdurur; eski kayıtlardaki eksik `textComplete` alanını uyumlu tutar. Kizuna hedef OCR’ında eksik alanlar aynı ekrandan sınırlı biçimde yeniden okunur; hedef kimliği veya tekrarlar arasında değişen sayılar birleştirilmez. Kasıtlı yıldız zorluğu değişiminde yeni varyantın hedef değerleri yeniden alınır. Süre ayrıştırma ondalık / birleşik sayıların içinden parça seçmez; Kizuna internet rehberi seçili Battle sayısıyla eşleşmelidir. İptal, etkin Kizuna OCR isteğine iletilir.

Kizuna’da **Kizuna’yı otomatik getir** düğmesi güncel Global etkinliğin duyurusunu E9 Wiki’nin oyun içi duyuru arşivinden kendisi bulur; bağlantı yazdırmaz. Etkinlik tarihleri, bonus grupları, kaynak kartların gerçek katalog numaraları ve genel kurallar alınır. MuMu’da Kizuna açıkken seçilen 7★ / 10★ / 13★ bilgi ekranını TIPS’e basılı tutarak açar; QUEST INFO ve BEHAVIOR listesini kendisi kaydırır. Hedef Lv., tam HP ve tip oyun ekranından alınır. İnternet kaynağı yoksa LIST / Trusty Characters için sınırlı ekran taraması denenir. Ayarlar ve okunan boss profili otomatik kaydedilir. 13★ bilgisi okunur; Super Boss kadro / katkı hesabı bu sürümün kapsamına eklenmemiştir.

Kizuna Clash sekmesi normal boss / SOS adaylarını ayrı etkinlik, varyant ve boss-Lv aralığıyla karşılaştırır. Rehber / fotoğraf kaynağından aşamalar alınır; sezon bonusları kesin kart ID'si, başlangıç formu ve arkadaş kapsamıyla doğrulanır. ATK/HP/RCV ve başlangıç cooldown bonusları, Battle 1'in hedefli cooldown indirimi ve ayrı bilet / Super kaynak çarpanları desteklenir. Bilinmeyen stat işlem sırası veya ödül formülü uydurulmaz. Üç geliştirme senaryosu korunur; ek stall turu varsayılmaz. Etkinlik ayarları kaydedilebilir ve plan dışa aktarılabilir.

Kizuna bonusları Trusty Characters / Special Effects fotoğraflarından veya MuMu’daki açık ekranın tek görüntüsünden okunabilir. PNG/JPEG/WebP dosyası seçme, bırakma ve Ctrl+V desteklenir. Kart ikonları mevcut portre indeksiyle, metindeki tam ID / tam katalog adıyla eşleştirilir; belirsiz kart için adla arayıp doğru versiyon seçilir. Okunan değerler bir kontrol sonrası topluca aktarılır; eksik / çelişen sayılar engellenir. Rehber seçilince hedef adı, kaynak, görünen Lv. aralığı, HP ve tip doldurulur. Elle düzenleme kapalı ayrıntı alanındadır. İnternet bonusları yalnız etkin duyurunun tarih aralığı ve kesin kart numarasıyla eşleşirse alınır. MuMu boss başlığı farklıysa kaynaklar birleştirilmez. Eksik kart numarası / koşul açıkça belirtilir. Tam Super Boss katkısı, yeni Damage Limit Break tavanı ve bütün ileri hasar yeteneklerinin yürütülmesi henüz yoktur. Gerçek Trusty Characters düzeninde ikonların üstündeki, satırlara bölünmüş açıklamalar kullanılır. “When on the crew” ve “When owned” ayrı tutulur; sahiplik bonusları kadroya girmesi gereken kartlar gibi değerlendirilmez ve henüz ödül hesabına eklenmeden kaynak bilgisi olarak saklanır. Görünmeyen bonuslar doğrulanmış sayılmaz. Stat işlem sırası veya ödül birleşmesi bilinmiyorsa ilgili toplam hesaplanmaz; görüntüden yalnız okunan değerleri almak bu kanıtın yerine geçmez. Uygulama bunları maksimum hasar veya garanti kazanma diye sunmaz. Desteklenmeyen rehber formatında fotoğraf yolu kullanılabilir; eksik başlık Battle 5 olarak tahmin edilmez. Büyük HP tam sayı metniyle korunur; mevcut motorun 10^15 üzerindeki HP'leri hesaplaması açıkça engellenir.

Tur / hasar sayıları çeliştiğinde, piksellerle konumu doğrulanmış satır iki görüntüde ayrı kırpılıp farklı ölçek ve kontrastlarla yeniden okunur. İki görüntüde en az ikişer okuma aynı değeri desteklemeli; sayıların kendi pikselleri de eşleşmelidir. Jinbe 9★’ta `DEF x450` değerinin `x050` okunması bu yolla düzeltilir. Belirsiz veya gerçekten farklı sayılar otomatik olarak kabul edilmez. Normal görevler ve PKA aynı sayısal doğrulama kullanır.

Kayan davranış yazısının ortasından başlandığında satırın başa dönüşü beklenir; metin başı ve devamı aynı fiziksel satırda izlenir. Sabit PREEMPTIVE etiketi, sağındaki kayan koşuldan ayrı okunur. Ace 11★ rehberinde OCR’ın atladığı mavi etiketler kendi çerçevelerinden ayrıca doğrulanır. Tekrarlanan dallar korunur; okunamayan parçalar eksik olarak gösterilir. Okuma toplam süre veya sayfa sınırına bağlanmaz; yeni piksel ve doğrulama ilerlemesi izlenir, iptal kullanılabilir. Devam eden ADB basılı tutma hareketi iptal sırasında kendi komutunun bitmesini bekleyebilir. Son sayfa birleştirmesinin iki görüntüsü ve konum kanıtı yerel loglara kaydedilir.

CP-9 10★ rehberinde ince yeşil STARTING STATE çerçeveleri ayrı OCR ile okunur; yalnız renk üzerinden tetik atanmaz. REQUIREMENT açıklaması daha uzun süre izlenir. `QCK/PSY characters only` gibi sonu “only” olan katılım koşulları ve aynı açıklamadaki rastgele Neo Ambush notu ayrı değerlendirilir. QCK / PSY kısıtlaması kaptan, üyeler, arkadaş kaptan ve evrim seçeneklerine uygulanır. Neo Ambush için okunmayan ek savaşın kazanılması doğrulanmış sayılmaz. Eksik / çelişkili karakter koşulları engellenmeye devam eder.

Normal uygulama boss sonucu, uyarılar, worker hatası / son adım, son görüntüler ve kadro düğmesinin engellenme nedenini yerel `logs` klasörüne kaydeder. Günlükler ve görüntüler sınırlı sayıda tutulur; otomatik yükleme yapılmaz. Boss sayfasındaki “Okuma kayıtlarını aç” düğmesi klasörü açar. Liste sonu doğrulanmadığında eksik okuma ekranda korunur ve kadro düğmesinin altında gerçek engellenme nedeni gösterilir.

Timing, Slot, Hit ve Damage bariyerleri ayrı okunur. PERFECT / GREAT / GOOD timing bariyerleri için özel kaldırıcı / slot karakteri aranmadan gerekli ilk vuruşlar planlanır; GREAT / GOOD zinciri ve yalnız PERFECT'lerde gelen Burn ayrı hesaplanır. Bariyer açan ilk saldırılar tam hasar olarak alt sınıra eklenmez; açan son vuruşun bonusu üst sınırda kalır.

Slot bariyerinde gerçek renk / RCV / TND ve gereken adet kontrol edilir; faydalı slot sayılması istenen slotu oluşturmuş sayılmaz. Kaynakta açık slot dönüştürme, sınıf / komşu / kendi slotu kapsamı, BLOCK izni, zehir iyileştirme ve sonraki dönüşüm sırası kontrol edilir. Gereken slotu veren special diğer slot değiştiricilerden sonra planlanır. Zayıf ama gerekli dönüştürücü aramanın 24 aday sınırından önce korunur. Okunmuş bariyer süresini kaldırma, koşulları doğrulanmış Super / EX ve switch, ayrıca uygun True Damage yolları değerlendirilir. Yeni turda slotlar kendiliğinden tekrar aynı sayılmaz; bariyer okunan süresince tekrar açılmalıdır. Kilit / bağlama, eksik adet / renk, kombo hit ve hasar eşiği bilinmiyorsa çözülmüş sayılmaz. [Slot bariyeri mekanikleri](https://xn--pck6bvfc.gamewith.jp/article/show/256866) · [Timing hesabı kaynak kodu](https://github.com/2Shankz/optc-db.github.io/blob/16d24d6827589fade73bbf03a0e072f15e0a6754/damage/js/cruncher.js).

Resilience ve uzun düşman savunmaları yalnız tur azaltmayla değerlendirilmez. Special hasarı, kaynaktaki True Damage / Normal Attack Only izinleri, ATK temeli, tur sonu hasarı ve bağışıklık yokken zehirle bitirme yolları ayrıca aranır. Düşman HP biliniyorsa yeterli asgari hasarla bitirme doğrulanabilir; bu, debuff kaldırma olarak kaydedilmez. HP okunmadıysa gereken hasar / sıra / bekleme koşulu açıkça gösterilir. Yetersiz special hasarının ardından normal saldırının Resilience'i kaldırdığı varsayılmaz.

Açık sonraki tur pencerelerinde kalan HP ve savunma süreleri taşınır; saklanan hazır special 1 HP'yi bitirebilir. Yenilince hasarı, ölüm, cooldown, special sınırı, NAO, yüzde hasarı / zehir bağışıklığı, canlanma ve birden fazla hedef kontrol edilir. Bitiren special'dan sonra yeni special / iyileştirme sayılmaz; kalkan önce kullanılmalıdır. Gunko (#4612) ve St. Peter & St. Warcury (#4577) gerçek kaynak special metinleriyle test edilir.

Clash okumalarında uzun görev adının yatay kayması görev değişikliği sayılmaz: görünen metin ölçülen konumlarıyla eşleştirilir, yıldız zorluğunun sabit pikselleri ayrıca doğrulanır. Aynı başlığın OCR tarafından `CP-O` veya `CP- O` şeklinde birleşik / ayrı kelimelerle okunması da aynı metin ve aynı sınırlar üzerinden doğrulanır; REQUIREMENT dönüşü ve kaydırma sırasında yanlış boss değişikliği hatası vermez. Başlığın yeniden girdiği kısa / boş görüntüler ve Quest Guide yükleme ekranı sınırlı süre beklenir; farklı boss, zorluk veya pencere kabul edilmez. PKA kendi sabit başlık ve seçili seviye aralığı kontrolünü kullanmaya devam eder.

Tam ekran OCR’ın kaçırdığı kırmızı REQUIREMENT yazısı, ölçülen kırmızı düğmenin mürekkebi ayrı okunarak bulunur. Yalnız doğrulanmış yazıya basılı tutulur; kayan açıklama birden fazla görüntüyle ve aynı göreve dönülerek kontrol edilir. Okunamayan koşullar kısıtlama yok şeklinde kabul edilmez. Koşul okuma alt adımları ilerleme göstergesine iletilir.

Tekrarlanan PREEMPTIVE / bağışıklık satırları konumu tek başına kanıtlamıyorsa aynı Battle numarasının sabit görüntü pikselleri ayrıca eşleştirilir. Tam, benzersiz ve gerçekten aynı görüntüyle doğrulanmış başlık bağımsız kaydırma kanıtı sağlar; boş görüntüler, kesik veya tekrarlanan başlıklar ve yalnız OCR metni kabul edilmez. Normal görevlerde kaydırma adımı büyütülürken sayfaların çoğu ortak kalır; uzun rehberlerde gereksiz tekrar okumalar azalır. PKA kaydırma adımı değişmez.

`Map Effect: Inferno Hell` gibi tutarlı okunan harita etkileri karakter katılım yasağı olarak değerlendirilmez; kadro oluşturma düğmesi çalışır. Mevcut, geliştirilmiş ve evrimli önerilerde harita etkisi açık uyarı olarak gösterilir. Harita hasarı / süresi / tetikleri açıklamada yoksa HP ve kazanma doğrulanmış sayılmaz. Önceki v0.5.22 kayıtları da yeniden tarama gerektirmeden aynı şekilde değerlendirilir. Eksik / çelişkili karakter kuralları kadro oluşturmayı durdurmaya devam eder.

Support seçimi kendi kaptanın, dört üyen ve diğer Supportlarla ortak karakter kimliklerini engeller. Law & Bepo kadrodayken farklı Law veya Bepo kartları hiçbir üyeye destek olarak önerilmez. Aynı kontrol mevcut, geliştirilmiş ve evrim önerilerinin hedef formuna, ayrıca arama sıralamasındaki Support puanına uygulanır. Yasak adaylar seçenek sınırından önce çıkarılır; uygun alternatifler korunur. Arkadaş kaptanına Support atanmaz.

Support’un kaynak `Characters` koşulu ayrıca kontrol edilir ve öneride “Takılabildiği karakterler” olarak gösterilir. İsim listeleri gerçek kimlik / tam takma ad üzerinden eşleşir; tip, sınıf, tag ve maliyet koşulları birlikte uygulanır. `STR Fighter / DEX Slasher` gibi eşleşmeler çapraz genişletilmez. Okunamayan veya desteklenmeyen hedef koşulu her karaktere uygulanabilir sayılmaz. Etkinin tetik metni seçili Support seviyesiyle ayrı gösterilir.

Global OPTC için Windows masaüstü kutu ve takım yardımcısı. Karakterler ve gerçek geliştirme kayıtları yerel SQLite profilinde saklanır.

## Tasarım ve erişilebilirlik

Açık yelken tonları, deniz laciverti, kırmızı ana eylemler ve hasır şapka vurguları kullanılır. Menüler amaçlara göre gruplanır. Karakter / kutu / boss değişikliklerinde oturum içindeki son işlem **Geri al** ile düzeltilebilir; bağlantı ayarları korunur. Sekmeler sol / sağ ve Home / End ile çalışır. Düzenleme penceresi Escape ile kapanır ve klavye odağı önceki düğmeye döner. Sayfa yardım düğmesi mevcut bölümü değiştirmez. [HCI uygulaması ve kapsam](docs/HCI-DESIGN.md).

## Kullanım

Masaüstündeki **OPTC Nakama** kısayolu C: üzerinden açılır. Güncel paketlenmiş uygulama: `release/v0.5.39/win-unpacked/OPTC Nakama.exe`.

Kutu tanımada **Eşleşmedi** / **Kontrol gerekli** sayaçlarına basarak listeyi filtrele. Kartın **İsim / tip ile elle eşleştir** alanında ad, ID ve tip ile tüm versiyonları ara; seçtiğin eşleşme elle doğrulandı olarak işaretlenir. Filtre gizlediğin seçimleri kaldırmaz. Dual karakterlerin iki alt form tipi de gösterilir.

1. **MuMu bağlantısı** üzerinden kutunu otomatik tanıt veya **Karakter kutum** bölümünden ekle. [Tanıma rehberi](docs/AUTOMATIC_RECOGNITION.md).
2. **Otomatik kadrolar** → tip / sınıf seç → **En iyi kadroları oluştur**. **13 tip / sınıf takımını birlikte öner** bütün STR, DEX, QCK, PSY, INT ve sekiz sınıfı tarar.
3. **Pirate Rumble** → hücum / savunma ve maliyet seç → **En güçlü Rumble kadrolarını kur**. Seviyeler bilinmese de aday gelir. Aktif / yedekler ayrı gösterilir; maliyet bütün sekiz slot içindir.
4. MuMu’da görevin zorluğunu seç veya seçili bossun **Quest Guide / BEHAVIOR** ekranını aç. **Boss planı** → **MuMu’dan bossu oku**. Başlık, görünen yıldız zorluğu / Lv. ve tüm Battle aşamaları kaydırarak okunur. Ekranda sayısal seviye yoksa tahmin edilmez. Boss / zorluk değişimi, eksik aşama veya iptalde okuma durur; eski bossla kadro hesaplanmaz. **Rehber / kayıtlı profil** arşiv kaynaklarını ayrıca açar; anlık seviyeyi doğrulamaz.

Sonuçlar üç karşılaştırma sekmesi sunar: **Mevcut hâl**, **Lv.100 hedefi · evrimsiz**, **Lv.100 hedefi + evrim**. Evrim otomatik olarak daha iyi kabul edilmez; mevcut form da karşılaştırılır. Önerilen arkadaş kaptan ayrı bir sahip olunan kopya sayılmaz. Sonuçlar gerçek kutuya veya seviyelere yazılmaz; **Önerileri kaydet** ile JSON alınabilir.

Evrim kadrolarında kaynak karakter, dönüşüm adımları, malzeme adedi ve edinme yönlendirmesi gösterilir. Renk skull’u ile karaktere özel skull ayrıdır. Nadir malzemelerde Kizuna / TM Exchange veya bilinen özel görev kaynağı gösterilir; güncel stok, fiyat ve etkinlik tarihi varsayılmaz.

Canlı okuma ilk saldırı, başlangıç durumu, tur, HP, yenilince ve special karşılığı davranışlarını ayrı gösterir. BEHAVIOR başlangıcı ve liste sonu doğrulanırsa rehberin atladığı aşamalar "rehberde listelenmedi" olarak korunur; eksik Battle 1 aranarak okuma durdurulmaz. Görünen fakat boş başlıklar ayrıca işaretlenir. Okunamayan başlık veya başlıksız davranış boş aşama sayılmaz.

`Battle 3-1` / `Battle 3-2` gibi alt bölümler kendi başlıklarıyla korunur. Alt numara kendiliğinden beklenen saldırı turuna çevrilmez; altında PREEMPTIVE varsa ilk saldırı olarak kalır. `TURN 2`, `AFTER 1 TURN` gibi açık sayılı tetikler, aynı aşamada kalma senaryosunda ayrı special kullanım pencerelerine çevrilir. Ek bekleme sonraki aşamaların toplam turunu ve cooldown hesabını değiştirir; hazır olmayan special yeniden kullanılamaz. Tekrarlayan etkilerin ilk tetiklenmesi planlanır. Sınırsız bekleme, HP / yenilince / special karşılığı koşulları ve türü / adedi okunmamış bariyerler otomatik çözüldü sayılmaz. Okunan düşman HP’si ile doğrulanan erken geçişler, açık timing / slot bariyeri koşulları ve kaynakta doğrulanmış slot dönüşümleri ayrıca değerlendirilir.

## Hesaplamalar

- Kaptan temel ATK kapsamı ve tip / sınıf uyumu, special ATK / orb / affinity hedefleri, buff çeşitliliği ve mekanik kaldırma birlikte sıralanır. Aynı tür buff’lar üst üste çarpılmaz. Koşullu, gecikmeli ve self-only mekanik etkileri otomatik çözüm sayılmaz.
- Evrim grafiği yalnız sahip olunan karakterlerden yürünür; dönüşümün Global kaydı doğrulanmış olmalıdır. Aynı kaynak kopya bir kadroda iki farklı formla kullanılamaz. Aynı karakterin farklı kartları, takma adları ve dual kimlikleri kendi beş slotunda tekrar edemez; arkadaş kaptan istisnadır. Malzeme envanteri bilinmediği için evrim sonucu bir geliştirme hedefidir.
- Geliştirme önerileri Lv.100 hedefini, special skill-up, LB / extension ve LLB yeteneklerini kapsar. Seviye sınırı 100 altında kalan kartlar erişilebilir sınırında tutulur. LLB açılımları karakter seviyesinden ayrıdır; maksimum LLB hedefi kopya / poster gerektirir. Kaynak seviye üzerindeki stat artışı puana eklenmez; mevcut düşük seviyelerde stat ölçeklemesi yaklaşık sıralama değeridir. Bilinmeyen mevcut seviye / Rumble seviyesi düşük seviye kabul edilir ve belirtilir. Anahtarlı LB düğümleri mevcut hâlde bilinmiyorsa eklenmez.
- Boss hazır planı seçilen hazırlık / stall turunu ve Bind / Despair socket azaltmasını kullanır. Bağımsız special azaltmaları aynı aşamada toplanır; cooldown dolmadan tekrar kullanım yapılmaz. İlk kitaplık 5 kaynaklı karşılaşma içerir: Arena Mihawk, Arena Fransuke, Clash Mihawk 40, Clash Enel 60 ve eski Enel skull görevi. Güncel Kizuna / TM döngüsü boss adından tahmin edilmez.
- Super / EX ve normal switch için doğrulanabilen kaptan / takım koşulları ve koşulsuz mekanik azaltmaları plana dahil edilir. Super tek kullanımlıdır. Captain tip / sınıfı ve sayılı takım koşulları okunabilen special bölümleri çözülür. Sailor rewind direnci, rehberdeki ilk saldırı special limiti ve rewind uygulanır. Support karakterleri kayıtlı / hedeflenen skill seviyesine göre kutudan atanır. Doğrulanabilen boss tetikleri bir kez kullanılır; diğer koşullar mekanik çözümü sayılmaz. Last Tap / Tandem / Rush / Potential / Sailor ve form koşulları **Yetenek denetimi** altında görünür. HP, orb, sayaç, konum / sıra, gemi, bariyer ve dirilme için tam simülasyon yoktur.
- Rumble toplam maliyet altında 5 aktif + en fazla 3 yedek önerir. Ability ve special buff, hasar / HP kesme, CT, iyileştirme, debuff, kontrol, şans, süre ve tekrar puanlanır. Tip, sınıf, karakter etiketi, kadro sayısı ve zaman koşulları incelenir. HP / rakip / tetik / özel mod belirsizlikleri kesin katkı sayılmaz. Yedekler sahaya giriş senaryolarıyla puanlanır; başlangıçta aktif buff vermez. Rakip savaş simülasyonu yoktur.
- Arama sınırlı beam / shortlist kullanır. Puan yaklaşık uyum sıralamasıdır; matematiksel olarak kesin en iyi hasar veya kazanma yüzdesi değildir. Eksik kutu / düşük maliyet için açıklama gösterilir.

## Kurulum ve test

Proje: `C:\Users\berku\Projects\OPTC-Nakama`. Profil: `%APPDATA%\optc-nakama\nakama.sqlite`. ADB: `C:\Program Files\Netease\MuMuPlayer\nx_main\adb.exe`; mevcut cihaz `127.0.0.1:16384`. Oyun / emülatör uyumluluğu kadro hesaplamasından bağımsızdır.

Node.js 24:

```sh
npm ci
npm run build
npm test
node scripts/test-planning-desktop.mjs
node scripts/test-planning-desktop.mjs --packaged
npm run desktop
npm run package:portable
```

Masaüstü test betiği `.local/box-before-040.json` yedeğini ayrı test profiline alır. Üç senaryo, Rumble düğmesi, hazır boss, 13 kategori, evrim reçeteleri, ikon yükleme ve gerçek geliştirme kayıtlarının değişmemesi kontrol edilir.

Karakter / tanıma kataloğu 1 Ekim 2026 tarihli kurtarılan veridir. Ek planner verisi 4 Ekim 2026 tarihinde commit `9db4cfd0c0542b61fb3dbec7a411f54a4b1f212e` üzerinden derlendi. `scripts/build-planner-data.mjs`, `.local/planner-source` dosyalarının ilk literal atamasını JavaScript çalıştırmadan parse eder. `scripts/restore-portraits.mjs` eksik referans görsellerini tamamlar.

## Kaynaklar

Yetenek, Rumble, evrim reçeteleri ve drop listeleri: [2Shankz OPTC Database](https://github.com/2Shankz/optc-db.github.io). Hazır bossların kısa mekanik derlemeleri: [Arena Mihawk](https://onepiecetreasurecruise.fr/Arene/Mihawk.html), [Arena Fransuke](https://onepiecetreasurecruise.fr/Arene/Fransuke.html), [Clash Mihawk](https://op-tc-eng-version.blogspot.com/p/mihawk-raid.html), [Clash Enel](https://op-tc-eng-version.blogspot.com/2016/01/clash-god-enel-ultimate-walkthrough.html?m=0), [Enel skull görevi](https://onepiecetreasurecruise.fr/Crane/Ener.html). Her karşılaşma ve malzeme kartı kendi kaynak bağlantısını içerir.

GPL-3.0-or-later. [Kaynak lisansı](docs/UPSTREAM-LICENSE.md) dağıtıma dahildir. ONE PIECE ve oyun ilgili hak sahiplerine aittir; bu bağımsız yardımcı uygulamadır.


## Grand Party (v0.5.0)

Grand Party sayfasında üç ayrı Rumble kadrosu, ortak GP lideri ve Burst kullanım planı oluşturulur. Mevcut hâl, evrimsiz tam geliştirme ve erişilebilir evrimler ayrı hesaplanır. GP seviyeleri kart detayında ayrı girilir; bilinmiyorsa mevcut hâlde Lv.1 kullanılır. Her kadro en fazla 5 aktif / 3 yedek ve toplam 300 Rumble maliyetidir. Aynı kutu kaydı farklı ekiplerde tekrar kullanılamaz; VS kartlarının bir tarafı seçilir, iki tarafı birden dağıtılamaz. Dual kartlar Rumble’da tipsiz değerlendirilir.

v0.5.69 ile “Grand Party kadrolarını kur” önce MuMu’daki güncel Rule Details ekranını otomatik okur. Grand Party ana ekranı açık olmalıdır; yalnız bilgi penceresi açılıp kapatılır. Lider koşulu, takım / etiket hedefleri, seviyeler, Burst gereksinim yüzdesi ve ek kullanım hakkı Windows OCR ve bağımsız satır okuyucusuyla aynı piksellerden doğrulanır. Eksik / çelişkili okumada hesap başlatılmaz. Okunan metin, kaynak ve zaman uygulamada ve plan dışa aktarımında bulunur. Durdur ve sayfadan ayrılma eski okumanın yeni sonucu değiştirmesini önler; başka ekran okuyucularıyla aynı cihazda eşzamanlı gezinilmez.

Otomatik okuma kapatılarak etkinlik bonusları elle girilebilir. 6 Ekim 2026 Rules ekranındaki Elbaph Arc / World Government boostu yalnız elle seçilen tarihsel profildir; takvimden otomatik etkinleşmez. Lider koşulu ile bonus alacak takım üyelerinin hedefleri ayrı değerlendirilir. Son 30 saniyedeki CT / hasar artışının büyüklüğü belirtilmediğinde sayısal puana eklenmez.

Arama tüm GP lider formlarını ön karşılaştırır; güçlü adaylar, en iyi Burst adayları ve etkinlik bonusuna uyan liderler için kadro dağılımını ayrıntılı karşılaştırır. İki kazanma hedefi ve üçüncü kadronun gücü birlikte puanlanır. Lider ability hedefleri, Burst hasarı / CT / kontrol / iyileştirme, LLB açılımları ve EX special tetik tahminleri değerlendirilir. GP Burst hakkı üç savaş için ortak bütçedir. Bu puan oyunun Combat Power değeri veya kazanma olasılığı değildir; sınırlı aday araması gerçek savaş simülasyonu ve kesin optimum garantisi içermez. HP / rakip koşulları ve bazı tetikler belirsiz olabilir; denetim bölümünde gösterilir. Öneriler kayıtlı kutuyu değiştirmez.


## Lv.100 hedefi (v0.5.1)

Adventure, boss, Pirate Rumble ve Grand Party önerileri artık evrimsiz ve evrimli Lv.100 hedeflerini ayrı sunar. Mevcut hâl kayıtlı seviyeleri kullanır; geliştirme hedeflerinde Lv.100 aşılmaz. LLB ile genişletilemeyen düşük seviye kartlar normal üst sınırında tutulur. Special, LB ve LLB güçlendirme hedefleri ayrı kalır: LLB kademesi 5 olabilirken karakterin hedef seviyesi 100 olabilir. Evrim / Super Evolution reçeteleri ve GP etkinlik bonusları korunur.

## Rumble Rules otomatik okuma (v0.5.2)

Masaüstü Pirate Rumble sayfasında otomatik kural okuma açıktır. MuMu’daki aktif Block A / B / C, Championship veya Exhibition ekranı doğrulanır; Rules → Underway sayfası açılır ve yalnızca o bölümün güncel metni okunur. Gerekirse kurallar sayfası kaydırılır, sonra aynı ana ekrana dönülür. Her kadro hesabı yeni okuma yapar. Görüntü Windows İngilizce OCR ile yerel işlenir; OCR’ın Lv.4 harf hatası yalnızca doğrulanmış rakam görüntüsüyle düzeltilir.

Bonuslar tüm seviye / evrim senaryolarında, aday seçiminden yedek sıralamasına kadar uygulanır. Combat Power ile sınırlı yüzdeler küçük bir gösterilen güç tercihi olarak ele alınır, savaş hasarı çarpanı yapılmaz. Miktarı belirtilmeyen son saniye bonusuna sayı uydurulmaz. Eksik / belirsiz ekran veya kuralda işlem durur; eski bonus sessizce kullanılmaz. Otomatik okumayı kapatarak etkinlik bonusu olmadan öneri oluşturulabilir. Android hareketleri doğrulanmış Rules / Underway düğmeleri, sınırlı kural kaydırması ve geri dönüşle sınırlıdır. Savaş başlatılmaz.


## Evrim malzemelerinin edinme yolları (v0.5.3)

Adventure, boss, Rumble ve Grand Party kadroları aktif üyeler ve yedekler için evrim reçetelerini toplar. Aynı malzemenin toplam adedi, gerçek skull görseli, tam malzeme / form kimliği, mağaza veya görev menü yolu ve kullanılan para gösterilir. Kizuna Tickets ile Kizuna Insignia ayrılır. Malzeme envanteri okunmadığı için sayılar eksik adet değil toplam reçetedir; canlı mağaza stoku / fiyatı varsayılmaz. Kaynakta kayıtlı eski etkinlik ödülleri ayrı açılır. Kesin kaynağı olmayan malzemeler bilinmiyor olarak işaretlenir. Kaydedilen plan dosyaları edinme bilgilerini de içerir.

Derleme: `.local/planner-source` içindeki upstream literal verilerden `scripts/build-planner-data.mjs` çalıştırılır. `shops.js` gerçek malzeme kimliğini eşler; karakterin mağazada satılması özel skull’unun satıldığı anlamına gelmez. `scripts/build-material-images.mjs` upstream ağaç kaydından özel skull görsellerini hazırlar. Global olmayan kayıtlar, negatif manual kimlikleri ve booster listeleri drop sayılmaz.


## Rumble bölüm doğrulama düzeltmesi (v0.5.4)

Aktif Block C başlığı OCR tarafından okunamadığında üstteki Championship başlığı aktif bölüm olarak seçilmez. En yakın başlık okunabilir olmalıdır. Tam ekran ve yakınlaştırılmış bölüm görüntüsü birlikte kontrol edilir; gerekirse yeniden yakınlaştırılır. Rules açılmadan ve ana ekrana dönüşten sonra iki tutarlı bölüm okuması gerekir. Yükleme / animasyon sırasında okunamayan kareler sınırlı tekrar ile beklenir. Gerçekten farklı bölüm doğrulanırsa eski kurallar kullanılmaz; dönüş okunamıyorsa bölüm değişti mesajından ayrı bir tekrar mesajı gösterilir.


## Genişletilmiş yetenek değerlendirmesi

Adventure ve boss araması Captain ATK kapsamı yanında HP, kalıcı hasar azaltma, başlangıç cooldown, crewmate base stat ve faydalı orbları değerlendirir. Special base ATK, chain ve iyileştirme katkıları da sıralamaya katılır. Cost / etiket / çift sınıf koşulları gerçek hedefte kontrol edilir; aynı sınıftaki karakterler için isim ve etiket kapsamları paylaşılmaz. Uyumlu farklı arkadaş kaptanları karşılaştırılır.

Support ataması aktif kadroya girmeyen sahip olunan kopyalardan yapılır; bir fiziksel kaynak iki destekte veya aktif + Support olarak kullanılamaz. Support stat aktarımı ve doğrulanabilen tek kullanımlık boss tetiği değerlendirilir. Evrim gereken Support formları toplam malzeme reçetesine dahil edilir. Karakter detayında Support, Potential ve tap yeteneği seviyeleri ile mevcut dual form kaydedilebilir. Boş / bilinmeyen mevcut seviyeler maksimum sayılmaz.

LLB ithalatına 83 sailor ve 2 Support açılımı dahil edildi. Mevcut hâl seçilen LLB kademesini; Lv.100 hedefleri erişilebilir en yüksek yetenek seviyelerini kullanır. Dual Captain / special / sailor için tek form seçilir; üç alternatif formun etkileri toplanmaz. Normal Switch ile sayaç gerektiren Super Switch ayrıdır. Super / EX için bilinen kadro koşulları kontrol edilir. Last Tap, Tandem, Tandem Boost, Rush ve Critical Hit katkıları tetik koşulları açıkça gösterilen fırsat / beklenen katkı olarak sıralanır. Tandem Boost uygun bir Super Tandem başlatıcısı gerektirir.

Captain / crewmate pasif mekanik azaltmaları ve seçilen Support tetikleri boss aşama planına katılır. Bilinmeyen HP, orb, tap sırası, dual form süresi, VS sayacı, Special Launch Status veya karmaşık tetikler otomatik tamamlandı sayılmaz. Gemi, Cotton Candy, sockets, konum ve tam düşman davranışı tümüyle simüle edilmez. Sonuç sınırlı aday aramasıdır; kesin optimum hasar / kazanma garantisi değildir.

Pirate Rumble ve Grand Party kendi modlarının ability / special / EX verilerini kullanır. EX yalnız okunabilir tetik ve kadro koşulu ile puanlanır; Grand Party aynı EX katkısını tekrar eklemez. PvE Captain / sailor / Support / tap buffları Rumble savaş buffı sayılmaz. Doğrudan hasar special döngüsü ve süre riski değerlendirmesi korunur.

Doğrulama: `npm test`, `node scripts/test-pve-enhanced-desktop.mjs --packaged`, `node scripts/test-rumble-offense-desktop.mjs --packaged`. Masaüstü testleri gerçek profilin anlık kopyasıyla ayrı profil kullanır; kadro kurma ve dışa aktarma kutuyu değiştirmemelidir. Rules ve guide testlerinde kaydedilmiş / açıkça test olarak işaretli sabit veriler kullanılır; oyun ekranına girdi gönderilmez.



## Göreve katılım koşulları

Canlı boss okuması görev seçimindeki REQUIREMENT düğmesine beş saniye basılı tutar ve üç görüntüden koşulu doğrular. Aynı boss / zorluk penceresine dönülmeden kural uygulanmaz. Örneğin Bartolomeo: Insincere görevinde Fighter / Slasher / Striker sınıflarından en az biri gerekir; Imu (Shooter / Driven) ve Gunko (Powerhouse / Cerebral) bu koşula uymaz. Bu bir isim yasağı değildir.

Sınıf, tip ve okunabilen karakter maliyeti / yıldız sınırları kaptan, dört üye ve arkadaş kaptana uygulanır. Evrim seçenekleri hedef kartın gerçek sınıfı ve tipiyle yeniden kontrol edilir. Dual form tipi kesin değilse tek bir uygun renkle koşul sağlandı sayılmaz. Tanınmayan veya yarım kalan açık koşulda kadro hesabı durur; görünmeyen REQUIREMENT ve eski arşiv profilleri doğrulanmadı uyarısı taşır. Supports aktif savaş slotu veya kadro maliyeti sayılmaz; açık kart hariç tutma kaydı varsa destek de çıkarılır.

## BEHAVIOR sayfalarını birleştirme (v0.5.14)

Yatay kayan metin farklı yerlerinden okunursa en az üç farklı sabit satırın konumu, tek bir dikey kaydırmayı doğrulamalıdır. Aynı konumdaki satırlar birleştirilir; ayrı düşmanların aynı davranışları ayrı kalır. OCR geçici olarak bir satırı atladığında önceki okuma korunur. Üst kenarda kesilmiş metin yeni bir davranış sayılmaz ve yarım rakamı önceki tam okumayı geçersiz kılamaz. Efekt ikonu alanında OCR tarafından `0`, `8` veya `@` olarak okunan küçük işaretler tur / hasar metnine eklenmez. Metin alanındaki gerçek rakamlar korunur; tam görünen satırlardaki çelişen tur / hasar sayıları ve belirsiz kaydırmalar kabul edilmez.

`BATTLE a` veya rakamsız `BATTLE` için 4 düzeltmesi yalnız ölçülen rakam pikselleri referansla eşleşirse yapılır. Rakamsız başlıkta ek bir alt bölüm işareti varsa bu düzeltme uygulanmaz. Konum bilgisi kaydedilen boss profiline eklenmez. Başlangıç, liste sonu ve aynı boss / zorluk kontrolleri korunur; okunamayan tetikler ve kısmi metinler doğrulanmış mekanik sayılmaz.


## Birlikte hasar ve hayatta kalma planı (v0.5.19)

Boss sonuçları mekanik kaldırma ile normal saldırı buff’larını, kalan savunmaları, cooldown ve special kullanım sınırını aynı kullanım planında karşılaştırır. Tanınan ölüm hasarı, ön saldırı, Burn ve koruma / iyileştirme birlikte değerlendirilir. Ön saldırıdan sonra basılan koruma o hasarı önlemiş sayılmaz. Hasar aralığı ve tam HP ile başlayan iyimser HP sınırı ayrı gösterilir; düşman HP / saldırısı bilinmiyorsa tek turda geçiş veya güvenli bekleme doğrulanmaz. Buff süresinin bitmesi ve kullanılmış special’ın sonraki turda hazır olmaması ayrıca belirtilir.

Luffytaro 10★ kaydı üzerinden sarı INTERRUPTION Slot Change başlığı ve karşı saldırıdaki buff silme + 10 tur Despair ayrı doğrulanır. Bu koşul okunduğunda orb değiştiren aktif etkiler o aşamanın kullanım planından çıkarılır; slotları yalnız beneficial yapan buff’lar aynı tetik sayılmaz. %80 Percent Damage Reduction ve 1000 üstü hasara %99 Threshold ayrı mekaniklerdir. 4. aşamanın ölümünde gelen 30.000 hasar için koruma / HP kontrolü yapılır. Kayan satır yalnız fiziksel konum ve literal metin örtüşmesi doğrulandığında tamamlanır.

Super Tandem seviyesi ve bütün partner koşulları gösterilir. TND slotu, tap sırası veya tetik doğrulanmadığında garanti hasara eklenmez. DEF azaltma; Threshold, Percent Damage Reduction veya bariyer kaldırma yerine geçmez. Bilinmeyen HP / DEF, sonraki saldırı ve çözülmeyen koşullu dal açık risk olarak kalır. Sonuç sınırlı aday aramasıdır; savaş simülatörü veya kesin kazanma garantisi değildir.

Ship Bind / Slot Bind kaldırma, karakter Bind kaldırma değildir. Açık satır Bind / Special Bind bilgisi bulunduğunda bağlı / silenced karakterin kendi special’ı kullanması engellenir; serbest kaldırma karakteri önce kullanılır ve dört üyenin 24 konumu karşılaştırılır. Satır / sütun yerleri kartta gösterilir. Tanınan Support mevcut-HP maliyeti iyileştirme ve ölüm hasarından önce düşülür.

0.5.18: BEHAVIOR sayfaları ikon şeridinin ölçülen kaymasıyla birleştirilir; kayan satırlar aynı konumda birden fazla görüntüden takip edilir. Tamamlanamayan metinler ayrı gösterilir. Weakness Class sınıfları kadro aramasında önceliklendirilir; doğrulanmamış bonus katsayısı hasara eklenmez.

0.5.19: Boss okuması ayrı worker’da çalışır; 30 saniye ilerleme olmazsa veya okuma 4 dakika sürerse durdurulur. İptal worker’ı kapatır; ekran sayaç ve yeniden okuma düğmesiyle çalışır kalır. Renkli mekanik ikonları etiket OCR’ından çıkarıldı; aynı etiket görüntüsü tekrar okunmaz. Her sayfanın kayan metin takibi sınırlıdır ve tamamlanmayan satır uyarı olarak korunur. PKA’da iki doğrulanmış kaymayan ekran okumayı sonlandırır; doğrulanmamış liste sonu tamamlanmış kabul edilmez. Kaydırmadan önce sabit boss / GUIDE başlığı piksel karşılaştırmasıyla doğrulanır; aynı başlık için ikinci tam OCR yapılmaz. Aşağı kaydırma küçük adımlarla yapılır; sayfalar fiziksel hareket ölçümüyle birleştirilir. Kaydırılan Lv. bantları görev başlığına dahil edilmez; kenarda kesilen sonraki bant, açık seviye değişmiş gibi okunmaz.

0.5.20: Boss okuyucu, ikonlardan güvenilir ölçülen sayfa hareketiyle kaydırma çubuğunun ölçeğini kalibre eder. En az iki farklı sayfa doğrulandıktan sonra bu ölçüm tekrar eden satırların olası konumlarını sınırlar; çubuk tek başına birleştirme kanıtı sayılmaz. İkon veya üç farklı metin satırı hâlâ konumu doğrulamalıdır. Yeniden denemelerde konum kanıtı yeni görüntüden hesaplanır ve kayan metin takibi korunur. Sayı / aşama sırası kontrolleri ve 30 saniye ilerleme / 4 dakika toplam süre sınırları sürer.


0.5.21: Karakter kataloğu, yetenek / Support / Rumble / evrim verileri aynı güncel OPTC Database sürümünden alınır. #4652–#4656 eklendi; Halloween Sanji (#4654) dahil beş yeni kartın portresi ve ikon referansı tamamlandı. Karakter kutusunun varsayılan filtresi bütün kataloğu gösterir; kaynaktaki eksik Global etiketleri yeni kartları gizlemez. Bölgesi doğrulanmamış kayıtlar belirsiz olarak gösterilmeye devam eder. Kişisel kutu ve seviyeler veri güncellemesinden bağımsız tutulur.

Katalog bakım komutu: `npm run catalog:update`. Bir upstream commit sabitlenerek veri dosyaları okunur; JavaScript çalıştırılmaz. Karakter listesi, planner ve yeni ikonlar birlikte hazırlanır; önceki veri dosyaları `.local/catalog-backup-*` içinde korunur. Komuttan sonra uygulama yeniden derlenip paketlenmelidir.
