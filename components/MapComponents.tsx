import React, { useState, useEffect, useRef } from 'react';
import { useMapEvents, useMap, Marker, Popup, TileLayer, Tooltip, LayersControl } from 'react-leaflet';
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
    <LayersControl position="topright">
      <LayersControl.BaseLayer checked name="OpenStreetMap">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles"
        />
      </LayersControl.BaseLayer>

      <LayersControl.BaseLayer name="Google Streets">
        <TileLayer
          url="http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          attribution='&copy; Google Maps'
        />
      </LayersControl.BaseLayer>

      <LayersControl.BaseLayer name="Google Satellite (Hybrid)">
        <TileLayer
          url="http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          attribution='&copy; Google Maps'
        />
      </LayersControl.BaseLayer>
    </LayersControl>
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
  display_name: string;
}

export const MapSearch: React.FC = () => {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultState[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim().length >= 2) {
        fetchSuggestions(query);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
        // We don't clear searchResults here to keep them on map even if user clears input, 
        // until they explicitly start a new search or clear.
        // But if they clear the input, maybe they want to clear? 
        // Let's keep the results for now as it solves "showing multiple results".
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
    try {
      const viewbox = "44.14,33.46,44.57,33.19";

      const fetchWithParams = async (q: string, bounded: number) => {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=iq&accept-language=ar&limit=50&viewbox=${viewbox}&bounded=${bounded}`;
        const res = await fetch(url);
        return await res.json();
      };

      const searchOverpass = async (q: string) => {
        try {
          // Arabic Orthographic Normalization
          // Converts specific characters to regex groups to match variations
          // Alif variants: ا, أ, إ, آ -> [اأإآ]
          // Teh Marbuta/Ha: ة, ه -> [ةه]
          // Yeh/Alif Maqsura: ي, ى -> [يى]
          const normalizeArabic = (text: string) => {
            return text
              .replace(/[اأإآ]/g, "[اأإآ]")
              .replace(/[ةه]/g, "[ةه]")
              .replace(/[يى]/g, "[يى]");
          };

          const normalizedQ = normalizeArabic(q);

          // "Deep Search" Implementation
          // 1. Expanded BBox for Greater Baghdad (Outskirts included)
          //    South: 33.10, West: 44.00, North: 33.55, East: 44.70
          const bbox = "33.10,44.00,33.55,44.70";

          // 2. Multilingual Regex Query using Normalized Arabic
          //    nwr[~"^name(:.*)?|alt_name$"~"${normalizedQ}",i](${bbox});
          //    Matches any name key or alt_name with the flexible regex pattern
          const query = `
                    [out:json][timeout:25];
                    (
                      nwr[~"^name(:.*)?|alt_name$"~"${normalizedQ}",i](${bbox});
                    );
                    out center;
                `;
          const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
          const res = await fetch(url);
          const data = await res.json();

          // Map Overpass results to Nominatim-like structure
          return data.elements.map((el: any) => ({
            place_id: el.id,
            lat: el.lat || el.center?.lat,
            lon: el.lon || el.center?.lon,
            display_name: el.tags?.name || el.tags?.['name:ar'] || el.tags?.['name:en'] || 'Unknown Location',
            boundingbox: [
              (el.lat || el.center?.lat) - 0.001,
              (el.lat || el.center?.lat) + 0.001,
              (el.lon || el.center?.lon) - 0.001,
              (el.lon || el.center?.lon) + 0.001
            ]
          })).filter((el: any) => el.lat && el.lon);
        } catch (err) {
          console.error("Overpass API Error:", err);
          return [];
        }
      };

      // Strategy 1: Strict Search (Nominatim)
      let data = await fetchWithParams(searchQuery, 1);

      // Strategy 2: Overpass API (Fuzzy Name Search in Baghdad)
      // If strict Nominatim fails, try scanning OSM directly which is much more powerful for partial matches
      if (data.length === 0) {
        console.log("Strict search failed, trying Overpass API...");
        data = await searchOverpass(searchQuery);
      }

      // Strategy 3: Relaxed Search (Nominatim Bounded=0)
      // Only if Overpass also fails (e.g. timeout or no results)
      if (data.length === 0) {
        data = await fetchWithParams(searchQuery, 0);
      }

      // Strategy 4: Smart Tokenizer / Heuristics
      // Strip common "noise" words to find the core name
      if (data.length === 0) {
        // List of words to ignore (School types, genders, distinct attributes)
        const stopWords = [
          "school", "high", "secondary", "prep", "preparatory", "primary", "elementary", "kindergarten",
          "girls", "boys", "mixed", "vocational", "commercial", "industrial", "institute",
          "مدرسة", "ثانوية", "اعدادية", "متوسطة", "ابتدائية", "روضة", "معهد",
          "للبنات", "للبنين", "بنات", "بنين", "مختلطة",
          "المهنية", "الصناعية", "التجارية", "الفنون", "للدراسات", "الأهلية", "الحكومية"
        ];

        // Create a regex to remove these words (case insensitive, global)
        const regex = new RegExp(stopWords.join("|"), "gi");

        // Remove stop words and clean up extra spaces
        const coreName = searchQuery.replace(regex, "").replace(/\s+/g, " ").trim();

        if (coreName && coreName.length >= 3 && coreName !== searchQuery) { // standard check to avoid tiny tokens
          console.log(`Smart Tokenizer: Reduced '${searchQuery}' to '${coreName}'`);
          data = await searchOverpass(coreName);
          if (data.length === 0) data = await fetchWithParams(coreName, 0);
        }
      }

      // Strategy 5: Add "مدرسة" prefix if missing (Last resort for simple names)
      if (data.length === 0) {
        if (!searchQuery.includes("مدرسة") && !searchQuery.includes("school")) {
          const enriched = `مدرسة ${searchQuery}`;
          data = await fetchWithParams(enriched, 1);
        }
      }

      setSuggestions(data);
      setShowSuggestions(true);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const mapNominatimResult = (result: NominatimResult): SearchResultState => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const bounds: L.LatLngBoundsExpression = [
      [parseFloat(result.boundingbox[0]), parseFloat(result.boundingbox[2])],
      [parseFloat(result.boundingbox[1]), parseFloat(result.boundingbox[3])]
    ];
    return {
      lat,
      lng,
      bounds,
      name: result.display_name.split(',')[0],
      place_id: result.place_id,
      display_name: result.display_name
    };
  };

  const handleSelectLocation = (result: NominatimResult) => {
    const mapped = mapNominatimResult(result);
    setSearchResults([mapped]); // Only one result if picked specifically

    map.flyToBounds(mapped.bounds, {
      padding: [50, 50],
      duration: 1.5
    });

    setQuery(mapped.name);
    setShowSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (suggestions.length > 0) {
      // Show ALL suggestions on map
      const allResults = suggestions.map(mapNominatimResult);
      setSearchResults(allResults);
      setShowSuggestions(false);

      // Calculate bounds for all
      if (allResults.length > 0) {
        const group = L.featureGroup(allResults.map(r => L.marker([r.lat, r.lng])));
        map.flyToBounds(group.getBounds(), { padding: [50, 50], duration: 1.5 });
      }
    } else {
      // Fallback: If no suggestions in state (maybe typed fast and hit enter?), force fetch
      // (This part is a bit tricky with async, but let's rely on the effect for now or trigger manual fetch)
      // Ideally we should just rely on the effect having fired.
    }
  };

  const disablePropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchResults([]);
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

      {/* Render Search Results Visualization */}
      {searchResults.map((result) => (
        <Marker key={result.place_id} position={[result.lat, result.lng]} icon={SearchIcon}>
          <Tooltip
            permanent={searchResults.length < 5} // Only show permanent tooltips if few results to avoid clutter
            direction="top"
            offset={[0, -12]}
            opacity={1}
            className="custom-tooltip"
          >
            <div className="bg-red-500 text-white px-2 py-1 rounded-lg shadow-lg text-[10px] font-bold z-[1000]">
              {result.name}
            </div>
          </Tooltip>
          <Popup className="modern-popup">
            <div className="text-right min-w-[160px] p-1 font-sans" dir="rtl">
              <h3 className="font-bold text-lg text-slate-800 mb-1 leading-tight">{result.name}</h3>
              <p className="text-xs text-slate-500 mb-3 pb-2 border-b border-slate-100 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-red-500" />
                {result.display_name}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
};