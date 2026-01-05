import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Trash2, Users, Search } from 'lucide-react';
import { Voter } from '../types';

interface VoterManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    schoolName: string;
    voters: Voter[];
    onAddVoter: (fullName: string, phoneNumber: string) => void;
    onDeleteVoter: (voterId: string) => void;
}

export const VoterManagerModal: React.FC<VoterManagerModalProps> = ({
    isOpen,
    onClose,
    schoolName,
    voters,
    onAddVoter,
    onDeleteVoter
}) => {
    const [newVoterName, setNewVoterName] = useState('');
    const [newVoterPhone, setNewVoterPhone] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (newVoterName.trim()) {
            onAddVoter(newVoterName.trim(), newVoterPhone.trim());
            setNewVoterName('');
            setNewVoterPhone('');
            inputRef.current?.focus();
        }
    };

    const filteredVoters = voters.filter(v =>
        v.fullName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1100] transition-opacity"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-[1110] flex items-center justify-center p-4 sm:p-6 pointer-events-none"
                    >
                        <div
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col pointer-events-auto overflow-hidden ring-1 ring-slate-900/5"
                            dir="rtl"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white relative z-10">
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                        <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        سجل الناخبين
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1 font-medium pr-1">
                                        {schoolName} • <span className="text-emerald-600 font-bold">{voters.length}</span> ناخب مسجل
                                    </p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Search & List Area */}
                            <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/50">
                                {/* Search Bar (Only show if there are voters) */}
                                {voters.length > 5 && (
                                    <div className="px-6 pt-4 pb-2">
                                        <div className="relative">
                                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                            <input
                                                type="text"
                                                placeholder="بحث عن اسم..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full pl-4 pr-10 py-2.5 rounded-xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500/20 bg-white text-sm"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Voters List */}
                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-2">
                                    {voters.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 min-h-[200px]">
                                            <Users className="w-12 h-12 mb-3 stroke-1" />
                                            <p className="font-medium">لا يوجد ناخبين مسجلين بعد</p>
                                        </div>
                                    ) : filteredVoters.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400">
                                            لا توجد نتائج للبحث
                                        </div>
                                    ) : (
                                        filteredVoters.map((voter) => (
                                            <motion.div
                                                layout
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                key={voter.id}
                                                className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-emerald-200 transition-colors shadow-sm"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                                                        {voter.fullName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-700">{voter.fullName}</div>
                                                        {voter.phoneNumber && (
                                                            <div className="text-xs text-slate-400 font-mono mt-0.5">{voter.phoneNumber}</div>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => onDeleteVoter(voter.id)}
                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                    title="حذف"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Footer - Add Form */}
                            <div className="p-4 bg-white border-t border-slate-100 z-10">
                                <form onSubmit={handleAdd} className="flex gap-3">
                                    <div className="flex-1 flex gap-2">
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={newVoterName}
                                            onChange={(e) => setNewVoterName(e.target.value)}
                                            placeholder="أدخل اسم الناخب..."
                                            className="flex-1 px-4 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all text-slate-700 font-medium"
                                        />
                                        <input
                                            type="text"
                                            value={newVoterPhone}
                                            onChange={(e) => setNewVoterPhone(e.target.value)}
                                            placeholder="رقم الهاتف..."
                                            className="w-1/3 px-4 py-3 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all text-slate-700 font-medium font-mono text-right"
                                            dir="ltr"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!newVoterName.trim()}
                                        className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 whitespace-nowrap"
                                    >
                                        <UserPlus className="w-5 h-5" />
                                        <span>إضافة</span>
                                    </button>
                                </form>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
