import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';
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
import { VoterManagerModal } from './components/VoterManagerModal';
import { LocationPoint, Voter } from './types';

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
    const [selectedDistrict, setSelectedDistrict] = useState<string>('');
    const filterRef = useRef<HTMLDivElement>(null);

    // Voter Management State
    const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);

    const selectedSchool = useMemo(() =>
        points.find(p => p.id === selectedSchoolId),
        [points, selectedSchoolId]);

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

    // --- Voter Management Handlers ---

    const handleAddVoter = (fullName: string, phoneNumber: string) => {
        if (!selectedSchoolId) return;

        const newVoter: Voter = {
            id: crypto.randomUUID(),
            fullName,
            phoneNumber,
            createdAt: Date.now()
        };

        setPoints(prev => prev.map(p => {
            if (p.id === selectedSchoolId) {
                const updatedVoters = p.voters ? [...p.voters, newVoter] : [newVoter];
                // Update the count to reflect actual voters if we want, or keep manual count?
                // The user request said "add unlimited number of person names", implies managing a list.
                // Let's NOT auto-update the main "count" field yet as that might be "expected capacity" or similar.
                // Or maybe it should sync? The prompt said "add names of voters in this center ONLY".
                // Usually "count" in these maps is "Total Voters". 
                // Let's auto-increment the count when adding a voter if it was manual before?
                // Actually, let's just add the voter to the list for now. 
                // Wait, if I add a voter, the count should probably reflect the list size if the list is the source of truth.
                // But initially the user adds a number manually. 
                // Let's just track the list side-by-side for now to be safe, or maybe the count IS the list length?
                // Users might want to just set a number without adding names.
                // Let's keep `count` independent for now unless user asks to sync.
                return { ...p, voters: updatedVoters };
            }
            return p;
        }));
    };

    const handleDeleteVoter = (voterId: string) => {
        if (!selectedSchoolId) return;

        setPoints(prev => prev.map(p => {
            if (p.id === selectedSchoolId) {
                return {
                    ...p,
                    voters: p.voters?.filter(v => v.id !== voterId) || []
                };
            }
            return p;
        }));
    };

    // --- Filter Logic (Merged List) ---

    // Extract unique districts from points
    const uniqueDistricts = useMemo(() => {
        const districts = points.map(p => p.district).filter((d): d is string => d !== undefined && d.trim() !== '');
        return Array.from(new Set<string>(districts)).sort((a, b) => a.localeCompare(b));
    }, [points]);

    // Filter points by selected district first
    const districtFilteredPoints = useMemo(() => {
        if (!selectedDistrict) return points;
        return points.filter(p => p.district === selectedDistrict);
    }, [points, selectedDistrict]);

    // Sort points alphabetically for the filter list (based on district filter)
    const sortedPointsForFilter = useMemo(() => {
        return [...districtFilteredPoints].sort((a, b) => a.name.localeCompare(b.name));
    }, [districtFilteredPoints]);

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

    // Apply filters (district + hidden)
    const filteredPoints = districtFilteredPoints.filter(p => !hiddenPointIds.includes(p.id));

    // Default Center - Baghdad, Iraq
    const defaultCenter: [number, number] = [33.3152, 44.3661];

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
            {/* Modern Header - Glassmorphism & Gradient */}
            <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 z-30 flex items-center px-6 py-4 gap-4 relative shadow-sm transition-all duration-300">
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-3 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50/80 rounded-2xl transition-colors shadow-sm hover:shadow"
                >
                    <Menu className="w-6 h-6" />
                </motion.button>

                <div className="flex items-center gap-4">
                    <div className="bg-gradient-to-tr from-emerald-500 to-teal-500 p-3 rounded-2xl text-white shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/20">
                        <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">خريطة الناخبين</h1>
                        <p className="text-xs text-slate-400 font-semibold mt-1 tracking-wide">نظام التوزيع السكاني التفاعلي</p>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex flex-1 relative overflow-hidden">

                {/* Sidebar */}
                <motion.aside
                    initial={false}
                    animate={{
                        x: isSidebarOpen ? 0 : '100%',
                        width: isSidebarOpen ? (window.innerWidth < 768 ? '100%' : '450px') : '0px'
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className={`
                        absolute md:relative z-[1000] h-full bg-white/95 backdrop-blur-md shadow-[20px_0_40px_rgba(0,0,0,0.03)] border-l border-slate-100 flex flex-col overflow-hidden
                        ${!isSidebarOpen && 'pointer-events-none md:!w-0 md:!border-0'}
                    `}
                    style={{ right: 0 }} // Ensure it slides from right
                >
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 w-full md:w-[450px]">

                        {/* Input Form Section (Add New) */}
                        <AnimatePresence>
                            {tempPoint && (
                                <motion.div
                                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                                    className="bg-white border border-emerald-100 rounded-3xl p-6 shadow-xl shadow-emerald-900/5 relative overflow-hidden group"
                                >
                                    <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-emerald-400 to-teal-500"></div>
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="font-extrabold text-slate-800 flex items-center gap-3 text-xl">
                                            <div className="bg-emerald-100/50 p-2 rounded-xl text-emerald-600">
                                                <Plus className="w-5 h-5" />
                                            </div>
                                            نقطة جديدة
                                        </h2>
                                        <motion.button
                                            whileHover={{ rotate: 90 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={cancelSelection}
                                            className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-full transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </motion.button>
                                    </div>
                                    <form onSubmit={handleAddPoint} className="space-y-5">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 mr-1 uppercase tracking-wider">اسم المدرسة</label>
                                            <input
                                                type="text"
                                                required
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="أدخل اسم المدرسة..."
                                                className="w-full px-5 py-3.5 bg-slate-50 border-0 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white text-slate-700 font-medium transition-all placeholder:text-slate-300 text-sm shadow-inner"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 mr-1 uppercase tracking-wider">المنطقة</label>
                                            <input
                                                type="text"
                                                required
                                                value={district}
                                                onChange={(e) => setDistrict(e.target.value)}
                                                placeholder="أدخل اسم الحي أو المنطقة..."
                                                className="w-full px-5 py-3.5 bg-slate-50 border-0 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white text-slate-700 font-medium transition-all placeholder:text-slate-300 text-sm shadow-inner"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 mr-1 uppercase tracking-wider">عدد الناخبين</label>
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
                                                className="w-full px-5 py-3.5 bg-slate-50 border-0 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white text-slate-700 font-medium transition-all placeholder:text-slate-300 text-sm shadow-inner"
                                            />
                                        </div>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            type="submit"
                                            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 flex justify-center items-center gap-3 mt-4 tracking-wide text-sm"
                                        >
                                            <MapPin className="w-5 h-5" />
                                            حفظ الموقع
                                        </motion.button>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {!tempPoint && (
                            <motion.button
                                layout
                                onClick={() => setIsSidebarOpen(false)}
                                whileHover={{ scale: 1.02, backgroundColor: "rgba(236, 253, 245, 0.4)" }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full bg-slate-50 border border-slate-200 border-dashed hover:border-emerald-300 text-slate-600 p-5 rounded-3xl mb-4 text-sm flex items-center gap-4 transition-colors group text-right"
                            >
                                <div className="bg-white p-3 rounded-2xl text-emerald-500 shadow-sm ring-1 ring-slate-100 group-hover:scale-110 transition-transform">
                                    <MapPin className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-slate-800 text-base mb-1 group-hover:text-emerald-800 transition-colors">إضافة موقع جديد</p>
                                    <p className="text-xs text-slate-400 group-hover:text-emerald-600/70">اضغط على الخريطة لتحديد الموقع</p>
                                </div>
                            </motion.button>
                        )}

                        {/* Filters & List Header */}
                        <div className="flex items-end justify-between px-1">
                            <div>
                                <h3 className="font-black text-slate-800 text-xl tracking-tight">القائمة</h3>
                                <p className="text-xs font-semibold text-slate-400 mt-1">
                                    إجمالي المواقع: <span className="text-emerald-600">{filteredPoints.length}</span>
                                </p>
                                <p className="text-xs font-semibold text-slate-400 mt-0.5">
                                    إجمالي الناخبين: <span className="text-emerald-600">{filteredPoints.reduce((sum, p) => sum + p.count, 0).toLocaleString()}</span>
                                </p>
                            </div>

                            <div className="relative" ref={filterRef}>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`p-2.5 rounded-xl transition-colors ${showFilters ? 'bg-slate-800 text-white shadow-xl ring-2 ring-slate-700' : 'bg-white text-slate-400 border border-slate-200 hover:border-emerald-400 hover:text-emerald-600 shadow-sm'}`}
                                >
                                    <Filter className="w-5 h-5" />
                                </motion.button>

                                {/* Filter Dropdown */}
                                <AnimatePresence>
                                    {showFilters && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                            className="absolute top-full left-0 z-50 mt-3 w-80 bg-white/95 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.12)] flex flex-col max-h-[500px] ring-1 ring-black/5"
                                        >
                                            <div className="p-5 border-b border-slate-100">
                                                <div className="flex items-center justify-between mb-4">
                                                    <span className="text-sm font-bold text-slate-800">تصفية النتائج</span>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => toggleAllPoints(true)} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors">
                                                            <CheckSquare className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => toggleAllPoints(false)} className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors">
                                                            <Square className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {/* District Filter Dropdown */}
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">المنطقة</label>
                                                    <select
                                                        value={selectedDistrict}
                                                        onChange={(e) => setSelectedDistrict(e.target.value)}
                                                        className="w-full px-4 py-2.5 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white text-slate-700 font-medium transition-all text-sm shadow-inner cursor-pointer"
                                                    >
                                                        <option value="">جميع المناطق</option>
                                                        {uniqueDistricts.map(d => (
                                                            <option key={d} value={d}>{d}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="overflow-y-auto p-3 space-y-1 custom-scrollbar">
                                                {sortedPointsForFilter.length === 0 ? (
                                                    <p className="text-sm text-slate-400 text-center py-8">لا توجد نتائج</p>
                                                ) : (
                                                    sortedPointsForFilter.map(point => {
                                                        const isVisible = !hiddenPointIds.includes(point.id);
                                                        return (
                                                            <div
                                                                key={point.id}
                                                                onClick={() => togglePointVisibility(point.id)}
                                                                className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all duration-200 border border-transparent ${isVisible ? 'hover:bg-slate-50' : 'opacity-50 grayscale bg-slate-50/50'}`}
                                                            >
                                                                <div className={`w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${isVisible ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300'}`}>
                                                                    {isVisible && <Check className="w-3.5 h-3.5" />}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex justify-between items-center gap-2">
                                                                        <span className="font-bold text-slate-700 text-sm truncate">{point.name}</span>
                                                                        <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg text-[10px] whitespace-nowrap">
                                                                            {point.count.toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-slate-400 text-[11px] mt-0.5 flex items-center gap-1.5">
                                                                        <MapPin className="w-3 h-3" />
                                                                        <span className="truncate">{point.district || '—'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* List Items - Premium Cards */}
                        <motion.div layout className="space-y-4 pb-12">
                            <AnimatePresence mode='popLayout'>
                                {points.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/30"
                                    >
                                        <div className="bg-white p-6 rounded-full shadow-lg shadow-slate-200 mb-5">
                                            <MapPin className="w-10 h-10 text-slate-300" />
                                        </div>
                                        <h3 className="font-bold text-slate-700 text-lg mb-1">القائمة فارغة</h3>
                                        <p className="text-slate-400 font-medium text-sm">ابدأ بإضافة مواقع على الخريطة</p>
                                    </motion.div>
                                ) : filteredPoints.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-center py-16 text-slate-400 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200"
                                    >
                                        <Filter className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                        تم إخفاء جميع النقاط من العرض
                                    </motion.div>
                                ) : (
                                    filteredPoints.map((point) => (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
                                            key={point.id}
                                            onClick={() => setSelectedSchoolId(point.id)}
                                            className="group relative bg-white rounded-3xl p-5 shadow-sm hover:shadow-xl hover:shadow-emerald-900/5 border border-slate-100/80 hover:border-emerald-500/30 transition-all cursor-pointer hover:scale-[1.02]"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 min-w-0 pl-4">
                                                    <div className="font-black text-slate-800 text-lg mb-2 line-clamp-1">{point.name}</div>
                                                    <div className="flex flex-wrap items-center gap-3 mb-4">
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                                                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                                            {point.district || '—'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                                                        <span className="text-2xl font-black text-slate-900 tracking-tight">
                                                            {point.count.toLocaleString()}
                                                        </span>
                                                        <span className="font-medium text-slate-400 text-xs self-end mb-1.5">ناخب</span>
                                                    </div>
                                                </div>

                                                <motion.button
                                                    whileHover={{ scale: 1.1, backgroundColor: "#f43f5e", color: "white" }}
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeletePoint(point.id);
                                                    }}
                                                    className="text-slate-300 p-3 rounded-2xl opacity-0 group-hover:opacity-100 scale-90 transition-all shadow-sm"
                                                    title="حذف"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </motion.button>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </div>
                </motion.aside>

                {/* Map Area */}
                <main className="flex-1 relative z-0 bg-slate-200/50">
                    <MapContainer
                        center={defaultCenter}
                        zoom={11}
                        scrollWheelZoom={true}
                        className="w-full h-full outline-none z-0"
                    >
                        <BaseMapLayer />
                        <MapInvalidator trigger={isSidebarOpen} />
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
                        <motion.button
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setIsSidebarOpen(true)}
                            className="absolute bottom-8 right-8 z-[900] bg-slate-900 text-white p-5 rounded-full shadow-2xl md:hidden ring-4 ring-white/20"
                        >
                            <Menu className="w-6 h-6" />
                        </motion.button>
                    )}
                </main>
            </div>

            {/* Voter Manager Modal */}
            <VoterManagerModal
                isOpen={!!selectedSchoolId}
                onClose={() => setSelectedSchoolId(null)}
                schoolName={selectedSchool?.name || ''}
                voters={selectedSchool?.voters || []}
                onAddVoter={handleAddVoter}
                onDeleteVoter={handleDeleteVoter}
            />
        </div>
    );
};

export default App;