# Boss okuma ve doğrulama denetimi — 2026-11-01

## Kapsam ve sürüm

İncelenen checkout `v0.5.64`, commit `3f565f2`. Bu çalışma yalnız kaynak, test ve mevcut yerel kanıtları inceledi; uygulama/test koduna dokunulmadı ve emulator/app çalıştırılmadı. Sadece güvenli, odaklı Node testleri ve bir inline read-only probe çalıştırıldı.

“K lvl doğrulanamadı” ifadesinin olası karşılığı Kizuna canlı okumasındaki `Kizuna başlığı, HP, Lv. veya savaş sayısı tam okunamadı; hedef tahmin edilmedi.` mesajıdır (`electron/kizuna-live.cjs:9-15`). Mevcut `.local` loglarında bu hatanın güncel canlı tekrarı bulunmadı. Kaynak ve testler hata koşulunu kanıtlıyor; sıklığını kanıtlamıyor.

## Öncelikli bulgular

### 1. Kısmi kayan metin Kizuna otomatik onayından geçiyor; genel Boss planında da hesaplama kapısı eksik

**Kanıtlanan davranış:** Boss okuyucu liste sonuna ulaşmayı (`complete`) ve kayan metinlerin tamamını doğrulamayı (`textComplete`) ayrı durumlar olarak üretiyor. `tests/behavior-tracking.test.ts:92-96`, `complete:true` ve `textComplete:false` olan gerçek `encounterFromTokens` sonucunu doğruluyor; eksik satır aşamayı da `behaviorTextComplete:false` olarak işaretliyor.

Kizuna’da `applyAutomaticKizuna` (`src/kizuna-auto.ts:21-39`) uyarıyı `warnings` içine ekliyor (`:22-24`), fakat `confirmed` değerini yalnız `boss.observation.complete===true` ve etkinlik eşleşmesiyle belirliyor (`:35`). Dışa aktarılan `kizunaProblem` doğrulayıcısı (`src/kizuna.ts:51-65`) `complete:false` durumunu reddediyor (`:61`), ancak `textComplete:false` kontrolü yok. Bu yüzden otomatik onay ve doğrulama, eksik okuma uyarısı mevcut olsa bile geçebiliyor.

Normal Boss Planında `PlannerPage` hesaplama kapısı `complete===false` durumunu kontrol ediyor, `textComplete` durumunu kontrol etmiyor (`src/PlannerPage.tsx:121,155`). `BossSource` uyarıyı gösteriyor (`src/BossSource.tsx:39`), ancak bu uyarı normal Boss kadro hesaplamasını durdurmuyor. Bu kısım Kizuna’daki exported validator bypass’ından farklı olarak bir UI/hesaplama kapısı eksiğidir.

**Read-only probe:** Gerçek dışa aktarılan `applyAutomaticKizuna` ve `kizunaProblem` fonksiyonlarına `complete:true,textComplete:false` olan Boss sonucu verildi. Çıktı:

```json
{
  "sourceTextComplete": false,
  "autoConfirmed": true,
  "profileIdMatches": true,
  "level": 31,
  "validatorProblem": "",
  "warnings": [
    "Kayan satırın tamamı doğrulanamadı",
    "Etkinlik bonusları tam okunamadı; bilinmeyen bonuslar hesaba eklenmedi.",
    "Henüz aktarılabilecek bonus satırı yok. Başlık, kartlar ve açıklamaların tamamını içeren görüntü ekle."
  ]
}
```

Bu sonuç, okuyucunun böyle bir durumu üretemediği ihtimalini eliyor. Kodda Kizuna internet-recovery yolu kendi `textComplete:false` kontrolünü yapıyor (`tests/kizuna-guide-online.test.ts` içindeki “game recovery rejects incomplete text…” regresyonu); bulgu bu yolu değil, otomatik canlı Kizuna onayı ve genel Boss planı kapılarını kapsıyor. PKA ve Co-Op `textComplete:false` durumunu zaten reddediyor (`src/pka.ts:20`, `src/coop.ts:22`).

**En küçük çözüm:** Kizuna auto-confirm ve `kizunaProblem` kontrolüne `textComplete===false` reddi ekle; genel Boss Planı hesaplama kapısı da aynı durumu engellesin. `undefined` alanlı eski profiller için uyumluluk davranışını açıkça koru.

**Regresyon kabulü:** `complete:true,textComplete:false` Kizuna setup’ı onaylanmamalı, `kizunaProblem` engel döndürmeli ve Boss planı hesaplaması başlamamalı. `textComplete:true` geçmeli. `textComplete` alanı olmayan legacy kayıtlar yalnız ürünün mevcut uyumluluk kararıyla geçmeli. Mevcut Kizuna internet-recovery reddi korunmalı.

### 2. Kizuna Lv. OCR hatasında aynı ekranı yeniden okumadan vazgeçiyor

`mainValues` tek OCR sonucunda başlık, iki HP değeri, sayısal Lv. ve savaş sayısını birlikte ister; bunlardan biri eksikse genel hata fırlatır (`electron/kizuna-live.cjs:9-15`). Okuyucu girişte `observe` çağrısını bir kez yapar; `settle` yalnız ekran `unknown` veya `CONNECTING/LOADING` durumundaysa yeni capture alır (`:41-44`). Ekran “main” olarak sınıflandırılmış, fakat Lv. crop’u tek karede okunamamışsa bu retry yolu çalışmaz.

Testler missing-Lv. durumunun hata vermesini (`tests/kizuna-auto.test.ts:88-92`) ve başlık/TIPS tam kare OCR’ında kaçırıldığında hedef crop’larının kurtarmasını (`:169-180`) doğruluyor. Tek karelik Lv. OCR kaybından sonra aynı hedefi yeniden okuyup toparlayan bir regresyon yok. Yerel loglarda bu hatanın canlı tekrarı bulunmadığından bu bulgu **kanıtlı bir kaynak kodu toparlanma boşluğudur**, kanıtlanmış tekrar sıklığı değildir.

**En küçük çözüm:** Yalnız parse başarısızlığında, herhangi bir oyun girdisi göndermeden ekranı yeniden yakalayıp OCR’ı sınırlı biçimde tekrarla. Aynı boss başlığı, Lv., HP ve savaş sayısı tutarlı olmadan devam etme; kalıcı eksik okumada açık hata ver.

**Regresyon kabulü:** İlk karede Lv. yok, sonraki karede aynı hedefin tüm alanları aynıysa okuma toparlamalı. Tüm karelerde eksik Lv. terminal hata vermeli. Boss/Lv./HP değişikliği hiçbir giriş yapılmadan reddedilmeli.

### 3. Ortak Boss okuyucunun retry sayacı kimliksiz karelerde kullanılmıyor

`electron/boss-behavior.cjs:64` sekiz capture’lık döngü kuruyor; ancak yalnız `pendingQuestModal` için bekleyip devam ediyor. `modalIdentity` üretilemeyen/kimliksiz OCR karesinde hemen hata atıyor. Böylece geçici boş veya parçalı OCR karesi karşısında bildirilen retry bütçesi uygulanmıyor. Kayıtlı farklı boss veya açıkça yanlış ekran için hızlı reddin korunması önemli; öneri bütün yanlış ekranlarda beklemek değil, yalnız belirsiz geçiş karesinde bounded recapture yapmaktır.

Mevcut test `tests/quest-reader-regression.test.ts:62` gerçek `CONNECTING` modalinin retry ile aynı ekrana bağlandığını doğruluyor; kimliksiz/boş bir ara kareden sonra toparlanma testi yok. Yerel loglarda bu özel tekrarın canlı kanıtı bulunmadı.

**En küçük çözüm:** Yalnız kimlik kanıtı henüz oluşmamış geçiş/boş karelerde sınırlı yeniden capture; tanınan başka boss, farklı kimlik veya ön planda olmayan uygulamada hemen dur. Toplam okuma/sayfa/frame timeout’u ekleme; bunlar kullanıcı kararıyla kaldırılmıştı.

**Regresyon kabulü:** Geçici kimliksiz kareden sonra aynı rehber bulunduğunda okuma sürmeli. Başka boss veya yanlış uygulama kareleri swipe/input öncesinde reddedilmeli. İptal, bekleme sırasında da yeni input’u önlemeli.

## Eski bulgu ve kasıtlı davranış ayrımı

- Mihawk ability Lv.5 başlığının OCR’da `b/D` okunması açık bug olarak raporlanmamalı: v0.5.57 handoff kaydı gerçek Mihawk ekranındaki altın başlık numeral-mask doğrulamasının sorunu çözdüğünü belirtiyor (`docs/HANDOFF.md:78-87`). `.local/planner-audit-v57/native-package.log` `passed:true`, ability `complete:true`, levels `[4,5]` diyor.
- Genel Boss rehberinde sayısal Lv. bulunmaması kasıtlı olarak destekleniyor: `tests/boss-behavior.test.ts:16-22` gerçek 5 aşamalı fixture için `observation.level===null` bekliyor; `electron/boss-behavior-core.cjs:312` uyarı bırakıyor; `src/BossSource.tsx:38` kullanıcıya “Sayısal Lv. ekranda görünmüyor” diyor. Bu davranış, Kizuna’nın canlı girişte seviyeyi zorunlu tutmasından ayrı bir mod sözleşmesidir.

## Çalıştırılan doğrulama

Çalıştırılan odaklı, mevcut test komutu:

```powershell
node --import tsx --test tests/boss-behavior.test.ts tests/kizuna-auto.test.ts tests/quest-reader-regression.test.ts
```

Sonuç: **65 test, 65 geçti, 0 başarısız, 0 atlandı**. Probe, `.local` kanıt dosyalarını değiştirmeden Node inline çağrısıyla çalıştı; uygulama/test kaynak dosyaları değiştirilmedi.
