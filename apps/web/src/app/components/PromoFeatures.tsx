'use client';

import { motion } from 'framer-motion';

interface PromoFeature {
  icon: string;
  title: string;
  description: string;
  highlight: string;
}

interface PromoFeaturesProps {
  features: PromoFeature[];
  title: string;
  subtitle: string;
}

export default function PromoFeatures({ features, title, subtitle }: PromoFeaturesProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.6 },
    },
  };

  return (
    <section className="py-20 md:py-32 bg-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-[#d4af37]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#0d7e4d]/10 rounded-full blur-3xl"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-black text-[#ce1126] mb-4">
            🎁 {title}
          </h2>
          <p className="text-xl text-[#5a5a5a]">{subtitle}</p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              className="card-eth p-8 rounded-2xl text-center group relative"
              variants={itemVariants}
              whileHover={{ scale: 1.08, y: -12 }}
            >
              {/* Icon background glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#0d7e4d]/5 to-[#ce1126]/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

              <div className="relative z-10">
                <div className="text-5xl mb-4 transform group-hover:scale-125 group-hover:-rotate-12 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="font-black text-lg text-[#0d7e4d] mb-3 group-hover:text-[#ce1126] transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 mb-4 group-hover:text-gray-900 transition-colors">
                  {feature.description}
                </p>
                <div className="pt-4 border-t border-[#d4af37]/30">
                  <p className="text-sm font-black text-[#d4af37]">{feature.highlight}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
