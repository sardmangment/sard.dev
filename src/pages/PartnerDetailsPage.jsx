import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { Building2, Handshake, Home, FolderGit2, Calendar } from 'lucide-react';
import { SiteNavbar } from '../components/SiteNavbar';
import { Footer } from '../components/layout/Footer';
import { usePageMeta } from '../hooks/usePageMeta';
import sardITLogo from '../assets/logo.png';

// CC-41 (C-F02/C-F03): general partnership summary only — no contracts, contract dates, financial
// values, commercial terms or internal provisions. Only partners verified for publication are shown
// (RPC get_published_partner); anything else renders "not found".
export default function PartnerDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);

  const isRTL = i18n.language === 'ar';
  const partnerName = partner ? (isRTL ? partner.partner_name_ar : partner.partner_name_en) : '';
  usePageMeta({ title: partner ? `${partnerName} | ${t('partners.title')}` : t('partners.title') });

  useEffect(() => {
    let alive = true;
    async function getPartner() {
      try {
        const { data, error } = await supabase.rpc('get_published_partner', { p_id: id });
        const row = Array.isArray(data) ? data[0] : data;
        if (alive && !error && row) setPartner(row);
      } catch (err) {
        console.error('Error fetching partner:', err);
      } finally {
        if (alive) setLoading(false);
      }
    }
    if (id) getPartner();
    else setLoading(false);
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex justify-center items-center">
        <div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold">{isRTL ? 'الشريك غير موجود' : 'Partner Not Found'}</h1>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 bg-brand-orange text-black font-semibold rounded-xl hover:bg-brand-orange-400 transition-colors"
        >
          {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
        </button>
      </div>
    );
  }

  const summary = isRTL ? partner.summary_ar : partner.summary_en;

  const partnerLinks = [
    { to: '/', icon: Home, label_ar: 'الرئيسية', label_en: 'Home' },
    { to: '/projects', icon: FolderGit2, label_ar: 'المشاريع', label_en: 'Projects' },
  ];
  const partnerDrawerLinks = [...partnerLinks, { to: '/calendar', icon: Calendar, label_ar: 'جدول المواعيد', label_en: 'Calendar' }];

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors flex flex-col">
      <SiteNavbar links={partnerLinks} drawerLinks={partnerDrawerLinks} />

      <main className="max-w-4xl mx-auto space-y-8 w-full py-8 px-4 sm:px-8 flex-1">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 rounded-2xl bg-card border border-border text-center shadow-sm"
        >
          <div className="flex items-center justify-center gap-4 sm:gap-8 my-4">
            <div className="flex flex-col items-center gap-2">
              <img src={sardITLogo} alt="Sard" className="w-16 h-16 sm:w-20 sm:h-20 object-contain" />
              <span className="text-xs sm:text-sm font-bold tracking-widest text-brand-orange">SARD</span>
            </div>
            <div className="text-2xl sm:text-4xl text-border font-light select-none" aria-hidden="true">|</div>
            <div className="flex flex-col items-center gap-2">
              {partner.partner_logo_url ? (
                <img src={partner.partner_logo_url} alt={partnerName} className="w-16 h-16 sm:w-20 sm:h-20 object-contain" />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-brand-orange/15 rounded-xl border border-brand-orange/30 flex items-center justify-center text-brand-orange">
                  <Building2 className="w-10 h-10" />
                </div>
              )}
              <h1 className="text-sm sm:text-base font-bold text-foreground max-w-[180px]">{partnerName}</h1>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-orange/15 text-brand-orange text-xs font-semibold rounded-full border border-brand-orange/30">
              <Handshake className="w-3.5 h-3.5" />
              {t('partners.title')}
            </span>
          </div>
        </motion.div>

        {summary && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-8 rounded-2xl bg-card border border-border shadow-sm"
          >
            <h2 className="text-xl sm:text-2xl font-bold mb-4">{isRTL ? 'نبذة عن التعاون' : 'About the Collaboration'}</h2>
            <p className="text-foreground/85 text-base leading-relaxed whitespace-pre-line">{summary}</p>
          </motion.section>
        )}
      </main>
      <Footer />
    </div>
  );
}
