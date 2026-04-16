"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Owner, MasterTeam, Team, FALLBACK_IMG } from '../types';
import { Search, X, LayoutGrid } from 'lucide-react';

interface QuickArcadeDraftModalProps {
    onClose: () => void;
    masterTeams: MasterTeam[];
    owners?: Owner[]; 
}

type DraftMode = 'TOURNAMENT' | 'GROUP';
type Step = 'SETTINGS' | 'OPENING' | 'RESULT' | 'BRACKET';
type PlayerType = { id: string, nickname: string, photo: string };

export const QuickArcadeDraftModal = ({ onClose, masterTeams = [], owners = [] }: QuickArcadeDraftModalProps) => {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => setMounted(true), []);

    const [step, setStep] = useState<Step>('SETTINGS');
    
    // 🚨 1. 플레이어 상태 관리 (커스텀 유저 대응)
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

    // 실시간 필터 카운트 계산
    useEffect(() => {
        const count = masterTeams.filter(t => {
            if (!filterCategory.includes('ALL') && !filterCategory.includes(t.category)) return false;
            if (!filterTiers.includes('ALL') && !filterTiers.includes(t.tier)) return false;
            return true;
        }).length;
        setFilteredCount(count);
    }, [filterCategory, filterTiers, masterTeams]);

    // 유저 검색
    const filteredOwners = owners.filter(o => 
        o.nickname?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        o.legacyName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // 🚨 픽스: 플레이어 추가 및 삭제 함수 완벽 구현
    const handleAddPlayer = (owner?: Owner) => {
        if (owner) {
            if (!players.find(p => p.id === (owner.uid || String(owner.id)))) {
                setPlayers([...players, { id: owner.uid || String(owner.id), nickname: owner.nickname, photo: owner.photo || FALLBACK_IMG }]);
            }
        } else if (searchQuery.trim()) {
            const name = searchQuery.trim().toUpperCase();
            if (!players.find(p => p.nickname === name)) {
                setPlayers([...players, { id: `custom-${Date.now()}`, nickname: name, photo: FALLBACK_IMG }]);
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

    // 🚨 픽스: 드래프트 실행 로직
    const handleStartDraft = () => {
        const targetPool = masterTeams.filter(t => {
            if (!filterCategory.includes('ALL') && !filterCategory.includes(t.category)) return false;
            if (!filterTiers.includes('ALL') && !filterTiers.includes(t.tier)) return false;
            return true;
        });

        if (targetPool.length < totalNeeded) return alert("팀이 부족합니다! 필터를 완화하거나 플레이어를 줄이세요.");

        const shuffled = [...targetPool].sort(() => Math.random() - 0.5).slice(0, totalNeeded);
        const results: (MasterTeam & { assignedPlayer: PlayerType })[] = [];
        let teamIdx = 0;

        players.forEach(player => {
            for (let i = 0; i < teamsPerPlayer; i++) {
                results.push({ ...shuffled[teamIdx], assignedPlayer: player });
                teamIdx++;
            }
        });
        
        setDraftResults(results.sort(() => Math.random() - 0.5)); // 카드 배치 랜덤화
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
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[99999] flex items-center justify-center p-4">
            
            {step === 'OPENING' && (
                <PackOpeningAnimation onOpen={() => setStep('RESULT')} />
            )}

            {step !== 'OPENING' && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-6xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl transition-colors duration-500 border border-slate-700 overflow-hidden bg-slate-900 relative isolate"
                >
                    <div className="flex-none p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                        <h2 className="text-xl md:text-2xl font-black italic text-white flex items-center gap-2 md:gap-3 tracking-tighter">
                            <span className="text-emerald-400 text-2xl md:text-3xl drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]">⚡</span> QUICK ARCADE DRAFT
                        </h2>
                        <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold border border-slate-600 cursor-pointer">✕</button>
                    </div>
                    
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative flex flex-col pb-8 md:pb-0">
                        
                        {/* =========================================================
                            STEP 1. SETTINGS (기존 레이아웃 완전 복원) 
                        ========================================================= */}
                        {step === 'SETTINGS' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 p-5 md:p-8 pb-4 flex-1 flex flex-col">
                                
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="space-y-2 relative" ref={dropdownRef}>
                                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider pl-1">1. Select Players</label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                                <input 
                                                    value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }} 
                                                    onFocus={() => setShowDropdown(true)} onKeyDown={e => {if(e.key==='Enter') handleAddPlayer();}} 
                                                    placeholder="유저 검색 또는 이름 입력..." 
                                                    className="w-full bg-slate-800 border border-slate-700 text-white pl-10 pr-3 py-3 rounded-xl outline-none focus:border-emerald-500 transition-colors shadow-inner" 
                                                />
                                                {showDropdown && searchQuery && filteredOwners.length > 0 && (
                                                    <div className="absolute top-full left-0 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar overflow-hidden">
                                                        {filteredOwners.map(o => (
                                                            <div key={o.uid || o.docId} onClick={() => handleAddPlayer(o)} className="px-4 py-3 hover:bg-slate-700 cursor-pointer text-white text-sm border-b border-slate-700/50 last:border-0 flex justify-between items-center transition-colors">
                                                                <span className="font-bold flex items-center gap-2">
                                                                    <div className="w-6 h-6 rounded-full bg-slate-900 border border-slate-600 overflow-hidden">
                                                                        <img src={o.photo||FALLBACK_IMG} className="w-full h-full object-cover"/>
                                                                    </div> {o.nickname}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <button onClick={() => handleAddPlayer()} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 rounded-xl font-bold transition-all shadow-lg active:scale-95">추가</button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {players.map(p => (
                                                <div key={p.id} className="bg-slate-800 border border-slate-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm shadow-sm font-medium">
                                                    <img src={p.photo} className="w-5 h-5 rounded-full object-cover border border-slate-500" />
                                                    {p.nickname} <button onClick={() => handleRemovePlayer(p.id)} className="text-slate-400 hover:text-red-400"><X size={14}/></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider pl-1">2. Game Mode</label>
                                        <div className="flex bg-slate-800 p-2 rounded-2xl border border-slate-700 h-[64px] gap-2">
                                            <button onClick={()=>setGameMode('TOURNAMENT')} className={`flex-1 rounded-xl text-sm font-black transition-all ${gameMode==='TOURNAMENT'?'bg-indigo-600 text-white shadow-lg':'text-slate-500 hover:bg-slate-700 hover:text-white'}`}>🏆 토너먼트</button>
                                            <button onClick={()=>setGameMode('GROUP')} className={`flex-1 rounded-xl text-sm font-black transition-all ${gameMode==='GROUP'?'bg-indigo-600 text-white shadow-lg':'text-slate-500 hover:bg-slate-700 hover:text-white'}`}>📊 조별리그</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider pl-1">3. Teams per Owner</label>
                                        <div className="flex items-center justify-between bg-slate-800 p-2 rounded-2xl border border-slate-700 h-[64px]">
                                            <button onClick={() => setTeamsPerPlayer(Math.max(1, teamsPerPlayer - 1))} className="w-12 h-full rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-2xl transition-colors">-</button>
                                            <div className="flex flex-col items-center"><span className="text-2xl font-black text-white italic">{teamsPerPlayer}</span><span className="text-[9px] text-slate-400 font-bold uppercase">Teams Each</span></div>
                                            <button onClick={() => setTeamsPerPlayer(Math.min(5, teamsPerPlayer + 1))} className="w-12 h-full rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-2xl transition-colors">+</button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs text-slate-400 font-bold uppercase tracking-wider pl-1">4. Filter Options</label>
                                        <div className="bg-slate-800 p-3 rounded-2xl border border-slate-700 space-y-3">
                                            <div className="flex gap-2">
                                                {['ALL', 'CLUB', 'NATIONAL'].map(cat => (<button key={cat} onClick={() => toggleFilterWithAll(cat, filterCategory, setFilterCategory, true)} className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-wider uppercase border transition-all ${filterCategory.includes(cat) ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-white'}`}>{cat}</button>))}
                                            </div>
                                            <div className="flex gap-2">
                                                {['ALL', 'S', 'A', 'B', 'C', 'D'].map(tier => (<button key={tier} onClick={() => toggleFilterWithAll(tier, filterTiers, setFilterTiers)} className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-wider uppercase border transition-all ${filterTiers.includes(tier) ? 'bg-sky-600 border-sky-500 text-white shadow-md shadow-sky-500/20' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-white'}`}>{tier === 'ALL' ? 'ALL' : tier}</button>))}
                                            </div>
                                            <div className="pt-2 border-t border-slate-700 text-xs flex justify-between items-center">
                                                <span className="text-slate-500">Need: <strong className="text-white">{totalNeeded}</strong></span>
                                                <span className={`font-bold ${filteredCount >= totalNeeded ? 'text-emerald-400' : 'text-red-400'}`}>Available: {filteredCount} Teams</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex-1 min-h-[20px]"></div>

                                <button 
                                    onClick={handleStartDraft} 
                                    disabled={filteredCount < totalNeeded || players.length === 0} 
                                    className="w-full py-5 bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 disabled:opacity-50 disabled:grayscale !text-white font-black italic text-xl tracking-tighter uppercase rounded-2xl shadow-[0_10px_30px_rgba(6,182,212,0.3)] transition-all transform hover:scale-[1.01] active:scale-[0.98] border border-white/20 relative z-10"
                                    style={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }} 
                                >
                                    {filteredCount < totalNeeded ? "Not Enough Teams!" : "⚡ Open The Packs ⚡"}
                                </button>
                            </div>
                        )}

                        {/* =========================================================
                            STEP 2. RESULT (오리지널 디자인 + 스파크 효과 유지) 
                        ========================================================= */}
                        {step === 'RESULT' && (
                            <DraftResultView 
                                results={draftResults} 
                                onRetry={() => setStep('SETTINGS')} 
                                onGenerate={() => setStep('BRACKET')} 
                            />
                        )}

                        {/* =========================================================
                            STEP 3. BRACKET (대진표 / 조별리그 시각화) 
                        ========================================================= */}
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
// SUB-COMPONENT: DraftResultView (오리지널 카드 레이아웃 완벽 복원)
// =============================================================================
const DraftResultView = ({ results, onRetry, onGenerate }: any) => {
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    
    const handleFlip = (index: number) => { if (!flippedIndices.includes(index)) setFlippedIndices(prev => [...prev, index]); };
    const handleFlipAll = () => setFlippedIndices(results.map((_: any, i: number) => i));

    const backStyles = ["bg-blue-950", "bg-slate-900", "bg-emerald-950", "bg-indigo-950"];
    const allFlipped = flippedIndices.length === results.length;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* 🚨 2. 오리지널 S, A 등급 스파크 / 플로팅 효과 CSS 완벽 복원 */}
            <style jsx>{`
                .perspective-1000 { perspective: 1000px; }
                .preserve-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
                @keyframes electric-shake {
                    0% { transform: translate(0, 0) rotate(0deg); }
                    25% { transform: translate(-2px, 1px) rotate(1deg); }
                    50% { transform: translate(2px, -1px) rotate(-1deg); }
                    75% { transform: translate(-1px, -2px) rotate(1deg); }
                    100% { transform: translate(0, 0) rotate(0deg); }
                }
                .tier-s-anim { animation: electric-shake 0.15s infinite linear; box-shadow: 0 0 20px #00ff88, 0 0 40px #00f2ff; border: 2px solid #00ff88 !important; }
                @keyframes float-y { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                .tier-a-anim { animation: float-y 3s ease-in-out infinite; box-shadow: 0 0 25px rgba(255, 215, 0, 0.6); border: 2px solid #ffd700 !important; }
            `}</style>
            
            <div className="flex-none p-2 flex justify-end gap-4 px-6 mt-2">
                <button onClick={handleFlipAll} disabled={allFlipped} className="text-xs font-bold text-slate-400 hover:text-white underline disabled:opacity-30">전체 뒤집기</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar" style={{ transform: 'translate3d(0,0,0)' }}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-20">
                    {results.map((team: any, idx: number) => {
                        const isFlipped = flippedIndices.includes(idx);
                        const backBg = backStyles[idx % 4];

                        return (
                            <div key={idx} className="relative h-72 perspective-1000 cursor-pointer group" onClick={() => handleFlip(idx)}>
                                {/* 🚨 뒷면일 때도 스파크 효과가 유지되도록 감싸는 div에 클래스 부여 */}
                                <div className={`w-full h-full relative rounded-2xl ${team.tier === 'S' ? 'tier-s-anim' : team.tier === 'A' ? 'tier-a-anim' : ''}`}>
                                    <motion.div animate={{ rotateY: isFlipped ? 180 : 0 }} transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }} className="w-full h-full preserve-3d absolute inset-0 rounded-2xl">
                                        
                                        {/* BACK (오리지널 뒷면) */}
                                        <div className={`absolute inset-0 w-full h-full rounded-2xl backface-hidden ${backBg} border-2 border-slate-600 shadow-2xl flex flex-col items-center justify-center p-4 z-20`}>
                                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30 mix-blend-overlay bg-repeat"></div>
                                            <div className="w-16 h-16 rounded-full border-4 border-white/10 flex items-center justify-center mb-3 bg-black/30 backdrop-blur-sm relative z-10"><span className="text-3xl grayscale opacity-70">⚽</span></div>
                                            <div className="text-center relative z-10"><p className="text-slate-300 text-[10px] tracking-[0.2em] font-bold mb-1">OFFICIAL</p><h3 className="text-white font-black italic text-xl leading-tight drop-shadow-md">eFOOTBALL<br/>TEAM 2026</h3></div>
                                        </div>

                                        {/* FRONT (오리지널 유저 프사/이름 레이아웃 완벽 복원) */}
                                        <div className="absolute inset-0 w-full h-full rounded-2xl bg-slate-900 border-2 border-slate-600 flex flex-col overflow-hidden shadow-inner" style={{ transform: "rotateY(180deg)", zIndex: isFlipped ? 30 : 0 }}>
                                            {team.tier === 'S' && <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/60 via-blue-900/20 to-transparent z-0 animate-pulse"></div>}
                                            {team.tier === 'A' && <div className="absolute inset-0 bg-gradient-to-t from-yellow-900/40 via-orange-900/10 to-transparent z-0"></div>}
                                            
                                            <div className="h-14 flex items-center px-4 border-b border-white/10 bg-black/40 z-10 backdrop-blur-sm">
                                                <div className="w-9 h-9 rounded-full border-2 border-slate-400 overflow-hidden mr-3 bg-slate-800 shrink-0">
                                                    <img src={team.assignedPlayer.photo} className="w-full h-full object-cover"/>
                                                </div>
                                                <div className="flex flex-col"><span className="text-[9px] text-slate-400 uppercase font-bold">Owner</span><span className="text-sm font-bold text-white truncate">{team.assignedPlayer.nickname}</span></div>
                                            </div>

                                            <div className="flex-1 flex flex-col items-center justify-center p-2 relative z-10">
                                                <div className="w-24 h-24 relative mb-3 filter drop-shadow-2xl bg-white rounded-full flex items-center justify-center">
                                                    <img src={team.logo} className="w-16 h-16 object-contain" alt={team.name} onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                                                </div>
                                                <div className="text-center w-full px-2"><div className="font-black italic text-white text-lg uppercase truncate leading-none tracking-tighter drop-shadow-lg">{team.name}</div></div>
                                            </div>

                                            <div className="h-12 bg-black/60 flex justify-between items-center px-4 z-10 border-t border-white/10 backdrop-blur-md">
                                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider bg-white/10 px-2 py-1 rounded truncate max-w-[80px]">{team.category || team.region}</span>
                                                <span className={`text-xs font-black italic px-3 py-1 rounded shadow-lg ${team.tier === 'S' ? 'bg-emerald-500 text-black' : team.tier === 'A' ? 'bg-yellow-500 text-black' : team.tier === 'D' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300'}`}>{team.tier}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex-none p-4 bg-slate-900 border-t border-slate-800 grid grid-cols-2 gap-4 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                <button onClick={onRetry} className="py-4 rounded-xl bg-slate-800 text-slate-400 font-bold hover:bg-slate-700 !text-white border border-slate-700 transition-colors">🔄 다시 뽑기</button>
                <button onClick={onGenerate} disabled={!allFlipped} className="py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 !text-white font-black italic text-lg shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center gap-2"><LayoutGrid size={20} /> 대진표/조별리그 생성</button>
            </div>
        </div>
    );
};

// =============================================================================
// 🚨 3. SUB-COMPONENT: BracketView (토너먼트/조별리그 뷰어 생성)
// =============================================================================
const BracketView = ({ flatTeams, gameMode, onBack }: any) => {
    if (gameMode === 'TOURNAMENT') {
        const matches = [];
        for (let i = 0; i < flatTeams.length; i += 2) {
            matches.push([flatTeams[i], flatTeams[i+1]]);
        }
        return (
            <div className="p-6 animate-in fade-in">
               <h3 className="text-2xl md:text-3xl font-black italic text-white mb-8 text-center drop-shadow-md">🏆 TOURNAMENT MATCHUP</h3>
               <div className="space-y-4 max-w-4xl mx-auto">
                   {matches.map((m, i) => (
                       <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex justify-between items-center shadow-lg relative overflow-hidden">
                           <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
                           
                           <div className="flex items-center gap-4 w-[42%]">
                               <img src={m[0].logo||FALLBACK_IMG} className="w-12 h-12 md:w-14 md:h-14 object-contain bg-white rounded-full p-1.5 shadow-inner"/>
                               <div className="min-w-0">
                                   <div className="text-white font-bold text-sm md:text-base truncate">{m[0].name}</div>
                                   <div className="text-xs text-slate-400 font-bold">{m[0].assignedPlayer.nickname}</div>
                               </div>
                           </div>

                           <div className="text-xl md:text-2xl font-black text-slate-500 italic shrink-0">VS</div>

                           {m[1] ? (
                               <div className="flex items-center gap-4 w-[42%] flex-row-reverse text-right">
                                   <img src={m[1].logo||FALLBACK_IMG} className="w-12 h-12 md:w-14 md:h-14 object-contain bg-white rounded-full p-1.5 shadow-inner"/>
                                   <div className="min-w-0">
                                       <div className="text-white font-bold text-sm md:text-base truncate">{m[1].name}</div>
                                       <div className="text-xs text-slate-400 font-bold">{m[1].assignedPlayer.nickname}</div>
                                   </div>
                               </div>
                           ) : (
                               <div className="w-[42%] text-right text-slate-600 font-bold italic text-sm md:text-base">BYE (부전승)</div>
                           )}
                       </div>
                   ))}
               </div>
               <div className="mt-10 text-center">
                   <button onClick={onBack} className="bg-slate-800 text-slate-400 hover:text-white px-8 py-3.5 rounded-xl font-bold transition-colors border border-slate-700">← 카드 뷰로 돌아가기</button>
               </div>
            </div>
        );
    } else {
        const groups = [];
        for (let i = 0; i < flatTeams.length; i += 4) { groups.push(flatTeams.slice(i, i+4)); }
        return (
            <div className="p-6 animate-in fade-in">
               <h3 className="text-2xl md:text-3xl font-black italic text-white mb-8 text-center drop-shadow-md">📊 GROUP STAGE DRAW</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                   {groups.map((g, i) => (
                       <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
                           <div className="bg-slate-900/80 py-3 px-4 font-black italic text-emerald-400 border-b border-slate-700 tracking-widest text-lg">GROUP {String.fromCharCode(65+i)}</div>
                           <div className="p-4 space-y-3">
                               {g.map((t:any, j:number) => (
                                   <div key={j} className="flex items-center gap-3 bg-slate-900 border border-slate-700/50 p-2.5 rounded-lg">
                                       <span className="text-slate-500 font-black w-4 text-center">{j+1}</span>
                                       <img src={t.logo||FALLBACK_IMG} className="w-10 h-10 object-contain bg-white rounded-full p-1 shadow-sm"/>
                                       <div className="flex-1 min-w-0">
                                           <div className="text-white font-bold text-sm truncate">{t.name}</div>
                                           <div className="text-[10px] text-slate-400 font-bold">{t.assignedPlayer.nickname}</div>
                                       </div>
                                       <span className={`text-[10px] px-2 py-0.5 rounded font-black shadow-sm ${t.tier==='S'?'bg-emerald-500 text-black':t.tier==='A'?'bg-yellow-500 text-black':'bg-slate-700 text-white'}`}>{t.tier}</span>
                                   </div>
                               ))}
                           </div>
                       </div>
                   ))}
               </div>
               <div className="mt-10 text-center">
                   <button onClick={onBack} className="bg-slate-800 text-slate-400 hover:text-white px-8 py-3.5 rounded-xl font-bold transition-colors border border-slate-700">← 카드 뷰로 돌아가기</button>
               </div>
            </div>
        );
    }
};

// =============================================================================
// SUB-COMPONENT: PackOpeningAnimation (오리지널 랜덤 5종 애니메이션 완벽 복원)
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