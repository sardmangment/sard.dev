import { motion } from 'framer-motion';
import { TextPressure } from './TextPressure';
import SplitText from './SplitText';
import { Telescope } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const VisionSection = () => {
  const { t, i18n } = useTranslation();
  const paragraphs = [
    t('vision.paragraph1'),
    t('vision.paragraph2'),
    t('vision.paragraph3'),
  ];

  return (
    <section className="py-32 bg-gradient-to-b from-secondary/25 via-background to-background relative overflow-hidden transition-colors">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }} 
          transition={{ duration: 0.3 }}
          className="flex items-center justify-center gap-3 sm:gap-4 mb-12 sm:mb-16"
        >
          <motion.div
            animate={{
              rotate: [0, 10, -10, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <Telescope className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-brand-orange" />
          </motion.div>
          <TextPressure
            text={t('vision.title')}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground text-center"
          />
        </motion.div>

        <div className="max-w-5xl mx-auto space-y-8 sm:space-y-12">
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }} 
            transition={{ duration: 0.3 }} 
            className="text-center"
          >
            <SplitText
              text={t('vision.subtitle')}
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground"
              delay={100}
              duration={0.2}
              ease="power3.out"
              splitType="chars"
              direction={i18n.language === "ar" ? "rtl" : "ltr"}
            />
          </motion.div>

          {paragraphs.map((text, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-100px' }} 
              transition={{ duration: 0.3, delay: 0 }}
            >
              <SplitText
                text={text}
                className="text-base sm:text-lg md:text-xl text-foreground/80 leading-relaxed font-normal"
                stagger={0.005} 
                delay={0} 
                direction={i18n.language === "ar" ? "rtl" : "ltr"}
              />
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }} 
            transition={{ duration: 0.3, delay: 0, type: 'spring' }}
            whileHover={{
              scale: 1.01,
            }}
            className="mt-12 sm:mt-16 p-8 sm:p-12 rounded-2xl bg-card border border-border text-center hover:border-brand-orange/40 shadow-sm transition-all"
          >
            <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-medium text-foreground italic">
              "{t('vision.quote')}"
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
