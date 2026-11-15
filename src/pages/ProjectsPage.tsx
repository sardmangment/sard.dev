import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { SiteNavbar } from '@/components/SiteNavbar';
import { Footer } from '@/components/layout/Footer';
import { ExternalLink, FolderGit2, Home, Calendar, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

interface Project {
  id: string;
  title_ar: string;
  title_en: string;
  description_ar?: string;
  description_en?: string;
  image_url?: string;
  project_link?: string;
  display_order?: number;
}

interface SiteSettings {
  logo_url?: string;
  company_name_ar: string;
  company_name_en: string;
}

interface FooterLink {
  id: string;
  title_ar: string;
  title_en: string;
  url: string;
  icon?: string;
}

interface ContactInfo {
  email?: string;
  phone?: string;
  address_ar?: string;
  address_en?: string;
  whatsapp?: string;
}

export const ProjectsPage = () => {
  const { t } = useLanguage();

  // Independent Projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  // Independent Footer and Settings state
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [footerLinks, setFooterLinks] = useState<FooterLink[]>([]);
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [footerLoading, setFooterLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching projects:', error);
        setProjectsError(error.message);
      } else {
        setProjects(data || []);
      }
    } catch (err: any) {
      console.error('Unexpected error fetching projects:', err);
      setProjectsError(err.message || 'Unknown error');
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const fetchSiteAndFooterData = useCallback(async () => {
    setFooterLoading(true);
    try {
      const [settingsRes, linksRes, contactRes] = await Promise.allSettled([
        supabase.from('site_settings').select('*').maybeSingle(),
        supabase.from('footer_links').select('*').order('display_order', { ascending: true }),
        supabase.from('contact_info').select('*').maybeSingle(),
      ]);

      if (settingsRes.status === 'fulfilled' && settingsRes.value.data) {
        setSettings(settingsRes.value.data);
      }
      if (linksRes.status === 'fulfilled' && linksRes.value.data) {
        setFooterLinks(linksRes.value.data);
      }
      if (contactRes.status === 'fulfilled' && contactRes.value.data) {
        setContactInfo(contactRes.value.data);
      }
    } catch (err) {
      console.error('Error fetching footer data:', err);
    } finally {
      setFooterLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchSiteAndFooterData();
  }, [fetchProjects, fetchSiteAndFooterData]);

  const companyName = t(settings?.company_name_ar || 'سرد', settings?.company_name_en || 'Sard');

  const projectLinks = [
    { to: '/', icon: Home, label_ar: 'الرئيسية', label_en: 'Home' },
    { to: '/calendar', icon: Calendar, label_ar: 'جدول المواعيد', label_en: 'Calendar' },
  ];

  const projectDrawerLinks = [
    { to: '/', icon: Home, label_ar: 'الرئيسية', label_en: 'Home' },
    { to: '/projects', icon: FolderGit2, label_ar: 'المشاريع', label_en: 'Projects' },
    { to: '/calendar', icon: Calendar, label_ar: 'جدول المواعيد', label_en: 'Calendar' },
    { to: '/ai', icon: MessageSquare, label_ar: 'مساعد الذكاء الاصطناعي', label_en: 'Sard AI Chat' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNavbar links={projectLinks} drawerLinks={projectDrawerLinks} />

      <main className="pt-8 sm:pt-12 pb-16 flex-1">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              {t('معرض المشاريع', 'Projects Gallery')}
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
              {t('استعرض جميع مشاريعنا وأعمالنا المتميزة', 'Browse all our projects and outstanding works')}
            </p>
          </motion.div>

          {/* Projects Content: Loading Skeleton, Error State, Projects Grid, or Empty State */}
          {projectsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="h-full overflow-hidden border border-border/50 bg-card">
                  <Skeleton className="aspect-video w-full" />
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                  <CardFooter className="gap-2">
                    <Skeleton className="h-9 w-20" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : projectsError ? (
            <div className="text-center py-16">
              <p className="text-destructive font-medium mb-4">
                {t('حدث خطأ أثناء تحميل المشاريع', 'An error occurred while loading projects')}
              </p>
              <Button variant="outline" onClick={fetchProjects}>
                {t('إعادة المحاولة', 'Try Again')}
              </Button>
            </div>
          ) : projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="h-full overflow-hidden group hover:shadow-lg transition-shadow border border-border/70 bg-card flex flex-col justify-between">
                    <div>
                      {/* Image with guaranteed aspect-video height and broken-link fallback */}
                      <div className="aspect-video overflow-hidden bg-muted/40 relative flex items-center justify-center border-b border-border/50">
                        {project.image_url ? (
                          <img
                            src={project.image_url}
                            alt={t(project.title_ar, project.title_en)}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                const fallback = parent.querySelector('.img-fallback');
                                if (fallback) (fallback as HTMLElement).style.display = 'flex';
                              }
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : null}
                        <div
                          className={`img-fallback w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted/60 to-muted/20 text-muted-foreground ${
                            project.image_url ? 'hidden' : 'flex'
                          }`}
                        >
                          <FolderGit2 className="h-10 w-10 stroke-[1.5] mb-2 opacity-60 group-hover:scale-110 group-hover:text-brand-orange transition-all" />
                          <span className="text-xs font-medium opacity-70">
                            {t('مشروع موثق', 'Verified Project')}
                          </span>
                        </div>
                      </div>
                      <CardHeader>
                        <h3 className="text-xl font-semibold text-foreground">
                          {t(project.title_ar, project.title_en)}
                        </h3>
                      </CardHeader>
                      {(project.description_ar || project.description_en) && (
                        <CardContent>
                          <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
                            {t(project.description_ar || '', project.description_en || '')}
                          </p>
                        </CardContent>
                      )}
                    </div>
                    <CardFooter className="gap-2 pt-4">
                      <Link to={`/project/${project.id}`}>
                        <Button variant="outline" size="sm" className="font-semibold">
                          {t('التفاصيل', 'Details')}
                        </Button>
                      </Link>
                      {project.project_link && (
                        <a href={project.project_link} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-brand-orange">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="max-w-md mx-auto text-center py-16 px-6 bg-card border border-border/80 rounded-3xl shadow-sm mt-4"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center text-brand-orange shadow-inner">
                <FolderGit2 className="h-10 w-10 stroke-[1.5]" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {t('لا توجد مشاريع منشورة حالياً', 'No Projects Published Yet')}
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-8">
                {t(
                  'نقوم حالياً بتجهيز وتوثيق دراسات الحالة وأعمالنا الحديثة لنشرها قريباً.',
                  'We are currently preparing and documenting case studies of our recent works to publish soon.'
                )}
              </p>
              <Link to="/">
                <Button size="lg" className="gap-2 font-semibold shadow-md px-6 bg-brand-orange text-black hover:bg-brand-orange-400">
                  <Home className="h-4 w-4" />
                  {t('العودة للرئيسية', 'Back to Home')}
                </Button>
              </Link>
            </motion.div>
          )}
        </div>
      </main>

      {/* Footer: Skeleton while loading, full Footer when ready */}
      {footerLoading ? (
        <footer className="bg-secondary/40 text-foreground py-12 border-t border-border">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-36" />
              </div>
            </div>
          </div>
        </footer>
      ) : (
        <Footer
          companyName={companyName}
          links={footerLinks}
          contactInfo={contactInfo || undefined}
        />
      )}
    </div>
  );
};

export default ProjectsPage;
