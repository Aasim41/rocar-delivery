import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

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
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col max-w-md mx-auto w-full relative">
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50 px-5 py-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-zinc-900 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold tracking-tight">Your Profile</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-5 pb-32 flex flex-col gap-8">
        
        {/* Profile Card */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500 opacity-50" />
          
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 shadow-lg overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={28} className="text-zinc-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-white font-medium focus:outline-none focus:border-zinc-500 mb-1"
                />
              ) : (
                <h2 className="text-xl font-bold tracking-tight truncate">{profile?.name || 'User'}</h2>
              )}
              <p className="text-sm text-zinc-500 truncate">{profile?.email}</p>
            </div>
          </div>

          {isEditing ? (
            <div className="flex gap-2">
              <button 
                onClick={handleSaveProfile}
                className="flex-1 bg-white text-zinc-950 font-semibold py-2.5 rounded-xl text-sm hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
              >
                <Save size={16} /> Save
              </button>
              <button 
                onClick={() => { setIsEditing(false); setEditName(profile?.name || ''); }}
                className="flex-1 bg-zinc-800 text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="w-full bg-zinc-800 text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-zinc-700 transition-colors"
            >
              Edit Profile
            </button>
          )}
        </section>

        {/* Saved Locations */}
        <section>
          <h3 className="text-lg font-semibold tracking-tight mb-4 flex items-center gap-2">
            <MapPin size={18} className="text-zinc-400" /> Saved Locations
          </h3>
          
          {savedLocations.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
                <MapPin size={24} className="text-zinc-500" />
              </div>
              <p className="font-medium text-white">No saved locations</p>
              <p className="text-sm text-zinc-500 mt-1">Save locations while sending or fetching packages for quick access.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {savedLocations.map((loc) => (
                <div key={loc.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{loc.label}</p>
                    <p className="text-xs text-zinc-500 font-mono mt-1">{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</p>
                  </div>
                  <button 
                    onClick={() => handleDeleteLocation(loc.id)}
                    className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
        
        {/* Quick Links */}
        <section>
          <h3 className="text-lg font-semibold tracking-tight mb-4">Account</h3>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => navigate('/orders')}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between hover:bg-zinc-800 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Box size={20} className="text-white" />
                </div>
                <div>
                  <p className="font-medium text-white">Delivery History</p>
                  <p className="text-xs text-zinc-500 mt-0.5">View your past dispatches</p>
                </div>
              </div>
            </button>
            
            <button 
              onClick={handleSignOut}
              className="mt-4 w-full bg-red-500/10 text-red-500 font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors"
            >
              <LogOut size={18} /> Sign Out
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}
