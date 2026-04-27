import { motion } from 'motion/react';
import { Anchor } from 'lucide-react';
import { useInView } from './useInView';
import { WaveAnimation } from './WaveAnimation';
import {
  NEW_HERE_EXTERNAL_URL,
  isInternalNewHereFormEnabled,
} from '../newHereConfig';

interface NewHereSectionProps {
  onOpenInternalForm?: () => void;
}

export function NewHereSection({ onOpenInternalForm }: NewHereSectionProps) {
  const { ref, isInView } = useInView();
  const isInternalFormEnabled = isInternalNewHereFormEnabled() && Boolean(onOpenInternalForm);

  return (
    <section
      id="nuevo"
      className="relative overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-600 py-20 dark:from-cyan-700 dark:to-blue-900"
    >
      <WaveAnimation className="top-0 h-24 rotate-180" />
      <WaveAnimation className="bottom-0 h-24" />

      <div className="container mx-auto px-4">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center text-white"
        >
          <Anchor className="mx-auto mb-6 h-16 w-16" />
          <h2 className="mb-6 text-4xl md:text-5xl">¿Eres Nuevo?</h2>
          <p className="mb-8 text-xl text-cyan-50 md:text-2xl">
            ¡Te damos la bienvenida a La Barca! Nos encantaria conocerte y acompanarte en este
            viaje de fe.
          </p>

          {isInternalFormEnabled ? (
            <button
              onClick={onOpenInternalForm}
              className="inline-block rounded-full bg-white px-8 py-4 text-xl text-cyan-600 shadow-lg transition-all hover:scale-105 hover:bg-cyan-50"
            >
              Abrir formulario
            </button>
          ) : (
            <a
              href={NEW_HERE_EXTERNAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full bg-white px-8 py-4 text-xl text-cyan-600 shadow-lg transition-all hover:scale-105 hover:bg-cyan-50"
            >
              Conoce mas aqui
            </a>
          )}
        </motion.div>
      </div>
    </section>
  );
}
