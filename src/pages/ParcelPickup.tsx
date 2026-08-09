import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation as NavIcon, ArrowLeft, Route } from 'lucide-react';
import { LocationMap } from '../components/LocationMap';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { WaveInput } from '../components/WaveInput';

export function ParcelPickup() {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [customPickup, setCustomPickup] = useState('');
  const [customDropoff, setCustomDropoff] = useState('');
  const [saveNewDropoff, setSaveNewDropoff] = useState(false);
  const [parcelDescription, setParcelDescription] = useState('');
  
  const [savedLocations, setSavedLocations] = useState<any[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  
  const navigate = useNavigate();

  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    fetchSavedLocations();
  }, []);

  const fetchSavedLocations = async () => {
    let currentUserId = null;
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      currentUserId = session.user.id;
    } else if (localStorage.getItem('demo_mode') === 'buyer') {
      currentUserId = 'demo-user-123';
    }
    
    if (currentUserId) {
      const { data } = await supabase.from('users').select('saved_locations').eq('id', currentUserId).single();
      if (data && data.saved_locations) {
        setSavedLocations(data.saved_locations);
      }
    }
    setLoadingLocations(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalPickup = pickup === 'custom' ? customPickup : pickup;
    const finalDropoff = dropoff === 'custom' ? customDropoff : dropoff;
    
    if (!finalPickup || !finalDropoff) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (dropoff === 'custom' && saveNewDropoff && customDropoff.trim()) {
      let currentUserId = null;
      if (session) {
        currentUserId = session.user.id;
      } else if (localStorage.getItem('demo_mode') === 'buyer') {
        currentUserId = 'demo-user-123';
      }
      
      if (currentUserId) {
        const newLocations = [...savedLocations, { name: customDropoff.trim() }];
        await supabase.from('users').update({ saved_locations: newLocations }).eq('id', currentUserId);
      }
    }
    
    let orderId = Math.random().toString(36).substring(7);
    
    if (session && session.user.id !== 'demo-user-123') {
      // Parcel Pickup orders aren't attached to a real shop, but the schema requires shop_id.
      // So we fallback to picking the first shop in the database.
      const { data: fallbackShop } = await supabase.from('shops').select('id').limit(1).single();

      const orderData = {
        user_id: session.user.id,
        shop_id: fallbackShop?.id,
        status: 'dispatched',
        total_weight_grams: 500, // default estimation for parcel pickup
        items: [{ 
          id: 'parcel', 
          name: parcelDescription ? `Parcel: ${parcelDescription}` : 'Custom Parcel Delivery', 
          qty: 1, 
          price: 0 
        }]
      };

      const { data, error } = await supabase.from('orders').insert([orderData]).select().single();
      if (data && !error) {
        orderId = data.id;
      } else {
        console.error("Failed to create order:", error);
        alert("Order failed: " + (error?.message || "Unknown error"));
      }
    }
    
    navigate(`/tracking/${orderId}?type=parcel`);
  };

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-page)] font-sans relative overflow-hidden">
      <div className="absolute top-[20%] left-[-20%] w-96 h-96 bg-[var(--color-sky)] rounded-full opacity-10 blur-[100px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-[var(--color-green)] rounded-full opacity-10 blur-[100px] pointer-events-none z-0" />

      <header className="p-6 relative z-20 flex items-center glass-panel">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-[var(--bg-page)]/50 border border-[var(--border-color)] flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-page)] transition-colors mr-4 shadow-sm">
          <ArrowLeft className="w-5 h-5 font-semibold" />
        </button>
        <h1 className="text-2xl font-bold text-[var(--text-main)] tracking-tight">Send Parcel</h1>
      </header>

      <div className="flex-1 relative z-10">
        <LocationMap 
          locations={[
            ...(pickup && pickup !== 'custom' ? [{ address: pickup, label: "Pickup" }] : (pickup === 'custom' && customPickup.length > 2) ? [{ address: customPickup, label: "Pickup" }] : []),
            ...(dropoff && dropoff !== 'custom' ? [{ address: dropoff, label: "Destination" }] : (dropoff === 'custom' && customDropoff.length > 2) ? [{ address: customDropoff, label: "Destination" }] : []),
          ]}
          onLocationSelect={(val) => {
            if (!pickup || (pickup === 'custom' && !customPickup)) {
              setPickup('custom');
              setCustomPickup(val);
            } else {
              setDropoff('custom');
              setCustomDropoff(val);
            }
          }}
        />
      </div>

      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="glass-panel p-6 shrink-0 z-20 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)]"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Pickup Selection */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-[var(--text-main)] px-1">Pickup Location</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <MapPin className="h-5 w-5 text-[var(--text-muted)]" />
              </div>
              <select
                required
                value={pickup}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'gps') {
                    if ("geolocation" in navigator) {
                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
                          setPickup('Current Location (GPS)');
                        },
                        (error) => {
                          console.error("Location error:", error);
                          alert("Please enable GPS permissions to use this feature.");
                          setPickup('');
                        }
                      );
                    }
                  } else {
                    setPickup(val);
                  }
                }}
                className="block w-full pl-12 pr-4 py-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl text-[var(--text-main)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-sky)] transition-all appearance-none"
              >
                <option value="" disabled>Select pickup...</option>
                <option value="gps">📍 Use Current Location (GPS)</option>
                <option value="custom">+ Type a custom address</option>
              </select>
            </div>
            {pickup === 'custom' && (
              <div className="pt-2">
                <WaveInput 
                  type="text" 
                  required
                  label="Pickup Address"
                  value={customPickup}
                  onChange={e => setCustomPickup(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Dropoff Selection */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-[var(--text-main)] px-1 mt-2 block">Destination Location</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <NavIcon className="h-5 w-5 text-[var(--text-muted)]" />
              </div>
              <select
                required
                disabled={loadingLocations}
                value={dropoff}
                onChange={(e) => setDropoff(e.target.value)}
                className="block w-full pl-12 pr-4 py-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl text-[var(--text-main)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-sky)] transition-all appearance-none disabled:opacity-50"
              >
                <option value="" disabled>{loadingLocations ? 'Loading addresses...' : 'Select destination...'}</option>
                {savedLocations.map((loc, idx) => (
                  <option key={idx} value={loc.name}>⭐ {loc.name}</option>
                ))}
                <option value="custom">+ Type a new address</option>
              </select>
            </div>
            {dropoff === 'custom' && (
              <div className="mt-2 space-y-2 bg-[var(--bg-page)]/30 p-3 rounded-xl border border-[var(--border-color)]">
                <div className="pt-2">
                  <WaveInput 
                    type="text" 
                    required
                    label="Destination Address"
                    value={customDropoff}
                    onChange={e => setCustomDropoff(e.target.value)}
                  />
                </div>
                <label className="flex items-center space-x-2 text-sm text-[var(--text-main)] px-1 cursor-pointer pt-2">
                  <input type="checkbox" checked={saveNewDropoff} onChange={e => setSaveNewDropoff(e.target.checked)} className="rounded text-[var(--color-sky)] focus:ring-[var(--color-sky)] w-4 h-4" />
                  <span>Save this address for next time</span>
                </label>
              </div>
            )}
          </div>

          {/* Parcel Description */}
          <div className="space-y-2 pt-2">
            <WaveInput
              type="text"
              required
              label="What are we delivering? (e.g. Keys, Books)"
              value={parcelDescription}
              onChange={e => setParcelDescription(e.target.value)}
            />
          </div>

          <button 
            type="submit"
            className="w-full minimal-button bg-[var(--color-sky)] text-white py-4 mt-4 text-lg shadow-md flex justify-center items-center space-x-2"
          >
            <span>Confirm Route</span>
            <Route className="w-5 h-5" />
          </button>
        </form>
      </motion.div>
    </div>
  );
}
