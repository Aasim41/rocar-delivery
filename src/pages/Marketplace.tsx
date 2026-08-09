import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, AlertCircle, ArrowLeft, MapPin, LocateFixed, Loader2 } from 'lucide-react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { LocationMap } from '../components/LocationMap';
import { WaveInput } from '../components/WaveInput';

import { supabase } from '../lib/supabase';

const MAX_PAYLOAD_GRAMS = 2000;

function CatalogItem({ item, cart, updateCart }: any) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div 
      ref={ref}
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 30, scale: 0.95 }}
      transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
      className={`glass-card p-5 transition-all ${!item.in_stock ? 'opacity-50 grayscale' : ''}`}
    >
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-[var(--text-main)] text-lg tracking-tight">{item.name}</h3>
            {!item.in_stock && <span className="text-[10px] uppercase tracking-wider font-semibold bg-[var(--text-muted)]/20 text-[var(--text-muted)] px-2 py-0.5 rounded-md">Out of Stock</span>}
          </div>
          <p className="text-[var(--text-muted)] font-medium mt-1 text-sm bg-[var(--color-sky)]/10 inline-block px-2 py-0.5 rounded-md text-[var(--color-sky)]">${item.price.toFixed(2)} • {item.weight}g</p>
        </div>
        
        <div className="flex items-center space-x-3 bg-[var(--bg-page)]/50 rounded-2xl p-1.5 border border-[var(--border-color)] ml-4">
          <button 
            onClick={() => updateCart(item.id, -1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/50 dark:bg-black/30 border border-[var(--border-color)] text-[var(--text-main)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            disabled={!cart[item.id] || !item.in_stock}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-6 text-center font-bold text-[var(--text-main)]">
            {cart[item.id] || 0}
          </span>
          <button 
            onClick={() => updateCart(item.id, 1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-[var(--color-green)] text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
            disabled={!item.in_stock}
          >
            <Plus className="w-4 h-4 font-bold" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function Marketplace() {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [saveNewAddress, setSaveNewAddress] = useState(false);
  
  const [savedLocations, setSavedLocations] = useState<any[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  
  // GPS States
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locating, setLocating] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchCatalog();

    // Subscribe to realtime updates on the items table
    const channel = supabase
      .channel('items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setCatalog(prev => prev.map(item => item.id === payload.new.id ? payload.new : item));
        } else if (payload.eventType === 'INSERT') {
          setCatalog(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'DELETE') {
          setCatalog(prev => prev.filter(item => item.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCatalog = async () => {
    const { data } = await supabase.from('items').select('*').order('name');
    if (data) setCatalog(data);
    setLoading(false);
  };



  const fetchSavedLocations = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase.from('users').select('saved_locations').eq('id', session.user.id).single();
      if (data && data.saved_locations) {
        setSavedLocations(data.saved_locations);
      }
    }
    setLoadingLocations(false);
  };

  const updateCart = (id: string, delta: number) => {
    setCart(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      const newCart = { ...prev };
      if (next === 0) delete newCart[id];
      else newCart[id] = next;
      return newCart;
    });
  };

  const cartTotalWeight = Object.entries(cart).reduce((total, [id, qty]) => {
    const item = catalog.find(i => i.id === id);
    return total + (item ? item.weight * qty : 0);
  }, 0);

  const cartTotalPrice = Object.entries(cart).reduce((total, [id, qty]) => {
    const item = catalog.find(i => i.id === id);
    return total + (item ? item.price * qty : 0);
  }, 0);

  const isOverweight = cartTotalWeight > MAX_PAYLOAD_GRAMS;
  const itemCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const weightPercentage = Math.min(100, (cartTotalWeight / MAX_PAYLOAD_GRAMS) * 100);

  const handleCheckoutSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalAddress = deliveryAddress === 'custom' ? customAddress : deliveryAddress;
    
    if (itemCount === 0 || isOverweight || !finalAddress) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    
    // Save new address if requested
    if (deliveryAddress === 'custom' && saveNewAddress && customAddress.trim()) {
      if (session) {
        const newLocations = [...savedLocations, { name: customAddress.trim() }];
        await supabase.from('users').update({ saved_locations: newLocations }).eq('id', session.user.id);
      }
    }
    
    let orderId = Math.random().toString(36).substring(7); // Fallback for guest demo users
    
    if (session && session.user.id !== 'demo-user-123') {
      const firstItemId = Object.keys(cart)[0];
      const firstItem = catalog.find(i => i.id === firstItemId);
      const shopId = firstItem?.shop_id;

      const orderData = {
        user_id: session.user.id,
        shop_id: shopId,
        status: 'dispatched',
        total_weight_grams: cartTotalWeight,
        items: Object.entries(cart).map(([id, qty]) => {
          const item = catalog.find(i => i.id === id);
          return { id, name: item?.name, qty, price: item?.price };
        })
      };

      const { data, error } = await supabase.from('orders').insert([orderData]).select().single();
      if (data && !error) {
        orderId = data.id;
      } else {
        console.error("Failed to create order:", error);
        alert("Order failed: " + (error?.message || "Unknown error"));
      }
    }
    
    navigate(`/tracking/${orderId}?type=marketplace`);
  };

  // Ensure consistent category names as requested
  const categories = ['Medicines', 'Food & Drinks'];

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--color-sky)] animate-spin" />
      </div>
    );
  }

  if (showCheckoutForm) {
    return (
      <motion.div 
        initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}
        className="min-h-screen bg-[var(--bg-page)] flex flex-col font-sans relative overflow-hidden pb-32"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--color-sky)] rounded-full opacity-10 blur-[100px] pointer-events-none z-0" />
        
        <header className="px-6 py-4 glass-panel sticky top-0 z-40 shadow-sm mb-6 rounded-b-3xl mx-2 mt-2">
          <div className="flex items-center space-x-3">
            <button onClick={() => setShowCheckoutForm(false)} className="p-2 -ml-2 rounded-full hover:bg-[var(--border-color)] text-[var(--text-main)] transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-[var(--text-main)] tracking-tight">Your Cart</h1>
          </div>
        </header>

        <div className="px-6 space-y-6 max-w-xl mx-auto w-full relative z-10 flex-1">
          {/* Order Summary */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-[var(--text-main)] mb-4 flex items-center">
              <ShoppingCart className="w-5 h-5 mr-2 text-[var(--color-sky)]" />
              Order Summary
            </h2>
            <div className="space-y-4">
              {Object.entries(cart).map(([id, qty]) => {
                const item = catalog.find(i => i.id === id);
                if (!item || qty === 0) return null;
                return (
                  <div key={id} className="flex justify-between items-start border-b border-[var(--border-color)] pb-4 last:border-0 last:pb-0">
                    <div>
                      <p className="font-bold text-[var(--text-main)]">{item.name}</p>
                      <p className="text-sm font-medium text-[var(--text-muted)]">${item.price.toFixed(2)} × {qty}</p>
                    </div>
                    <p className="font-bold text-[var(--text-main)]">${(item.price * qty).toFixed(2)}</p>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[var(--text-muted)] font-medium">Subtotal</p>
                <p className="font-semibold text-[var(--text-main)]">${cartTotalPrice.toFixed(2)}</p>
              </div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-[var(--text-muted)] font-medium">Delivery Fee</p>
                <p className="font-semibold text-[var(--color-green)]">Free</p>
              </div>
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-[var(--border-color)]">
                <p className="font-bold text-[var(--text-main)] text-lg">Total Amount</p>
                <p className="text-2xl font-black text-[var(--color-sky)]">${cartTotalPrice.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Delivery Details */}
          <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-[var(--text-main)]">Delivery Details</h2>
              <div className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
                locating ? 'bg-[var(--color-yellow)]/20 text-[var(--color-yellow)]' : 
                userLocation ? 'bg-[var(--color-green)]/20 text-[var(--color-green)]' : 
                'bg-[var(--color-red)]/20 text-[var(--color-red)]'
              }`}>
                {locating ? <Loader2 className="w-3 h-3 animate-spin" /> : <LocateFixed className="w-3 h-3" />}
                <span>{locating ? 'Locating...' : userLocation ? 'GPS OK' : 'No GPS'}</span>
              </div>
            </div>

            <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <MapPin className="h-5 w-5 text-[var(--text-muted)]" />
                </div>
                <select
                  required
                  disabled={loadingLocations}
                  value={deliveryAddress}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'gps') {
                      if ("geolocation" in navigator) {
                        setLocating(true);
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
                            setDeliveryAddress('Current Location (GPS)');
                            setLocating(false);
                          },
                          (error) => {
                            console.error("Location error:", error);
                            alert("Please enable GPS permissions to use this feature.");
                            setDeliveryAddress('');
                            setLocating(false);
                          }
                        );
                      }
                    } else {
                      setDeliveryAddress(val);
                    }
                  }}
                  className="block w-full pl-12 pr-4 py-4 bg-[var(--bg-page)]/50 border border-[var(--border-color)] rounded-2xl text-[var(--text-main)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-sky)] transition-all appearance-none disabled:opacity-50"
                >
                  <option value="" disabled>{loadingLocations ? 'Loading addresses...' : 'Select drop-off location...'}</option>
                  <option value="gps">📍 Use Current Location (GPS)</option>
                  {savedLocations.map((loc, idx) => (
                    <option key={idx} value={loc.name}>⭐ {loc.name}</option>
                  ))}
                  <option value="custom">+ Type a new address</option>
                </select>
              </div>
              {deliveryAddress === 'custom' && (
                <div className="mt-2 space-y-2 bg-[var(--bg-page)]/30 p-4 rounded-xl border border-[var(--border-color)]">
                  <div className="pt-2">
                    <WaveInput 
                      type="text" 
                      required
                      label="Destination Address"
                      value={customAddress}
                      onChange={e => setCustomAddress(e.target.value)}
                    />
                  </div>
                  <label className="flex items-center space-x-2 text-sm text-[var(--text-main)] px-1 cursor-pointer pt-2 mt-2">
                    <input type="checkbox" checked={saveNewAddress} onChange={e => setSaveNewAddress(e.target.checked)} className="rounded text-[var(--color-sky)] focus:ring-[var(--color-sky)] w-4 h-4" />
                    <span>Save this address for next time</span>
                  </label>
                </div>
              )}

              {/* Map Preview */}
              {(deliveryAddress && deliveryAddress !== 'custom' || (deliveryAddress === 'custom' && customAddress.length > 2)) && (
                <div className="h-40 mt-4 rounded-xl overflow-hidden shadow-inner border border-[var(--border-color)]">
                  <LocationMap 
                    locations={[
                      { 
                        address: deliveryAddress === 'custom' ? customAddress : deliveryAddress, 
                        label: "Drop-off Location" 
                      }
                    ]} 
                    onLocationSelect={(val) => {
                      setDeliveryAddress('custom');
                      setCustomAddress(val);
                    }}
                  />
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Sticky Confirm Button */}
        <div className="fixed bottom-24 left-0 right-0 px-6 z-40 pointer-events-none">
          <div className="max-w-xs mx-auto pointer-events-auto">
            <button 
              form="checkout-form"
              type="submit"
              disabled={!deliveryAddress || (deliveryAddress === 'custom' && !customAddress)}
              className="w-full minimal-button bg-[var(--color-green)] text-white text-base py-3.5 flex justify-between items-center px-5 disabled:opacity-50 shadow-xl hover:shadow-2xl transition-shadow"
            >
              <span className="font-bold">Place Order</span>
              <span className="font-bold bg-white/20 px-3 py-1 rounded-xl text-sm">${cartTotalPrice.toFixed(2)}</span>
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="pb-32 min-h-screen font-sans relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--color-yellow)] rounded-full opacity-10 blur-[100px] pointer-events-none z-0" />
      <div className="absolute top-[50%] left-[-10%] w-80 h-80 bg-[var(--color-sky)] rounded-full opacity-10 blur-[100px] pointer-events-none z-0" />

      <header className="px-6 py-4 glass-panel sticky top-0 z-40 shadow-sm mb-8 rounded-b-3xl mx-2 mt-2">
        <div className="flex items-center space-x-3 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-[var(--border-color)] text-[var(--text-main)] transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-[var(--text-main)] tracking-tight">Marketplace</h1>
        </div>
        
        <div className="flex justify-between text-xs font-semibold uppercase tracking-wider mb-2 text-[var(--text-muted)]">
          <span>Payload</span>
          <motion.span animate={{ color: isOverweight ? 'var(--color-red)' : 'var(--color-green)' }}>
            {cartTotalWeight}g / {MAX_PAYLOAD_GRAMS}g
          </motion.span>
        </div>
        <div className="w-full h-3 bg-[var(--border-color)] rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${weightPercentage}%`, backgroundColor: isOverweight ? 'var(--color-red)' : 'var(--color-green)' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.8 }}
            className="h-full rounded-full"
          />
        </div>
      </header>

      <div className="px-6 space-y-10 max-w-xl mx-auto relative z-10">
        {categories.map(category => (
          <div key={category}>
            <h2 className="text-xl font-bold text-[var(--text-main)] tracking-tight mb-4 px-2">{category}</h2>
            <div className="grid gap-4">
              {catalog.filter(i => i.category === category).map(item => (
                <CatalogItem key={item.id} item={item} cart={cart} updateCart={updateCart} />
              ))}
              {catalog.filter(i => i.category === category).length === 0 && (
                <p className="text-[var(--text-muted)] text-sm px-2">No items in this category.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {itemCount > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 left-0 right-0 px-6 z-40 pointer-events-none"
          >
            <div className="max-w-xs mx-auto pointer-events-auto">
              {isOverweight && (
                <div className="flex items-center space-x-2 text-[var(--color-red)] bg-[var(--color-red)]/10 backdrop-blur-md p-3 rounded-2xl mb-3 border border-[var(--color-red)]/20 shadow-lg">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-semibold">Exceeds 2kg capacity.</p>
                </div>
              )}
              
              <button
                onClick={() => setShowCheckoutForm(true)}
                disabled={isOverweight}
                className="w-full minimal-button bg-[var(--color-sky)] text-white text-base py-3.5 flex justify-between items-center px-5 disabled:opacity-50"
              >
                <div className="flex items-center space-x-3">
                  <ShoppingCart className="w-4 h-4" />
                  <span className="font-semibold">Checkout ({itemCount})</span>
                </div>
                <span className="font-bold">${cartTotalPrice.toFixed(2)}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
