import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, MapPin, Package, LogOut, Loader2, Edit2, Check, Moon, Sun, Settings, Trash2, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export function Profile() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState('');
  
  // Address editing
  const [editingAddressIdx, setEditingAddressIdx] = useState<number | null>(null);
  const [editAddressName, setEditAddressName] = useState('');

  // Developer settings
  const [backendUrl, setBackendUrl] = useState(localStorage.getItem('BACKEND_URL') || 'http://localhost:8000');

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
        setLoading(false);
        return;
      }

      const [profileRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', session.user.id).single()
      ]);
      
      if (profileRes.data) {
        setProfile(profileRes.data);
        setEditName(profileRes.data.name || '');
        setEditAge(profileRes.data.age || '');
      }
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const saveProfile = async () => {
    if (!session) return;
    setIsEditingProfile(false);
    
    setProfile((prev: any) => ({ ...prev, name: editName, age: editAge }));
    await supabase.from('users').update({ name: editName, age: editAge }).eq('id', session.user.id);
  };

  const deleteAddress = async (idx: number) => {
    if (!session || !profile?.saved_locations) return;
    const newLocations = [...profile.saved_locations];
    newLocations.splice(idx, 1);
    setProfile((prev: any) => ({ ...prev, saved_locations: newLocations }));
    await supabase.from('users').update({ saved_locations: newLocations }).eq('id', session.user.id);
  };

  const saveAddress = async (idx: number) => {
    if (!session || !profile?.saved_locations) return;
    const newLocations = [...profile.saved_locations];
    newLocations[idx].name = editAddressName;
    setProfile((prev: any) => ({ ...prev, saved_locations: newLocations }));
    setEditingAddressIdx(null);
    await supabase.from('users').update({ saved_locations: newLocations }).eq('id', session.user.id);
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

  const saveBackendUrl = () => {
    localStorage.setItem('BACKEND_URL', backendUrl);
    // Visual feedback could be added here, but saving is immediate
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

      <header className="mb-8 mt-6 relative z-10 flex items-center">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 mr-3 bg-[var(--bg-page)]/50 border border-[var(--border-color)] rounded-full text-[var(--text-main)] hover:bg-[var(--border-color)] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-extrabold text-[var(--text-main)] tracking-tight">Profile</h1>
      </header>

      {/* User Card */}
      <div className="glass-card p-6 mb-8 relative z-10">
        <div className="flex items-start space-x-4">
          <div className="w-16 h-16 bg-[var(--color-sky)]/10 border border-[var(--color-sky)]/20 rounded-full flex items-center justify-center shrink-0">
            <User className="w-8 h-8 text-[var(--color-sky)]" />
          </div>
          <div className="flex-1 min-w-0 pt-1">
            {isEditingProfile ? (
              <div className="space-y-3">
                <input 
                  type="text" 
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[var(--bg-page)]/50 border border-[var(--border-color)] px-3 py-2 rounded-lg text-[var(--text-main)] font-semibold focus:outline-none focus:border-[var(--color-sky)]"
                  placeholder="Your Name"
                />
                <input 
                  type="number" 
                  value={editAge}
                  onChange={(e) => setEditAge(e.target.value)}
                  className="w-full bg-[var(--bg-page)]/50 border border-[var(--border-color)] px-3 py-2 rounded-lg text-[var(--text-main)] font-semibold focus:outline-none focus:border-[var(--color-sky)]"
                  placeholder="Your Age"
                />
                <button onClick={saveProfile} className="w-full p-2 flex justify-center items-center space-x-2 bg-[var(--color-green)] rounded-lg text-white font-bold hover:opacity-90 transition-opacity">
                  <Check className="w-4 h-4" />
                  <span>Save Profile</span>
                </button>
              </div>
            ) : (
              <div className="group">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <h2 className="text-xl font-bold text-[var(--text-main)] truncate">
                      {profile?.name || 'Set Name'}
                    </h2>
                    <p className="text-[var(--text-muted)] font-medium truncate text-sm">
                      {session?.user?.email || 'No email'} 
                    </p>
                    {profile?.age && <p className="text-[var(--text-muted)] font-medium text-sm mt-1">Age {profile.age}</p>}
                  </div>
                  <button onClick={() => setIsEditingProfile(true)} className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-page)] transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Saved Addresses */}
      <div className="mb-8 relative z-10">
        <h3 className="text-lg font-bold text-[var(--text-main)] mb-4 px-1">Saved Addresses</h3>
        <div className="space-y-3">
          {profile?.saved_locations?.length > 0 && Array.isArray(profile.saved_locations) ? (
            profile.saved_locations.map((loc: any, idx: number) => (
              <div key={idx} className="glass-card flex items-center p-4 hover:border-[var(--color-sky)]/50 transition-colors">
                <div className="w-10 h-10 bg-[var(--color-sky)]/10 rounded-full flex items-center justify-center shrink-0 mr-4">
                  <MapPin className="w-5 h-5 text-[var(--color-sky)]" />
                </div>
                <div className="flex-1 min-w-0">
                  {editingAddressIdx === idx ? (
                    <div className="flex items-center space-x-2">
                      <input 
                        type="text" 
                        autoFocus
                        value={editAddressName}
                        onChange={(e) => setEditAddressName(e.target.value)}
                        className="w-full bg-[var(--bg-page)]/50 border border-[var(--border-color)] px-2 py-1 rounded text-[var(--text-main)] font-semibold focus:outline-none focus:border-[var(--color-sky)]"
                      />
                      <button onClick={() => saveAddress(idx)} className="p-1.5 bg-[var(--color-green)] rounded text-white hover:opacity-90 transition-opacity">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold text-[var(--text-main)] truncate">{loc.name || 'Saved Location'}</p>
                      <p className="text-xs font-medium text-[var(--text-muted)] mt-0.5 truncate">Custom Address</p>
                    </>
                  )}
                </div>
                {editingAddressIdx !== idx && (
                  <div className="flex items-center space-x-1 ml-2">
                    <button onClick={() => { setEditingAddressIdx(idx); setEditAddressName(loc.name); }} className="p-2 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-page)] transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteAddress(idx)} className="p-2 rounded-md text-[var(--color-red)] opacity-70 hover:opacity-100 hover:bg-[var(--color-red)]/10 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
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

      {/* Order History Link */}
      <div className="mb-8 relative z-10">
        <button 
          onClick={() => navigate('/orders')}
          className="w-full glass-card flex items-center p-4 hover:border-[var(--color-sky)]/50 transition-colors text-left"
        >
          <div className="w-12 h-12 bg-[var(--color-sky)]/10 rounded-full flex items-center justify-center shrink-0 mr-4">
            <Package className="w-6 h-6 text-[var(--color-sky)]" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg text-[var(--text-main)]">Order History</h3>
            <p className="text-sm font-medium text-[var(--text-muted)]">View your past orders and receipts</p>
          </div>
          <div className="text-[var(--text-muted)]">
            →
          </div>
        </button>
      </div>

      {/* Settings */}
      <div className="mb-8 relative z-10">
        <h3 className="text-lg font-bold text-[var(--text-main)] mb-4 px-1 flex items-center space-x-2">
          <Settings className="w-5 h-5 text-[var(--text-muted)]" />
          <span>Settings</span>
        </h3>
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[var(--color-sky)]/10 rounded-lg text-[var(--color-sky)]">
              {isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </div>
            <div>
              <p className="font-semibold text-[var(--text-main)]">Dark Mode</p>
              <p className="text-xs text-[var(--text-muted)]">Toggle application theme</p>
            </div>
          </div>
          <button 
            onClick={toggleTheme}
            className={`w-12 h-6 rounded-full transition-colors relative ${isDarkMode ? 'bg-[var(--color-sky)]' : 'bg-slate-300 dark:bg-slate-700'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${isDarkMode ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </div>

      {/* Developer Settings */}
      <div className="glass-card p-6 mb-8 relative z-10">
        <div className="flex items-center space-x-2 mb-4">
          <Settings className="w-5 h-5 text-slate-500" />
          <h2 className="font-bold text-[var(--text-main)] text-lg">Developer Settings</h2>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Backend API URL</label>
          <div className="flex space-x-2">
            <input 
              type="text" 
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              className="flex-1 bg-[var(--bg-page)] border border-[var(--border-color)] px-3 py-2 rounded-lg text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--color-sky)]"
              placeholder="http://localhost:8000"
            />
            <button 
              onClick={saveBackendUrl}
              className="px-4 py-2 bg-[var(--color-sky)] text-white font-bold rounded-lg text-sm hover:opacity-90 transition-opacity"
            >
              Save
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">Use your LocalTunnel URL if accessing from a phone (e.g. https://my-bot.loca.lt).</p>
        </div>
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
