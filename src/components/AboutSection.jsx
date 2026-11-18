import { motion } from 'framer-motion';
import { TextPressure } from './TextPressure';
import { Lightbulb, Zap, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export const AboutSection = () => {
  const { t } = useTranslation();
  const paragraphs = [
    t('about.paragraph1'),
    t('about.paragraph2'),
    t('about.paragraph3'),
  ];

  return (
    <section id="about" className="py-24 bg-gradient-to-b from-background via-secondary/20 to-background relative overflow-hidden transition-colors">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center gap-3 sm:gap-4 mb-12 sm:mb-16"
        >
          <Lightbulb className="w-8 h-8 sm:w-10 sm:h-10 text-brand-orange" />
          <TextPressure
            text={t('about.title')}
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground text-center"
          />
        </motion.div>

        <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
          {paragraphs.map((text, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <p className="text-lg sm:text-2xl font-medium text-center text-foreground/85 leading-relaxed">
                {text}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto"
        >
          <motion.div
            whileHover={{ scale: 1.03 }}
            className="text-center p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow"
          >
            <Zap className="w-8 h-8 text-brand-orange mx-auto mb-3" />
            <div className="text-sm sm:text-base font-semibold text-foreground">{t('about.stats.mindset')}</div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.03 }}
            className="text-center p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow"
          >
            <TrendingUp className="w-8 h-8 text-brand-orange mx-auto mb-3" />
            <div className="text-sm sm:text-base font-semibold text-foreground">{t('about.stats.solutions')}</div>
          </motion.div>
        </motion.div>

        <div className="mt-10 text-center">
          <Link
            to="/about"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-brand-orange text-brand-orange font-bold hover:bg-brand-orange/10 transition-colors"
          >
            {t('about.learnMore')}
          </Link>
        </div>
      </div>
    </section>
  );
};
