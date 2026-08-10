import { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCRBf2b1voiT2blqKtlXZp8z1hSE04Vwmc';

const mapContainerStyle = { width: '100%', height: '100%' };

const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#181818' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
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

  // Simulate movement for the demo if current position isn't provided real-time
  useEffect(() => {
    if (currentLat && currentLng) {
      setRobotPos({ lat: currentLat, lng: currentLng });
      return;
    }

    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.05;
      if (progress >= 1) progress = 1;

      const newLat = startLat + (dropLat - startLat) * progress;
      const newLng = startLng + (dropLng - startLng) * progress;

      setRobotPos({ lat: newLat, lng: newLng });

      if (progress >= 1) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [startLat, startLng, dropLat, dropLng, currentLat, currentLng]);

  const center = {
    lat: (startLat + dropLat) / 2,
    lng: (startLng + dropLng) / 2,
  };

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: startLat, lng: startLng });
      bounds.extend({ lat: dropLat, lng: dropLng });
      map.fitBounds(bounds, 50);
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

  const routePath = [
    { lat: startLat, lng: startLng },
    { lat: dropLat, lng: dropLng },
  ];

  // Custom robot icon using a simple SVG data URI
  const robotIcon: google.maps.Icon = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="18" fill="#3b82f6" stroke="white" stroke-width="3"/>
        <text x="20" y="26" text-anchor="middle" fill="white" font-size="20">🤖</text>
      </svg>
    `),
    scaledSize: new google.maps.Size(40, 40),
    anchor: new google.maps.Point(20, 20),
  };

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-sm border border-gray-200">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={16}
        onLoad={onLoad}
        options={mapOptions}
      >
        {/* Route Line */}
        <Polyline
          path={routePath}
          options={{
            strokeColor: '#3b82f6',
            strokeWeight: 4,
            strokeOpacity: 0.6,
            icons: [
              {
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
                offset: '0',
                repeat: '16px',
              },
            ],
          }}
        />

        {/* Start Point */}
        <Marker
          position={{ lat: startLat, lng: startLng }}
          label={{ text: 'Pickup', color: '#fff', fontWeight: 'bold', fontSize: '11px' }}
          animation={google.maps.Animation.DROP}
        />

        {/* Drop Point */}
        <Marker
          position={{ lat: dropLat, lng: dropLng }}
          label={{ text: 'Drop', color: '#fff', fontWeight: 'bold', fontSize: '11px' }}
          animation={google.maps.Animation.DROP}
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
