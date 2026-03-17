"use client";

import React from 'react';
import { Season, Match } from '../types';
import { TeamCard } from './TeamCard';
import { FALLBACK_IMG } from '../types';

interface Props {
    targetSeason: Season;
    tourneyTargetSize: number;
}

export const AdminLiveBracket_Tournament = ({ targetSeason, tourneyTargetSize }: Props) => {
    
    // 동적 피라미드 라운드 계산
    const totalRounds = tourneyTargetSize > 0 ? Math.log2(tourneyTargetSize) : 0;

    // DB 매치의 1차원 배열 인덱스 찾기 헬퍼
    const getMatchIndex = (roundLvl: number, mIdxInRound: number, size: number) => {
        let startIdx = 0;
        for (let r = 1; r < roundLvl; r++) {
            startIdx += size / Math.pow(2, r);
        }
        return startIdx + mIdxInRound;
    };

    // 실시간 팀 정보 및 승자 예측 헬퍼
    const getLiveTeam = (roundLvl: number, mIdxInRound: number, isHome: boolean) => {
        if (!targetSeason.rounds || !targetSeason.rounds[0]) return null;
        const matches = targetSeason.rounds[0].matches || [];
        const globalIdx = getMatchIndex(roundLvl, mIdxInRound, tourneyTargetSize);
        const m = matches[globalIdx];
        if (!m) return null;

        let tName = isHome ? m.home : m.away;
        let tLogo = isHome ? m.homeLogo : m.awayLogo;
        let tOwner = isHome ? m.homeOwner : m.awayOwner;
        let tUid = isHome ? m.homeOwnerUid : m.awayOwnerUid;
        let score = isHome ? m.homeScore : m.awayScore;

        // 아직 팀 배정 전이면, 하위 라운드 점수를 실시간 비교하여 승자를 올려보냄
        if ((!tName || tName === 'TBD') && roundLvl > 1) {
            const childIdxInRound = isHome ? (mIdxInRound * 2) : (mIdxInRound * 2 + 1);
            const childGlobalIdx = getMatchIndex(roundLvl - 1, childIdxInRound, tourneyTargetSize);
            const childM = matches[childGlobalIdx];
            
            if (childM && (childM.status === 'COMPLETED' || childM.homeScore !== '' || childM.awayScore !== '')) {
                if (Number(childM.homeScore) > Number(childM.awayScore)) {
                    tName = childM.home; tLogo = childM.homeLogo; tOwner = childM.homeOwner; tUid = childM.homeOwnerUid;
                } else if (Number(childM.awayScore) > Number(childM.homeScore)) {
                    tName = childM.away; tLogo = childM.awayLogo; tOwner = childM.awayOwner; tUid = childM.awayOwnerUid;
                }
            }
        }

        if (!tName || tName === 'TBD' || tName === 'BYE') return null;
        return { name: tName, logo: tLogo || FALLBACK_IMG, ownerName: tOwner, ownerUid: tUid, score: score };
    };

    const renderScore = (score: string | undefined) => {
        if (score === undefined || score === '') return null;
        return (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[22px] font-black text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] z-40 bg-black/50 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                {score}
            </div>
        );
    };

    return (
        <div className="w-full flex flex-col items-center gap-10 md:gap-16 relative">
            {Array.from({ length: totalRounds }).map((_: any, i: number) => {
                const roundLevel = totalRounds - i; // 가장 상단(결승)부터 역순 렌더링
                const isFinal = roundLevel === totalRounds;
                const matchesInRound = Math.pow(2, totalRounds - roundLevel);

                return (
                    <div key={roundLevel} className="flex flex-col items-center w-full relative">
                        {/* 라운드 타이틀 */}
                        <div className="text-center mb-6">
                            {isFinal ? (
                                <span className="text-[16px] font-black italic tracking-widest text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)] uppercase">👑 챔피언 결정전 (GRAND FINAL)</span>
                            ) : (
                                <span className="text-[14px] font-black italic tracking-widest text-emerald-500 uppercase">
                                    {roundLevel === totalRounds - 1 ? '🔥 4강전 (SEMI-FINAL)' : roundLevel === totalRounds - 2 ? '⚔️ 8강전 (QUARTER-FINAL)' : `ROUND ${roundLevel}`}
                                </span>
                            )}
                        </div>

                        {/* 경기 박스 그리드 */}
                        <div className={`grid grid-cols-1 gap-6 sm:gap-8 justify-items-center w-full max-w-7xl mx-auto ${
                            matchesInRound === 1 ? 'md:grid-cols-1' :
                            matchesInRound === 2 ? 'md:grid-cols-2' :
                            matchesInRound === 4 ? 'md:grid-cols-2 lg:grid-cols-4' :
                            'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                        }`}>
                            {Array.from({ length: matchesInRound }).map((_: any, mIdx: number) => {
                                const t1Obj = getLiveTeam(roundLevel, mIdx, true);
                                const t2Obj = getLiveTeam(roundLevel, mIdx, false);

                                return (
                                    <div key={mIdx} className="relative flex flex-col p-4 sm:p-5 rounded-3xl border w-full max-w-[340px] bg-slate-900/40 border-slate-800/50 opacity-90 pointer-events-none">
                                        <div className="text-center mb-4 border-b border-slate-800/50 pb-2">
                                            <span className="text-[10px] text-slate-400 font-black italic tracking-widest uppercase">{isFinal ? '결승전' : `Match ${mIdx + 1}`}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 sm:gap-4 relative items-center">
                                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                                                <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-slate-700 text-[9px] font-black text-slate-500 italic shadow-lg">VS</div>
                                            </div>
                                            {[
                                                { label: `하위 ${mIdx * 2 + 1}경기 승자`, teamObj: t1Obj },
                                                { label: `하위 ${mIdx * 2 + 2}경기 승자`, teamObj: t2Obj }
                                            ].map((slot, sIdx) => (
                                                <div key={sIdx} className={`relative min-h-[96px] sm:min-h-[110px] rounded-xl border-2 border-slate-800 flex flex-col items-center justify-center transition-all overflow-hidden ${slot.teamObj ? 'bg-slate-900/50' : 'bg-slate-900/80'}`}>
                                                    {slot.teamObj ? (
                                                        <div className="w-full h-full relative pointer-events-none">
                                                            <TeamCard team={slot.teamObj} size="small" className="w-full h-full border-none shadow-none bg-transparent flex items-center justify-center grayscale opacity-80" />
                                                            {renderScore(slot.teamObj.score)}
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <span className="text-2xl text-slate-600 mb-1">⚔️</span>
                                                            <span className="text-[9px] font-bold text-slate-500 tracking-widest leading-tight px-1 text-center">{slot.label}</span>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};