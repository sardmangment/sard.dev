import { motion } from 'framer-motion';
import { TextPressure } from './TextPressure';
import { Link2, TrendingUp, ShieldCheck, Brain } from 'lucide-react';
import { PILLARS, SERVICES } from '../content/services';

const PILLAR_ICONS = { connect: Link2, grow: TrendingUp, control: ShieldCheck, intelligence: Brain };
import { useTranslation } from 'react-i18next';

export const ServicesSection = () => {
  const { t } = useTranslation();
  
  const services = SERVICES.map((service, index) => ({
    id: service.id,
    pillar: service.pillar,
    icon: PILLAR_ICONS[service.pillar],
    title: t(`services.items.${service.id}.title`),
    description: t(`services.items.${service.id}.description`),
    direction: { x: index % 2 === 0 ? -100 : 100, y: 0 },
  }));

  return (
    <section id="services" className="py-32 bg-background text-foreground relative overflow-hidden transition-colors">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-px h-full bg-gradient-to-b from-transparent via-border to-transparent" />
        <div className="absolute top-1/4 right-0 w-px h-full bg-gradient-to-b from-transparent via-border to-transparent" />
        <div className="absolute left-0 top-1/2 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }} 
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center gap-4 mb-12 sm:mb-20"
        >
          <TextPressure
            text={t('services.title')}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground text-center"
          />
        </motion.div>

        <p className="max-w-3xl mx-auto text-center text-muted-foreground text-sm sm:text-base leading-relaxed -mt-6 sm:-mt-12 mb-12">
          {t('services.subtitle')}
        </p>

        <div className="space-y-14">
          {PILLARS.map((pillar) => {
            const PillarIcon = PILLAR_ICONS[pillar];
            return (
              <div key={pillar} data-pillar={pillar}>
                <div className="flex items-center gap-3 mb-6">
                  <span className="w-10 h-10 rounded-xl bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center">
                    <PillarIcon className="w-5 h-5 text-brand-orange" />
                  </span>
                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold tracking-wider text-foreground">{t(`services.pillars.${pillar}.title`)}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">{t(`services.pillars.${pillar}.description`)}</p>
                  </div>
                </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {services.filter((s) => s.pillar === pillar).map((service, index) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, ...service.direction, y: 30 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true, margin: '-100px' }} 
              transition={{ duration: 0.5, delay: 0, type: 'spring', stiffness: 100 }}
              whileHover={{
                y: -8,
                scale: 1.02,
                rotateY: 4,
              }}
              className="group relative p-6 sm:p-8 rounded-2xl bg-card border border-border hover:border-brand-orange/40 shadow-sm hover:shadow-lg transition-all duration-300"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <motion.div
                whileHover={{
                  rotate: 360,
                  scale: 1.1,
                }}
                whileInView={{
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  rotate: { duration: 0.6 },
                  scale: { duration: 3, repeat: Infinity, repeatType: 'loop', delay: index * 0.1 },
                }}
                className="relative z-10 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mb-4 sm:mb-6 flex items-center justify-center rounded-xl bg-brand-orange/15 group-hover:bg-brand-orange/25 border border-brand-orange/30 shadow-sm"
              >
                <service.icon className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-brand-orange" />
              </motion.div>

              <h3 className="relative z-10 text-lg sm:text-xl font-bold text-foreground mb-3">{service.title}</h3>
              <p className="relative z-10 text-sm sm:text-base text-muted-foreground leading-relaxed">{service.description}</p>
            </motion.div>
          ))}
        </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
