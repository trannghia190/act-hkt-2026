import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Chọn vị trí văn phòng trên bản đồ (OpenStreetMap qua Leaflet).
 * Click/drag ghim để đổi toạ độ; hai ô số bên dưới vẫn nhập tay được.
 */
interface Props {
  lat: number;
  lng: number;
  radius?: number;
  onChange: (lat: number, lng: number) => void;
  onRadiusChange?: (radius: number) => void;
}

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#2563eb;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

export const OfficeLocationMap: React.FC<Props> = ({ lat, lng, radius = 150, onChange, onRadiusChange }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [locating, setLocating] = useState(false);
  const [radiusText, setRadiusText] = useState(String(radius));

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 16,
      scrollWheelZoom: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const marker = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map);
    const circle = L.circle([lat, lng], { radius, color: '#2563eb', weight: 1, fillOpacity: 0.08 }).addTo(map);

    marker.on('dragend', () => {
      const p = marker.getLatLng();
      onChangeRef.current(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)));
    });
    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onChangeRef.current(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    });

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;
    // Leaflet cần biết kích thước sau khi modal hiện.
    setTimeout(() => map.invalidateSize(), 50);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const current = markerRef.current?.getLatLng();
    if (!current || Math.abs(current.lat - lat) > 1e-9 || Math.abs(current.lng - lng) > 1e-9) {
      markerRef.current?.setLatLng([lat, lng]);
      circleRef.current?.setLatLng([lat, lng]);
      mapRef.current.panTo([lat, lng]);
    }
  }, [lat, lng]);

  useEffect(() => {
    if (Number.isFinite(radius) && radius > 0) circleRef.current?.setRadius(radius);
    setRadiusText(String(radius));
  }, [radius]);

  const useCurrent = () => {
    if (!navigator.geolocation || locating) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChangeRef.current(Number(pos.coords.latitude.toFixed(6)), Number(pos.coords.longitude.toFixed(6)));
        setLocating(false);
      },
      () => {
        setLocating(false);
        window.alert('Không lấy được vị trí hiện tại — hãy cho phép truy cập vị trí trong trình duyệt.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="sm:col-span-2 space-y-2 border border-line rounded-xl p-3 bg-surface">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink">Vị trí văn phòng trên bản đồ</span>
      </div>
      <div className="relative">
        <div ref={containerRef} className="h-56 w-full rounded-lg overflow-hidden border border-line" />
        <button
          type="button"
          onClick={useCurrent}
          disabled={locating}
          title="Di chuyển đến vị trí hiện tại"
          aria-label="Di chuyển đến vị trí hiện tại"
          className="absolute right-2 bottom-6 z-[500] w-9 h-9 rounded-full bg-surface border border-line shadow-md grid place-items-center text-accent hover:bg-canvas disabled:opacity-60"
        >
          {locating ? (
            <span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              <circle cx="12" cy="12" r="8" />
            </svg>
          )}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="block text-[11px] text-ink-muted">
          Vĩ độ (latitude)
          <input
            type="number"
            step="0.000001"
            className="mt-0.5 w-full border border-line rounded-lg p-2 text-sm bg-surface"
            value={Number.isFinite(lat) ? lat : ''}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) onChangeRef.current(v, lng);
            }}
          />
        </label>
        <label className="block text-[11px] text-ink-muted">
          Kinh độ (longitude)
          <input
            type="number"
            step="0.000001"
            className="mt-0.5 w-full border border-line rounded-lg p-2 text-sm bg-surface"
            value={Number.isFinite(lng) ? lng : ''}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) onChangeRef.current(lat, v);
            }}
          />
        </label>
        <label className="block text-[11px] text-ink-muted">
          Bán kính chấm công
          <span className="mt-0.5 flex items-center gap-1">
            <input
              type="number"
              min={10}
              step={10}
              className="w-full border border-line rounded-lg p-2 text-sm bg-surface"
              value={radiusText}
              onChange={(e) => {
                const raw = e.target.value;
                setRadiusText(raw);
                const v = Number(raw);
                if (raw !== '' && Number.isFinite(v) && v > 0) onRadiusChange?.(v);
              }}
            />
            <span className="shrink-0 text-xs text-ink-muted">m</span>
          </span>
        </label>
      </div>
      <div className="text-[11px] text-ink-muted">
        Click trên bản đồ hoặc kéo ghim để chọn đúng vị trí; vòng tròn xanh thể hiện bán kính chấm công.
      </div>
    </div>
  );
};
