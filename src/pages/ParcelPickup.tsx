import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation as NavIcon, ArrowLeft, Route } from 'lucide-react';
import { LocationMap } from '../components/LocationMap';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { WaveInput } from '../components/WaveInput';
import { AddressModal } from '../components/AddressModal';
import type { SavedLocation } from '../components/AddressModal';

export function ParcelPickup() {
  const [pickup, setPickup] = useState<SavedLocation | null>(null);
  const [dropoff, setDropoff] = useState<SavedLocation | null>(null);
  const [parcelDescription, setParcelDescription] = useState('');
  
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showDropoffModal, setShowDropoffModal] = useState(false);
  
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pickup || !dropoff) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    
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
            ...(pickup && pickup.lat !== undefined && pickup.lng !== undefined
              ? [{ address: `GPS: ${pickup.lat}, ${pickup.lng}`, label: "Pickup" }] 
              : []),
            ...(dropoff && dropoff.lat !== undefined && dropoff.lng !== undefined
              ? [{ address: `GPS: ${dropoff.lat}, ${dropoff.lng}`, label: "Destination" }] 
              : []),
          ]}
        />
      </div>

      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="glass-panel p-6 pb-40 shrink-0 z-20 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)]"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Pickup Selection */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-[var(--text-main)] px-1">Pickup Location</label>
            <button
              type="button"
              onClick={() => setShowPickupModal(true)}
              className="w-full flex items-center p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--color-sky)] transition-all text-left"
            >
              <div className="w-10 h-10 rounded-full bg-[var(--color-sky)]/10 flex items-center justify-center mr-4">
                <MapPin className="h-5 w-5 text-[var(--color-sky)]" />
              </div>
              <div className="flex-1">
                {pickup ? (
                  <>
                    <p className="font-bold text-[var(--text-main)]">{pickup.name}</p>
                    <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{pickup.lat?.toFixed(5)}, {pickup.lng?.toFixed(5)}</p>
                  </>
                ) : (
                  <p className="text-[var(--text-main)] font-medium">Select pickup...</p>
                )}
              </div>
            </button>
          </div>

          {/* Dropoff Selection */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-[var(--text-main)] px-1 mt-2 block">Destination Location</label>
            <button
              type="button"
              onClick={() => setShowDropoffModal(true)}
              className="w-full flex items-center p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl hover:border-[var(--color-sky)] transition-all text-left"
            >
              <div className="w-10 h-10 rounded-full bg-[var(--color-green)]/10 flex items-center justify-center mr-4">
                <NavIcon className="h-5 w-5 text-[var(--color-green)]" />
              </div>
              <div className="flex-1">
                {dropoff ? (
                  <>
                    <p className="font-bold text-[var(--text-main)]">{dropoff.name}</p>
                    <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{dropoff.lat?.toFixed(5)}, {dropoff.lng?.toFixed(5)}</p>
                  </>
                ) : (
                  <p className="text-[var(--text-main)] font-medium">Select destination...</p>
                )}
              </div>
            </button>
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
            disabled={!pickup || !dropoff || !parcelDescription}
            className="w-full minimal-button bg-[var(--color-sky)] text-white py-4 mt-4 text-lg shadow-md flex justify-center items-center space-x-2 disabled:opacity-50"
          >
            <span>Confirm Route</span>
            <Route className="w-5 h-5" />
          </button>
        </form>
      </motion.div>

      <AddressModal 
        isOpen={showPickupModal}
        onClose={() => setShowPickupModal(false)}
        onSelect={setPickup}
        title="Select Pickup Location"
      />
      
      <AddressModal 
        isOpen={showDropoffModal}
        onClose={() => setShowDropoffModal(false)}
        onSelect={setDropoff}
        title="Select Destination"
      />
    </div>
  );
}
