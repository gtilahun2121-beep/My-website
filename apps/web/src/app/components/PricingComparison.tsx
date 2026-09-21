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
    <section className="py-20 md:py-32 bg-gradient-to-br from-white/40 to-white/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-black text-[#0066ff] mb-4">
            {title}
          </h2>
          <p className="text-xl text-gray-600">{subtitle}</p>
        </motion.div>

        {/* Comparison Table */}
        <motion.div
          className="overflow-hidden rounded-3xl border-2 border-[#0066ff]"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="hidden md:block">
            {/* Desktop Table */}
            <div className="grid grid-cols-3 gap-0">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#0066ff] to-[#0040cc] text-white p-6 font-black text-center border-r-2 border-[#0066ff]">
                Feature
              </div>
              <div className="bg-gray-100 p-6 font-black text-center text-gray-800 border-r-2 border-[#0066ff]">
                Traditional Equb 📋
              </div>
              <div className="bg-gradient-to-r from-[#0066ff] to-brand-500 p-6 font-black text-center text-white">
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
                  <div className={`p-6 font-bold text-center border-r-2 border-[#0066ff] ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}>
                    {item.feature}
                  </div>
                  <div className={`p-6 text-center text-gray-600 border-r-2 border-[#0066ff] ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}>
                    {item.traditional}
                  </div>
                  <div className={`p-6 text-center font-bold text-[#0066ff] ${
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
                <h4 className="font-black text-lg text-[#0066ff] mb-4">{item.feature}</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-bold text-gray-600 mb-1">Traditional Equb 📋</p>
                    <p className="text-[#0066ff]">{item.traditional}</p>
                  </div>
                  <div className="pt-3 border-t border-[#0066ff]">
                    <p className="text-xs font-bold text-[#0066ff] mb-1">QalNet ⭐</p>
                    <p className="font-bold text-[#0066ff]">{item.qalnet}</p>
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
          <p className="text-lg text-gray-700 mb-6 font-semibold">
            Ready to experience the future of Equb? Join thousands of satisfied members today!
          </p>
          <motion.button
            className="px-10 py-4 bg-[#0066ff] text-white font-black rounded-full hover:shadow-2xl transition-all duration-300 text-lg drop-shadow-lg"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
          >
            Get Started Free
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}

