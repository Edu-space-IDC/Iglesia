import { motion } from 'motion/react';
import { useInView } from './useInView';

export function NewHereClosingBanner() {
  const { ref, isInView } = useInView();

  return (
    <section className="overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#ecfeff_58%,#ffffff_100%)] py-14 dark:bg-[linear-gradient(180deg,#111827_0%,#0f172a_58%,#111827_100%)] md:py-20">
      <div className="container mx-auto px-4">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 32 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
          transition={{ duration: 0.65 }}
          className="relative mx-auto flex min-h-[170px] max-w-7xl items-center justify-center overflow-hidden rounded-[32px] border border-cyan-100 bg-white/80 px-6 py-12 shadow-[0_24px_70px_rgba(14,165,233,0.12)] dark:border-cyan-500/10 dark:bg-slate-900/70"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.16),rgba(34,211,238,0)_58%)]" />

          <div className="pointer-events-none absolute inset-x-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 text-center text-[clamp(4.4rem,15vw,15rem)] font-black uppercase tracking-[0.04em] text-cyan-100/90 dark:text-cyan-950/40">
            Bienvenidos
          </div>

          <div className="relative text-center">
            <p className="text-2xl font-semibold text-slate-900 dark:text-white md:text-4xl">
              <span className="bg-gradient-to-r from-cyan-600 to-blue-700 bg-clip-text text-transparent dark:from-cyan-300 dark:to-blue-300">
                Bienvenido a Casa!
              </span>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

