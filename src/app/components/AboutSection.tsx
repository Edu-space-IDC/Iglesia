import { motion } from 'motion/react';
import { useInView } from './useInView';

const ABOUT_LOGO_URL = new URL(
  '../../imports/logo-cruzada-cristiana-blanco-trimmed.png',
  import.meta.url,
).href;

export function AboutSection() {
  const { ref, isInView } = useInView();

  return (
    <section id="quienes-somos" className="bg-white py-20 dark:bg-gray-800">
      <div className="container mx-auto px-4">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl"
        >
          <h2 className="mb-12 text-center text-4xl text-gray-900 dark:text-white md:text-5xl">
            ¿Quiénes Somos?
          </h2>

          <div className="rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 p-8 shadow-xl dark:from-gray-700 dark:to-gray-600 md:p-12">
            <img
              src={ABOUT_LOGO_URL}
              alt="Logo Cruzada Cristiana"
              className="mx-auto mb-8 block h-20 w-auto max-w-full object-contain md:h-28"
            />

            <p className="mb-6 text-lg leading-relaxed text-gray-700 dark:text-gray-200 md:text-xl">
              Somos <strong className="text-cyan-600 dark:text-cyan-400">Cruzada Cristiana</strong>,
              una iglesia comprometida con rescatar vidas que están a la deriva en el mar de este
              mundo. Nuestra misión es clara: salir del puerto y adentrarnos en el mar, donde están
              las personas perdidas, heridas o sin dirección.
            </p>

            <p className="mb-6 text-lg leading-relaxed text-gray-700 dark:text-gray-200 md:text-xl">
              <strong className="text-cyan-600 dark:text-cyan-400">
                No tenemos barcas de lujo, tenemos barcas de rescate.
              </strong>{' '}
              El mar simboliza la vida fuera del propósito de Dios: agitada, incierta y sin
              dirección. Es ahí donde están aquellos a quienes fuimos llamados a rescatar.
            </p>
            <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-200 md:text-xl">
              Cada líder tiene la responsabilidad de remar hacia donde hay necesidad. Las barcas no
              se quedan en el puerto esperando; salen a buscar a quienes <strong className="text-cyan-600 dark:text-cyan-400">necesitan salvación.</strong>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
