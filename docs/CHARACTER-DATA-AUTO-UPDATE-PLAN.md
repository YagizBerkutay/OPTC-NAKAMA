# Otomatik karakter verisi güncellemesi — taslak plan

30 Ekim 2026. Kullanıcı seçenek ve plan istedi; özelliği uygulama yetkisi vermedi. Bu belge tasarımdır. Çalışan uygulamaya kontrol, zamanlayıcı, indirme veya otomatik güncelleme eklenmedi.

## Amaç ve kapsam

Yeni kartlar ve mevcut kartların kaynakta değişen bilgileri uygulama kurulumu gerektirmeden güncellenebilsin. Katalog, kadro/Rumble/evrim verileri, tanıma indeksi ve portreler aynı doğrulanmış veri sürümünden gelsin. Kullanıcının karakter sahipliği, seviyeleri, geliştirmeleri, cost ve boss kayıtları veri güncellemesinden bağımsız kalsın.

Bir defalık yeni uygulama sürümü gerekecek. Sonrasında uyumlu karakter verisi değişiklikleri veri güncellemesi olarak alınabilecek. Kaynak biçimi veya uygulamanın yetenek ayrıştırıcısı değişirse ayrıca uygulama güncellemesi gerekebilir.

## Mevcut durumdan çıkan sınırlar

- `scripts/update-catalog.mjs` kaynağın tek bir commit'ine sabitlenmiş dosyaları getiriyor; katalog, planner ve tanıma üretimini sırayla çalıştırıyor. Bu bir geliştirme komutu; paketli uygulamanın arka plan servisi değil.
- Komut `.local` / `public` yollarına bağlı ve dosyaları aşamalı değiştiriyor. Yedek oluşturması, çalışma sırasında dört veri dosyasının tek sürüm olarak okunmasını sağlamıyor.
- Katalog/veri üreticileri TypeScript AST ve JSON5 ile kaynak veri atamalarını ayrıştırıyor. TypeScript geliştirme bağımlılığı; `scripts/` dağıtım paketine alınmıyor. Paketli uygulamada sistem Node/npm veya geliştirme klasörü varmış gibi bu komut çağrılamaz.
- `src/App.tsx` kataloğu paket içinden başlangıçta yüklüyor; `src/PlannerPage.tsx:getData` planner verisini oturum boyunca önbellekliyor. Avatar, BoxScanner ve Portrait bileşenleri paketli portre yollarını kullanıyor.
- `electron/recognition.cjs` tanıma worker'ına sabit `dist/data` yolunu veriyor. Veriyi diske indirmek tek başına etkin kataloğu veya tanıma motorunu güncellemiyor.
- Graphify grafiği yok. Sınırlı güncelleme hattı kaynak koddan doğrulandı; yeni indeks, bağımlılık veya arka plan servisi kurulmadı.

## Seçenekler

| Yol | Kullanıcıya etkisi | Kurulum / bakım | Değerlendirme |
|---|---|---|---|
| 1. Sadece yeni veri kontrolü ve bildirim | Yeni kaynak sürümü bulunduğunu söyler; veri hazırlama/dağıtma işi yine gerekir. | En küçük değişiklik. | Sorunun görünmesini sağlar; tek başına otomatik veri güncellemesini çözmez. |
| 2. Bilgisayarda otomatik veri üretimi | Kaynaktan veriyi indirir, mevcut üreticilerin paketli uygulamaya uyarlanmış sürümüyle hazırlar ve yükler. | Orta kapsam; ayrı yayın sunucusu veya hesap gerektirmez. Kaynak ayrıştırma bağımlılığı uygulamada taşınır. | Bu kişisel uygulama için önerilen ilk yol. |
| 3. Önceden hazırlanan veri paketleri | Uygulama yalnız manifest ve hazırlanmış veri/ikon paketlerini indirir. | Bir yayın deposu ve otomatik üretim/doğrulama hattı gerekir; istemci daha az üretim işi yapar. | Birden fazla kullanıcı/cihaz için tercih edilebilir. Yayın ortamı henüz kurulmuş değil. |

2 ve 3 aynı yerel veri deposu ve doğrulama sözleşmesini paylaşabilir. İlk uygulamada tek üretim yolu seçilmeli; iki güncelleyici birden yapılmamalı.

## Önerilen başlangıç davranışı

- Uygulama açılışı mevcut yerel veriyle hemen devam eder. Kontrol arka planda, son başarılı kontrolün üzerinden 6 saat geçtiyse başlar; uygulama açık kaldığında da aynı aralık korunur.
- Ayarlarda `Otomatik kontrol`, `Şimdi kontrol et`, son kontrol tarihi, etkin veri sürümü ve bekleyen güncelleme gösterilir.
- Sadece kart sayısı veya en büyük ID karşılaştırılmaz. Katalog, detaylar, cooldown, evrimler, aileler, tag'ler, Rumble ve ikon girdilerinin kaynak sürümleri/değişiklikleri incelenir. Böylece aynı sayıda kart varken düzeltilen Special veya değişen ikon da yakalanır.
- Kaynak değişmediyse tüm dosyalar yeniden indirilmez. ETag/koşullu istek kullanılır; ağ/rate-limit hatalarında kaynağın bekleme başlıkları ve artan yeniden deneme aralığı izlenir. Anonim `304` yanıtlarının kotadan muaf olduğu varsayılmaz.
- Uygulama kapalıyken kontrol yapılmaz. Windows görev zamanlayıcısı veya sürekli tray süreci ayrı ve isteğe bağlı sonraki kapsamdır.

## Uygulama aşamaları

### 1. Tek veri sürümü sağlayıcısı

Paket içindeki veriler başlangıç/yedek sürüm olarak korunur. İndirilen sürümler kullanıcıya ait ayrı bir alt klasörde tutulur: Windows için örneğin `%LOCALAPPDATA%/optc-nakama/catalog-data/<revision>/`. İndirilebilir büyük dosyalar Roaming profilini büyütmez. Küçük etkin sürüm/ayar kaydı `userData` altında tutulabilir; `nakama.sqlite` veri sürümü klasörlerinin dışında kalır.

Ana süreç etkin veri sürümünü seçer. Katalog, planner, tanıma ve portre erişimi aynı sürümü kullanan ortak bir sağlayıcıdan geçer. Renderer'a rastgele dosya sistemi erişimi verilmez; veri/portre yolları sabit tür ve doğrulanmış ID'lerle sınırlandırılır. Başlangıçta bozuk indirilen sürüm varsa önceki sağlam sürüm, yoksa paketli veri kullanılır.

### 2. Kontrol ve indirme servisi

Tek kontrol/indirme kuyruğu olur. Her denemede kullanılan commit kimliği bir kez belirlenir; tüm ham dosya ve ikonlar o commit'ten alınır. İlgili veri değişmediyse yalnız son kontrol bilgisi yenilenir. Mevcut ikonlar korunur; yeni veya içeriği değişmiş ikonlar indirilir. Eski indekslerde SHA alanı olmayan girdiler için başlangıç sürümü ilişkisi kurulmalı; aynı yolun içeriği değiştiğinde değişikliği kaçıran mevcut koşul aynen taşınmamalı.

Bu yol için mevcut üreticiler sabit klasörler ve CLI yan etkilerinden ayrılıp açık kaynak/hedef dizinleri alan paketli bir worker'a uyarlanır. Ağ indirmeleri kontrollü yürür; UI'ı bloke eden senkron üretim yapılmaz. Ham JavaScript çalıştırılmaz; mevcut veri-ataması ayrıştırma ilkesi korunur. Kullanıcının sisteminde Node/npm bulunması şart olmaz.

### 3. Hazırlama ve doğrulama

Üretim ayrı bir staging klasöründe yapılır. Etkin dosyalar tek tek üzerine yazılmaz. Paket manifesti veri şeması, üretici uyumu, kaynak commit'i ve dosya hash'lerini içerir.

Etkinleştirmeden önce:

- JSON/şema/boyut sınırları, katalog ID'leri, tanıma stride/byte uzunluğu ve hash'ler doğrulanır.
- Katalog/planner commit ilişkisi ve `recognition.catalogHash` eşleşir.
- Önceden kayıtlı karakter ID'leri korunur. Kaynakta kaldırılan karakterler kullanıcı kutusunu geçersiz yapmaz.
- Önceden tanınan kartların ikonları kaybolmaz; Support-only sınıflandırması kaynak yapısından yeniden hesaplanır.
- Kaynakta alanı boş olan bir karta kaptan veya Special yeteneği uydurulmaz. Global etiketi olmayan kart kendiliğinden Global kabul edilmez.
- Mevcut 414 eksik ikon kaydı güncellemeyi sonsuza kadar engelleyen bir koşula çevrilmez. Yeni kartın ikonu eksikse `Kart bilgisi var, tanıma görseli bekleniyor` durumu gösterilir; başka karta zorla eşleştirilmez. Sonraki kontroller eksik görseli de yeniden arar.

Eksik/bozuk zorunlu dosya, uyumsuz şema veya kesilen indirme eski çalışan sürümü etkilemez.

### 4. Tutarlı etkinleştirme

İlk sürümde doğrulanmış indirme `bekleyen sürüm` olarak saklanır ve sonraki uygulama açılışında otomatik etkinleşir. Bu, mevcut tarama/kadro işlerine ve kaydedilmemiş seçime müdahale etmeden veri güncellemesini kurulumdan ayırır. Kullanıcı uygun zamanda `Yeni verilerle yeniden aç` seçeneğini kullanabilir; çalışan işlem veya kaydedilmemiş seçim varken yenileme yapılmaz.

Etkinleştirme, tamamlanmış sürüm klasörünü işaret eden küçük aktif sürüm kaydının tek geçişiyle yapılır. Başarısızlıkta önceki sağlam veri sürümü kullanılmaya devam eder. Her işlem başlarken veri sürümü sabitlenir; uygulama kapanırken bitmeyen staging indirmesi sonraki açılışta etkin sayılmaz.

Canlı oturumda yeniden açmadan geçiş ayrı ikinci aşamadır: `getData` ve resim önbellekleri, tanıma worker'ları ve tüm planlama sayfalarının saklanan sonuçları birlikte yenilenmelidir. Önceki sürümle hesaplanan sonuç yeni sürümle hesaplanmış gibi gösterilemez. Bu ikinci aşama ilk teslimata zorunlu eklenmemeli.

### 5. Kullanıcıya görünen sonuç

Başarılı güncellemede tek kısa durum: `9 yeni kart, 3 kart bilgisi güncellendi; yeni veri hazır.` Başarısızlıkta: `Veri güncellenemedi; mevcut katalog kullanılmaya devam ediyor.` Kalıcı ayrıntılar son kontrol/sürüm ekranında yer alır; değişiklik yokken bildirim tekrarlanmaz.

Veri güncellemesi kullanıcının kutusuna yeni karakter sahipliği veya seviye kaydı eklemez. Önceki taramada kaçan bir kart, güncel veriyle tekrar tarandığında tanınabilir. Kaydedilmemiş eski tarama sonuçlarını otomatik yeniden değerlendirmek ilk sürüm kapsamına alınmaz.

## Kabul kontrolleri

1. Aynı kaynak sürümünde üretim ve ikon indirmesi yapılmaması; güncel kontrolün gereksiz sık tekrarlanmaması.
2. Yeni kart ve yalnız mevcut Special/Rumble/ikon düzeltmesinin ayrı ayrı yakalanması.
3. Broggy4665 gerçek görseli: eski indeks bilinmeyen, güncel indeks doğru net eşleşme; eşikler sabit.
4. Ağ yok/403/429, yarım indirme, bozuk JSON/bin, hash/commit uyumsuzluğu ve disk yazma hatasında eski sürümle açılış.
5. Yeni kartta eksik ikon, eksik Captain ve Global etiketi yokluğu; bilinmeyenlerin açıkça korunması.
6. Kullanıcı profilinin önce/sonra birebir eşitliği; mevcut geliştirmelerin ve eski ID'lerin korunması.
7. Kutuyu tararken veya kadro oluştururken veri değişmemesi; bekleyen güncellemenin güvenli açılışta tek sürüm olarak uygulanması.
8. TypeScript/Node geliştirme ortamı bulunmayan makinede gerçek paketli uygulama testi; source ve paketli veri yollarının aynı davranması.

## Kaynak ve yayın bağımlılığı

Kaynak veri tabanı kartı/ikonu yayımlamamışsa uygulama henüz indiremez. Otomasyon kaynağın yayın hızını değiştirmez; kaynakta neyin eksik olduğunu görünür yapar. Hazır paket yolu seçilirse ayrıca bir yayın deposu ve üretim iş akışı tasarlanıp kullanıcı tarafından seçilmelidir; bu plan kapsamında kurulmamıştır.

Electron42 belgeleri ASAR arşivlerinin salt okunur olduğunu ve uygulamaya ait dosyalar için `userData` altında ayrı bir alt dizin kullanılabileceğini belirtir: [ASAR](https://github.com/electron/electron/blob/v42.0.0/docs/tutorial/asar-archives.md), [app.getPath](https://github.com/electron/electron/blob/v42.0.0/docs/api/app.md).

Kontrol sıklığı, ETag ve limit durumunda bekleme davranışı için: [GitHub REST iyi uygulamalar](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api).
