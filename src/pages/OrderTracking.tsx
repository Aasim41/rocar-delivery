import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, MapPin, Package, Navigation2, Scan, CheckCircle2, 
  Timer, Zap, Play, Lock, Unlock, Check, ShieldCheck, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { connectToCartWS, startDelivery, getBackendUrl, setBackendUrl, verifyQR, dispatchCart, completeRetrieval, type CartUpdate } from '../lib/backendApi';
import { sendLocalNotification } from '../lib/notifications';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBX0xNBFK24V2DZgMQHFku3tWcJWtVjgds';

const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#18181b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#09090b' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a1a1aa' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#27272a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3f3f46' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#09090b' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#71717a' }] },
];

const PHASES: Record<string, { label: string; desc: string; icon: any; color: string }> = {
  'PENDING':             { label: 'Pending',           desc: 'Waiting for cart assignment',        icon: Timer,        color: 'text-zinc-400' },
  'HEADING_TO_SENDER':   { label: 'Heading to Pickup', desc: 'Cart driving to the sender',         icon: Navigation2,  color: 'text-amber-400' },
  'AWAITING_LOAD':       { label: 'At Pickup',         desc: 'Cart arrived — waiting for package', icon: Scan,         color: 'text-white' },
  'DELIVERING':          { label: 'In Transit',        desc: 'Package is on the way to receiver!', icon: Package,      color: 'text-amber-400' },
  'AWAITING_RETRIEVAL':  { label: 'Arrived at Destination', desc: 'Cart is here — tap below to unlock', icon: MapPin, color: 'text-emerald-400' },
  'STANDBY':             { label: 'Standby',           desc: 'Delivery complete. Cart waiting.',   icon: CheckCircle2, color: 'text-emerald-400' },
  'RETURNING_TO_BASE':   { label: 'Returning',         desc: 'Cart heading back to charging dock', icon: Zap,          color: 'text-zinc-500' },
  'COMPLETED':           { label: 'Completed',         desc: 'Package successfully delivered!',    icon: CheckCircle2, color: 'text-emerald-400' },
};

function formatETA(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.ceil(seconds / 60)} min`;
}

function interpolatePoints(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  steps: number
): { lat: number; lng: number }[] {
  const pts: { lat: number; lng: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({
      lat: from.lat + (to.lat - from.lat) * t,
      lng: from.lng + (to.lng - from.lng) * t,
    });
  }
  return pts;
}

export function OrderTracking() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [delivery, setDelivery] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [cartPos, setCartPos] = useState<{ lat: number; lng: number } | null>(null);
  const [phase, setPhase] = useState<string>('PENDING');
  const [cargoState, setCargoState] = useState<'LOCKED' | 'UNLOCKED'>('LOCKED');
  const [speed, setSpeed] = useState<number>(0);
  const [eta, setEta] = useState<number | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [routePoints, setRoutePoints] = useState<{ lat: number; lng: number }[]>([]);

  // Action states for receiver and sender
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Simulation
  const [simRunning, setSimRunning] = useState(false);
  const simInterval = useRef<any>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const cartMarker = useRef<google.maps.Marker | null>(null);
  const pickupMarker = useRef<google.maps.Marker | null>(null);
  const dropoffMarker = useRef<google.maps.Marker | null>(null);
  const routePoly = useRef<google.maps.Polyline | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  const [showConfig, setShowConfig] = useState(false);
  const [backendInput, setBackendInput] = useState(getBackendUrl());

  // Safe Google Maps Loader
  useEffect(() => {
    if (window.google?.maps) {
      setMapsLoaded(true);
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      const checkLoaded = setInterval(() => {
        if (window.google?.maps) {
          setMapsLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 200);
      return () => clearInterval(checkLoaded);
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => setMapsLoaded(true);
    script.onerror = () => console.warn('Google Maps script failed to load — offline mode enabled');
    document.head.appendChild(script);
  }, []);

  // Fetch Delivery Details from Supabase
  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    const fetchDelivery = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted) setCurrentUserId(user.id);

        const { data, error: fetchErr } = await supabase
          .from('deliveries')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!isMounted) return;

        if (fetchErr || !data) {
          setError('Delivery not found');
          setLoading(false);
          return;
        }

        setDelivery(data);
        const normPhase = String(data.status || 'PENDING').toUpperCase();
        setPhase(normPhase);
        setLoading(false);

        // If pending, notify backend to plan route
        if (normPhase === 'PENDING') {
          startDelivery({
            deliveryId: data.id,
            pickup: { lat: Number(data.pickup_lat), lng: Number(data.pickup_lng) },
            dropoff: { lat: Number(data.dropoff_lat), lng: Number(data.dropoff_lng) },
          }).then(() => {
            supabase.from('deliveries').update({ status: 'HEADING_TO_SENDER' }).eq('id', id).then(() => {});
            if (isMounted) setPhase('HEADING_TO_SENDER');
          }).catch((err) => {
            console.warn('Backend offline, running simulation fallback:', err?.message);
          });
        }
      } catch (err: any) {
        console.error('Error fetching delivery:', err);
        if (isMounted) {
          setError('Failed to load delivery');
          setLoading(false);
        }
      }
    };

    fetchDelivery();
    return () => { isMounted = false; };
  }, [id]);

  // Supabase Realtime Subscription for Live Database Updates
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`delivery-realtime-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'deliveries', filter: `id=eq.${id}` },
        (payload) => {
          if (payload?.new) {
            setDelivery(payload.new);
            const newPhase = String(payload.new.status || '').toUpperCase();
            if (newPhase) setPhase(newPhase);

            // Trigger notification on milestone arrival
            if (newPhase === 'AWAITING_RETRIEVAL') {
              sendLocalNotification('🎉 RoCAR Arrived!', 'Your package has arrived! Tap to unlock the cargo bay.', '📍');
            } else if (newPhase === 'DELIVERING') {
              sendLocalNotification('📦 Package on the way!', 'RoCAR is driving to your location.', '🚀');
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Connect to Backend WebSocket
  const lastSyncedPhase = useRef<string>('');

  useEffect(() => {
    const cleanup = connectToCartWS(
      (data: CartUpdate) => {
        if (data.cart) setCartPos(data.cart);
        if (data.phase) {
          const upperPhase = String(data.phase).toUpperCase();
          setPhase(upperPhase);
          if (id && upperPhase !== lastSyncedPhase.current) {
            lastSyncedPhase.current = upperPhase;
            const updates: any = { status: upperPhase };
            if (upperPhase === 'COMPLETED') updates.completed_at = new Date().toISOString();
            supabase.from('deliveries').update(updates).eq('id', id).then(() => {});
          }
        }
        if (data.cargo_state) setCargoState(data.cargo_state === 'UNLOCKED' ? 'UNLOCKED' : 'LOCKED');
        if (data.speed !== undefined) setSpeed(Number(data.speed) || 0);
        if (data.eta_seconds !== undefined) setEta(data.eta_seconds);
        if (data.route_points && data.route_points.length > 0) setRoutePoints(data.route_points);
      },
      (connected) => setWsConnected(connected)
    );
    return cleanup;
  }, [id]);

  // User Roles
  const isSender = Boolean(currentUserId && delivery && delivery.sender_id === currentUserId);
  const isReceiver = Boolean(currentUserId && delivery && delivery.receiver_id === currentUserId);

  // Safe Google Map Initializer (Wrapped in try/catch to guarantee zero white screens)
  const initMap = useCallback(() => {
    try {
      if (!mapRef.current || !mapsLoaded || !delivery) return;
      if (!window.google?.maps?.Map) return;
      if (mapInstance.current) return;

      const pLat = Number(delivery.pickup_lat);
      const pLng = Number(delivery.pickup_lng);
      const dLat = Number(delivery.dropoff_lat);
      const dLng = Number(delivery.dropoff_lng);

      if (isNaN(pLat) || isNaN(pLng)) return;

      const center = { lat: pLat, lng: pLng };
      mapInstance.current = new google.maps.Map(mapRef.current, {
        center,
        zoom: 16,
        styles: darkMapStyles,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
      });

      pickupMarker.current = new google.maps.Marker({
        position: { lat: pLat, lng: pLng },
        map: mapInstance.current,
        title: 'Pickup Location',
        icon: {
          path: google.maps.SymbolPath?.CIRCLE || 0,
          scale: 8,
          fillColor: '#ffffff',
          fillOpacity: 1,
          strokeColor: '#27272a',
          strokeWeight: 3,
        },
      });

      if (!isNaN(dLat) && !isNaN(dLng)) {
        dropoffMarker.current = new google.maps.Marker({
          position: { lat: dLat, lng: dLng },
          map: mapInstance.current,
          title: 'Dropoff Location',
          icon: {
            path: google.maps.SymbolPath?.CIRCLE || 0,
            scale: 8,
            fillColor: '#f59e0b',
            fillOpacity: 1,
            strokeColor: '#27272a',
            strokeWeight: 3,
          },
        });

        const bounds = new google.maps.LatLngBounds();
        bounds.extend({ lat: pLat, lng: pLng });
        bounds.extend({ lat: dLat, lng: dLng });
        mapInstance.current.fitBounds(bounds, 50);

        // Request real pedestrian walkway road points from Google
        if (window.google?.maps?.DirectionsService) {
          const directionsService = new google.maps.DirectionsService();
          directionsService.route(
            {
              origin: { lat: pLat, lng: pLng },
              destination: { lat: dLat, lng: dLng },
              travelMode: (google.maps.TravelMode?.WALKING as any) || 'WALKING',
            },
            (result, status) => {
              if (String(status) === 'OK' && result?.routes?.[0]?.overview_path) {
                const roadPts = result.routes[0].overview_path.map((p) => ({
                  lat: p.lat(),
                  lng: p.lng(),
                }));
                setRoutePoints(roadPts);
              }
            }
          );
        }
      }
    } catch (err) {
      console.warn('Map initialization note:', err);
    }
  }, [mapsLoaded, delivery]);

  useEffect(() => { initMap(); }, [initMap]);

  // Smooth Cart Marker Updates
  useEffect(() => {
    try {
      if (!mapInstance.current || !cartPos || !window.google?.maps) return;

      if (!cartMarker.current) {
        cartMarker.current = new google.maps.Marker({
          position: cartPos,
          map: mapInstance.current,
          icon: {
            path: google.maps.SymbolPath?.FORWARD_CLOSED_ARROW || 1,
            scale: 6,
            fillColor: '#22c55e',
            fillOpacity: 1,
            strokeColor: '#09090b',
            strokeWeight: 2,
            rotation: 0,
          },
          title: 'RoCAR Cart',
          zIndex: 100,
        });
      } else {
        cartMarker.current.setPosition(cartPos);
      }
      mapInstance.current.panTo(cartPos);
    } catch (err) {
      console.warn('Cart marker update note:', err);
    }
  }, [cartPos]);

  // Draw Blue Route Polyline
  useEffect(() => {
    try {
      if (!mapInstance.current || routePoints.length === 0 || !window.google?.maps) return;
      if (routePoly.current) routePoly.current.setMap(null);
      routePoly.current = new google.maps.Polyline({
        path: routePoints,
        geodesic: true,
        strokeColor: '#3b82f6',
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map: mapInstance.current,
      });
    } catch (err) {
      console.warn('Route polyline note:', err);
    }
  }, [routePoints]);

  // Clean Simulation Runner
  const startSimulation = useCallback(() => {
    if (!delivery || simRunning) return;
    setSimRunning(true);

    const pLat = Number(delivery.pickup_lat);
    const pLng = Number(delivery.pickup_lng);
    const dLat = Number(delivery.dropoff_lat);
    const dLng = Number(delivery.dropoff_lng);

    const pts = (routePoints && routePoints.length > 2)
      ? routePoints
      : interpolatePoints({ lat: pLat, lng: pLng }, { lat: dLat, lng: dLng }, 40);

    let step = 0;
    setPhase('HEADING_TO_SENDER');
    setSpeed(3.2);
    setEta(pts.length * 2);

    simInterval.current = setInterval(() => {
      if (step >= pts.length) {
        setPhase('AWAITING_RETRIEVAL');
        setSpeed(0);
        setEta(0);
        setSimRunning(false);
        sendLocalNotification('🎉 RoCAR Arrived!', 'Your package is ready! Tap Unlock to open cargo.', '📍');
        if (simInterval.current) clearInterval(simInterval.current);
        return;
      }

      const pos = pts[step];
      setCartPos(pos);
      setEta(Math.max(0, (pts.length - step) * 2));

      if (step === 1) {
        setPhase('AWAITING_LOAD');
        setSpeed(0);
      } else if (step === 3) {
        setPhase('DELIVERING');
        setSpeed(3.8);
      }

      step++;
    }, 600);
  }, [delivery, simRunning, routePoints]);

  useEffect(() => {
    return () => {
      if (simInterval.current) clearInterval(simInterval.current);
    };
  }, []);

  // Receiver Action: Unlock Cargo Bay
  const handleUnlockCargo = async () => {
    setIsUnlocking(true);
    try {
      await verifyQR({ cartId: 'cart_01', action: isReceiver ? 'retrieve' : 'load' });
      setCargoState('UNLOCKED');
      sendLocalNotification('🔓 Cargo Bay Unlocked', 'Latch is open. You can now retrieve your item.', '📦');
    } catch (err) {
      // In simulation or offline mode, simulate hardware unlock
      setCargoState('UNLOCKED');
      sendLocalNotification('🔓 Cargo Bay Unlocked (Demo)', 'Latch is open. You can now retrieve your item.', '📦');
    } finally {
      setIsUnlocking(false);
    }
  };

  // Receiver Action: Confirm Retrieval Complete
  const handleCompleteRetrieval = async () => {
    setIsCompleting(true);
    try {
      await completeRetrieval();
      await supabase.from('deliveries').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', id);

      setPhase('COMPLETED');
      setCargoState('LOCKED');
      sendLocalNotification('✅ Delivery Complete!', 'Thank you for using RoCAR Autonomous Logistics.', '🎉');
    } catch (err) {
      // Offline fallback
      await supabase.from('deliveries').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', id);
      setPhase('COMPLETED');
      setCargoState('LOCKED');
      sendLocalNotification('✅ Delivery Complete! (Demo)', 'Thank you for using RoCAR Autonomous Logistics.', '🎉');
    } finally {
      setIsCompleting(false);
    }
  };

  // Sender Action: Dispatch Loaded Cart
  const handleDispatchCart = async () => {
    try {
      await dispatchCart();
      await supabase.from('deliveries').update({ status: 'DELIVERING' }).eq('id', id);
      setPhase('DELIVERING');
      setCargoState('LOCKED');
      sendLocalNotification('🚀 Cart Dispatched!', 'RoCAR is on the way to the receiver.', '📦');
    } catch {
      await supabase.from('deliveries').update({ status: 'DELIVERING' }).eq('id', id);
      setPhase('DELIVERING');
      setCargoState('LOCKED');
    }
  };

  // Normalization
  const normPhase = String(phase || 'PENDING').toUpperCase();
  const phaseInfo = PHASES[normPhase] || PHASES['PENDING'];
  const PhaseIcon = phaseInfo.icon;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-500 text-sm font-medium">Connecting to RoCAR fleet...</p>
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-4 text-zinc-500">
          <Package size={28} />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Delivery Not Found</h2>
        <p className="text-zinc-500 text-sm mb-6">{error || 'This delivery does not exist or you do not have permission to view it.'}</p>
        <button
          onClick={() => navigate('/')}
          className="bg-white text-zinc-900 px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-zinc-200 transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col max-w-md mx-auto w-full pb-10">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-zinc-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-bold tracking-tight">Live Tracking</h1>
            <p className="text-[11px] text-zinc-500 font-mono">{id?.slice(0, 8)}...</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
            wsConnected ? 'bg-emerald-500/10 text-emerald-400' : simRunning ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800 text-zinc-500'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              wsConnected ? 'bg-emerald-400 animate-pulse' : simRunning ? 'bg-amber-400 animate-pulse' : 'bg-zinc-600'
            }`} />
            {wsConnected ? 'Live' : simRunning ? 'Demo' : 'Offline'}
          </div>
          <button onClick={() => setShowConfig(!showConfig)} className="p-2 rounded-full hover:bg-zinc-900 text-zinc-500 text-xs">⚙</button>
        </div>
      </header>

      {/* Backend URL Config Modal */}
      <AnimatePresence>
        {showConfig && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-b border-zinc-800 bg-zinc-900/50">
            <div className="px-5 py-3 flex gap-2">
              <input
                value={backendInput}
                onChange={(e) => setBackendInput(e.target.value)}
                placeholder="http://192.168.20.20:8000"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-zinc-500"
              />
              <button
                onClick={() => { setBackendUrl(backendInput); setShowConfig(false); window.location.reload(); }}
                className="px-4 py-2 bg-white text-zinc-900 rounded-lg text-xs font-semibold"
              >
                Save
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map View */}
      <div className="relative w-full h-[42vh] bg-zinc-900 border-b border-zinc-800">
        <div ref={mapRef} className="w-full h-full" />
        
        {/* Fallback overlay if maps API is blocked or offline */}
        {!mapsLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-900/90 backdrop-blur-sm">
            <MapPin className="text-zinc-600 mb-2 animate-bounce" size={32} />
            <p className="text-sm font-semibold text-zinc-300">Campus Route Loaded</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              Pickup: {Number(delivery.pickup_lat).toFixed(4)}, {Number(delivery.pickup_lng).toFixed(4)}
              <br />
              Dropoff: {Number(delivery.dropoff_lat).toFixed(4)}, {Number(delivery.dropoff_lng).toFixed(4)}
            </p>
          </div>
        )}

        {/* Cargo State Pill */}
        <div className="absolute bottom-3 left-4 bg-zinc-950/90 backdrop-blur-md border border-zinc-800 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
          {cargoState === 'UNLOCKED' ? (
            <>
              <Unlock size={13} className="text-emerald-400" />
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Cargo Unlocked</span>
            </>
          ) : (
            <>
              <Lock size={13} className="text-zinc-400" />
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Cargo Locked</span>
            </>
          )}
        </div>
      </div>

      {/* Demo Simulation Button */}
      {!wsConnected && !simRunning && normPhase !== 'COMPLETED' && (
        <div className="px-5 pt-4">
          <button
            onClick={startSimulation}
            className="w-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs hover:bg-amber-500/20 transition-colors active:scale-[0.98]"
          >
            <Play size={15} /> Simulate Cart Movement (Demo)
          </button>
        </div>
      )}

      {/* Main Status Panel */}
      <div className="flex-1 px-5 py-4 space-y-4">
        {/* Phase Card */}
        <motion.div
          key={normPhase}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4"
        >
          <div className={`w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center ${phaseInfo.color}`}>
            <PhaseIcon size={22} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-white">{phaseInfo.label}</h2>
              {isReceiver && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Receiver
                </span>
              )}
              {isSender && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Sender
                </span>
              )}
            </div>
            <p className="text-[12px] text-zinc-400 mt-0.5">{phaseInfo.desc}</p>
          </div>
        </motion.div>

        {/* ======================================================== */}
        {/* RECEIVER ACTIONS: Shown when the cart is at destination */}
        {/* ======================================================== */}
        {normPhase === 'AWAITING_RETRIEVAL' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col gap-3 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="font-bold text-white text-[15px]">RoCAR is Ready for Collection</h3>
                <p className="text-xs text-zinc-300">Tap below to open the cargo bay latch.</p>
              </div>
            </div>

            {cargoState === 'LOCKED' ? (
              <button
                onClick={handleUnlockCargo}
                disabled={isUnlocking}
                className="w-full bg-emerald-500 text-zinc-950 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm shadow-md hover:bg-emerald-400 active:scale-[0.98] transition-all"
              >
                <Unlock size={18} />
                {isUnlocking ? 'Unlocking Latch...' : 'Unlock Cargo Bay'}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-700/80 text-center">
                  <p className="text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1.5">
                    <Check size={16} /> Cargo Bay is Unlocked
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Please take your package out of the compartment.</p>
                </div>
                <button
                  onClick={handleCompleteRetrieval}
                  disabled={isCompleting}
                  className="w-full bg-white text-zinc-950 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm shadow-md hover:bg-zinc-200 active:scale-[0.98] transition-all"
                >
                  <CheckCircle2 size={18} />
                  {isCompleting ? 'Finalizing...' : 'Confirm Package Retrieved'}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ======================================================== */}
        {/* SENDER ACTIONS: Shown when cart is at pickup location     */}
        {/* ======================================================== */}
        {normPhase === 'AWAITING_LOAD' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-3 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                <Scan size={24} />
              </div>
              <div>
                <h3 className="font-bold text-white text-[15px]">RoCAR Arrived at Pickup</h3>
                <p className="text-xs text-zinc-300">Load package into cargo compartment.</p>
              </div>
            </div>

            {cargoState === 'LOCKED' ? (
              <button
                onClick={handleUnlockCargo}
                disabled={isUnlocking}
                className="w-full bg-amber-500 text-zinc-950 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm shadow-md hover:bg-amber-400 active:scale-[0.98] transition-all"
              >
                <Unlock size={18} />
                {isUnlocking ? 'Unlocking...' : 'Unlock Cargo to Load'}
              </button>
            ) : (
              <button
                onClick={handleDispatchCart}
                className="w-full bg-white text-zinc-950 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm shadow-md hover:bg-zinc-200 active:scale-[0.98] transition-all"
              >
                <Package size={18} />
                Confirm Loaded & Dispatch Cart
              </button>
            )}
          </motion.div>
        )}

        {/* Telemetry Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <p className="text-lg font-bold font-mono text-white">{formatETA(eta)}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">ETA</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <p className="text-lg font-bold font-mono text-white">{(Number(speed) || 0).toFixed(1)}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">km/h</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <p className="text-lg font-bold font-mono text-white">{isReceiver ? 'Receiver' : 'Sender'}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Your Role</p>
          </div>
        </div>

        {/* Package Details */}
        {delivery?.package_details && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 font-semibold">Package Details</p>
            <p className="text-[14px] text-zinc-200">{delivery.package_details}</p>
          </div>
        )}

        {/* Completed State Banner */}
        {normPhase === 'COMPLETED' && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={24} className="text-emerald-400" />
              <div>
                <p className="font-bold text-white text-sm">Delivery Finished</p>
                <p className="text-xs text-zinc-400">Package was successfully retrieved.</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-800 text-white flex items-center gap-1 hover:bg-zinc-700"
            >
              Done <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
