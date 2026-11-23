import { motion } from 'framer-motion';
import { TextPressure } from './TextPressure';
import { Link2, TrendingUp, ShieldCheck, Brain, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PILLARS, SERVICES } from '../content/services';

const PILLAR_ICONS = { connect: Link2, grow: TrendingUp, control: ShieldCheck, intelligence: Brain };

// DEV-188: home page shows a compact view — one card per pillar with its service titles only.
export const ServicesSection = () => {
  const { t } = useTranslation();

  return (
    <section id="services" className="py-24 bg-background text-foreground relative overflow-hidden transition-colors">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center gap-4 mb-12 sm:mb-16"
        >
          <TextPressure
            text={t('services.title')}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground text-center"
          />
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PILLARS.map((pillar, index) => {
            const PillarIcon = PILLAR_ICONS[pillar];
            const items = SERVICES.filter((s) => s.pillar === pillar);
            return (
              <motion.div
                key={pillar}
                data-pillar={pillar}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="p-6 rounded-2xl bg-card border border-border hover:border-brand-orange/40 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-10 h-10 rounded-xl bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center shrink-0">
                    <PillarIcon className="w-5 h-5 text-brand-orange" />
                  </span>
                  <h3 className="text-lg font-extrabold tracking-wider text-foreground">
                    {t(`services.pillars.${pillar}.title`)}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{t(`services.pillars.${pillar}.description`)}</p>
                <ul className="space-y-2">
                  {items.map((s) => (
                    <li key={s.id} className="flex items-start gap-2 text-sm font-semibold text-foreground/90">
                      <Check className="w-4 h-4 mt-0.5 text-brand-orange shrink-0" />
                      <span>{t(`services.items.${s.id}.title`)}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
