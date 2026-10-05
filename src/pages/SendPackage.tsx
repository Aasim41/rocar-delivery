import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowLeft, Search, MapPin, Map as MapIcon, X, Navigation2, User as UserIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SwipeToConfirm } from '../components/SwipeToConfirm';

// --- Types ---
interface User {
  id: string;
  name?: string;
  email: string;
}

interface SavedLocation {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

interface LocationCoords {
  lat: number;
  lng: number;
  address?: string;
}

// --- Hooks ---
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyBX0xNBFK24V2DZgMQHFku3tWcJWtVjgds';

const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#18181b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#09090b' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a1a1aa' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d4d4d8' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#a1a1aa' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#18181b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#27272a' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#18181b' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#a1a1aa' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3f3f46' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#18181b' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#09090b' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3f3f46' }] },
];

// --- Fullscreen Map Picker with Google Places Search ---
function FullscreenMapPicker({ onConfirm, onClose, initialCoords }: {
  onConfirm: (coords: LocationCoords) => void;
  onClose: () => void;
  initialCoords: LocationCoords | null;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerInstance = useRef<google.maps.Marker | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<LocationCoords | null>(initialCoords);
  const [address, setAddress] = useState('');
  const geocoder = useRef<google.maps.Geocoder | null>(null);

  // Reverse geocode to get address from coords
  const reverseGeocode = (lat: number, lng: number) => {
    if (!geocoder.current) geocoder.current = new google.maps.Geocoder();
    geocoder.current.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        setAddress(results[0].formatted_address);
      }
    });
  };

  const placeMarker = (lat: number, lng: number) => {
    setSelectedCoords({ lat, lng });
    reverseGeocode(lat, lng);
    if (!markerInstance.current) {
      markerInstance.current = new google.maps.Marker({
        position: { lat, lng },
        map: mapInstance.current,
        animation: google.maps.Animation.DROP,
      });
    } else {
      markerInstance.current.setPosition({ lat, lng });
    }
    mapInstance.current?.panTo({ lat, lng });
  };

  useEffect(() => {
    if (!mapRef.current) return;

    const center = initialCoords || { lat: 24.4356, lng: 77.1607 };

    mapInstance.current = new google.maps.Map(mapRef.current, {
      center,
      zoom: 18,
      styles: darkMapStyles,
      mapTypeId: 'hybrid',
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
      gestureHandling: 'greedy',
    });

    // Click to place pin
    mapInstance.current.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        placeMarker(e.latLng.lat(), e.latLng.lng());
      }
    });

    // If initial coords, place marker
    if (initialCoords) {
      placeMarker(initialCoords.lat, initialCoords.lng);
    }

    // Google Places Autocomplete on the search input
    if (searchRef.current) {
      const autocomplete = new google.maps.places.Autocomplete(searchRef.current, {
        types: ['establishment', 'geocode'],
        componentRestrictions: { country: 'in' },
      });
      autocomplete.bindTo('bounds', mapInstance.current);

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          placeMarker(lat, lng);
          setAddress(place.formatted_address || place.name || '');
          mapInstance.current?.setZoom(19);
        }
      });
    }

    // Try to center on user's location
    if (!initialCoords && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          mapInstance.current?.setCenter(c);
          mapInstance.current?.setZoom(18);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    }
  }, []);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col"
    >
      {/* Search Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 pt-20">
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search a place..."
            className="w-full bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-2xl py-3.5 pl-11 pr-12 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 text-[15px]"
          />
          <button
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <X size={16} className="text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} className="flex-1 w-full" />

      {/* Center crosshair hint */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
        <div className="w-1 h-1 bg-white rounded-full shadow-lg shadow-white/30" />
      </div>

      {/* Bottom Confirm Panel */}
      {selectedCoords && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 p-5 pb-8"
        >
          <div className="max-w-md mx-auto">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-zinc-800 rounded-lg mt-0.5">
                <MapPin size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-zinc-400 font-mono">
                  {selectedCoords.lat.toFixed(7)}, {selectedCoords.lng.toFixed(7)}
                </p>
                {address && (
                  <p className="text-[13px] text-zinc-300 mt-1 truncate">{address}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => onConfirm({ ...selectedCoords, address })}
              className="w-full bg-white text-zinc-900 font-semibold py-3.5 rounded-xl text-[15px] hover:bg-zinc-200 transition-colors active:scale-[0.98]"
            >
              Confirm Location
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>,
    document.body
  );
}

// --- Location Selector Component ---
const LocationSelector: React.FC<{
  title: string;
  savedLocations: SavedLocation[];
  selectedLocation: LocationCoords | null;
  onSelect: (coords: LocationCoords) => void;
  saveLabel: string;
  setSaveLabel: (label: string) => void;
  willSave: boolean;
  setWillSave: (save: boolean) => void;
  mapsLoaded: boolean;
}> = ({ title, savedLocations, selectedLocation, onSelect, saveLabel, setSaveLabel, willSave, setWillSave, mapsLoaded }) => {
  const [showFullMap, setShowFullMap] = useState(false);

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onSelect({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Could not get current location. Please enable GPS and try again.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-semibold tracking-tight text-slate-200">{title}</h3>
      
      {/* Saved Locations */}
      {savedLocations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {savedLocations.map(loc => (
            <button
              key={loc.id}
              onClick={() => onSelect({ lat: loc.lat, lng: loc.lng })}
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all border ${
                selectedLocation && selectedLocation.lat === loc.lat && selectedLocation.lng === loc.lng
                  ? 'bg-blue-600 text-white border-blue-400 font-semibold shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                  : 'bg-slate-900/60 border-indigo-950/70 text-slate-300 hover:bg-indigo-950/30'
              }`}
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
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900/60 text-slate-200 font-medium hover:bg-indigo-950/30 transition-all border border-indigo-950/70 hover:border-indigo-700/40 text-xs"
        >
          <Navigation2 size={15} className="text-blue-400" />
          Current Location
        </button>
        <button
          onClick={() => setShowFullMap(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900/60 text-slate-200 hover:bg-indigo-950/30 transition-all border border-indigo-950/70 hover:border-indigo-700/40 font-medium text-xs"
        >
          <MapIcon size={15} className="text-indigo-400" />
          Drop Pin
        </button>
      </div>

      {/* Fullscreen Map */}
      <AnimatePresence>
        {showFullMap && mapsLoaded && (
          <FullscreenMapPicker
            initialCoords={selectedLocation}
            onConfirm={(coords) => {
              onSelect(coords);
              setShowFullMap(false);
            }}
            onClose={() => setShowFullMap(false)}
          />
        )}
      </AnimatePresence>

      {/* Selected Location Info */}
      {selectedLocation && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl card-navy-glass flex flex-col gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-950/60 border border-indigo-800/40 rounded-xl text-blue-400">
              <MapPin size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200">Location Selected</p>
              <p className="text-[11px] text-blue-300/60 font-mono mt-0.5">
                {selectedLocation.lat.toFixed(7)}, {selectedLocation.lng.toFixed(7)}
              </p>
              {selectedLocation.address && (
                <p className="text-[11px] text-slate-400 mt-0.5">{selectedLocation.address}</p>
              )}
            </div>
          </div>
          
          <div className="border-t border-indigo-950/60 pt-3 flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={willSave}
                onChange={(e) => setWillSave(e.target.checked)}
                className="w-4 h-4 rounded border-indigo-900 text-blue-600 focus:ring-0 bg-slate-900 accent-blue-600"
              />
              <span className="text-xs text-slate-300">Save this location for later</span>
            </label>
            {willSave && (
              <input
                type="text"
                placeholder="e.g. My Dorm, Library"
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                className="w-full bg-slate-900/80 border border-indigo-950/70 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
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
  const containerRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (orbRef.current) {
      gsap.to(orbRef.current, {
        x: '+=25',
        y: '+=20',
        scale: 1.15,
        opacity: 0.55,
        duration: 9,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    }
  }, { scope: containerRef });

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  
  // Receiver Selection State (Permanent Input)
  const [receiverName, setReceiverName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedReceiver, setSelectedReceiver] = useState<User | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

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

  // Load Google Maps Script
  useEffect(() => {
    if (window.google?.maps) {
      setMapsLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);
  }, []);

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
        .select('id, name, email')
        .or(`email.ilike.%${debouncedSearch}%,name.ilike.%${debouncedSearch}%`)
        .neq('id', currentUser?.id || '')
        .limit(5);
        
      if (!error && data) {
        setSearchResults(data);
      }
      setIsSearching(false);
    };
    searchUsers();
  }, [debouncedSearch, currentUser]);

  // Receiver is OPTIONAL — can submit with just locations
  const canSubmit = pickupCoords !== null && dropoffCoords !== null;

  // Build helpful missing-field text
  const getMissingText = () => {
    const missing: string[] = [];
    if (!pickupCoords) missing.push('pickup');
    if (!dropoffCoords) missing.push('dropoff');
    if (missing.length > 0) return `Set ${missing.join(' & ')} location`;
    return '';
  };

  const handleConfirmDispatch = async () => {
    if (!canSubmit || !currentUser) return;

    try {
      const finalDetails = receiverName.trim()
        ? (packageDetails.trim() ? `To: ${receiverName.trim()} • ${packageDetails.trim()}` : `To: ${receiverName.trim()}`)
        : (packageDetails.trim() || null);

      const { data: deliveryData, error: deliveryError } = await supabase
        .from('deliveries')
        .insert({
          sender_id: currentUser.id,
          receiver_id: selectedReceiver?.id || null,
          pickup_lat: pickupCoords.lat,
          pickup_lng: pickupCoords.lng,
          dropoff_lat: dropoffCoords.lat,
          dropoff_lng: dropoffCoords.lng,
          package_details: finalDetails,
          delivery_type: 'send',
          status: 'pending'
        })
        .select('id')
        .single();

      if (deliveryError) throw deliveryError;

      // Save locations if requested
      if (savePickup && pickupLabel && pickupCoords) {
        await supabase.from('saved_locations').insert({
          user_id: currentUser.id,
          label: pickupLabel,
          lat: pickupCoords.lat,
          lng: pickupCoords.lng,
        });
      }
      if (saveDropoff && dropoffLabel && dropoffCoords) {
        await supabase.from('saved_locations').insert({
          user_id: currentUser.id,
          label: dropoffLabel,
          lat: dropoffCoords.lat,
          lng: dropoffCoords.lng,
        });
      }

      if (deliveryData?.id) {
        navigate(`/tracking/${deliveryData.id}`);
      }
    } catch (err: any) {
      console.error('Error creating delivery:', err);
      alert('Failed to create delivery: ' + err.message);
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
    <div ref={containerRef} className="min-h-screen bg-[#050814] text-slate-100 flex flex-col max-w-md mx-auto w-full relative overflow-hidden font-sans">
      {/* GSAP Ambient Floating Navy/Indigo Orbs */}
      <div 
        ref={orbRef}
        className="pointer-events-none absolute -top-24 -left-20 w-80 h-80 rounded-full bg-gradient-to-br from-blue-700/20 via-indigo-900/15 to-transparent blur-3xl opacity-40 z-0"
      />
      <div 
        className="pointer-events-none absolute top-1/2 -right-24 w-80 h-80 rounded-full bg-gradient-to-tl from-indigo-950/25 via-blue-950/15 to-transparent blur-3xl opacity-30 z-0"
      />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#050814]/80 backdrop-blur-xl border-b border-indigo-950/50 px-5 py-4 flex items-center gap-4 relative">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-indigo-950/40 text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
            Send Package
          </h1>
          <p className="text-[12px] text-blue-300/50">Dispatch a package to someone on campus</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-8 pb-32 relative z-10">
        
        {/* Receiver Name Field (Permanent) */}
        <motion.section 
          custom={0} initial="hidden" animate="visible" variants={staggerVariants}
          className="flex flex-col gap-3 relative z-30"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-tight text-slate-200 flex items-center gap-2">
              <UserIcon size={16} className="text-blue-400" /> Receiver Name
            </h3>
            <span className="text-[10px] text-blue-400 font-mono uppercase tracking-wider font-semibold">
              {receiverName.trim() ? '✓ Added' : 'Permanent'}
            </span>
          </div>
          
          <div className="relative">
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
              <input
                type="text"
                placeholder="Enter recipient name (e.g. John Doe, Lab 3)..."
                value={receiverName}
                onChange={(e) => {
                  setReceiverName(e.target.value);
                  setSearchQuery(e.target.value);
                  setShowUserDropdown(true);
                }}
                onFocus={() => {
                  if (searchResults.length > 0) setShowUserDropdown(true);
                }}
                className="w-full bg-slate-900/60 border border-indigo-950/70 rounded-xl py-3.5 pl-11 pr-10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all text-[15px]"
              />
              {receiverName && (
                <button 
                  type="button"
                  onClick={() => {
                    setReceiverName('');
                    setSearchQuery('');
                    setSelectedReceiver(null);
                    setShowUserDropdown(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Suggestions dropdown if matching campus users found */}
            <AnimatePresence>
              {showUserDropdown && searchQuery.trim().length >= 2 && (isSearching || searchResults.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 card-navy-glass border border-indigo-900/50 rounded-2xl shadow-2xl overflow-hidden z-40 max-h-60 overflow-y-auto"
                >
                  <div className="p-2 text-[10px] uppercase font-semibold text-blue-300/60 px-3 tracking-wider bg-slate-950/60">
                    Registered Campus Users (Tap to Auto-fill)
                  </div>
                  {isSearching ? (
                    <div className="p-3 text-center text-slate-400 text-xs">Searching campus directory...</div>
                  ) : (
                    <ul>
                      {searchResults.map(user => (
                        <li key={user.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setReceiverName(user.name || user.email);
                              setSelectedReceiver(user);
                              setShowUserDropdown(false);
                            }}
                            className="w-full text-left p-3 hover:bg-indigo-950/40 transition-colors border-b border-indigo-950/50 last:border-0"
                          >
                            <p className="font-semibold text-slate-100 text-sm">{user.name || user.email}</p>
                            {user.name && <p className="text-xs text-blue-300/60">{user.email}</p>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
            mapsLoaded={mapsLoaded}
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
            mapsLoaded={mapsLoaded}
          />
        </motion.section>

        {/* Package Details */}
        <motion.section custom={3} initial="hidden" animate="visible" variants={staggerVariants} className="flex flex-col gap-3">
          <h3 className="text-base font-semibold tracking-tight text-slate-200">Package Details</h3>
          <div>
            <textarea
              rows={3}
              placeholder="What are you sending? (optional)"
              value={packageDetails}
              onChange={(e) => setPackageDetails(e.target.value)}
              className="w-full bg-slate-900/60 border border-indigo-950/70 rounded-2xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all resize-none text-[15px]"
            />
            <p className="text-[11px] text-blue-300/50 mt-2 ml-1">e.g. Lab samples, Documents, Laptop charger</p>
          </div>
        </motion.section>

      </main>

      {/* Swipe to Confirm Footer */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-[#050814]/90 backdrop-blur-xl pt-6 z-50 border-t border-indigo-950/40">
        <SwipeToConfirm 
          onConfirm={handleConfirmDispatch} 
          disabled={!canSubmit}
          text="Slide to dispatch"
          confirmedText="Dispatched!"
        />
        {!canSubmit && (
          <p className="text-center text-[11px] text-slate-500 mt-2">{getMissingText()}</p>
        )}
      </div>
    </div>
  );
}
