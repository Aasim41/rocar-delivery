import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, MapPin, Package, LogOut, Loader2, Edit2, Check, Clock, Moon, Sun } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export function Profile() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
    // Check initial dark mode state
    if (document.documentElement.classList.contains('dark')) {
      setIsDarkMode(true);
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);

    if (session) {
      if (session.user.id === 'demo-user-123') {
        setProfile({ name: 'Demo User', saved_locations: [{ name: 'North Campus Dorm' }] });
        setOrders([]);
        setLoading(false);
        return;
      }

      const [profileRes, ordersRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', session.user.id).single(),
        supabase.from('orders').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
      ]);
      
      if (profileRes.data) {
        setProfile(profileRes.data);
        setEditName(profileRes.data.name || '');
      }
      if (ordersRes.data) setOrders(ordersRes.data);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const saveName = async () => {
    if (!session) return;
    setIsEditingName(false);
    
    // Optimistic update
    setProfile((prev: any) => ({ ...prev, name: editName }));
    
    await supabase.from('users').update({ name: editName }).eq('id', session.user.id);
  };

  const toggleTheme = () => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      setIsDarkMode(false);
      localStorage.setItem('theme', 'light');
    } else {
      html.classList.add('dark');
      setIsDarkMode(true);
      localStorage.setItem('theme', 'dark');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--color-sky)] animate-spin" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-6 max-w-md mx-auto pb-32 font-sans min-h-screen relative overflow-hidden"
    >
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-[var(--color-sky)] rounded-full opacity-10 blur-[80px] pointer-events-none z-0" />

      <header className="mb-8 mt-6 flex justify-between items-center relative z-10">
        <h1 className="text-3xl font-extrabold text-[var(--text-main)] tracking-tight">Profile</h1>
        <button 
          onClick={toggleTheme}
          className="w-12 h-12 glass-panel flex items-center justify-center rounded-full text-[var(--text-main)] hover:scale-105 transition-transform shadow-lg"
        >
          {isDarkMode ? <Sun className="w-5 h-5 font-semibold text-[var(--color-yellow)]" /> : <Moon className="w-5 h-5 font-semibold text-[var(--color-sky)]" />}
        </button>
      </header>

      {/* User Card */}
      <div className="glass-card p-6 mb-8 relative z-10">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-[var(--color-sky)]/10 border border-[var(--color-sky)]/20 rounded-full flex items-center justify-center shrink-0">
            <User className="w-8 h-8 text-[var(--color-sky)]" />
          </div>
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center space-x-2 mb-1">
                <input 
                  type="text" 
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[var(--bg-page)]/50 border border-[var(--border-color)] px-3 py-1 rounded-lg text-[var(--text-main)] font-semibold focus:outline-none focus:border-[var(--color-sky)]"
                  placeholder="Your Name"
                />
                <button onClick={saveName} className="p-2 bg-[var(--color-green)] rounded-lg text-white hover:opacity-90 transition-opacity">
                  <Check className="w-4 h-4 font-bold" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 mb-1 group">
                <h2 className="text-xl font-bold text-[var(--text-main)] truncate">
                  {profile?.name || 'Set Name'}
                </h2>
                <button onClick={() => setIsEditingName(true)} className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-page)] transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            )}
            <p className="text-[var(--text-muted)] font-medium truncate text-sm">
              {session?.user?.email || 'No email'} 
              {profile?.age ? ` • Age ${profile.age}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Saved Addresses */}
      <div className="mb-8 relative z-10">
        <h3 className="text-lg font-bold text-[var(--text-main)] mb-4 px-1">Saved Addresses</h3>
        <div className="space-y-3">
          {profile?.saved_locations?.length > 0 && Array.isArray(profile.saved_locations) ? (
            profile.saved_locations.map((loc: any, idx: number) => (
              <div key={idx} className="glass-card flex items-center space-x-4 p-4 hover:border-[var(--color-sky)]/50 transition-colors cursor-pointer">
                <div className="w-10 h-10 bg-[var(--color-sky)]/10 rounded-full flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-[var(--color-sky)]" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-main)]">{loc.name || 'Saved Location'}</p>
                  <p className="text-xs font-medium text-[var(--text-muted)] mt-0.5">Campus Area</p>
                </div>
              </div>
            ))
          ) : (
            <div className="glass-card p-6 text-center border-dashed border-2">
              <MapPin className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-[var(--text-muted)] mb-2">No saved addresses.</p>
              <p className="text-xs font-mono text-red-500 bg-red-100 p-2 rounded">Raw DB Data: {JSON.stringify(profile?.saved_locations)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Order History */}
      <div className="mb-8 relative z-10">
        <h3 className="text-lg font-bold text-[var(--text-main)] mb-4 px-1">Order History</h3>
        <div className="space-y-3">
          {orders.length > 0 ? (
            orders.map(order => (
              <div key={order.id} onClick={() => navigate(`/tracking/${order.id}?type=marketplace`)} className="glass-card p-4 cursor-pointer hover:border-[var(--color-sky)]/50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="bg-[var(--color-yellow)]/10 p-2 rounded-xl">
                      <Package className="w-5 h-5 text-[var(--color-yellow)]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--text-main)] truncate max-w-[160px]">
                        {order.items && order.items.length > 0 ? order.items[0].name : 'Delivery Order'}
                        {order.items && order.items.length > 1 ? ` (+${order.items.length - 1})` : ''}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] font-medium">#{order.id.split('-')[0]} • {new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${order.status === 'arrived' ? 'bg-[var(--color-green)]/10 text-[var(--color-green)]' : 'bg-[var(--bg-page)] text-[var(--text-muted)]'}`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-[var(--text-muted)] font-medium bg-[var(--bg-page)]/50 rounded-lg p-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{order.items?.length || 0} items • {order.total_weight_grams}g</span>
                </div>
              </div>
            ))
          ) : (
            <div className="glass-card p-8 text-center border-dashed border-2">
              <Package className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-[var(--text-muted)]">No past orders.</p>
            </div>
          )}
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full minimal-button bg-white dark:bg-slate-800 text-[var(--color-red)] py-4 flex items-center justify-center space-x-2 text-lg shadow-sm border border-[var(--border-color)] relative z-10 hover:bg-slate-50 dark:hover:bg-slate-700"
      >
        <LogOut className="w-5 h-5" />
        <span>Log Out</span>
      </button>
    </motion.div>
  );
}
