'use client';

import { motion } from 'framer-motion';

interface ComparisonFeature {
  feature: string;
  traditional: string;
  qalnet: string;
}

interface PricingComparisonProps {
  features: ComparisonFeature[];
  title: string;
  subtitle: string;
}

export default function PricingComparison({
  features,
  title,
  subtitle,
}: PricingComparisonProps) {
  const rowVariants = {
    hidden: { opacity: 0, x: -30 },
    visible: (idx: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.6,
        delay: idx * 0.1,
      },
    }),
  };

  return (
    <section className="py-20 md:py-32 bg-gradient-to-br from-[#f5f3f0] to-[#ece8e3]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-black text-[#0d7e4d] mb-4">
            ⚖️ {title}
          </h2>
          <p className="text-xl text-[#5a5a5a]">{subtitle}</p>
        </motion.div>

        {/* Comparison Table */}
        <motion.div
          className="overflow-hidden rounded-3xl border-2 border-[#d4af37]"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="hidden md:block">
            {/* Desktop Table */}
            <div className="grid grid-cols-3 gap-0">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#0d7e4d] to-[#0a5f3d] text-white p-6 font-black text-center border-r-2 border-[#d4af37]">
                Feature
              </div>
              <div className="bg-gray-100 p-6 font-black text-center text-[#5a5a5a] border-r-2 border-[#d4af37]">
                Traditional Equb 📋
              </div>
              <div className="bg-gradient-to-r from-[#d4af37] to-[#c99d2e] p-6 font-black text-center text-[#0d7e4d]">
                QalNet ⭐
              </div>

              {/* Rows */}
              {features.map((item, idx) => (
                <motion.div
                  key={idx}
                  className="contents"
                  custom={idx}
                  variants={rowVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                >
                  <div className={`p-6 font-bold text-center border-r-2 border-[#d4af37] ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}>
                    {item.feature}
                  </div>
                  <div className={`p-6 text-center text-gray-600 border-r-2 border-[#d4af37] ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}>
                    {item.traditional}
                  </div>
                  <div className={`p-6 text-center font-bold text-[#0d7e4d] ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}>
                    {item.qalnet}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Mobile Comparison */}
          <div className="md:hidden space-y-4 p-6">
            {features.map((item, idx) => (
              <motion.div
                key={idx}
                className="card-eth p-6 rounded-xl"
                custom={idx}
                variants={rowVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <h4 className="font-black text-lg text-[#0d7e4d] mb-4">{item.feature}</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-bold text-[#5a5a5a] mb-1">Traditional Equb 📋</p>
                    <p className="text-gray-700">{item.traditional}</p>
                  </div>
                  <div className="pt-3 border-t border-[#d4af37]">
                    <p className="text-xs font-bold text-[#d4af37] mb-1">QalNet ⭐</p>
                    <p className="font-bold text-[#0d7e4d]">{item.qalnet}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          viewport={{ once: true }}
        >
          <p className="text-lg text-[#5a5a5a] mb-6 font-semibold">
            Ready to experience the future of Equb? Join thousands of satisfied members today!
          </p>
          <motion.button
            className="px-10 py-4 bg-gradient-to-r from-[#0d7e4d] to-[#ce1126] text-white font-black rounded-full hover:shadow-2xl transition-all duration-300 text-lg drop-shadow-lg"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
          >
            Get Started Free 🚀
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}
