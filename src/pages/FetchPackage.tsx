import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Search, MapPin, Navigation, 
  X, User, Box
} from 'lucide-react';
import { useLoadScript, GoogleMap, Marker } from '@react-google-maps/api';
import { supabase } from '../lib/supabase';
import { SwipeToConfirm } from '../components/SwipeToConfirm';

// Dark styled maps
const mapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
];

const mapContainerStyle = { width: '100%', height: '250px', borderRadius: '0.75rem' };
const defaultCenter = { lat: 37.7749, lng: -122.4194 }; // Placeholder fallback

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface Location {
  id?: string;
  name: string;
  lat: number;
  lng: number;
}

export function FetchPackage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Sender state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedSender, setSelectedSender] = useState<Profile | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Location state
  const [savedLocations, setSavedLocations] = useState<Location[]>([]);
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<Location | null>(null);
  const [savePickup, setSavePickup] = useState(false);
  const [saveDropoff, setSaveDropoff] = useState(false);
  
  // UI state
  const [showPickupMap, setShowPickupMap] = useState(false);
  const [showDropoffMap, setShowDropoffMap] = useState(false);
  const [itemDetails, setItemDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: 'AIzaSyBX0xNBFK24V2DZgMQHFku3tWcJWtVjgds',
  });

  useEffect(() => {
    const fetchUserAndLocations = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      if (user) {
        const { data } = await supabase
          .from('saved_locations')
          .select('*')
          .eq('user_id', user.id);
        if (data) setSavedLocations(data);
      }
    };
    fetchUserAndLocations();
  }, []);

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 2 && currentUser) {
        setIsSearching(true);
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .ilike('full_name', `%${searchQuery}%`)
          .neq('id', currentUser.id)
          .limit(5);
        
        setSearchResults(data || []);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery, currentUser]);

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDropoffLocation({
            name: 'Current Location',
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => alert('Could not get current location.')
      );
    }
  };

  const handleMapClick = (e: google.maps.MapMouseEvent, type: 'pickup' | 'dropoff') => {
    if (!e.latLng) return;
    const loc = {
      name: type === 'pickup' ? 'Pinned Pickup' : 'Pinned Dropoff',
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    };
    if (type === 'pickup') setPickupLocation(loc);
    else setDropoffLocation(loc);
  };

  const onSubmit = async () => {
    if (!currentUser || !selectedSender || !pickupLocation || !dropoffLocation) return;
    
    setIsSubmitting(true);
    try {
      // 1. Save locations if requested
      if (savePickup) {
        await supabase.from('saved_locations').insert({
          user_id: currentUser.id,
          name: pickupLocation.name,
          lat: pickupLocation.lat,
          lng: pickupLocation.lng
        });
      }
      if (saveDropoff && dropoffLocation.name !== 'Current Location') {
        await supabase.from('saved_locations').insert({
          user_id: currentUser.id,
          name: dropoffLocation.name,
          lat: dropoffLocation.lat,
          lng: dropoffLocation.lng
        });
      }

      // 2. Create Delivery
      // In FETCH mode: Current user wants item (Receiver). Selected user has item (Sender).
      const { data, error } = await supabase.from('deliveries').insert({
        sender_id: selectedSender.id,
        receiver_id: currentUser.id,
        pickup_lat: pickupLocation.lat,
        pickup_lng: pickupLocation.lng,
        dropoff_lat: dropoffLocation.lat,
        dropoff_lng: dropoffLocation.lng,
        item_details: itemDetails,
        status: 'pending',
        delivery_type: 'fetch'
      }).select().single();

      if (error) throw error;
      
      // 3. Navigate to tracking
      navigate(`/tracking/${data.id}`);
    } catch (error) {
      console.error('Error creating fetch request:', error);
      alert('Failed to request fetch. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = selectedSender && pickupLocation && dropoffLocation && !isSubmitting;

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4 flex items-center">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-zinc-300" />
        </button>
        <div className="ml-2">
          <h1 className="text-xl font-semibold tracking-tight text-white">Fetch Item</h1>
          <p className="text-xs text-zinc-500">Send an empty cart to collect something</p>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-8">
        
        {/* 1. Sender Selection */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <h2 className="text-sm font-semibold tracking-tight text-zinc-500 uppercase">Who has the item?</h2>
          
          <div className="glass-card bg-zinc-900 rounded-xl p-4 border border-zinc-700">
            {selectedSender ? (
              <div className="flex items-center justify-between bg-white/10 border border-zinc-600/30 p-3 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{selectedSender.full_name}</p>
                    <p className="text-xs text-zinc-500">{selectedSender.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedSender(null)}
                  className="p-2 text-zinc-500 hover:text-zinc-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-zinc-600" />
                </div>
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-zinc-700 rounded-lg leading-5 bg-zinc-950 text-zinc-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 sm:text-sm transition-colors"
                />
                
                {/* Search Results Dropdown */}
                <AnimatePresence>
                  {searchQuery.length > 2 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-10 mt-2 w-full bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg overflow-hidden"
                    >
                      {isSearching ? (
                        <div className="p-4 text-center text-sm text-zinc-600">Searching...</div>
                      ) : searchResults.length > 0 ? (
                        <ul>
                          {searchResults.map((user) => (
                            <li 
                              key={user.id}
                              onClick={() => {
                                setSelectedSender(user);
                                setSearchQuery('');
                                setSearchResults([]);
                              }}
                              className="px-4 py-3 hover:bg-zinc-800 cursor-pointer flex items-center space-x-3 transition-colors"
                            >
                              <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                                <User className="w-4 h-4 text-zinc-300" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-zinc-200">{user.full_name}</p>
                                <p className="text-xs text-zinc-500">{user.email}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="p-4 text-center text-sm text-zinc-600">No users found</div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.section>

        {/* 2. Pickup Location (Their Location) */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          <h2 className="text-sm font-semibold tracking-tight text-zinc-500 uppercase">Their Location (Pickup)</h2>
          <div className="glass-card bg-zinc-900 rounded-xl p-4 border border-zinc-700 space-y-4">
            
            {/* Saved Locations Chips */}
            {savedLocations.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {savedLocations.map((loc, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPickupLocation(loc)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                      pickupLocation?.lat === loc.lat && pickupLocation?.lng === loc.lng
                        ? 'bg-white/20 text-white border-zinc-600/50'
                        : 'bg-zinc-950 text-zinc-300 border-zinc-700 hover:border-slate-500'
                    }`}
                  >
                    {loc.name}
                  </button>
                ))}
              </div>
            )}

            {/* Map Toggle */}
            <button 
              onClick={() => setShowPickupMap(!showPickupMap)}
              className="w-full flex items-center justify-center space-x-2 py-2 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors"
            >
              <MapPin className="w-4 h-4" />
              <span>{showPickupMap ? 'Hide Map' : 'Drop Pin on Map'}</span>
            </button>

            {/* Map Area */}
            <AnimatePresence>
              {showPickupMap && isLoaded && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-lg"
                >
                  <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    zoom={15}
                    center={pickupLocation || defaultCenter}
                    options={{ styles: mapStyles, disableDefaultUI: true }}
                    onClick={(e) => handleMapClick(e, 'pickup')}
                  >
                    {pickupLocation && <Marker position={pickupLocation} />}
                  </GoogleMap>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Selected Coord Display */}
            {pickupLocation && (
              <div className="flex items-center justify-between bg-zinc-950 p-3 rounded-lg border border-zinc-700">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-zinc-300">{pickupLocation.name}</span>
                </div>
                <div className="text-xs text-zinc-600 font-mono">
                  {pickupLocation.lat.toFixed(4)}, {pickupLocation.lng.toFixed(4)}
                </div>
              </div>
            )}

            {/* Save Toggle */}
            {pickupLocation && pickupLocation.name === 'Pinned Pickup' && (
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={savePickup}
                  onChange={(e) => setSavePickup(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-950 text-white focus:ring-cyan-400"
                />
                <span className="text-sm text-zinc-500">Save this location</span>
              </label>
            )}
          </div>
        </motion.section>

        {/* 3. Dropoff Location (Your Location) */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <h2 className="text-sm font-semibold tracking-tight text-zinc-500 uppercase">Your Location (Dropoff)</h2>
          <div className="glass-card bg-zinc-900 rounded-xl p-4 border border-zinc-700 space-y-4">
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleUseCurrentLocation}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-950 text-white border border-zinc-600/30 hover:bg-zinc-950/80 transition-colors"
              >
                <Navigation className="w-3 h-3" />
                <span>Use Current Location</span>
              </button>
              
              {savedLocations.map((loc, idx) => (
                <button
                  key={idx}
                  onClick={() => setDropoffLocation(loc)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                    dropoffLocation?.lat === loc.lat && dropoffLocation?.lng === loc.lng
                      ? 'bg-white/20 text-white border-zinc-600/50'
                      : 'bg-zinc-950 text-zinc-300 border-zinc-700 hover:border-slate-500'
                  }`}
                >
                  {loc.name}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setShowDropoffMap(!showDropoffMap)}
              className="w-full flex items-center justify-center space-x-2 py-2 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors"
            >
              <MapPin className="w-4 h-4" />
              <span>{showDropoffMap ? 'Hide Map' : 'Drop Pin on Map'}</span>
            </button>

            <AnimatePresence>
              {showDropoffMap && isLoaded && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-lg"
                >
                  <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    zoom={15}
                    center={dropoffLocation || defaultCenter}
                    options={{ styles: mapStyles, disableDefaultUI: true }}
                    onClick={(e) => handleMapClick(e, 'dropoff')}
                  >
                    {dropoffLocation && <Marker position={dropoffLocation} />}
                  </GoogleMap>
                </motion.div>
              )}
            </AnimatePresence>

            {dropoffLocation && (
              <div className="flex items-center justify-between bg-zinc-950 p-3 rounded-lg border border-zinc-700">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-rose-400" />
                  <span className="text-sm text-zinc-300">{dropoffLocation.name}</span>
                </div>
                <div className="text-xs text-zinc-600 font-mono">
                  {dropoffLocation.lat.toFixed(4)}, {dropoffLocation.lng.toFixed(4)}
                </div>
              </div>
            )}

            {dropoffLocation && dropoffLocation.name === 'Pinned Dropoff' && (
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={saveDropoff}
                  onChange={(e) => setSaveDropoff(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-950 text-white focus:ring-cyan-400"
                />
                <span className="text-sm text-zinc-500">Save this location</span>
              </label>
            )}
          </div>
        </motion.section>

        {/* 4. Item Details */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <h2 className="text-sm font-semibold tracking-tight text-zinc-500 uppercase">Item Details</h2>
          <div className="glass-card bg-zinc-900 rounded-xl p-4 border border-zinc-700">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 pt-3 pointer-events-none">
                <Box className="h-5 w-5 text-zinc-600" />
              </div>
              <textarea
                placeholder="What should they load? (e.g. Borrowed charger, blue folder)"
                value={itemDetails}
                onChange={(e) => setItemDetails(e.target.value)}
                rows={3}
                className="block w-full pl-10 pr-3 py-3 border border-zinc-700 rounded-lg leading-5 bg-zinc-950 text-zinc-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400 sm:text-sm transition-colors resize-none"
              />
            </div>
          </div>
        </motion.section>

        {/* 5. Submit */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="pt-4 pb-8"
        >
          <div className={`transition-opacity duration-300 ${isValid ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <SwipeToConfirm 
              onConfirm={onSubmit}
              text="Slide to request fetch"
            />
          </div>
        </motion.div>

      </main>
    </div>
  );
}
