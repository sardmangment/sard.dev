import { motion } from 'framer-motion';
import { TextPressure } from './TextPressure';
import { Heart, Users, Target, Sparkles, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const ValuesSection = () => {
  const { t } = useTranslation();
  
  const values = [
    {
      icon: Heart,
      title: t('values.humanCentered.title'),
      description: t('values.humanCentered.description'),
    },
    {
      icon: Users,
      title: t('values.collaborative.title'),
      description: t('values.collaborative.description'),
    },
    {
      icon: Target,
      title: t('values.purposeDriven.title'),
      description: t('values.purposeDriven.description'),
    },
    {
      icon: Sparkles,
      title: t('values.innovation.title'),
      description: t('values.innovation.description'),
    },
    {
      icon: Shield,
      title: t('values.ethical.title'),
      description: t('values.ethical.description'),
    },
  ];

  return (
    <section className="py-32 bg-background text-foreground relative overflow-hidden transition-colors">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-12 sm:mb-20 text-center"
        >
          <TextPressure
            text={t('values.title')}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground"
          />
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ delay: 0, duration: 0.4 }}
            className="mt-4 sm:mt-6 text-base sm:text-lg md:text-xl text-muted-foreground"
          >
            {t('values.subtitle')}
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
          {values.map((value, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50, rotate: -3 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.4, delay: 0, type: 'spring', stiffness: 100 }}
              whileHover={{
                scale: 1.03,
                y: -5,
              }}
              className="group relative p-6 sm:p-8 rounded-2xl bg-card border border-border hover:border-brand-orange/40 shadow-sm hover:shadow-lg transition-all duration-300"
            >
              <div className="relative z-10">
                <motion.div
                  whileHover={{
                    rotate: [0, -10, 10, -10, 0],
                    scale: 1.15,
                  }}
                  whileInView={{
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    hover: { duration: 0.5 },
                    whileInView: { duration: 3, repeat: Infinity, repeatType: 'loop', delay: index * 0.1 },
                  }}
                  className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mb-4 sm:mb-6 rounded-xl bg-brand-orange/15 group-hover:bg-brand-orange/25 border border-brand-orange/30 shadow-sm"
                >
                  <value.icon className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-brand-orange" />
                </motion.div>

                <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">{value.title}</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{value.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
