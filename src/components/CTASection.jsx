import { motion } from 'framer-motion';
import SplitText from './SplitText';
import { PrimeTag } from './PrimeTag';
import { Rocket } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export const CTASection = () => {
  const { t, i18n } = useTranslation();
  return (
    <section className="py-32 bg-gradient-to-b from-background via-secondary/20 to-background relative overflow-hidden transition-colors">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.4 }}
          className="max-w-4xl mx-auto text-center"
        >
          <motion.div
            animate={{
              y: [0, -15, 0],
              rotate: [0, 8, -8, 0],
              scale: [1, 1.08, 1],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
            }}
            className="inline-block mb-6 sm:mb-8"
          >
            <Rocket className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 text-brand-orange" />
          </motion.div>
          <SplitText
            text={t('cta.title')}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl py-2 font-bold text-foreground mb-6 sm:mb-8"
            delay={35}
            duration={0.6}
            ease="power3.out"
            splitType="chars"
            direction={i18n.language === "ar" ? "rtl" : "ltr"}
          />

          <SplitText
            text={t('cta.description')}
            className="text-base sm:text-lg md:text-xl lg:text-2xl text-foreground/80 mb-8 sm:mb-12 leading-relaxed font-normal"
            stagger={0.005}
            delay={0} 
            direction={i18n.language === "ar" ? "rtl" : "ltr"}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ delay: 0, duration: 0.5 }} 
            className="flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-6 justify-center"
          >
            <Link to="/calendar">
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="group relative px-8 sm:px-10 py-4 sm:py-5 bg-brand-orange text-brand-gray-light font-bold text-base sm:text-lg rounded-xl overflow-hidden shadow-lg shadow-brand-orange/30 w-full sm:w-auto hover:bg-brand-orange-400 transition-all cursor-pointer"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {t('cta.getStarted')}
                  <Rocket className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </motion.button>
            </Link>

            <Link to="/ai">
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="relative px-8 sm:px-10 py-4 sm:py-5 border-2 border-brand-orange text-brand-orange font-bold text-base sm:text-lg rounded-xl overflow-hidden group shadow-sm hover:bg-brand-orange/10 w-full sm:w-auto transition-all cursor-pointer"
              >
                <span className="relative z-10 inline-flex items-center gap-2">{t('cta.learnMore')}<PrimeTag /></span>
              </motion.button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ delay: 0, duration: 0.5 }} 
            className="mt-12 sm:mt-16 pt-12 sm:pt-16 border-t border-border"
          >
            <motion.p
              className="text-muted-foreground text-base sm:text-lg"
              animate={{
                opacity: [0.7, 1, 0.7],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                repeatType: 'loop',
              }}
            >
              {t('cta.question')}
            </motion.p>
            <motion.p
              className="text-foreground text-lg sm:text-xl font-bold mt-2"
              animate={{
                scale: [1, 1.02, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: 'loop',
              }}
            >
              {t('cta.callToAction')}
            </motion.p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
