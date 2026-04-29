import { Instagram, Facebook, Youtube } from 'lucide-react';

const WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb7mQlzAjPXVj4LD6520';

export function Footer() {
  const socialLinks = [
    {
      name: 'Instagram',
      icon: Instagram,
      url: 'https://www.instagram.com/iccelshaddai?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==',
      color: 'hover:text-pink-500'
    },
    {
      name: 'Facebook',
      icon: Facebook,
      url: 'https://www.facebook.com/iglesia.elshaddai.505',
      color: 'hover:text-blue-500'
    },
    {
      name: 'WhatsApp',
      icon: () => (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M20.52 3.48A11.86 11.86 0 0 0 12.07 0C5.5 0 .14 5.36.14 11.94c0 2.1.55 4.14 1.59 5.94L0 24l6.3-1.65a11.78 11.78 0 0 0 5.76 1.47h.01c6.57 0 11.93-5.36 11.93-11.94 0-3.19-1.24-6.19-3.48-8.4Zm-8.45 18.33h-.01a9.82 9.82 0 0 1-5.01-1.37l-.36-.21-3.74.98 1-3.65-.24-.38a9.86 9.86 0 0 1-1.52-5.24c0-5.44 4.43-9.87 9.88-9.87 2.63 0 5.1 1.02 6.96 2.89a9.79 9.79 0 0 1 2.89 6.98c0 5.44-4.43 9.87-9.85 9.87Zm5.41-7.39c-.3-.15-1.77-.87-2.04-.96-.27-.1-.47-.15-.67.15s-.77.96-.94 1.16c-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.46-.89-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.45 1.06 2.86 1.21 3.06.15.2 2.08 3.19 5.04 4.47.7.3 1.25.48 1.67.62.7.22 1.34.19 1.84.11.56-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
        </svg>
      ),
      url: WHATSAPP_CHANNEL_URL,
      color: 'hover:text-emerald-400'
    },
    {
      name: 'TikTok',
      icon: () => (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
        </svg>
      ),
      url: 'https://www.tiktok.com/@iglesia.el.shadda?_r=1&_t=ZS-95vqUZkocOy',
      color: 'hover:text-gray-900 dark:hover:text-white'
    },
    {
      name: 'YouTube',
      icon: Youtube,
      url: 'https://youtube.com/@tu-iglesia',
      color: 'hover:text-red-500'
    }
  ];

  return (
    <footer className="relative bg-gradient-to-b from-cyan-600 to-blue-800 dark:from-cyan-800 dark:to-blue-950 text-white py-12">
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-cyan-600/20"></div>

      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center">
          <img
            src={new URL('/src/imports/Diseño_sin_título_(1).png', import.meta.url).href}
            alt="La Barca"
            className="w-20 h-20 mb-6"
          />

          <h3 className="text-2xl md:text-3xl mb-2">El Shaddai</h3>
          <p className="text-cyan-100 mb-8">Cali, Colombia</p>

          <div className="flex gap-6 mb-8">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`p-3 bg-white/10 rounded-full transition-all hover:bg-white/20 ${social.color}`}
                aria-label={social.name}
              >
                <social.icon className="w-6 h-6" />
              </a>
            ))}
          </div>

         

          <div className="mt-8 pt-8 border-t border-cyan-400/30 w-full text-center">
            <p className="text-sm text-cyan-100">
              © {new Date().getFullYear()} El Shaddai - La Barca. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
