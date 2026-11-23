import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { SiteNavbar } from '@/components/SiteNavbar';
import { Footer } from '@/components/layout/Footer';
import { ArrowLeft, ArrowRight, ExternalLink, Calendar, Link2, Home, FolderGit2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface Project {
  id: string;
  title_ar: string;
  title_en: string;
  description_ar?: string;
  description_en?: string;
  image_url?: string;
  project_link?: string;
  partnership_id?: string;
  created_at: string;
}

interface ProjectImage {
  id: string;
  image_url: string;
}

interface Partnership {
  id: string;
  partner_name_ar: string;
  partner_name_en: string;
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

export const ProjectDetailsPage = () => {
  const { id } = useParams();
  const { t, isRTL } = useLanguage();
  const { t: tr } = useTranslation();
  const [project, setProject] = useState<Project | null>(null);
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [partnership, setPartnership] = useState<Partnership | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [footerLinks, setFooterLinks] = useState<FooterLink[]>([]);
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const Arrow = isRTL ? ArrowRight : ArrowLeft;

  const fetchData = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      // Use allSettled so missing optional tables (e.g. project_images) do not fail the core project fetch
      const [projectRes, imagesRes, settingsRes, linksRes, contactRes] = await Promise.allSettled([
        supabase.from('projects').select('*').eq('id', id).maybeSingle(),
        supabase.from('project_images').select('*').eq('project_id', id).order('display_order', { ascending: true }),
        supabase.from('site_settings').select('*').maybeSingle(),
        supabase.from('footer_links').select('*').order('display_order', { ascending: true }),
        supabase.from('contact_info').select('*').maybeSingle(),
      ]);

      if (projectRes.status === 'fulfilled' && projectRes.value.data) {
        const projData = projectRes.value.data as Project;
        setProject(projData);

        if (projData.partnership_id) {
          try {
            // Only partners verified for publication may be linked (C-F02, RPC get_published_partner).
            const partnershipRes = await supabase.rpc('get_published_partner' as never, { p_id: projData.partnership_id } as never);
            const row = Array.isArray(partnershipRes.data) ? partnershipRes.data[0] : partnershipRes.data;
            if (!partnershipRes.error && row) {
              setPartnership(row as unknown as Partnership);
            }
          } catch (partErr) {
            console.warn('Error fetching partnership for project:', partErr);
          }
        }
      }

      if (imagesRes.status === 'fulfilled' && imagesRes.value.data) {
        setImages(imagesRes.value.data as ProjectImage[]);
      }

      if (settingsRes.status === 'fulfilled' && settingsRes.value.data) {
        setSettings(settingsRes.value.data as SiteSettings);
      }

      if (linksRes.status === 'fulfilled' && linksRes.value.data) {
        setFooterLinks(linksRes.value.data as FooterLink[]);
      }

      if (contactRes.status === 'fulfilled' && contactRes.value.data) {
        setContactInfo(contactRes.value.data as ContactInfo);
      }
    } catch (error) {
      console.error('Error fetching project details:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const companyName = t(settings?.company_name_ar || 'سرد', settings?.company_name_en || 'Sard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center">
        <div className="max-w-md p-8 rounded-2xl bg-card border border-border shadow-sm space-y-4">
          <h1 className="text-2xl font-bold text-foreground">
            {t('المشروع غير موجود', 'Project not found')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              'عفواً، لم نتمكن من العثور على تفاصيل هذا المشروع أو ربما تم نقله.',
              'Sorry, we could not find details for this project or it may have been moved.'
            )}
          </p>
          <Link to="/projects">
            <Button className="gap-2 bg-brand-orange text-black hover:bg-brand-orange-400 font-semibold">
              <Arrow className="h-4 w-4" />
              {t('العودة للمشاريع', 'Back to Projects')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteNavbar links={projectLinks} drawerLinks={projectDrawerLinks} />

      <main className="pt-8 sm:pt-12 pb-16 flex-1">
        <div className="container mx-auto px-4 sm:px-6">
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-brand-orange transition-colors mb-8"
          >
            <Arrow className="h-4 w-4 text-brand-orange" />
            <span>{t('العودة للمشاريع', 'Back to Projects')}</span>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Main Featured Image */}
            {project.image_url && (
              <div className="aspect-video rounded-2xl overflow-hidden mb-8 border border-border/70 shadow-sm bg-muted/30">
                <img
                  src={project.image_url}
                  alt={t(project.title_ar, project.title_en)}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Project Info & Metadata Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-brand-orange/15 text-brand-orange border border-brand-orange/30" data-testid="demo-badge">
                  {tr('projectsPage.statusBadge')}
                </span>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                  {t(project.title_ar, project.title_en)}
                </h1>
                <p className="text-xs text-muted-foreground leading-relaxed">{tr('projectsPage.confidentialityNote')}</p>

                {(project.description_ar || project.description_en) && (
                  <div className="prose prose-neutral max-w-none">
                    <p className="text-foreground/85 text-base sm:text-lg leading-relaxed whitespace-pre-wrap">
                      {t(project.description_ar || '', project.description_en || '')}
                    </p>
                  </div>
                )}

                {/* Additional Images Gallery (Gracefully empty if table does not exist) */}
                {images.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-border">
                    <h2 className="text-xl font-bold mb-4 text-foreground">
                      {t('معرض الصور', 'Image Gallery')}
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {images.map((img) => (
                        <div key={img.id} className="aspect-square rounded-xl overflow-hidden border border-border bg-muted/20">
                          <img
                            src={img.image_url}
                            alt=""
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar: Metadata and Action Links */}
              <div className="space-y-4">
                <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-base text-foreground border-b border-border pb-3">
                    {t('معلومات المشروع', 'Project Info')}
                  </h3>

                  <div className="space-y-3.5 text-sm">
                    {project.created_at && (
                      <div className="flex items-center gap-2.5 text-muted-foreground">
                        <Calendar className="h-4 w-4 text-brand-orange shrink-0" />
                        <span>
                          {new Date(project.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    )}

                    {/* Partner badge links to /partners/:id (per DEV-109 requirement) */}
                    {partnership && (
                      <Link
                        to={`/partners/${partnership.id}`}
                        className="flex items-center gap-2.5 text-foreground hover:text-brand-orange transition-colors font-medium group"
                      >
                        <Link2 className="h-4 w-4 text-brand-orange shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="truncate">
                          {t(partnership.partner_name_ar, partnership.partner_name_en)}
                        </span>
                      </Link>
                    )}

                    {project.project_link && (
                      <a
                        href={project.project_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 text-foreground hover:text-brand-orange transition-colors font-medium group"
                      >
                        <ExternalLink className="h-4 w-4 text-brand-orange shrink-0 group-hover:scale-110 transition-transform" />
                        <span>{t('زيارة المشروع', 'Visit Project')}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer
        companyName={companyName}
        links={footerLinks}
        contactInfo={contactInfo || undefined}
      />
    </div>
  );
};

export default ProjectDetailsPage;
