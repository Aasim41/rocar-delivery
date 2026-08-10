import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCRBf2b1voiT2blqKtlXZp8z1hSE04Vwmc';

const mapContainerStyle = { width: '100%', height: '100%' };

const defaultCenter = { lat: 24.6355, lng: 77.3090 };

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

function getMapOptions(isDark: boolean): google.maps.MapOptions {
  return {
    disableDefaultUI: true,
    zoomControl: true,
    gestureHandling: 'greedy',
    styles: isDark ? darkMapStyles : undefined,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  };
}

function getMockCoords(address: string): { lat: number; lng: number } {
  if (address.startsWith('GPS: ')) {
    const parts = address.replace('GPS: ', '').split(', ');
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
  }

  if (!address || address.length < 2) return defaultCenter;

  let hash = 0;
  for (let i = 0; i < address.length; i++) hash = address.charCodeAt(i) + ((hash << 5) - hash);
  const latOffset = (hash % 100) / 10000;
  const lngOffset = ((hash >> 8) % 100) / 10000;
  return { lat: defaultCenter.lat + latOffset, lng: defaultCenter.lng + lngOffset };
}

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

export function LocationMap({
  locations,
  onLocationSelect,
  draggable = false,
}: {
  locations: { address: string; label: string }[];
  onLocationSelect?: (address: string) => void;
  draggable?: boolean;
}) {
  const isDark = useIsDark();
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const validLocs = locations.filter((l) => l.address && l.address.length > 1);
  const mainPos = validLocs.length > 0 ? getMockCoords(validLocs[0].address) : defaultCenter;

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      if (validLocs.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        validLocs.forEach((l) => bounds.extend(getMockCoords(l.address)));
        map.fitBounds(bounds, 40);
      } else {
        map.setCenter(mainPos);
        map.setZoom(16);
      }
    },
    [validLocs.map((l) => l.address).join(',')]
  );

  // Update map when locations change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    if (validLocs.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      validLocs.forEach((l) => bounds.extend(getMockCoords(l.address)));
      map.fitBounds(bounds, 40);
    } else if (validLocs.length === 1) {
      map.panTo(getMockCoords(validLocs[0].address));
      map.setZoom(16);
    }
  }, [validLocs.map((l) => l.address).join(','), isLoaded]);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (onLocationSelect && e.latLng) {
        onLocationSelect(`GPS: ${e.latLng.lat().toFixed(5)}, ${e.latLng.lng().toFixed(5)}`);
      }
    },
    [onLocationSelect]
  );

  if (!isLoaded) {
    return (
      <div className="w-full h-full rounded-2xl overflow-hidden shadow-sm border border-[var(--border-color)] flex items-center justify-center bg-[var(--card-bg)]">
        <div className="animate-pulse text-[var(--text-muted)] text-sm">Loading map...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-sm border border-[var(--border-color)]">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mainPos}
        zoom={16}
        onLoad={onLoad}
        onClick={handleMapClick}
        options={getMapOptions(isDark)}
      >
        {validLocs.map((loc, i) => {
          const position = getMockCoords(loc.address);

          if (draggable && i === 0 && onLocationSelect) {
            return (
              <Marker
                key={i}
                position={position}
                draggable={true}
                label={{ text: loc.label, color: '#fff', fontWeight: 'bold', fontSize: '11px' }}
                onDragEnd={(e) => {
                  if (e.latLng) {
                    onLocationSelect(`GPS: ${e.latLng.lat().toFixed(5)}, ${e.latLng.lng().toFixed(5)}`);
                  }
                }}
                animation={google.maps.Animation.DROP}
              />
            );
          }

          return (
            <Marker
              key={i}
              position={position}
              label={{ text: loc.label, color: '#fff', fontWeight: 'bold', fontSize: '11px' }}
              animation={google.maps.Animation.DROP}
            />
          );
        })}
      </GoogleMap>
    </div>
  );
}
