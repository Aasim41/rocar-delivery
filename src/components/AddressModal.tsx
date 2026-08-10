import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Plus, X, LocateFixed, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LocationMap } from './LocationMap';
import { WaveInput } from './WaveInput';
import { Geolocation } from '@capacitor/geolocation';

export interface SavedLocation {
  name: string;
  lat?: number;
  lng?: number;
}

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (location: SavedLocation) => void;
  title?: string;
}

export function AddressModal({ isOpen, onClose, onSelect, title = "Select Address" }: AddressModalProps) {
  const [view, setView] = useState<'list' | 'add'>('list');
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New Address State
  const [newName, setNewName] = useState('');
  const [newLat, setNewLat] = useState<number | null>(null);
  const [newLng, setNewLng] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setView('list');
      fetchLocations();
    }
  }, [isOpen]);

  const fetchLocations = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session ? session.user.id : (localStorage.getItem('demo_mode') === 'buyer' ? 'demo-user-123' : null);
    
    if (userId) {
      const { data } = await supabase.from('users').select('saved_locations').eq('id', userId).single();
      if (data && data.saved_locations) {
        // Filter out addresses that don't have lat/lng
        const validLocations = (data.saved_locations as SavedLocation[]).filter(loc => loc.lat !== undefined && loc.lng !== undefined);
        setSavedLocations(validLocations);
      }
    }
    setLoading(false);
  };

  const handleAddNew = async () => {
    setIsLocating(true);
    try {
      const position = await Geolocation.getCurrentPosition();
      setNewLat(position.coords.latitude);
      setNewLng(position.coords.longitude);
    } catch (error) {
      console.error(error);
      alert("Please enable GPS permissions to capture your location.");
      setNewLat(24.6355);
      setNewLng(77.3090);
    } finally {
      setIsLocating(false);
    }
    setView('add');
  };

  const handleSaveNew = async () => {
    if (!newName.trim() || newLat === null || newLng === null) return;
    setSaving(true);
    
    const newLoc = { name: newName.trim(), lat: newLat, lng: newLng };
    const updatedLocations = [...savedLocations, newLoc];
    
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session ? session.user.id : (localStorage.getItem('demo_mode') === 'buyer' ? 'demo-user-123' : null);
    
    if (userId) {
      // Append to whatever is currently in the DB (including those without coords)
      const { data: currentData } = await supabase.from('users').select('saved_locations').eq('id', userId).single();
      const allLocs = (currentData?.saved_locations || []) as SavedLocation[];
      await supabase.from('users').update({ saved_locations: [...allLocs, newLoc] }).eq('id', userId);
    }
    
    setSavedLocations(updatedLocations);
    setNewName('');
    setNewLat(null);
    setNewLng(null);
    setView('list');
    setSaving(false);
    
    // Auto-select the newly added address
    onSelect(newLoc);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-auto">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full sm:max-w-md bg-[var(--bg-page)] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[90dvh]"
          >
            <div className="flex justify-between items-center p-5 border-b border-[var(--border-color)] bg-[var(--card-bg)] backdrop-blur-md">
              <h2 className="text-xl font-bold text-[var(--text-main)]">{view === 'list' ? title : 'Add New Address'}</h2>
              <button onClick={view === 'add' ? () => setView('list') : onClose} className="p-2 rounded-full hover:bg-[var(--bg-page)] transition-colors">
                <X className="w-6 h-6 text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {view === 'list' ? (
                <div className="space-y-4">
                  <button 
                    onClick={handleAddNew}
                    disabled={isLocating}
                    className="w-full flex items-center p-4 rounded-2xl border-2 border-dashed border-[var(--color-sky)]/50 hover:border-[var(--color-sky)] hover:bg-[var(--color-sky)]/5 transition-all text-left group disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-[var(--color-sky)]/10 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                      {isLocating ? <Loader2 className="w-5 h-5 text-[var(--color-sky)] animate-spin" /> : <Plus className="w-5 h-5 text-[var(--color-sky)]" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--color-sky)]">{isLocating ? 'Locating...' : 'Add New Address'}</h3>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">Use GPS to pin your exact location</p>
                    </div>
                  </button>

                  <div className="space-y-3">
                    {loading ? (
                      <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 text-[var(--color-sky)] animate-spin" /></div>
                    ) : savedLocations.length === 0 ? (
                      <div className="text-center p-8 text-[var(--text-muted)] bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)]">
                        <MapPin className="w-8 h-8 mx-auto mb-3 opacity-50" />
                        <p>No saved addresses with GPS coordinates found.</p>
                      </div>
                    ) : (
                      savedLocations.map((loc, idx) => (
                        <button 
                          key={idx}
                          onClick={() => { onSelect(loc); onClose(); }}
                          className="w-full flex items-center p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-[var(--color-sky)] hover:shadow-md transition-all text-left group"
                        >
                          <div className="w-10 h-10 rounded-full bg-[var(--bg-page)] flex items-center justify-center mr-4 shadow-sm group-hover:text-[var(--color-sky)] transition-colors">
                            <MapPin className="w-5 h-5" />
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <h3 className="font-bold text-[var(--text-main)] truncate">{loc.name}</h3>
                            <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">
                              {loc.lat?.toFixed(5)}, {loc.lng?.toFixed(5)}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-5 h-full flex flex-col">
                  <div>
                    <WaveInput
                      label="Location Name (e.g. Dorm 4)"
                      type="text"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex-1 min-h-[300px] relative rounded-2xl overflow-hidden border border-[var(--border-color)] shadow-inner z-10">
                    {newLat !== null && newLng !== null ? (
                      <>
                        <div className="absolute top-4 left-4 z-[999] bg-white/90 dark:bg-black/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm border border-[var(--border-color)] flex items-center pointer-events-none">
                          <LocateFixed className="w-3 h-3 mr-1.5 text-[var(--color-sky)]" />
                          Drag pin to adjust
                        </div>
                        <LocationMap 
                          locations={[{ address: `GPS: ${newLat}, ${newLng}`, label: "Move me!" }]} 
                          draggable={true}
                          onLocationSelect={(addr) => {
                            const coords = addr.replace('GPS: ', '').split(', ');
                            setNewLat(parseFloat(coords[0]));
                            setNewLng(parseFloat(coords[1]));
                          }}
                        />
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[var(--bg-page)] text-[var(--text-muted)]">
                        Locating...
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={handleSaveNew}
                    disabled={saving || !newName.trim() || newLat === null}
                    className="w-full minimal-button bg-[var(--color-sky)] text-white font-semibold py-4 rounded-xl shadow-lg hover:opacity-90 transition-opacity text-lg flex justify-center items-center disabled:opacity-50 mt-4"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save & Select'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
