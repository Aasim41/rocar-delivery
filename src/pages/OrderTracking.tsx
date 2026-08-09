import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, ArrowLeft, Lock, Unlock, Loader2, Bell, Truck, Package, MapPin, Navigation2, Check } from 'lucide-react';
import { LiveMap } from '../components/LiveMap';
import { motion, AnimatePresence } from 'framer-motion';
import emailjs from '@emailjs/browser';
import { supabase } from '../lib/supabase';

const STATUS_STEPS = [
  { id: 'dispatched', label: 'Dispatched', desc: 'Robot is on the way to pickup', icon: Truck },
  { id: 'at_pickup', label: 'At Pickup', desc: 'Waiting for items to be loaded', icon: Package },
  { id: 'picked_up', label: 'Picked Up', desc: 'Items loaded successfully', icon: Check },
  { id: 'en_route', label: 'En Route', desc: 'Robot is navigating to you', icon: Navigation2 },
  { id: 'arrived', label: 'Arrived', desc: 'Robot has arrived at your location', icon: MapPin },
];

export function OrderTracking() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get('type') || 'parcel';
  
  const [currentStatus, setCurrentStatus] = useState(0);
  const [eta, setEta] = useState(20); // shortened for hackathon demo
  
  const [otp, setOtp] = useState('');
  const [expectedOtp, setExpectedOtp] = useState('1234');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const emailSentRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStatus(prev => {
        if (prev < STATUS_STEPS.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 4000); // Fast simulation
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setEta(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // When arrived, generate in-app notification and trigger EmailJS
  useEffect(() => {
    if (currentStatus === 4 && !emailSentRef.current) {
      emailSentRef.current = true;
      setShowNotification(true);
      
      const triggerEmail = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const userEmail = session?.user?.email || localStorage.getItem('onboarding_email') || 'test@example.com';
          const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();
          
          // NOTE: Push Notifications via Firebase Cloud Messaging (FCM)
          // In a production environment, you would have a Supabase Edge Function 
          // that listens for changes to the 'orders' table. When an order status 
          // changes to 'arrived', the Edge Function will securely query the user's 
          // 'push_token' and trigger an FCM push notification directly to their phone.
          
          // IMPORTANT: Replace these with your actual EmailJS keys!
          const serviceId: string = 'service_w7qmwoa';
          const templateId: string = 'template_8lkn1x9';
          const publicKey: string = '3MGHBwZxoOMrzO-gV';

          // Prevent crashing if keys aren't set yet during demo
          if (serviceId === 'YOUR_SERVICE_ID') {
            console.warn("EmailJS keys not set. Falling back to default PIN 1234.");
            setExpectedOtp("1234");
            return;
          }

          const templateParams = {
            to_email: userEmail,
            passcode: generatedPin, // Matches {{passcode}} in their template
            time: new Date(Date.now() + 15 * 60000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), // Matches {{time}}
            message: `Your Delivery Robot has arrived! Use PIN: ${generatedPin} to unlock your compartment.`
          };

          const response = await emailjs.send(serviceId, templateId, templateParams, {
            publicKey: publicKey,
          });

          if (response.status === 200) {
            setExpectedOtp(generatedPin);
            console.log("Email Sent Successfully!");
          } else {
            console.error("EmailJS failed:", response);
            setExpectedOtp("1234"); // Fallback
          }
        } catch (err) {
          console.error("Failed to invoke EmailJS:", err);
          setExpectedOtp("1234"); // Fallback
        }
      };

      triggerEmail();
      
      // Auto-hide the popup notification after 8 seconds so it doesn't block UI forever
      setTimeout(() => setShowNotification(false), 8000);
    }
  }, [currentStatus]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUnlocking(true);
    
    setTimeout(() => {
      if (otp === expectedOtp) {
        setIsUnlocked(true);
      } else {
        setError('Incorrect PIN');
      }
      setUnlocking(false);
    }, 800);
  };

  const formatETA = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const startCoords = { lat: 24.6355, lng: 77.3090 };
  const dropCoords = { lat: 24.6380, lng: 77.3110 };

  if (isUnlocked) {
    return (
      <div className="h-screen bg-[var(--bg-page)] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
        <div className="absolute top-[20%] left-[-20%] w-96 h-96 bg-[var(--color-green)] rounded-full opacity-20 blur-[100px] pointer-events-none z-0" />
        
        <motion.div 
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.5, type: 'spring', bounce: 0.4 }}
          className="glass-card p-10 text-center max-w-sm w-full relative z-10 border-[var(--color-green)]/30"
        >
          <div className="relative w-24 h-24 mx-auto mb-6">
            <motion.div 
              className="absolute inset-0 bg-[var(--color-green)]/20 rounded-full"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring" }}
            />
            <motion.div 
              className="absolute inset-0 rounded-full border-4 border-[var(--color-green)]"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
            />
            <motion.div 
              className="absolute inset-0 flex items-center justify-center"
              initial={{ rotate: -45, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.3 }}
            >
              <Unlock className="w-12 h-12 text-[var(--color-green)]" />
            </motion.div>
          </div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-3xl font-bold text-[var(--text-main)] tracking-tight mb-2"
          >
            Unlocked Successfully!
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-[var(--text-muted)] font-medium mb-8 leading-relaxed"
          >
            The compartment is now open.<br/>Please retrieve your items safely.
          </motion.p>
          
          <motion.button 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, type: 'spring' }}
            onClick={() => navigate('/')}
            className="w-full minimal-button bg-[var(--color-green)] text-white py-4 text-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
          >
            Finish Order
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col h-screen bg-[var(--bg-page)] font-sans relative overflow-hidden"
    >
      <div className="absolute top-[20%] left-[-20%] w-96 h-96 bg-[var(--color-sky)] rounded-full opacity-10 blur-[100px] pointer-events-none z-0" />
      
      {/* In-App Notification Toast */}
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="absolute top-20 left-4 right-4 z-50 pointer-events-none"
          >
            <div className="glass-panel max-w-xs mx-auto p-4 rounded-2xl border border-[var(--color-sky)]/30 shadow-2xl flex items-start space-x-3 pointer-events-auto">
              <div className="bg-[var(--color-sky)]/20 p-2 rounded-full shrink-0">
                <Bell className="w-5 h-5 text-[var(--color-sky)]" />
              </div>
              <div>
                <p className="font-bold text-[var(--text-main)] text-sm">Robot Arrived!</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">We just sent an Email with the PIN to unlock the compartment.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="p-4 relative z-20 flex items-center glass-panel m-4 rounded-3xl">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-[var(--bg-page)]/50 border border-[var(--border-color)] flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-page)] transition-colors mr-4 shadow-sm">
          <ArrowLeft className="w-5 h-5 font-semibold" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-main)] tracking-tight leading-none">
            {type === 'parcel' ? 'Parcel' : 'Order'} Tracking
          </h1>
          <p className="text-[var(--text-muted)] font-medium text-xs uppercase mt-1 tracking-wider">#{id?.substring(0, 6).toUpperCase()}</p>
        </div>
      </header>

      <div className="flex-1 relative border-b border-[var(--border-color)] z-10">
        <LiveMap 
          startLat={startCoords.lat}
          startLng={startCoords.lng}
          dropLat={dropCoords.lat}
          dropLng={dropCoords.lng}
        />
      </div>

      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="glass-panel p-6 shrink-0 z-20 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)]"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[var(--text-main)] tracking-tight">Status</h2>
          <div className="bg-[var(--color-sky)]/10 text-[var(--color-sky)] px-3 py-1.5 rounded-xl text-sm font-semibold flex items-center space-x-1.5 border border-[var(--color-sky)]/20 shadow-sm">
            <Clock className="w-4 h-4" />
            <span>{formatETA(eta)}</span>
          </div>
        </div>
        
        <div className="space-y-4 relative ml-2">
          <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-[var(--border-color)]" />
          
          {STATUS_STEPS.map((step, index) => {
            const isCompleted = index <= currentStatus;
            const isCurrent = index === currentStatus;
            
            return (
              <div key={step.id} className="flex items-start relative z-10">
                <div className="relative mt-0.5 shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 border-[var(--border-color)] relative z-10 transition-colors ${
                    isCompleted ? 'bg-[var(--color-green)] border-[var(--color-green)]' : 'bg-[var(--card-bg)]'
                  }`}>
                    {isCompleted ? <step.icon className="w-4 h-4 text-white font-bold" /> : <div className="w-2 h-2 rounded-full bg-[var(--text-muted)] opacity-30" />}
                  </div>
                </div>
                
                <div className="ml-4 pt-1">
                  <p className={`font-semibold tracking-wide transition-colors duration-500 ${
                    isCurrent ? 'text-[var(--text-main)] text-lg' : isCompleted ? 'text-[var(--text-main)] opacity-80' : 'text-[var(--text-muted)]'
                  }`}>
                    {step.label}
                  </p>
                  <AnimatePresence>
                    {isCurrent && (
                      <motion.p 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-xs font-medium text-[var(--text-muted)] mt-1"
                      >
                        {step.desc}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>

        {/* OTP UNLOCK UI */}
        <AnimatePresence>
          {currentStatus === 4 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 pt-6 border-t border-[var(--border-color)]"
            >
              <div className="bg-[var(--color-yellow)]/10 border border-[var(--color-yellow)]/30 rounded-2xl p-4 mb-4 shadow-sm">
                <p className="font-semibold text-[var(--text-main)] text-sm leading-snug">
                  Robot has arrived! Check your Email for the PIN to unlock the compartment.
                </p>
              </div>
              <form onSubmit={handleUnlock} className="flex space-x-3">
                <input
                  type="text"
                  maxLength={4}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="PIN"
                  className="flex-1 min-w-0 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl px-4 py-3 text-xl font-bold text-center tracking-[0.25em] text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--color-sky)] focus:ring-2 focus:ring-[var(--color-sky)]/20 transition-all"
                  required
                />
                <button
                  type="submit"
                  disabled={otp.length < 4 || unlocking}
                  className="minimal-button bg-[var(--text-main)] text-[var(--bg-page)] px-6 rounded-2xl flex items-center justify-center disabled:opacity-50"
                >
                  {unlocking ? <Loader2 className="w-6 h-6 animate-spin" /> : <Lock className="w-6 h-6" />}
                </button>
              </form>
              {error && <p className="text-[var(--color-red)] text-sm font-semibold mt-2 text-center">{error}</p>}
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </motion.div>
  );
}
