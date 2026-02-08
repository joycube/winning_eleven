import React, { useState, useEffect, useRef } from 'react';
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
    // 다이얼로그 제어용 Ref
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [mounted, setMounted] = useState(false);
    
    // SSR 방지
    useEffect(() => setMounted(true), []);

    const [step, setStep] = useState<Step>('SETTINGS');
    const [selectedOwnerIds, setSelectedOwnerIds] = useState<number[]>([]);
    const [teamsPerOwner, setTeamsPerOwner] = useState<number>(2);
    const [filterCategory, setFilterCategory] = useState<string[]>(['ALL']); 
    const [filterTiers, setFilterTiers] = useState<string[]>(['S', 'A']); 
    const [draftResults, setDraftResults] = useState<Team[]>([]);
    const [filteredCount, setFilteredCount] = useState(0);

    // isOpen 상태에 따라 진짜 모달(showModal)을 열고 닫음
    useEffect(() => {
        if (!mounted) return;
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (isOpen) {
            dialog.showModal();
            document.body.style.overflow = 'hidden';
            setStep('SETTINGS');
            setSelectedOwnerIds(owners.map(o => o.id));
            setDraftResults([]);
            setFilterCategory(['ALL']);
        } else {
            dialog.close();
            document.body.style.overflow = 'unset';
        }
        
        const handleCancel = (e: Event) => {
            e.preventDefault();
            onClose();
        };
        dialog.addEventListener('cancel', handleCancel);
        return () => {
            dialog.removeEventListener('cancel', handleCancel);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, mounted, owners, onClose]);

    // 필터링된 팀 카운트 계산
    useEffect(() => {
        const count = masterTeams.filter(t => {
            if (!filterCategory.includes('ALL') && !filterCategory.includes(t.category)) return false;
            if (!filterTiers.includes('ALL') && !filterTiers.includes(t.tier)) return false;
            return true;
        }).length;
        setFilteredCount(count);
    }, [filterCategory, filterTiers, masterTeams]);

    // 드래프트 시작 로직
    const handleStartDraft = () => {
        const targetPool = masterTeams.filter(t => {
            if (!filterCategory.includes('ALL') && !filterCategory.includes(t.category)) return false;
            if (!filterTiers.includes('ALL') && !filterTiers.includes(t.tier)) return false;
            return true;
        });
        const totalNeeded = selectedOwnerIds.length * teamsPerOwner;
        if (targetPool.length < totalNeeded) return alert("팀이 부족합니다!");

        const shuffled = [...targetPool].sort(() => Math.random() - 0.5).slice(0, totalNeeded);
        const results: Team[] = [];
        let teamIdx = 0;

        selectedOwnerIds.forEach(ownerId => {
            const owner = owners.find(o => o.id === ownerId);
            if (!owner) return;
            for (let i = 0; i < teamsPerOwner; i++) {
                results.push({
                    ...shuffled[teamIdx],
                    id: Date.now() + teamIdx,
                    seasonId: 0,
                    ownerName: owner.nickname,
                    win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0
                } as Team);
                teamIdx++;
            }
        });
        setDraftResults(results.sort(() => Math.random() - 0.5));
        setStep('OPENING');
    };

    if (!mounted) return null;

    return (
        <dialog 
            ref={dialogRef}
            className="bg-transparent p-0 m-0 w-screen h-screen max-w-none max-h-none border-none backdrop:bg-black/95 backdrop:backdrop-blur-xl"
            style={{ zIndex: 99999 }}
        >
            {/* 전체 화면 애니메이션 오버레이 (OPENING 단계) */}
            {isOpen && step === 'OPENING' && (
                <PackOpeningAnimation onOpen={() => setTimeout(() => setStep('RESULT'), 2500)} cardCount={draftResults.length} />
            )}

            {/* 기본 모달 (OPENING 아닐 때) */}
            {isOpen && step !== 'OPENING' && (
                <div className="w-full h-[100dvh] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={`w-full max-w-6xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl transition-colors duration-500 border border-slate-700 overflow-hidden bg-slate-900`}
                    >
                        <div className="flex-none p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                            <h2 className="text-xl md:text-2xl font-black italic text-white flex items-center gap-2 md:gap-3 tracking-tighter">
                                <span className="text-emerald-400 text-2xl md:text-3xl drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]">⚡</span> QUICK DRAFT
                            </h2>
                            <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold border border-slate-600 cursor-pointer">✕</button>
                        </div>
                        
                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative flex flex-col pb-8 md:pb-0">
                            {step === 'SETTINGS' && (
                                <div className="flex-1 flex flex-col p-5 md:p-8">
                                    <DraftSettings owners={owners} selectedOwnerIds={selectedOwnerIds} setSelectedOwnerIds={setSelectedOwnerIds} teamsPerOwner={teamsPerOwner} setTeamsPerOwner={setTeamsPerOwner} filterCategory={filterCategory} setFilterCategory={setFilterCategory} filterTiers={filterTiers} setFilterTiers={setFilterTiers} filteredCount={filteredCount} totalNeeded={selectedOwnerIds.length * teamsPerOwner} onStart={handleStartDraft} />
                                </div>
                            )}
                            {step === 'RESULT' && (
                                <DraftResultView results={draftResults} owners={owners} onRetry={() => setStep('SETTINGS')} onConfirm={() => { onConfirm(draftResults); onClose(); }} />
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </dialog>
    );
};

// =============================================================================
// SUB-COMPONENT: DraftSettings (설정 화면)
// =============================================================================
const DraftSettings = ({ owners, selectedOwnerIds, setSelectedOwnerIds, teamsPerOwner, setTeamsPerOwner, filterCategory, setFilterCategory, filterTiers, setFilterTiers, filteredCount, totalNeeded, onStart }: any) => {
    const toggleSelection = (id: number, current: number[], setFn: any) => {
        if (current.includes(id)) setFn(current.filter(i => i !== id));
        else setFn([...current, id]);
    };
    const toggleFilterWithAll = (val: string, current: string[], setFn: any) => {
        if (val === 'ALL') { setFn(['ALL']); return; }
        let next = [...current];
        if (next.includes('ALL')) next = [];
        if (next.includes(val)) next = next.filter(v => v !== val); else next = [...next, val];
        if (next.length === 0) setFn(['ALL']); else setFn(next);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-4 flex-1 flex flex-col">
            <div className="space-y-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider pl-1">1. Select Owners</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {owners.map((o: Owner) => (
                        <div key={o.id} onClick={() => toggleSelection(o.id, selectedOwnerIds, setSelectedOwnerIds)} className={`cursor-pointer p-3 rounded-2xl border flex items-center gap-3 transition-all transform active:scale-95 ${selectedOwnerIds.includes(o.id) ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedOwnerIds.includes(o.id) ? 'border-white' : 'border-slate-500'}`}>{selectedOwnerIds.includes(o.id) && <div className="w-2 h-2 bg-white rounded-full" />}</div>
                            <span className="font-bold text-sm truncate">{o.nickname}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-2"><label className="text-xs text-slate-400 font-bold uppercase tracking-wider pl-1">2. Teams per Owner</label><div className="flex items-center justify-between bg-slate-800 p-2 rounded-2xl border border-slate-700 h-[64px]"><button onClick={() => setTeamsPerOwner(Math.max(1, teamsPerOwner - 1))} className="w-12 h-full rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-2xl transition-colors">-</button><div className="flex flex-col items-center"><span className="text-2xl font-black text-white italic">{teamsPerOwner}</span><span className="text-[9px] text-slate-400 font-bold uppercase">Teams Each</span></div><button onClick={() => setTeamsPerOwner(Math.min(5, teamsPerOwner + 1))} className="w-12 h-full rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-2xl transition-colors">+</button></div></div>
                <div className="space-y-2"><label className="text-xs text-slate-400 font-bold uppercase tracking-wider pl-1">3. Filter Options</label><div className="bg-slate-800 p-3 rounded-2xl border border-slate-700 space-y-3"><div className="flex gap-2">{['ALL', 'CLUB', 'NATIONAL'].map(cat => (<button key={cat} onClick={() => toggleFilterWithAll(cat, filterCategory, setFilterCategory)} className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-wider uppercase border transition-all ${filterCategory.includes(cat) ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-white'}`}>{cat}</button>))}</div><div className="flex gap-2">{['ALL', 'S', 'A', 'B', 'C'].map(tier => (<button key={tier} onClick={() => toggleFilterWithAll(tier, filterTiers, setFilterTiers)} className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-wider uppercase border transition-all ${filterTiers.includes(tier) ? 'bg-sky-600 border-sky-500 text-white shadow-md shadow-sky-500/20' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-white'}`}>{tier === 'ALL' ? 'ALL' : tier}</button>))}</div><div className="pt-2 border-t border-slate-700 text-xs flex justify-between items-center"><span className="text-slate-500">Need: <strong className="text-white">{totalNeeded}</strong></span><span className={`font-bold ${filteredCount >= totalNeeded ? 'text-emerald-400' : 'text-red-400'}`}>Available: {filteredCount} Teams</span></div></div></div>
            </div>
            
            <div className="flex-1 min-h-[20px]"></div>

            <button 
                onClick={onStart} 
                disabled={filteredCount < totalNeeded || selectedOwnerIds.length === 0} 
                className="w-full py-5 bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 disabled:opacity-50 disabled:grayscale !text-white font-black italic text-xl tracking-tighter uppercase rounded-2xl shadow-[0_10px_30px_rgba(6,182,212,0.3)] transition-all transform hover:scale-[1.01] active:scale-[0.98] border border-white/20 relative z-10"
                style={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }} 
            >
                {filteredCount < totalNeeded ? "Not Enough Teams!" : "⚡ Open The Packs ⚡"}
            </button>
        </div>
    );
};

// =============================================================================
// SUB-COMPONENT: PackOpeningAnimation (애니메이션 핵심)
// =============================================================================
const PackOpeningAnimation = ({ onOpen, cardCount }: { onOpen: () => void, cardCount: number }) => {
    // Phase: IDLE -> CHARGING -> CONTRACTING -> EXPLODING -> DEALING
    const [phase, setPhase] = useState<'IDLE' | 'CHARGING' | 'CONTRACTING' | 'EXPLODING' | 'DEALING'>('IDLE');

    const handleClick = () => { 
        if (phase !== 'IDLE') return; 
        
        // 1. 에너지 충전 (진동 시작)
        setPhase('CHARGING'); 
        
        // 2. 수축 (형광 번개 효과)
        setTimeout(() => setPhase('CONTRACTING'), 800); 
        
        // 3. 메인 컬러 폭발
        setTimeout(() => setPhase('EXPLODING'), 1200); 
        
        // 4. 카드 롤링 연출 (텍스트 대신)
        setTimeout(() => { 
            setPhase('DEALING'); 
            onOpen(); 
        }, 1600); 
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center overflow-hidden">
            <style jsx>{`
                @keyframes shake {
                    0% { transform: translate(1px, 1px) rotate(0deg); }
                    10% { transform: translate(-1px, -2px) rotate(-1deg); }
                    20% { transform: translate(-3px, 0px) rotate(1deg); }
                    30% { transform: translate(3px, 2px) rotate(0deg); }
                    40% { transform: translate(1px, -1px) rotate(1deg); }
                    50% { transform: translate(-1px, 2px) rotate(-1deg); }
                    60% { transform: translate(-3px, 1px) rotate(0deg); }
                    70% { transform: translate(3px, 1px) rotate(-1deg); }
                    80% { transform: translate(-1px, -1px) rotate(1deg); }
                    90% { transform: translate(1px, 2px) rotate(0deg); }
                    100% { transform: translate(1px, -2px) rotate(-1deg); }
                }
                .shake-hard { animation: shake 0.1s infinite; }
                
                @keyframes electric-pulse {
                    0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7); }
                    50% { box-shadow: 0 0 50px 20px rgba(14, 165, 233, 0.7); }
                    100% { box-shadow: 0 0 100px 50px rgba(52, 211, 153, 0); }
                }
                .electric-aura { animation: electric-pulse 0.3s infinite alternate; }
            `}</style>

            {/* 배경 효과 */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-black to-black opacity-80" />

            {/* 카드 팩 */}
            <AnimatePresence>
                {phase !== 'DEALING' && (
                    <motion.div 
                        layoutId="pack" 
                        onClick={handleClick}
                        animate={
                            phase === 'CHARGING' ? { 
                                scale: [1, 1.05, 0.98, 1.02], 
                                filter: "brightness(1.5)",
                                y: [0, -5, 5, 0]
                            } : 
                            phase === 'CONTRACTING' ? { 
                                scale: 0.2, // 더 강력하게 수축
                                opacity: 1,
                                rotate: [0, 10, -10, 0], // 수축하며 비틀기
                                filter: "brightness(3) contrast(2)",
                                transition: { duration: 0.4, ease: "backIn" }
                            } :
                            phase === 'EXPLODING' ? { 
                                scale: 30, // 화면 전체 덮음
                                opacity: 0, 
                                filter: "brightness(5) blur(20px)",
                                transition: { duration: 0.4, ease: "easeOut" }
                            } : 
                            { scale: 1, y: [0, -10, 0] }
                        }
                        transition={
                            phase === 'IDLE' ? { y: { repeat: Infinity, duration: 2 } } : 
                            phase === 'CHARGING' ? { duration: 0.1, repeat: Infinity } : 
                            {}
                        }
                        className={`relative z-10 cursor-pointer ${phase !== 'IDLE' ? 'pointer-events-none' : ''} ${phase === 'CHARGING' ? 'shake-hard' : ''}`}
                    >
                        {/* 수축 시 형광 전기 오라 효과 */}
                        {phase === 'CONTRACTING' && (
                            <div className="absolute inset-0 -m-10 rounded-full electric-aura bg-white/20 blur-xl z-0" />
                        )}

                        <div className="w-64 h-96 md:w-80 md:h-[480px] bg-gradient-to-br from-emerald-400 via-sky-500 to-indigo-600 rounded-3xl border-4 border-white/30 shadow-[0_0_80px_rgba(6,182,212,0.5)] flex items-center justify-center relative overflow-hidden group z-10">
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30 mix-blend-overlay"></div>
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent skew-x-12 translate-x-[-100%] group-hover:animate-[shimmer_2s_infinite]"></div>

                            <div className="text-center z-10 scale-110">
                                <div className={`text-8xl mb-6 drop-shadow-md ${phase === 'CHARGING' ? 'text-white' : 'animate-pulse'}`}>⚡</div>
                                <div className="font-black text-white text-4xl italic tracking-tighter leading-none drop-shadow-lg">
                                    PREMIUM<br/>PACK
                                </div>
                            </div>
                            
                            {phase === 'IDLE' && (
                                <div className="absolute bottom-8 left-0 right-0 text-center">
                                    <p className="text-sky-900 font-bold text-sm animate-bounce bg-white/90 py-1.5 px-4 rounded-full inline-block shadow-lg">CLICK TO OPEN</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 터질 때 메인 컬러(형광) 그라데이션 폭발 */}
            {phase === 'EXPLODING' && (
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: [0, 1, 0] }} 
                    transition={{ duration: 0.6, times: [0, 0.1, 1] }} 
                    className="fixed inset-0 bg-gradient-to-br from-emerald-400 via-white to-sky-500 z-[100000] pointer-events-none mix-blend-screen" 
                />
            )}

            {/* 🔥 [수정됨] 속도 2.0으로 4배 느리게 조정 */}
            {phase === 'DEALING' && (
                <div className="absolute inset-0 flex items-center bg-black/80 z-20 overflow-hidden">
                    <motion.div 
                        initial={{ x: "0%" }}
                        animate={{ x: "-50%" }}
                        transition={{ duration: 2.0, ease: "linear", repeat: Infinity }} // 속도 조절: 0.5 -> 2.0
                        className="flex gap-6 pl-6 min-w-max blur-[1px]"
                    >
                        {Array.from({ length: 24 }).map((_, i) => (
                            <div key={i} className="w-48 h-72 shrink-0 bg-gradient-to-br from-emerald-400 via-sky-500 to-indigo-600 rounded-xl border-2 border-white/30 shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center relative overflow-hidden">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30 mix-blend-overlay"></div>
                                <div className="text-center z-10">
                                    <div className="text-5xl mb-2 drop-shadow-md text-white/90">⚡</div>
                                    <div className="font-black text-white text-lg italic tracking-tighter leading-none drop-shadow-lg opacity-80">
                                        PREMIUM<br/>PACK
                                    </div>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                </div>
            )}
        </div>
    );
};

// =============================================================================
// SUB-COMPONENT: DraftResultView (결과 화면)
// =============================================================================
const DraftResultView = ({ results, owners, onRetry, onConfirm }: any) => {
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    const handleFlip = (index: number) => { if (!flippedIndices.includes(index)) setFlippedIndices(prev => [...prev, index]); };
    const handleFlipAll = () => setFlippedIndices(results.map((_: any, i: number) => i));

    const backStyles = ["bg-blue-950", "bg-slate-900", "bg-emerald-950", "bg-indigo-950"];

    return (
        <div className="flex flex-col h-full overflow-hidden">
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
            <div className="flex-none p-2 flex justify-end"><button onClick={handleFlipAll} className="text-xs text-slate-400 hover:text-white underline">Flip All</button></div>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-20">
                    {results.map((team: Team, idx: number) => {
                        const owner = owners.find((o: Owner) => o.nickname === team.ownerName);
                        const isFlipped = flippedIndices.includes(idx);
                        const backBg = backStyles[idx % 4];

                        return (
                            <div key={team.id} className="relative h-72 perspective-1000 cursor-pointer group" onClick={() => handleFlip(idx)}>
                                <div className={`w-full h-full relative rounded-2xl ${team.tier === 'S' ? 'tier-s-anim' : team.tier === 'A' ? 'tier-a-anim' : ''}`}>
                                    <motion.div animate={{ rotateY: isFlipped ? 180 : 0 }} transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }} className="w-full h-full preserve-3d absolute inset-0 rounded-2xl">
                                        {/* BACK */}
                                        <div className={`absolute inset-0 w-full h-full rounded-2xl backface-hidden ${backBg} border-2 border-slate-600 shadow-2xl flex flex-col items-center justify-center p-4 z-20`}>
                                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30 mix-blend-overlay bg-repeat"></div>
                                            <div className="w-16 h-16 rounded-full border-4 border-white/10 flex items-center justify-center mb-3 bg-black/30 backdrop-blur-sm relative z-10"><span className="text-3xl grayscale opacity-70">⚽</span></div>
                                            <div className="text-center relative z-10"><p className="text-slate-300 text-[10px] tracking-[0.2em] font-bold mb-1">OFFICIAL</p><h3 className="text-white font-black italic text-xl leading-tight drop-shadow-md">eFOOTBALL<br/>TEAM 2026</h3></div>
                                        </div>

                                        {/* FRONT */}
                                        <div className="absolute inset-0 w-full h-full rounded-2xl bg-slate-900 border-2 border-slate-600 flex flex-col overflow-hidden shadow-inner" style={{ transform: "rotateY(180deg)", zIndex: isFlipped ? 30 : 0 }}>
                                            {team.tier === 'S' && <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/60 via-blue-900/20 to-transparent z-0 animate-pulse"></div>}
                                            {team.tier === 'A' && <div className="absolute inset-0 bg-gradient-to-t from-yellow-900/40 via-orange-900/10 to-transparent z-0"></div>}
                                            
                                            <div className="h-14 flex items-center px-4 border-b border-white/10 bg-black/40 z-10 backdrop-blur-sm">
                                                <div className="w-9 h-9 rounded-full border-2 border-slate-400 overflow-hidden mr-3 bg-slate-800 shrink-0">
                                                    {owner?.photo ? <img src={owner.photo} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-[10px]">👤</div>}
                                                </div>
                                                <div className="flex flex-col"><span className="text-[9px] text-slate-400 uppercase font-bold">Owner</span><span className="text-sm font-bold text-white truncate">{team.ownerName}</span></div>
                                            </div>

                                            <div className="flex-1 flex flex-col items-center justify-center p-2 relative z-10">
                                                <div className="w-24 h-24 relative mb-3 filter drop-shadow-2xl bg-white rounded-full flex items-center justify-center">
                                                    <img src={team.logo} className="w-16 h-16 object-contain" alt={team.name} onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                                                </div>
                                                <div className="text-center w-full px-2"><div className="font-black italic text-white text-lg uppercase truncate leading-none tracking-tighter drop-shadow-lg">{team.name}</div></div>
                                            </div>

                                            <div className="h-12 bg-black/60 flex justify-between items-center px-4 z-10 border-t border-white/10 backdrop-blur-md">
                                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider bg-white/10 px-2 py-1 rounded truncate max-w-[80px]">{team.region}</span>
                                                <span className={`text-xs font-black italic px-3 py-1 rounded shadow-lg ${team.tier === 'S' ? 'bg-emerald-500 text-black' : team.tier === 'A' ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-slate-300'}`}>{team.tier}</span>
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
                <button onClick={onRetry} className="py-4 rounded-xl bg-slate-800 text-slate-400 font-bold hover:bg-slate-700 !text-white border border-slate-700">🔄 다시 뽑기</button>
                <button onClick={onConfirm} className="py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 !text-white font-black italic text-lg shadow-[0_0_20px_rgba(6,182,212,0.4)]">💾 팀 선정 확정</button>
            </div>
        </div>
    );
};