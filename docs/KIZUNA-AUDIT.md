# Kizuna / boss okuyucu denetimi — 26 Ekim 2026, v0.5.53

İstenen akış: etkinliği ve bonusları bul → MuMu’daki gerçek bossu, zorluğu, tipi, seviyeyi ve canı doğrula → aşamaları doğru koşullarla çöz → kutudan kadro öner → support atamalarını ve yetenek sırasını göster.

## v0.5.53: Boss Planı, REQUIREMENT ve Ambush

Boss Planı ve PKA, gerekli OCR bağlantısı verilmediği için eski kelime birleştirmeye dönüyordu. Boss Planı'nda ayrıca eski 8 dakikalık iş / arayüz sınırları kalmıştı. Okuyucular ortak sayfa ve piksel motoruna bağlandı; toplam okuma süresi / sayfa sınırları kaldırıldı. Sabit `DEFEATED` etiketi kayan koşul olarak yeniden okunmuyor. REQUIREMENT de artık görüntüden birleştirilir; gerçek kayıttaki tam QCK/PSY koşulu ve Neo Ambush açıklaması iki tam OCR okumasıyla doğrulandı.

Ambush ifadesi bulunan profillerde uygulama internet dizinini ve ana görevin kaynak bağlantılarını kendisi kontrol eder. CP-9'un 10★ görevi için [bağlı Neo CP-9 rehberi](https://onepiecetreasurecruise.fr/Invasion/Neo_CP9.html) bulundu; 5 ana aşama korunup 5 Ambush aşaması eklendi. Kayıtlı profil ve fotoğraf girişinde de aynı arama yapılır. Kaynak eşleşmezse ana rehber korunur; eksik katılım kuralı internetten doldurulmuş sayılmaz.

Bağımsız canlı kaynak testi **123,529 saniyede** 7 sayfa, 21/21 takip edilen satır, doğrulanmış QCK/PSY koşulu ve 10 birleşik aşamayla tamamlandı. Gerçek paket arayüzündeki tekrar **300,535 saniyede** aynı birleşik sonucu gösterdi; bu yavaş örnekleme kısa taşmalarda başlangıç duraklamasının kaçırılabildiğini ortaya çıkardı. Giriş hareketi daha önce görülmüş olsa bile, henüz başı bilinmeyen satırın gerçek duraklaması aday başlangıç sayılır; tamamlanma için aynı başın yeniden görülmesi gerekir. Gerçek 6 karelik kayıttaki bütün başlangıç konumları düzeltmeden sonra geçti.

**473 test başarılı, 1 mevcut atlama, 0 başarısız**; TypeScript / Vite ve son paket kontrolleri başarılı. 818 karakter ve önceki 9 boss kaydı korundu. Gerçekte okunan 10 aşamalı CP-9 + Ambush profili ayrıca kaydedildi ve Boss Planı'nda açık bırakıldı. Çok düşmanlı savaşların hedef sırası, çevrilemeyen kaynak etkileri ve Ambush başlangıcındaki HP / special / support yenilenmesi tam hesaplanmış değildir; bulunan kaynak galibiyet kanıtı sayılmaz.

## v0.5.52: başa dönüşte bitmeyen satır toplama

Kullanıcının 536 kare / 711 saniye bildirdiği okuma, tanılama sırasında 935 kare / 1104 saniyeye ulaşmıştı. Gerçek görüntülerde aynı satır başı 31 piksel sağdan yeniden girerken tanınmıyordu; başlangıç girişinin kareler arasında kaçırılması da okuyucuyu başlangıç görmemiş durumda bırakabiliyordu. Ayrıca OCR etiketi ve koşulu ayrı satırlar verdiğinde sabit etiket hareket hesabına katılabiliyordu.

Başa dönen görüntü kayması hesaba katılıyor. Girişi kaçmış bir satırın olası başlangıcı, yazı geçtikten sonra aynı pikseller yeniden görülmeden kesin başlangıç sayılmıyor. Sabit etiketlerin fiziksel çerçevesi hareket alanından çıkarılıyor; renk, mekanik adı uydurmak için kullanılmıyor. Toplam okuma süresi / kare / sayfa sınırı eklenmedi.

Gerçek kayıtla üç hata önce yeniden üretildi. Düzeltmeyle 25 farklı başlangıç / eksik giriş karesi senaryosu geçti. MuMu'daki aynı 13 satırlı sayfa **22,127 saniyede** tamamlandı. Son tam tarama, artık açık olan **10★ INT Koala Lv.8**, **19.269.377 / 19.269.377 HP** için **266,320 saniyede** 3 aşama, 7 sayfa ve 36/36 kayan satırı tamamladı. Bu süre bütün rehbere aittir; tek satır için normal bekleme süresi değildir.

**453 başarılı test, 1 mevcut atlama, 0 başarısız**; TypeScript / Vite ve paket kontrolleri başarılı. v0.5.52 paketinde gerçek başa dönüş ve ayrı etiket senaryoları da denendi. 771 karakter ve kayıtlı Kizuna bağlamı korundu. Savaş başlatılmadı. Bu hareket düzeltmesi, koşul içindeki küçük durum ikonunun anlamını ayrıca doğrulamaz; mevcut OCR'nin o ikonu `3` olarak yazabilmesi mekanik denetiminde ayrı ele alınmalıdır.

Dağıtımdan sonra, iptal edilen kullanıcı okuması yeni uygulamanın normal düğmesiyle yeniden başlatıldı. Yaklaşık 200 saniyede okuma tamamlandı; kadro hesabı 12,6 saniye sürdü ve uygulama yeni Kizuna bağlamını normal şekilde kaydetti. 771 karakter kaydı değişmedi. Sonuçta Resilience, Damage Nullification ve ATK Down engelleri kaldı; interruption koşulu ve erken aşamaların HP / DEF / saldırı değerleri doğrulanmadı. **Okuyucunun bitmesi, üretilen adayın bossu yenebildiği anlamına gelmez.** Kadro sonucunun koşullu durumu korunmalıdır.

## v0.5.51: bağımsız satır okuyucu ve gerçek yerleşim kontrolleri

`6 turn(s) ATK Down` hatası, görüntüdeki **90%** değerini Windows OCR'nin farklı ölçeklerde de atlamasından kaynaklanıyordu. Gerçek satırın 20 farklı OCR kutusu / yükseklik denemesinde eski okuyucu 6 kez başarısız oldu. Yeni okuyucu, gerektiğinde [Tesseract'ın tek satır moduna](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html#page-segmentation-method) geçer. Motor ve İngilizce model uygulamanın içindedir; okuma sırasında indirme / bulut çağrısı yapılmaz. Satırın özgün ve kenarlıklı siyah-beyaz görüntülerindeki sayılar karşılaştırılır; düşük güvenli sayılar tamamlanmış metin sayılmaz.

Satır kırpması artık ilk OCR'nin eksik kelime kutusuna bağlı değildir: harflerin gerçek piksel bandı kullanılır. Kısa bir kelimenin kaybolması, toplam metin kapsamı yüksek diye kabul edilmez. `INTERRUPTION` gibi sabit etiketler aynı sayfada tekrar okunurken korunur; etiketin sağ sınırı ölçülür. Geniş ama sabit düşman adları, gözlenen tam kayan yazı turu boyunca değişmedikleri doğrulanarak ayrılır. Sayfa konumu, ikonlar yetersiz kaldığında iki farklı sabit metin parçasının güçlü piksel eşleşmesiyle doğrulanabilir; tek / boş / belirsiz tekrarlar yeterli değildir. Eksik `Lv.1–20` başlığı da iki ayrı görüntüde aynı tam aralık çıkmadan başka seviyeden tamamlanmaz.

Son gerçek MuMu taraması **10★ QCK Koala Lv.7**, **18.008.727 / 18.008.764 HP** için **3 aşama, 5 sayfa ve 28/28 kayan satırı** eksiksiz tamamladı; uyarı yok, doğru seviye sınırında durdu. Toplam süre **261,052 saniye**; uzun interruption sayfası yaklaşık 99 saniye sürdü. Bu nedenle bütün taramanın saniyeler içinde biteceği iddia edilmez. Savaş başlatılmadı ve bu tanılama yeni boss verisini kullanıcı kaydına yazmadı.

**v0.5.51 açıldı**, kısayol güncellendi. Paket içindeki iki motorla 20 ATK kırpma denemesi geçti; gerçek `%90` okundu. **450 başarılı, 1 mevcut atlama, 0 başarısız**; TypeScript / Vite başarılı. 65 paket dosyası kaynakla eşleşiyor. Kullanıcının çalışma sırasında eklediği 20 karakter dâhil **771 kayıt** ve Kizuna bağlamı korundu. Toplam okuma süresi / kare / sayfa sınırı eklenmedi. Kanıtlar `.local/marquee-v51/` içindedir; önceki kaynak kapsamı eksikleri ayrı kalır.

## v0.5.50: kayan yazıyı görüntüden birleştirerek okuma

412 saniyeyi aşan bekleme yalnız OCR motorunun hızından kaynaklanmıyordu: eski kelime birleştirme yöntemi tek bir hatalı sayıdan sonra toparlanamıyor, renkli başlıkları kaybedebiliyor ve yazının başındaki duraklamayı sonuyla karıştırabiliyordu. Kizuna okuyucusu artık kayan harflerin piksel hareketini ölçerek tam satır görüntüsü oluşturuyor; OCR bu şerit üzerinde çalışıyor. Baş/son kanıtı, görünür metin kapsamı, sayılar, boss kimliği ve yanlış dikey kaydırma kontrolleri korunuyor. Yoğun renkli slot dizileri farklı ölçeklerde okunup aynı görüntü konumlarındaki etiketlerle doğrulanıyor.

Gerçek MuMu denemesinde takılan üç DEX/PSY special / Super Switch / VS satırı **9,198 saniyede**, 6 görüntü ve 3 OCR çağrısıyla tamamlandı; üç sayaç da 10 olarak okundu. Ayrı tam yerel deneme **10★ INT Koala Lv.4 / 14.700.516 HP** için üç savaş aşamasını, 7 sayfayı ve 36 kayan satırın tamamını doğruladı: `complete=true`, `textComplete=true`, uyarı yok. Tam rehber **286,827 saniye** sürdü; uzun slot ve koşul animasyonları içeren iki sayfa yaklaşık 69 ve 86 saniye aldı. Dolayısıyla 9 saniye bütün rehberin süresi değildir. Oyun içinde savaş başlatılmadı; yeni mekanik verileri bu denemeyle kullanıcı kaydına yazılmadı.

Toplam okuma süresi / kare / sayfa sınırı eklenmedi. Aynı tamamlanmış satır görüntüsü farklı OCR yöntemleriyle tekrar doğrulanamazsa açıklayıcı hata verilir; aynı başarısız sonucu sonsuza kadar tekrarlamak veya eksik metni kabul etmek yerine önceki boss kaydı korunur. Kullanıcı iptali çalışır. Bu yöntem [video içindeki metni izleme ve görüntüleri birleştirme yaklaşımıyla](https://www.umiacs.umd.edu/lamp/media/old/research/Tracking_Text_Digital_Video.htm) uyumludur; yerel Windows OCR kullanır. Android erişilebilirlik ağacı ayrıca kontrol edildi, oyun cümlelerini sunmadığı doğrulandı.

Doğrulama: **434 başarılı, 1 mevcut atlama, 0 başarısız**; TypeScript / Vite başarılı. Gerçek kısa taşma, renkli slotlar, seviye başlığı, eksik ilk OCR satırı, sayı çatışması, animasyon sınırları ve iptal için 25 yeni test mevcut. Paket içindeki okuyucu da gerçek üç satırlı kayıtla doğrulandı: 9 görüntü, 3 OCR çağrısı, tam tip önekleri ve sayaçlar. **v0.5.50 açıldı**, masaüstü kısayolu güncellendi; 64 paket dosyası kaynakla eşleşiyor ve **751 karakter kaydı / kaydedilmiş Kizuna bağlamı korundu**. Kanıtlar `.local/marquee-repair/` içindedir. Hazır mekanik kaynak kapsamına ilişkin aşağıdaki eksikler, bu performans düzeltmesinden ayrı kalır.

## v0.5.49: okuma süre sınırları kaldırıldı

Kizuna otomatik ekran okumasındaki **10 dakika**, internet bilgilerinin tamamındaki **90 saniye**, bonus görsellerindeki **90 saniye** ve kayan satırdaki **45 saniye** kesintileri kaldırıldı. Kayan satırın görüntü sayısı ile BEHAVIOR / Trusty / QUEST INFO içeriklerinin sayfa sayısı da okumayı bitirmiyor. Okuma, metin ve seçili seviye bloğu / liste sonu doğrulanana veya kullanıcı iptal edene kadar sürer. Arayüz bu davranışı açıkça gösterir.

İptal düğmesi, farklı boss / zorluk / ekran kontrolleri, yanlış kaydırma ve eksik metni tamamlanmış saymama kuralları korunur. Tek bir takılmış bağlantı / ADB / OCR isteğinin hata koruması ve gezinme / yükleme doğrulamaları toplam okuma süresinden ayrıdır. Okunamayan bir satır iptal edilene kadar bekleyebilir; süre sınırının kalkması kaynakta eksik mekanikleri doğrulamaz.

Doğrulama: **409 başarılı, 1 mevcut atlama, 0 başarısız**; TypeScript / Vite başarılı. Eski kesintilerin ötesindeki okumalar sanal saatle ve 35 sayfalık rehberle test edildi. Paketlenmiş uygulamada 660 saniyelik sanal okuma devam etti ve iptal düğmesi çalıştı. v0.5.49 açıldı; **751 karakter kaydı ve Kizuna ayarları korundu**, 63 paket dosyası kaynakla eşleşti. Gerçek oyunda yeni bir tam tarama veya savaş yapılmadı. Kanıtlar `.local/kizuna-unlimited/` içindedir.

## v0.5.48: kayan yazı OCR hızı

Her karede yeniden Windows PowerShell / WinRT OCR motoru başlatmak yerine, okuma sırasında aynı gizli OCR süreci kullanılıyor. Motor 10 saniye kullanılmadığında ve sahibi kapandığında / iptal edildiğinde kapanır. İstek hatası, zaman aşımı ve beklenmeyen kapanışta eski metin döndürülmez; sonraki okuma temiz süreçte yeniden başlayabilir. Mevcut tek dosyalık OCR kullanımı da korunur.

Gerçek MuMu kayıtlarından üç tam görüntü ve üç satır şeridi, v0.5.47 ile aynı makinede karşılaştırıldı: toplam OCR süresi **7.600 ms → 4.311 ms**, yani **%43,28 azalma**. Altı işlemin metni ve bütün kelime koordinatları birebir aynı. Çözünürlük veya doğrulama azaltılmadı. Hızlı OCR’nin eski kare sınırına erken takılıp yazının başa dönmesini kaçırmaması için örnek sınırı gözlem süresinden hesaplanıyor; Kizuna’nın 45 saniyelik gözlem hakkı korunuyor.

Bu ölçüm OCR bileşenine aittir. Yazının oyunda akması ve tüm satırların tamamlanması fiziksel süre gerektirir; her tam taramanın %43 kısalacağı veya önceden eksik okunan bütün hedeflerin çözüldüğü iddia edilmez. Aşağıdaki kaynak kapsamı ve eksik mekanik kontrolleri aynı kalır.

Güncel doğrulama: **404 başarılı, 1 mevcut atlama, 0 başarısız**; TypeScript / Vite başarılı. Aktif / bekleyen okuyucu iptalinde artık OCR süreci kalmaması, Unicode dosya yolları, istek sırası, hata sonrası yeniden başlama ve eski okuyucuyla metin / geometri eşitliği test edildi. Paketlenmiş v0.5.48 gerçek profilde açıldı; paket içindeki OCR de eski referanslarla aynı sonucu verdi. 63 dosya paketle eşleşiyor; mevcut **751 karakter kaydı ve kaydedilmiş Kizuna bağlamı korundu**. Kanıtlar `.local/marquee-speed/` içindedir.

## v0.5.47: tüm zorluklar ve seçili seviye

Otomatik akış artık **3★ / 7★ / 10★ / 13★** seçimini kabul ediyor. Duyuru ve internet rehberi seçili hedefi kapsamıyorsa uygulama seçilen yıldızın oyun içi QUEST GUIDE listesini okur. Son savaşın seçili seviye bloğu, metin bütünlüğü ve okuma sonundaki hedef eşleşmesi doğrulanmadan mekanikler tamamlanmış sayılmaz. Başarısız okuma önceki kaydı korur. Yüksek seviyenin kuralları düşük seviyeye kopyalanmaz.

Koala’nın **21–25 Ekim 2026 Global etkinliği** için ayrıca gerçek MuMu rehberleri incelenip aşağıdaki aralıklar eklendi. Bu kayıtlar yalnız tam eşleşen etkinlik, yıldız, tip ve seviyede kullanılır:

| Zorluk / tip | Doğrulanmış kapsam | Ayırt edici mekanikler |
| --- | --- | --- |
| 3★ QCK | Lv.1–100, eksiksiz listede seviye dalı yok | Son savaşta sol sütun Bind4 / Paralysis1; GREAT bariyeri yok. İkinci savaşta DEX1 bariyer1. |
| 7★ QCK | Lv.1–150, eksiksiz listede seviye dalı yok | Bind7 / Paralysis3 / GREAT2; ikinci savaşta DEX1 bariyer2. Sınıfa bağlı CD10 koşulsuzdur; Super orb bonusu eklenmez. |
| 7★ INT | Lv.1–150, eksiksiz listede seviye dalı yok | DEX/PSY CD10; ikinci savaşın %50 HP kesintisi sonraki <%70 / ≥%70 dallarına taşınır. Super ATK bonusu eklenmez. |
| 10★ QCK | Lv.1–20 | Bind10 / Paralysis6 / GREAT3. Yüksek seviye Territory ve ATK bonusu uygulanmaz. |
| 10★ QCK | Lv.21–30 | Territory3 / Bind10 / Paralysis10 / GREAT3; Lv.31+ ATK bonusu uygulanmaz. |
| 10★ QCK / INT | Lv.31+ | Mevcut tarih eşleşmeli CDR kaynağı. |
| 13★ QCK / INT | Mevcut Super kaynağı | Super başlangıç koşulları ve katkı değerlendirmesi ayrı kalır. |

3★ INT ve 10★ INT Lv.1–30 için hazır doğrulanmış kayıt eklenmedi; bu hedefler oyun içi tam okumaya gider. Okunamayan metin, bilinmeyen bir etkinlik veya eksik sayfa için kesin kadro doğrulaması yapılmaz. Bu bir hata mesajını kaldırmak için bütün seviyelere aynı mekanikleri uygulayan bir çözüm değildir.

Ek düzeltmeler:

- Gerçek 3★ ve 7★ başlıklarında yıldız ikonu rakam sanılıyordu; ölçülen renkli ikon bölgesi ayrılıp rakam çoklu OCR ile doğrulanıyor. Dört zorluğun gerçek başlık görüntüleri regresyon testinde.
- Ana ekran başlığı sağdaki USE düğmesinin metniyle karışmıyor. Eksik LIST / Vs / TIPS OCR’si salt okuma kırpmalarıyla toparlanıyor; son doğrulama olmadan giriş yapılmıyor.
- Yükleme ekranı bekleniyor; rehber henüz tanınmamışken görünen CONNECTING ekranı da tam yükleme bekleme hakkını kullanır. 3★ ile 13★ arasındaki geçiş görünür ara zorluk ölçülerek yapılıyor. Gerçek `LvI &Lv20` ve `Lv21-vLv30` OCR’si doğru seviye aralığına çözümleniyor.
- Arama, HP’ye bağlı dallarda gerekebilecek kaldırıcıları da aday sıralamasına dahil ediyor. Savaş hesabı yalnız o kadronun gerçekten girdiği dalı uygular. 7★ INT’de savunmaları karşılayabilen karakterler bu yüzden artık aramada elenmiyor.
- NAO yokken çalışan bilinen karşı saldırının pasifliği kaynak URL’sinden bağımsız değerlendiriliyor; oyun rehberinden doğrulanmış aynı koşul da doğru işleniyor.

Güncel otomatik testler: **396 başarılı, 1 mevcut atlama, 0 başarısız**; TypeScript / Vite başarılı. 7★ INT araması gerçek 730 kayıtlı kutunun izole kopyasında bir mekanik engeli bulunmayan koşullu aday ve aşama planı üretti; paketlenmiş UI tekrarında da geçti (20,724 saniye). Paketlenmiş ağ → MuMu → kaynak → renderer → worker denemesinde 3★ QCK Lv.1 için iki aday ve iki plan üretildi (85,304 saniye); başarısız sonraki okuma kayıtları korudu. 730 karakter kaydı değişmedi. Gerçek oyun içinde savaş başlatılmadı.

Son pakette aynı canlı zincir ayrıca **7★ INT Lv.4** için bir planla **83,433 saniyede**, **13★ QCK** için üç katkı planıyla **83,086 saniyede** geçti. Mekanikleri karşılanan adaylarda çözülememiş bariyer sıfır; başarısız sonraki okuma kaydı koruyor. 10★ Lv.3 paket UI tekrarında bir plan üretildi (26,352 saniye). Paket içindeki 62 dosya kaynakla aynı; özel test profilleri paket dışında. Kullanıcı, kalan INT hedeflere şu anda erişemediğini doğruladı; yeniden açılan 10★ rehberinin QCK olduğu kaynak davranışlarıyla ayrıca kontrol edildi.

**Son görünür uygulama kontrolü:** v0.5.47 gerçek profilde **10★ QCK Koala Lv.3**, **13.738.800 HP** ile açıldı. İnternet → MuMu → doğru Lv.1–20 kaydı → kadro worker’ı → görünür plan zinciri **84,523 saniyede** geçti. Bind10 / Paralysis6 ve üç savaş doğrulandı; Lv.31+ Territory / ATK1.1 eklenmedi. Bir koşullu plan açık bırakıldı. Görüntüde Battle2 için #3922 special ve bariyer çözümü, Battle3 için #3463 supportun #3922 üzerindeki otomatik tetiği görüldü. Kısayol / uygulama sürümü doğru; 730 kayıt aynı ve SQLite bütünlüğü sağlam. Kanıtlar `.local/kizuna-all/{real-result.json,real-result.log,final-verification.json,plan-visible.png}`.

Hazır kaynak kullanılmadan yapılan ayrı gerçek tam okuma denemesi, 3★ rehberinin üç aşamasını ve liste sonunu buldu; bazı kayan satırlar ve Bind süresi doğrulanamadığı için `textComplete=false` döndü. Otomatik giriş bu sonucu reddetti ve eksik mekaniklerden kadro oluşturmadı. Dolayısıyla genel OCR yedeğinin her hedefte başarıyla tamamlandığı iddia edilmiyor. Super Switch / VS sayaç başlıklarının metin başlangıcı olarak tanınmaması ayrıca giderildi ve regresyonla doğrulandı; kalan genel OCR sınırlamaları hazır doğrulanmış kayıtlarla karıştırılmamalıdır. Kanıt: `.local/kizuna-all/native-fallback.log`, `native-debug.log`, `fallback-debug/result.json`.

## Bulunan ve giderilen hatalar

| Alan | Önceki hata | Düzeltme / kontrol |
| --- | --- | --- |
| Etkinlik keşfi | Devam eden duyuru kısa ana sayfa listesinden düşünce etkinlik yok sanılıyordu. | Global duyuru dizinine ikinci arama; ana sayfa erişilemese de dizin kontrol edilir. Duyuru başlığı ve etkin tarih aralığı hâlâ zorunlu. |
| MuMu okuması | İnternet eşleşmesi yoksa MuMu hedefi okunmadan işlem duruyordu. | Önce kısa hedef okuması yapılır. Hazır kaynak eksikse seçili hedefin oyun rehberi tam okunur; eksik mekanikler uydurulmaz. |
| Can doğrulaması | Sıfır / ters kalan HP veya eksik gözlem zamanı kaynak girişinden geçebiliyordu. | Pozitif tam sayı, kalan ≤ maksimum ve geçerli zaman kontrolü. Büyük HP metni korunur; güvenli hesap sınırının üstünde hesap engellenir. |
| Hedef takibi | Yeni boss adına geçilmesi değişiklik sayılmıyordu. | Boss adı, tip, seviye, maksimum / kalan HP ve mevcutsa zorluk değişiklikleri tazeleme gerektirir. Başarısız tazelemede izleme durur. |
| Sütun Bind | Sol sütundaki bağlı karakter kendi special’ını kullanabiliyordu. | Ortak satır / sütun hedefleme; normal ve ileri aktif yeteneklerin konumu ve dirençleri denetlenir. Dört üyenin 24 konumu karşılaştırılır. |
| HP koşulları | INT bossun iki HP dalı gerçek aşama koşuluna dönüşmüyordu. | Her arama yolu, o aşamaya taşıdığı mürettebat HP’siyle uygun dalı seçer. Diğer dalın ham metni ve mekanikleri aktif hesaba sızmaz. |
| Girişte HP kesintisi | İkinci aşamanın %50 HP kesintisi sonraki HP dalına taşınmıyordu. | Kaynak kesintisi girişte uygulanır; iyileştirmeler ve sonraki dal bu yeni HP üzerinden değerlendirilir. |
| NAO karşı saldırısı | NAO yokken çalışan iyileşme koşulsuz canlanma gibi yorumlanabiliyordu. | Aktif etkiler ve karşı saldırı metni ayrılır. Bu kaynakta NAO korunuyorsa bilinen pasif dal yürütülmez; NAO kaldırabilecek bilinmeyen eylem varsa dalın doğrulandığı iddia edilmez. |
| Damage Nullification | Etki kaynağa yazılıyor, zorunlu savunma olarak çözülemiyordu. | Ayrı mekanik, kaldırma ayrıştırıcısı, kaydetme doğrulaması ve savaş engeli. Kaldırılmadığında normal hasar sıfırdır. |
| Slot türüne bağlı savunma | Type / RCV / RAINBOW / TND azaltmaları hasarda yoktu. | Kaynaktaki slot kapsamı ve yüzde saldırı hesabına girer. Standart Percent Damage Reduction kaldırma bu ayrı savunmayı kaldırmış sayılmaz. |
| Super başlangıç boostları | Koşullu ATK / orb bonusları kullanılmıyordu. | En az iki aktif Revolutionary Army etiketi doğrulanırsa ilgili sınıf / tiplere süreli bonus uygulanır. Beş turluk bonusun bitişi izlenir. Supportlar bu sayıya dahil değildir. |
| VS / Super Switch | Başlangıç sayaç indirimi kullanılmıyor; VS denetiminde iki formun metni karışabiliyordu. | Doğrulanmış kaynak indirimi, hedef grup ve gerekli sayaç birlikte kontrol edilir. VS’nin seçili formu kullanılır; hazırlığı doğrulanmayan ileri yetenek zamanlanmaz. |
| Switch sonrası form | Eski formun special’ını sonraki adımda kullanmak yanlış plan üretebilirdi. | Form değiştiren planlı eylemden sonra eski special tekrar kullanılmaz. Yeni formun stat / kaptan etkileri tam modellenmediğinden asgari hasar sıfırlanır ve sonuç koşullu kalır. |
| Bariyer ve arama | Hazır olmayan kaldırıcı veya tek başına yeterli olmayan matching dönüştürücü aramayı yanıltabiliyordu. | Gerçek slot tipini sağlayan eş karakter, kaynak başlangıç CD koşulu ve kullanım turu birlikte önceliklendirilir. Çözülememiş bariyer Kizuna’da engeldir; arama sınırı 60 saniyedir. |
| Sürüm etiketi | Ekrandaki sürüm yazısı sabitti. | Görünen sürüm doğrudan paket bilgisinden alınır. |
| Kullanım ekranı | Boss metni, destekler ve kullanım sırası farklı ayrıntılara dağılmıştı. | Her aşama için kaynak davranışları, supportların kime takılacağı, otomatik tetikler, numaralı aktif yetenek sırası, vuruş / devam talimatları ve eksikler birlikte gösterilir. |

## Önceki v0.5.45 doğrulaması

- 15 yeni regresyon eklendi; hata düzeltmeleri önce başarısız testler ve gerçek kutu yeniden oynatımlarıyla doğrulandı. Tam paket: **381 başarılı, 1 mevcut atlama, 0 başarısız**. TypeScript ve Vite derlemesi başarılı.
- Gerçek ağ: Global Koala duyurusu `14775`; 21 Ekim 03:00 UTC–25 Ekim 13:59 UTC; 63 kart kaydı, eşleme uyarısı yok. Ana sayfada asıl etkinlik bağlantısının bulunmaması ve duyuru dizininde bulunması doğrudan gözlendi.
- Gerçek MuMu + Electron IPC + kaynak eşleştirme: **13★ QCK Koala, Lv.1, kalan / maksimum HP 850.000.000**; üç kaynak aşaması, doğrulanmış katılım bilgisi ve aynı HP’yi veren salt ekran hedef kontrolü.
- Renderer ve gerçek kadro worker’ı, **730 karakterlik kutunun izole kopyasıyla** kaynak uygulamada ve paketlenmiş v0.5.45’te **üçer koşullu aday ve üçer aşama planı** üretti. Mekanikleri karşılanan adaylarda çözülememiş bariyer sayısı ayrıca **sıfır** olarak doğrulandı. Paketlenmiş UI kontrolü yaklaşık 21,5 saniye sürdü; gerçek profil değişmedi.
- Son olarak gerçek profilde, paketlenmiş v0.5.45 ile **internet → MuMu → kaynak → kadro worker’ı → görünür sonuç** zinciri yaklaşık **60 saniyede** tamamlandı. Üç sonuç açık bırakıldı. 730 karakter kaydı aynı kaldı; SQLite bütünlüğü doğrulandı. Yalnız güncel Kizuna bağlamı kaydedildi; savaş veya kaynak harcama yapılmadı.
- Ekran görüntüsünde ikinci aşamada #4536 special’ı ile altı DEX slotunun sağlandığı, son aşamada supportların otomatik tetikleri ve aktif kullanım sırası görüldü. Uygulama ve kısayol v0.5.45 olarak doğrulandı.
- Başarısız sonraki okumanın kayıtları değiştirmemesi, kutunun aynı kalması, yatay taşma olmaması ve renderer hatası bulunmaması kontrol edildi. Paket içindeki 61 kaynak/veri/varlık dosyası karşılaştırıldı; özel test verileri paket dışında.
- Kanıtlar `.local/kizuna-audit/` içindedir; gerçek kutu / profil kopyaları dağıtım paketine eklenmez.

## Gerçek kapsam ve açık sınırlar

Bu bir oyun içinde kazanılmış savaşın kaydı değildir. “Mekanik engeli bulunmayan aday”, tüm düşman HP’sinin ve hayatta kalmanın doğrulandığı anlamına gelmez.

- Mevcut hazır mekanik kayıtları Koala etkinliğine aittir; güncel yıldız / tip / seviye kapsamı yukarıdaki tablodadır. Diğer hedefler oyun içi rehber okumasıyla doğrulanmalıdır. Yüksek seviyenin mekanikleri ödünç alınmaz.
- Kaynak önceki aşamaların HP / temel DEF / ATK değerlerinin tamamını vermiyor. Bunlar sıfır kabul edilmez; güvenli geçiş veya kesin hasar kanıtlanmış sayılmaz.
- Kart stat bonuslarının flat katkılarla işlem sırası, arkadaş kapsamı ve ödül istifleme kaynağı bilinmiyorsa kesin değer varsayılmaz. Duyurudaki tüm gruplar ve ham kaynak görünür kalır; sahiplik bonusu ve sabit ek token gibi tam uygulanmayan etkiler açıkça belirtilir.
- Damage Limit Break, Territory, tüm Last Tap / Rush / Super Tandem ve dinamik form dönüşümleri tam bir oyun simülasyonuyla yürütülmüyor. Bazı desteklenen koşulsuz parçalar hesaplanır; belirsiz sayaç / tetik katkıları garantili hasara eklenmez.
- Super sonuçları **hasar katkısı adayıdır**. 850 milyon HP’nin tamamını bitirme şartı aranmaz. Normal / SOS karşılaşmalarının tam HP şartı korunur.
- Arama sınırlıdır. Süre sınırında gösterilen tamamlanmış ilk aday bütün olası kadroların en iyisi olarak sunulmaz.

Bu sınırlar kalkmadan “her bossu kesin yenen takım” veya “bir daha hata olmaz” iddiası doğru olmaz. Sonraki geliştirme, kalan hedef kayıtları ve gerçek savaş kanıtlarıyla doğrulanmış daha kapsamlı hasar / ileri eylem modelidir.

## Kaynaklar

- [Global duyuru dizini](https://e9wiki.com/optc/en/notices)
- [Koala Global duyurusu](https://e9wiki.com/optc/en/notices/14775)
- [CDR Koala aşama rehberi](https://telegra.ph/KIZUNA-CLASH-VS-KOALA-SUPERBOSS-10-17)
