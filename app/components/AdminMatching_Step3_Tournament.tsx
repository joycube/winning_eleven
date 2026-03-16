"use client";

import React from 'react';
import { db } from '../firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { Season, Match, FALLBACK_IMG, Team } from '../types'; // 🔥 Team 타입 추가
import { TeamCard } from './TeamCard';

// 🔥 새롭게 만든 퍼블릭 토너먼트 뷰어를 불러옵니다.
import { AdminMatching_TournamentBracketView } from './AdminMatching_TournamentBracketView';

interface Props {
    state: any; // Context state이므로 any 유지 (필요 시 더 구체화 가능)
    targetSeason: Season;
    onNavigateToSchedule: (id: number) => void;
}

export const AdminMatching_Step3_Tournament = ({ state, targetSeason, onNavigateToSchedule }: Props) => {
    const {
        tourneyWaitingPool, setTourneyWaitingPool,
        tourneyBracket, setTourneyBracket,
        isTourneyLocked, tourneyTargetSize
    } = state;

    // =======================================================
    // 💡 TOURNAMENT 전용 로직 (이 파일 안에서만 동작합니다)
    // =======================================================
    const handleAutoFillTourneyBracket = () => {
        if (isTourneyLocked) return;
        const newBracket = [...tourneyBracket];
        let poolIdx = 0;
        for (let i = 0; i < newBracket.length; i++) {
            if (!newBracket[i] && poolIdx < tourneyWaitingPool.length) {
                newBracket[i] = tourneyWaitingPool[poolIdx];
                poolIdx++;
            }
        }
        setTourneyBracket(newBracket);
        setTourneyWaitingPool(tourneyWaitingPool.slice(poolIdx));
    };

    const handleResetTourneyBracket = () => {
        if (isTourneyLocked) return;
        const allTeams = [...tourneyWaitingPool, ...tourneyBracket.filter(Boolean)];
        setTourneyWaitingPool(allTeams);
        setTourneyBracket(Array(tourneyTargetSize).fill(null));
    };

    const handleTourneyDragStart = (e: React.DragEvent, source: 'pool' | 'bracket', index: number | null, team: any) => {
        if (isTourneyLocked) return;
        e.dataTransfer.setData('text/plain', JSON.stringify({ source, index, teamId: team.id }));
    };

    const handleDragOver = (e: React.DragEvent) => { if (!isTourneyLocked) e.preventDefault(); };

    const handleTourneyDrop = (e: React.DragEvent, targetIndex: number) => {
        if (isTourneyLocked) return;
        e.preventDefault();
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const { source, index, teamId } = data;

        let team = source === 'pool' ? tourneyWaitingPool.find((t: any) => t.id === teamId) : tourneyBracket[index!];
        if (!team) return;

        const newBracket = [...tourneyBracket];
        const newPool = [...tourneyWaitingPool];
        const existingTeam = newBracket[targetIndex];

        newBracket[targetIndex] = team;

        if (source === 'pool') {
            newPool.splice(newPool.findIndex((t: any) => t.id === teamId), 1);
        } else if (source === 'bracket') {
            newBracket[index!] = existingTeam; 
        }

        if (source === 'pool' && existingTeam) {
            newPool.push(existingTeam); 
        }

        setTourneyBracket(newBracket);
        setTourneyWaitingPool(newPool);
    };

    const handleTourneySlotClick = (index: number) => {
        if (isTourneyLocked) return;
        const team = tourneyBracket[index];
        if (!team) return;
        const newBracket = [...tourneyBracket];
        newBracket[index] = null;
        
        const newPool = [...tourneyWaitingPool, team];
        setTourneyBracket(newBracket);
        setTourneyWaitingPool(newPool);
    };

    const handleConfirmTourneyBracket = async () => {
        if (isTourneyLocked) return;
        const placedCount = tourneyBracket.filter(Boolean).length;
        if (placedCount < targetSeason.teams.length) {
            return alert("🚨 리그에 등록된 모든 팀을 대진표에 배치해주세요.");
        }

        let isCivilWar = false;
        for (let i = 0; i < tourneyTargetSize / 2; i++) {
            const hTeam = tourneyBracket[i * 2];
            const aTeam = tourneyBracket[i * 2 + 1];
            if (hTeam && aTeam && (hTeam.ownerUid === aTeam.ownerUid || hTeam.ownerName === aTeam.ownerName)) {
                isCivilWar = true;
                break;
            }
        }

        if (isCivilWar) {
            const forceGenerate = confirm("🚨 [경고] 1라운드에 동일 오너(내전) 매치업이 포함되어 있습니다!\n무시하고 토너먼트 스케줄을 강제로 발행하시겠습니까?");
            if (!forceGenerate) return;
        } else {
            if (!confirm("현재 설정된 대진표로 토너먼트 스케줄을 공식 발행하시겠습니까?")) return;
        }

        try {
            const s = (val: any) => val === undefined ? '' : val;
            const matches: Match[] = [];
            const totalMatches = tourneyTargetSize - 1;

            for (let i = 0; i < totalMatches; i++) {
                const isFirst = i < tourneyTargetSize / 2;
                const isFinal = i === totalMatches - 1;
                
                let homeName = 'TBD', awayName = 'TBD', homeLogo = FALLBACK_IMG, awayLogo = FALLBACK_IMG;
                let homeOwner = '-', awayOwner = '-';
                
                // 🔥 [TypeScript Vercel Fix]
                let currentStatus: "UPCOMING" | "BYE" | "COMPLETED" = "UPCOMING";
                
                let homeOwnerUid = '', awayOwnerUid = '';

                if (isFirst) {
                    const hTeam = tourneyBracket[i * 2];
                    const aTeam = tourneyBracket[i * 2 + 1];
                    homeName = hTeam ? hTeam.name : 'BYE';
                    awayName = aTeam ? aTeam.name : 'BYE';
                    homeLogo = hTeam ? hTeam.logo : FALLBACK_IMG;
                    awayLogo = aTeam ? aTeam.logo : FALLBACK_IMG;
                    homeOwner = hTeam ? hTeam.ownerName : '-';
                    awayOwner = aTeam ? aTeam.ownerName : '-';
                    homeOwnerUid = hTeam ? hTeam.ownerUid : '';
                    awayOwnerUid = aTeam ? aTeam.ownerUid : '';
                    
                    if (homeName === 'BYE' || awayName === 'BYE') currentStatus = 'BYE';
                }

                matches.push({
                    id: `${targetSeason.id}_M${i}`,
                    seasonId: targetSeason.id,
                    home: s(homeName), away: s(awayName),
                    homeLogo: s(homeLogo), awayLogo: s(awayLogo),
                    homeOwner: s(homeOwner), awayOwner: s(awayOwner),
                    homeOwnerUid: s(homeOwnerUid), awayOwnerUid: s(awayOwnerUid),
                    status: currentStatus, 
                    homeScore: '', awayScore: '',
                    stage: isFinal ? 'FINAL' : 'TOURNAMENT',
                    matchLabel: isFinal ? '🏆 결승전' : `1Round - Match ${i + 1}`,
                    youtubeUrl: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: []
                });
            }

            const updatedRounds = [{ round: 1, name: 'Tournament Bracket', seasonId: targetSeason.id, matches }];
            await updateDoc(doc(db, "seasons", String(targetSeason.id)), { rounds: updatedRounds });
            alert("🎉 토너먼트 대진표 확정이 완료되었습니다!");
            onNavigateToSchedule(targetSeason.id);
            
        } catch (error) { console.error("Firebase Update Error: ", error); alert("🚨 저장 에러 발생."); }
    };

    return (
        <div id="tourney-setup-section" className={`bg-[#0b0e14] p-4 md:p-6 rounded-[2.5rem] border relative transition-all duration-300 overflow-hidden ${isTourneyLocked ? 'border-slate-800 bg-[#05070a]' : 'border-blue-900/50'}`}>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-slate-800 pb-4 gap-4">
                <div className="flex items-center gap-3">
                    <h3 className="text-white font-black italic uppercase tracking-tighter text-xl">Step 3. Tournament Bracket Setup</h3>
                    {isTourneyLocked && (
                        <div className="flex items-center gap-1 bg-red-900/30 border border-red-500/30 px-3 py-1 rounded-full">
                            <span className="text-sm">🔒</span><span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">LOCKED & IN PROGRESS</span>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    {!isTourneyLocked && (
                        <>
                            <button onClick={handleAutoFillTourneyBracket} className="px-4 py-2 rounded-xl font-black italic text-xs shadow-lg transition-all bg-blue-600 text-white hover:bg-blue-500 active:scale-95">
                                ⚡ AUTO FILL
                            </button>
                            <button onClick={handleResetTourneyBracket} className="px-4 py-2 rounded-xl font-black italic text-xs shadow-lg transition-all bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700">
                                🔄 대기실로 빼기
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* 🔥 잠금 상태(isTourneyLocked)일 때는 새로운 뷰어를, 아닐 때는 기존 드래그앤드롭 UI를 보여줍니다. */}
            {isTourneyLocked ? (
                <div className="mt-4">
                    {/* 데이터가 없으면 빈 배열을 넘겨서 에러를 방지합니다. */}
                    <AdminMatching_TournamentBracketView matches={targetSeason.rounds?.[0]?.matches || []} />
                </div>
            ) : (
                <>
                    <div className={`mb-8 p-4 rounded-2xl border transition-all duration-300 bg-slate-900/50 border-slate-700/50`}>
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Waiting Pool ({tourneyWaitingPool.length})</span>
                            <span className="text-[10px] text-slate-500 italic hidden sm:block">Drag team to bracket slot</span>
                        </div>
                        
                        {tourneyWaitingPool.length === 0 ? (
                            <div className="text-center py-6 text-slate-600 text-xs italic font-bold">모든 팀이 배치되었습니다.</div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 max-h-[350px] overflow-y-auto custom-scrollbar p-1">
                                {/* 🔥 [핵심 수정] 파라미터 t 에 명시적 any 타입을 부여하여 Vercel 빌드 에러 해결 */}
                                {tourneyWaitingPool.map((t: any) => (
                                    <div key={t.id} draggable onDragStart={(e) => handleTourneyDragStart(e, 'pool', null, t)} className="relative cursor-grab active:cursor-grabbing hover:-translate-y-1 transition-transform">
                                        <TeamCard team={t} size="small" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-8 relative pb-8 w-full flex flex-col items-center px-2">
                        <div className="w-full flex flex-col items-center gap-10 md:gap-16">
                            {Array.from({ length: tourneyTargetSize > 0 ? Math.log2(tourneyTargetSize) : 0 })
                                .map((_, i) => Math.log2(tourneyTargetSize) - i)
                                .map((roundLevel) => {
                                    const totalRounds = Math.log2(tourneyTargetSize);
                                    const isFinal = roundLevel === totalRounds;
                                    const isFirstRound = roundLevel === 1;
                                    const matchesInRound = Math.pow(2, totalRounds - roundLevel);

                                    const getRoundTitle = (level: number) => {
                                        if (level === totalRounds) return "👑 챔피언 결정전 (GRAND FINAL)";
                                        if (level === totalRounds - 1) return "🔥 4강전 (SEMI-FINAL)";
                                        if (level === totalRounds - 2) return "⚔️ 8강전 (QUARTER-FINAL)";
                                        if (level === totalRounds - 3) return "🛡️ 16강전 (ROUND OF 16)";
                                        return `Round ${level}`;
                                    };

                                    return (
                                        <div key={roundLevel} className="flex flex-col items-center w-full relative">
                                            <div className="text-center mb-6">
                                                <span className={`text-[14px] sm:text-[16px] font-black italic tracking-widest uppercase ${isFinal ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]' : isFirstRound ? 'text-blue-400' : 'text-slate-400'}`}>
                                                    {getRoundTitle(roundLevel)}
                                                </span>
                                            </div>

                                            <div className={`grid grid-cols-1 gap-6 sm:gap-8 justify-items-center w-full max-w-7xl mx-auto ${
                                                matchesInRound === 1 ? 'md:grid-cols-1' :
                                                matchesInRound === 2 ? 'md:grid-cols-2' :
                                                matchesInRound === 4 ? 'md:grid-cols-2 lg:grid-cols-4' :
                                                'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                                            }`}>
                                                {Array.from({ length: matchesInRound }).map((_, mIdx) => {
                                                    if (isFirstRound) {
                                                        const homeIdx = mIdx * 2;
                                                        const awayIdx = mIdx * 2 + 1;
                                                        const hTeam = tourneyBracket[homeIdx];
                                                        const aTeam = tourneyBracket[awayIdx];
                                                        const isInnerCivilWar = hTeam && aTeam && (hTeam.ownerUid === aTeam.ownerUid || hTeam.ownerName === aTeam.ownerName);

                                                        return (
                                                            <div key={mIdx} className={`relative flex flex-col p-4 sm:p-5 rounded-3xl border transition-all w-full max-w-[340px] bg-slate-900/40 border-blue-500/50 shadow-xl shadow-blue-900/20`}>
                                                                <div className="text-center mb-4 border-b border-slate-800/50 pb-2">
                                                                    <span className="text-[10px] text-blue-400 font-black italic tracking-widest uppercase">Match {mIdx + 1}</span>
                                                                </div>
                                                                
                                                                <div className="grid grid-cols-2 gap-3 sm:gap-4 relative items-center">
                                                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                                                                        <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-slate-700 text-[10px] font-black text-slate-500 italic shadow-lg">VS</div>
                                                                    </div>

                                                                    {[homeIdx, awayIdx].map(slotIdx => (
                                                                        <div key={slotIdx} onDragOver={handleDragOver} onDrop={(e) => handleTourneyDrop(e, slotIdx)} onClick={() => handleTourneySlotClick(slotIdx)} 
                                                                            className={`relative min-h-[110px] rounded-xl border-2 flex flex-col items-center justify-center transition-all group overflow-hidden ${
                                                                                tourneyBracket[slotIdx] ? 'border-blue-500/30 bg-blue-900/10 hover:border-red-500/50 hover:bg-red-900/10 cursor-pointer border-solid' : 'border-slate-700 bg-slate-900/30 hover:border-blue-500/50 hover:bg-slate-800 border-dashed cursor-pointer'
                                                                            }`}
                                                                        >
                                                                            <span className="absolute -top-0 w-full bg-slate-800 text-slate-400 text-[8px] font-black py-0.5 text-center tracking-widest uppercase z-10">Slot {slotIdx + 1}</span>
                                                                            {tourneyBracket[slotIdx] ? (
                                                                                <div className="w-full h-full pt-4 relative" draggable onDragStart={(e) => handleTourneyDragStart(e, 'bracket', slotIdx, tourneyBracket[slotIdx])}>
                                                                                    <TeamCard team={tourneyBracket[slotIdx]} size="small" className={`w-full h-full border-none shadow-none bg-transparent`} />
                                                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] z-30"><span className="text-red-400 font-black text-[10px] uppercase">REMOVE ✕</span></div>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex flex-col items-center text-slate-600 pt-3 group-hover:text-blue-500">
                                                                                    <span className="text-xl font-black mb-1">+</span>
                                                                                    <span className="text-[11px] font-black uppercase tracking-widest">TBD</span>
                                                                                    <span className="text-[8px] font-bold text-slate-500">(ADD TEAM)</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                {isInnerCivilWar && (
                                                                    <div className="mt-3 bg-red-950/80 border border-red-500 text-red-400 text-[10px] font-bold py-1.5 rounded-lg text-center animate-pulse shadow-lg shadow-red-900/20">🚨 동일 오너(내전) 매치업 발생!</div>
                                                                )}
                                                            </div>
                                                        );
                                                    } else {
                                                        return (
                                                            <div key={mIdx} className={`relative flex flex-col p-4 sm:p-5 rounded-3xl border bg-slate-900/40 border-slate-800/50 shadow-xl w-full max-w-[340px] opacity-80 pointer-events-none`}>
                                                                <div className="text-center mb-4 border-b border-slate-800/50 pb-2">
                                                                    <span className="text-[10px] text-slate-400 font-black italic tracking-widest uppercase">{isFinal ? '결승전' : `Match ${mIdx + 1}`}</span>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-3 sm:gap-4 relative items-center">
                                                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                                                                        <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-slate-700 text-[9px] font-black text-slate-500 italic shadow-lg">VS</div>
                                                                    </div>
                                                                    <div className="h-[90px] rounded-xl border border-slate-800 bg-slate-900/80 flex flex-col items-center justify-center text-center px-1">
                                                                        <span className="text-2xl text-slate-600 mb-1">⚔️</span>
                                                                        <span className="text-[9px] font-bold text-slate-500 tracking-widest leading-tight">하위 {mIdx * 2 + 1}경기 승자</span>
                                                                    </div>
                                                                    <div className="h-[90px] rounded-xl border border-slate-800 bg-slate-900/80 flex flex-col items-center justify-center text-center px-1">
                                                                        <span className="text-2xl text-slate-600 mb-1">⚔️</span>
                                                                        <span className="text-[9px] font-bold text-slate-500 tracking-widest leading-tight">하위 {mIdx * 2 + 2}경기 승자</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-800 flex justify-center">
                        <button onClick={handleConfirmTourneyBracket} className="px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black italic rounded-2xl shadow-2xl shadow-blue-900/50 text-lg transition-transform active:scale-95 flex items-center gap-3">
                            <span>⚔️</span> CONFIRM MATCHUPS
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};