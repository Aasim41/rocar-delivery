import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, PackageSearch, LogOut, MapPin, Store, Settings, X, Star } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { WaveInput } from '../components/WaveInput';
import { AddressModal, type SavedLocation } from '../components/AddressModal';
import { ThemeToggle } from '../components/ThemeToggle';


export function ShopPortal() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: 'Medicines', weight: 0, price: 0, quantity: 0 });
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders' | 'history'>('orders');
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Shop Onboarding State
  const [hasShop, setHasShop] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [shopSetup, setShopSetup] = useState({
    name: '',
    banner_url: '',
    categories: '',
    whatsapp_number: '',
  });
  const [shopLocation, setShopLocation] = useState<SavedLocation | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);

  useEffect(() => {
    checkShopStatus();
  }, []);

  const checkShopStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUserId(session.user.id);
      const { data: userData } = await supabase.from('users').select('shop_id').eq('id', session.user.id).single();
      
      if (userData?.shop_id) {
        setHasShop(true);
        const { data: shopData } = await supabase.from('shops').select('*').eq('id', userData.shop_id).single();
        if (shopData) {
           setShopSetup({
              name: shopData.name || '',
              banner_url: shopData.banner_url || '',
              categories: shopData.categories ? shopData.categories.join(', ') : '',
              whatsapp_number: shopData.whatsapp_number || ''
           });
        }
        fetchInventory(userData.shop_id);
      } else {
        setHasShop(false);
      }
    }
  };

  const fetchInventory = async (shopId: string) => {
    const { data } = await supabase.from('items').select('*').eq('shop_id', shopId).order('name');
    if (data) setInventory(data);
    
    const { data: ordersData } = await supabase.from('orders')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });
    if (ordersData) setOrders(ordersData);

    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          if (payload.new.shop_id === shopId) {
            setOrders(prev => [payload.new, ...prev]);
          }
        } else if (payload.eventType === 'UPDATE') {
          if (payload.new.shop_id === shopId) {
            setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new : o));
          }
        } else if (payload.eventType === 'DELETE') {
          setOrders(prev => prev.filter(o => o.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setShopSetup(prev => ({ ...prev, banner_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !shopLocation) return;

    const categoriesArray = shopSetup.categories.split(',').map(s => s.trim()).filter(s => s);

    const { data: newShop, error: shopError } = await supabase.from('shops').insert([{ 
      name: shopSetup.name, 
      banner_url: shopSetup.banner_url,
      categories: categoriesArray,
      whatsapp_number: shopSetup.whatsapp_number,
      lat: shopLocation.lat,
      lng: shopLocation.lng
    }]).select().single();
    
    if (shopError) {
      toast.error("Failed to create shop: " + shopError.message);
      return;
    }
    
    if (newShop) {
      await supabase.from('users').update({ shop_id: newShop.id }).eq('id', userId);
      setHasShop(true);
      fetchInventory(newShop.id);
    }
  };

  const handleUpdateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    const categoriesArray = shopSetup.categories.split(',').map((s: string) => s.trim()).filter((s: string) => s);
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (!uid) return;
    
    const { data: userShop } = await supabase.from('users').select('shop_id').eq('id', uid).single();
    if (!userShop?.shop_id) return;

    const { error } = await supabase.from('shops').update({
       name: shopSetup.name,
       banner_url: shopSetup.banner_url,
       categories: categoriesArray,
       whatsapp_number: shopSetup.whatsapp_number
    }).eq('id', userShop.shop_id);

    if (error) {
       toast.error("Failed to update: " + error.message);
    } else {
       setShowProfileModal(false);
       toast.success("Shop updated successfully!");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const updateItem = async (id: string, field: string, value: any) => {
    setInventory(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
    await supabase.from('items').update({ [field]: value }).eq('id', id);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: userData } = await supabase.from('users').select('shop_id').eq('id', session.user.id).single();
    if (!userData?.shop_id) return;

    const itemToInsert = {
      name: newItem.name,
      category: newItem.category,
      weight: newItem.weight,
      weight_grams: newItem.weight, 
      price: newItem.price,
      quantity: newItem.quantity,
      in_stock: newItem.quantity > 0,
      shop_id: userData.shop_id
    };
    
    const { data, error } = await supabase.from('items').insert([itemToInsert]).select().single();
    
    if (error) {
      toast.error("Failed to save item: " + error.message);
      return;
    }
    
    if (data) {
      setInventory([...inventory, data]);
    }
    
    setShowAddForm(false);
    setNewItem({ name: '', category: 'Medicines', weight: 0, price: 0, quantity: 0 });
  };

  const handlePackOrder = async (orderId: string) => {
    const loadingToast = toast.loading("Dispatching bot...");
    try {
      const { error } = await supabase.from('orders').update({ status: 'dispatched' }).eq('id', orderId);
      
      if (error) {
        throw error;
      }
      
      try {
        const backendUrl = localStorage.getItem('BACKEND_URL') || 'http://localhost:8000';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const res = await fetch(`${backendUrl}/backend/pack_order`, {
          method: 'POST',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        toast.dismiss(loadingToast);
        
        if (!res.ok) {
           const errData = await res.json().catch(() => ({}));
           toast.error(`Backend warning: ${errData.reason || 'Bot not ready to be dispatched yet.'}`);
        } else {
           toast.success("Order Packed! Cargo locked and bot is starting its journey.");
        }
      } catch (e: any) {
        toast.dismiss(loadingToast);
        if (e.name === 'AbortError') {
            toast.error("Backend request timed out. Is the python server running?");
        } else {
            toast.error("Could not reach backend server to dispatch bot.");
        }
        console.warn("Could not reach backend:", e);
      }
      
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'dispatched' } : o));
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error("Failed to update database: " + err.message);
    }
  };

  const incomingOrders = orders.filter(o => o.status === 'at_pickup');
  const historyOrders = orders.filter(o => o.status !== 'at_pickup');

  if (hasShop === null) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;
  }

  if (hasShop === false) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24 font-sans flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100"
        >
          <div className="bg-slate-900 p-8 text-center text-white">
            <Store className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
            <h1 className="text-2xl font-bold tracking-tight">Set up your Shop</h1>
            <p className="text-slate-400 mt-2 text-sm">Welcome! Let's get your store online.</p>
          </div>
          
          <form onSubmit={handleCreateShop} className="p-8 space-y-5">
            <WaveInput required type="text" label="Shop Name" value={shopSetup.name} onChange={e => setShopSetup({...shopSetup, name: e.target.value})} />
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Shop Banner</label>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
              {shopSetup.banner_url && <img src={shopSetup.banner_url} alt="Banner Preview" className="mt-2 h-20 w-auto rounded-lg object-cover" />}
            </div>
            <WaveInput required type="text" label="Categories (Comma separated)" value={shopSetup.categories} onChange={e => setShopSetup({...shopSetup, categories: e.target.value})} />
            <WaveInput required type="tel" label="WhatsApp Number" value={shopSetup.whatsapp_number} onChange={e => setShopSetup({...shopSetup, whatsapp_number: e.target.value})} />
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Shop Location</label>
              <button
                type="button"
                onClick={() => setShowAddressModal(true)}
                className="w-full flex items-center p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-emerald-500 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mr-4">
                  <MapPin className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  {shopLocation ? (
                    <>
                      <p className="font-bold text-slate-900">{shopLocation.name}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{shopLocation.lat?.toFixed(5)}, {shopLocation.lng?.toFixed(5)}</p>
                    </>
                  ) : (
                    <p className="text-slate-500 font-medium text-sm">Tap to pin on map...</p>
                  )}
                </div>
              </button>
            </div>

            <button 
              type="submit"
              disabled={!shopLocation}
              className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-emerald-700 transition-colors disabled:opacity-50 mt-4"
            >
              Open Shop
            </button>
          </form>
        </motion.div>

        <AddressModal 
          isOpen={showAddressModal}
          onClose={() => setShowAddressModal(false)}
          onSelect={setShopLocation}
          title="Pin Shop Location"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] pb-24 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-[var(--color-sky)] rounded-full opacity-10 blur-[100px] pointer-events-none z-0" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[var(--color-green)] rounded-full opacity-10 blur-[100px] pointer-events-none z-0" />

      <header className="glass-panel px-6 py-4 sticky top-0 z-20 flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)] tracking-tight">{shopSetup.name || 'Shop Portal'}</h1>
        </div>
        <div className="flex space-x-2">
          <ThemeToggle />
          <button 
            onClick={() => setShowProfileModal(true)}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--color-sky)] bg-[var(--bg-page)] hover:bg-[var(--bg-page)]/80 rounded-full transition-colors border border-[var(--border-color)] shadow-sm"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={handleLogout}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--color-red)] bg-[var(--bg-page)] hover:bg-[var(--bg-page)]/80 rounded-full transition-colors border border-[var(--border-color)] shadow-sm"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="p-6 max-w-3xl mx-auto relative z-10">
        <div className="flex space-x-4 mb-6">
          <button 
            onClick={() => setActiveTab('orders')}
            className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === 'orders' ? 'primary-button' : 'bg-[var(--bg-page)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]'}`}
          >
            Incoming ({incomingOrders.length})
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === 'history' ? 'primary-button' : 'bg-[var(--bg-page)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]'}`}
          >
            History
          </button>
          <button 
            onClick={() => setActiveTab('inventory')}
            className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === 'inventory' ? 'primary-button' : 'bg-[var(--bg-page)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]'}`}
          >
            Inventory
          </button>
        </div>

        {activeTab === 'inventory' ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[var(--text-main)]">Inventory Management</h2>
              <button 
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center space-x-2 primary-button px-4 py-2 rounded-full text-sm font-semibold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item</span>
              </button>
            </div>

        <AnimatePresence>
          {showAddForm && (
            <motion.form 
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              onSubmit={handleAddItem}
              className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6 overflow-hidden"
            >
              <h3 className="font-semibold text-slate-900 mb-4">New Item</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2 pt-2">
                  <WaveInput required type="text" label="Name" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                </div>
                <div className="pt-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">Category</label>
                  <select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-emerald-500 bg-white text-slate-900">
                    <option>Medicines</option>
                    <option>Food & Drinks</option>
                    <option>Electronics</option>
                    <option>Groceries</option>
                  </select>
                </div>
                <div className="pt-4">
                  <WaveInput required type="number" min="0" step="0.01" label="Price ($)" value={newItem.price || ''} onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value)})} />
                </div>
                <div className="pt-2">
                  <WaveInput required type="number" min="0" label="Weight (g)" value={newItem.weight || ''} onChange={e => setNewItem({...newItem, weight: parseInt(e.target.value)})} />
                </div>
                <div className="pt-2">
                  <WaveInput required type="number" min="0" label="Initial Qty" value={newItem.quantity || ''} onChange={e => setNewItem({...newItem, quantity: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-5">
                <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl shadow-sm hover:bg-black transition-colors">Save Item</button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="bento-card overflow-hidden">
          {inventory.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-[var(--bg-page)] rounded-full flex items-center justify-center mb-3">
                <PackageSearch className="w-8 h-8 text-[var(--text-muted)]" />
              </div>
              <p className="text-[var(--text-muted)] font-medium">No items found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-page)]/50 text-[var(--text-muted)] font-bold border-b border-[var(--border-color)] uppercase tracking-wider text-xs">
                  <tr>
                    <th className="p-4">Item</th>
                    <th className="p-4 w-24">Price</th>
                    <th className="p-4 w-24">Qty</th>
                    <th className="p-4 w-24 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {inventory.map(item => (
                    <tr key={item.id} className="hover:bg-[var(--bg-page)]/30 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-[var(--text-main)] line-clamp-1">{item.name}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">{item.category} • {item.weight_grams}g</p>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center">
                          <span className="text-[var(--text-muted)] mr-1">$</span>
                          <input 
                            type="number" 
                            value={item.price} 
                            onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                            className="w-16 bg-transparent border-b border-transparent focus:border-[var(--color-sky)] outline-none text-[var(--text-main)] transition-colors font-bold"
                          />
                        </div>
                      </td>
                      <td className="p-4">
                        <input 
                          type="number" 
                          value={item.quantity} 
                          onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-16 bg-[var(--bg-page)] border border-transparent focus:bg-[var(--card-bg)] focus:border-[var(--color-sky)] focus:ring-1 focus:ring-[var(--color-sky)] rounded-md px-2 py-1 outline-none text-[var(--text-main)] transition-all font-bold"
                        />
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => updateItem(item.id, 'in_stock', !item.in_stock)}
                          className={`w-full py-1.5 rounded-full text-xs font-bold transition-colors border ${
                            item.in_stock 
                              ? 'bg-[var(--color-green)]/10 text-[var(--color-green)] border-[var(--color-green)]/20 hover:bg-[var(--color-green)]/20' 
                              : 'bg-[var(--bg-page)] text-[var(--text-muted)] border-[var(--border-color)] hover:bg-[var(--border-color)]'
                          }`}
                        >
                          {item.in_stock ? 'In Stock' : 'Out'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
        ) : activeTab === 'orders' ? (
          <div className="space-y-4">
            {incomingOrders.length === 0 ? (
              <div className="p-12 text-center bento-card">
                <PackageSearch className="w-12 h-12 text-[var(--text-muted)] opacity-50 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[var(--text-main)]">No active orders</h3>
                <p className="text-[var(--text-muted)] mt-1">When customers place orders, they will appear here for packing.</p>
              </div>
            ) : (
              incomingOrders.map(order => (
                <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} key={order.id} className="bento-card p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-[var(--text-main)] text-lg">Order #{order.id.slice(0, 8)}</h3>
                      <p className="text-sm text-[var(--text-muted)] font-medium">Weight: {order.total_weight_grams}g</p>
                    </div>
                    <span className="bg-[var(--color-yellow)]/10 text-[var(--color-yellow)] border border-[var(--color-yellow)]/20 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                      Awaiting Pack
                    </span>
                  </div>
                  
                  <div className="bg-[var(--bg-page)]/50 rounded-xl p-4 mb-4 border border-[var(--border-color)]">
                    <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Items to pack</h4>
                    <ul className="space-y-2">
                      {order.items?.map((item: any, idx: number) => (
                        <li key={idx} className="flex justify-between text-sm">
                          <span className="font-bold text-[var(--text-main)]">{item.qty}x {item.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button 
                    onClick={() => handlePackOrder(order.id)}
                    className="w-full primary-button py-3.5 rounded-xl flex items-center justify-center space-x-2 font-bold"
                  >
                    <PackageSearch className="w-5 h-5" />
                    <span>Pack & Dispatch Bot</span>
                  </button>
                </motion.div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {historyOrders.length === 0 ? (
              <div className="p-12 text-center bento-card">
                <PackageSearch className="w-12 h-12 text-[var(--text-muted)] opacity-50 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[var(--text-main)]">No past orders</h3>
                <p className="text-[var(--text-muted)] mt-1">Completed or dispatched orders will show up here.</p>
              </div>
            ) : (
              historyOrders.map(order => (
                <motion.div initial={{opacity:0}} animate={{opacity:1}} key={order.id} className="bento-card p-6 opacity-80">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-[var(--text-main)] text-lg">Order #{order.id.slice(0, 8)}</h3>
                      <p className="text-sm text-[var(--text-muted)] font-medium">Weight: {order.total_weight_grams}g</p>
                    </div>
                    <span className="bg-[var(--color-green)]/10 text-[var(--color-green)] border border-[var(--color-green)]/20 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                      {order.status}
                    </span>
                  </div>
                  
                  <div className="bg-[var(--bg-page)]/50 rounded-xl p-4 border border-[var(--border-color)]">
                    <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Items Packed</h4>
                    <ul className="space-y-2">
                      {order.items?.map((item: any, idx: number) => (
                        <li key={idx} className="flex justify-between text-sm">
                          <span className="font-bold text-[var(--text-main)]">{item.qty}x {item.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {order.rating && (
                    <div className="bg-[var(--color-yellow)]/5 rounded-xl p-4 mt-4 border border-[var(--color-yellow)]/10">
                      <div className="flex items-center space-x-1 mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star} 
                            className={`w-4 h-4 ${star <= order.rating ? 'fill-[var(--color-yellow)] text-[var(--color-yellow)]' : 'text-[var(--text-muted)] opacity-30'}`} 
                          />
                        ))}
                        <span className="text-xs font-bold text-[var(--color-yellow)] ml-2">
                          {order.rating}/5
                        </span>
                      </div>
                      {order.feedback && (
                        <p className="text-sm text-[var(--text-main)] italic">"{order.feedback}"</p>
                      )}
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        )}
      </main>

      <AnimatePresence>
         {showProfileModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95, y: 20 }}
                 animate={{ opacity: 1, scale: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.95, y: 20 }}
                 className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100"
               >
                 <div className="flex justify-between items-center mb-6">
                   <h2 className="text-xl font-bold text-slate-900">Edit Shop Profile</h2>
                   <button onClick={() => setShowProfileModal(false)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                     <X className="w-5 h-5" />
                   </button>
                 </div>
                 <form onSubmit={handleUpdateShop} className="space-y-5">
                   <WaveInput required type="text" label="Shop Name" value={shopSetup.name} onChange={e => setShopSetup({...shopSetup, name: e.target.value})} />
                   <div>
                     <label className="block text-sm font-semibold text-slate-700 mb-2">Shop Banner</label>
                     <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
                     {shopSetup.banner_url && <img src={shopSetup.banner_url} alt="Banner" className="mt-2 h-20 w-auto rounded-lg object-cover" />}
                   </div>
                   <WaveInput required type="text" label="Categories (Comma separated)" value={shopSetup.categories} onChange={e => setShopSetup({...shopSetup, categories: e.target.value})} />
                   <WaveInput required type="tel" label="WhatsApp Number" value={shopSetup.whatsapp_number} onChange={e => setShopSetup({...shopSetup, whatsapp_number: e.target.value})} />
                   <div className="flex justify-end space-x-3 mt-8">
                     <button type="button" onClick={() => setShowProfileModal(false)} className="px-5 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                     <button type="submit" className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl shadow-sm hover:bg-emerald-700 transition-colors">Save Changes</button>
                   </div>
                 </form>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
    </div>
  );
}
