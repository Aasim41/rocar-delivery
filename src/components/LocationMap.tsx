import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBX0xNBFK24V2DZgMQHFku3tWcJWtVjgds';

const mapContainerStyle = { width: '100%', height: '100%' };

const defaultCenter = { lat: 24.6355, lng: 77.3090 };

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

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  if (loadError) {
    return (
      <div className="w-full h-full rounded-2xl overflow-hidden border border-red-500/30 flex flex-col items-center justify-center bg-[var(--card-bg)] p-4 text-center">
        <p className="text-red-400 font-bold text-sm mb-2">Map Error</p>
        <p className="text-[var(--text-muted)] text-xs break-all">{loadError.message}</p>
      </div>
    );
  }

  const validLocs = locations.filter((l) => l.address && l.address.length > 1);
  const locKey = validLocs.map((l) => l.address).join(',');
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
    [locKey]
  );

  // Smoothly pan to new coordinates when GPS updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    if (validLocs.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      validLocs.forEach((l) => bounds.extend(getMockCoords(l.address)));
      map.fitBounds(bounds, 40);
    } else if (validLocs.length === 1) {
      const newPos = getMockCoords(validLocs[0].address);
      map.panTo(newPos); // Smooth pan animation
      map.setZoom(16);
    }
  }, [locKey, isLoaded]);

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

  // Custom indigo pin marker
  const pinIcon: google.maps.Symbol = {
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    fillColor: '#6366f1',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 2,
    anchor: new google.maps.Point(12, 22),
  };

  // Draggable pin with a different color
  const draggablePinIcon: google.maps.Symbol = {
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    fillColor: '#10b981',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 2.2,
    anchor: new google.maps.Point(12, 22),
  };

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
                icon={draggablePinIcon}
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
              icon={pinIcon}
              animation={google.maps.Animation.DROP}
            />
          );
        })}
      </GoogleMap>
    </div>
  );
}
