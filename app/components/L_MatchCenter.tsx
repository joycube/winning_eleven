"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { CalendarDays, MessageSquare, ChevronRight, Clock } from 'lucide-react'; 
import { FALLBACK_IMG } from '../types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { calculateMatchSnapshot } from '../utils/predictor'; 

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

const RecentMatchTalkPreview = ({ match, owners, onEnter }: any) => {
    const [latestComment, setLatestComment] = useState<any>(null);
    useEffect(() => {
        if (!match.id) return;
        const q = query(collection(db, 'match_comments'), where('matchId', '==', match.id));
        const unsubscribe = onSnapshot(q, (snap) => {
            const docs = snap.docs.map((d: any) => d.data());
            if (docs.length > 0) {
                docs.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
                setLatestComment(docs[0]);
            } else { setLatestComment(null); }
        });
        return () => unsubscribe();
    }, [match.id]);
    const getOwnerProfileLocal = (uid: string, name: string) => {
        const found = owners?.find((o:any) => o.uid === uid || o.nickname === name);
        return found?.photo || FALLBACK_IMG;
    };
    return (
        <div onClick={onEnter} className="bg-[#080d1a] border-t border-slate-800/80 py-3 px-4 sm:px-6 flex items-center justify-between group/talk cursor-pointer hover:bg-[#0b1221] transition-colors">
            {latestComment ? (
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <img src={getOwnerProfileLocal(latestComment.authorUid, latestComment.authorName)} className="w-5 h-5 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0" alt="" onError={(e:any)=>{e.target.src=FALLBACK_IMG}} />
                    <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-[10px] font-black text-blue-400 shrink-0">{latestComment.authorName}</span>
                        <span className="text-[11px] text-slate-300 font-medium truncate">{latestComment.text?.startsWith('[STICKER]') ? '(스티커를 보냈습니다 ✨)' : latestComment.text}</span>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 min-w-0 flex-1 opacity-70 group-hover/talk:opacity-100 transition-opacity">
                    <MessageSquare size={12} className="text-slate-500 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-400 truncate">가장 먼저 코멘트를 남겨보세요!</span>
                </div>
            )}
            <div className="flex items-center text-[9px] font-black text-slate-500 group-hover/talk:text-blue-400 transition-colors shrink-0 pl-3">매치톡 입장 <ChevronRight size={12} className="ml-0.5" /></div>
        </div>
    );
};

export default function L_MatchCenter({ seasons, masterTeams, owners, isDataLoading, selectedSeasonId, setSelectedSeasonId, onNavigateToMatch, activeOrLatestSeason, activeRankingData, historyData }: any) {
    const [matchTab, setMatchTab] = useState<'UPCOMING' | 'RECENT'>('UPCOMING');
    const currentDashboardSeason = useMemo(() => seasons?.find((s: any) => s.id === selectedSeasonId) || activeOrLatestSeason, [seasons, selectedSeasonId, activeOrLatestSeason]);
    
    const getTeamMasterInfo = (teamName: string) => {
        if (!teamName || !masterTeams) return undefined;
        const target = teamName.replace(/\s+/g, '').toLowerCase();
        return masterTeams.find((t: any) => (t.name || t.teamName || '').replace(/\s+/g, '').toLowerCase() === target);
    };

    const getRealLogoLocal = (teamName: string, fallback: string) => (!teamName || teamName === 'TBD' || teamName === 'BYE') ? (fallback || FALLBACK_IMG) : (getTeamMasterInfo(teamName)?.logo || fallback || FALLBACK_IMG);

    const processedRounds = useMemo(() => {
        if (!currentDashboardSeason || !currentDashboardSeason.rounds) return [];
        const displayRounds = JSON.parse(JSON.stringify(currentDashboardSeason.rounds));

        const fillTeamData = (match: any, side: 'home' | 'away', teamName: string) => {
            match[side] = teamName;
            const master = getTeamMasterInfo(teamName);
            match[`${side}Logo`] = master?.logo || FALLBACK_IMG;
            const owner = owners?.find((o:any) => o.nickname === master?.ownerName || o.legacyName === master?.ownerName);
            match[`${side}Owner`] = owner?.nickname || master?.ownerName || '-';
            match[`${side}OwnerUid`] = owner?.uid || master?.ownerUid || '';
        };

        if (currentDashboardSeason.type === 'LEAGUE_PLAYOFF') {
            const calcAgg = (leg1: any, leg2: any) => {
                if (!leg1) return null;
                let s1 = 0, s2 = 0;
                let isLeg1Done = leg1.status === 'COMPLETED';
                let isLeg2Done = leg2 && leg2.status === 'COMPLETED';
                const t1 = leg1.home; const t2 = leg1.away;
                if (isLeg1Done) { s1 += Number(leg1.homeScore); s2 += Number(leg1.awayScore); }
                if (isLeg2Done && leg2) { 
                    if (leg2.home === t2) { s2 += Number(leg2.homeScore); s1 += Number(leg2.awayScore); } 
                    else { s1 += Number(leg2.homeScore); s2 += Number(leg2.awayScore); }
                }
                let aggWinner = 'TBD';
                if (leg2 && leg2.aggWinner && leg2.aggWinner !== 'TBD') aggWinner = leg2.aggWinner;
                else if (leg1 && leg1.aggWinner && leg1.aggWinner !== 'TBD') aggWinner = leg1.aggWinner;
                else if (isLeg1Done && (!leg2 || isLeg2Done)) {
                    if (s1 > s2) aggWinner = t1; else if (s2 > s1) aggWinner = t2;
                }
                return { ...leg1, aggWinner };
            };
            const po4Rounds = displayRounds.filter((r: any) => r.name === 'ROUND_OF_4').flatMap((r: any) => r.matches);
            const poFinalRounds = displayRounds.filter((r: any) => r.name === 'SEMI_FINAL').flatMap((r: any) => r.matches);
            const grandFinalRounds = displayRounds.filter((r: any) => r.name === 'FINAL').flatMap((r: any) => r.matches);
            const poSemi1_leg1 = po4Rounds.find((m: any) => m.matchLabel?.includes('5위') && m.matchLabel?.includes('1차전'));
            const poSemi1_leg2 = po4Rounds.find((m: any) => m.matchLabel?.includes('2위') && m.matchLabel?.includes('2차전'));
            const poSemi2_leg1 = po4Rounds.find((m: any) => m.matchLabel?.includes('4위') && m.matchLabel?.includes('1차전'));
            const poSemi2_leg2 = po4Rounds.find((m: any) => m.matchLabel?.includes('3위') && m.matchLabel?.includes('2차전'));
            const compSemi1 = calcAgg(poSemi1_leg1, poSemi1_leg2);
            const compSemi2 = calcAgg(poSemi2_leg1, poSemi2_leg2);
            if (compSemi1?.aggWinner && compSemi1.aggWinner !== 'TBD') poFinalRounds.forEach((m: any) => fillTeamData(m, 'home', compSemi1.aggWinner));
            if (compSemi2?.aggWinner && compSemi2.aggWinner !== 'TBD') poFinalRounds.forEach((m: any) => fillTeamData(m, 'away', compSemi2.aggWinner));
            const poFinal_leg1 = poFinalRounds.find((m: any) => m.matchLabel?.includes('1차전'));
            const poFinal_leg2 = poFinalRounds.find((m: any) => m.matchLabel?.includes('2차전'));
            const compPoFinal = calcAgg(poFinal_leg1, poFinal_leg2);
            if (compPoFinal?.aggWinner && compPoFinal.aggWinner !== 'TBD') grandFinalRounds.forEach((m: any) => fillTeamData(m, 'away', compPoFinal.aggWinner));
        }
        return displayRounds;
    }, [currentDashboardSeason, masterTeams, owners]);

    const upcomingMatchesList = useMemo(() => {
        const matches: any[] = [];
        processedRounds.forEach((r: any) => r.matches?.forEach((m: any) => { 
            const isNotPlayed = m.status === 'SCHEDULED' || m.status === 'PENDING' || (!m.homeScore && !m.awayScore && m.status !== 'COMPLETED');
            if (isNotPlayed && m.home !== 'BYE' && m.away !== 'BYE') matches.push({ ...m, matchLabel: r.name }); 
        }));
        return matches.slice(0, 5);
    }, [processedRounds]);

    const recentMatchesList = useMemo(() => {
        const matches: any[] = [];
        processedRounds.forEach((r: any) => r.matches?.forEach((m: any) => { if (m.status === 'COMPLETED' && m.home !== 'BYE' && m.away !== 'BYE') matches.push({ ...m, matchLabel: r.name }); }));
        return matches.reverse().slice(0, 5); 
    }, [processedRounds]);

    useEffect(() => { if (!isDataLoading) { if (upcomingMatchesList.length === 0 && recentMatchesList.length > 0) setMatchTab('RECENT'); else if (upcomingMatchesList.length > 0) setMatchTab('UPCOMING'); } }, [selectedSeasonId, isDataLoading, upcomingMatchesList.length, recentMatchesList.length]);

    const renderRankCondition = (rank?: number, condition?: string) => {
        const rColors = rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-orange-400' : 'text-slate-400';
        const cConfig: any = { 'A': '↑', 'B': '↗', 'C': '→', 'D': '↘', 'E': '⬇' };
        const cColor: any = { 'A': 'text-emerald-400', 'B': 'text-teal-400', 'C': 'text-slate-400', 'D': 'text-orange-400', 'E': 'text-red-500' };
        const cond = condition?.toUpperCase() || 'C';
        return (
            <div className="flex items-center gap-1 text-[9px] font-black bg-slate-950 px-1.5 py-[2px] rounded border border-slate-700/50 shadow-inner shrink-0">
                {rank && rank > 0 ? <span className={rColors}>R.{rank}</span> : <span className="text-slate-600">R.-</span>}
                <span className={cColor[cond]}>{cConfig[cond]}</span>
            </div>
        );
    };

    const renderMatchRow = (m: any, isRecent: boolean) => {
        const homeMaster = getTeamMasterInfo(m.home);
        const awayMaster = getTeamMasterInfo(m.away);
        let hRate = 50, aRate = 50;
        
        if (!isRecent && m.home !== 'TBD' && m.away !== 'TBD' && m.home !== 'BYE' && m.away !== 'BYE') {
            const savedHome = Number(m.homePredictRate);
            const savedAway = Number(m.awayPredictRate);

            if (!isNaN(savedHome) && !isNaN(savedAway) && (savedHome > 0 || savedAway > 0)) {
                hRate = savedHome;
                aRate = savedAway;
            } else {
                try {
                    const safeHistory = historyData || { allTimeStats: [] };
                    const predictionSnapshot = calculateMatchSnapshot(m.home, m.away, activeRankingData, safeHistory, masterTeams || []);
                    
                    if (predictionSnapshot) { 
                        hRate = predictionSnapshot.homePredictRate || 50; 
                        aRate = predictionSnapshot.awayPredictRate || 50; 
                    }
                } catch (e) { 
                    console.warn("Prediction Engine Error:", e);
                    hRate = 50; aRate = 50;
                }
            }
        }

        return (
            <div className="flex flex-col bg-slate-900/40 relative pt-3 sm:pt-4 transition-colors group">
                <div className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-10 w-full flex justify-center px-4 pointer-events-none">
                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold bg-[#0b1221] px-3 py-1 rounded-full border border-slate-800 uppercase tracking-widest">{m.matchLabel || 'MATCH'}</span>
                </div>
                <div onClick={() => isRecent && onNavigateToMatch(m)} className={`flex justify-between items-center px-2 pb-5 pt-8 sm:px-6 sm:pb-6 sm:pt-10 ${isRecent ? 'hover:bg-slate-800/40 cursor-pointer' : ''}`}>
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 justify-end min-w-0">
                        <div className="flex flex-col items-end gap-0.5 min-w-0 mt-1">
                            <span className="text-[13px] sm:text-[15px] font-black text-white truncate max-w-[140px] italic pr-2 leading-none mb-0.5">{m.home}</span>
                            {m.home !== 'TBD' && renderRankCondition(homeMaster?.real_rank, homeMaster?.condition)}
                            <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold italic truncate max-w-[140px] pr-2 mt-0.5">{m.homeOwner || homeMaster?.ownerName || '-'}</span>
                        </div>
                        <div className="relative w-10 h-10 sm:w-12 sm:h-12 shrink-0">
                            <div className="w-full h-full bg-white rounded-full p-1.5 flex items-center justify-center overflow-hidden shadow-md">
                                <img src={getRealLogoLocal(m.home, m.homeLogo)} className="w-[85%] h-[85%] object-contain" alt="" onError={(e:any)=>{e.target.src=FALLBACK_IMG}} />
                            </div>
                        </div>
                    </div>
                    <div className="w-[50px] sm:w-[70px] shrink-0 flex flex-col items-center justify-center px-1 z-10">
                        {isRecent ? (
                            <div className="flex items-center gap-1 text-[20px] sm:text-[24px] font-black italic tracking-tighter leading-none">
                                <span className={Number(m.homeScore) > Number(m.awayScore) ? 'text-emerald-400' : 'text-slate-200'}>{m.homeScore}</span>
                                <span className="text-slate-600 text-sm">:</span>
                                <span className={Number(m.awayScore) > Number(m.homeScore) ? 'text-emerald-400' : 'text-slate-200'}>{m.awayScore}</span>
                            </div>
                        ) : <span className="text-[12px] sm:text-[14px] font-black text-slate-600 italic">VS</span>}
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 justify-start min-w-0">
                        <div className="relative w-10 h-10 sm:w-12 sm:h-12 shrink-0">
                            <div className="w-full h-full bg-white rounded-full p-1.5 flex items-center justify-center overflow-hidden shadow-md">
                                <img src={getRealLogoLocal(m.away, m.awayLogo)} className="w-[85%] h-[85%] object-contain" alt="" onError={(e:any)=>{e.target.src=FALLBACK_IMG}} />
                            </div>
                        </div>
                        <div className="flex flex-col items-start gap-0.5 min-w-0 mt-1">
                            <span className="text-[13px] sm:text-[15px] font-black text-white truncate max-w-[140px] italic pr-2 leading-none mb-0.5">{m.away}</span>
                            {m.away !== 'TBD' && renderRankCondition(awayMaster?.real_rank, awayMaster?.condition)}
                            <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold italic truncate max-w-[140px] pl-0.5 pr-2 mt-0.5">{m.awayOwner || awayMaster?.ownerName || '-'}</span>
                        </div>
                    </div>
                </div>
                {!isRecent && m.home !== 'TBD' && m.away !== 'TBD' && (
                    <div className="px-8 sm:px-12 pb-4 flex flex-col gap-1 w-full max-w-[320px] mx-auto opacity-80 pointer-events-none mt-[-5px]">
                        <div className="flex justify-between text-[8px] font-black px-1">
                            <span className="text-emerald-500">{hRate}%</span>
                            <span className="text-slate-600 tracking-widest uppercase italic">WIN PROBABILITY</span>
                            <span className="text-blue-500">{aRate}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full flex overflow-hidden shadow-inner">
                            <div style={{ width: `${hRate}%` }} className="h-full bg-emerald-500" />
                            <div style={{ width: `${aRate}%` }} className="h-full bg-blue-500" />
                        </div>
                    </div>
                )}
                {isRecent && <RecentMatchTalkPreview match={m} owners={owners} onEnter={() => onNavigateToMatch(m)} />}
            </div>
        );
    };

    return (
        // 🚨 픽스: mb-8 (약 32px 띄움) 옵션을 제거하여 하단 여백을 최소화 (mb-2로 수정)
        <div className="mt-6 mb-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 px-1 gap-3">
                <h3 className="text-sm font-black text-white italic tracking-widest uppercase flex items-center gap-2 shrink-0"><CalendarDays size={16} className="text-blue-500" /> MATCH CENTER</h3>
                {seasons && seasons.length > 0 && (
                    <div className="relative w-full sm:w-auto min-w-[200px]">
                        <select value={selectedSeasonId || ''} onChange={(e) => setSelectedSeasonId(Number(e.target.value))} className="w-full appearance-none bg-slate-950 border border-slate-700 text-white text-xs font-bold py-2 pl-3 pr-8 rounded-lg outline-none focus:border-blue-500 shadow-sm cursor-pointer">
                            {seasons.map((s:any) => {
                                let icon = '🏳️'; if (s.type === 'CUP') icon = '🏆'; if (s.type === 'TOURNAMENT') icon = '⚔️'; if (s.type === 'LEAGUE_PLAYOFF') icon = '⭐';
                                const pureName = s.name.replace(/^(🏆|🏳️|⚔️|⚽|🗓️|⭐)\s*/, '');
                                return <option key={s.id} value={s.id}>{icon} {pureName}</option>;
                            })}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                )}
            </div>
            <div className="bg-[#050b14] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="flex border-b border-slate-800 h-[45px] bg-slate-950/50">
                    <button onClick={() => setMatchTab('UPCOMING')} className={`flex-1 h-full flex justify-center items-center gap-1.5 text-[11px] font-black tracking-widest transition-all ${matchTab === 'UPCOMING' ? 'bg-slate-900 text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300'}`}><CalendarDays size={14}/> UPCOMING</button>
                    <button onClick={() => setMatchTab('RECENT')} className={`flex-1 h-full flex justify-center items-center gap-1.5 text-[11px] font-black tracking-widest transition-all ${matchTab === 'RECENT' ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}><Clock size={14}/> RECENT</button>
                </div>
                <div className="flex flex-col bg-[#050b14]">
                    {(matchTab === 'UPCOMING' ? upcomingMatchesList : recentMatchesList).length > 0 ? (
                        <div className="flex flex-col divide-y divide-slate-800/80">
                            {(matchTab === 'UPCOMING' ? upcomingMatchesList : recentMatchesList).map((match: any, idx: number) => <React.Fragment key={idx}>{renderMatchRow(match, matchTab === 'RECENT')}</React.Fragment>)}
                        </div>
                    ) : (
                        <div className="bg-slate-900/30 p-8 flex flex-col items-center justify-center text-center">
                            <CalendarDays size={32} className="text-slate-600 mb-2 opacity-50" /><span className="text-xs font-bold text-slate-500">매치 기록이 없습니다.</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}