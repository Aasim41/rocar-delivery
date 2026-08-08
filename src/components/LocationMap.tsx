import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default icon paths for Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

function getMockCoords(address: string): [number, number] {
  if (address.startsWith('GPS: ')) {
    const parts = address.replace('GPS: ', '').split(', ');
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
    }
  }

  const defaultPos: [number, number] = [24.6355, 77.3090];
  if (!address || address.length < 2) return defaultPos;
  
  let hash = 0;
  for (let i = 0; i < address.length; i++) hash = address.charCodeAt(i) + ((hash << 5) - hash);
  const latOffset = (hash % 100) / 10000;
  const lngOffset = ((hash >> 8) % 100) / 10000;
  return [defaultPos[0] + latOffset, defaultPos[1] + lngOffset];
}

export function LocationMap({ locations, onLocationSelect }: { locations: { address: string, label: string }[], onLocationSelect?: (address: string) => void }) {
  const validLocs = locations.filter(l => l.address && l.address.length > 1);
  const mainPos = validLocs.length > 0 ? getMockCoords(validLocs[0].address) : [24.6355, 77.3090];

  function MapController() {
    const map = useMap();
    useMapEvents({
      click(e) {
        if (onLocationSelect) {
          onLocationSelect(`GPS: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`);
        }
      }
    });
    useEffect(() => {
      if (validLocs.length > 0) {
        if (validLocs.length === 1) {
          map.flyTo(getMockCoords(validLocs[0].address), 16);
        } else {
          // fit bounds if multiple
          const bounds = L.latLngBounds(validLocs.map(l => getMockCoords(l.address)));
          map.fitBounds(bounds, { padding: [30, 30] });
        }
      }
      
      // Fix gray tiles when container size changes (e.g. from Framer Motion animations)
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 400); // 400ms allows the spring animation to finish
      
      return () => clearTimeout(timer);
    }, [validLocs.map(l => l.address).join(','), map]);
    return null;
  }

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-sm border border-[var(--border-color)]">
      <MapContainer center={mainPos as [number, number]} zoom={16} style={{ height: '100%', width: '100%' }} zoomControl={true} dragging={true} scrollWheelZoom={true}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
        {validLocs.map((loc, i) => (
          <Marker key={i} position={getMockCoords(loc.address)}>
            <Popup>{loc.label}</Popup>
          </Marker>
        ))}
        <MapController />
      </MapContainer>
    </div>
  );
}
