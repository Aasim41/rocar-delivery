import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Package, Navigation2, Scan, CheckCircle2, Timer, Zap, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { connectToCartWS, startDelivery, getBackendUrl, setBackendUrl, type CartUpdate } from '../lib/backendApi';

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
  'pending':             { label: 'Pending',           desc: 'Waiting for cart assignment',        icon: Timer,        color: 'text-zinc-400' },
  'HEADING_TO_SENDER':   { label: 'Heading to Pickup', desc: 'Cart is driving to the sender',     icon: Navigation2,  color: 'text-amber-400' },
  'AWAITING_LOAD':       { label: 'At Pickup',         desc: 'Cart arrived — scan QR to load',    icon: Scan,         color: 'text-white' },
  'DELIVERING':          { label: 'In Transit',        desc: 'Package is on the way!',            icon: Package,      color: 'text-amber-400' },
  'AWAITING_RETRIEVAL':  { label: 'Arrived',           desc: 'Cart arrived — scan QR to collect', icon: MapPin,       color: 'text-emerald-400' },
  'STANDBY':             { label: 'Standby',           desc: 'Delivery complete. Cart waiting.',   icon: CheckCircle2, color: 'text-emerald-400' },
  'RETURNING_TO_BASE':   { label: 'Returning',         desc: 'Cart heading back to base',         icon: Zap,          color: 'text-zinc-500' },
  'completed':           { label: 'Completed',         desc: 'Delivery finished!',                icon: CheckCircle2, color: 'text-emerald-400' },
};

function formatETA(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.ceil(seconds / 60)} min`;
}

// Interpolate points between two coords for smooth simulation
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
  const [_userId, setUserId] = useState<string | null>(null);
  const [isSender, setIsSender] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [cartPos, setCartPos] = useState<{ lat: number; lng: number } | null>(null);
  const [phase, setPhase] = useState<string>('pending');
  const [speed, setSpeed] = useState(0);
  const [eta, setEta] = useState<number | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [routePoints, setRoutePoints] = useState<{ lat: number; lng: number }[]>([]);

  // Simulation
  const [simRunning, setSimRunning] = useState(false);
  const simInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const cartMarker = useRef<google.maps.Marker | null>(null);
  const pickupMarker = useRef<google.maps.Marker | null>(null);
  const dropoffMarker = useRef<google.maps.Marker | null>(null);
  const routePoly = useRef<google.maps.Polyline | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  const [showConfig, setShowConfig] = useState(false);
  const [backendInput, setBackendInput] = useState(getBackendUrl());

  // Load Google Maps
  useEffect(() => {
    if (window.google?.maps) { setMapsLoaded(true); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Fetch delivery from Supabase
  useEffect(() => {
    if (!id) return;
    const fetchDelivery = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setUserId(user.id);

        const { data, error: fetchErr } = await supabase
          .from('deliveries')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchErr || !data) {
          setError('Delivery not found');
          setLoading(false);
          return;
        }

        setDelivery(data);
        setPhase(data.status);
        setIsSender(data.sender_id === user?.id);
        setLoading(false);

        // Try to fire it off to the backend (non-blocking — won't crash if backend is down)
        if (data.status === 'pending') {
          startDelivery({
            deliveryId: data.id,
            pickup: { lat: data.pickup_lat, lng: data.pickup_lng },
            dropoff: { lat: data.dropoff_lat, lng: data.dropoff_lng },
          }).then(() => {
            supabase.from('deliveries').update({ status: 'HEADING_TO_SENDER' }).eq('id', id);
            setPhase('HEADING_TO_SENDER');
          }).catch((err) => {
            console.warn('Backend not reachable, simulation available:', err.message);
          });
        }
      } catch (err) {
        console.error('Error fetching delivery:', err);
        setError('Failed to load delivery');
        setLoading(false);
      }
    };
    fetchDelivery();
  }, [id]);

  // Subscribe to Supabase Realtime
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`delivery-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deliveries', filter: `id=eq.${id}` },
        (payload) => {
          setDelivery(payload.new);
          setPhase(payload.new.status);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Connect to backend WebSocket (non-blocking)
  useEffect(() => {
    const cleanup = connectToCartWS(
      (data: CartUpdate) => {
        if (data.cart) setCartPos(data.cart);
        if (data.phase) setPhase(data.phase);
        if (data.speed !== undefined) setSpeed(data.speed);
        if (data.eta_seconds !== undefined) setEta(data.eta_seconds);
        if (data.route_points) setRoutePoints(data.route_points);
      },
      (connected) => setWsConnected(connected),
    );
    return cleanup;
  }, []);

  // ─── SIMULATION MODE ──────────────────────────────────
  const startSimulation = useCallback(() => {
    if (!delivery || simRunning) return;

    setSimRunning(true);
    const pickup = { lat: delivery.pickup_lat, lng: delivery.pickup_lng };
    const dropoff = { lat: delivery.dropoff_lat, lng: delivery.dropoff_lng };

    // Phase 1: Cart starts near pickup, approaches it
    const startOffset = { lat: pickup.lat - 0.002, lng: pickup.lng - 0.001 };
    const toPickup = interpolatePoints(startOffset, pickup, 40);
    const toDropoff = interpolatePoints(pickup, dropoff, 80);
    const allPoints = [...toPickup, ...toDropoff];

    let step = 0;
    setPhase('HEADING_TO_SENDER');
    setSpeed(3.2);
    setEta(allPoints.length * 2);

    simInterval.current = setInterval(() => {
      if (step >= allPoints.length) {
        // Simulation complete
        setPhase('AWAITING_RETRIEVAL');
        setSpeed(0);
        setEta(0);
        setSimRunning(false);
        if (simInterval.current) clearInterval(simInterval.current);
        return;
      }

      const pos = allPoints[step];
      setCartPos(pos);
      setEta((allPoints.length - step) * 2);

      // Phase transitions
      if (step === toPickup.length - 1) {
        setPhase('AWAITING_LOAD');
        setSpeed(0);
      } else if (step === toPickup.length + 3) {
        setPhase('DELIVERING');
        setSpeed(4.1);
      } else if (step > toPickup.length + 3) {
        // Vary speed slightly for realism
        setSpeed(3.5 + Math.random() * 1.5);
      }

      step++;
    }, 800); // Update every 800ms

  }, [delivery, simRunning]);

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      if (simInterval.current) clearInterval(simInterval.current);
    };
  }, []);

  // Initialize map
  const initMap = useCallback(() => {
    if (!mapRef.current || !mapsLoaded || !delivery) return;
    if (mapInstance.current) return;

    const center = { lat: delivery.pickup_lat, lng: delivery.pickup_lng };
    mapInstance.current = new google.maps.Map(mapRef.current, {
      center,
      zoom: 16,
      styles: darkMapStyles,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
    });

    pickupMarker.current = new google.maps.Marker({
      position: { lat: delivery.pickup_lat, lng: delivery.pickup_lng },
      map: mapInstance.current,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#ffffff',
        fillOpacity: 1,
        strokeColor: '#27272a',
        strokeWeight: 3,
      },
      title: 'Pickup',
    });

    dropoffMarker.current = new google.maps.Marker({
      position: { lat: delivery.dropoff_lat, lng: delivery.dropoff_lng },
      map: mapInstance.current,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#f59e0b',
        fillOpacity: 1,
        strokeColor: '#27272a',
        strokeWeight: 3,
      },
      title: 'Dropoff',
    });

    // Route line between pickup and dropoff
    new google.maps.Polyline({
      path: [
        { lat: delivery.pickup_lat, lng: delivery.pickup_lng },
        { lat: delivery.dropoff_lat, lng: delivery.dropoff_lng },
      ],
      geodesic: true,
      strokeColor: '#3f3f46',
      strokeOpacity: 0.4,
      strokeWeight: 2,
      map: mapInstance.current,
    });

    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: delivery.pickup_lat, lng: delivery.pickup_lng });
    bounds.extend({ lat: delivery.dropoff_lat, lng: delivery.dropoff_lng });
    mapInstance.current.fitBounds(bounds, 60);
  }, [mapsLoaded, delivery]);

  useEffect(() => { initMap(); }, [initMap]);

  // Update cart marker smoothly
  useEffect(() => {
    if (!mapInstance.current || !cartPos) return;

    if (!cartMarker.current) {
      cartMarker.current = new google.maps.Marker({
        position: cartPos,
        map: mapInstance.current,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#22c55e',
          fillOpacity: 1,
          strokeColor: '#09090b',
          strokeWeight: 2,
          rotation: 0,
        },
        title: 'Cart',
        zIndex: 100,
      });
    } else {
      const curr = cartMarker.current.getPosition();
      if (curr) {
        const startLat = curr.lat();
        const startLng = curr.lng();
        const endLat = cartPos.lat;
        const endLng = cartPos.lng;

        // Calculate heading for arrow direction
        const dLng = endLng - startLng;
        const dLat = endLat - startLat;
        const heading = (Math.atan2(dLng, dLat) * 180) / Math.PI;
        const icon = cartMarker.current.getIcon() as google.maps.Symbol;
        if (icon) {
          icon.rotation = heading;
          cartMarker.current.setIcon(icon);
        }

        let step = 0;
        const steps = 12;
        const interval = setInterval(() => {
          step++;
          const t = step / steps;
          const lat = startLat + (endLat - startLat) * t;
          const lng = startLng + (endLng - startLng) * t;
          cartMarker.current?.setPosition({ lat, lng });
          if (step >= steps) clearInterval(interval);
        }, 50);
      } else {
        cartMarker.current.setPosition(cartPos);
      }
    }

    mapInstance.current.panTo(cartPos);
  }, [cartPos]);

  // Update route polyline from WebSocket
  useEffect(() => {
    if (!mapInstance.current || routePoints.length === 0) return;
    if (routePoly.current) routePoly.current.setMap(null);
    routePoly.current = new google.maps.Polyline({
      path: routePoints,
      geodesic: true,
      strokeColor: '#a1a1aa',
      strokeOpacity: 0.5,
      strokeWeight: 3,
      map: mapInstance.current,
    });
  }, [routePoints]);

  const phaseInfo = PHASES[phase] || PHASES['pending'];
  const PhaseIcon = phaseInfo.icon;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Loading delivery...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <Package size={40} className="text-zinc-600 mb-4" />
        <h2 className="text-lg font-bold text-white mb-2">Delivery Not Found</h2>
        <p className="text-zinc-500 text-sm mb-6">{error}</p>
        <button onClick={() => navigate('/')} className="bg-white text-zinc-900 px-6 py-3 rounded-xl font-semibold">
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col max-w-md mx-auto w-full">
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
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${wsConnected ? 'bg-emerald-500/10 text-emerald-400' : simRunning ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800 text-zinc-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : simRunning ? 'bg-amber-400 animate-pulse' : 'bg-zinc-600'}`} />
            {wsConnected ? 'Live' : simRunning ? 'Demo' : 'Offline'}
          </div>
          <button onClick={() => setShowConfig(!showConfig)} className="p-2 rounded-full hover:bg-zinc-900 text-zinc-500 text-[10px]">⚙</button>
        </div>
      </header>

      {/* Backend URL Config */}
      <AnimatePresence>
        {showConfig && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-b border-zinc-800">
            <div className="px-5 py-3 flex gap-2">
              <input
                value={backendInput}
                onChange={(e) => setBackendInput(e.target.value)}
                placeholder="http://192.168.1.100:8000"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-zinc-500"
              />
              <button
                onClick={() => { setBackendUrl(backendInput); setShowConfig(false); window.location.reload(); }}
                className="px-4 py-2 bg-white text-zinc-900 rounded-lg text-sm font-semibold"
              >
                Save
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map */}
      <div ref={mapRef} className="w-full h-[45vh] bg-zinc-900" />

      {/* Simulate Button (only when backend is offline and sim not running) */}
      {!wsConnected && !simRunning && delivery && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-5 pt-4"
        >
          <button
            onClick={startSimulation}
            className="w-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-amber-500/20 transition-colors active:scale-[0.98]"
          >
            <Play size={18} /> Simulate Cart Movement (Demo)
          </button>
        </motion.div>
      )}

      {/* Status Panel */}
      <div className="flex-1 px-5 py-4 space-y-4">
        {/* Phase Badge */}
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4"
        >
          <div className={`w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center ${phaseInfo.color}`}>
            <PhaseIcon size={22} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold tracking-tight">{phaseInfo.label}</h2>
            <p className="text-[13px] text-zinc-500 mt-0.5">{phaseInfo.desc}</p>
          </div>
        </motion.div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <p className="text-lg font-bold font-mono text-white">{formatETA(eta)}</p>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mt-1">ETA</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <p className="text-lg font-bold font-mono text-white">{speed.toFixed(1)}</p>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mt-1">km/h</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <p className="text-lg font-bold font-mono text-white">{isSender ? 'Sender' : 'Receiver'}</p>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mt-1">Role</p>
          </div>
        </div>

        {/* Package details */}
        {delivery?.package_details && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-[11px] text-zinc-600 uppercase tracking-wider mb-1">Package</p>
            <p className="text-[14px] text-zinc-200">{delivery.package_details}</p>
          </div>
        )}

        {/* Cart position */}
        {cartPos && (
          <div className="text-center">
            <p className="text-[11px] text-zinc-700 font-mono">
              Cart: {cartPos.lat.toFixed(6)}, {cartPos.lng.toFixed(6)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
