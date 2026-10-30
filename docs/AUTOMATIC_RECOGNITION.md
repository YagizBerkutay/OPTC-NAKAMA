# Otomatik karakter tanıma

MuMu'da Global OPTC'yi ve Character Box ekranını aç. OPTC Nakama'da **MuMu bağlantısı → Otomatik bul** ile C'deki ADB programını seç. Android cihazının yerel adresi bu kurulumda `127.0.0.1:16384`; adres değişirse MuMu'nun geliştirici araçlarından yeni adresi öğren.

**Bağlan → Ekran görüntüsü al** tek ekranı getirir. **MuMu kutusunu tara** ekranlar arasında sınırlı dikey kaydırma yapar. Uygulama Character Box başlığını doğrulayamazsa kaydırmadan durur.

Net eşleşmeleri ve yakın karakter versiyonlarını yan yana görsellerden kontrol et. Belirsiz ikonları aday listesinden veya karakter ID'sini yazarak düzeltebilirsin. **Seçilenleri kutuma ekle** mevcut karakterlerin geliştirme kayıtlarını koruyarak seçilen ID'leri birleştirir.

İkonlar kaymış kesiliyorsa **Otomatik hizala ve yeniden tara** seçeneğini kullan. Gerekirse **Izgarayı ayarla** bölümünden boyutları elle düzelt. Dual karakterler görsel varyantlarına rağmen kutudaki ortak sahiplik ID'sine bağlanır.

Bu sürümde 5.042 görsel şablon, 4.626 farklı karakter ID'sini kapsar. Tanıma puanı olasılık veya kesinlik yüzdesi değildir; aynı çizimi kullanan versiyonları doğrulamak gerekebilir. Eşleşmeyen materyaller varsayılan olarak gizlenir.

Kutu kayıtları Windows profilindeki `AppData\Roaming\optc-nakama\nakama.sqlite` dosyasında saklanır. Oyun hesabı ve emulatorun kendi oyun verileri bu dosyanın parçası değildir.
