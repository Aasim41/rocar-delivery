import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, AlertCircle, ArrowLeft, MapPin, Loader2, User, Store } from 'lucide-react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { LocationMap } from '../components/LocationMap';
import { AddressModal, type SavedLocation } from '../components/AddressModal';

import { supabase } from '../lib/supabase';
import { WaveInput } from '../components/WaveInput';
import { ThemeToggle } from '../components/ThemeToggle';

const MAX_PAYLOAD_GRAMS = 2000;

function CatalogItem({ item, cart, updateCart, shops }: any) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const shop = shops.find((s: any) => s.id === item.shop_id);

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
          <p className="text-[var(--text-muted)] text-xs font-semibold mt-0.5 mb-1 flex items-center">
            <Store className="w-3 h-3 mr-1" /> {shop?.name || 'Unknown Shop'}
          </p>
          <p className="text-[var(--text-muted)] font-medium mt-1 text-sm bg-[var(--color-sky)]/10 inline-block px-2 py-0.5 rounded-md text-[var(--color-sky)]">${item.price.toFixed(2)} • {item.weight}g</p>
        </div>
        
        <div className="flex items-center space-x-3 bg-[var(--bg-page)]/50 rounded-2xl p-1.5 border border-[var(--border-color)] ml-4">
          <button 
            onClick={() => updateCart(item, -1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/50 dark:bg-black/30 border border-[var(--border-color)] text-[var(--text-main)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            disabled={!cart[item.id] || !item.in_stock}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-6 text-center font-bold text-[var(--text-main)]">
            {cart[item.id] || 0}
          </span>
          <button 
            onClick={() => updateCart(item, 1)}
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
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<SavedLocation | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: shopsData } = await supabase.from('shops').select('*');
    if (shopsData) setShops(shopsData);

    const { data: itemsData } = await supabase.from('items').select('*').order('name');
    if (itemsData) setCatalog(itemsData);

    // check if there's an active cart shop
    const storedCartShop = sessionStorage.getItem('activeCartShopId');
    if (!storedCartShop) {
      setCart({});
    }

    setLoading(false);
  };

  const updateCart = (item: any, delta: number) => {
    const storedCartShop = sessionStorage.getItem('activeCartShopId');
    if (delta > 0 && storedCartShop && storedCartShop !== item.shop_id) {
       if (window.confirm("Your cart contains items from another shop. Clear cart to add this item?")) {
          setCart({ [item.id]: 1 });
          sessionStorage.setItem('activeCartShopId', item.shop_id);
       }
       return;
    } else if (delta > 0 && !storedCartShop) {
       sessionStorage.setItem('activeCartShopId', item.shop_id);
    }

    setCart(prev => {
      const current = prev[item.id] || 0;
      const next = Math.max(0, current + delta);
      const newCart = { ...prev };
      if (next === 0) delete newCart[item.id];
      else newCart[item.id] = next;
      
      if (Object.keys(newCart).length === 0) {
         sessionStorage.removeItem('activeCartShopId');
      }
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

  const handleCheckoutSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    try {
      if (e) e.preventDefault();
      console.log("Checkout started");
      if (itemCount === 0) { toast.error("Cart is empty"); return; }
      if (isOverweight) { toast.error("Cart is over weight limit"); return; }
      if (!deliveryAddress) { toast.error("Please select a delivery address"); return; }
      
      const { data: { session } } = await supabase.auth.getSession();
      let orderId = Math.random().toString(36).substring(7);
      
      const storedCartShop = sessionStorage.getItem('activeCartShopId');
      const shop = shops.find(s => s.id === storedCartShop);
      if (!shop) {
         toast.error("Shop data missing!");
         return;
      }
      
      console.log("Creating order data");
      const orderData = {
        user_id: (session && session.user.id !== 'demo-user-123') ? session.user.id : null,
        shop_id: shop.id,
        status: 'at_pickup',
        total_weight_grams: cartTotalWeight,
        items: Object.entries(cart).map(([id, qty]) => {
          const item = catalog.find(i => i.id === id);
          return { id, name: item?.name, qty, price: item?.price };
        })
      };

      console.log("Inserting order...");
      const { data, error } = await supabase.from('orders').insert([orderData]).select().single();
      if (data && !error) {
        orderId = data.id;
        console.log("Order created:", orderId);
      } else {
        toast.error("Order failed: " + (error?.message || "Unknown error"));
        return;
      }
      
      const dropLat = deliveryAddress.lat ?? 24.6380;
      const dropLng = deliveryAddress.lng ?? 77.3110;
      const startLat = shop.lat; 
      const startLng = shop.lng;

      try {
          const backendUrl = localStorage.getItem('BACKEND_URL') || 'http://localhost:8000';
          console.log("Fetching backend...");
          fetch(`${backendUrl}/backend/coordinates/destinations`, {
              method: 'POST',
              body: JSON.stringify({
                  kart: { latitude: startLat, longitude: startLng, heading: 0 },
                  marketplace: { latitude: startLat, longitude: startLng },
                  delivery_point: { latitude: dropLat, longitude: dropLng }
              })
          }).catch(err => console.error("Failed to update Python Backend Route", err));
      } catch (err) {
          console.error("Failed to initiate fetch", err);
      }

      sessionStorage.removeItem('activeCartShopId');
      console.log("Navigating to tracking...");
      navigate(`/tracking/${orderId}?type=marketplace&startLat=${startLat}&startLng=${startLng}&dropLat=${dropLat}&dropLng=${dropLng}`);
    } catch (err: any) {
      console.error("CRITICAL ERROR IN CHECKOUT:", err);
      alert("Checkout crashed: " + err.message);
    }
  };

  const filteredCatalog = catalog.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const activeCartShop = shops.find(s => s.id === sessionStorage.getItem('activeCartShopId'));

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
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-50 bg-[var(--bg-page)] overflow-y-auto pb-48"
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
                <p className="font-semibold text-[var(--text-main)]">₹{cartTotalPrice.toFixed(2)}</p>
              </div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-[var(--text-muted)] font-medium">Delivery Fee</p>
                <p className="font-semibold text-[var(--color-green)]">Free</p>
              </div>
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-[var(--border-color)]">
                <p className="font-bold text-[var(--text-main)] text-lg">Total Amount</p>
                <p className="text-2xl font-black text-[var(--color-sky)]">₹{cartTotalPrice.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-[var(--text-main)]">Delivery Details</h2>
            </div>
            <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="space-y-4">
              
              <div className="w-full flex items-center p-4 bg-[var(--bg-page)]/50 border border-[var(--border-color)] rounded-2xl opacity-80">
                <div className="w-10 h-10 rounded-full bg-[var(--text-muted)]/10 flex items-center justify-center mr-4">
                  <Store className="h-5 w-5 text-[var(--text-muted)]" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-[var(--text-main)]">{activeCartShop?.name || 'Shop'} (Start)</p>
                  <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{activeCartShop?.lat?.toFixed(5)}, {activeCartShop?.lng?.toFixed(5)}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddressModal(true)}
                className="w-full flex items-center p-4 bg-[var(--bg-page)]/50 border border-[var(--border-color)] rounded-2xl hover:border-[var(--color-green)] transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--color-green)]/10 flex items-center justify-center mr-4">
                  <MapPin className="h-5 w-5 text-[var(--color-green)]" />
                </div>
                <div className="flex-1">
                  {deliveryAddress ? (
                    <>
                      <p className="font-bold text-[var(--text-main)]">{deliveryAddress.name} (Destination)</p>
                      <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{deliveryAddress.lat?.toFixed(5)}, {deliveryAddress.lng?.toFixed(5)}</p>
                    </>
                  ) : (
                    <p className="text-[var(--text-main)] font-medium">Select drop-off location...</p>
                  )}
                </div>
              </button>

              {activeCartShop && deliveryAddress && (
                <div className="h-40 mt-4 rounded-xl overflow-hidden shadow-inner border border-[var(--border-color)]">
                  <LocationMap 
                    locations={[
                      { address: `GPS: ${activeCartShop.lat}, ${activeCartShop.lng}`, label: activeCartShop.name + " (Start)" },
                      { address: `GPS: ${deliveryAddress.lat}, ${deliveryAddress.lng}`, label: deliveryAddress.name + " (End)" }
                    ]} 
                  />
                </div>
              )}
            </form>
          </div>
        </div>

        <AddressModal 
          isOpen={showAddressModal}
          onClose={() => setShowAddressModal(false)}
          onSelect={setDeliveryAddress}
          title="Select Destination"
        />

        <div className="fixed bottom-28 left-0 right-0 px-6 z-40 pointer-events-none">
          <div className="max-w-xs mx-auto pointer-events-auto">
            <button 
              onClick={handleCheckoutSubmit}
              type="button"
              className="w-full primary-button text-white text-base py-3.5 flex justify-between items-center px-5"
            >
              <span className="font-bold">Place Order</span>
              <span className="font-bold bg-white/20 px-3 py-1 rounded-xl text-sm">₹{cartTotalPrice.toFixed(2)}</span>
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="pb-40 min-h-screen font-sans relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--color-yellow)] rounded-full opacity-10 blur-[100px] pointer-events-none z-0" />
      <div className="absolute top-[50%] left-[-10%] w-80 h-80 bg-[var(--color-sky)] rounded-full opacity-10 blur-[100px] pointer-events-none z-0" />

      <header className="px-6 py-4 glass-panel sticky top-0 z-40 shadow-sm mb-4 rounded-b-3xl mx-2 mt-2">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-[var(--text-main)] tracking-tight">Marketplace</h1>
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            <button 
              onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-full bg-[var(--color-sky)]/10 flex items-center justify-center border border-[var(--color-sky)]/20 hover:bg-[var(--color-sky)]/20 transition-colors"
            >
              <User className="w-5 h-5 text-[var(--color-sky)]" />
            </button>
          </div>
        </div>
        
        <div className="flex justify-between text-xs font-semibold uppercase tracking-wider mb-2 text-[var(--text-muted)]">
          <span>Payload {activeCartShop ? `(From: ${activeCartShop.name})` : ''}</span>
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

      <div className="px-6 mb-6 max-w-xl mx-auto relative z-10">
         <WaveInput type="text" label="Search" placeholder="Search across all shops..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>

      {!searchQuery && shops.length > 0 && (
         <div className="mb-8">
            <h2 className="text-lg font-bold text-[var(--text-main)] px-6 mb-4">Shops</h2>
            <div className="flex overflow-x-auto space-x-4 px-6 pb-4 snap-x no-scrollbar justify-center">
               {shops.map(shop => (
                  <button 
                     key={shop.id}
                     onClick={() => navigate(`/shop/${shop.id}`)}
                     className="min-w-[240px] max-w-[280px] bg-[var(--bg-page)] rounded-2xl shadow-sm border border-[var(--border-color)] overflow-hidden snap-center hover:shadow-md transition-shadow active:scale-95 text-left"
                  >
                     <div className="h-28 bg-[var(--border-color)] w-full">
                        {shop.banner_url ? (
                           <img src={shop.banner_url} alt={shop.name} className="w-full h-full object-cover" />
                        ) : (
                           <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]"><Store /></div>
                        )}
                     </div>
                     <div className="p-3">
                        <h3 className="font-bold text-base text-[var(--text-main)] truncate">{shop.name}</h3>
                        {shop.categories && shop.categories.length > 0 && (
                           <p className="text-xs text-[var(--text-muted)] mt-1 truncate">{shop.categories.join(', ')}</p>
                        )}
                     </div>
                  </button>
               ))}
            </div>
         </div>
      )}

      <div className="px-6 space-y-10 max-w-xl mx-auto relative z-10">
         <div>
            <h2 className="text-xl font-bold text-[var(--text-main)] tracking-tight mb-4 px-2">
               {searchQuery ? 'Search Results' : 'Explore Items'}
            </h2>
            <div className="grid gap-4">
              {filteredCatalog.map(item => (
                <CatalogItem key={item.id} item={item} cart={cart} updateCart={updateCart} shops={shops} />
              ))}
              {filteredCatalog.length === 0 && (
                <p className="text-[var(--text-muted)] text-sm px-2 text-center mt-8">No items found.</p>
              )}
            </div>
          </div>
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
                <span className="font-bold">₹{cartTotalPrice.toFixed(2)}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
