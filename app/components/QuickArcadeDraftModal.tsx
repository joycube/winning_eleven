"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MasterTeam, FALLBACK_IMG } from '../types';
import { Terminal, Users, Zap, X, Copy, CheckCircle2, Search } from 'lucide-react';

interface QuickArcadeDraftModalProps {
    onClose: () => void;
    masterTeams: MasterTeam[];
    owners?: any[]; // 🚨 오너 데이터 프롭 추가
}

export const QuickArcadeDraftModal = ({ onClose, masterTeams = [], owners = [] }: QuickArcadeDraftModalProps) => {
    const [step, setStep] = useState<'SETUP' | 'HACKING' | 'RESULT'>('SETUP');
    const [players, setPlayers] = useState<string[]>(['PLAYER 1', 'PLAYER 2']);
    
    // 🚨 유저 검색 관련 상태
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [teamsPerPlayer, setTeamsPerPlayer] = useState(2);
    const [filterTiers, setFilterTiers] = useState<string[]>(['S', 'A', 'B', 'C']);
    
    const [draftResults, setDraftResults] = useState<{ player: string, teams: MasterTeam[] }[]>([]);
    const [copied, setCopied] = useState(false);

    // 필터링된 팀 수 계산 (안전한 배열 접근)
    const availableTeams = masterTeams.filter(t => filterTiers.includes(t.tier));
    const totalNeeded = players.length * teamsPerPlayer;

    // 🚨 유저 검색 필터링 로직
    const filteredOwners = owners.filter(o => 
        o.nickname?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        o.legacyName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAddPlayer = (name?: string) => {
        const playerName = (name || searchQuery).trim().toUpperCase();
        if (playerName && !players.includes(playerName)) {
            setPlayers([...players, playerName]);
            setSearchQuery('');
            setShowDropdown(false);
        }
    };

    const handleRemovePlayer = (p: string) => setPlayers(players.filter(x => x !== p));

    const toggleTier = (tier: string) => {
        if (filterTiers.includes(tier)) setFilterTiers(filterTiers.filter(t => t !== tier));
        else setFilterTiers([...filterTiers, tier]);
    };

    const handleStartHack = () => {
        if (availableTeams.length < totalNeeded) return alert("SYSTEM ERROR: NOT ENOUGH TEAMS IN POOL.");
        
        setStep('HACKING');
        
        // Fisher-Yates Shuffle
        const shuffled = [...availableTeams].sort(() => Math.random() - 0.5);
        const results: { player: string, teams: MasterTeam[] }[] = [];
        let index = 0;

        for (const player of players) {
            const assigned: MasterTeam[] = [];
            for (let i = 0; i < teamsPerPlayer; i++) {
                assigned.push(shuffled[index]);
                index++;
            }
            results.push({ player, teams: assigned });
        }

        setTimeout(() => {
            setDraftResults(results);
            setStep('RESULT');
        }, 2500); 
    };

    const handleCopyResult = () => {
        const text = draftResults.map(r => `[${r.player}]\n${r.teams.map(t => `- ${t.name} (${t.tier})`).join('\n')}`).join('\n\n');
        navigator.clipboard.writeText(`⚡ ARCADE DRAFT RESULT ⚡\n\n${text}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // 드롭다운 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md overflow-hidden font-mono">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="w-full max-w-2xl bg-black border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(0,255,255,0.2)] relative z-10 flex flex-col max-h-[90vh]"
            >
                <div className="bg-cyan-950/40 border-b border-cyan-500/50 p-4 flex justify-between items-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-[shimmer_2s_infinite]"></div>
                    <h2 className="text-cyan-400 font-black tracking-[0.2em] flex items-center gap-2 text-lg">
                        <Terminal size={20} /> ARCADE_DRAFT.EXE
                    </h2>
                    <button onClick={onClose} className="text-cyan-500 hover:text-pink-500 hover:scale-110 transition-all"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar text-cyan-50">
                    <AnimatePresence mode="wait">
                        {step === 'SETUP' && (
                            <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                                
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-pink-500 font-bold border-b border-pink-500/30 pb-2">
                                        <Users size={16} /> 1. SET PLAYERS
                                    </div>
                                    <div className="flex gap-2 relative" ref={dropdownRef}>
                                        <div className="relative flex-1">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Search size={16} className="text-cyan-600" />
                                            </div>
                                            <input 
                                                value={searchQuery} 
                                                onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }} 
                                                onFocus={() => setShowDropdown(true)}
                                                onKeyDown={e => {if(e.key==='Enter') handleAddPlayer();}} 
                                                placeholder="SEARCH USER OR TYPE NAME..." 
                                                className="w-full bg-black border border-cyan-800 text-cyan-300 pl-10 pr-3 py-2 outline-none focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(0,255,255,0.3)] uppercase" 
                                            />
                                            {/* 🚨 자동완성 드롭다운 영역 */}
                                            {showDropdown && searchQuery && filteredOwners.length > 0 && (
                                                <div className="absolute top-full left-0 w-full mt-1 bg-black border border-cyan-500/50 shadow-[0_4px_20px_rgba(0,255,255,0.2)] z-50 max-h-40 overflow-y-auto custom-scrollbar">
                                                    {filteredOwners.map(o => (
                                                        <div 
                                                            key={o.uid || o.docId} 
                                                            onClick={() => handleAddPlayer(o.nickname)}
                                                            className="px-4 py-2.5 hover:bg-cyan-900/60 cursor-pointer text-cyan-400 text-sm border-b border-cyan-900/50 last:border-0 flex justify-between items-center transition-colors"
                                                        >
                                                            <span className="font-bold">{o.nickname}</span>
                                                            <span className="text-[10px] bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded-sm">USER</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => handleAddPlayer()} className="bg-cyan-900/50 border border-cyan-500 text-cyan-400 px-4 py-2 font-bold hover:bg-cyan-500 hover:text-black transition-colors">ADD</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {players.map(p => (
                                            <div key={p} className="bg-black border border-pink-500/50 text-pink-300 px-3 py-1 flex items-center gap-2 text-sm shadow-[0_0_10px_rgba(255,0,60,0.2)]">
                                                {p} <button onClick={() => handleRemovePlayer(p)} className="hover:text-white"><X size={14}/></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <div className="text-cyan-500 font-bold border-b border-cyan-500/30 pb-2">2. TEAMS PER PLAYER</div>
                                        <div className="flex items-center justify-between bg-black border border-cyan-800 p-2">
                                            <button onClick={()=>setTeamsPerPlayer(Math.max(1, teamsPerPlayer-1))} className="w-10 h-10 bg-cyan-950 text-cyan-400 hover:bg-cyan-500 hover:text-black font-black text-xl">-</button>
                                            <span className="text-3xl font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">{teamsPerPlayer}</span>
                                            <button onClick={()=>setTeamsPerPlayer(Math.min(5, teamsPerPlayer+1))} className="w-10 h-10 bg-cyan-950 text-cyan-400 hover:bg-cyan-500 hover:text-black font-black text-xl">+</button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="text-cyan-500 font-bold border-b border-cyan-500/30 pb-2">3. TIER FILTER</div>
                                        <div className="flex flex-wrap gap-2">
                                            {['S', 'A', 'B', 'C', 'D'].map(t => (
                                                <button key={t} onClick={() => toggleTier(t)} className={`w-10 h-10 flex items-center justify-center font-black border transition-all ${filterTiers.includes(t) ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_15px_rgba(0,255,255,0.6)]' : 'bg-black text-cyan-800 border-cyan-900 hover:border-cyan-500'}`}>
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-cyan-900 flex justify-between items-end">
                                    <div className="text-xs text-cyan-600">
                                        POOL: <span className="text-cyan-300">{availableTeams.length}</span> / NEED: <span className={availableTeams.length < totalNeeded ? 'text-pink-500' : 'text-cyan-300'}>{totalNeeded}</span>
                                    </div>
                                    <button 
                                        onClick={handleStartHack}
                                        disabled={availableTeams.length < totalNeeded || players.length === 0}
                                        className="bg-pink-600 hover:bg-pink-500 text-white font-black text-xl px-8 py-4 border border-pink-400 shadow-[0_0_20px_rgba(255,0,100,0.6)] disabled:opacity-50 disabled:grayscale tracking-widest flex items-center gap-2 transition-transform active:scale-95"
                                    >
                                        <Zap size={24} /> EXECUTE DRAFT
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {step === 'HACKING' && (
                            <motion.div key="hacking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-64 flex flex-col items-center justify-center gap-4">
                                <div className="text-pink-500 text-6xl animate-pulse drop-shadow-[0_0_20px_rgba(255,0,100,1)]">⚡</div>
                                <div className="text-2xl font-black text-cyan-400 tracking-[0.3em] animate-[bounce_0.5s_infinite]">HACKING DB...</div>
                                <div className="text-xs text-cyan-700 font-mono flex flex-col items-center">
                                    <span className="animate-[ping_0.2s_infinite]">BYPASSING FIREWALL...</span>
                                    <span className="animate-[ping_0.3s_infinite]">INJECTING RANDOM SEED...</span>
                                </div>
                            </motion.div>
                        )}

                        {step === 'RESULT' && (
                            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-6">
                                <div className="flex justify-between items-center border-b border-cyan-500/30 pb-4">
                                    <h3 className="text-2xl font-black text-cyan-400 drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]">SUCCESSFUL</h3>
                                    <button onClick={handleCopyResult} className="flex items-center gap-2 bg-cyan-950/50 border border-cyan-500 text-cyan-300 px-3 py-1.5 hover:bg-cyan-500 hover:text-black transition-colors text-xs font-bold">
                                        {copied ? <CheckCircle2 size={16}/> : <Copy size={16}/>} {copied ? 'COPIED!' : 'COPY DATA'}
                                    </button>
                                </div>
                                
                                <div className="space-y-6">
                                    {draftResults.map((res, i) => (
                                        <div key={i} className="bg-black border border-cyan-900 p-4 relative overflow-hidden group hover:border-cyan-500 transition-colors">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-pink-500"></div>
                                            <div className="text-pink-400 font-black text-lg mb-3 pl-3 flex items-center gap-2">
                                                {res.player}
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-3">
                                                {res.teams.map(t => (
                                                    <div key={t.id} className="flex items-center gap-3 bg-cyan-950/20 p-2 border border-cyan-900/50">
                                                        <div className="w-10 h-10 bg-white rounded-full p-1 flex items-center justify-center shrink-0">
                                                            <img src={t.logo || FALLBACK_IMG} className="w-full h-full object-contain" alt="" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-white truncate uppercase">{t.name}</div>
                                                            <div className="text-[10px] text-cyan-500 font-bold">TIER: {t.tier}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-4 flex justify-center">
                                    <button onClick={() => setStep('SETUP')} className="text-cyan-600 hover:text-cyan-300 underline font-bold tracking-widest text-sm">
                                        &lt; RETURN TO SETUP
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};