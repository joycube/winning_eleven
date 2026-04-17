"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Owner, MasterTeam, Team, FALLBACK_IMG } from '../types';
import { Search, X, LayoutGrid, RotateCcw, Zap } from 'lucide-react';

interface QuickArcadeDraftModalProps {
    onClose: () => void;
    masterTeams: MasterTeam[];
    owners?: Owner[]; 
}

type DraftMode = 'TOURNAMENT' | 'GROUP';
type Step = 'INTRO' | 'SETTINGS' | 'OPENING' | 'RESULT' | 'BRACKET';
type PlayerType = { id: string, nickname: string, photo: string };

const CUSTOM_USER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

const shuffleArray = <T,>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

export const QuickArcadeDraftModal = ({ onClose, masterTeams = [], owners = [] }: QuickArcadeDraftModalProps) => {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => setMounted(true), []);

    const [step, setStep] = useState<Step>('INTRO');
    
    const [players, setPlayers] = useState<PlayerType[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [teamsPerPlayer, setTeamsPerPlayer] = useState<number>(2);
    const [filterCategory, setFilterCategory] = useState<string[]>(['ALL']); 
    const [filterTiers, setFilterTiers] = useState<string[]>(['S', 'A', 'B', 'C']); 
    const [gameMode, setGameMode] = useState<DraftMode>('TOURNAMENT');

    const [draftResults, setDraftResults] = useState<(MasterTeam & { assignedPlayer: PlayerType })[]>([]);
    const [filteredCount, setFilteredCount] = useState(0);

    const totalNeeded = players.length * teamsPerPlayer;

    useEffect(() => {
        const count = masterTeams.filter(t => {
            if (!filterCategory.includes('ALL') && !filterCategory.includes(t.category)) return false;
            if (!filterTiers.includes('ALL') && !filterTiers.includes(t.tier)) return false;
            return true;
        }).length;
        setFilteredCount(count);
    }, [filterCategory, filterTiers, masterTeams]);

    const filteredOwners = owners.filter(o => 
        o.nickname?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        o.legacyName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAddPlayer = (owner?: Owner) => {
        if (owner) {
            if (!players.find(p => p.id === (owner.uid || String(owner.id)))) {
                setPlayers([...players, { id: owner.uid || String(owner.id), nickname: owner.nickname, photo: owner.photo || CUSTOM_USER_IMG }]);
            }
        } else if (searchQuery.trim()) {
            const name = searchQuery.trim().toUpperCase();
            if (!players.find(p => p.nickname === name)) {
                setPlayers([...players, { id: `custom-${Date.now()}`, nickname: name, photo: CUSTOM_USER_IMG }]);
            }
        }
        setSearchQuery('');
        setShowDropdown(false);
    };

    const handleRemovePlayer = (id: string) => {
        setPlayers(players.filter(p => p.id !== id));
    };

    const toggleFilterWithAll = (val: string, current: string[], setFn: any, isCat = false) => {
        if (isCat && val === 'ALL') { setFn(['ALL']); return; }
        let next = [...current];
        if (isCat && next.includes('ALL')) next = [];
        if (next.includes(val)) next = next.filter(v => v !== val); 
        else next = [...next, val];
        if (next.length === 0) setFn(isCat ? ['ALL'] : ['S']); 
        else setFn(next);
    };

    const handleStartDraft = () => {
        const targetPool = masterTeams.filter(t => {
            if (!filterCategory.includes('ALL') && !filterCategory.includes(t.category)) return false;
            if (!filterTiers.includes('ALL') && !filterTiers.includes(t.tier)) return false;
            return true;
        });

        if (targetPool.length < totalNeeded) return alert("팀이 부족합니다! 필터를 완화하거나 플레이어를 줄이세요.");

        const shuffledPool = shuffleArray(targetPool).slice(0, totalNeeded);
        const teamsByPlayer: (MasterTeam & { assignedPlayer: PlayerType })[][] = players.map(() => []);
        let teamIdx = 0;

        players.forEach((player, pIdx) => {
            for (let i = 0; i < teamsPerPlayer; i++) {
                teamsByPlayer[pIdx].push({ ...shuffledPool[teamIdx], assignedPlayer: player });
                teamIdx++;
            }
        });

        const seededResults: (MasterTeam & { assignedPlayer: PlayerType })[] = [];
        for (let round = 0; round < teamsPerPlayer; round++) {
            let roundTeams = [];
            for (let pIdx = 0; pIdx < players.length; pIdx++) {
                roundTeams.push(teamsByPlayer[pIdx][round]);
            }
            roundTeams = shuffleArray(roundTeams); 
            seededResults.push(...roundTeams);
        }
        
        setDraftResults(seededResults);
        setStep('OPENING');
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!mounted) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[99999] flex items-center justify-center p-4">
            
            <AnimatePresence mode="wait">
                {step === 'INTRO' && (
                    <IntroCinematic key="intro" onComplete={() => setStep('SETTINGS')} />
                )}
            </AnimatePresence>

            {step === 'OPENING' && (
                <PackOpeningAnimation onOpen={() => setStep('RESULT')} />
            )}

            {step !== 'INTRO' && step !== 'OPENING' && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.8, y: 100, rotateX: 20 }} 
                    animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }} 
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: "spring", stiffness: 250, damping: 20 }}
                    className="w-full max-w-6xl max-h-[85vh] flex flex-col rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] transition-colors duration-500 border border-slate-700 overflow-hidden bg-slate-900 relative isolate"
                >
                    <div className="flex-none p-4 md:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                        <h2 className="text-lg md:text-2xl font-black italic text-white flex items-center gap-2 md:gap-3 tracking-tighter">
                            <span className="text-emerald-400 text-xl md:text-3xl drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]">⚡</span> QUICK ARCADE DRAFT
                        </h2>
                        <button onClick={onClose} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold border border-slate-600 cursor-pointer transition-colors">✕</button>
                    </div>
                    
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative flex flex-col pb-6 md:pb-0">
                        
                        {step === 'SETTINGS' && (
                            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-6 flex-1 flex flex-col">
                                <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                                    <div className="space-y-1.5 relative" ref={dropdownRef}>
                                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider pl-1">1. Select Players</label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                                <input 
                                                    value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }} 
                                                    onFocus={() => setShowDropdown(true)} onKeyDown={e => {if(e.key==='Enter') handleAddPlayer();}} 
                                                    placeholder="유저 검색 또는 이름 입력..." 
                                                    className="w-full bg-slate-800 border border-slate-700 text-white pl-9 pr-3 py-2.5 rounded-xl outline-none focus:border-emerald-500 transition-colors shadow-inner text-sm" 
                                                />
                                                {showDropdown && searchQuery && filteredOwners.length > 0 && (
                                                    <div className="absolute top-full left-0 w-full mt-1.5 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar overflow-hidden">
                                                        {filteredOwners.map(o => (
                                                            <div key={o.uid || o.docId} onClick={() => handleAddPlayer(o)} className="px-4 py-2.5 hover:bg-slate-700 cursor-pointer text-white text-sm border-b border-slate-700/50 last:border-0 flex justify-between items-center transition-colors">
                                                                <span className="font-bold flex items-center gap-2">
                                                                    <div className="w-5 h-5 rounded-full bg-slate-900 border border-slate-600 overflow-hidden shrink-0">
                                                                        <img src={o.photo||CUSTOM_USER_IMG} onError={(e:any) => e.target.src=CUSTOM_USER_IMG} className="w-full h-full object-cover"/>
                                                                    </div> {o.nickname}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <button onClick={() => handleAddPlayer()} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 rounded-xl font-bold transition-all shadow-lg active:scale-95 text-sm">추가</button>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {players.map(p => (
                                                <div key={p.id} className="bg-slate-800 border border-slate-600 text-white px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs shadow-sm font-medium">
                                                    <img src={p.photo} onError={(e:any) => e.target.src=CUSTOM_USER_IMG} className="w-4 h-4 rounded-full object-cover border border-slate-500 bg-slate-900" />
                                                    {p.nickname} <button onClick={() => handleRemovePlayer(p.id)} className="text-slate-400 hover:text-red-400 ml-1"><X size={12}/></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider pl-1">2. Game Mode</label>
                                        <div className="flex bg-slate-800 p-1.5 rounded-xl border border-slate-700 gap-1.5">
                                            <button onClick={()=>setGameMode('TOURNAMENT')} className={`flex-1 py-2.5 rounded-lg text-sm font-black transition-all ${gameMode==='TOURNAMENT'?'bg-indigo-600 text-white shadow-md':'text-slate-500 hover:bg-slate-700 hover:text-white'}`}>🏆 토너먼트</button>
                                            <button onClick={()=>setGameMode('GROUP')} className={`flex-1 py-2.5 rounded-lg text-sm font-black transition-all ${gameMode==='GROUP'?'bg-indigo-600 text-white shadow-md':'text-slate-500 hover:bg-slate-700 hover:text-white'}`}>📊 조별리그</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider pl-1">3. Teams per Owner</label>
                                        <div className="flex items-center justify-between bg-slate-800 p-1.5 rounded-xl border border-slate-700 h-[54px]">
                                            <button onClick={() => setTeamsPerPlayer(Math.max(1, teamsPerPlayer - 1))} className="w-12 h-full rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-xl transition-colors">-</button>
                                            <div className="flex flex-col items-center leading-none mt-0.5"><span className="text-xl font-black text-white italic">{teamsPerPlayer}</span><span className="text-[8px] text-slate-400 font-bold uppercase mt-1">Teams</span></div>
                                            <button onClick={() => setTeamsPerPlayer(Math.min(5, teamsPerPlayer + 1))} className="w-12 h-full rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-xl transition-colors">+</button>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider pl-1">4. Filter Options</label>
                                        <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700 space-y-2">
                                            <div className="flex gap-1.5">
                                                {['ALL', 'CLUB', 'NATIONAL'].map(cat => (<button key={cat} onClick={() => toggleFilterWithAll(cat, filterCategory, setFilterCategory, true)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase border transition-all ${filterCategory.includes(cat) ? 'bg-emerald-600 border-emerald-500 text-white shadow-md' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-white'}`}>{cat}</button>))}
                                            </div>
                                            <div className="flex gap-1.5">
                                                {['ALL', 'S', 'A', 'B', 'C', 'D'].map(tier => (<button key={tier} onClick={() => toggleFilterWithAll(tier, filterTiers, setFilterTiers)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase border transition-all ${filterTiers.includes(tier) ? 'bg-sky-600 border-sky-500 text-white shadow-md' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-white'}`}>{tier === 'ALL' ? 'ALL' : tier}</button>))}
                                            </div>
                                            <div className="pt-1.5 border-t border-slate-700 text-xs flex justify-between items-center">
                                                <span className="text-slate-500 font-medium">Need: <strong className="text-white">{totalNeeded}</strong></span>
                                                <span className={`font-bold ${filteredCount >= totalNeeded ? 'text-emerald-400' : 'text-red-400'}`}>Available: {filteredCount} Teams</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex-1 min-h-[10px]"></div>

                                <button 
                                    onClick={handleStartDraft} 
                                    disabled={filteredCount < totalNeeded || players.length === 0} 
                                    className="w-full py-4 sm:py-5 bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 disabled:opacity-50 disabled:grayscale !text-white font-black italic text-lg sm:text-xl tracking-tighter uppercase rounded-xl sm:rounded-2xl shadow-[0_10px_30px_rgba(6,182,212,0.3)] transition-all transform hover:scale-[1.01] active:scale-[0.98] border border-white/20 relative z-10"
                                    style={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }} 
                                >
                                    {filteredCount < totalNeeded ? "Not Enough Teams!" : "⚡ Open The Packs ⚡"}
                                </button>
                            </div>
                        )}

                        {step === 'RESULT' && (
                            <DraftResultView 
                                results={draftResults} 
                                onRetry={() => setStep('SETTINGS')} 
                                onGenerate={() => setStep('BRACKET')} 
                            />
                        )}

                        {step === 'BRACKET' && (
                            <BracketView 
                                flatTeams={draftResults} 
                                gameMode={gameMode} 
                                onBack={() => setStep('RESULT')} 
                            />
                        )}
                    </div>
                </motion.div>
            )}
        </div>
    );
};

// =============================================================================
// SUB-COMPONENT: Intro Cinematic
// =============================================================================
const IntroCinematic = ({ onComplete }: { onComplete: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onComplete, 2200); 
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <motion.div 
            key="intro"
            exit={{ opacity: 0, scale: 1.2, filter: "blur(10px)" }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-[100000] flex flex-col items-center justify-center overflow-hidden"
        >
            <style jsx>{`
                @keyframes violent-shake {
                    0% { transform: translate(3px, 3px) rotate(0deg); }
                    10% { transform: translate(-3px, -4px) rotate(-1deg); }
                    20% { transform: translate(-5px, 0px) rotate(1deg); }
                    30% { transform: translate(5px, 4px) rotate(0deg); }
                    40% { transform: translate(3px, -3px) rotate(1deg); }
                    50% { transform: translate(-3px, 4px) rotate(-1deg); }
                    60% { transform: translate(-5px, 3px) rotate(0deg); }
                    70% { transform: translate(5px, 3px) rotate(-1deg); }
                    80% { transform: translate(-3px, -3px) rotate(1deg); }
                    90% { transform: translate(3px, 4px) rotate(0deg); }
                    100% { transform: translate(3px, -4px) rotate(-1deg); }
                }
                .shake-violent { animation: violent-shake 0.3s infinite; }
            `}</style>
            
            <motion.div 
                initial={{ opacity: 1 }} 
                animate={{ opacity: [1, 0, 1, 0] }} 
                transition={{ duration: 0.6, times: [0, 0.1, 0.2, 1] }} 
                className="absolute inset-0 bg-white mix-blend-screen z-10" 
            />
            
            <motion.div 
                initial={{ scale: 0, opacity: 1, borderWidth: "60px" }} 
                animate={{ scale: 8, opacity: 0, borderWidth: "0px" }} 
                transition={{ duration: 1, ease: "easeOut" }} 
                className="absolute w-40 h-40 rounded-full border-emerald-400 shadow-[0_0_200px_#34d399] z-0" 
            />
            
            <motion.div
                initial={{ scale: 0.5, opacity: 0, y: 50 }}
                animate={{ scale: [1.2, 1], opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                className="relative z-20 flex flex-col items-center shake-violent"
            >
                <Zap size={120} className="text-emerald-400 fill-emerald-400 drop-shadow-[0_0_50px_#34d399] mb-4" />
                <h2 className="text-5xl md:text-7xl font-black italic text-white tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,1)]">ARCADE DRAFT</h2>
                <p className="text-emerald-400 tracking-[0.4em] font-black mt-4 text-sm md:text-lg drop-shadow-[0_0_15px_#34d399]">SYSTEM OVERRIDE SUCCESS</p>
            </motion.div>
        </motion.div>
    );
};

// =============================================================================
// 🚨 [핵심 픽스] SUB-COMPONENT: DraftResultView (모서리 삐져나옴 완벽 방지)
// =============================================================================
const DraftResultView = ({ results, onRetry, onGenerate }: any) => {
    // flippedStates: 0 = 뒷면(초기), 1 = 회전중(90도 교차시점), 2 = 앞면(완료)
    const [flippedStates, setFlippedStates] = useState<number[]>(new Array(results.length).fill(0));
    
    const handleFlip = (index: number) => { 
        if (flippedStates[index] !== 0) return;
        
        // 1단계: 카드 회전 시작 (90도 지점까지)
        setFlippedStates(prev => { const next = [...prev]; next[index] = 1; return next; });
        
        // 2단계: 90도가 되는 순간(150ms) 내용을 앞면으로 바꿔치기하고 0도로 렌더링
        setTimeout(() => {
            setFlippedStates(prev => { const next = [...prev]; next[index] = 2; return next; });
        }, 150); 
    };

    const handleFlipAll = () => {
        setFlippedStates(new Array(results.length).fill(1));
        setTimeout(() => {
            setFlippedStates(new Array(results.length).fill(2));
        }, 150);
    };

    const backStyles = ["bg-blue-950", "bg-slate-900", "bg-emerald-950", "bg-indigo-950"];
    const allFlipped = flippedStates.every(s => s === 2);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <style jsx>{`
                @keyframes electric-shake { 
                    0% { transform: translate(0, 0) rotate(0deg); } 
                    25% { transform: translate(-2px, 1px) rotate(1deg); } 
                    50% { transform: translate(2px, -1px) rotate(-1deg); } 
                    75% { transform: translate(-1px, -2px) rotate(1deg); } 
                    100% { transform: translate(0, 0) rotate(0deg); } 
                }
                .tier-s-anim { animation: electric-shake 0.15s infinite linear; }
                
                @keyframes float-y { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                .tier-a-anim { animation: float-y 3s ease-in-out infinite; }

                /* 🚨 WebKit 계열 브라우저의 둥근 모서리 마스킹 뚫림 현상을 막기 위한 강력한 CSS 속성 */
                .safari-mask-fix {
                    -webkit-mask-image: -webkit-radial-gradient(white, black);
                    mask-image: radial-gradient(white, black);
                    transform: translateZ(0);
                }
            `}</style>
            
            <div className="flex-none p-2 flex justify-end gap-4 px-4 sm:px-6">
                <button onClick={handleFlipAll} disabled={allFlipped} className="text-xs font-bold text-slate-400 hover:text-white underline disabled:opacity-30">전체 뒤집기</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 pt-10 sm:pt-12 pb-12 custom-scrollbar" style={{ transform: 'translate3d(0,0,0)' }}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 pb-10">
                    {results.map((team: any, idx: number) => {
                        const state = flippedStates[idx];
                        const backBg = backStyles[idx % 4];

                        const borderColor = team.tier === 'S' ? 'border-[#00ff88]' : team.tier === 'A' ? 'border-[#ffd700]' : 'border-slate-700';

                        return (
                            <div key={idx} className={`relative h-64 sm:h-72 cursor-pointer group ${team.tier === 'S' ? 'tier-s-anim' : team.tier === 'A' ? 'tier-a-anim' : ''}`} onClick={() => handleFlip(idx)}>
                                
                                {/* 🚨 Box-shadow의 사각형 잘림(Clipping) 버그를 막기 위해, 실제 둥근 DOM 노드를 뒤에 깔고 블러 처리합니다. */}
                                {team.tier === 'S' && <div className="absolute -inset-3 bg-gradient-to-br from-[#00ff88] to-[#00f2ff] rounded-[2rem] blur-xl opacity-60 pointer-events-none z-0"></div>}
                                {team.tier === 'A' && <div className="absolute -inset-2 bg-[#ffd700] rounded-[2rem] blur-lg opacity-40 pointer-events-none z-0"></div>}
                                {team.tier !== 'S' && team.tier !== 'A' && <div className="absolute inset-0 rounded-2xl shadow-xl pointer-events-none z-0"></div>}

                                <motion.div 
                                    animate={{ rotateY: state === 1 ? 90 : 0 }} 
                                    transition={{ duration: 0.15, ease: "linear" }} 
                                    className="w-full h-full absolute inset-0 z-10"
                                >
                                    {/* 🚨 픽스: safari-mask-fix 클래스와 함께 이중 라운딩(rounded-2xl) 적용하여 직각 모서리 완전 제거 */}
                                    <div className={`w-full h-full rounded-2xl bg-slate-900 border-2 ${borderColor} flex flex-col overflow-hidden relative safari-mask-fix`}>
                                        
                                        {/* state === 0 또는 1 (뒷면 렌더링) */}
                                        {state !== 2 ? (
                                            /* 🚨 픽스: 내부 레이어에도 rounded-2xl 추가하여 2중 안전 장치 */
                                            <div className={`absolute inset-0 w-full h-full ${backBg} rounded-2xl flex flex-col items-center justify-center p-4 z-20`}>
                                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30 mix-blend-overlay bg-repeat"></div>
                                                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 border-white/10 flex items-center justify-center mb-3 bg-black/30 backdrop-blur-sm relative z-10"><span className="text-2xl sm:text-3xl grayscale opacity-70">⚽</span></div>
                                                <div className="text-center relative z-10"><p className="text-slate-300 text-[8px] sm:text-[10px] tracking-[0.2em] font-bold mb-1">OFFICIAL</p><h3 className="text-white font-black italic text-lg sm:text-xl leading-tight drop-shadow-md">eFOOTBALL<br/>TEAM 2026</h3></div>
                                            </div>
                                        ) : (
                                        /* state === 2 (앞면 렌더링) */
                                            /* 🚨 픽스: 내부 레이어에도 rounded-2xl 추가하여 2중 안전 장치 */
                                            <div className="absolute inset-0 w-full h-full rounded-2xl flex flex-col z-20 bg-slate-900 overflow-hidden">
                                                {team.tier === 'S' && <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/60 via-blue-900/20 to-transparent z-0 animate-pulse pointer-events-none"></div>}
                                                {team.tier === 'A' && <div className="absolute inset-0 bg-gradient-to-t from-yellow-900/40 via-orange-900/10 to-transparent z-0 pointer-events-none"></div>}
                                                
                                                <div className="h-12 sm:h-14 flex items-center px-3 sm:px-4 border-b border-white/10 bg-black/40 z-10 backdrop-blur-sm shrink-0">
                                                    <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full border-2 border-slate-400 overflow-hidden mr-2.5 bg-slate-800 shrink-0">
                                                        <img src={team.assignedPlayer.photo} onError={(e:any)=>e.target.src=CUSTOM_USER_IMG} className="w-full h-full object-cover"/>
                                                    </div>
                                                    <div className="flex flex-col min-w-0"><span className="text-[8px] sm:text-[9px] text-slate-400 uppercase font-bold">Owner</span><span className="text-xs sm:text-sm font-bold text-white truncate">{team.assignedPlayer.nickname}</span></div>
                                                </div>

                                                <div className="flex-1 flex flex-col items-center justify-center p-2 relative z-10">
                                                    <div className="w-20 h-20 sm:w-24 sm:h-24 relative mb-2 sm:mb-3 filter drop-shadow-2xl bg-white rounded-full flex items-center justify-center">
                                                        <img src={team.logo} className="w-14 h-14 sm:w-16 sm:h-16 object-contain" alt={team.name} onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                                                    </div>
                                                    <div className="text-center w-full px-2"><div className="font-black italic text-white text-base sm:text-lg uppercase truncate leading-none tracking-tighter drop-shadow-lg">{team.name}</div></div>
                                                </div>

                                                <div className="h-10 sm:h-12 bg-black/60 flex justify-between items-center px-3 sm:px-4 z-10 border-t border-white/10 backdrop-blur-md shrink-0">
                                                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-300 uppercase tracking-wider bg-white/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded truncate max-w-[70px] sm:max-w-[80px]">{team.category || team.region}</span>
                                                    <span className={`text-[10px] sm:text-xs font-black italic px-2 sm:px-3 py-0.5 sm:py-1 rounded shadow-lg ${team.tier === 'S' ? 'bg-emerald-500 text-black' : team.tier === 'A' ? 'bg-yellow-500 text-black' : team.tier === 'D' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300'}`}>{team.tier}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>

                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex-none p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex gap-3 sm:gap-4 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                <button onClick={onRetry} className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-400 font-bold hover:bg-slate-700 !text-white border border-slate-700 transition-colors text-sm sm:text-base flex items-center justify-center gap-2">
                    <RotateCcw size={16} /> 다시 뽑기
                </button>
                <button onClick={onGenerate} disabled={!allFlipped} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 !text-white font-black italic text-sm sm:text-base shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center gap-1.5">
                    대진표/조별리그 <LayoutGrid size={18} className="hidden sm:block" />
                </button>
            </div>
        </div>
    );
};

// =============================================================================
// SUB-COMPONENT: BracketView
// =============================================================================
const BracketView = ({ flatTeams, gameMode, onBack }: any) => {
    
    const generateSeededBracket = (teams: any[]) => {
        const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(teams.length)));
        const slots: (any | null)[] = new Array(nextPowerOf2).fill(null);
        
        const ownerGroups = teams.reduce((acc, team) => {
            if (!acc[team.assignedPlayer.nickname]) acc[team.assignedPlayer.nickname] = [];
            acc[team.assignedPlayer.nickname].push(team);
            return acc;
        }, {} as Record<string, any[]>);

        const sortedOwners = Object.keys(ownerGroups).sort((a, b) => ownerGroups[b].length - ownerGroups[a].length);
        
        const getOrder = (n: number) => {
            const res: number[] = []; 
            const bits = Math.log2(n);
            for (let i = 0; i < n; i++) {
                let rev = 0, temp = i;
                for (let b = 0; b < bits; b++) { rev = (rev << 1) | (temp & 1); temp >>= 1; }
                res.push(rev);
            }
            return res;
        };
        
        const order = getOrder(nextPowerOf2);
        let currentIdx = 0;

        sortedOwners.forEach(owner => {
            ownerGroups[owner].forEach((team: any) => {
                while (slots[order[currentIdx]] !== null) { currentIdx = (currentIdx + 1) % nextPowerOf2; }
                slots[order[currentIdx]] = team;
            });
        });

        const matches = [];
        for (let i = 0; i < slots.length; i += 2) {
            matches.push([slots[i], slots[i+1]]);
        }
        return matches;
    };

    if (gameMode === 'TOURNAMENT') {
        const matches = generateSeededBracket(flatTeams);
        return (
            <div className="p-4 sm:p-6 animate-in fade-in">
               <h3 className="text-xl sm:text-2xl md:text-3xl font-black italic text-white mb-6 text-center drop-shadow-md">🏆 TOURNAMENT MATCHUP</h3>
               <div className="space-y-3 sm:space-y-4 max-w-4xl mx-auto">
                   {matches.map((m, i) => (
                       <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-3 sm:p-4 flex justify-between items-center shadow-lg relative overflow-hidden">
                           <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
                           {m[0] ? (
                               <div className="flex items-center gap-3 sm:gap-4 w-[42%]">
                                   <img src={m[0].logo||FALLBACK_IMG} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain bg-white rounded-full p-1 sm:p-1.5 shadow-inner shrink-0"/>
                                   <div className="min-w-0">
                                       <div className="text-white font-bold text-xs sm:text-sm md:text-base truncate">{m[0].name}</div>
                                       <div className="text-[10px] sm:text-xs text-slate-400 font-bold truncate">{m[0].assignedPlayer.nickname}</div>
                                   </div>
                               </div>
                           ) : (
                               <div className="w-[42%] text-left text-slate-600 font-bold italic text-xs sm:text-sm md:text-base pl-2">BYE (부전승)</div>
                           )}
                           <div className="text-lg sm:text-xl md:text-2xl font-black text-slate-500 italic shrink-0">VS</div>
                           {m[1] ? (
                               <div className="flex items-center gap-3 sm:gap-4 w-[42%] flex-row-reverse text-right">
                                   <img src={m[1].logo||FALLBACK_IMG} className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 object-contain bg-white rounded-full p-1 sm:p-1.5 shadow-inner shrink-0"/>
                                   <div className="min-w-0">
                                       <div className="text-white font-bold text-xs sm:text-sm md:text-base truncate">{m[1].name}</div>
                                       <div className="text-[10px] sm:text-xs text-slate-400 font-bold truncate">{m[1].assignedPlayer.nickname}</div>
                                   </div>
                               </div>
                           ) : (
                               <div className="w-[42%] text-right text-slate-600 font-bold italic text-xs sm:text-sm md:text-base pr-2">BYE (부전승)</div>
                           )}
                       </div>
                   ))}
               </div>
               <div className="mt-8 text-center">
                   <button onClick={onBack} className="bg-slate-800 text-slate-400 hover:text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-bold transition-colors border border-slate-700 text-sm sm:text-base">← 카드 뷰로 돌아가기</button>
               </div>
            </div>
        );
    } else {
        const groups = [];
        for (let i = 0; i < flatTeams.length; i += 4) { groups.push(flatTeams.slice(i, i+4)); }
        return (
            <div className="p-4 sm:p-6 animate-in fade-in">
               <h3 className="text-xl sm:text-2xl md:text-3xl font-black italic text-white mb-6 text-center drop-shadow-md">📊 GROUP STAGE DRAW</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-5xl mx-auto">
                   {groups.map((g, i) => (
                       <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
                           <div className="bg-slate-900/80 py-2.5 sm:py-3 px-4 font-black italic text-emerald-400 border-b border-slate-700 tracking-widest text-base sm:text-lg">GROUP {String.fromCharCode(65+i)}</div>
                           <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                               {g.map((t:any, j:number) => (
                                   <div key={j} className="flex items-center gap-2 sm:gap-3 bg-slate-900 border border-slate-700/50 p-2 sm:p-2.5 rounded-lg">
                                       <span className="text-slate-500 font-black w-3 sm:w-4 text-center text-xs sm:text-sm">{j+1}</span>
                                       <img src={t.logo||FALLBACK_IMG} className="w-8 h-8 sm:w-10 sm:h-10 object-contain bg-white rounded-full p-1 shadow-sm shrink-0"/>
                                       <div className="flex-1 min-w-0">
                                           <div className="text-white font-bold text-xs sm:text-sm truncate">{t.name}</div>
                                           <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold truncate">{t.assignedPlayer.nickname}</div>
                                       </div>
                                       <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded font-black shadow-sm shrink-0 ${t.tier==='S'?'bg-emerald-500 text-black':t.tier==='A'?'bg-yellow-500 text-black':'bg-slate-700 text-white'}`}>{t.tier}</span>
                                   </div>
                               ))}
                           </div>
                       </div>
                   ))}
               </div>
               <div className="mt-8 text-center">
                   <button onClick={onBack} className="bg-slate-800 text-slate-400 hover:text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-bold transition-colors border border-slate-700 text-sm sm:text-base">← 카드 뷰로 돌아가기</button>
               </div>
            </div>
        );
    }
};

// =============================================================================
// SUB-COMPONENT: PackOpeningAnimation 
// =============================================================================
const PremiumCard = () => (
    <div className="w-40 h-60 sm:w-48 sm:h-72 shrink-0 bg-gradient-to-br from-emerald-400 via-sky-500 to-indigo-600 rounded-xl border-2 border-white/30 shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30 mix-blend-overlay"></div>
        <div className="text-center z-10">
            <div className="text-4xl sm:text-5xl mb-2 drop-shadow-md text-white/90">⚡</div>
            <div className="font-black text-white text-base sm:text-lg italic tracking-tighter leading-none drop-shadow-lg opacity-80"> PREMIUM<br/>PACK </div>
        </div>
    </div>
);

const PackOpeningAnimation = ({ onOpen }: { onOpen: () => void }) => {
    const [phase, setPhase] = useState<'IDLE' | 'CHARGING' | 'CONTRACTING' | 'EXPLODING' | 'DEALING'>('IDLE');
    const [animType] = useState<number>(() => Math.floor(Math.random() * 5)); 
    const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

    useEffect(() => { return () => timeoutRefs.current.forEach(clearTimeout); }, []);

    const handleClick = () => { 
        if (phase !== 'IDLE') return; 
        setPhase('CHARGING'); 
        timeoutRefs.current.push(setTimeout(() => setPhase('CONTRACTING'), 800)); 
        timeoutRefs.current.push(setTimeout(() => setPhase('EXPLODING'), 1200)); 
        timeoutRefs.current.push(setTimeout(() => { 
            setPhase('DEALING'); 
            timeoutRefs.current.push(setTimeout(onOpen, 3500));
        }, 1600)); 
    };

    const handleSkip = (e: React.MouseEvent) => {
        e.stopPropagation(); 
        timeoutRefs.current.forEach(clearTimeout); 
        onOpen(); 
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center overflow-hidden">
            <style jsx>{`
                @keyframes shake { 0% { transform: translate(1px, 1px) rotate(0deg); } 20% { transform: translate(-3px, 0px) rotate(1deg); } 40% { transform: translate(1px, -1px) rotate(1deg); } 60% { transform: translate(-3px, 1px) rotate(0deg); } 80% { transform: translate(-1px, -1px) rotate(1deg); } 100% { transform: translate(1px, -2px) rotate(-1deg); } }
                .shake-hard { animation: shake 0.1s infinite; }
                @keyframes electric-pulse { 0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7); } 50% { box-shadow: 0 0 50px 20px rgba(14, 165, 233, 0.7); } 100% { box-shadow: 0 0 100px 50px rgba(52, 211, 153, 0); } }
                .electric-aura { animation: electric-pulse 0.3s infinite alternate; }
            `}</style>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-black to-black opacity-80" />

            <AnimatePresence>
                {phase !== 'DEALING' && (
                    <motion.div 
                        onClick={handleClick}
                        animate={
                            phase === 'CHARGING' ? { scale: [1, 1.05, 0.98, 1.02], filter: "brightness(1.5)", y: [0, -5, 5, 0] } : 
                            phase === 'CONTRACTING' ? { scale: 0.2, opacity: 1, rotate: [0, 10, -10, 0], filter: "brightness(3) contrast(2)", transition: { duration: 0.4, ease: "backIn" } } :
                            phase === 'EXPLODING' ? { scale: 30, opacity: 0, filter: "brightness(5) blur(20px)", transition: { duration: 0.4, ease: "easeOut" } } : 
                            { scale: 1, y: [0, -10, 0] }
                        }
                        transition={ phase === 'IDLE' ? { y: { repeat: Infinity, duration: 2 } } : phase === 'CHARGING' ? { duration: 0.1, repeat: Infinity } : {} }
                        className={`relative z-10 cursor-pointer ${phase !== 'IDLE' ? 'pointer-events-none' : ''} ${phase === 'CHARGING' ? 'shake-hard' : ''}`}
                    >
                        {phase === 'CONTRACTING' && ( <div className="absolute inset-0 -m-10 rounded-full electric-aura bg-white/20 blur-xl z-0" /> )}
                        <div className="w-64 h-96 md:w-80 md:h-[480px] bg-gradient-to-br from-emerald-400 via-sky-500 to-indigo-600 rounded-3xl border-4 border-white/30 shadow-[0_0_80px_rgba(6,182,212,0.5)] flex items-center justify-center relative overflow-hidden group z-10">
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30 mix-blend-overlay"></div>
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent skew-x-12 translate-x-[-100%] group-hover:animate-[shimmer_2s_infinite]"></div>
                            <div className="text-center z-10 scale-110">
                                <div className={`text-8xl mb-6 drop-shadow-md ${phase === 'CHARGING' ? 'text-white' : 'animate-pulse'}`}>⚡</div>
                                <div className="font-black text-white text-4xl italic tracking-tighter leading-none drop-shadow-lg"> PREMIUM<br/>PACK </div>
                            </div>
                            {phase === 'IDLE' && <div className="absolute bottom-8 left-0 right-0 text-center"><p className="text-sky-900 font-bold text-sm animate-bounce bg-white/90 py-1.5 px-4 rounded-full inline-block shadow-lg">CLICK TO OPEN</p></div>}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {phase === 'EXPLODING' && <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.6, times: [0, 0.1, 1] }} className="fixed inset-0 bg-gradient-to-br from-emerald-400 via-white to-sky-500 z-[100000] pointer-events-none mix-blend-screen" />}

            {phase === 'DEALING' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 overflow-hidden w-full h-full">
                    {animType === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 sm:gap-10 w-full h-full">
                            <motion.div initial={{ x: "0%" }} animate={{ x: "-50%" }} transition={{ duration: 10, ease: "linear", repeat: Infinity }} className="flex min-w-max scale-75 opacity-60 blur-[2px]">{Array.from({ length: 40 }).map((_, i) => <div key={`t-${i}`} className="shrink-0 pr-4 sm:pr-6"><PremiumCard /></div>)}</motion.div>
                            <motion.div initial={{ x: "0%" }} animate={{ x: "-50%" }} transition={{ duration: 5, ease: "linear", repeat: Infinity }} className="flex min-w-max z-10 drop-shadow-2xl">{Array.from({ length: 40 }).map((_, i) => <div key={`m-${i}`} className="shrink-0 pr-4 sm:pr-8"><PremiumCard /></div>)}</motion.div>
                            <motion.div initial={{ x: "-50%" }} animate={{ x: "0%" }} transition={{ duration: 8, ease: "linear", repeat: Infinity }} className="flex min-w-max scale-75 opacity-60 blur-[2px]">{Array.from({ length: 40 }).map((_, i) => <div key={`b-${i}`} className="shrink-0 pr-4 sm:pr-6"><PremiumCard /></div>)}</motion.div>
                        </div>
                    )}
                    {animType === 1 && (
                        <div className="absolute inset-0 flex flex-row items-center justify-center gap-4 sm:gap-10 w-full h-full overflow-hidden">
                            <motion.div initial={{ y: "-50%" }} animate={{ y: "0%" }} transition={{ duration: 6, ease: "linear", repeat: Infinity }} className="flex flex-col min-h-max scale-75 opacity-60 blur-[2px]">{Array.from({ length: 40 }).map((_, i) => <div key={`l-${i}`} className="shrink-0 pb-4 sm:pb-6"><PremiumCard /></div>)}</motion.div>
                            <motion.div initial={{ y: "-50%" }} animate={{ y: "0%" }} transition={{ duration: 7, ease: "linear", repeat: Infinity }} className="flex flex-col min-h-max z-10 drop-shadow-2xl">{Array.from({ length: 40 }).map((_, i) => <div key={`c-${i}`} className="shrink-0 pb-4 sm:pb-8"><PremiumCard /></div>)}</motion.div>
                            <motion.div initial={{ y: "-50%" }} animate={{ y: "0%" }} transition={{ duration: 9, ease: "linear", repeat: Infinity }} className="flex flex-col min-h-max scale-75 opacity-60 blur-[2px]">{Array.from({ length: 40 }).map((_, i) => <div key={`r-${i}`} className="shrink-0 pb-4 sm:pb-6"><PremiumCard /></div>)}</motion.div>
                        </div>
                    )}
                    {animType === 2 && (
                        <div className="absolute inset-0 w-full h-full">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <motion.div key={i} className="absolute" initial={{ x: '120vw', y: '-50vh', rotate: -30 }} animate={{ x: '-50vw', y: '150vh' }} transition={{ duration: 0.8 + (i % 3) * 0.3, repeat: Infinity, delay: (i % 5) * 0.3, ease: "linear" }}>
                                    <div className="blur-[1px] opacity-80 shrink-0"><PremiumCard /></div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                    {animType === 3 && (
                        <div className="absolute inset-0 flex items-center justify-center w-full h-full">
                            {Array.from({ length: 24 }).map((_, i) => {
                                const angle = (Math.PI * 2 * i) / 24; const dist = 1000 + (i % 3) * 200; 
                                return (
                                    <motion.div key={`burst-${i}`} className="absolute" initial={{ scale: 0.3, opacity: 0, x: 0, y: 0 }} animate={{ scale: [0.5, 1.2], opacity: [1, 0], x: Math.cos(angle) * dist, y: Math.sin(angle) * dist }} transition={{ duration: 0.6, repeat: Infinity, delay: (i % 4) * 0.15, ease: "easeOut" }}>
                                        <div className="blur-[2px] opacity-70 shrink-0"><PremiumCard /></div>
                                    </motion.div>
                                );
                            })}
                            <motion.div className="z-30 shadow-[0_0_80px_rgba(52,211,153,0.8)]" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.4, repeat: Infinity, ease: "easeInOut" }}><PremiumCard /></motion.div>
                        </div>
                    )}
                    {animType === 4 && (
                        <div className="absolute inset-0 flex items-center justify-center w-full h-full">
                            {Array.from({ length: 15 }).map((_, i) => (
                                <motion.div key={i} className="absolute" initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.5, 3], opacity: [0, 1, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}><PremiumCard /></motion.div>
                            ))}
                        </div>
                    )}
                    <div className="fixed bottom-[10%] left-1/2 -translate-x-1/2 z-[100001] animate-in fade-in slide-in-from-bottom-8 duration-500">
                        <button onClick={handleSkip} className="bg-white/95 text-sky-900 font-black text-sm tracking-widest py-3 px-8 rounded-full shadow-[0_10px_30px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 transition-transform border border-white/50 whitespace-nowrap">TAP TO SKIP ⏭️</button>
                    </div>
                </div>
            )}
        </div>
    );
};