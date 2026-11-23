// Single source for official company contact facts (C-A01…C-A17, approved 2026-11-16).
// Do not add personal addresses or numbers here. X (Twitter) is intentionally absent (C-A17).
export const SITE = {
  url: 'https://sard.dev',
  legalName: { en: 'Sard Integrated Smart Solutions', ar: 'سرد للحلول الذكية المتكاملة' },
  email: 'support@sard.info',
  phone: { display: '01509027729', intl: '+20 150 902 7729', tel: '+201509027729' },
  whatsapp: { number: '201509027729' },
  address: { en: 'Alexandria, Egypt', ar: 'الإسكندرية، مصر' },
  // C-A12: detailed address approved in Arabic only; English form pending (D-38).
  detailedAddress: { ar: 'العصافرة - اسواق الشريف - شركة سرد' },
  // D-38: map embed shows only once verified coordinates are supplied.
  mapCoordinates: null,
  social: [
    { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/sardsmartsolutions/' },
    { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/company/sard-it-solutions/' },
    { id: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61585180859465' },
  ],
};

export function whatsappUrl(message) {
  const base = `https://wa.me/${SITE.whatsapp.number}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
