import { EllipsisVertical, Gamepad2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const NAVBAR_LOGO_URL = new URL('../../imports/logo-barca.png', import.meta.url).href;
const CHURCH_LOGO_URL = new URL(
  '../../imports/logo-iglesia-pequeno-trimmed.png',
  import.meta.url,
).href;

const NAV_ITEMS = [
  { id: 'home', label: 'Home' },
  { id: 'nuevo', label: '\u00bfNuevo aqu\u00ed?' },
  { id: 'localizacion', label: 'Localizaci\u00f3n' },
  { id: 'horarios', label: 'Horarios' },
];

interface NavbarProps {
  onGameClick: () => void;
  isGamePlaying: boolean;
  isFormViewActive?: boolean;
  onSectionNavigation?: (sectionId: string) => void;
}

export function Navbar({
  onGameClick,
  isGamePlaying,
  isFormViewActive = false,
  onSectionNavigation,
}: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCompactMenuOpen, setIsCompactMenuOpen] = useState(false);

  useEffect(() => {
    if (isGamePlaying) {
      setIsMobileMenuOpen(false);
      return;
    }

    setIsCompactMenuOpen(false);
  }, [isGamePlaying]);

  const scrollToSection = (id: string) => {
    if (onSectionNavigation) {
      onSectionNavigation(id);
    } else {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }

    setIsMobileMenuOpen(false);
    setIsCompactMenuOpen(false);
  };

  const scrollToGame = () => {
    onGameClick();
    setIsMobileMenuOpen(false);
    setIsCompactMenuOpen(false);
  };

  return (
    <>
      <style>{`
        @keyframes navbar-water-sweep {
          0% {
            transform: translateX(-135%) skewX(-18deg);
            opacity: 0;
          }
          24% {
            opacity: 0.2;
          }
          52% {
            opacity: 0.5;
          }
          100% {
            transform: translateX(235%) skewX(-18deg);
            opacity: 0;
          }
        }

        @keyframes navbar-compact-float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-3px);
          }
        }
      `}</style>

      <nav
        className={`fixed left-0 right-0 top-0 z-50 overflow-hidden border-b border-gray-200 bg-white/80 backdrop-blur-lg transition-all duration-700 ease-out dark:border-gray-800 dark:bg-gray-900/80 ${
          isGamePlaying ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-y-0 -left-[26%] w-[38%] bg-[linear-gradient(90deg,rgba(34,211,238,0)_0%,rgba(125,211,252,0.18)_35%,rgba(186,230,253,0.5)_56%,rgba(34,211,238,0)_100%)] blur-2xl"
            style={
              isGamePlaying
                ? { animation: 'navbar-water-sweep 720ms cubic-bezier(0.22, 1, 0.36, 1) both' }
                : undefined
            }
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))]" />
        </div>

        <div className="relative container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-3 md:gap-8">
            <button
              onClick={() => scrollToSection('home')}
              className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-80"
            >
              <div className="flex shrink-0 items-center gap-2">
                <img
                  src={NAVBAR_LOGO_URL}
                  alt="La Barca Logo"
                  className="h-12 w-auto object-contain md:h-14"
                />
                <img
                  src={CHURCH_LOGO_URL}
                  alt="Cruzada Cristiana Logo"
                  className="h-8 w-auto object-contain md:h-13"
                />
              </div>

              <div className="min-w-0 text-left">
                <span className="block truncate text-lg font-medium text-gray-900 dark:text-white md:text-xl">
                  La Barca
                </span>
                <span className="hidden text-[11px] uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-300 sm:block">
                  {isFormViewActive ? 'Formulario de bienvenida' : 'Cruzada Cristiana'}
                </span>
              </div>
            </button>

            <div className="hidden items-center gap-6 md:flex">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="text-gray-700 transition-colors hover:text-cyan-500 dark:text-gray-300 dark:hover:text-cyan-400"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex items-center gap-2 md:gap-3">
            <button
              onClick={scrollToGame}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-3 py-2 transition-all hover:scale-105 hover:from-cyan-600 hover:to-blue-600"
              aria-label="Jugar minijuego"
              title="Prueba nuestro minijuego!"
            >
              <Gamepad2 className="h-5 w-5 text-white" />
              <span className="text-xs font-semibold text-white sm:text-sm">Minijuego!</span>
            </button>

            <button
              onClick={() => setIsMobileMenuOpen((current) => !current)}
              className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 hover:text-cyan-500 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-cyan-400 md:hidden"
              aria-label={isMobileMenuOpen ? 'Cerrar menu' : 'Abrir menu'}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <EllipsisVertical className="h-5 w-5" />
              )}
            </button>

            {isMobileMenuOpen && (
              <div className="absolute right-0 top-full mt-3 w-56 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/92 p-2 shadow-[0_18px_50px_rgba(2,6,23,0.35)] backdrop-blur-xl md:hidden">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="mt-1 block w-full rounded-xl px-4 py-3 text-left text-sm text-slate-100 transition-colors first:mt-0 hover:bg-white/8 hover:text-cyan-300"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>

      <div
        className={`fixed right-4 top-4 z-[70] transition-all duration-500 ease-out ${
          isGamePlaying ? 'translate-y-0 opacity-100' : '-translate-y-6 opacity-0 pointer-events-none'
        }`}
      >
        <div className="relative">
          <div
            className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(186,230,253,0.44),rgba(14,165,233,0.15)_55%,rgba(14,165,233,0)_80%)] blur-xl"
            style={
              isGamePlaying
                ? { animation: 'navbar-compact-float 2.7s ease-in-out infinite' }
                : undefined
            }
          />

          <button
            onClick={() => setIsCompactMenuOpen((current) => !current)}
            className="relative flex h-12 w-12 items-center justify-center rounded-full border border-cyan-200/18 bg-slate-950/72 text-cyan-50 shadow-[0_20px_45px_rgba(2,6,23,0.45)] backdrop-blur-xl transition-transform duration-300 hover:scale-105"
            aria-label={isCompactMenuOpen ? 'Cerrar navegacion' : 'Abrir navegacion'}
            title="Navegacion"
          >
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-100 shadow-[0_0_12px_rgba(186,230,253,0.7)]" />
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(103,232,249,0.7)]" />
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.75)]" />
            </span>
          </button>

          {isCompactMenuOpen && (
            <div className="absolute right-0 top-full mt-3 w-60 overflow-hidden rounded-[28px] border border-cyan-100/12 bg-slate-950/88 p-2 shadow-[0_22px_65px_rgba(2,6,23,0.42)] backdrop-blur-xl">
              <div className="mb-2 rounded-2xl bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgba(37,99,235,0.22))] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-100">
                Navegacion
              </div>

              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="mt-1 block w-full rounded-2xl px-4 py-3 text-left text-sm text-slate-100 transition-colors first:mt-0 hover:bg-white/8 hover:text-cyan-300"
                >
                  {item.label}
                </button>
              ))}

              <button
                onClick={scrollToGame}
                className="mt-2 flex w-full items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#22d3ee_0%,#0ea5e9_45%,#2563eb_100%)] px-4 py-3 text-left text-sm font-semibold text-white shadow-[0_12px_34px_rgba(14,165,233,0.25)]"
              >
                <Gamepad2 className="h-4 w-4" />
                Volver al juego
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
