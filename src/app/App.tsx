import { useEffect, useState } from 'react';
import { ThemeProvider } from 'next-themes';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { AboutSection } from './components/AboutSection';
import { NewHereClosingBanner } from './components/NewHereClosingBanner';
import { NewHereFormSection } from './components/NewHereFormSection';
import { NewHereSection } from './components/NewHereSection';
import { ScheduleSection } from './components/ScheduleSection';
import { PastorsSection } from './components/PastorsSection';
import { LocationSection } from './components/LocationSection';
import { Footer } from './components/Footer';
import { GameSection } from './components/GameSection';
import { isInternalNewHereFormEnabled } from './newHereConfig';

type AppView = 'home' | 'newHereForm';
type PendingNavigation =
  | { type: 'section'; sectionId: string }
  | { type: 'game' }
  | null;

function scrollToElementById(elementId: string) {
  const element = document.getElementById(elementId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export default function App() {
  const [isGameVisible, setIsGameVisible] = useState(false);
  const [isGamePlaying, setIsGamePlaying] = useState(false);
  const [appView, setAppView] = useState<AppView>('home');
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation>(null);
  const showInternalNewHereForm = isInternalNewHereFormEnabled();
  const isFormViewActive = showInternalNewHereForm && appView === 'newHereForm';

  const closeGame = () => {
    setIsGamePlaying(false);
    setIsGameVisible(false);
  };

  const openNewHereFormView = () => {
    closeGame();
    setAppView('newHereForm');
    setPendingNavigation(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const navigateToSection = (sectionId: string) => {
    if (isFormViewActive) {
      setAppView('home');
      setPendingNavigation({ type: 'section', sectionId });
      return;
    }

    scrollToElementById(sectionId);
  };

  const openGame = () => {
    setAppView('home');
    setIsGameVisible(true);
    setPendingNavigation({ type: 'game' });
  };

  useEffect(() => {
    if (appView !== 'home' || pendingNavigation === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (pendingNavigation.type === 'game') {
        scrollToElementById('game');
      } else {
        scrollToElementById(pendingNavigation.sectionId);
      }

      setPendingNavigation(null);
    }, pendingNavigation.type === 'game' ? 140 : 70);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [appView, pendingNavigation, isGameVisible]);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Navbar
          onGameClick={openGame}
          isGamePlaying={isGamePlaying}
          isFormViewActive={isFormViewActive}
          onSectionNavigation={navigateToSection}
        />

        {isFormViewActive ? (
          <>
            <NewHereFormSection />
            <NewHereClosingBanner />
          </>
        ) : (
          <>
            <Hero />
            <AboutSection />
            <NewHereSection onOpenInternalForm={showInternalNewHereForm ? openNewHereFormView : undefined} />
            <GameSection
              isVisible={isGameVisible}
              onHide={() => {
                setIsGamePlaying(false);
                setIsGameVisible(false);
              }}
              onGameplayActiveChange={setIsGamePlaying}
            />
            <ScheduleSection />
            <PastorsSection />
            <LocationSection />
          </>
        )}

        <Footer />
      </div>
    </ThemeProvider>
  );
}
