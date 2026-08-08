import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
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

// Custom robot icon
const robotIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/bot.svg',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  className: 'bg-blue-600 rounded-full p-1 border-2 border-white shadow-lg'
});

interface LiveMapProps {
  startLat: number;
  startLng: number;
  dropLat: number;
  dropLng: number;
  currentLat?: number;
  currentLng?: number;
}

export function LiveMap({ startLat, startLng, dropLat, dropLng, currentLat, currentLng }: LiveMapProps) {
  const [robotPos, setRobotPos] = useState<[number, number]>([currentLat || startLat, currentLng || startLng]);

  // Simulate movement for the demo if current position isn't provided real-time
  useEffect(() => {
    if (currentLat && currentLng) {
      setRobotPos([currentLat, currentLng]);
      return;
    }

    // Simple linear interpolation simulation for demo
    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.05;
      if (progress >= 1) progress = 1;
      
      const newLat = startLat + (dropLat - startLat) * progress;
      const newLng = startLng + (dropLng - startLng) * progress;
      
      setRobotPos([newLat, newLng]);
      
      if (progress >= 1) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [startLat, startLng, dropLat, dropLng, currentLat, currentLng]);

  const center: [number, number] = [
    (startLat + dropLat) / 2,
    (startLng + dropLng) / 2
  ];

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-sm border border-gray-200">
      <MapContainer 
        center={center} 
        zoom={16} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        dragging={true}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        {/* Route Line */}
        <Polyline 
          positions={[[startLat, startLng], [dropLat, dropLng]]} 
          color="#3b82f6" 
          weight={4}
          dashArray="8, 8"
          opacity={0.6}
        />

        {/* Start Point */}
        <Marker position={[startLat, startLng]}>
          <Popup>Pickup</Popup>
        </Marker>

        {/* Drop Point */}
        <Marker position={[dropLat, dropLng]}>
          <Popup>Destination</Popup>
        </Marker>

        {/* Robot */}
        <Marker position={robotPos} icon={robotIcon} zIndexOffset={1000}>
          <Popup>Robot Location</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
