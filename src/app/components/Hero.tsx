import { motion } from 'motion/react';
import { WaveAnimation } from './WaveAnimation';
import { BoatAnimation } from './BoatAnimation';

export function Hero() {
  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-cyan-50 to-white dark:from-gray-900 dark:to-gray-800 ">
      <WaveAnimation className="bottom-0 h-32" />

      <div className="container mx-auto px-4 text-center z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <BoatAnimation />
          <h1 className="text-5xl md:text-7xl mb-4 text-gray-900 dark:text-white scale-125">
            El Shaddai
          </h1>
          <div className="relative inline-block mb-8">
            <h2 className="text-3xl md:text-4xl text-cyan-600 dark:text-cyan-400 scale-125">
              La Barca
            </h2>
            <svg className="absolute -bottom-2 left-0 w-full" height="8" viewBox="0 0 200 8">
              <path
                d="M0,4 Q50,0 100,4 T200,4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-cyan-500"
              />
            </svg>
          </div>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Saliendo al mar para rescatar vidas, llevando esperanza a los perdidos
          </p>
        </motion.div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-cyan-500"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 5v14m0 0l-7-7m7 7l7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </motion.div>
      </div>
    </section>
  );
}
