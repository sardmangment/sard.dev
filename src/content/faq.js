// FAQ structure (Section C). Text lives in the locale files under faq.<id>.{q,a}.

// FAQ-007 states the Sat–Thu 10 AM–8 PM booking hours. It stays hidden until the business-hours
// calendar migration (CC-30) is applied in production, so the page never states something the live
// booking system does not enforce. Flip to true in the release that follows that migration.
export const FAQ_007_ENABLED = false;

export const FAQ_CATEGORIES = [
  { id: 'general', items: ['f001', 'f002'] },
  { id: 'solutions', items: ['f003', 'f004'] },
  { id: 'privacy', items: ['f005', 'f006'] },
  { id: 'consultations', items: ['f007', 'f008'] },
  { id: 'partnerships', items: ['f009'] },
];

export function visibleFaqIds() {
  return FAQ_CATEGORIES.flatMap((c) => c.items).filter((id) => id !== 'f007' || FAQ_007_ENABLED);
}
