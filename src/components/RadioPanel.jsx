import React, { useState, useEffect, useCallback } from 'react';
import { searchStations, getTopStations, AMBIENT_GENRES } from '../utils/radioApi';

function StationItem({ station, onAdd }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/5 group transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-white/80 truncate">{station.name}</div>
        <div className="text-[10px] text-white/30 truncate">{station.country} · {station.tags?.split(',')[0]}</div>
      </div>
      <button
        onClick={() => onAdd(station)}
        className="text-[10px] text-white/20 group-hover:text-white/60 uppercase tracking-widest px-2 py-1 rounded border border-transparent group-hover:border-white/10 transition-all"
      >
        + Layer
      </button>
    </div>
  );
}

export function RadioPanel({ samplers, onAdd, onToggle, onVolumeChange, onRemove }) {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [genre, setGenre] = useState('ambient');
  const [search, setSearch] = useState('');

  const loadStations = useCallback(async () => {
    setLoading(true);
    try {
      const results = search
        ? await searchStations({ name: search, genre, limit: 25 })
        : await searchStations({ genre, limit: 25 });
      setStations(results);
    } finally {
      setLoading(false);
    }
  }, [genre, search]);

  useEffect(() => {
    loadStations();
  }, [genre]);

  return (
    <div className="flex flex-col h-full">
      {/* Active samplers */}
      {samplers.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Active Streams</div>
          {samplers.map(s => (
            <div key={s.id}
              className="rounded-lg border p-3 transition-all"
              style={{ borderColor: s.playing ? '#b8d4c844' : '#222228', background: s.playing ? '#b8d4c808' : '#111114' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => onToggle(s.id)}
                  className="w-5 h-5 rounded-full border flex items-center justify-center"
                  style={{ borderColor: s.playing ? '#b8d4c8' : '#444', background: s.playing ? '#b8d4c822' : 'transparent' }}
                >
                  <span className="text-[8px]">{s.playing ? '■' : '▶'}</span>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-white/70 truncate">{s.station.name}</div>
                  <div className="text-[9px] text-white/25">{s.station.country}</div>
                </div>
                <button onClick={() => onRemove(s.id)} className="text-white/20 hover:text-red-400/60 text-base leading-none">×</button>
              </div>
              <input
                type="range" min={0} max={1} step={0.01} value={s.volume}
                onChange={e => onVolumeChange(s.id, parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          ))}
        </div>
      )}

      {/* Genre pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {AMBIENT_GENRES.map(g => (
          <button
            key={g}
            onClick={() => setGenre(g)}
            className="text-[10px] px-2.5 py-1 rounded-full border transition-all uppercase tracking-widest"
            style={{
              borderColor: genre === g ? '#b8d4c8' : '#333',
              color: genre === g ? '#b8d4c8' : '#666',
              background: genre === g ? '#b8d4c811' : 'transparent',
            }}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadStations()}
          placeholder="Search stations..."
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 placeholder-white/20 outline-none focus:border-white/20"
        />
        <button
          onClick={loadStations}
          className="text-[10px] px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/70 uppercase tracking-widest"
        >
          Go
        </button>
      </div>

      {/* Station list */}
      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        {loading ? (
          <div className="text-xs text-white/20 text-center py-8">Loading streams...</div>
        ) : stations.length === 0 ? (
          <div className="text-xs text-white/20 text-center py-8">No stations found</div>
        ) : (
          stations.map(station => (
            <StationItem key={station.stationuuid} station={station} onAdd={onAdd} />
          ))
        )}
      </div>
    </div>
  );
}
