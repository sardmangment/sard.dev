import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, User, Calendar, Briefcase, ArrowLeft, ArrowRight, ShieldCheck, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SiteNavbar } from '@/components/SiteNavbar';

// Strict D-19 compliance: Never expose private team-member contact information
interface TeamMember {
  id: string;
  name_ar: string;
  name_en: string;
  role_ar: string;
  role_en: string;
  photo_url?: string;
  bio_ar?: string;
  bio_en?: string;
  is_admin: boolean;
  join_date?: string;
  is_active: boolean;
}

interface SiteSettings {
  logo_url?: string;
  company_name_ar: string;
  company_name_en: string;
}

interface ProjectWithRole {
  id: string;
  title_ar: string;
  title_en: string;
  role_ar?: string;
  role_en?: string;
  tasks_ar?: string;
  tasks_en?: string;
}

export const MemberVerifyPage = () => {
  const { id } = useParams<{ id: string }>();
  const { t, isRTL } = useLanguage();
  const [member, setMember] = useState<TeamMember | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [projects, setProjects] = useState<ProjectWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const Arrow = isRTL ? ArrowRight : ArrowLeft;

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        // Query safe columns ONLY (Decision D-19 / DEV-82 / DEV-105)
        const [memberRes, settingsRes] = await Promise.allSettled([
          supabase
            .from('team_members')
            .select('id, name_ar, name_en, role_ar, role_en, photo_url, bio_ar, bio_en, is_admin, is_active, join_date')
            .eq('id', id)
            .maybeSingle(),
          supabase
            .from('site_settings')
            .select('logo_url, company_name_ar, company_name_en')
            .maybeSingle(),
        ]);

        if (!isMounted) return;

        if (memberRes.status === 'fulfilled' && memberRes.value.data) {
          const memberData = memberRes.value.data as unknown as TeamMember;
          setMember(memberData);

          // Gracefully fetch projects relationship if available in schema
          try {
            const { data: projectsData, error: projErr } = await supabase
              .from('team_member_projects')
              .select('role_ar, role_en, tasks_ar, tasks_en, projects(id, title_ar, title_en)')
              .eq('team_member_id', memberData.id);

            if (!projErr && Array.isArray(projectsData)) {
              const mappedProjects: ProjectWithRole[] = projectsData
                .filter((p: any) => p && p.projects)
                .map((p: any) => ({
                  id: p.projects.id,
                  title_ar: p.projects.title_ar,
                  title_en: p.projects.title_en,
                  role_ar: p.role_ar,
                  role_en: p.role_en,
                  tasks_ar: p.tasks_ar,
                  tasks_en: p.tasks_en,
                }));
              if (isMounted) setProjects(mappedProjects);
            }
          } catch {
            // Live schema might lack team_member_projects (PGRST205); fallback gracefully
            if (isMounted) setProjects([]);
          }
        }

        if (settingsRes.status === 'fulfilled' && settingsRes.value.data) {
          setSettings(settingsRes.value.data as unknown as SiteSettings);
        }
      } catch (error) {
        console.error('Error fetching member verification data:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const calculateDuration = (joinDate: string) => {
    const start = new Date(joinDate);
    const now = new Date();
    if (isNaN(start.getTime())) return '';
    const years = now.getFullYear() - start.getFullYear();
    const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());

    if (years > 0) {
      return t(`${years} سنة`, `${years} year${years > 1 ? 's' : ''}`);
    }
    return t(`${Math.max(1, months)} شهر`, `${Math.max(1, months)} month${months > 1 ? 's' : ''}`);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const companyName = t(settings?.company_name_ar || 'سرد', settings?.company_name_en || 'Sard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-2xl font-bold">
          {t('جاري التحقق...', 'Verifying...')}
        </div>
      </div>
    );
  }

  const memberLinks = [
    { to: '/', icon: Home, label_ar: 'الرئيسية', label_en: 'Home' },
  ];

  const memberDrawerLinks = [
    { to: '/', icon: Home, label_ar: 'الرئيسية', label_en: 'Home' },
  ];

  if (!member) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-background">
        <SiteNavbar links={memberLinks} drawerLinks={memberDrawerLinks} />

        <main className="container mx-auto px-4 py-16 flex-1 flex items-center justify-center">
          <div className="text-center p-8 max-w-md mx-auto bg-card rounded-2xl border border-border shadow-lg">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <User className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-destructive mb-2">
              {t('العضو غير موجود', 'Member not found')}
            </h1>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background flex flex-col justify-between">
      {/* Header */}
      <SiteNavbar links={memberLinks} drawerLinks={memberDrawerLinks} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex justify-end">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 bg-green-500/10 text-green-600 px-4 py-2 rounded-full border border-green-500/20"
            >
              <CheckCircle className="h-5 w-5" />
              <span className="font-semibold text-sm">{t('تم التحقق', 'Verified')}</span>
            </motion.div>
          </div>
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative"
          >
            {/* Cover Background */}
            <div className="h-48 md:h-64 bg-gradient-to-br from-primary via-primary/80 to-accent rounded-t-3xl" />

            {/* Profile Photo */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-20 md:-bottom-24">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="w-40 h-40 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-background shadow-2xl bg-secondary"
              >
                {member.photo_url ? (
                  <img
                    src={member.photo_url}
                    alt={t(member.name_ar, member.name_en)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-20 w-20 text-muted-foreground" />
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>

          {/* Profile Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-b-3xl shadow-xl pt-24 md:pt-28 pb-8 px-6 md:px-10 border border-t-0 border-border"
          >
            {/* Name & Role */}
            <div className="text-center mb-6">
              <h1 className="text-3xl md:text-4xl font-bold mb-2">{t(member.name_ar, member.name_en)}</h1>
              <p className="text-lg text-muted-foreground">{t(member.role_ar, member.role_en)}</p>

              <div className="flex items-center justify-center gap-2 mt-3">
                {member.is_admin && (
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
                    {t('إداري', 'Admin')}
                  </Badge>
                )}
                <Badge className={member.is_active ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'}>
                  {member.is_active ? t('نشط', 'Active') : t('غير نشط', 'Inactive')}
                </Badge>
              </div>
            </div>

            {/* Bio */}
            {(member.bio_ar || member.bio_en) && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-center text-foreground/80 max-w-2xl mx-auto mb-8 leading-relaxed"
              >
                {t(member.bio_ar || '', member.bio_en || '')}
              </motion.p>
            )}

            <Separator className="my-6" />

            {/* Verification & Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Safe Membership Details (Decision D-19 compliant: ZERO private contacts) */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-4"
              >
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  {t('بيانات التوثيق', 'Membership Details')}
                </h3>

                {member.join_date && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{t('تاريخ الانضمام', 'Join Date')}</p>
                      <p className="font-medium">{formatDate(member.join_date)} ({calculateDuration(member.join_date)})</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('حالة العضوية', 'Membership Status')}</p>
                    <p className="font-medium text-green-600">
                      {member.is_active ? t('عضو نشط وموثق رسمياً', 'Active Verified Member') : t('عضوية غير نشطة', 'Inactive Membership')}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Projects */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  {t('المشاريع', 'Projects')} ({projects.length})
                </h3>

                {projects.length > 0 ? (
                  <div className="space-y-3">
                    {projects.map((project) => (
                      <Link
                        key={project.id}
                        to={`/project/${project.id}`}
                        className="block p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors group"
                      >
                        <h4 className="font-medium group-hover:text-primary transition-colors">
                          {t(project.title_ar, project.title_en)}
                        </h4>
                        {(project.role_ar || project.role_en) && (
                          <p className="text-sm text-primary mt-1">
                            {t(project.role_ar || '', project.role_en || '')}
                          </p>
                        )}
                        {(project.tasks_ar || project.tasks_en) && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {t(project.tasks_ar || '', project.tasks_en || '')}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-6 rounded-xl bg-secondary/30 text-muted-foreground">
                    {t('لا توجد مشاريع مسجلة حالياً', 'No projects currently recorded')}
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>

          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center mt-8 mb-4"
          >
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <Arrow className="h-4 w-4" />
                {t('العودة للرئيسية', 'Back to Home')}
              </Button>
            </Link>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default MemberVerifyPage;
