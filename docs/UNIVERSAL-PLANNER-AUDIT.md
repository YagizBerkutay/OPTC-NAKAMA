# Ortak kadro motoru denetimi — 28 Ekim 2026

Kullanıcı tüm modlarda, güncel rakibe ve kurallara göre çalışan kadro planlaması; PKA haritasındaki PvE ve Rumble karşılaşmaları; Assault hatalarının giderilmesini istedi. Bu belge uygulanan parçalar ile tamamlanmamış işleri ayırır. Tek başarılı ekran okuması genel mod desteği değildir.

## Doğrulanan mevcut eksikler

- PvE önce 18 kaptan, kaptan başına sınırlı arkadaş seçenekleri, yaklaşık24üye,22beam ve sınırlı finalist seçiyor. Rumble yaklaşık65üst aday /35ucuz /16hasar adayı ve sınırlı beam kullanıyor. Assault finalist araması süre bütçesiyle kesiliyor. Tam kombinasyon taraması veya matematiksel optimum kanıtı yoktur.
- PvE eleme anahtarı beş sahip olunan kartı sıralayıp kaptan rolünü kaybediyordu. Aynı üyelerin farklı kaptanla kurduğu plan elenebiliyordu. Kaynakta kaptan/arkadaş rolleri ayrıldı; yalnız dört üyenin yer değişimi aynı anahtarı koruyor. Regresyon `pve-crew-identity.test.ts`.
- PKA şu an bir PvE rehberi / seviye aralığı içeriyor. Harita düğümleri, ara bosslar ve Rumble Hex için ayrı karşılaşma planı yok. Rumble Hex'e standart Rumble etkinlik Rules'u taşınmamalı. Mevcut PKA bonuslarının hepsi Rumble bonusu sayılmaz.
- Assault Rules boss listesini okuyabiliyor, fakat INFO yalnız açık bossu okuyor. Diğer bossların detayları eksik. Yeni canlı Mihawk Lv.9 verisi, seviyeleri `Lv MAX` olarak gösterdiğinde eski reader'ın durduğunu kanıtladı; seçili MAX special10/ability5 ayrıştırması eklendi. Eski kayıtlardaki seviye-değişti hatası ayrıca inceleniyor; kontrol kaldırılmadı.
- Ana ekranda SETUP/Rules veya Assault Lv etiketinin tam-kare OCR'da kaybolması da home tanımasını geciktiriyor. Sabit alt düğme bölgesi yeniden okunarak eksik etiket toparlanıyor; seviye kırpımı yalnız önceden okunmuş Lv sözcüğüne bağlı olmaktan çıkarıldı. Skill alanında `1/56` gibi bozuk payda artık `1/5` diye kısmi eşleşmeyle kabul edilmiyor; ayrı native kırpım deneniyor. Gerçek değişen seviye koruması devam ediyor.
- Kutu, kayıtlı geliştirmeler, ayarlar ve boss profilleri kalıcı. PKA/Assault bağlamı ve hesap önbellekleri çoğunlukla oturum belleğinde; her üretilen kadro otomatik kalıcı arşivlenmiyor. “Hesaba katma” ile “sonuç geçmişi saklama” ayrı gereksinimlerdir.
- Rumble skoru tam savaş sonucu değil: rakip, hedef alanı/hareket, aktif/yedek geçişi ve koşulların bir bölümü yaklaşık. PvE'de Blow Away ve kesin boss statı eksikleri devam ediyor. Eksik kaynaklar başarı veya garantili galibiyet olarak gösterilemez.

## Tamamlanması gereken ortak akış

1. Her kaynak adaptörü mod / etkinlik / rakip / kesin seviye veya davranış aralığı / Rules / boost / zaman / kaynak parmak izi / eksik alanlar üretmeli. Aynı isimli koleksiyon kartı NPC kaynağı sayılmaz. Başka boss veya modun bonusu devralınmaz.
2. PKA haritası ayrı karşılaşmalar listesi olmalı: ana boss, ara boss, Rumble Hex. Her düğüm kendi kaynak ve kadro sonucunu taşımalı. Harita ekranı gözlenerek başlanmalı; uygulama stamina harcayan Start Adventure veya savaş başlatmamalı. Rehberi olmayan düğümler için otomatik kaynak araması kesin etkinlik / boss / seviye eşleşmesi istemeli.
3. PvE ve Rumble aynı karşılaşma kaydının moduna yönlendirilmeli; PvE captain/Support/special modeli ile Rumble ability/CT/reserve modeli karıştırılmamalı. PKA Rumble'ın Buddy/özel bonusu doğrulanarak ayrıca verilmeli.
4. Arama raporu toplam uygun kart, ön elemeye alınan kartlar, elenen alternatiflerin gerekçesi, değerlendirilen kaptan/arkadaş/pozisyon/Support/special senaryoları, bütçe ve eksik mekanikleri göstermeli. Küçük havuzlarda tam arama karşılaştırması, büyük havuzlarda farklı başlangıçlar ve artan beam ile iyileşme ölçülmeli. Daha derin arama önceki daha iyi geçerli sonucu korumalı. Yalnız beam'i büyütmek çözüm sayılmaz.
5. Kalıcı sonuç geçmişi isteniyorsa kaynak parmak izi, kutu/geliştirme revizyonu, hedef, kullanılan mod ve kural setiyle saklanmalı; eski etkinlik veya değişen kutuda güncel sonuçmuş gibi açılmamalı. Kutuyu eski anlık görüntüyle geri yüklememeli.
6. Kabul matrisi tek karakter veya tek etkinlik olmamalı: her mod, birkaç boss, alt/üst seviye sınırları, MAX ve normal skill seviyeleri, renk/sınıf/etiket koşulları, aktif/yedek sırası, farklı kaptan rolleri, modlar arası bonus sızıntısı, eksik kaynak, iptal, tekrar açma ve kaynak değişimi.

## Kapsam durumu

Bu turn'de kaynak denetimi, canlı Assault hata üretimi ve iki ortak kod düzeltmesi başlatıldı. Harita planlayıcısı, rakibe göre tam Rumble modellemesi, bütün boss INFO adaptörleri, kalıcı plan geçmişi ve optimuma yakınlık ölçümü tamamlanmış değildir. v0.5.56 bunları destekliyor diye sunulamaz. Son test/teslim durumu HANDOFF'a kaydedilir.

Kullanıcı ayrıca tek Crocodile senaryosuna odaklanılmasını düzeltti: sonraki geliştirme genel mod/karşılaşma modeline ve kalite ölçümüne odaklanmalı; kullanıcıdan sırayla her boss ekranını açması beklenmemeli. Alınan Crocodile60–79 rehberi yalnız bir regresyon kaynağıdır (5aşama,14/14satır,140,607sn).

İlk genel arama kalite ölçümü eklendi: `scripts/audit-rumble-quality.ts`, gerçek kutudan üç ayrı12kartlık eşit maliyetli havuzda bütün792beşliyi üretip mevcut Rumble aramasını aynı puanlama modeliyle karşılaştırır. İlk üç örnekte puan kaybı0 bulundu. Bu, 818kartlık tam havuzun, yedek/sıra aramasının veya gerçek savaş modelinin doğru/optimal olduğunu kanıtlamaz. Özellikle yaklaşık skorun gerçek rakibe karşı yeterliliği ayrı bir doğrulama işidir. Son kaynak suite519testte518başarılı/1atlanan/0hata; canlı Assault MAX ability5 başlığı hatası devam ediyor. Yeni paket yayımlanmadı.
