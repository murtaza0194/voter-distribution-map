import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker } from 'react-leaflet';
import {
    Plus,
    MapPin,
    Users,
    X,
    Trash2,
    Menu,
    Filter,
    ArrowUpDown,
    Check,
    CheckSquare,
    Square
} from 'lucide-react';
import { BaseMapLayer, LocationMarker, MapClickHandler, MapSearch, MapInvalidator } from './components/MapComponents';
import { LocationPoint } from './types';

const App: React.FC = () => {
    // Initialize state from LocalStorage
    const [points, setPoints] = useState<LocationPoint[]>(() => {
        try {
            const savedPoints = localStorage.getItem('populationMapPoints');
            return savedPoints ? JSON.parse(savedPoints) : [];
        } catch (error) {
            console.error('Error loading points from localStorage:', error);
            return [];
        }
    });

    const [tempPoint, setTempPoint] = useState<{ lat: number; lng: number } | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Form State
    const [name, setName] = useState('');
    const [district, setDistrict] = useState('');
    const [count, setCount] = useState<number | ''>('');

    // Filter State
    const [showFilters, setShowFilters] = useState(false);
    const [hiddenPointIds, setHiddenPointIds] = useState<string[]>([]);
    const filterRef = useRef<HTMLDivElement>(null);

    // Persist points to LocalStorage whenever they change
    useEffect(() => {
        localStorage.setItem('populationMapPoints', JSON.stringify(points));
    }, [points]);

    // Click outside to close filter dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setShowFilters(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMapClick = (lat: number, lng: number) => {
        setTempPoint({ lat, lng });
        if (window.innerWidth < 768) {
            setIsSidebarOpen(true);
        }
    };

    const handleAddPoint = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempPoint || !name || !district || count === '') return;

        const newPoint: LocationPoint = {
            id: crypto.randomUUID(),
            lat: tempPoint.lat,
            lng: tempPoint.lng,
            name,
            district,
            count: Number(count),
            createdAt: Date.now(),
        };

        setPoints(prev => [...prev, newPoint]);

        // Reset form
        setName('');
        setDistrict('');
        setCount('');
        setTempPoint(null);
    };

    const handleDeletePoint = (id: string) => {
        setPoints(prev => prev.filter(p => p.id !== id));
    };

    const cancelSelection = () => {
        setTempPoint(null);
        setName('');
        setDistrict('');
        setCount('');
    };

    // --- Filter Logic (Merged List) ---

    // Sort points alphabetically for the filter list
    const sortedPointsForFilter = useMemo(() => {
        return [...points].sort((a, b) => a.name.localeCompare(b.name));
    }, [points]);

    const togglePointVisibility = (id: string) => {
        setHiddenPointIds(prev =>
            prev.includes(id)
                ? prev.filter(hid => hid !== id)
                : [...prev, id]
        );
    };

    const toggleAllPoints = (show: boolean) => {
        if (show) {
            setHiddenPointIds([]);
        } else {
            setHiddenPointIds(points.map(p => p.id));
        }
    };

    // Apply filters
    const filteredPoints = points.filter(p => !hiddenPointIds.includes(p.id));

    // Default Center - Baghdad, Iraq
    const defaultCenter: [number, number] = [33.3152, 44.3661];

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 font-sans">
            {/* Modern Header - Adjusted button position */}
            <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 z-30 flex items-center px-6 py-4 gap-4 relative shadow-sm">
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all active:scale-95"
                >
                    <Menu className="w-6 h-6" />
                </button>

                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5 rounded-xl text-white shadow-emerald-500/20 shadow-lg">
                        <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">خريطة الناخبين</h1>
                        <p className="text-xs text-slate-500 font-medium hidden sm:block">نظام تفاعلي لتوزيع السكان</p>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex flex-1 relative overflow-hidden">

                {/* Sidebar */}
                <aside
                    className={`
                absolute md:relative z-[1000] h-full w-full md:w-[420px] bg-white shadow-[10px_0_30px_rgba(0,0,0,0.03)] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] border-l border-slate-100 flex flex-col
                ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:hidden'}
                md:translate-x-0
                ${!isSidebarOpen && 'md:!w-0 md:!border-0 md:!overflow-hidden'}
            `}
                >
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

                        {/* Input Form Section (Add New) */}
                        {tempPoint && (
                            <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5 mb-8 animate-in fade-in slide-in-from-right-4 duration-300 relative overflow-hidden ring-4 ring-emerald-50/50">
                                <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500"></div>
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="font-bold text-emerald-900 flex items-center gap-2.5 text-lg">
                                        <div className="bg-emerald-100 p-1.5 rounded-lg text-emerald-700">
                                            <Plus className="w-4 h-4" />
                                        </div>
                                        نقطة جديدة
                                    </h2>
                                    <button onClick={cancelSelection} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <form onSubmit={handleAddPoint} className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-emerald-800 mr-1">اسم المدرسة</label>
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="أدخل اسم المدرسة..."
                                            className="w-full px-4 py-2.5 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-emerald-800 mr-1">المنطقة</label>
                                        <input
                                            type="text"
                                            required
                                            value={district}
                                            onChange={(e) => setDistrict(e.target.value)}
                                            placeholder="أدخل اسم الحي أو المنطقة..."
                                            className="w-full px-4 py-2.5 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-emerald-800 mr-1">العدد</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            value={count}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setCount(val === '' ? '' : Number(val));
                                            }}
                                            placeholder="0"
                                            className="w-full px-4 py-2.5 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300 text-sm"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-500/30 flex justify-center items-center gap-2 active:scale-[0.98] mt-2"
                                    >
                                        <MapPin className="w-4 h-4" />
                                        حفظ الموقع
                                    </button>
                                </form>
                            </div>
                        )}

                        {!tempPoint && (
                            <div className="bg-blue-50/50 border border-blue-100 text-blue-800 p-4 rounded-2xl mb-8 text-sm flex items-center gap-3 shadow-sm">
                                <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                                    <MapPin className="w-4 h-4" />
                                </div>
                                <p className="font-medium">اضغط على الخريطة لإضافة مركز.</p>
                            </div>
                        )}

                        {/* Filters & List Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                                النقاط المسجلة
                                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                    {filteredPoints.length}
                                </span>
                            </h3>

                            <div className="relative" ref={filterRef}>
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`p-2 rounded-lg transition-all ${showFilters ? 'bg-slate-800 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                                >
                                    <Filter className="w-4 h-4" />
                                </button>

                                {/* Filter Dropdown */}
                                {showFilters && (
                                    <div className="absolute top-full left-0 z-50 mt-2 w-72 bg-white border border-slate-100 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[400px]">
                                        <div className="p-3 border-b border-slate-50 flex items-center justify-between bg-slate-50/50 rounded-t-xl">
                                            <span className="text-xs font-bold text-slate-600">تصفية القائمة</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => toggleAllPoints(true)} className="p-1 hover:bg-emerald-100 text-emerald-600 rounded">
                                                    <CheckSquare className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => toggleAllPoints(false)} className="p-1 hover:bg-red-100 text-red-600 rounded">
                                                    <Square className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                            {sortedPointsForFilter.length === 0 ? (
                                                <p className="text-xs text-slate-400 text-center py-4">فارغ</p>
                                            ) : (
                                                sortedPointsForFilter.map(point => {
                                                    const isVisible = !hiddenPointIds.includes(point.id);
                                                    return (
                                                        <div
                                                            key={point.id}
                                                            onClick={() => togglePointVisibility(point.id)}
                                                            className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors text-xs select-none border-b border-slate-50 last:border-0 ${isVisible ? 'hover:bg-slate-50' : 'opacity-60 grayscale bg-slate-50'}`}
                                                        >
                                                            <div className={`w-4 h-4 mt-1 shrink-0 rounded border flex items-center justify-center transition-colors ${isVisible ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300'}`}>
                                                                {isVisible && <Check className="w-3 h-3" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <span className="font-bold text-slate-700 truncate">{point.name}</span>
                                                                    <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                                                                        {point.count.toLocaleString()}
                                                                    </span>
                                                                </div>
                                                                <div className="text-slate-400 text-[10px] mt-0.5 flex items-center gap-1">
                                                                    <MapPin className="w-3 h-3" />
                                                                    <span className="truncate">{point.district || '—'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* List Items - Modern Cards */}
                        <div className="space-y-3 pb-8">
                            {points.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                                    <div className="bg-white p-4 rounded-full shadow-sm mb-3">
                                        <MapPin className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <p className="text-slate-400 font-medium">ابدأ بإضافة نقاط على الخريطة</p>
                                </div>
                            ) : filteredPoints.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <Filter className="w-6 h-6 mx-auto mb-2 opacity-30" />
                                    تم إخفاء جميع النقاط
                                </div>
                            ) : (
                                filteredPoints.map((point) => (
                                    <div
                                        key={point.id}
                                        className="group relative bg-white rounded-xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-slate-100 hover:border-emerald-100 transition-all duration-300 hover:-translate-y-1"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <div className="font-bold text-slate-800 text-sm mb-1 line-clamp-1">{point.name}</div>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-medium text-slate-500">
                                                        <MapPin className="w-3 h-3" />
                                                        {point.district || '—'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                                                    <span className="text-xs font-bold text-emerald-700">
                                                        {point.count.toLocaleString()} <span className="font-normal text-emerald-600/70">ناخب</span>
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeletePoint(point.id);
                                                }}
                                                className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 -ml-2"
                                                title="حذف"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {/* Left Accent Border */}
                                        <div className="absolute top-4 bottom-4 left-0 w-1 bg-emerald-500 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </aside>

                {/* Map Area */}
                <main className="flex-1 relative z-0 bg-slate-100">
                    <MapContainer
                        center={defaultCenter}
                        zoom={11}
                        scrollWheelZoom={true}
                        className="w-full h-full outline-none z-0"
                    >
                        <BaseMapLayer />
                        <MapInvalidator />
                        <MapClickHandler onMapClick={handleMapClick} />
                        <MapSearch />

                        {filteredPoints.map(point => (
                            <LocationMarker key={point.id} point={point} />
                        ))}

                        {tempPoint && (
                            <Marker position={[tempPoint.lat, tempPoint.lng]} opacity={0.6}></Marker>
                        )}
                    </MapContainer>

                    {/* Mobile Sidebar Toggle */}
                    {!isSidebarOpen && (
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="absolute bottom-6 right-6 z-[900] bg-slate-900 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform md:hidden"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                    )}
                </main>
            </div>
        </div>
    );
};

export default App;