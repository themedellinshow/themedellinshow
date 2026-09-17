import { useEffect, useState } from 'react';
import { contentApi } from '../api';
import type { MapPin } from '../api/types';
import { LeafletMap } from '../components/LeafletMap';

type PinType = 'place' | 'event' | 'experience';

export function MapPage() {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [bounds, setBounds] = useState({ minLat: 6.15, maxLat: 6.35, minLng: -75.62, maxLng: -75.5 });
  const [active, setActive] = useState<Record<PinType, boolean>>({
    place: true,
    event: true,
    experience: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    contentApi
      .mapPins({
        ...bounds,
        includePlaces: active.place,
        includeEvents: active.event,
        includeExperiences: active.experience,
        lang: 'es',
      })
      .then((result) => {
        if (!cancelled) setPins(result);
      })
      .catch(() => {
        if (!cancelled) setPins([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bounds, active.place, active.event, active.experience]);

  function toggle(type: PinType) {
    setActive((a) => ({ ...a, [type]: !a[type] }));
  }

  const labelMap: Record<PinType, string> = { place: 'Lugares', event: 'Eventos', experience: 'Experiencias' };

  return (
    <div className="page page-flush">
      <div className="page" style={{ paddingBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)' }}>Mapa de Medellín</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--fs-sm)' }}>
          {loading ? 'Cargando…' : `${pins.length} pines en el área visible`}
        </p>
      </div>
      <div className="map-shell">
        <LeafletMap pins={pins} center={[6.25184, -75.56359]} zoom={13} onBoundsChange={setBounds} />
        <div className="map-legend">
          {(Object.keys(labelMap) as PinType[]).map((t) => (
            <button
              key={t}
              className={`chip${active[t] ? ' chip-active' : ''}`}
              onClick={() => toggle(t)}
            >
              {labelMap[t]}
            </button>
          ))}
        </div>
      </div>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)', padding: '0 var(--space-4)' }}>
        Mueve el mapa para cargar más pines. Fuente de fondo: © OpenStreetMap.
      </p>
    </div>
  );
}