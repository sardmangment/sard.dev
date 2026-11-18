import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, User, ArrowLeft, ArrowRight, ShieldCheck, ShieldOff, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { SiteNavbar } from '@/components/SiteNavbar';
import { usePageMeta } from '@/hooks/usePageMeta';

// CC-51 · Member verification badge (C-G02). Shows ONLY: Sard-issued verification badge, professional
// name, job title, current affiliation status, verification update date. No join date, no projects,
// no bio, no personal contact details, no departure reason.
interface MemberBadge {
  id: string;
  name_ar: string;
  name_en: string;
  role_ar: string;
  role_en: string;
  photo_url?: string | null;
  is_affiliated: boolean;
  verified_at?: string | null;
}

// Preferred source: RPC get_member_badge (migration 20261118_team_verification.sql).
// Until that migration is applied, fall back to a projection of approved columns only.
async function fetchBadge(id: string): Promise<MemberBadge | null> {
  const rpc = await supabase.rpc('get_member_badge' as never, { p_id: id } as never);
  if (!rpc.error) {
    const rows = rpc.data as unknown as MemberBadge[] | MemberBadge | null;
    const row = Array.isArray(rows) ? rows[0] : rows;
    return row ?? null;
  }
  const { data } = await supabase
    .from('team_members')
    .select('id, name_ar, name_en, role_ar, role_en, photo_url, is_active, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const d = data as unknown as { is_active: boolean; updated_at?: string } & MemberBadge;
  return {
    id: d.id,
    name_ar: d.name_ar,
    name_en: d.name_en,
    role_ar: d.role_ar,
    role_en: d.role_en,
    photo_url: d.photo_url,
    is_affiliated: Boolean(d.is_active),
    verified_at: d.updated_at ?? null,
  };
}

export const MemberVerifyPage = () => {
  const { id } = useParams<{ id: string }>();
  const { t, isRTL } = useLanguage();
  const { t: tr } = useTranslation();
  const [member, setMember] = useState<MemberBadge | null>(null);
  const [loading, setLoading] = useState(true);
  const Arrow = isRTL ? ArrowRight : ArrowLeft;

  usePageMeta({ title: t('التحقق من العضوية | سرد', 'Member Verification | Sard'), noindex: true });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (id) {
          const badge = await fetchBadge(id);
          if (isMounted) setMember(badge);
        }
      } catch (error) {
        console.error('Error fetching member verification data:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const navLinks = [{ to: '/', icon: Home, label_ar: 'الرئيسية', label_en: 'Home' }];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-2xl font-bold">{t('جاري التحقق...', 'Verifying...')}</div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-background">
        <SiteNavbar links={navLinks} drawerLinks={navLinks} />
        <main className="container mx-auto px-4 py-16 flex-1 flex items-center justify-center">
          <div className="text-center p-8 max-w-md mx-auto bg-card rounded-2xl border border-border shadow-lg">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <User className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-destructive mb-2">{t('العضو غير موجود', 'Member not found')}</h1>
            <p className="text-muted-foreground mb-6">
              {t('لم يتم العثور على هذا العضو في النظام', 'This member was not found in the system')}
            </p>
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <Arrow className="h-4 w-4" />
                {t('العودة للرئيسية', 'Back to Home')}
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Not affiliated: confirm status only — no name/role/photo, no reason (C-G02).
  if (!member.is_affiliated) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-background">
        <SiteNavbar links={navLinks} drawerLinks={navLinks} />
        <main className="container mx-auto px-4 py-16 flex-1 flex items-center justify-center">
          <div className="text-center p-8 max-w-md mx-auto bg-card rounded-2xl border border-border shadow-lg" data-testid="member-not-affiliated">
            <ShieldOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-3">{tr('member.notActive')}</h1>
            <p className="text-sm text-muted-foreground">{tr('member.officialChannels')}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background flex flex-col justify-between">
      <SiteNavbar links={navLinks} drawerLinks={navLinks} />

      <main className="container mx-auto px-4 py-8 flex-1">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl mx-auto bg-card rounded-3xl shadow-xl border border-border p-6 sm:p-10 text-center"
          data-testid="member-badge"
        >
          <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-600 px-4 py-2 rounded-full border border-green-500/20 mb-6">
            <CheckCircle className="h-5 w-5" />
            <span className="font-semibold text-sm">{tr('member.verifiedBadge')}</span>
          </div>

          <div className="w-32 h-32 sm:w-40 sm:h-40 mx-auto rounded-full overflow-hidden border-4 border-background shadow-lg bg-secondary mb-5">
            {member.photo_url ? (
              <img src={member.photo_url} alt={t(member.name_ar, member.name_en)} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="h-16 w-16 text-muted-foreground" />
              </div>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold mb-1">{t(member.name_ar, member.name_en)}</h1>
          <p className="text-lg text-muted-foreground mb-4">{t(member.role_ar, member.role_en)}</p>

          <div className="flex flex-col items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-2 font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-brand-orange" />
              {tr('member.active')}
            </span>
            {member.verified_at && (
              <span className="text-muted-foreground">
                {tr('member.verifiedOn')}: {formatDate(member.verified_at)}
              </span>
            )}
          </div>

          <p className="mt-6 text-xs text-muted-foreground leading-relaxed border-t border-border pt-4">
            {tr('member.disclaimer')} {tr('member.officialChannels')}
          </p>
        </motion.div>
      </main>
    </div>
  );
};

export default MemberVerifyPage;
