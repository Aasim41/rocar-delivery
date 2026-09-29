import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, MapPin, Crosshair, Map as MapIcon, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SwipeToConfirm } from '../components/SwipeToConfirm';

// --- Types ---
interface User {
  id: string;
  full_name?: string;
  email: string;
}

interface SavedLocation {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}

interface LocationCoords {
  lat: number;
  lng: number;
}

// --- Hooks ---
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

function useGoogleMaps(apiKey: string) {
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    if (window.google && window.google.maps) {
      setIsLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsLoaded(true);
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, [apiKey]);
  return isLoaded;
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyBX0xNBFK24V2DZgMQHFku3tWcJWtVjgds';

const mapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#1e293b' }] }, // slate-800
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] }, // slate-900
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] }, // slate-400
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] }, // slate-700
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#475569' }] }, // slate-600
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#334155' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
];

// --- Subcomponents ---

const LocationSelector: React.FC<{
  title: string;
  savedLocations: SavedLocation[];
  selectedLocation: LocationCoords | null;
  onSelect: (coords: LocationCoords) => void;
  saveLabel: string;
  setSaveLabel: (label: string) => void;
  willSave: boolean;
  setWillSave: (save: boolean) => void;
}> = ({ title, savedLocations, selectedLocation, onSelect, saveLabel, setSaveLabel, willSave, setWillSave }) => {
  const isMapLoaded = useGoogleMaps(GOOGLE_MAPS_API_KEY);
  const [showMap, setShowMap] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerInstance = useRef<google.maps.Marker | null>(null);

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          onSelect({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setShowMap(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Could not get current location.");
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  useEffect(() => {
    if (showMap && isMapLoaded && mapRef.current && !mapInstance.current) {
      const initialCoords = selectedLocation || { lat: 37.7749, lng: -122.4194 }; // Default fallback
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: initialCoords,
        zoom: 15,
        styles: mapStyles,
        disableDefaultUI: true,
      });

      mapInstance.current.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          onSelect({ lat, lng });
          
          if (!markerInstance.current) {
            markerInstance.current = new window.google.maps.Marker({
              position: { lat, lng },
              map: mapInstance.current,
            });
          } else {
            markerInstance.current.setPosition({ lat, lng });
          }
        }
      });
    }
  }, [showMap, isMapLoaded, selectedLocation, onSelect]);

  useEffect(() => {
    if (showMap && markerInstance.current && selectedLocation) {
      markerInstance.current.setPosition(selectedLocation);
      mapInstance.current?.panTo(selectedLocation);
    }
  }, [selectedLocation, showMap]);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold tracking-tight text-white">{title}</h3>
      
      {/* Saved Locations */}
      {savedLocations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {savedLocations.map(loc => (
            <button
              key={loc.id}
              onClick={() => {
                onSelect({ lat: loc.latitude, lng: loc.longitude });
                setShowMap(false);
              }}
              className="px-4 py-2 rounded-full bg-zinc-900 border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              {loc.label}
            </button>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleCurrentLocation}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-900 text-white font-medium hover:bg-zinc-800 transition-colors border border-zinc-700"
        >
          <Crosshair size={18} />
          Current Location
        </button>
        <button
          onClick={() => setShowMap(!showMap)}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-colors border ${showMap ? 'bg-white/10 text-white border-zinc-600/30' : 'bg-zinc-900 text-zinc-200 hover:bg-zinc-800 border-zinc-700'}`}
        >
          <MapIcon size={18} />
          {showMap ? 'Hide Map' : 'Drop Pin'}
        </button>
      </div>

      {/* Map Container */}
      <AnimatePresence>
        {showMap && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 250, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden rounded-xl border border-zinc-700"
          >
            <div ref={mapRef} className="w-full h-full bg-zinc-900" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Location Info & Save Option */}
      {selectedLocation && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 rounded-xl border border-zinc-600/20 bg-white/5 flex flex-col gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-full">
              <MapPin className="text-white" size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">Location Selected</p>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">
                {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </p>
            </div>
          </div>
          
          <div className="border-t border-zinc-700/50 pt-3 flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={willSave}
                onChange={(e) => setWillSave(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 text-white focus:ring-cyan-400 bg-zinc-900"
              />
              <span className="text-sm text-zinc-300">Save this location for later</span>
            </label>
            {willSave && (
              <input
                type="text"
                placeholder="e.g. My Dorm, Library"
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-zinc-600"
              />
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};


// --- Main Component ---

export function SendPackage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Receiver Selection State
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedReceiver, setSelectedReceiver] = useState<User | null>(null);

  // Locations State
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  
  const [pickupCoords, setPickupCoords] = useState<LocationCoords | null>(null);
  const [savePickup, setSavePickup] = useState(false);
  const [pickupLabel, setPickupLabel] = useState('');
  
  const [dropoffCoords, setDropoffCoords] = useState<LocationCoords | null>(null);
  const [saveDropoff, setSaveDropoff] = useState(false);
  const [dropoffLabel, setDropoffLabel] = useState('');

  // Package Details
  const [packageDetails, setPackageDetails] = useState('');

  // Fetch Current User & Saved Locations
  useEffect(() => {
    const fetchInitData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      if (user) {
        const { data: locs } = await supabase
          .from('saved_locations')
          .select('*')
          .eq('user_id', user.id);
        if (locs) setSavedLocations(locs);
      }
    };
    fetchInitData();
  }, []);

  // Search Users
  useEffect(() => {
    const searchUsers = async () => {
      if (debouncedSearch.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .ilike('email', `%${debouncedSearch}%`)
        .neq('id', currentUser?.id || '')
        .limit(5);
        
      if (!error && data) {
        setSearchResults(data);
      }
      setIsSearching(false);
    };
    searchUsers();
  }, [debouncedSearch, currentUser]);

  const canSubmit = selectedReceiver !== null && pickupCoords !== null && dropoffCoords !== null;

  const handleConfirmDispatch = async () => {
    if (!canSubmit || !currentUser) return;

    try {
      // 1. Create delivery
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('deliveries')
        .insert({
          sender_id: currentUser.id,
          receiver_id: selectedReceiver.id,
          pickup_lat: pickupCoords.lat,
          pickup_lng: pickupCoords.lng,
          dropoff_lat: dropoffCoords.lat,
          dropoff_lng: dropoffCoords.lng,
          package_details: packageDetails,
          status: 'pending'
        })
        .select('id')
        .single();

      if (deliveryError) throw deliveryError;

      // 2. Save locations if requested
      if (savePickup && pickupLabel) {
        await supabase.from('saved_locations').insert({
          user_id: currentUser.id,
          label: pickupLabel,
          latitude: pickupCoords.lat,
          longitude: pickupCoords.lng
        });
      }
      if (saveDropoff && dropoffLabel) {
        await supabase.from('saved_locations').insert({
          user_id: currentUser.id,
          label: dropoffLabel,
          latitude: dropoffCoords.lat,
          longitude: dropoffCoords.lng
        });
      }

      // 3. Navigate to tracking
      if (deliveryData?.id) {
        navigate(`/tracking/${deliveryData.id}`);
      }
    } catch (err: any) {
      console.error("Error creating delivery:", err);
      alert("Failed to create delivery: " + err.message);
    }
  };

  const staggerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        type: 'spring' as const,
        stiffness: 300,
        damping: 24,
      }
    })
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col max-w-md mx-auto w-full relative">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 px-4 py-4 flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Send Package</h1>
          <p className="text-sm text-zinc-500">Dispatch a package to someone on campus</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-10 pb-32">
        
        {/* Receiver Selection */}
        <motion.section 
          custom={0} initial="hidden" animate="visible" variants={staggerVariants}
          className="flex flex-col gap-3 relative z-30"
        >
          <h3 className="text-lg font-semibold tracking-tight">Receiver</h3>
          
          {selectedReceiver ? (
            <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-600/30 bg-white/10">
              <div>
                <p className="font-medium text-white">{selectedReceiver.full_name || selectedReceiver.email}</p>
                {selectedReceiver.full_name && <p className="text-sm text-zinc-500">{selectedReceiver.email}</p>}
              </div>
              <button 
                onClick={() => setSelectedReceiver(null)}
                className="p-2 rounded-full hover:bg-white/20 text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={20} />
                <input
                  type="text"
                  placeholder="Search for a user..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-cyan-400 transition-all"
                />
              </div>
              
              <AnimatePresence>
                {searchQuery.trim().length >= 2 && !selectedReceiver && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden z-40 max-h-60 overflow-y-auto"
                  >
                    {isSearching ? (
                      <div className="p-4 text-center text-zinc-500 text-sm">Searching...</div>
                    ) : searchResults.length > 0 ? (
                      <ul>
                        {searchResults.map(user => (
                          <li key={user.id}>
                            <button
                              onClick={() => {
                                setSelectedReceiver(user);
                                setSearchQuery('');
                              }}
                              className="w-full text-left p-4 hover:bg-zinc-800 transition-colors border-b border-zinc-700/50 last:border-0"
                            >
                              <p className="font-medium text-zinc-200">{user.full_name || user.email}</p>
                              {user.full_name && <p className="text-sm text-zinc-500">{user.email}</p>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-4 text-center text-zinc-500 text-sm">No users found.</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.section>

        {/* Pickup Location */}
        <motion.section custom={1} initial="hidden" animate="visible" variants={staggerVariants} className="z-20">
          <LocationSelector
            title="Pickup Location"
            savedLocations={savedLocations}
            selectedLocation={pickupCoords}
            onSelect={setPickupCoords}
            willSave={savePickup}
            setWillSave={setSavePickup}
            saveLabel={pickupLabel}
            setSaveLabel={setPickupLabel}
          />
        </motion.section>

        {/* Dropoff Location */}
        <motion.section custom={2} initial="hidden" animate="visible" variants={staggerVariants} className="z-10">
          <LocationSelector
            title="Dropoff Location"
            savedLocations={savedLocations}
            selectedLocation={dropoffCoords}
            onSelect={setDropoffCoords}
            willSave={saveDropoff}
            setWillSave={setSaveDropoff}
            saveLabel={dropoffLabel}
            setSaveLabel={setDropoffLabel}
          />
        </motion.section>

        {/* Package Details */}
        <motion.section custom={3} initial="hidden" animate="visible" variants={staggerVariants} className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold tracking-tight">Package Details</h3>
          <div>
            <textarea
              rows={3}
              placeholder="What are you sending? (optional)"
              value={packageDetails}
              onChange={(e) => setPackageDetails(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-cyan-400 transition-all resize-none"
            />
            <p className="text-xs text-zinc-600 mt-2 ml-1">e.g. Lab samples, Documents, Laptop charger</p>
          </div>
        </motion.section>

      </main>

      {/* Swipe to Confirm Footer */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent pt-12 z-50">
        <SwipeToConfirm 
          onConfirm={handleConfirmDispatch} 
          disabled={!canSubmit}
          text="Slide to dispatch"
        />
      </div>
    </div>
  );
}
