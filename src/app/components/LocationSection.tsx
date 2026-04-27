import { MapPin, Navigation } from 'lucide-react';

export function LocationSection() {
  const address = "Iglesia Cruzada Cristiana El Shaddai, Colombia";
  const googleMapsUrl = "https://maps.app.goo.gl/ZbEUD2f4iXf7aCHy5";

  return (
    <section id="localizacion" className="py-20 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl mb-4 text-gray-900 dark:text-white">
            Nuestra Localización
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Ven a visitarnos, te esperamos con los brazos abiertos
          </p>
        </div>

        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="grid md:grid-cols-2 gap-0">
            <div className="relative h-64 md:h-96 bg-gray-100 dark:bg-gray-700">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3982.6746257345417!2d-76.4834984!3d3.4291567!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e30a7138b9c9a35%3A0xe3c13d789816090d!2sIglesia%20Cruzada%20Cristiana%20El%20Shaddai!5e0!3m2!1ses-419!2sco!4v1776660819431!5m2!1ses-419!2sco"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0"
              ></iframe>
            </div>

            <div className="p-8 md:p-10 flex flex-col justify-center">
              <div className="mb-6">
                <h3 className="text-2xl mb-3 text-gray-900 dark:text-white">
                  Dirección
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-cyan-500 mt-1 flex-shrink-0" />
                  <span>{address}</span>
                </p>
              </div>

              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-6 py-3 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <Navigation className="w-5 h-5" />
                <span>Abrir en Google Maps</span>
              </a>

              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                Haz clic para obtener direcciones desde tu ubicación
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
