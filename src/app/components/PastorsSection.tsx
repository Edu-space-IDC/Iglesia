import { motion } from 'motion/react';
import { useInView } from './useInView';
import { ImageWithFallback } from './ImageWithFallback';

const PASTORS_IMAGE_URL = new URL('../../imports/pastores.png', import.meta.url).href;

export function PastorsSection() {
  const { ref, isInView } = useInView();

  return (
    <section className="py-20 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl text-center mb-12 text-gray-900 dark:text-white">
            Nuestros Pastores
          </h2>

          <div className="max-w-5xl mx-auto bg-white dark:bg-gray-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="md:flex">
              <div className="md:w-[58%] bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900 dark:to-blue-900 flex items-center justify-center p-6 md:p-8">
                <ImageWithFallback
                  src={PASTORS_IMAGE_URL}
                  alt="Pastores"
                  className="block w-full h-auto max-h-[560px] rounded-lg shadow-xl object-contain"
                />
              </div>

              <div className="md:w-[42%] p-8 md:p-12">
                <h3 className="text-3xl mb-4 text-cyan-600 dark:text-cyan-400">
                 Apostol Claudio Palacios y Profeta Patricia Quintero
                </h3>
                <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                  
                </p>
                <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                  Nuestro corazón de servicio y pasión por las almas perdidas es el motor que impulsa cada barca de rescate en nuestra iglesia  <strong className="text-cyan-600 dark:text-cyan-400">Cruzada Cristiana El Shaddai</strong>.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-6 italic">
                 
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
