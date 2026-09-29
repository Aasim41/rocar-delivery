import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Send, MapPin, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WaveInput } from '../components/WaveInput';

const slides = [
  {
    icon: Package,
    title: 'Send packages across campus without walking',
    description: 'Our autonomous carts pick up and deliver anything, anywhere on campus.',
  },
  {
    icon: Send,
    title: 'Send or Fetch — your choice',
    description: 'Dispatch a package to someone, or request an empty cart to collect an item for you.',
  },
  {
    icon: MapPin,
    title: 'Track your delivery live',
    description: 'Watch the cart navigate in real-time on the map. Get notified when it arrives.',
  },
];

export function Onboarding({ onComplete }: { onComplete?: () => void }) {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);
  
  const [name, setName] = useState('');
  const [age, setAge] = useState('');

  const handleNext = () => {
    setDirection(1);
    setCurrentSlide(prev => prev + 1);
  };

  const handleFinish = () => {
    localStorage.setItem('demo_mode', 'buyer');
    localStorage.setItem('has_seen_onboarding', 'true');
    localStorage.setItem('onboarding_name', name);
    localStorage.setItem('onboarding_age', age);
    
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
    <div className="flex flex-col h-[100dvh] bg-zinc-950 font-sans relative overflow-hidden">
      {/* Subtle ambient glow */}
      <div className="absolute top-[-15%] left-[-15%] w-96 h-96 bg-zinc-700 rounded-full opacity-10 blur-[120px] pointer-events-none z-0" />

      <div className="flex-1 flex flex-col justify-start sm:justify-center p-6 pt-20 relative z-10 w-full max-w-md mx-auto overflow-y-auto overflow-x-hidden">
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
              <div className="w-28 h-28 rounded-3xl flex items-center justify-center mb-8 bg-zinc-900 border border-zinc-800">
                {(() => {
                  const SlideIcon = slides[currentSlide].icon;
                  return <SlideIcon className="w-14 h-14 text-white" />;
                })()}
              </div>
              <h1 className="text-2xl font-bold text-white mb-4 tracking-tight px-4">{slides[currentSlide].title}</h1>
              <p className="text-zinc-500 font-medium px-4 text-[15px]">{slides[currentSlide].description}</p>
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
                <div className="w-20 h-20 mx-auto bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mb-6">
                  <User className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Let's get to know you</h1>
                <p className="text-zinc-500 font-medium">Just a few details before we begin.</p>
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
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentSlide ? 'bg-white w-8' : 'bg-zinc-800 w-2'
                }`}
              />
            ))}
            <div className={`h-1.5 rounded-full transition-all duration-300 ${
                currentSlide === slides.length ? 'bg-white w-8' : 'bg-zinc-800 w-2'
              }`} 
            />
          </div>
        )}

        <div className="flex flex-col space-y-3">
          {!isFinalSlide ? (
            <button
              onClick={handleNext}
              className="w-full bg-white text-zinc-900 font-semibold py-4 rounded-xl hover:bg-zinc-200 transition-colors text-[15px]"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={() => handleFinish()}
              disabled={!name || !age}
              className="w-full bg-white text-zinc-900 font-semibold py-4 rounded-xl hover:bg-zinc-200 transition-colors text-[15px] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Get Started
            </button>
          )}
          {!isFinalSlide && (
            <button
              onClick={() => { setDirection(1); setCurrentSlide(slides.length); }}
              className="w-full text-zinc-600 font-medium py-3 hover:text-zinc-400 transition-colors text-sm"
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
