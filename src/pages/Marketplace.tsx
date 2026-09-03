import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, AlertCircle, ArrowLeft, MapPin, Loader2, User, Store } from 'lucide-react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { LocationMap } from '../components/LocationMap';
import { AddressModal, type SavedLocation } from '../components/AddressModal';
import toast from 'react-hot-toast';

import { supabase } from '../lib/supabase';
import { WaveInput } from '../components/WaveInput';
import { ThemeToggle } from '../components/ThemeToggle';

const MAX_PAYLOAD_GRAMS = 2000;

function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}

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
  const [loadingText, setLoadingText] = useState('Finding your location...');
  const [locationError, setLocationError] = useState<string | null>(null);
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
    setLoading(true);
    setLoadingText('Acquiring GPS location...');

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        
        setLoadingText('Loading nearby shops...');
        const { data: shopsData } = await supabase.from('shops').select('*');
        let nearbyShops = [];
        if (shopsData) {
          nearbyShops = shopsData.filter((shop) => {
             const dist = getDistanceInKm(userLat, userLng, shop.lat, shop.lng);
             return dist <= 5000; // Increased to 5000km for testing purposes
          });
          setShops(nearbyShops);
        }

        const { data: itemsData } = await supabase.from('items').select('*').order('name');
        if (itemsData) {
          const shopIds = new Set(nearbyShops.map(s => s.id));
          const availableItems = itemsData.filter(item => shopIds.has(item.shop_id));
          setCatalog(availableItems);
        }

        const storedCartShop = sessionStorage.getItem('activeCartShopId');
        if (!storedCartShop) {
          setCart({});
        }

        setLoading(false);
      },
      () => {
        setLocationError('Unable to retrieve your location. Please allow GPS access in your browser/device settings.');
        setLoading(false);
      },
      { timeout: 15000, enableHighAccuracy: true }
    );
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
      
      const storedCartShop = sessionStorage.getItem('activeCartShopId');
      const shop = shops.find(s => s.id === storedCartShop);
      if (!shop) {
         toast.error("Shop data missing!");
         return;
      }

      // Load Razorpay Script dynamically
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);

      script.onload = async () => {
        try {
          // 1. Create order on Python backend
          const orderRes = await fetch("http://localhost:8000/api/create_order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount_inr: cartTotalPrice })
          });
          const orderData = await orderRes.json();
          
          if (!orderRes.ok) throw new Error(orderData.error || "Failed to create order");

          // 2. Setup Razorpay options
          const options = {
            key: "rzp_test_TXX8gDzQSotwG0", 
            amount: orderData.amount, // Amount in paise from backend
            currency: "INR",
            name: "RoCAR Delivery",
            description: "Order Payment",
            order_id: orderData.order_id, // Pass the backend order ID
            image: "https://your-logo-url.com/logo.png",
            handler: async function (response: any) {
              try {
                // 3. Verify signature on Python backend
                const verifyRes = await fetch("http://localhost:8000/api/verify_payment", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature
                  })
                });
                
                const verifyData = await verifyRes.json();
                if (!verifyRes.ok) throw new Error(verifyData.error || "Verification failed");
                
                console.log("Payment verified securely!");
                toast.success("Payment successful!");
                await createOrderAndNavigate(shop);
              } catch (verifyErr: any) {
                toast.error("Payment verification failed: " + verifyErr.message);
              }
            },
            prefill: {
              name: "RoCAR Customer",
              email: "customer@rocar.delivery",
              contact: "9999999999"
            },
            theme: {
              color: "#0ea5e9"
            }
          };

          const rzp = new (window as any).Razorpay(options);
          rzp.on('payment.failed', function (response: any) {
            toast.error("Payment failed: " + response.error.description);
          });
          rzp.open();
        } catch (backendErr: any) {
          toast.error("Error setting up payment: " + backendErr.message);
        }
      };
      
      script.onerror = () => {
        toast.error("Failed to load Razorpay checkout.");
      };

    } catch (err: any) {
      console.error("CRITICAL ERROR IN CHECKOUT:", err);
      alert("Checkout crashed: " + err.message);
    }
  };

  const filteredCatalog = catalog.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const activeCartShop = shops.find(s => s.id === sessionStorage.getItem('activeCartShopId'));

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-[var(--color-sky)] animate-spin mb-4" />
        <h2 className="text-xl font-bold text-[var(--text-main)]">{loadingText}</h2>
        <p className="text-[var(--text-muted)] mt-2">Please allow GPS access if prompted.</p>
      </div>
    );
  }

  if (locationError) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--text-main)] mb-2">Location Required</h2>
        <p className="text-[var(--text-muted)] max-w-md">{locationError}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-6 bg-[var(--color-sky)] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-opacity-90 transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (shops.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-[var(--bg-page)]/50 border border-[var(--border-color)] rounded-2xl flex items-center justify-center mb-4">
          <MapPin className="w-10 h-10 text-[var(--text-muted)]" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--text-main)] mb-2">No Shops Nearby</h2>
        <p className="text-[var(--text-muted)] max-w-md">
          There are currently no RoCAR delivery partner shops within 3km of your location. 
          Please try again later or from a different location.
        </p>
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
          <div className="max-w-xs mx-auto pointer-events-auto flex flex-col space-y-3">
            <button 
              onClick={handleCheckoutSubmit}
              type="button"
              className="w-full primary-button text-white text-base py-3.5 flex justify-between items-center px-5 shadow-lg"
            >
              <span className="font-bold">Pay & Place Order</span>
              <span className="font-bold bg-white/20 px-3 py-1 rounded-xl text-sm">₹{cartTotalPrice.toFixed(2)}</span>
            </button>
            <button 
              onClick={handleBypassPayment}
              type="button"
              className="w-full bg-[var(--bg-page)] text-[var(--text-muted)] border border-[var(--border-color)] text-sm py-2.5 rounded-xl font-bold hover:bg-[var(--border-color)] transition-all"
            >
              Bypass Payment (Test)
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
