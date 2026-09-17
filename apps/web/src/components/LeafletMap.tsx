import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapPin } from '../api/types';

interface LeafletMapProps {
  pins: MapPin[];
  center?: [number, number];
  zoom?: number;
  onBoundsChange?: (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => void;
}

const COLORS: Record<MapPin['type'], string> = {
  place: '#0f6b4f',
  event: '#f2613f',
  experience: '#2c6fb0',
};

export function LeafletMap({ pins, center = [6.25184, -75.56359], zoom = 13, onBoundsChange }: LeafletMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const boundsCb = useRef(onBoundsChange);
  boundsCb.current = onBoundsChange;

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { center, zoom });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);
    const layer = L.layerGroup().addTo(map);

    const emit = () => {
      const b = map.getBounds();
      boundsCb.current?.({
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
      });
    };
    map.on('moveend', emit);
    map.on('zoomend', emit);

    mapRef.current = map;
    layerRef.current = layer;
    emit();

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    pins.forEach((pin) => {
      const marker = L.circleMarker([pin.latitude, pin.longitude], {
        radius: 8,
        color: '#fff',
        weight: 2,
        fillColor: COLORS[pin.type],
        fillOpacity: 0.9,
      });
      const extra =
        pin.extra?.priceCop != null
          ? `<br/><strong>$${Number(pin.extra.priceCop || 0).toLocaleString('es-CO')}</strong>`
          : '';
      marker.bindPopup(`<strong>${pin.title}</strong><br/>${pin.type}${extra}`);
      marker.addTo(layer);
    });
  }, [pins]);

  return <div ref={ref} style={{ height: '100%', width: '100%' }} />;
}