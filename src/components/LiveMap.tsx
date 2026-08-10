import { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCRBf2b1voiT2blqKtlXZp8z1hSE04Vwmc';

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

// Generate a gentle curve between two points
function generateCurvedPath(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  numPoints = 30
): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  const midLat = (start.lat + end.lat) / 2;
  const midLng = (start.lng + end.lng) / 2;
  
  // Calculate perpendicular offset for the curve
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const offset = dist * 0.15; // 15% curve intensity
  
  // Perpendicular direction
  const controlLat = midLat + (-dx / dist) * offset;
  const controlLng = midLng + (dy / dist) * offset;
  
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    // Quadratic Bezier curve
    const lat = (1 - t) * (1 - t) * start.lat + 2 * (1 - t) * t * controlLat + t * t * end.lat;
    const lng = (1 - t) * (1 - t) * start.lng + 2 * (1 - t) * t * controlLng + t * t * end.lng;
    points.push({ lat, lng });
  }
  return points;
}

interface LiveMapProps {
  startLat: number;
  startLng: number;
  dropLat: number;
  dropLng: number;
  currentLat?: number;
  currentLng?: number;
}

export function LiveMap({ startLat, startLng, dropLat, dropLng, currentLat, currentLng }: LiveMapProps) {
  const isDark = useIsDark();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [robotPos, setRobotPos] = useState<{ lat: number; lng: number }>({
    lat: currentLat || startLat,
    lng: currentLng || startLng,
  });

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const curvedPath = generateCurvedPath(
    { lat: startLat, lng: startLng },
    { lat: dropLat, lng: dropLng }
  );

  // Simulate movement along the curved path
  useEffect(() => {
    if (currentLat && currentLng) {
      setRobotPos({ lat: currentLat, lng: currentLng });
      return;
    }

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      if (step >= curvedPath.length) {
        step = curvedPath.length - 1;
        clearInterval(interval);
      }
      setRobotPos(curvedPath[step]);
    }, 1000);

    return () => clearInterval(interval);
  }, [startLat, startLng, dropLat, dropLng, currentLat, currentLng]);

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
        {/* Curved Route - Glow layer */}
        <Polyline
          path={curvedPath}
          options={{
            strokeColor: '#6366f1',
            strokeWeight: 6,
            strokeOpacity: 0.25,
          }}
        />

        {/* Curved Route - Main dashed line */}
        <Polyline
          path={curvedPath}
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
