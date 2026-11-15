import { useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export const PartnersSection = () => {
  const { t, i18n } = useTranslation();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchPartners() {
      const { data, error } = await supabase
        .from('partnerships')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (!error && data) {
        setPartners(data);
      }
      setLoading(false);
    }

    fetchPartners();
  }, []);

  const isRTL = i18n.language === 'ar';

  if (loading || !Array.isArray(partners) || partners.length === 0) {
    return null;
  }

  // Ensure a single group has sufficient items to fill viewports before repeating
  const repeatCount = Math.max(2, Math.ceil(8 / partners.length));
  const singleGroup = Array.from({ length: repeatCount }, () => partners).flat();

  const renderPartnerItem = (partner, uniqueKey) => {
    const name = isRTL ? partner.partner_name_ar : partner.partner_name_en;

    return (
      <div
        key={uniqueKey}
        onClick={() => navigate(`/partners/${partner.id}`)}
        className="cursor-pointer group flex items-center justify-center shrink-0 px-2 transition-transform hover:scale-110 duration-300"
      >
        {partner.partner_logo_url ? (
          <img
            src={partner.partner_logo_url}
            alt={name}
            className="h-10 sm:h-12 md:h-14 w-auto object-contain filter grayscale contrast-125 opacity-70 group-hover:grayscale-0 group-hover:opacity-100 group-hover:contrast-100 transition-all duration-300"
          />
        ) : (
          <span className="text-lg font-bold text-muted-foreground group-hover:text-brand-orange filter grayscale group-hover:grayscale-0 transition-all duration-300">
            {name}
          </span>
        )}
      </div>
    );
  };

  return (
    <section id="partners" className="py-12 bg-secondary/35 border-y border-border overflow-hidden relative transition-colors">
      <div className="container mx-auto px-4 mb-6 text-center">
        <p className="text-xs uppercase tracking-widest text-brand-orange font-semibold">
          {t('partners.title')}
        </p>
      </div>

      {/* dir="ltr" isolates logo ribbon layout and translation direction for flawless continuous movement */}
      <div dir="ltr" className="flex w-full overflow-hidden select-none mask-gradient">
        <div
          className="flex w-max animate-marquee hover:[animation-play-state:paused]"
          style={{ '--marquee-duration': `${Math.max(20, singleGroup.length * 3.5)}s` }}
        >
          {/* Group 1 */}
          <div className="flex shrink-0 items-center gap-12 sm:gap-16 pr-12 sm:pr-16">
            {singleGroup.map((partner, index) =>
              renderPartnerItem(partner, `g1-${partner.id}-${index}`)
            )}
          </div>

          {/* Group 2 (Twin track for seamless loop) */}
          <div className="flex shrink-0 items-center gap-12 sm:gap-16 pr-12 sm:pr-16" aria-hidden="true">
            {singleGroup.map((partner, index) =>
              renderPartnerItem(partner, `g2-${partner.id}-${index}`)
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
