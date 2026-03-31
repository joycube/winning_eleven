"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import { Season, Owner, MasterTeam, Match, FALLBACK_IMG } from '../types';

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

const getTimestamp = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
};

// 🔥 리얼 랭크 & 폼(컨디션) 렌더러
const renderRankCondition = (rank?: number, condition?: string) => {
    const rColors = rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-orange-400' : 'text-slate-400';
    const cConfig: any = { 'A': '↑', 'B': '↗', 'C': '→', 'D': '↘', 'E': '⬇' };
    const cColor: any = { 'A': 'text-emerald-400', 'B': 'text-teal-400', 'C': 'text-slate-400', 'D': 'text-orange-400', 'E': 'text-red-500' };
    const cond = condition?.toUpperCase() || 'C';
    
    return (
        <div className="flex items-center gap-1 text-[9px] font-black bg-slate-950 px-1.5 py-[2px] rounded border border-slate-700/50 shadow-inner shrink-0 mb-0.5">
            {rank && rank > 0 ? <span className={rColors}>R.{rank}</span> : <span className="text-slate-600">R.-</span>}
            <span className={cColor[cond]}>{cConfig[cond]}</span>
        </div>
    );
};

// 🔥 엠블럼 오버레이 뱃지 렌더러
const renderTierOverlay = (tier?: string) => {
    const t = (tier || 'C').toUpperCase();
    let colors = t === 'S' ? 'bg-yellow-500 text-black border-yellow-200' : 
                 t === 'A' ? 'bg-slate-300 text-black border-white' : 
                 t === 'B' ? 'bg-amber-600 text-white border-amber-400' : 
                 t === 'D' ? 'bg-orange-600 text-white border-orange-400' :
                 'bg-slate-800 text-slate-400 border-slate-700';
    return (
        <div className={`absolute -bottom-1 -right-1 flex items-center justify-center w-5 h-5 rounded-full border-[2px] border-[#0a0f1a] font-black text-[10px] z-20 shadow-md ${colors}`}>
            {t}
        </div>
    );
};

interface MatchTalkCarouselProps {
    seasons: Season[];
    matchCommentsData: any[];
    owners: Owner[];
    masterTeams: MasterTeam[];
    onNavigateToMatch: (params: { id: string, seasonId: number }) => void;
}

export const MatchTalkCarousel = ({ 
    seasons, 
    matchCommentsData, 
    owners, 
    masterTeams, 
    onNavigateToMatch
}: MatchTalkCarouselProps) => {

    const processedSeasons = useMemo(() => {
        return seasons.map(season => {
            if (season.type !== 'LEAGUE_PLAYOFF' || !season.rounds) return season;
            
            const clonedRounds = JSON.parse(JSON.stringify(season.rounds));

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
                    if (s1 > s2) aggWinner = t1;
                    else if (s2 > s1) aggWinner = t2;
                }
                return { ...leg1, aggWinner };
            };

            const fillTeamData = (match: any, side: 'home' | 'away', teamName: string) => {
                match[side] = teamName;
                const master = masterTeams.find((m: any) => m.name === teamName);
                match[`${side}Logo`] = master?.logo || FALLBACK_IMG;
                const owner = owners.find(o => o.nickname === master?.ownerName || o.legacyName === master?.ownerName);
                match[`${side}Owner`] = owner?.nickname || master?.ownerName || '-';
                match[`${side}OwnerUid`] = owner?.uid || master?.ownerUid || '';
            };

            const po4Rounds = clonedRounds.filter((r: any) => r.name === 'ROUND_OF_4').flatMap((r: any) => r.matches);
            const poFinalRounds = clonedRounds.filter((r: any) => r.name === 'SEMI_FINAL').flatMap((r: any) => r.matches);
            const grandFinalRounds = clonedRounds.filter((r: any) => r.name === 'FINAL').flatMap((r: any) => r.matches);

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

            return { ...season, rounds: clonedRounds };
        });
    }, [seasons, masterTeams, owners]);

    const recentActiveMatches = useMemo(() => {
        if (!matchCommentsData || matchCommentsData.length === 0 || !processedSeasons) return [];

        const commentsByMatch: Record<string, any[]> = {};
        
        matchCommentsData.forEach(c => {
            if (!c.matchId) return;
            if (!commentsByMatch[c.matchId]) {
                commentsByMatch[c.matchId] = [];
            }
            commentsByMatch[c.matchId].push(c);
        });

        const sortedMatchIds = Object.keys(commentsByMatch).sort((a, b) => {
            const timeA = getTimestamp(commentsByMatch[a][0].createdAt);
            const timeB = getTimestamp(commentsByMatch[b][0].createdAt);
            return timeB - timeA; 
        });

        const top5 = sortedMatchIds.slice(0, 5).map(matchId => {
            let matchObj: Match | null = null;
            let seasonId: number | null = null;

            for (const s of processedSeasons) {
                for (const r of s.rounds || []) {
                    const found = r.matches?.find((m: Match) => m.id === matchId);
                    if (found) {
                        matchObj = found;
                        seasonId = s.id;
                        break;
                    }
                }
                if (matchObj) break;
            }
            
            if (!matchObj || !seasonId) return null;

            return {
                match: matchObj,
                seasonId,
                latestComment: commentsByMatch[matchId][0],
                totalComments: commentsByMatch[matchId].length
            };
        }).filter(Boolean);

        return top5;
    }, [matchCommentsData, processedSeasons]);

    const getOwnerProfile = (uid: string, fallbackName?: string) => {
        const found = owners?.find(o => 
            o.uid === uid || o.docId === uid || String(o.id) === uid || o.nickname === fallbackName
        );
        const photo = found?.photo || (found as any)?.profileImage || (found as any)?.photoUrl;
        return (photo && photo.trim() !== '') ? photo : DEFAULT_AVATAR;
    };

    const getTeamMasterInfo = (teamName: string) => {
        if (!teamName || teamName === 'TBD' || teamName === 'BYE') return undefined;
        return masterTeams.find(m => m.name === teamName);
    };

    if (recentActiveMatches.length === 0) return null; 

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-sm font-black text-white italic tracking-widest uppercase flex items-center gap-2 pr-2">
                    <MessageSquare size={16} className="text-blue-500" /> LIVE MATCH TALK
                </h3>
            </div>

            <div className="flex overflow-x-auto gap-4 no-scrollbar pt-4 pb-6 snap-x snap-mandatory px-1 -mt-4">
                {recentActiveMatches.map((item, idx) => {
                    if (!item) return null;
                    const { match, seasonId, latestComment, totalComments } = item;
                    
                    const hMaster = getTeamMasterInfo(match.home);
                    const aMaster = getTeamMasterInfo(match.away);
                    
                    const isCompleted = match.status === 'COMPLETED';

                    return (
                        <div 
                            key={match.id} 
                            onClick={() => onNavigateToMatch({ id: match.id, seasonId })}
                            className="min-w-[280px] sm:min-w-[320px] max-w-[320px] shrink-0 snap-center bg-[#0a0f1a] border border-slate-800 hover:border-slate-600 rounded-2xl overflow-hidden cursor-pointer transition-all hover:-translate-y-1 shadow-xl flex flex-col group"
                        >
                            <div className="bg-slate-950/80 px-4 py-2 border-b border-slate-800/50 flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase italic pr-1 leading-snug">
                                    🏆 {match.matchLabel || match.stage}
                                </span>
                            </div>

                            <div className="p-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                {/* Home Team */}
                                <div className="flex flex-col items-center min-w-0">
                                    <div className="relative w-12 h-12 shrink-0 mb-2">
                                        <div className="w-full h-full bg-white rounded-full p-1.5 shadow-md flex items-center justify-center overflow-hidden">
                                            <img src={match.homeLogo} className="w-[85%] h-[85%] object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                                        </div>
                                        {match.home !== 'TBD' && renderTierOverlay(hMaster?.tier)}
                                    </div>
                                    <div className="flex flex-col items-center min-w-0 w-full text-center">
                                        {match.home !== 'TBD' && renderRankCondition(hMaster?.real_rank, hMaster?.condition)}
                                        <span className="text-xs font-black italic text-white truncate leading-tight w-full pr-0.5">{match.home}</span>
                                        <span className="text-[9px] text-slate-500 font-bold italic truncate w-full mt-0.5 pr-1">{match.homeOwner}</span>
                                    </div>
                                </div>

                                {/* Score / VS */}
                                <div className="flex flex-col items-center justify-center px-2">
                                    {isCompleted ? (
                                        <div className="bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1.5 shadow-inner">
                                            <span className="text-xl font-black italic text-emerald-400 pr-1">{match.homeScore}</span>
                                            <span className="text-slate-600 text-sm">:</span>
                                            <span className="text-xl font-black italic text-emerald-400 pr-1">{match.awayScore}</span>
                                        </div>
                                    ) : (
                                        <span className="text-sm font-black text-slate-600 italic bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 pr-1">VS</span>
                                    )}
                                </div>

                                {/* Away Team */}
                                <div className="flex flex-col items-center min-w-0">
                                    <div className="relative w-12 h-12 shrink-0 mb-2">
                                        <div className="w-full h-full bg-white rounded-full p-1.5 shadow-md flex items-center justify-center overflow-hidden">
                                            <img src={match.awayLogo} className="w-[85%] h-[85%] object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                                        </div>
                                        {match.away !== 'TBD' && renderTierOverlay(aMaster?.tier)}
                                    </div>
                                    <div className="flex flex-col items-center min-w-0 w-full text-center">
                                        {match.away !== 'TBD' && renderRankCondition(aMaster?.real_rank, aMaster?.condition)}
                                        <span className="text-xs font-black italic text-white truncate leading-tight w-full pr-0.5">{match.away}</span>
                                        <span className="text-[9px] text-slate-500 font-bold italic truncate w-full mt-0.5 pr-1">{match.awayOwner}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto bg-slate-900/60 p-3 sm:p-4 border-t border-slate-800/80 flex items-center gap-3 group-hover:bg-slate-800/40 transition-colors">
                                <img 
                                    src={getOwnerProfile(latestComment.authorUid, latestComment.authorName)} 
                                    onError={(e:any) => { e.target.src = DEFAULT_AVATAR; }}
                                    className="w-7 h-7 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0" 
                                    alt="" 
                                />
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-[10px] font-black italic text-blue-400 truncate pr-1 leading-none mb-1">{latestComment.authorName}</span>
                                    
                                    <div className="flex items-center gap-1.5 w-full min-w-0">
                                        {latestComment.text?.startsWith('[STICKER]') ? (
                                            <img 
                                                src={latestComment.text.replace('[STICKER]', '')} 
                                                className="h-4 object-contain drop-shadow-md" 
                                                alt="sticker" 
                                                onError={(e:any) => { e.target.style.display = 'none'; }}
                                            />
                                        ) : (
                                            <p className="text-xs text-slate-300 font-medium italic truncate flex-1 min-w-0 leading-none">
                                                {latestComment.text}
                                            </p>
                                        )}
                                        
                                        {/* 🔥 [해결 완료] ml-auto를 통해 뱃지를 무조건 우측 끝으로 강제 밀어냄 */}
                                        <span className="ml-auto text-[9px] font-black italic text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded-full border border-emerald-900/50 shrink-0 self-center">
                                            💬 +{totalComments}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};