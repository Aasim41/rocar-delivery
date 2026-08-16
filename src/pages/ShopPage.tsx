import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, AlertCircle, ArrowLeft, MapPin, Loader2, Store } from 'lucide-react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { LocationMap } from '../components/LocationMap';
import { AddressModal, type SavedLocation } from '../components/AddressModal';
import { supabase } from '../lib/supabase';
import { WaveInput } from '../components/WaveInput';

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
          <p className="text-[var(--text-muted)] font-medium mt-1 text-sm bg-[var(--color-sky)]/10 inline-block px-2 py-0.5 rounded-md text-[var(--color-sky)]">₹{item.price.toFixed(2)} • {item.weight}g</p>
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

export function ShopPage() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [shop, setShop] = useState<any>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState<SavedLocation | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!shopId) return;
    
    // Check if cart has items from another shop and clear it (Rule: 1 shop per cart)
    const storedCartShop = sessionStorage.getItem('activeCartShopId');
    if (storedCartShop && storedCartShop !== shopId) {
       setCart({});
       sessionStorage.setItem('activeCartShopId', shopId);
    } else if (!storedCartShop) {
       sessionStorage.setItem('activeCartShopId', shopId);
    }

    fetchShopData();
  }, [shopId]);

  const fetchShopData = async () => {
    if (!shopId) return;
    const { data: shopData } = await supabase.from('shops').select('*').eq('id', shopId).single();
    if (shopData) setShop(shopData);

    const { data: itemsData } = await supabase.from('items').select('*').eq('shop_id', shopId).order('name');
    if (itemsData) setCatalog(itemsData);
    
    setLoading(false);
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
  

  const filteredCatalog = catalog.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleCheckoutSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    try {
      if (e) e.preventDefault();
      console.log("Checkout started");
      if (itemCount === 0) { toast.error("Cart is empty"); return; }
      if (isOverweight) { toast.error("Cart is over weight limit"); return; }
      if (!deliveryAddress) { toast.error("Please select a delivery address"); return; }
      if (!shop) { toast.error("Shop not found"); return; }
      
      const { data: { session } } = await supabase.auth.getSession();
      let orderId = Math.random().toString(36).substring(7);
      
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

      // Clear cart lock
      sessionStorage.removeItem('activeCartShopId');
      console.log("Navigating to tracking...");
      navigate(`/tracking/${orderId}?type=marketplace&startLat=${startLat}&startLng=${startLng}&dropLat=${dropLat}&dropLng=${dropLng}`);
    } catch (err: any) {
      console.error("CRITICAL ERROR IN CHECKOUT:", err);
      alert("Checkout crashed: " + err.message);
    }
  };

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
            <h1 className="text-2xl font-bold text-[var(--text-main)] tracking-tight">Checkout</h1>
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
                      <p className="text-sm font-medium text-[var(--text-muted)]">₹{item.price.toFixed(2)} × {qty}</p>
                    </div>
                    <p className="font-bold text-[var(--text-main)]">₹{(item.price * qty).toFixed(2)}</p>
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
                  <p className="font-bold text-[var(--text-main)]">{shop.name} (Start)</p>
                  <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{shop.lat?.toFixed(5)}, {shop.lng?.toFixed(5)}</p>
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

              {deliveryAddress && (
                <div className="h-40 mt-4 rounded-xl overflow-hidden shadow-inner border border-[var(--border-color)]">
                  <LocationMap 
                    locations={[
                      { address: `GPS: ${shop.lat}, ${shop.lng}`, label: shop.name + " (Start)" },
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
      <header className="px-6 py-4 glass-panel sticky top-0 z-40 shadow-sm mb-4 rounded-b-3xl mx-2 mt-2">
        <div className="flex items-center space-x-3 mb-2">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-[var(--border-color)] text-[var(--text-main)] transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>
        <div className="flex flex-col mb-4">
          {shop?.banner_url && (
            <div className="w-full h-32 rounded-2xl overflow-hidden mb-4 shadow-sm border border-[var(--border-color)]">
              <img src={shop.banner_url} alt={shop.name} className="w-full h-full object-cover" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-[var(--text-main)] tracking-tight">{shop?.name || 'Shop'}</h1>
          {shop?.categories && shop.categories.length > 0 && (
             <p className="text-sm font-medium text-[var(--text-muted)] mt-1">{shop.categories.join(', ')}</p>
          )}
        </div>
      </header>

      <div className="px-6 mb-6 max-w-xl mx-auto relative z-10">
         <WaveInput type="text" label="Search" placeholder={`Search in ${shop?.name}...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>

      <div className="px-6 space-y-4 max-w-xl mx-auto relative z-10">
        {filteredCatalog.map(item => (
          <CatalogItem key={item.id} item={item} cart={cart} updateCart={updateCart} />
        ))}
        {filteredCatalog.length === 0 && (
          <p className="text-[var(--text-muted)] text-sm px-2 text-center mt-8">No items found.</p>
        )}
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
