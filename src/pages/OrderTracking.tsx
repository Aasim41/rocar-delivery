import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Clock, ArrowLeft, Lock, Unlock, Loader2, Bell, Truck, Package, MapPin, Navigation2, Star } from 'lucide-react';
import { LiveMap } from '../components/LiveMap';
import { RatingModal } from '../components/RatingModal';
import { motion, AnimatePresence } from 'framer-motion';
import emailjs from '@emailjs/browser';
import { supabase } from '../lib/supabase';

const STATUS_STEPS = [
  { id: 'at_pickup', label: 'Order Placed', desc: 'Waiting for shopkeeper to pack items', icon: Package },
  { id: 'dispatched', label: 'Dispatched', desc: 'Shopkeeper packed items, bot is moving', icon: Truck },
  { id: 'en_route', label: 'En Route', desc: 'Robot is navigating to you', icon: Navigation2 },
  { id: 'arrived', label: 'Arrived', desc: 'Robot has arrived at your location', icon: MapPin },
];

// Haversine distance in meters
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Map backend active_phase to our status index
function phaseToStatusIndex(phase: string): number {
  switch (phase) {
    case 'IDLE': return 0;
    case 'PICKUP': return 1;
    case 'AWAITING_PACKING': return 0;
    case 'DELIVERY': return 2;
    default: return 0;
  }
}

export function OrderTracking() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const type = searchParams.get('type') || 'parcel';
  
  const [currentStatus, setCurrentStatus] = useState(0);
  const [eta, setEta] = useState<number | null>(null);
  
  const [otp, setOtp] = useState('');
  const [expectedOtp, setExpectedOtp] = useState('1234');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const emailSentRef = useRef(false);
  
  // Real GPS position from backend
  const [botLat, setBotLat] = useState<number | undefined>(undefined);
  const [botLng, setBotLng] = useState<number | undefined>(undefined);
  
  // Speed tracking for ETA
  const prevPositionRef = useRef<{lat: number, lng: number, time: number} | null>(null);
  const speedSamplesRef = useRef<number[]>([]);

  // Rating
  const [showRating, setShowRating] = useState(false);
  
  const [dbStatus, setDbStatus] = useState('at_pickup');

  // 1. Subscribe to Supabase order status changes
  useEffect(() => {
    if (!id) return;
    
    supabase.from('orders').select('status').eq('id', id).single().then(({data}) => {
      if (data) setDbStatus(data.status);
    });
    
    const channel = supabase.channel(`order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, (payload) => {
        setDbStatus(payload.new.status);
      }).subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // 2. Sync DB status to our status index (for at_pickup and dispatched transitions)
  useEffect(() => {
    if (dbStatus === 'at_pickup') {
      setCurrentStatus(0);
    } else if (dbStatus === 'dispatched' && currentStatus < 1) {
      setCurrentStatus(1);
    } else if (dbStatus === 'arrived') {
      setCurrentStatus(3);
    }
  }, [dbStatus]);

  // 3. Poll backend for real GPS position & active_phase (replaces fake 6s timer)
  useEffect(() => {
    if (currentStatus < 1) return; // Don't poll until order is dispatched
    
    const pollBackend = async () => {
      try {
        const backendUrl = localStorage.getItem('BACKEND_URL') || 'http://localhost:8000';
        const res = await fetch(`${backendUrl}/status`);
        if (!res.ok) return;
        const data = await res.json();
        
        // Update bot position from backend GPS
        if (data.map_data?.live_location) {
          const newLat = data.map_data.live_location.lat;
          const newLng = data.map_data.live_location.lng;
          
          if (newLat && newLng && (newLat !== 0 || newLng !== 0)) {
            setBotLat(newLat);
            setBotLng(newLng);
            
            // Calculate speed for ETA
            const now = Date.now();
            if (prevPositionRef.current) {
              const dt = (now - prevPositionRef.current.time) / 1000; // seconds
              if (dt > 0.5) {
                const dist = haversineDistance(prevPositionRef.current.lat, prevPositionRef.current.lng, newLat, newLng);
                const speed = dist / dt; // m/s
                if (speed > 0.1 && speed < 50) { // Reasonable speed range
                  speedSamplesRef.current.push(speed);
                  if (speedSamplesRef.current.length > 10) speedSamplesRef.current.shift();
                }
              }
            }
            prevPositionRef.current = { lat: newLat, lng: newLng, time: now };
          }
        }
        
        // Update status from backend's active_phase (Option C)
        if (data.active_phase) {
          const backendStatusIdx = phaseToStatusIndex(data.active_phase);
          // Only advance status, never go backwards (except for IDLE which is handled by arrival)
          if (backendStatusIdx > currentStatus && backendStatusIdx <= 2) {
            setCurrentStatus(backendStatusIdx);
          }
          // If backend says IDLE and we're in DELIVERY phase, bot has arrived
          if (data.active_phase === 'IDLE' && currentStatus >= 2) {
            setCurrentStatus(3);
          }
        }
      } catch (e) {
        // Backend unreachable — that's fine, we'll keep using Supabase status
        console.log('Backend poll failed:', e);
      }
    };
    
    pollBackend(); // Initial fetch
    const interval = setInterval(pollBackend, 500); // Poll every 500ms
    return () => clearInterval(interval);
  }, [currentStatus]);

  // 4. Calculate real ETA based on distance and speed
  useEffect(() => {
    if (!botLat || !botLng || currentStatus >= 3) {
      return;
    }
    
    const distRemaining = haversineDistance(botLat, botLng, dropCoords.lat, dropCoords.lng);
    const avgSpeed = speedSamplesRef.current.length > 0
      ? speedSamplesRef.current.reduce((a, b) => a + b, 0) / speedSamplesRef.current.length
      : null;
    
    if (avgSpeed && avgSpeed > 0.1) {
      const etaSeconds = Math.round(distRemaining / avgSpeed);
      setEta(Math.min(etaSeconds, 3600)); // Cap at 1 hour
    } else if (distRemaining < 50) {
      setEta(0);
    } else {
      // Estimate with default walking speed (1.2 m/s for robot)
      setEta(Math.round(distRemaining / 1.2));
    }
  }, [botLat, botLng, currentStatus]);

  // 5. Auto-detect arrival based on distance (backup for backend phase)
  useEffect(() => {
    if (!botLat || !botLng || currentStatus >= 3) return;
    
    const distToDrop = haversineDistance(botLat, botLng, dropCoords.lat, dropCoords.lng);
    if (distToDrop < 50) { // Within 50 meters
      setCurrentStatus(3);
    }
  }, [botLat, botLng, currentStatus]);

  // 6. When arrived — push notification + email OTP
  useEffect(() => {
    if (currentStatus === 3 && !emailSentRef.current) {
      emailSentRef.current = true;
      setShowNotification(true);
      setEta(0);
      
      // Send browser push notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🤖 Robot Arrived!', {
          body: 'Your delivery robot has arrived. Check your email for the unlock PIN.',
          icon: '/vite.svg',
        });
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(perm => {
          if (perm === 'granted') {
            new Notification('🤖 Robot Arrived!', {
              body: 'Your delivery robot has arrived. Check your email for the unlock PIN.',
              icon: '/vite.svg',
            });
          }
        });
      }
      
      // Update DB status
      if (id) {
        supabase.from('orders').update({ status: 'arrived' }).eq('id', id).then(({error}) => {
          if (error) console.error("Failed to update order to arrived:", error);
        });
      }
      
      // Send email with OTP
      const triggerEmail = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const userEmail = session?.user?.email || localStorage.getItem('onboarding_email') || 'test@example.com';
          const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();
          
          const serviceId: string = 'service_w7qmwoa';
          const templateId: string = 'template_8lkn1x9';
          const publicKey: string = '3MGHBwZxoOMrzO-gV';

          if (serviceId === 'YOUR_SERVICE_ID') {
            console.warn("EmailJS keys not set. Falling back to default PIN 1234.");
            setExpectedOtp("1234");
            return;
          }

          const templateParams = {
            to_email: userEmail,
            passcode: generatedPin,
            time: new Date(Date.now() + 15 * 60000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
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
            setExpectedOtp("1234");
          }
        } catch (err) {
          console.error("Failed to invoke EmailJS:", err);
          setExpectedOtp("1234");
        }
      };

      triggerEmail();
      setTimeout(() => setShowNotification(false), 8000);
    }
  }, [currentStatus, id]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUnlocking(true);
    
    try {
      if (otp === expectedOtp) {
        const backendUrl = localStorage.getItem('BACKEND_URL') || 'http://localhost:8000';
        const response = await fetch(`${backendUrl}/backend/unlock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unlock' })
        });
        
        if (response.ok) {
          setIsUnlocked(true);
        } else {
          setError('Failed to connect to cart.');
        }
      } else {
        setError('Incorrect PIN');
      }
    } catch (err) {
      console.error(err);
      setError('Network error to cart.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleRatingSubmit = async (rating: number, feedback: string) => {
    if (id) {
      await supabase.from('orders').update({ 
        rating, 
        feedback,
        status: 'delivered' 
      }).eq('id', id);
    }
    setShowRating(false);
    navigate('/');
  };

  const formatETA = (seconds: number | null) => {
    if (seconds === null) return 'Calculating...';
    if (seconds === 0) return 'Arrived!';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const startCoords = { 
    lat: parseFloat(searchParams.get('startLat') || '24.6355'), 
    lng: parseFloat(searchParams.get('startLng') || '77.3090') 
  };
  const dropCoords = { 
    lat: parseFloat(searchParams.get('dropLat') || '24.6380'), 
    lng: parseFloat(searchParams.get('dropLng') || '77.3110') 
  };

  // ─── Unlocked Success Screen ───
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
            onClick={() => setShowRating(true)}
            className="w-full minimal-button bg-[var(--color-green)] text-white py-4 text-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Star className="w-5 h-5" /> Rate Your Delivery
          </motion.button>
          
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            onClick={async () => {
              if (id) {
                await supabase.from('orders').update({ status: 'delivered' }).eq('id', id);
              }
              navigate('/');
            }}
            className="mt-3 text-[var(--text-muted)] text-sm font-medium hover:text-[var(--text-main)] transition-colors"
          >
            Skip & Go Home
          </motion.button>
        </motion.div>
        
        <RatingModal 
          isOpen={showRating} 
          onClose={() => {
            setShowRating(false);
            navigate('/');
          }} 
          onSubmit={handleRatingSubmit} 
        />
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
          currentLat={botLat}
          currentLng={botLng}
          isMoving={currentStatus >= 1}
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
          {currentStatus === 3 && (
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
