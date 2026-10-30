# HCI uygulaması · OPTC Nakama 0.5.8

Kullanıcının `C:/Users/berku/Downloads/Untitled_Document.md` belgesindeki bilişsel yaklaşım, Norman, Shneiderman, Gestalt, erişilebilirlik ve renk prensipleri bu uygulamanın akışlarına uyarlandı.

| Prensip | Uygulamadaki değişiklik |
| --- | --- |
| Görünürlük ve bilişsel gruplama | Menüler Tayfam / Kadro planları / Bağlantı şeklinde üç gruba ayrıldı. Mevcut sayfa metin, çerçeve ve altın işaretle gösterilir. |
| Tutarlılık ve haritalama | Normal kadro, boss, Rumble ve Grand Party sonuçlarında aynı üç geliştirme sekmesi ve aynı kart dili kullanılır. |
| Geri bildirim ve kapanış | Hesaplama, iptal ve tamamlanma mesajları görünürdür. Kayıt göstergesi son kayıt işinin tamamlanmasını bekler. |
| Hata önleme ve kullanıcı kontrolü | Kullanılamayan kadro düğmesinin nedeni yanında gösterilir. Yanlış boss kaynağıyla hesaplamaya izin verilmez. İptal ve yeniden dene akışları korunur. |
| Geri alabilme | Karakter ekleme, düzenleme, silme; kutu içe aktarma ve boss profil kaydı için oturum içinde son değişiklik geri alınabilir. Bağlantı ayarları geri alma sırasında korunur. |
| Bellek yükünü azaltma | Destek, malzeme ve koşullu yetenek ayrıntıları açılabilir bölümlerde kalır. Yardım mevcut sayfayı terk etmeden açılır. |
| Gestalt: yakınlık / ortak bölge | Formlar, boss kaynağı, davranışlar, hesaplama ve sonuçlar kendi kartlarında gruplanır. |
| Renk dışında anlam | Karakter tipleri yazıyla, seçimler işaret ve ARIA seçili durumuyla, hatalar açıklamayla gösterilir. |
| Klavye ve erişilebilir etkileşim | Sekmeler sol/sağ, Home/End ile çalışır. Modal açılınca odak içeride kalır; Escape kapatır ve önceki düğmeye döner. Arka plan etkileşimi durur. |
| Hareket duyarlılığı | Sistem azaltılmış hareket istediğinde animasyonlar ve geçişler kapanır. |

## Renk sistemi

- Yelken / sayfa: `#F7F4EE`
- Kartlar: `#FFFFFF`
- Deniz laciverti / menü: `#0C263B`
- Luffy kırmızısı / ana eylem: `#BF302A`
- Hasır şapka altını / marka ve aktif menü işareti: `#FFC75A`
- Okuma metni: `#152B40`; ikincil metin: `#536778`
- Bağlantı / bilgi: `#006879`

Altın küçük yazılar açık zeminde kullanılmaz; açık zemindeki altın ailesi metin rengi koyulaştırılır. Çerçeveler form alanlarını ayırır; seçili durum yalnız renk değişikliğiyle verilmez.

## Doğrulama

`node scripts/test-hci-desktop.mjs` izole profil üzerinde ana ekran, karakter kutusu ve penceresi, geliştirme listesi, otomatik kadrolar, boss, Rumble, Grand Party ve MuMu ekranlarının görünen metin kontrastını hesaplar. Normal metin için 4.5:1, büyük metin için 3:1 eşikleri kullanılır. Yazı tanıma ikonları / resimlerinin içindeki metinler ve devre dışı kontroller bu metin kontrolünün kapsamı dışındadır.

Aynı akış ana içeriğe geçiş bağlantısını, klavye sekmeleri, modal odak döngüsü, Escape, bağlamsal yardım, silme / düzenleme geri alması, azaltılmış hareket ve en küçük masaüstü penceresindeki yatay taşmayı kontrol eder. Kutu önce ve sonra birebir karşılaştırılır. `scripts/test-gp-hci-desktop.mjs` üç Grand Party geliştirme seçeneğinde sonuç kartlarını, sekmeleri, iptali ve eski sonuçları temizlemeyi doğrular. Boss ve Rumble kadro oluşturma için mevcut masaüstü testleri ayrıca kullanılır. Paketli uygulama `scripts/test-hci-desktop.mjs --packaged` ile aynı kontrollerden geçirilir.

Bu kontroller tam WCAG uygunluk sertifikası değildir. Tüm koşullu ekranlar, ekran okuyucu kombinasyonları ve işletim sistemi ayarları için kapsamlı manuel erişilebilirlik değerlendirmesi yapılmış sayılmaz. Belgede yer alan hukuki / ISO genellemeleri ürün gereksinimi olarak aktarılmadı.

Kaynaklar: [W3C metin kontrastı](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [W3C sekme etkileşim deseni](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
