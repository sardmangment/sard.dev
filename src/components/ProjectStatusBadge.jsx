import { useTranslation } from 'react-i18next';

// DEV-191: per-project status. "launched" is shown in brand navy, everything else
// (including rows without a status yet) as "in development" in brand orange.
const STYLES = {
  launched: 'bg-brand-navy/10 text-brand-navy border-brand-navy/30',
  in_development: 'bg-brand-orange/15 text-brand-orange border-brand-orange/30',
};

export function ProjectStatusBadge({ status, className = '' }) {
  const { t } = useTranslation();
  const key = status === 'launched' ? 'launched' : 'in_development';
  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-full font-semibold border ${STYLES[key]} ${className}`}
      data-testid="demo-badge"
      data-status={key}
    >
      {t(key === 'launched' ? 'projectsPage.statusLaunched' : 'projectsPage.statusInDevelopment')}
    </span>
  );
}

export default ProjectStatusBadge;
