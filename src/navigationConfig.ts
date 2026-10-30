import {
  Anchor,
  Boxes,
  Flag,
  LayoutDashboard,
  Monitor,
  Shield,
  Sparkles,
  Swords,
  type LucideIcon,
} from 'lucide-react';

export const NAV_ITEMS = [
  ['home', 'Genel bakış', LayoutDashboard],
  ['box', 'Karakter kutum', Boxes],
  ['teams', 'Otomatik kadrolar', Sparkles],
  ['boss', 'Boss planı', Swords],
  ['pka', 'Pirate King Adventures', Anchor],
  ['coop', 'Co-Op', Anchor],
  ['kizuna', 'Kizuna Clash', Flag],
  ['upgrades', 'Geliştirmeler', Sparkles],
  ['rumble', 'Pirate Rumble', Shield],
  ['grand', 'Grand Party', Shield],
  ['mumu', 'MuMu bağlantısı', Monitor],
] as const;

export type PageId = (typeof NAV_ITEMS)[number][0];

export interface PageMetadata {
  title: string;
  subtitle: string;
  help: string;
}

export const PAGE_CONFIG: Record<PageId, PageMetadata> = {
  coop: {
    title: 'Co-Op’u öğren, tayfanı hazırla.',
    subtitle: 'Birlikte görev, özel kaptan ve kutundan altı kişilik kadro.',
    help: 'Önce Co-Op nasıl oynanır sekmesini oku. Kadro kur bölümünde kutundan açık bir Co-Op kaptanı seç ve bilgilerini kaydet. Uygulama normal kaptan, dört üye ve desteklerini karşılaştırır; bilinmeyen ortak etkilerini veya sezon bonuslarını uydurmaz.',
  },
  pka: {
    title: 'PKA için boostlu tayfa.',
    subtitle: 'Güncel Global bonuslar, seçili seviye mekanikleri ve ek drop katkısı.',
    help: 'Hedef seviyeyi seç; MuMu’da PKA ana ekranını veya Quest Guide’ı aç. Etkinlik boostları otomatik bulunur, ilgili seviye aralığı okunur ve kadro hesaplanır. Senaryo / hedef değişimi aynı rehberi kullanır. Bonus Hex yalnız etkin olduğunu seçtiğinde eklenir.',
  },
  kizuna: {
    title: 'Kizuna için doğru tayfa.',
    subtitle: 'Etkinlik ve seviye bağlamıyla normal / SOS kadrolarını karşılaştır.',
    help: 'Önce Global etkinlik ve seviye aralığını seç. Rehber / fotoğrafları yükle; etkinlik bonuslarını kesin kart ID’si ve formuyla kontrol et. Normal ve SOS adayları mevcut, Lv.100 evrimsiz ve evrimli senaryolarla hesaplanır. Super hasar tavanı tam hesabı bu sürümde yok.',
  },
  grand: {
    title: 'Üç tayfa. Tek lider.',
    subtitle: 'Grand Party için GP liderini ve üç kadroyu birlikte karşılaştır.',
    help: 'GP liderini otomatik seçtir veya kutundan seç. Güncel Rules bonuslarını kontrol et; ardından üç kadroyu birlikte oluştur.',
  },
  teams: {
    title: 'Kutundan en iyi kadrolar.',
    subtitle: 'STR, Fighter ve diğer takım türlerini üç geliştirme senaryosuyla karşılaştır.',
    help: 'İstersen bir tip veya sınıf seç; karma seçim de yapabilirsin. Kadroları oluşturduktan sonra üç geliştirme sekmesi arasında geçiş yap.',
  },
  home: {
    title: 'Rotanı belirle.',
    subtitle: 'Kutundaki karakterlerden bir sonraki hedefe.',
    help: 'Önce kutunu tanıt. Ardından boss, Rumble, Grand Party veya tip / sınıf kadrolarından hedefine uygun olanı seç.',
  },
  box: {
    title: 'Kendi tayfan, tek yerde.',
    subtitle: 'Karakterin tam versiyonunu seç; seviyelerini kaydet.',
    help: 'Karakteri ad veya ID ile bul. Tam versiyonunu açıp seviyelerini kaydet. Kutu değişikliklerini Geri al düğmesiyle düzeltebilirsin.',
  },
  boss: {
    title: 'Bir boss. Doğru tayfa.',
    subtitle: 'MuMu’daki seçili bossun davranışını oku; kutundan kadro kur.',
    help: 'MuMu’da seçtiğin bossun Quest Guide / BEHAVIOR ekranını aç. Bossu oku, aşamaları kontrol et ve kadroyu oluştur. Ekranda olmayan Lv. tahmin edilmez.',
  },
  upgrades: {
    title: 'Kaynaklarını doğru kullan.',
    subtitle: 'Kutuna ve seçtiğin hedefe göre geliştirme işleri.',
    help: 'Kaydettiğin boss hedefini seç. Geliştirme işleri kutuna göre sıralanır; eksik bilgileri karakter detayında tamamlayabilirsin.',
  },
  rumble: {
    title: 'Birlikte daha güçlü.',
    subtitle: 'Kutundan hücum ve savunma kadroları; mevcut, tam geliştirme ve evrim seçenekleri.',
    help: 'MuMu’da Pirate Rumble ana ekranını açık bırak. Maliyeti ve hücum / savunma önceliğini seç. Kadro kurarken etkinlik kuralları yeniden okunur; hasar kaynaklarını sonuçta kontrol et.',
  },
  mumu: {
    title: 'MuMu ile bağlantı kur.',
    subtitle: 'Emülatör ekranını al, karakter kutunu yanında oluştur.',
    help: 'MuMu açıkken ADB yolunu otomatik bul, cihazı seç ve bağlan. Character Box’ı açarak kutuyu tara; belirsiz ikonları elle doğrula.',
  },
};
