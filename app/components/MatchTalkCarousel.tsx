"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useMemo } from 'react';
import { MessageSquare } from 'lucide-react'; // 🔥 더보기(ChevronRight) 아이콘 삭제
import { Season, Owner, MasterTeam, Match, FALLBACK_IMG } from '../types';

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

const getTimestamp = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
};

interface MatchTalkCarouselProps {
    seasons: Season[];
    matchCommentsData: any[];
    owners: Owner[];
    masterTeams: MasterTeam[];
    onNavigateToMatch: (params: { id: string, seasonId: number }) => void;
    // 🔥 onViewAll 프로퍼티 완전 삭제
}

export const MatchTalkCarousel = ({ 
    seasons, 
    matchCommentsData, 
    owners, 
    masterTeams, 
    onNavigateToMatch
}: MatchTalkCarouselProps) => {

    // 🔥 [TBD 픽스] 카루셀 내부에서도 플레이오프 합산 스코어를 계산하여 TBD를 실제 팀으로 뚫어줍니다.
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

            // 🔥 TBD가 해결된 processedSeasons를 돌면서 매치를 찾습니다.
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

    const getTeamTier = (teamName: string) => {
        if (!teamName || teamName === 'TBD' || teamName === 'BYE') return null;
        const mt = masterTeams.find(m => m.name === teamName);
        return mt?.tier || 'C';
    };

    const renderTierBadge = (tier: string | null) => {
        if (!tier) return null;
        const t = tier.toUpperCase();
        let colors = t === 'S' ? 'bg-yellow-500 text-black' : 
                     t === 'A' ? 'bg-slate-300 text-black' : 
                     t === 'B' ? 'bg-amber-600 text-white' : 
                     t === 'D' ? 'bg-orange-600 text-white' : 
                     'bg-slate-700 text-slate-300';
        return (
            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black leading-none shadow-sm ${colors}`}>
                {t}
            </span>
        );
    };

    if (recentActiveMatches.length === 0) return null; 

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-sm font-black text-white italic tracking-widest uppercase flex items-center gap-2">
                    <MessageSquare size={16} className="text-blue-500" /> LIVE MATCH TALK
                </h3>
            </div>

            <div className="flex overflow-x-auto gap-4 no-scrollbar pb-4 snap-x snap-mandatory px-1">
                {recentActiveMatches.map((item, idx) => {
                    if (!item) return null;
                    const { match, seasonId, latestComment, totalComments } = item;
                    const hTier = getTeamTier(match.home);
                    const aTier = getTeamTier(match.away);
                    const isCompleted = match.status === 'COMPLETED';

                    return (
                        <div 
                            key={match.id} 
                            onClick={() => onNavigateToMatch({ id: match.id, seasonId })}
                            className="min-w-[280px] sm:min-w-[320px] max-w-[320px] shrink-0 snap-center bg-[#0a0f1a] border border-slate-800 hover:border-slate-600 rounded-2xl overflow-hidden cursor-pointer transition-all hover:-translate-y-1 shadow-xl flex flex-col group"
                        >
                            <div className="bg-slate-950/80 px-4 py-2 border-b border-slate-800/50 flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">
                                    🏆 {match.matchLabel || match.stage}
                                </span>
                            </div>

                            <div className="p-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                <div className="flex flex-col items-center gap-1.5 min-w-0">
                                    <div className="w-10 h-10 bg-white rounded-full p-1.5 shadow-md flex items-center justify-center">
                                        <img src={match.homeLogo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                                    </div>
                                    <div className="flex flex-col items-center min-w-0 w-full text-center">
                                        <div className="flex items-center gap-1 justify-center w-full">
                                            {renderTierBadge(hTier)}
                                            <span className="text-xs font-black text-white truncate leading-tight">{match.home}</span>
                                        </div>
                                        <span className="text-[9px] text-slate-500 font-bold truncate w-full mt-0.5">{match.homeOwner}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center justify-center px-2">
                                    {isCompleted ? (
                                        <div className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5 shadow-inner">
                                            <span className="text-lg font-black text-emerald-400">{match.homeScore}</span>
                                            <span className="text-slate-600 text-xs">:</span>
                                            <span className="text-lg font-black text-emerald-400">{match.awayScore}</span>
                                        </div>
                                    ) : (
                                        <span className="text-xs font-black text-slate-600 italic bg-slate-900 px-2 py-1 rounded-md border border-slate-800">VS</span>
                                    )}
                                </div>

                                <div className="flex flex-col items-center gap-1.5 min-w-0">
                                    <div className="w-10 h-10 bg-white rounded-full p-1.5 shadow-md flex items-center justify-center">
                                        <img src={match.awayLogo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                                    </div>
                                    <div className="flex flex-col items-center min-w-0 w-full text-center">
                                        <div className="flex items-center gap-1 justify-center w-full">
                                            <span className="text-xs font-black text-white truncate leading-tight">{match.away}</span>
                                            {renderTierBadge(aTier)}
                                        </div>
                                        <span className="text-[9px] text-slate-500 font-bold truncate w-full mt-0.5">{match.awayOwner}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto bg-slate-900/60 p-3 sm:p-4 border-t border-slate-800/80 flex items-start gap-3 group-hover:bg-slate-800/40 transition-colors">
                                <img 
                                    src={getOwnerProfile(latestComment.authorUid, latestComment.authorName)} 
                                    onError={(e:any) => { e.target.src = DEFAULT_AVATAR; }}
                                    className="w-7 h-7 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0" 
                                    alt="" 
                                />
                                <div className="flex flex-col min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2 mb-0.5">
                                        <span className="text-[10px] font-black text-blue-400 truncate">{latestComment.authorName}</span>
                                        <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded-full border border-emerald-900/50 shrink-0">
                                            💬 +{totalComments}
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-300 font-medium line-clamp-2 leading-snug">
                                        {latestComment.text?.startsWith('[STICKER]') ? '(스티커를 보냈습니다 ✨)' : latestComment.text}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {/* 🔥 더보기 카드 삭제됨 */}
            </div>
        </div>
    );
};