"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import { TeamCard } from './TeamCard';
import { CupEntry, Season, MasterTeam, Match, FALLBACK_IMG } from '../types';

interface AdminCupStep3Props {
    waitingPool: CupEntry[];
    bracket: (CupEntry | null)[];
    isLocked?: boolean; 
    targetSeason?: Season;
    masterTeams?: MasterTeam[];
    
    onDragStart: (e: React.DragEvent, entry: CupEntry) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, idx: number) => void;
    onSlotClick: (idx: number) => void;
    onAutoMatch: () => void;
    onRandomMatch: () => void;
    onCreateSchedule: () => void;
    onResetTournament?: () => void; 
    onResetBracket?: () => void;    
    onSaveEditOverride?: (matchIdsToUpdate: string[], updatedBracket: CupEntry[]) => void; 
}

export const AdminCupStep3 = ({
    waitingPool, bracket, isLocked = false, targetSeason, masterTeams,
    onDragStart, onDragOver, onDrop, onSlotClick,
    onAutoMatch, onRandomMatch, onCreateSchedule, onResetTournament, onResetBracket, onSaveEditOverride
}: AdminCupStep3Props) => {

    const handleLockedAction = (action: () => void) => {
        if (isLocked) {
            alert("🔒 토너먼트 대진이 이미 확정되었습니다.\n초기화를 원하시면 우측 상단 버튼을 이용해주세요.");
            return;
        }
        action();
    };

    const matchCount = Math.floor(bracket.length / 2);
    const matches = Array.from({ length: matchCount });
    const isQuarterFinal = matchCount === 4;

    const [editModeStage, setEditModeStage] = useState<{ label: string, matchIds: string[] } | null>(null);
    const [editPool, setEditPool] = useState<CupEntry[]>([]);
    const [editBracket, setEditBracket] = useState<(CupEntry | null)[]>([]);
    const [draggedEditEntry, setDraggedEditEntry] = useState<CupEntry | null>(null);

    const getKnockoutMatch = (stageQuery: string, matchIndex: number) => {
        if (!targetSeason?.rounds) return null;
        const koRound = targetSeason.rounds.find(r => r.round === 2 || r.name.includes("Knockout"));
        if (!koRound || !koRound.matches) return null;
        const matchesInStage = koRound.matches.filter(m => m.stage.includes(stageQuery));
        matchesInStage.sort((a, b) => parseInt(a.id.split('_').pop() || '0') - parseInt(b.id.split('_').pop() || '0'));
        return matchesInStage[matchIndex] || null;
    };

    // 🔥 [헬퍼 추가] 경기 결과 (승리팀/패배팀) 이름을 구하는 함수
    const getMatchResult = (match: Match | undefined) => {
        if (!match || match.status !== 'COMPLETED' || !match.homeScore || !match.awayScore) {
            return { winner: 'TBD', loser: 'TBD' };
        }
        const h = Number(match.homeScore);
        const a = Number(match.awayScore);
        if (h > a) return { winner: match.home, loser: match.away };
        if (a > h) return { winner: match.away, loser: match.home };
        return { winner: 'TBD', loser: 'TBD' }; // 무승부 시 TBD
    };

    const getTeamEntryFromMatch = (teamName: string, logo: string, ownerName: string): CupEntry | null => {
        if (!teamName || teamName === 'TBD' || teamName === 'BYE') return null;
        const master = masterTeams?.find(m => m.name === teamName);
        return {
            id: `edit_${teamName}_${Date.now()}`,
            masterId: master?.id || 0,
            name: teamName,
            logo: logo || master?.logo || FALLBACK_IMG,
            ownerName: ownerName || master?.ownerName || '-',
            ownerUid: '', region: master?.region || '', tier: master?.tier || 'C', realRankScore: 80, realFormScore: 80
        };
    };

    const startIntervention = (stageLabel: string, stageQuery: string) => {
        if(!targetSeason?.rounds) return;
        const koRound = targetSeason.rounds.find(r => r.round === 2 || r.name.includes("Knockout"));
        const stageMatches = koRound?.matches?.filter(m => m.stage.includes(stageQuery)) || [];
        
        if(stageMatches.every(m => m.home === 'TBD' && m.away === 'TBD')) {
            return alert("아직 해당 라운드에 진출한 팀이 없어 재배치할 수 없습니다.");
        }
        
        if (!confirm(`🚨 [${stageLabel}]에 배정된 팀들을 대기실로 불러와 수동으로 재배치하시겠습니까?\n(오직 내전 방지 목적의 강제 조정 기능입니다.)`)) return;

        const teams: CupEntry[] = [];
        stageMatches.forEach(m => {
            if(m.home !== 'TBD' && m.home !== 'BYE') teams.push(getTeamEntryFromMatch(m.home, m.homeLogo, m.homeOwner)!);
            if(m.away !== 'TBD' && m.away !== 'BYE') teams.push(getTeamEntryFromMatch(m.away, m.awayLogo, m.awayOwner)!);
        });

        setEditPool(teams);
        setEditBracket(Array(stageMatches.length * 2).fill(null));
        setEditModeStage({ label: stageLabel, matchIds: stageMatches.map(m => m.id) });
    };

    const saveIntervention = () => {
        if(editBracket.includes(null)) return alert("재배치 슬롯을 모두 채워주세요!");
        if(onSaveEditOverride && editModeStage) {
            onSaveEditOverride(editModeStage.matchIds, editBracket as CupEntry[]);
            setEditModeStage(null); 
        }
    };

    const renderPreviewMatch = (title: string, titleColor: string, fallbackLabel1: string, fallbackLabel2: string, highlight: boolean = false, stageQueryForEdit?: string, liveMatchIndex: number = 0) => {
        const liveMatch = stageQueryForEdit ? getKnockoutMatch(stageQueryForEdit, liveMatchIndex) : null;

        // 🔥 [가장 핵심 수술 포인트] DB에는 TBD더라도 4강이 끝났다면 실시간으로 패자를 계산해서 가져옵니다!
        let effectiveHome = liveMatch?.home || 'TBD';
        let effectiveAway = liveMatch?.away || 'TBD';
        let effectiveHomeLogo = liveMatch?.homeLogo;
        let effectiveAwayLogo = liveMatch?.awayLogo;
        let effectiveHomeOwner = liveMatch?.homeOwner;
        let effectiveAwayOwner = liveMatch?.awayOwner;

        // 3·4위전 슬롯 채우기 로직 (syncLoser)
        if (stageQueryForEdit === '3RD_PLACE' && targetSeason?.rounds) {
            const koRound = targetSeason.rounds.find(r => r.round === 2 || r.name.includes("Knockout"));
            if (koRound?.matches) {
                const sf1 = koRound.matches.find(m => m.id === 'ko_4_0'); // 4강 1경기
                const sf2 = koRound.matches.find(m => m.id === 'ko_4_1'); // 4강 2경기

                if (effectiveHome === 'TBD' && sf1) {
                    const loser1 = getMatchResult(sf1).loser;
                    if (loser1 !== 'TBD') {
                        effectiveHome = loser1;
                        const info = getTeamEntryFromMatch(loser1, '', ''); // 마스터 lookup
                        effectiveHomeLogo = info?.logo;
                        effectiveHomeOwner = info?.ownerName;
                    }
                }
                if (effectiveAway === 'TBD' && sf2) {
                    const loser2 = getMatchResult(sf2).loser;
                    if (loser2 !== 'TBD') {
                        effectiveAway = loser2;
                        const info = getTeamEntryFromMatch(loser2, '', ''); // 마스터 lookup
                        effectiveAwayLogo = info?.logo;
                        effectiveAwayOwner = info?.ownerName;
                    }
                }
            }
        }

        // 결승전 슬롯 채우기 로직 (syncWinner)
        if (stageQueryForEdit === 'FINAL' && targetSeason?.rounds) {
            const koRound = targetSeason.rounds.find(r => r.round === 2 || r.name.includes("Knockout"));
            if (koRound?.matches) {
                const sf1 = koRound.matches.find(m => m.id === 'ko_4_0');
                const sf2 = koRound.matches.find(m => m.id === 'ko_4_1');

                if (effectiveHome === 'TBD' && sf1) {
                    const winner1 = getMatchResult(sf1).winner;
                    if (winner1 !== 'TBD') {
                        effectiveHome = winner1;
                        const info = getTeamEntryFromMatch(winner1, '', '');
                        effectiveHomeLogo = info?.logo;
                        effectiveHomeOwner = info?.ownerName;
                    }
                }
                if (effectiveAway === 'TBD' && sf2) {
                    const winner2 = getMatchResult(sf2).winner;
                    if (winner2 !== 'TBD') {
                        effectiveAway = winner2;
                        const info = getTeamEntryFromMatch(winner2, '', '');
                        effectiveAwayLogo = info?.logo;
                        effectiveAwayOwner = info?.ownerName;
                    }
                }
            }
        }

        const homeTeam = getTeamEntryFromMatch(effectiveHome, effectiveHomeLogo || '', effectiveHomeOwner || '');
        const awayTeam = getTeamEntryFromMatch(effectiveAway, effectiveAwayLogo || '', effectiveAwayOwner || '');

        return (
            <div className={`relative flex flex-col p-4 sm:p-5 rounded-3xl border transition-all ${highlight ? 'bg-gradient-to-br from-yellow-900/10 to-black/30 border-yellow-900/30 shadow-[0_0_15px_rgba(234,179,8,0.03)]' : 'bg-black/20 border-slate-800/30 group/edit'}`}>
                
                <div className="flex justify-between items-center mb-4 border-b border-slate-800/50 pb-2">
                    <div className="w-4"></div> 
                    <span className={`text-[10px] font-black italic tracking-widest uppercase ${titleColor}`}>
                        {title}
                    </span>
                    {isLocked && stageQueryForEdit && !editModeStage ? (
                        <button 
                            onClick={() => startIntervention(title, stageQueryForEdit)}
                            className="opacity-0 group-hover/edit:opacity-100 px-2 py-0.5 bg-red-900/50 hover:bg-red-600 text-red-300 hover:text-white rounded border border-red-800 text-[8px] font-bold transition-all shadow-lg"
                        >
                            🚨 내전 방지 재배치
                        </button>
                    ) : <div className="w-4"></div>}
                </div>
                
                <div className="grid grid-cols-2 gap-3 sm:gap-4 relative items-center">
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                        <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-slate-700 text-[9px] font-black text-slate-500 italic shadow-lg">VS</div>
                    </div>

                    {/* Home Slot */}
                    <div className={`relative min-h-[96px] sm:min-h-[110px] rounded-xl border-2 flex flex-col items-center justify-center overflow-hidden ${homeTeam ? 'border-emerald-500/30 bg-emerald-900/10' : 'border-slate-800/50 bg-black/40 opacity-60'}`}>
                        {homeTeam ? (
                             <TeamCard team={homeTeam} size="small" className="w-full h-full border-none shadow-none bg-transparent flex items-center justify-center pointer-events-none" />
                        ) : (
                            <>
                                <div className="w-12 h-12 mb-3 rounded-full bg-slate-800/50 border border-slate-700 flex items-center justify-center shadow-inner">
                                    <span className="text-[9px] font-black text-slate-500 tracking-wider">TBD</span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter text-center px-1">{fallbackLabel1}</span>
                            </    >
                        )}
                    </div>

                    {/* Away Slot */}
                    <div className={`relative min-h-[96px] sm:min-h-[110px] rounded-xl border-2 flex flex-col items-center justify-center overflow-hidden ${awayTeam ? 'border-emerald-500/30 bg-emerald-900/10' : 'border-slate-800/50 bg-black/40 opacity-60'}`}>
                        {awayTeam ? (
                             <TeamCard team={awayTeam} size="small" className="w-full h-full border-none shadow-none bg-transparent flex items-center justify-center pointer-events-none" />
                        ) : (
                            <>
                                <div className="w-12 h-12 mb-3 rounded-full bg-slate-800/50 border border-slate-700 flex items-center justify-center shadow-inner">
                                    <span className="text-[9px] font-black text-slate-500 tracking-wider">TBD</span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter text-center px-1">{fallbackLabel2}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={`bg-[#0b0e14] p-4 md:p-6 rounded-[2.5rem] border relative transition-all duration-300 ${isLocked ? 'border-slate-800 bg-[#05070a]' : 'border-slate-800'}`}>
            
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-slate-800 pb-4 gap-4">
                <div className="flex items-center gap-3">
                    <h3 className="text-white font-black italic uppercase tracking-tighter text-xl">Step 3. Tournament Bracket Setup</h3>
                    {isLocked && (
                        <div className="flex items-center gap-1 bg-red-900/30 border border-red-500/30 px-3 py-1 rounded-full shadow-inner">
                            <span className="text-sm">🔒</span>
                            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">LOCKED</span>
                        </div>
                    )}
                </div>
                
                <div className="flex gap-2">
                    {isLocked && onResetTournament && !editModeStage ? (
                        <button 
                            onClick={onResetTournament} 
                            className="px-4 py-2 rounded-xl font-bold text-xs shadow-lg transition-all bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 active:scale-95 flex items-center gap-2"
                        >
                            <span>🔄</span> RETURN TO WAITING POOL
                        </button>
                    ) : !editModeStage ? (
                        <>
                            <button 
                                onClick={() => onResetBracket && onResetBracket()} 
                                className={`px-4 py-2 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center gap-2 ${isLocked ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed hidden' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 active:scale-95'}`}
                            >
                                <span>🔄</span> Reset
                            </button>
                            <button 
                                onClick={() => handleLockedAction(onAutoMatch)} 
                                className={`px-4 py-2 rounded-xl font-black italic text-xs shadow-lg transition-all flex items-center gap-1 ${isLocked ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed hidden' : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95'}`}
                            >
                                <span>⚡</span> AUTO FILL
                            </button>
                            <button 
                                onClick={() => handleLockedAction(onRandomMatch)} 
                                className={`px-4 py-2 rounded-xl font-black italic text-xs shadow-lg transition-all flex items-center gap-1 ${isLocked ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed hidden' : 'bg-purple-600 text-white hover:bg-purple-500 active:scale-95'}`}
                            >
                                <span>🎲</span> RANDOM SHUFFLE
                            </button>
                        </>
                    ) : null}
                </div>
            </div>

            {editModeStage ? (
                <div className="border border-red-500/50 bg-red-950/20 p-6 rounded-3xl animate-in fade-in slide-in-from-top-4 mb-8 relative">
                    <div className="absolute -top-3 left-6 bg-[#0b0e14] px-3 font-black text-red-500 text-[11px] tracking-widest italic border border-red-900/50 rounded-full flex items-center gap-2">
                        <span className="animate-pulse">🚨</span> INTERVENTION MODE: {editModeStage.label}
                    </div>
                    
                    <p className="text-xs text-red-200/70 mb-4 ml-1 italic font-bold">진출팀을 드래그하여 내전이 생기지 않도록 새롭게 재배치한 후 저장해주세요.</p>

                    <div className="bg-black/40 p-4 rounded-2xl border border-red-900/30 mb-6">
                        <div className="text-[10px] text-red-400 font-bold mb-3 uppercase tracking-widest">Intervention Waiting Pool ({editPool.length})</div>
                        <div className="flex gap-4">
                            {editPool.map(t => (
                                <TeamCard 
                                    key={t.id} 
                                    team={t} 
                                    draggable 
                                    onDragStart={(e) => { setDraggedEditEntry(t); e.dataTransfer.effectAllowed = "move"; }} 
                                    size="small" 
                                />
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
                        {Array.from({ length: editBracket.length / 2 }).map((_, mIdx) => {
                            const slot1 = mIdx * 2;
                            const slot2 = mIdx * 2 + 1;
                            const team1 = editBracket[slot1];
                            const team2 = editBracket[slot2];

                            return (
                                <div key={mIdx} className="relative flex flex-col p-4 sm:p-5 rounded-3xl border border-red-900/50 bg-black/20">
                                    <div className="grid grid-cols-2 gap-3 sm:gap-4 relative items-center">
                                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                                            <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-red-900 text-[9px] font-black text-red-500 italic">VS</div>
                                        </div>

                                        {[
                                            { idx: slot1, team: team1 },
                                            { idx: slot2, team: team2 }
                                        ].map(({ idx, team }) => (
                                            <div 
                                                key={idx}
                                                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }} 
                                                onDrop={(e) => { 
                                                    e.preventDefault(); 
                                                    if(draggedEditEntry && !editBracket[idx]) {
                                                        const nb = [...editBracket]; nb[idx] = draggedEditEntry; setEditBracket(nb);
                                                        setEditPool(prev => prev.filter(p => p.id !== draggedEditEntry.id));
                                                        setDraggedEditEntry(null);
                                                    }
                                                }} 
                                                onClick={() => {
                                                    if(team) {
                                                        setEditPool(prev => [...prev, team]);
                                                        const nb = [...editBracket]; nb[idx] = null; setEditBracket(nb);
                                                    }
                                                }} 
                                                className={`relative min-h-[96px] sm:min-h-[110px] rounded-xl border-2 flex flex-col items-center justify-center transition-all group overflow-hidden ${
                                                    team ? 'border-red-500/50 bg-red-900/20 cursor-pointer' : 'border-slate-700 bg-slate-900/30 border-dashed cursor-pointer hover:border-red-500 hover:bg-red-900/10'
                                                }`}
                                            >
                                                {team ? (
                                                    <div className="w-full h-full">
                                                        <TeamCard team={team} size="small" className="w-full h-full border-none shadow-none bg-transparent flex items-center justify-center" />
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] z-30">
                                                            <span className="text-red-400 font-black text-xs">REMOVE ✕</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center text-slate-600 group-hover:text-red-400 transition-colors">
                                                        <span className="text-xl font-black">+</span>
                                                        <span className="text-[9px] font-bold">ADD TEAM</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-red-900/30">
                        <button onClick={() => { setEditModeStage(null); setEditPool([]); setEditBracket([]); }} className="px-6 py-2.5 rounded-xl font-bold text-xs bg-slate-800 text-slate-300 hover:bg-slate-700">취소 (Cancel)</button>
                        <button onClick={saveIntervention} className="px-8 py-2.5 rounded-xl font-black text-xs bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]">🚨 강제 재배치 저장</button>
                    </div>
                </div>
            ) : (
                <>
                    <div className={`mb-6 p-4 rounded-2xl border transition-all duration-300 ${isLocked ? 'bg-black/40 border-slate-800/50 opacity-40 grayscale pointer-events-none hidden' : 'bg-slate-900/50 border-slate-700/50'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Qualified Teams Inventory ({waitingPool.length})</span>
                            {!isLocked && <span className="text-[10px] text-slate-500 italic">Drag team to bracket slot</span>}
                        </div>
                        
                        {waitingPool.length === 0 ? (
                            <div className="text-center py-4 text-slate-600 text-xs italic">조별리그 통과팀이 대기실에 없습니다.</div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 max-h-[350px] overflow-y-auto custom-scrollbar p-1">
                                {waitingPool.map(t => (
                                    <TeamCard key={t.id} team={t} draggable={!isLocked} onDragStart={(e) => !isLocked && onDragStart(e, t)} size="small" />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 relative mb-8">
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-800 hidden lg:block opacity-20"></div>
                        
                        {matches.map((_, mIdx) => {
                            const slot1 = mIdx * 2;
                            const slot2 = mIdx * 2 + 1;
                            const team1 = bracket[slot1];
                            const team2 = bracket[slot2];

                            return (
                                <div key={mIdx} className={`relative flex flex-col p-4 sm:p-5 rounded-3xl border transition-all ${isLocked ? 'bg-black/20 border-slate-800/30' : 'bg-slate-900/20 border-slate-800/50'}`}>
                                    <div className="text-center mb-4 border-b border-slate-800/50 pb-2">
                                        <span className="text-[10px] text-emerald-500 font-black italic tracking-widest uppercase">
                                            {isQuarterFinal ? 'Quarter-Final' : 'Semi-Final'} Match {mIdx + 1}
                                        </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3 sm:gap-4 relative items-center">
                                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                                            <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-slate-700 text-[9px] font-black text-slate-500 italic shadow-lg">VS</div>
                                        </div>

                                        {[
                                            { idx: slot1, team: team1 },
                                            { idx: slot2, team: team2 }
                                        ].map(({ idx, team }) => (
                                            <div 
                                                key={idx}
                                                onDragOver={isLocked ? undefined : onDragOver} 
                                                onDrop={(e) => !isLocked && onDrop(e, idx)} 
                                                onClick={() => !isLocked && onSlotClick(idx)} 
                                                className={`relative min-h-[96px] sm:min-h-[110px] rounded-xl border-2 flex flex-col items-center justify-center transition-all group overflow-hidden ${
                                                    isLocked 
                                                    ? 'border-slate-800/50 bg-black/20 cursor-default'
                                                    : team 
                                                        ? 'border-emerald-500/30 bg-emerald-900/10 hover:border-red-500/50 hover:bg-red-900/10 cursor-pointer border-dashed' 
                                                        : 'border-slate-700 bg-slate-900/30 hover:border-yellow-500/50 hover:bg-slate-800 border-dashed cursor-pointer'
                                                }`}
                                            >
                                                {team ? (
                                                    <div className="w-full h-full">
                                                        <TeamCard team={team} size="small" className={`w-full h-full border-none shadow-none bg-transparent flex items-center justify-center ${isLocked ? 'grayscale opacity-80' : ''}`} />
                                                        {!isLocked && (
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] z-30">
                                                                <span className="text-red-400 font-black text-xs">REMOVE ✕</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className={`flex flex-col items-center transition-colors ${isLocked ? 'text-slate-700' : 'text-slate-600 group-hover:text-yellow-500'}`}>
                                                        <span className="text-xl font-black">{isLocked ? '-' : '+'}</span>
                                                        <span className="text-[9px] font-bold">{isLocked ? 'EMPTY' : 'ADD TEAM'}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {isLocked && !editModeStage && (
                <div className="mt-10 pt-8 border-t border-slate-800/50 space-y-8">
                    <div className="text-center mb-6">
                        <p className="text-xs text-slate-500 font-bold italic tracking-widest uppercase">Upcoming Bracket Stages</p>
                        <p className="text-[10px] text-slate-600 mt-1">이하 대진표는 이전 라운드 경기 결과에 따라 자동 배정됩니다.</p>
                    </div>

                    {isQuarterFinal && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                            {renderPreviewMatch("Semi-Final Match 1", "text-emerald-500", "Winner QF 1", "Winner QF 2", false, "ROUND_OF_4", 0)}
                            {renderPreviewMatch("Semi-Final Match 2", "text-emerald-500", "Winner QF 3", "Winner QF 4", false, "ROUND_OF_4", 1)}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                        {/* 🔥 이제 어드민에서도 마르세유와 아스널이 계산되어 보일 것입니다! */}
                        {renderPreviewMatch("3RD PLACE MATCH", "text-orange-500", "Loser SF 1", "Loser SF 2", false, "3RD_PLACE", 0)}
                        {renderPreviewMatch("👑 GRAND FINAL", "text-yellow-500", "Winner SF 1", "Winner SF 2", true, "FINAL", 0)}
                    </div>
                </div>
            )}

            <div className="mt-8 pt-6 border-t border-slate-800 flex justify-center">
                {isLocked ? (
                    <div className="px-10 py-5 bg-slate-900 text-slate-500 font-black italic rounded-2xl border border-slate-800 flex items-center gap-3 cursor-not-allowed select-none">
                        <span>🔒</span> TOURNAMENT SCHEDULE FIXED
                    </div>
                ) : (
                    <button onClick={onCreateSchedule} className="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black italic rounded-2xl shadow-2xl text-lg transition-transform active:scale-95 flex items-center gap-3">
                        <span>⚔️</span> GENERATE TOURNAMENT BRACKET
                    </button>
                )}
            </div>
        </div>
    );
};