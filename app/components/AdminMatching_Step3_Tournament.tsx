"use client";

import React from 'react';
import { db } from '../firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { Season, Match, FALLBACK_IMG } from '../types';
import { TeamCard } from './TeamCard';

// 🔥 [핵심 분리] 어드민용 실시간 대진표 뷰어 임포트
import { AdminLiveBracket_Tournament } from './AdminLiveBracket_Tournament';

interface Props {
    state: any;
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
    // 💡 TOURNAMENT 세팅 로직
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
        const allTeams = [...tourneyWaitingPool, ...tourneyBracket.filter((t: any) => Boolean(t))];
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
        const placedCount = tourneyBracket.filter((t: any) => Boolean(t)).length;
        if (placedCount < targetSeason.teams.length) {
            return alert("🚨 리그에 등록된 모든 팀을 대진표에 배치해주세요.");
        }

        let isCivilWar = false;
        for (let i = 0; i < tourneyTargetSize / 2; i++) {
            const hTeam = tourneyBracket[i * 2];
            const aTeam = tourneyBracket[i * 2 + 1];
            if (hTeam && aTeam && hTeam.name !== 'BYE' && aTeam.name !== 'BYE' && (hTeam.ownerUid === aTeam.ownerUid || hTeam.ownerName === aTeam.ownerName)) {
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

    const handleUnlockTourneyBracket = async () => {
        if (!confirm("확정된 대진을 해제하고 초기화하시겠습니까?")) return;
        const filteredRounds = targetSeason.rounds?.filter(r => r.name !== 'Tournament Bracket') || [];
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { rounds: filteredRounds });
    };

    const matchCount = tourneyTargetSize > 0 ? tourneyTargetSize / 2 : 0;
    const matchesArray = Array.from({ length: matchCount });
    const roundTitle = tourneyTargetSize === 16 ? 'Round of 16' : tourneyTargetSize === 8 ? 'Quarter-Final' : tourneyTargetSize === 4 ? 'Semi-Final' : 'Round 1';

    return (
        <div id="tourney-setup-section" className={`bg-[#0b0e14] p-4 md:p-6 rounded-[2.5rem] border relative transition-all duration-300 overflow-hidden ${isTourneyLocked ? 'border-slate-800 bg-[#05070a]' : 'border-slate-800'}`}>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-slate-800 pb-4 gap-4">
                <div className="flex items-center gap-3">
                    <h3 className="text-white font-black italic uppercase tracking-tighter text-xl">Step 3. Tournament Bracket Setup</h3>
                    {isTourneyLocked && (
                        <div className="flex items-center gap-1 bg-red-900/30 border border-red-500/30 px-3 py-1 rounded-full">
                            <span className="text-sm">🔒</span><span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">LOCKED</span>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    {isTourneyLocked ? (
                        <button onClick={handleUnlockTourneyBracket} className="px-4 py-2 rounded-xl font-black italic text-xs shadow-lg transition-all bg-red-900/80 text-red-400 hover:bg-red-800 hover:text-white border border-red-800/50">
                            🔄 UNLOCK & RESET
                        </button>
                    ) : (
                        <>
                            <button onClick={handleAutoFillTourneyBracket} className="px-4 py-2 rounded-xl font-black italic text-xs shadow-lg transition-all bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95">
                                ⚡ AUTO FILL
                            </button>
                            <button onClick={handleResetTourneyBracket} className="px-4 py-2 rounded-xl font-black italic text-xs shadow-lg transition-all bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700">
                                🔄 대기실로 빼기
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* 대기실 영역 (항상 노출, 잠금 시 비활성화) */}
            <div className={`mb-8 p-4 rounded-2xl border transition-all duration-300 ${isTourneyLocked ? 'bg-black/40 border-slate-800/50 opacity-40 grayscale pointer-events-none' : 'bg-slate-900/50 border-slate-700/50'}`}>
                <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Qualified Teams Inventory ({tourneyWaitingPool.length})</span>
                    {!isTourneyLocked && <span className="text-[10px] text-slate-500 italic hidden sm:block">Drag team to bracket slot</span>}
                </div>
                
                {tourneyWaitingPool.length === 0 ? (
                    <div className="text-center py-4 text-slate-600 text-xs italic">
                        {isTourneyLocked ? "모든 팀이 대진표에 배치되었습니다." : "모든 팀이 대진표에 배치되었습니다."}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 max-h-[350px] overflow-y-auto custom-scrollbar p-1">
                        {tourneyWaitingPool.map((t: any) => (
                            <TeamCard 
                                key={t.id} 
                                team={t} 
                                draggable={!isTourneyLocked} 
                                onDragStart={(e) => !isTourneyLocked && handleTourneyDragStart(e, 'pool', null, t)} 
                                size="small" 
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* 🔥 Locked 상태면 분리해둔 실시간 뷰어 호출, 아니면 세팅 화면 노출 */}
            {isTourneyLocked ? (
                <div className="mt-8 relative">
                    <AdminLiveBracket_Tournament 
                        targetSeason={targetSeason} 
                        tourneyTargetSize={tourneyTargetSize}
                    />
                </div>
            ) : (
                <>
                    {/* 세팅용 1라운드 슬롯 그리드 (가장 가벼운 구조) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 relative mt-8">
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-800 hidden lg:block opacity-20"></div>
                        
                        {matchesArray.map((_: any, mIdx: number) => {
                            const slot1 = mIdx * 2;
                            const slot2 = mIdx * 2 + 1;
                            const team1 = tourneyBracket[slot1];
                            const team2 = tourneyBracket[slot2];
                            const isInnerCivilWar = team1 && team2 && team1.name !== 'BYE' && team2.name !== 'BYE' && (team1.ownerUid === team2.ownerUid || team1.ownerName === team2.ownerName);

                            return (
                                <div key={mIdx} className="relative flex flex-col p-4 sm:p-5 rounded-3xl border transition-all bg-slate-900/20 border-slate-800/50">
                                    
                                    <div className="text-center mb-4 border-b border-slate-800/50 pb-2">
                                        <span className="text-[10px] text-emerald-500 font-black italic tracking-widest uppercase">
                                            {roundTitle} Match {mIdx + 1}
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
                                                onDragOver={handleDragOver} 
                                                onDrop={(e: React.DragEvent) => handleTourneyDrop(e, idx)} 
                                                onClick={() => handleTourneySlotClick(idx)} 
                                                className={`relative min-h-[96px] sm:min-h-[110px] rounded-xl border-2 flex flex-col items-center justify-center transition-all group overflow-hidden ${
                                                    team 
                                                        ? 'border-emerald-500/30 bg-emerald-900/10 hover:border-red-500/50 hover:bg-red-900/10 cursor-pointer border-dashed' 
                                                        : 'border-slate-700 bg-slate-900/30 hover:border-indigo-500/50 hover:bg-slate-800 border-dashed cursor-pointer'
                                                }`}
                                            >
                                                {team ? (
                                                    <div className="w-full h-full relative">
                                                        <div className="w-full h-full" draggable onDragStart={(e: React.DragEvent) => handleTourneyDragStart(e, 'bracket', idx, team)}>
                                                            <TeamCard 
                                                                team={team} 
                                                                size="small" 
                                                                className="w-full h-full border-none shadow-none bg-transparent flex items-center justify-center"
                                                            />
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] z-30">
                                                                <span className="text-red-400 font-black text-xs uppercase">REMOVE ✕</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center transition-colors text-slate-600 group-hover:text-indigo-500">
                                                        <span className="text-xl font-black">+</span>
                                                        <span className="text-[9px] font-bold">ADD TEAM</span>
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
                        })}
                    </div>

                    {/* 확정 버튼 */}
                    <div className="mt-8 pt-6 border-t border-slate-800 flex justify-center">
                        <button onClick={handleConfirmTourneyBracket} className="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black italic rounded-2xl shadow-2xl text-lg transition-transform active:scale-95 flex items-center gap-3">
                            <span>⚔️</span> GENERATE TOURNAMENT BRACKET
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};