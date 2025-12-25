import React, { useState, useEffect, useRef } from 'react';
import { useMapEvents, useMap, Marker, Popup, TileLayer, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Search, Loader2, MapPin, Navigation, X } from 'lucide-react';
import { LocationPoint } from '../types';

// Fix for default Leaflet marker icons in some bundlers
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [0, -34],
  tooltipAnchor: [0, -38],
  shadowSize: [41, 41]
});

// Create a distinct icon for search results (Red hue)
const SearchIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [0, -34],
  tooltipAnchor: [0, -38],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface LocationMarkerProps {
  point: LocationPoint;
}

export const LocationMarker: React.FC<LocationMarkerProps> = ({ point }) => {
  return (
    <Marker position={[point.lat, point.lng]}>
      {/* Modern Compact Tooltip - Positioned strictly above the marker */}
      <Tooltip
        permanent
        direction="top"
        offset={[0, -12]} /* Increased negative offset to push it higher above the pin */
        opacity={1}
        className="custom-tooltip"
      >
        <div dir="rtl" className="flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md px-2 py-1 rounded-lg shadow-xl border border-white/10 transform transition-all hover:scale-110 cursor-pointer group z-[1000]">
          <div className="font-bold text-[11px] text-white whitespace-nowrap max-w-[120px] truncate">{point.name}</div>
          <div className="text-[10px] font-medium text-emerald-400 mt-0.5 bg-emerald-950/30 px-1.5 rounded-full">{point.count.toLocaleString()}</div>
          {/* Little arrow indicator using border trick */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900/90 rotate-45 border-r border-b border-white/10"></div>
        </div>
      </Tooltip>

      {/* Modern Popup */}
      <Popup className="modern-popup">
        <div className="text-right min-w-[160px] p-1 font-sans" dir="rtl">
          <h3 className="font-bold text-lg text-slate-800 mb-1 leading-tight">{point.name}</h3>
          {point.district && (
            <p className="text-xs text-slate-500 mb-3 pb-2 border-b border-slate-100 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-500" />
              {point.district}
            </p>
          )}
          <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
            <span className="text-xs text-slate-500">عدد الناخبين</span>
            <span className="font-bold text-emerald-600 text-base">{point.count.toLocaleString()}</span>
          </div>
        </div>
      </Popup>
    </Marker>
  );
};

interface MapClickProps {
  onMapClick: (lat: number, lng: number) => void;
}

export const MapClickHandler: React.FC<MapClickProps> = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

export const MapInvalidator: React.FC<{ trigger?: any }> = ({ trigger }) => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [map, trigger]);
  return null;
};

export const BaseMapLayer: React.FC = () => {
  return (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      className="map-tiles"
    />
  );
};

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type: string;
  boundingbox: string[];
}

interface SearchResultState {
  lat: number;
  lng: number;
  bounds: L.LatLngBoundsExpression;
  name: string;
  place_id: number;
}

export const MapSearch: React.FC = () => {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResultState | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim().length >= 2) {
        fetchSuggestions(query);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
        setSearchResult(null); // Clear the pin when query is cleared
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Prevent map clicks when interacting with search
  useEffect(() => {
    if (searchRef.current) {
      L.DomEvent.disableClickPropagation(searchRef.current);
      L.DomEvent.disableScrollPropagation(searchRef.current);
    }
  }, []);

  const fetchSuggestions = async (searchQuery: string) => {
    setIsSearching(true);
    setShowSuggestions(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=iq&accept-language=ar&limit=5`
      );
      const data = await response.json();
      setSuggestions(data);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectLocation = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    const bounds: L.LatLngBoundsExpression = [
      [parseFloat(result.boundingbox[0]), parseFloat(result.boundingbox[2])],
      [parseFloat(result.boundingbox[1]), parseFloat(result.boundingbox[3])]
    ];

    setSearchResult({
      lat,
      lng,
      bounds,
      name: result.display_name.split(',')[0],
      place_id: result.place_id
    });

    map.flyToBounds(bounds, {
      padding: [50, 50],
      duration: 1.5
    });

    setQuery(result.display_name.split(',')[0]);
    setShowSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (suggestions.length > 0) {
      handleSelectLocation(suggestions[0]);
    }
  };

  const disablePropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchResult(null);
  };

  return (
    <>
      <div
        ref={searchRef}
        dir="rtl"
        className="absolute top-6 right-6 z-[1000] w-72 sm:w-96 font-sans pointer-events-auto"
        onClick={disablePropagation}
        onDoubleClick={disablePropagation}
      >
        <form onSubmit={handleSubmit} className="relative group">
          <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-md group-hover:bg-emerald-500/20 transition-all duration-300"></div>
          <input
            type="text"
            dir="rtl"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (suggestions.length > 0 || isSearching) setShowSuggestions(true); }}
            placeholder="ابحث عن منطقة..."
            className="w-full pl-20 pr-6 py-3.5 rounded-full border border-white/50 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] text-sm outline-none bg-white/90 backdrop-blur-xl transition-all text-right placeholder:text-slate-400 text-slate-700"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute left-12 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 p-1.5 rounded-full transition-colors active:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-emerald-500 text-white p-2 rounded-full hover:bg-emerald-600 transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </button>
        </form>

        {/* Suggestions Dropdown */}
        {showSuggestions && (suggestions.length > 0 || isSearching) && (
          <div className="absolute top-full left-0 w-full mt-3 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.15)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 border border-white/50 ring-1 ring-slate-900/5">
            {isSearching ? (
              <div className="px-4 py-4 text-center text-slate-500 flex items-center justify-center gap-2 text-sm" dir="rtl">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>جاري البحث...</span>
              </div>
            ) : (
              <ul className="max-h-64 overflow-y-auto custom-scrollbar">
                {suggestions.map((place) => (
                  <li
                    key={place.place_id}
                    onClick={() => handleSelectLocation(place)}
                    className="px-4 py-3 hover:bg-emerald-50/80 cursor-pointer border-b border-slate-50 last:border-0 transition-colors flex items-center gap-3 group"
                  >
                    <div className="bg-slate-100 p-2 rounded-full group-hover:bg-emerald-100/50 group-hover:text-emerald-600 transition-colors text-slate-400">
                      <Navigation className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-sm font-semibold text-slate-700 group-hover:text-emerald-900 line-clamp-1">
                        {place.display_name.split(',')[0]}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                        {place.display_name.split(',').slice(1).join(',')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Render Search Result Visualization */}
      {searchResult && (
        <Marker position={[searchResult.lat, searchResult.lng]} icon={SearchIcon}>
          <Tooltip
            permanent
            direction="top"
            offset={[0, -12]} /* Same offset for search result */
            opacity={1}
            className="custom-tooltip"
          >
            <div className="bg-red-500 text-white px-2 py-1 rounded-lg shadow-lg text-[10px] font-bold">
              {searchResult.name}
            </div>
          </Tooltip>
        </Marker>
      )}
    </>
  );
};