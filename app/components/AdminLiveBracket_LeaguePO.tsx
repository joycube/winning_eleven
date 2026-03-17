"use client";

import React from 'react';
import { Season, MasterTeam, Owner, Match } from '../types';
import { TeamCard } from './TeamCard';
import { FALLBACK_IMG } from '../types';

interface Props {
    targetSeason: Season;
    masterTeams: MasterTeam[];
    owners: Owner[];
}

export const AdminLiveBracket_LeaguePO = ({ targetSeason, masterTeams, owners }: Props) => {
    
    const resolveTeam = (tName: string) => {
        if (!tName || tName === 'TBD' || tName === 'BYE') return null;
        const mTeam = masterTeams.find(m => m.name === tName || m.teamName === tName);
        if (mTeam) {
            const owner = owners.find(o => o.uid === mTeam.ownerUid || o.docId === mTeam.ownerUid) || owners.find(o => o.nickname === mTeam.ownerName);
            return { name: tName, logo: mTeam.logo, ownerName: owner ? owner.nickname : mTeam.ownerName, ownerUid: mTeam.ownerUid };
        }
        return { name: tName, logo: FALLBACK_IMG, ownerName: 'NO OWNER', ownerUid: '' };
    };

    const getTeamFromDB = (m: Match | undefined, isHome: boolean) => {
        if (!m) return null;
        const name = isHome ? m.home : m.away;
        if (!name || name === 'TBD' || name === 'BYE') return null;
        return { 
            name, 
            logo: isHome ? m.homeLogo : m.awayLogo, 
            ownerName: isHome ? m.homeOwner : m.awayOwner, 
            ownerUid: isHome ? m.homeOwnerUid : m.awayOwnerUid 
        };
    };

    const getAggScore = (leg1: Match | undefined, leg2: Match | undefined) => {
        if (!leg1) return { home: '', away: '' };
        let hs = 0, as = 0, hasS = false;
        [leg1, leg2].forEach(m => {
            if (m && (m.status === 'COMPLETED' || m.homeScore !== '' || m.awayScore !== '')) {
                hasS = true;
                if (m.home === leg1.home) {
                    hs += Number(m.homeScore || 0);
                    as += Number(m.awayScore || 0);
                } else if (m.home === leg1.away) {
                    hs += Number(m.awayScore || 0);
                    as += Number(m.homeScore || 0);
                }
            }
        });
        return { home: hasS ? String(hs) : '', away: hasS ? String(as) : '' };
    };

    let dbLive = {
        qf1_t1: null as any, qf1_t2: null as any, qf1_s1: '', qf1_s2: '',
        qf2_t1: null as any, qf2_t2: null as any, qf2_s1: '', qf2_s2: '',
        sf_t1: null as any, sf_t2: null as any, sf_s1: '', sf_s2: '',
        gf_t1: null as any, gf_t2: null as any, gf_s1: '', gf_s2: ''
    };

    if (targetSeason.rounds) {
        const r4 = targetSeason.rounds.find(r => r.name === 'ROUND_OF_4')?.matches || [];
        const sf = targetSeason.rounds.find(r => r.name === 'SEMI_FINAL')?.matches || [];
        const gf = targetSeason.rounds.find(r => r.name === 'FINAL')?.matches || [];

        // QF1
        if (r4.length >= 2) {
            dbLive.qf1_t1 = getTeamFromDB(r4[0], false); 
            dbLive.qf1_t2 = getTeamFromDB(r4[0], true);  
            const agg = getAggScore(r4[0], r4[1]);
            dbLive.qf1_s1 = agg.away;
            dbLive.qf1_s2 = agg.home;
        }

        // QF2
        if (r4.length >= 4) {
            dbLive.qf2_t1 = getTeamFromDB(r4[2], false); 
            dbLive.qf2_t2 = getTeamFromDB(r4[2], true);  
            const agg = getAggScore(r4[2], r4[3]);
            dbLive.qf2_s1 = agg.away;
            dbLive.qf2_s2 = agg.home;
        }

        // SF
        if (sf.length >= 2) {
            dbLive.sf_t1 = getTeamFromDB(sf[0], true); 
            dbLive.sf_t2 = getTeamFromDB(sf[0], false);
            const agg = getAggScore(sf[0], sf[1]);
            dbLive.sf_s1 = agg.home;
            dbLive.sf_s2 = agg.away;
        }

        // GF
        if (gf.length >= 1) {
            dbLive.gf_t1 = getTeamFromDB(gf[0], true);
            dbLive.gf_t2 = getTeamFromDB(gf[0], false);
            const agg = getAggScore(gf[0], undefined);
            dbLive.gf_s1 = agg.home;
            dbLive.gf_s2 = agg.away;
        }

        // 실시간 승자 예측
        const predictWinner = (t1: any, s1: string, t2: any, s2: string) => {
            if (!t1 || !t2 || s1 === '' || s2 === '') return null;
            if (Number(s1) > Number(s2)) return t1;
            if (Number(s2) > Number(s1)) return t2;
            return null;
        };

        if (!dbLive.sf_t1) dbLive.sf_t1 = predictWinner(dbLive.qf1_t1, dbLive.qf1_s1, dbLive.qf1_t2, dbLive.qf1_s2);
        if (!dbLive.sf_t2) dbLive.sf_t2 = predictWinner(dbLive.qf2_t1, dbLive.qf2_s1, dbLive.qf2_t2, dbLive.qf2_s2);
        if (!dbLive.gf_t2) dbLive.gf_t2 = predictWinner(dbLive.sf_t1, dbLive.sf_s1, dbLive.sf_t2, dbLive.sf_s2);
    }

    const renderScore = (score: string) => {
        if (!score || score === '') return null;
        return (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[22px] font-black text-emerald-400 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] z-40 bg-black/50 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                {score}
            </div>
        );
    };

    return (
        <div className="w-full flex flex-col items-center gap-10 md:gap-16 relative">
            
            {/* Level 1: GRAND FINAL */}
            <div className="flex flex-col items-center w-full relative">
                <div className="text-center mb-6">
                    <span className="text-[16px] font-black italic tracking-widest text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)] uppercase">👑 챔피언 결정전 (GRAND FINAL)</span>
                </div>
                <div className="relative flex flex-col p-4 sm:p-5 rounded-3xl border transition-all w-full max-w-[340px] bg-slate-900/40 border-yellow-500/50 shadow-xl shadow-yellow-900/20">
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 relative items-center">
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                            <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-slate-700 text-[9px] font-black text-slate-500 italic shadow-lg">VS</div>
                        </div>

                        <div className="relative min-h-[96px] sm:min-h-[110px] rounded-xl border-2 border-slate-800/50 bg-black/20 cursor-default flex flex-col items-center justify-center transition-all group overflow-hidden">
                            <span className="absolute -top-0 w-full bg-slate-800 text-slate-400 text-[8px] font-black py-0.5 text-center tracking-widest uppercase z-10">정규리그 1위 직행</span>
                            {dbLive.gf_t1 ? (
                                <div className="w-full h-full pt-4 relative">
                                    <TeamCard team={dbLive.gf_t1} size="small" className="w-full h-full border-none shadow-none bg-transparent flex items-center justify-center grayscale opacity-80" />
                                    {renderScore(dbLive.gf_s1)}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center transition-colors text-slate-700">
                                    <span className="text-xl font-black">+</span>
                                    <span className="text-[9px] font-bold">EMPTY</span>
                                </div>
                            )}
                        </div>

                        <div className={`relative min-h-[96px] sm:min-h-[110px] rounded-xl border-2 border-slate-800 flex flex-col items-center justify-center transition-all overflow-hidden ${dbLive.gf_t2 ? 'bg-slate-900/40' : 'bg-slate-900/80'}`}>
                            <span className="absolute -top-0 w-full bg-slate-800 text-slate-400 text-[8px] font-black py-0.5 text-center tracking-widest uppercase z-10">최종 도전자</span>
                            {dbLive.gf_t2 ? (
                                <div className="w-full h-full pt-4 pointer-events-none relative">
                                    <TeamCard team={dbLive.gf_t2} size="small" className="w-full h-full border-none shadow-none bg-transparent flex items-center justify-center grayscale opacity-80" />
                                    {renderScore(dbLive.gf_s2)}
                                </div>
                            ) : (
                                <>
                                    <span className="text-2xl text-slate-600 mb-1 mt-3">⚔️</span>
                                    <span className="text-[9px] font-bold text-slate-500 tracking-widest leading-tight text-center px-1">PO 결승 승자</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Level 2: PO FINAL */}
            <div className="flex flex-col items-center w-full relative">
                <div className="text-center mb-6">
                    <span className="text-[14px] font-black italic tracking-widest text-emerald-500 uppercase">🔥 플레이오프 결승 (PO FINAL)</span>
                </div>
                <div className="relative flex flex-col p-4 sm:p-5 rounded-3xl border w-full max-w-[340px] bg-slate-900/40 border-slate-800/50 opacity-80 pointer-events-none">
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 relative items-center">
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                            <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-slate-700 text-[9px] font-black text-slate-500 italic shadow-lg">VS</div>
                        </div>
                        {[
                            { label: "PO 4강 1경기 승자", team: dbLive.sf_t1, score: dbLive.sf_s1 },
                            { label: "PO 4강 2경기 승자", team: dbLive.sf_t2, score: dbLive.sf_s2 }
                        ].map((slot, sIdx) => (
                            <div key={sIdx} className={`relative min-h-[96px] sm:min-h-[110px] rounded-xl border-2 border-slate-800 flex flex-col items-center justify-center transition-all overflow-hidden ${slot.team ? 'bg-slate-900/40' : 'bg-slate-900/80'}`}>
                                {slot.team ? (
                                    <div className="w-full h-full relative pointer-events-none">
                                        <TeamCard team={slot.team} size="small" className="w-full h-full border-none shadow-none bg-transparent flex items-center justify-center grayscale opacity-80" />
                                        {renderScore(slot.score)}
                                    </div>
                                ) : (
                                    <>
                                        <span className="text-2xl text-slate-600 mb-1">⚔️</span>
                                        <span className="text-[9px] font-bold text-slate-500 tracking-widest leading-tight text-center px-1">{slot.label}</span>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Level 3: PO 4강 */}
            <div className="w-full flex flex-col items-center relative">
                <div className="text-center mb-6">
                    <span className="text-[14px] font-black italic tracking-widest text-emerald-500 uppercase">⚔️ 플레이오프 4강 (QUARTER-FINAL)</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 relative w-full max-w-7xl mx-auto justify-items-center">
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-800 hidden lg:block opacity-20"></div>
                    
                    {[
                        { title: 'PO 4강 1경기', slot1Title: '정규리그 2위', score1: dbLive.qf1_s1, slot2Title: '정규리그 5위', score2: dbLive.qf1_s2, team1: dbLive.qf1_t1, team2: dbLive.qf1_t2 },
                        { title: 'PO 4강 2경기', slot1Title: '정규리그 3위', score1: dbLive.qf2_s1, slot2Title: '정규리그 4위', score2: dbLive.qf2_s2, team1: dbLive.qf2_t1, team2: dbLive.qf2_t2 }
                    ].map((matchData, mIdx) => {
                        const isInnerCivilWar = matchData.team1 && matchData.team2 && (matchData.team1.ownerUid === matchData.team2.ownerUid || matchData.team1.ownerName === matchData.team2.ownerName);

                        return (
                            <div key={mIdx} className="relative flex flex-col p-4 sm:p-5 rounded-3xl border transition-all w-full max-w-[340px] bg-slate-900/20 border-slate-800/50">
                                <div className="text-center mb-4 border-b border-slate-800/50 pb-2">
                                    <span className="text-[10px] text-emerald-500 font-black italic tracking-widest uppercase">{matchData.title}</span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 sm:gap-4 relative items-center">
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                                        <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-slate-700 text-[9px] font-black text-slate-500 italic shadow-lg">VS</div>
                                    </div>

                                    {[
                                        { title: matchData.slot1Title, team: matchData.team1, score: matchData.score1 },
                                        { title: matchData.slot2Title, team: matchData.team2, score: matchData.score2 }
                                    ].map(({ title, team, score }, idx) => (
                                        <div key={idx} className="relative min-h-[96px] sm:min-h-[110px] rounded-xl border-2 border-slate-800/50 bg-black/20 cursor-default flex flex-col items-center justify-center transition-all group overflow-hidden">
                                            <span className="absolute -top-0 w-full bg-slate-800 text-slate-400 text-[8px] font-black py-0.5 text-center tracking-widest uppercase z-10">{title}</span>
                                            {team ? (
                                                <div className="w-full h-full pt-4 relative">
                                                    <TeamCard team={team} size="small" className="w-full h-full border-none shadow-none bg-transparent flex items-center justify-center grayscale opacity-80" />
                                                    {renderScore(score)}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center pt-3 transition-colors text-slate-700">
                                                    <span className="text-xl font-black">+</span>
                                                    <span className="text-[9px] font-bold">EMPTY</span>
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
            </div>
        </div>
    );
};