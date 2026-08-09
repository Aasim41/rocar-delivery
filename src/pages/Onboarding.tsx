import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ShoppingBag, Map, Bell, User, Moon, Sun, LocateFixed } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WaveInput } from '../components/WaveInput';
import { LocationMap } from '../components/LocationMap';
import { Geolocation } from '@capacitor/geolocation';

const slides = [
  {
    icon: Package,
    title: 'Get your parcel delivered without leaving your room',
    description: 'Autonomous delivery straight to your doorstep.',
    color: 'text-[var(--color-sky)]',
    bg: 'bg-[var(--color-sky)]/10 border border-[var(--color-sky)]/20',
  },
  {
    icon: ShoppingBag,
    title: 'Order medicines & essentials from local shops',
    description: 'Shop from the campus marketplace with zero delivery fees.',
    color: 'text-[var(--color-green)]',
    bg: 'bg-[var(--color-green)]/10 border border-[var(--color-green)]/20',
  },
  {
    icon: Map,
    title: 'Track your delivery live on the map',
    description: 'Know exactly when your delivery will arrive with real-time ETA.',
    color: 'text-[var(--color-purple)]',
    bg: 'bg-[var(--color-purple)]/10 border border-[var(--color-purple)]/20',
  },
  },
];

export function Onboarding({ onComplete }: { onComplete?: () => void }) {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);
  
  // Profile collection state
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [address, setAddress] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(
    () => document.documentElement.classList.contains('dark')
  );

  const toggleTheme = () => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      setIsDarkMode(false);
      localStorage.setItem('theme', 'light');
    } else {
      html.classList.add('dark');
      setIsDarkMode(true);
      localStorage.setItem('theme', 'dark');
    }
  };

  const handleNext = () => {
    setDirection(1);
    setCurrentSlide(prev => prev + 1);
  };

  const handleFinish = () => {
    localStorage.setItem('demo_mode', 'buyer');
    localStorage.setItem('has_seen_onboarding', 'true');
    localStorage.setItem('onboarding_name', name);
    localStorage.setItem('onboarding_age', age);
    localStorage.setItem('onboarding_address', address);
    
    if (onComplete) {
      onComplete();
    }
    navigate('/');
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 50 : -50,
      opacity: 0
    })
  };

  const isFinalSlide = currentSlide === slides.length;

  return (
    <div className="flex flex-col h-[100dvh] bg-[var(--bg-page)] font-sans relative overflow-hidden">
      {/* Premium Animated Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[var(--color-sky)] rounded-full opacity-10 blur-[100px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] right-[-10%] w-80 h-80 bg-[var(--color-green)] rounded-full opacity-10 blur-[100px] pointer-events-none z-0" />

      {/* Floating Dark Mode Toggle */}
      <button 
        onClick={toggleTheme}
        className="absolute top-6 right-6 z-50 w-12 h-12 glass-panel flex items-center justify-center rounded-full text-[var(--text-main)] hover:scale-105 transition-transform shadow-lg"
      >
        {isDarkMode ? <Sun className="w-5 h-5 font-semibold text-[var(--color-yellow)]" /> : <Moon className="w-5 h-5 font-semibold text-[var(--color-sky)]" />}
      </button>

      <div className="flex-1 flex flex-col justify-start sm:justify-center p-6 pt-16 relative z-10 w-full max-w-md mx-auto overflow-y-auto overflow-x-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          {!isFinalSlide ? (
            <motion.div
              key={currentSlide}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              className="w-full text-center flex flex-col items-center"
            >
              <div className={`w-32 h-32 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-sm ${slides[currentSlide].bg}`}>
                {(() => {
                  const SlideIcon = slides[currentSlide].icon;
                  return <SlideIcon className={`w-16 h-16 ${slides[currentSlide].color}`} />;
                })()}
              </div>
              <h1 className="text-2xl font-bold text-[var(--text-main)] mb-4 tracking-tight px-4">{slides[currentSlide].title}</h1>
              <p className="text-[var(--text-muted)] font-medium px-4">{slides[currentSlide].description}</p>
            </motion.div>
          ) : (
            <motion.form
              key="profile-setup"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              onSubmit={(e) => { e.preventDefault(); handleFinish(); }}
              transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              className="w-full"
            >
              <div className="text-center mb-8">
                <div className="w-24 h-24 mx-auto bg-[var(--color-sky)]/10 border border-[var(--color-sky)]/20 rounded-full flex items-center justify-center mb-6">
                  <User className="w-12 h-12 text-[var(--color-sky)]" />
                </div>
                <h1 className="text-2xl font-bold text-[var(--text-main)] mb-2 tracking-tight">Let's get to know you</h1>
                <p className="text-[var(--text-muted)] font-medium">Just a few details before we begin.</p>
              </div>

              <div className="space-y-4 px-4 pb-4">
                <div className="pt-2">
                  <WaveInput
                    type="text"
                    label="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                
                <div className="pt-2">
                  <WaveInput
                    type="number"
                    label="Your Age"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>

                <div className="pt-2 relative">
                  <WaveInput
                    type="text"
                    label="Location (e.g. Dorm)"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  <button 
                    type="button"
                    onClick={async () => {
                      try {
                        const position = await Geolocation.getCurrentPosition();
                        setAddress(`${position.coords.latitude}, ${position.coords.longitude}`);
                      } catch (error) {
                        console.error(error);
                        alert("Please enable GPS permissions to use this feature.");
                      }
                    }}
                    className="absolute right-0 top-6 text-[var(--color-sky)] p-2 hover:bg-[var(--color-sky)]/10 rounded-full transition-colors"
                    title="Use GPS"
                  >
                    <LocateFixed className="w-5 h-5" />
                  </button>
                </div>

                <AnimatePresence>
                  {address.length > 2 && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 200, opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-4 rounded-xl overflow-hidden shadow-inner border border-[var(--border-color)]"
                    >
                      <LocationMap 
                        locations={[{ address, label: "Your Location" }]} 
                        onLocationSelect={setAddress}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      <div className="p-6 relative z-10 w-full max-w-md mx-auto">
        {!isFinalSlide && (
          <div className="flex justify-center space-x-2 mb-8">
            {slides.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  index === currentSlide ? 'bg-[var(--color-sky)] w-6' : 'bg-[var(--text-muted)]/30'
                }`}
              />
            ))}
            <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                currentSlide === slides.length ? 'bg-[var(--color-sky)] w-6' : 'bg-[var(--text-muted)]/30'
              }`} 
            />
          </div>
        )}

        <div className="flex flex-col space-y-3">
          {!isFinalSlide ? (
            <button
              onClick={handleNext}
              className="w-full minimal-button bg-[var(--color-sky)] text-white font-semibold py-4 rounded-xl shadow-lg hover:opacity-90 transition-opacity text-lg"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={() => handleFinish()}
              disabled={!name || !age || !address}
              className="w-full minimal-button bg-[var(--color-sky)] text-white font-semibold py-4 rounded-xl shadow-lg hover:opacity-90 transition-opacity text-lg disabled:opacity-50"
            >
              Get Started
            </button>
          )}
          {!isFinalSlide && (
            <button
              onClick={() => { setDirection(1); setCurrentSlide(slides.length); }}
              className="w-full text-[var(--text-muted)] font-medium py-3 hover:text-[var(--text-main)] transition-colors"
            >
              Skip to Profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
