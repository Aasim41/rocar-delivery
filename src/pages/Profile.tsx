import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowLeft, User, MapPin, LogOut, Loader2, Save, Trash2, Box } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface SavedLocation {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

export function Profile() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  useGSAP(() => {
    if (orb1Ref.current) {
      gsap.to(orb1Ref.current, {
        x: '+=20',
        y: '+=15',
        scale: 1.1,
        opacity: 0.5,
        duration: 9,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    }
    if (orb2Ref.current) {
      gsap.to(orb2Ref.current, {
        x: '-=20',
        y: '-=15',
        scale: 1.15,
        opacity: 0.4,
        duration: 11,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    }
  }, { scope: containerRef });

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }

      // Fetch user profile
      const { data: profileData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (profileData) {
        setProfile(profileData);
        setEditName(profileData.name || '');
      }

      // Fetch saved locations
      const { data: locs } = await supabase
        .from('saved_locations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (locs) setSavedLocations(locs);

    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ name: editName })
        .eq('id', profile.id);
        
      if (error) throw error;
      setProfile({ ...profile, name: editName });
      setIsEditing(false);
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    }
  };

  const handleDeleteLocation = async (id: string) => {
    try {
      const { error } = await supabase.from('saved_locations').delete().eq('id', id);
      if (error) throw error;
      setSavedLocations(prev => prev.filter(loc => loc.id !== id));
      toast.success("Location deleted");
    } catch (err: any) {
      toast.error("Failed to delete location");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050814] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-[#050814] text-slate-100 flex flex-col max-w-md mx-auto w-full relative overflow-hidden font-sans select-none">
      {/* GSAP Ambient Fading Gradient Orbs */}
      <div 
        ref={orb1Ref}
        className="pointer-events-none absolute -top-24 -left-20 w-80 h-80 rounded-full bg-gradient-to-br from-blue-700/20 via-indigo-900/15 to-transparent blur-3xl opacity-40 z-0"
      />
      <div 
        ref={orb2Ref}
        className="pointer-events-none absolute top-1/2 -right-20 w-80 h-80 rounded-full bg-gradient-to-tl from-rose-950/25 via-red-900/15 to-transparent blur-3xl opacity-35 z-0"
      />

      <header className="sticky top-0 z-40 bg-[#050814]/80 backdrop-blur-xl border-b border-indigo-950/50 px-5 py-4 flex items-center gap-4 relative">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-indigo-950/40 text-slate-300 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
          Your Profile
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto p-5 pb-32 flex flex-col gap-8 relative z-10">
        
        {/* Profile Card (Fusion Glass: Navy into Crimson) */}
        <section className="card-fusion-glass rounded-2xl p-6 relative overflow-hidden">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center flex-shrink-0 shadow-lg overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={28} className="text-blue-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-slate-900/80 border border-indigo-950/70 rounded-xl px-3 py-1.5 text-white font-medium focus:outline-none focus:border-indigo-500/50 mb-1 text-sm"
                />
              ) : (
                <h2 className="text-lg font-bold tracking-tight text-white truncate">{profile?.name || 'User'}</h2>
              )}
              <p className="text-xs text-blue-300/60 truncate">{profile?.email}</p>
            </div>
          </div>

          {isEditing ? (
            <div className="flex gap-2">
              <button 
                onClick={handleSaveProfile}
                className="flex-1 bg-white text-zinc-950 font-semibold py-2.5 rounded-xl text-xs hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <Save size={15} /> Save
              </button>
              <button 
                onClick={() => { setIsEditing(false); setEditName(profile?.name || ''); }}
                className="flex-1 bg-slate-900/80 border border-indigo-950/70 text-slate-300 font-semibold py-2.5 rounded-xl text-xs hover:bg-indigo-950/40 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="w-full bg-slate-900/70 hover:bg-indigo-950/40 border border-indigo-900/40 text-slate-200 font-semibold py-2.5 rounded-xl text-xs transition-colors"
            >
              Edit Profile
            </button>
          )}
        </section>

        {/* Saved Locations */}
        <section>
          <h3 className="text-base font-semibold tracking-tight text-slate-200 mb-4 flex items-center gap-2">
            <MapPin size={17} className="text-blue-400" /> Saved Locations
          </h3>
          
          {savedLocations.length === 0 ? (
            <div className="card-navy-glass border border-indigo-950/60 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-950/60 border border-indigo-900/40 flex items-center justify-center mb-3">
                <MapPin size={22} className="text-blue-400" />
              </div>
              <p className="font-semibold text-slate-200 text-sm">No saved locations</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">Save locations while sending or fetching packages for quick one-tap access.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {savedLocations.map((loc) => (
                <div key={loc.id} className="card-navy-glass border border-indigo-900/35 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white text-sm">{loc.label}</p>
                    <p className="text-[11px] text-blue-300/50 font-mono mt-1">{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</p>
                  </div>
                  <button 
                    onClick={() => handleDeleteLocation(loc.id)}
                    className="p-2 rounded-xl bg-slate-900/60 border border-indigo-950/60 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
        
        {/* Quick Links */}
        <section>
          <h3 className="text-base font-semibold tracking-tight text-slate-200 mb-4">Account</h3>
          <div className="flex flex-col gap-2.5">
            <button 
              onClick={() => navigate('/orders')}
              className="card-navy-glass border border-indigo-900/35 hover:border-indigo-700/50 rounded-2xl p-4 flex items-center justify-between transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center text-blue-400">
                  <Box size={18} />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">Delivery History</p>
                  <p className="text-xs text-blue-300/50 mt-0.5">View your past campus dispatches</p>
                </div>
              </div>
            </button>
            
            <button 
              onClick={handleSignOut}
              className="mt-4 w-full bg-rose-950/30 text-rose-400 border border-rose-900/40 hover:bg-rose-950/50 font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-colors text-sm"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}
