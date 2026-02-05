import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Owner, MasterTeam, Team, FALLBACK_IMG } from '../types';

interface QuickDraftModalProps {
    isOpen: boolean;
    onClose: () => void;
    owners: Owner[];
    masterTeams: MasterTeam[];
    onConfirm: (teams: Team[]) => void;
}

type Step = 'SETTINGS' | 'OPENING' | 'RESULT';

export const QuickDraftModal = ({ isOpen, onClose, owners, masterTeams, onConfirm }: QuickDraftModalProps) => {
    const [step, setStep] = useState<Step>('SETTINGS');
    
    // --- 설정 상태 ---
    const [selectedOwnerIds, setSelectedOwnerIds] = useState<number[]>([]);
    const [teamsPerOwner, setTeamsPerOwner] = useState<number>(2);
    
    // --- 필터 상태 ---
    const [filterCategory, setFilterCategory] = useState<string[]>(['ALL']); // 기본 ALL
    const [filterTiers, setFilterTiers] = useState<string[]>(['S', 'A']); // 기본 S, A
    
    // --- 결과 상태 ---
    const [draftResults, setDraftResults] = useState<Team[]>([]);
    const [filteredCount, setFilteredCount] = useState(0);

    useEffect(() => {
        if (isOpen) {
            setStep('SETTINGS');
            setSelectedOwnerIds(owners.map(o => o.id));
            setDraftResults([]);
            setFilterCategory(['ALL']); // 리셋 시 ALL
        }
    }, [isOpen, owners]);

    useEffect(() => {
        const count = getFilteredTeams().length;
        setFilteredCount(count);
    }, [filterCategory, filterTiers, masterTeams]);

    const getFilteredTeams = () => {
        return masterTeams.filter(t => {
            // ALL이 포함되어 있지 않으면 해당 조건만 체크
            if (!filterCategory.includes('ALL') && !filterCategory.includes(t.category)) return false;
            // Tier는 ALL이 포함되어 있으면 전체 허용, 아니면 선택된 것만
            if (!filterTiers.includes('ALL') && !filterTiers.includes(t.tier)) return false;
            return true;
        });
    };

    const handleStartDraft = () => {
        const targetPool = getFilteredTeams();
        const totalNeeded = selectedOwnerIds.length * teamsPerOwner;

        if (targetPool.length < totalNeeded) {
            alert(`팀이 부족합니다! (필요: ${totalNeeded}, 가능: ${targetPool.length})\n조건을 완화해주세요.`);
            return;
        }

        const shuffled = [...targetPool].sort(() => Math.random() - 0.5);
        const selectedTeams = shuffled.slice(0, totalNeeded);
        
        const results: Team[] = [];
        let teamIdx = 0;

        selectedOwnerIds.forEach(ownerId => {
            const owner = owners.find(o => o.id === ownerId);
            if (!owner) return;

            for (let i = 0; i < teamsPerOwner; i++) {
                const mt = selectedTeams[teamIdx];
                results.push({
                    id: Date.now() + teamIdx,
                    seasonId: 0,
                    name: mt.name,
                    logo: mt.logo,
                    ownerName: owner.nickname,
                    region: mt.region,
                    tier: mt.tier,
                    win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0
                });
                teamIdx++;
            }
        });

        // 결과 섞기
        setDraftResults(results.sort(() => Math.random() - 0.5));
        setStep('OPENING');
    };

    const handlePackOpened = () => {
        setTimeout(() => {
            setStep('RESULT');
        }, 2000); // 연출 시간 2초
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl transition-colors duration-500 border border-slate-700
                    ${step === 'OPENING' ? 'bg-black border-none' : 'bg-slate-900'}
                `}
            >
                {/* 헤더 */}
                {step !== 'OPENING' && (
                    <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                        <h2 className="text-2xl font-black italic text-white flex items-center gap-3 tracking-tighter">
                            <span className="text-emerald-400 text-3xl drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]">⚡</span> 
                            QUICK TEAM DRAFT
                        </h2>
                        <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors">✕</button>
                    </div>
                )}

                {/* 컨텐츠 영역 */}
                <div className={`relative ${step === 'OPENING' ? 'h-[80vh] flex items-center justify-center' : 'p-8 min-h-[60vh]'}`}>
                    
                    {step === 'SETTINGS' && (
                        <DraftSettings 
                            owners={owners}
                            selectedOwnerIds={selectedOwnerIds}
                            setSelectedOwnerIds={setSelectedOwnerIds}
                            teamsPerOwner={teamsPerOwner}
                            setTeamsPerOwner={setTeamsPerOwner}
                            filterCategory={filterCategory}
                            setFilterCategory={setFilterCategory}
                            filterTiers={filterTiers}
                            setFilterTiers={setFilterTiers}
                            filteredCount={filteredCount}
                            totalNeeded={selectedOwnerIds.length * teamsPerOwner}
                            onStart={handleStartDraft}
                        />
                    )}

                    {step === 'OPENING' && (
                        <PackOpeningAnimation 
                            onOpen={handlePackOpened} 
                            cardCount={draftResults.length} 
                        />
                    )}

                    {step === 'RESULT' && (
                        <DraftResultView 
                            results={draftResults} 
                            owners={owners} 
                            onRetry={() => setStep('SETTINGS')}
                            onConfirm={() => { onConfirm(draftResults); onClose(); }}
                        />
                    )}
                </div>
            </motion.div>
        </div>
    );
};

// =============================================================================
// STEP 1: 설정 화면 (레이아웃 개선)
// =============================================================================
const DraftSettings = ({ 
    owners, selectedOwnerIds, setSelectedOwnerIds, 
    teamsPerOwner, setTeamsPerOwner,
    filterCategory, setFilterCategory,
    filterTiers, setFilterTiers,
    filteredCount, totalNeeded, onStart
}: any) => {
    
    const toggleSelection = (id: number, current: number[], setFn: any) => {
        if (current.includes(id)) setFn(current.filter(i => i !== id));
        else setFn([...current, id]);
    };

    // 필터 토글 로직 (ALL 포함)
    const toggleFilterWithAll = (val: string, current: string[], setFn: any) => {
        if (val === 'ALL') {
            setFn(['ALL']);
            return;
        }
        
        let next = [...current];
        if (next.includes('ALL')) {
            next = []; // ALL 상태에서 다른거 누르면 ALL 해제
        }

        if (next.includes(val)) next = next.filter(v => v !== val);
        else next = [...next, val];

        if (next.length === 0) setFn(['ALL']); // 다 해제하면 자동으로 ALL
        else setFn(next);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 1. 오너 선택 */}
            <div className="space-y-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider pl-1">1. Select Owners</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {owners.map((o: Owner) => (
                        <div 
                            key={o.id}
                            onClick={() => toggleSelection(o.id, selectedOwnerIds, setSelectedOwnerIds)}
                            className={`cursor-pointer p-3 rounded-2xl border flex items-center gap-3 transition-all transform active:scale-95 ${
                                selectedOwnerIds.includes(o.id) 
                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                                : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'
                            }`}
                        >
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedOwnerIds.includes(o.id) ? 'border-white' : 'border-slate-500'}`}>
                                {selectedOwnerIds.includes(o.id) && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                            <span className="font-bold text-sm truncate">{o.nickname}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* 2. 팀 수 설정 */}
                <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider pl-1">2. Teams per Owner</label>
                    <div className="flex items-center justify-between bg-slate-800 p-2 rounded-2xl border border-slate-700 h-[64px]">
                        <button onClick={() => setTeamsPerOwner(Math.max(1, teamsPerOwner - 1))} className="w-12 h-full rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-2xl transition-colors">-</button>
                        <div className="flex flex-col items-center">
                            <span className="text-2xl font-black text-white italic">{teamsPerOwner}</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase">Teams Each</span>
                        </div>
                        <button onClick={() => setTeamsPerOwner(Math.min(5, teamsPerOwner + 1))} className="w-12 h-full rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-2xl transition-colors">+</button>
                    </div>
                </div>

                {/* 3. 팀 필터 (요청사항 1번 반영) */}
                <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider pl-1">3. Filter Options</label>
                    <div className="bg-slate-800 p-3 rounded-2xl border border-slate-700 space-y-3">
                        
                        {/* 상단: 유형 (ALL / Club / National) */}
                        <div className="flex gap-2">
                            {['ALL', 'CLUB', 'NATIONAL'].map(cat => (
                                <button key={cat} onClick={() => toggleFilterWithAll(cat, filterCategory, setFilterCategory)}
                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-wider uppercase border transition-all ${
                                        filterCategory.includes(cat) 
                                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                                        : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-white'
                                    }`}
                                >{cat}</button>
                            ))}
                        </div>

                        {/* 하단: 티어 (ALL / S / A / B / C) */}
                        <div className="flex gap-2">
                            {['ALL', 'S', 'A', 'B', 'C'].map(tier => (
                                <button key={tier} onClick={() => toggleFilterWithAll(tier, filterTiers, setFilterTiers)}
                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-wider uppercase border transition-all ${
                                        filterTiers.includes(tier) 
                                        ? 'bg-sky-600 border-sky-500 text-white shadow-md shadow-sky-500/20' 
                                        : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-white'
                                    }`}
                                >{tier === 'ALL' ? 'ALL' : tier}</button>
                            ))}
                        </div>

                        {/* 상태 표시 */}
                        <div className="pt-2 border-t border-slate-700 text-xs flex justify-between items-center">
                            <span className="text-slate-500">Need: <strong className="text-white">{totalNeeded}</strong></span>
                            <span className={`font-bold ${filteredCount >= totalNeeded ? 'text-emerald-400' : 'text-red-400'}`}>Available: {filteredCount} Teams</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 실행 버튼 */}
            <button 
                onClick={onStart}
                disabled={filteredCount < totalNeeded || selectedOwnerIds.length === 0}
                className="w-full py-5 bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 disabled:opacity-50 disabled:grayscale text-white font-black italic text-xl tracking-tighter uppercase rounded-2xl shadow-[0_10px_30px_rgba(6,182,212,0.3)] transition-all transform hover:scale-[1.01] active:scale-[0.98] border border-white/20"
            >
                {filteredCount < totalNeeded ? "Not Enough Teams!" : "⚡ Open The Packs ⚡"}
            </button>
        </div>
    );
};

// =============================================================================
// STEP 2: 오프닝 연출 (회전 & 펄스) - 요청사항 2번 반영
// =============================================================================
const PackOpeningAnimation = ({ onOpen, cardCount }: { onOpen: () => void, cardCount: number }) => {
    const [phase, setPhase] = useState<'IDLE' | 'CHARGING' | 'EXPLODING' | 'DEALING'>('IDLE');

    const handleClick = () => {
        if (phase !== 'IDLE') return;
        setPhase('CHARGING');
        
        // 1. 차징 (에너지 모으기)
        setTimeout(() => {
            setPhase('EXPLODING');
        }, 800);

        // 2. 폭발 후 딜링
        setTimeout(() => {
            setPhase('DEALING');
            onOpen();
        }, 1200);
    };

    return (
        <div className="relative w-full h-full flex items-center justify-center perspective-[1000px]">
            {/* 암전 효과 */}
            {phase !== 'IDLE' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black z-0 pointer-events-none" />
            )}

            {/* 메인 팩 컨테이너 */}
            <div className="relative flex items-center justify-center">
                
                {/* 🔥 배경 회전 카드들 (Spirit Bomb 효과) */}
                <AnimatePresence>
                    {(phase === 'CHARGING' || phase === 'EXPLODING') && (
                        <motion.div 
                            initial={{ scale: 0, opacity: 0, rotate: 0 }}
                            animate={{ scale: 1.5, opacity: 1, rotate: 360 }}
                            exit={{ scale: 3, opacity: 0 }}
                            transition={{ duration: 1, ease: "easeInOut" }}
                            className="absolute z-0 w-[500px] h-[500px] rounded-full border-2 border-emerald-500/30 flex items-center justify-center"
                        >
                             {/* 회전하는 카드 잔상들 */}
                             {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="absolute w-16 h-24 bg-gradient-to-t from-emerald-500 to-sky-500 opacity-50 rounded" 
                                    style={{ transform: `rotate(${i * 45}deg) translate(0, -180px)` }} 
                                />
                             ))}
                             {/* 네온 링 */}
                             <div className="absolute inset-0 border-4 border-sky-400/50 rounded-full animate-ping" />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 메인 팩 */}
                <AnimatePresence>
                    {phase !== 'DEALING' && (
                        <motion.div
                            layoutId="pack"
                            onClick={handleClick}
                            initial={{ scale: 0.8 }}
                            animate={phase === 'CHARGING' 
                                ? { scale: 0.9, rotate: [0, -2, 2, 0], filter: "brightness(1.5)" } 
                                : phase === 'EXPLODING' 
                                ? { scale: [1, 1.5, 0], opacity: 0 } 
                                : { scale: 1, y: [0, -10, 0] }
                            }
                            transition={{ 
                                y: { repeat: Infinity, duration: 2 },
                                default: { duration: 0.3 }
                            }}
                            className={`relative z-10 cursor-pointer ${phase !== 'IDLE' ? 'pointer-events-none' : ''}`}
                        >
                            <div className="w-56 h-80 bg-gradient-to-br from-emerald-400 via-sky-500 to-indigo-600 rounded-2xl border-4 border-white/20 shadow-[0_0_80px_rgba(6,182,212,0.5)] flex items-center justify-center relative overflow-hidden group">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
                                <div className="text-center z-10">
                                    <div className="text-7xl mb-4 drop-shadow-md animate-pulse">⚡</div>
                                    <div className="font-black text-white text-3xl italic tracking-tighter leading-none drop-shadow-lg">PREMIUM<br/>PACK</div>
                                </div>
                                {phase === 'IDLE' && (
                                    <div className="absolute bottom-6 left-0 right-0 text-center">
                                        <p className="text-sky-900 font-bold text-xs animate-bounce bg-white/80 py-1 px-3 rounded-full inline-block">CLICK TO OPEN</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 폭발 섬광 */}
                {phase === 'EXPLODING' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.4 }} className="fixed inset-0 bg-white z-50 pointer-events-none" />
                )}
            </div>

            {/* 카드 딜링 (화면 밖으로 날아감) */}
            {phase === 'DEALING' && (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                    {Array.from({ length: cardCount }).map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ scale: 0, x: 0, y: 0 }}
                            animate={{ 
                                scale: [0, 1, 0.5], 
                                x: [0, (Math.random() - 0.5) * 1200], 
                                y: [0, (Math.random() - 0.5) * 1000],
                                rotate: Math.random() * 720 
                            }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.03 }}
                            className="absolute w-32 h-48 bg-gradient-to-br from-slate-800 to-black border border-slate-600 rounded-xl shadow-xl"
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// =============================================================================
// STEP 3: 결과 화면 (디자인 정제) - 요청사항 3번 반영
// =============================================================================
const DraftResultView = ({ results, owners, onRetry, onConfirm }: any) => {
    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 overflow-y-auto p-4 custom-scrollbar content-start">
                {results.map((team: Team, idx: number) => {
                    const owner = owners.find((o: Owner) => o.nickname === team.ownerName);
                    
                    return (
                        <motion.div 
                            key={team.id}
                            initial={{ scale: 3, opacity: 0, y: -100 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            transition={{ 
                                type: "spring", stiffness: 400, damping: 20, // 쿵! 찍히는 타격감
                                delay: 0.5 + (idx * 0.15) 
                            }}
                            className={`relative overflow-hidden rounded-[1.5rem] bg-slate-800 shadow-2xl flex flex-col items-center
                                ${team.tier === 'S' ? 'shadow-[0_0_40px_rgba(250,204,21,0.2)]' : 'shadow-lg'}
                            `}
                        >
                            {/* 1. 상단: 오너 & 티어 (심플하게) */}
                            <div className="w-full flex justify-between items-center p-3 z-10 bg-black/20">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full border border-slate-500 overflow-hidden bg-slate-900">
                                        {owner?.photo ? <img src={owner.photo} alt="" className="w-full h-full object-cover"/> : <div className="text-[9px] h-full flex items-center justify-center">👤</div>}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-300 truncate max-w-[60px]">{team.ownerName}</span>
                                </div>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black italic ${team.tier === 'S' ? 'bg-yellow-400 text-black' : 'bg-slate-700 text-slate-300'}`}>
                                    {team.tier}
                                </span>
                            </div>

                            {/* 2. 중앙: 엠블럼 (사이즈 축소 및 깔끔한 배치) */}
                            <div className="flex-1 w-full flex items-center justify-center py-4 relative bg-gradient-to-b from-transparent to-black/30">
                                {team.tier === 'S' && <div className="absolute inset-0 bg-yellow-400/5 animate-pulse" />}
                                
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center p-2 shadow-lg ring-4 ring-white/10">
                                    <img src={team.logo} alt={team.name} className="w-full h-full object-contain" />
                                </div>
                            </div>

                            {/* 3. 하단: 팀명 (프레임 제거, 텍스트 강조) */}
                            <div className="w-full text-center pb-4 pt-1 px-2 z-10">
                                <div className="font-black italic text-white text-sm leading-tight uppercase truncate drop-shadow-md">{team.name}</div>
                                <div className="text-[9px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider">{team.region}</div>
                            </div>

                            {/* 바닥 먼지 효과 */}
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-white/10 blur-xl rounded-full opacity-0 animate-[dust_0.4s_ease-out_forwards]" style={{ animationDelay: `${0.5 + idx * 0.15}s` }}></div>
                        </motion.div>
                    );
                })}
            </div>

            {/* 버튼 밸런스 조정 */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800 mt-auto bg-slate-900 z-20">
                <button 
                    onClick={onRetry}
                    className="py-4 rounded-xl bg-slate-800 text-slate-400 font-bold hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
                >
                    🔄 Re-Try
                </button>
                <button 
                    onClick={onConfirm}
                    className="py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-black italic text-lg hover:from-emerald-400 hover:to-sky-400 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all transform hover:scale-[1.02]"
                >
                    💾 SAVE
                </button>
            </div>

            <style jsx>{`
                @keyframes dust {
                    0% { opacity: 0; transform: translate(-50%, 10px) scale(0.5); }
                    50% { opacity: 1; transform: translate(-50%, -5px) scale(1.2); }
                    100% { opacity: 0; transform: translate(-50%, -15px) scale(1.5); }
                }
            `}</style>
        </div>
    );
};