import { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBX0xNBFK24V2DZgMQHFku3tWcJWtVjgds';

const mapContainerStyle = { width: '100%', height: '100%' };

const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b8ba7' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2a2a4a' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#16162a' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#252545' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#3a3a5c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e1a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2a2a4a' }] },
];

function useIsDark() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

// generateCurvedPath removed in favor of DirectionsService

interface LiveMapProps {
  startLat: number;
  startLng: number;
  dropLat: number;
  dropLng: number;
  currentLat?: number;
  currentLng?: number;
  isMoving?: boolean;
}

export function LiveMap({ startLat, startLng, dropLat, dropLng, currentLat, currentLng, isMoving }: LiveMapProps) {
  const isDark = useIsDark();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [robotPos, _setRobotPos] = useState<{ lat: number; lng: number }>({
    lat: currentLat || startLat,
    lng: currentLng || startLng,
  });
  const robotPosRef = useRef(robotPos);
  
  const setRobotPos = useCallback((pos: {lat: number, lng: number}) => {
    robotPosRef.current = pos;
    _setRobotPos(pos);
  }, []);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const [routePath, setRoutePath] = useState<{lat: number; lng: number}[]>([]);

  useEffect(() => {
    if (!isLoaded) return;
    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: { lat: startLat, lng: startLng },
        destination: { lat: dropLat, lng: dropLng },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          // Use high-resolution step paths instead of the low-res overview_path
          // so the route and bot perfectly snap to the physical road curves
          const rawPath: {lat: number, lng: number}[] = [];
          if (result.routes[0].legs && result.routes[0].legs.length > 0) {
            result.routes[0].legs[0].steps.forEach((step: any) => {
              step.path.forEach((p: any) => {
                rawPath.push({ lat: p.lat(), lng: p.lng() });
              });
            });
          }
          
          // Interpolate path for smooth animation steps
          const interpolatedPath = [];
          if (rawPath.length > 0) {
            // Dramatically speed up for demo purposes! 
            // We want the whole trip to take ~15-20 seconds
            for (let i = 0; i < rawPath.length - 1; i++) {
              const p1 = rawPath[i];
              const p2 = rawPath[i+1];
              const dist = Math.sqrt(Math.pow(p2.lat - p1.lat, 2) + Math.pow(p2.lng - p1.lng, 2));
              // Increase steps to slow down the animation (e.g. 3000 steps per degree)
              const steps = Math.max(1, Math.floor(dist * 3000));
              for (let j = 0; j < steps; j++) {
                interpolatedPath.push({
                  lat: p1.lat + (p2.lat - p1.lat) * (j / steps),
                  lng: p1.lng + (p2.lng - p1.lng) * (j / steps)
                });
              }
            }
            interpolatedPath.push(rawPath[rawPath.length - 1]);
          }
          setRoutePath(interpolatedPath);
        } else {
          // Fallback if Directions API fails (e.g. no billing enabled)
          console.warn("Directions API failed, using fallback straight-line path.");
          const fallbackPath = [];
          for (let i = 0; i <= 30; i++) {
            const t = i / 30;
            fallbackPath.push({
              lat: startLat + (dropLat - startLat) * t,
              lng: startLng + (dropLng - startLng) * t
            });
          }
          setRoutePath(fallbackPath);
        }
      }
    );
  }, [isLoaded, startLat, startLng, dropLat, dropLng]);

  // Real GPS Lerp Animation
  useEffect(() => {
    if (!currentLat || !currentLng) return;
    
    // Lerp from current robotPosRef to the new currentLat/currentLng over ~1.8 seconds
    // to provide smooth movement between the 2 second GPS polling intervals.
    let startTime: number | null = null;
    const startPos = { ...robotPosRef.current };
    let animationFrame: number;
    
    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / 1800, 1);
      
      // Easing function for smoother movement
      const easeProgress = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
      
      setRobotPos({
        lat: startPos.lat + (currentLat - startPos.lat) * easeProgress,
        lng: startPos.lng + (currentLng - startPos.lng) * easeProgress
      });
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [currentLat, currentLng, setRobotPos]);

  // Simulate movement along the road path (Fallback when no real GPS)
  useEffect(() => {
    if (currentLat && currentLng) return; // Disable simulation if real GPS is active

    if (routePath.length === 0 || isMoving === false) return;

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      if (step >= routePath.length) {
        step = routePath.length - 1;
        clearInterval(interval);
      }
      const pos = routePath[step];
      setRobotPos(pos);
      
      // Push live location to python backend to link with Streamlit dash
      // Throttle backend updates to roughly once per second (every 10th step)
      if (step % 10 === 0) {
        const backendUrl = localStorage.getItem('BACKEND_URL') || 'http://localhost:8000';
        fetch(`${backendUrl}/backend/coordinates/live`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: pos.lat, longitude: pos.lng })
        }).catch(err => console.log("Dash map link failed:", err));
      }
      
    }, 100); // Move smoothly every 100ms

    return () => clearInterval(interval);
  }, [routePath, currentLat, currentLng, isMoving]);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: startLat, lng: startLng });
      bounds.extend({ lat: dropLat, lng: dropLng });
      map.fitBounds(bounds, 60);
    },
    [startLat, startLng, dropLat, dropLng]
  );

  if (!isLoaded) {
    return (
      <div className="w-full h-full rounded-2xl overflow-hidden shadow-sm border border-gray-200 flex items-center justify-center bg-[var(--card-bg)]">
        <div className="animate-pulse text-[var(--text-muted)] text-sm">Loading map...</div>
      </div>
    );
  }

  const mapOptions: google.maps.MapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
    gestureHandling: 'greedy',
    styles: isDark ? darkMapStyles : undefined,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  };

  const center = {
    lat: (startLat + dropLat) / 2,
    lng: (startLng + dropLng) / 2,
  };

  // Custom pickup icon (indigo)
  const pickupIcon: google.maps.Symbol = {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 10,
    fillColor: '#6366f1',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 3,
  };

  // Custom drop icon (emerald)
  const dropIcon: google.maps.Symbol = {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 10,
    fillColor: '#10b981',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 3,
  };

  // Robot icon
  const robotIcon: google.maps.Icon = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
        <defs>
          <filter id="glow"><feGaussianBlur stdDeviation="2" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <circle cx="22" cy="22" r="18" fill="#6366f1" stroke="white" stroke-width="3" filter="url(#glow)"/>
        <text x="22" y="28" text-anchor="middle" fill="white" font-size="18">🤖</text>
      </svg>
    `),
    scaledSize: new google.maps.Size(44, 44),
    anchor: new google.maps.Point(22, 22),
  };

  return (
    <div className="w-full h-full overflow-hidden">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={16}
        onLoad={onLoad}
        options={mapOptions}
      >
        {/* Road Route - Glow layer */}
        <Polyline
          path={routePath}
          options={{
            strokeColor: '#6366f1',
            strokeWeight: 6,
            strokeOpacity: 0.25,
          }}
        />

        {/* Road Route - Main dashed line */}
        <Polyline
          path={routePath}
          options={{
            strokeColor: '#6366f1',
            strokeWeight: 3,
            strokeOpacity: 0,
            icons: [
              {
                icon: {
                  path: 'M 0,-1 0,1',
                  strokeOpacity: 0.9,
                  strokeColor: '#6366f1',
                  scale: 3,
                },
                offset: '0',
                repeat: '14px',
              },
            ],
          }}
        />

        {/* Start Point */}
        <Marker
          position={{ lat: startLat, lng: startLng }}
          icon={pickupIcon}
          label={{ text: 'P', color: '#fff', fontWeight: 'bold', fontSize: '11px' }}
        />

        {/* Drop Point */}
        <Marker
          position={{ lat: dropLat, lng: dropLng }}
          icon={dropIcon}
          label={{ text: 'D', color: '#fff', fontWeight: 'bold', fontSize: '11px' }}
        />

        {/* Robot */}
        <Marker
          position={robotPos}
          icon={robotIcon}
          zIndex={1000}
        />
      </GoogleMap>
    </div>
  );
}
