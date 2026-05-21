"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore'; 
import { db } from '../firebase'; 
import { Season, Match, MasterTeam, Owner, FALLBACK_IMG } from '../types';
import { MatchCard } from './MatchCard';
import { MessageSquare } from 'lucide-react';

import AdminMatching_TournamentBracketViewDefault, { AdminMatching_TournamentBracketView as AdminMatching_TournamentBracketViewNamed } from './AdminMatching_TournamentBracketView';
const AdminMatching_TournamentBracketView = AdminMatching_TournamentBracketViewDefault || AdminMatching_TournamentBracketViewNamed;

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

const getTodayFormatted = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}.${month}.${day}`;
};

const resolveOwnerInfo = (owners: Owner[], ownerName: string, ownerUid?: string) => {
    if (!ownerName || ['-', 'CPU', 'SYSTEM', 'TBD', 'BYE'].includes(ownerName.trim().toUpperCase())) {
        return { nickname: ownerName, photo: FALLBACK_IMG };
    }
    const search = ownerName.trim();
    const foundUser = owners.find(o => 
        (ownerUid && (o.uid === ownerUid || o.docId === ownerUid)) || 
        (o.uid === search || o.docId === search) ||
        (o.nickname === search || o.legacyName === search || (((o as any).legacyNames || []) as any[]).includes(search) || (o as any).mappedOwnerId === search || (o as any).displayName === search)
    );
    if (foundUser) {
        const actualName = foundUser.nickname || (foundUser as any).mappedOwnerId || (foundUser as any).displayName || ownerName;
        const actualPhoto = foundUser.photo || (foundUser as any).photoURL || FALLBACK_IMG;
        return { nickname: actualName, photo: actualPhoto };
    }
    return { nickname: ownerName, photo: FALLBACK_IMG };
};

const MatchCommentSnippet = ({ matchId, onClick, owners }: { matchId: string, onClick: () => void, owners: Owner[] }) => {
    const [latestComment, setLatestComment] = useState<any>(null);
    const [commentCount, setCommentCount] = useState(0);

    useEffect(() => {
        if (!matchId) return;
        const q = query(collection(db, 'match_comments'), where('matchId', '==', matchId));
        const unsubscribe = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(d => d.data());
            setCommentCount(docs.length);
            if (docs.length > 0) {
                docs.sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));
                setLatestComment(docs[docs.length - 1]);
            } else {
                setLatestComment(null);
            }
        });
        return () => unsubscribe();
    }, [matchId]);

    if (commentCount === 0) return null;

    const authorInfo = latestComment ? resolveOwnerInfo(owners, (latestComment.authorName || latestComment.ownerName) || '', latestComment.authorUid || latestComment.ownerUid) : null;

    return (
        <div onClick={onClick} className="bg-slate-800/60 px-4 py-3 rounded-b-xl border-t border-slate-700/50 flex items-center gap-2 cursor-pointer hover:bg-slate-700/80 transition-colors z-0 -mt-2">
            {authorInfo ? (
                <img src={authorInfo.photo} className="w-4 h-4 rounded-full object-cover border border-slate-600 shrink-0 shadow-sm" alt="profile" />
            ) : (
                <MessageSquare size={13} className="text-emerald-500 shrink-0 mr-1" />
            )}
            <div className="text-[11px] font-black text-emerald-400 shrink-0 max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap pr-1.5">
                {authorInfo ? authorInfo.nickname : ''}
            </div>
            <div className="text-[12px] text-slate-300 flex-1 font-medium line-clamp-1 break-all">
                {latestComment?.text}
            </div>
            <div className="bg-slate-900 px-2 py-0.5 rounded-md text-[9px] font-black text-emerald-500 border border-slate-700 shrink-0 shadow-inner flex items-center leading-none ml-1">
                +{commentCount}
            </div>
        </div>
    );
};

interface CupScheduleProps {
  seasons: Season[];
  viewSeasonId: number;
  onMatchClick: (m: Match) => void;
  masterTeams: MasterTeam[];
  activeRankingData: any;
  historyData: any;
  owners: Owner[]; 
  knockoutStages?: any; 
}

export const CupSchedule = ({ 
  seasons, viewSeasonId, onMatchClick, masterTeams, activeRankingData, historyData, owners = [], knockoutStages 
}: CupScheduleProps) => {

  const currentSeason = seasons.find(s => s.id === viewSeasonId);
  const pureSeasonName = currentSeason?.name?.replace(/^(🏆|🏳️|⚔️|⚽|🗓️)\s*/, '') || 'CUP';
  const matchRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const normalize = (str: string) => str ? str.toString().trim().toLowerCase() : "";

  const getActiveOwner = (matchOwner: string, matchOwnerUid: string | undefined, teamName: string) => {
      const isMatchInvalid = !matchOwner || ['-', 'TBD', 'CPU', 'SYSTEM', 'BYE'].includes(matchOwner.trim().toUpperCase());
      if (!isMatchInvalid) return { name: matchOwner, uid: matchOwnerUid };

      const cleanName = (teamName || '').replace(/\s+/g, '').toLowerCase();
      const master = masterTeams.find(t => (t.name || (t as any).teamName || '').replace(/\s+/g, '').toLowerCase() === cleanName);
      const isMasterInvalid = !master?.ownerName || ['-', 'TBD', 'CPU', 'SYSTEM', 'BYE'].includes(master.ownerName.trim().toUpperCase());
      
      if (!isMasterInvalid && master) return { name: master.ownerName, uid: master.ownerUid };
      return { name: matchOwner, uid: matchOwnerUid };
  };

  const getWinnerName = (match: Match | null): string => {
      if (!match) return 'TBD';
      const home = match.home?.trim();
      const away = match.away?.trim();
      if (home === 'BYE' && away !== 'BYE' && away !== 'TBD') return away;
      if (away === 'BYE' && home !== 'BYE' && home !== 'TBD') return home;
      if (home === 'BYE' || away === 'BYE' || home === 'TBD' || away === 'TBD') return 'TBD';
      if (match.status !== 'COMPLETED') return 'TBD';
      const h = Number(match.homeScore || 0);
      const a = Number(match.awayScore || 0);
      if (h > a) return home;
      if (a > h) return away;
      return 'TBD';
  };

  const getTeamExtendedInfo = (teamName: string) => {
      const tbdTeam = {
          id: 0, name: teamName || 'TBD', logo: SAFE_TBD_LOGO, ownerName: '-', ownerUid: undefined as string | undefined,
          region: '', tier: 'C', realRankScore: 0, realFormScore: 0, condition: 'C', real_rank: null
      };
      if (!teamName || teamName === 'TBD' || teamName === 'BYE') return tbdTeam;

      const normTarget = normalize(teamName);
      const stats = activeRankingData?.teams?.find((t:any) => normalize(t.name) === normTarget);
      const master = (masterTeams as any[])?.find((m:any) => normalize(m.name) === normTarget || normalize(m.teamName || '') === normTarget);
      
      const rawOwnerName = stats?.ownerName || master?.ownerName || 'CPU';
      const rawOwnerUid = stats?.ownerUid || master?.ownerUid;

      return {
          id: stats?.id || master?.id || 0,
          name: teamName,
          logo: stats?.logo || master?.logo || SAFE_TBD_LOGO,
          ownerName: resolveOwnerInfo(owners, rawOwnerName || '', rawOwnerUid).nickname, 
          ownerUid: rawOwnerUid, 
          region: master?.region || '',
          tier: master?.tier || 'C',
          realRankScore: master?.realRankScore,
          realFormScore: master?.realFormScore,
          condition: master?.condition || 'C',
          real_rank: master?.real_rank
      };
  };

  const internalKnockoutStages = useMemo(() => {
    if (!['CUP', 'TOURNAMENT'].includes(currentSeason?.type || '') || !currentSeason?.rounds) return null;
    
    const createPlaceholder = (vId: string, stageName: string): Match => ({ 
        id: vId, home: 'TBD', away: 'TBD', homeScore: '', awayScore: '', status: 'UPCOMING',
        seasonId: viewSeasonId, homeLogo: SAFE_TBD_LOGO, awayLogo: SAFE_TBD_LOGO, homeOwner: '-', awayOwner: '-',
        homeOwnerUid: undefined, awayOwnerUid: undefined,
        homePredictRate: 0, awayPredictRate: 0, stage: stageName, matchLabel: 'TBD', youtubeUrl: '',
        homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], commentary: '' 
    } as Match);

    const slots = {
        roundOf8: Array.from({ length: 4 }, (_, i) => createPlaceholder(`v-r8-${i}`, 'ROUND_OF_8')),
        roundOf4: Array.from({ length: 2 }, (_, i) => createPlaceholder(`v-r4-${i}`, 'SEMI_FINAL')),
        thirdPlace: [createPlaceholder('v-3rd', '3RD_PLACE')],
        final: [createPlaceholder('v-final', 'FINAL')]
    };

    let hasActualRoundOf8 = false;
    let hasActualRoundOf4 = false;
    const groupSet = new Set<string>();

    currentSeason.rounds.forEach((round) => {
        if (!round.matches) return;
        round.matches.forEach((m) => {
            const stage = m.stage?.toUpperCase() || "";
            
            if (stage.includes("GROUP") || stage.includes("조별")) {
                if (m.group) groupSet.add(m.group);
                return;
            }

            const idMatch = m.id.match(/_(\d+)$/);
            const idx = idMatch ? parseInt(idMatch[1], 10) : 0;
            
            if (stage.includes("3RD_PLACE") || stage.includes("34") || stage.includes("THIRD") || stage.includes("3·4위")) {
                slots.thirdPlace[0] = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };
            } else if ((stage.includes("FINAL") || stage.includes("결승")) && !stage.includes("SEMI") && !stage.includes("QUARTER") && !stage.includes("준결승")) {
                slots.final[0] = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };
            } else if (stage.includes("SEMI") || stage.includes("ROUND_OF_4") || stage.includes("4강") || stage.includes("준결승")) {
                if (idx < slots.roundOf4.length) slots.roundOf4[idx] = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };
                hasActualRoundOf4 = true;
            } else if (stage.includes("ROUND_OF_8") || stage.includes("QUARTER") || stage.includes("8강")) {
                if (idx < slots.roundOf8.length) slots.roundOf8[idx] = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };
                hasActualRoundOf8 = true; 
            }
        });
    });

    const needsRoundOf8 = hasActualRoundOf8 || groupSet.size >= 3;
    const teamCount = currentSeason.teams?.length || 0;
    const needsRoundOf4 = hasActualRoundOf4 || teamCount > 2 || groupSet.size > 0;

    const syncWinner = (target: any, side: 'home' | 'away', source: Match | null) => {
        if (!target || !source) return;
        const winner = getWinnerName(source);
        if (winner !== 'TBD' && winner !== 'BYE' && (target[side] === 'TBD' || !target[side] || target[side] === 'BYE')) {
            target[side] = winner;
            const info = getTeamExtendedInfo(winner);
            target[`${side}Logo`] = info.logo;
            target[`${side}Owner`] = info.ownerName;
            target[`${side}OwnerUid`] = info.ownerUid; 
            target[`${side}Id`] = info.id; 
        }
    };

    const syncLoser = (target: any, side: 'home' | 'away', source: Match | null) => {
        if (!target || !source) return;
        const winner = getWinnerName(source);
        if (winner !== 'TBD' && winner !== 'BYE') {
            const loser = winner === source.home ? source.away : source.home;
            if (loser !== 'TBD' && loser !== 'BYE' && (target[side] === 'TBD' || !target[side] || target[side] === 'BYE')) {
                target[side] = loser;
                const info = getTeamExtendedInfo(loser);
                target[`${side}Logo`] = info.logo;
                target[`${side}Owner`] = info.ownerName;
                target[`${side}OwnerUid`] = info.ownerUid; 
                target[`${side}Id`] = info.id; 
            }
        }
    };

    if (needsRoundOf8) {
        syncWinner(slots.roundOf4[0], 'home', slots.roundOf8[0]);
        syncWinner(slots.roundOf4[0], 'away', slots.roundOf8[1]);
        syncWinner(slots.roundOf4[1], 'home', slots.roundOf8[2]);
        syncWinner(slots.roundOf4[1], 'away', slots.roundOf8[3]);
    }
    
    syncWinner(slots.final[0], 'home', slots.roundOf4[0]);
    syncWinner(slots.final[0], 'away', slots.roundOf4[1]);

    syncLoser(slots.thirdPlace[0], 'home', slots.roundOf4[0]);
    syncLoser(slots.thirdPlace[0], 'away', slots.roundOf4[1]);

    return { 
        ...slots, 
        roundOf8: needsRoundOf8 ? slots.roundOf8 : null,
        roundOf4: needsRoundOf4 ? slots.roundOf4 : null 
    };
  }, [currentSeason, viewSeasonId, activeRankingData, masterTeams, owners]);

  const displayStages = currentSeason?.type === 'LEAGUE_PLAYOFF' ? knockoutStages : internalKnockoutStages;

  useEffect(() => {
    if (!currentSeason || !currentSeason.rounds) return; 

    let allMatches: Match[] = [];
    if (displayStages) { 
        currentSeason.rounds.forEach((r) => {
            const groupMatches = (r.matches || []).filter(m => m.stage.toUpperCase().includes('GROUP'));
            allMatches.push(...groupMatches);
        });
        if (displayStages.roundOf8) allMatches.push(...displayStages.roundOf8);
        if (displayStages.roundOf4) allMatches.push(...displayStages.roundOf4);
        if (displayStages.thirdPlace) allMatches.push(...displayStages.thirdPlace); 
        if (displayStages.final) allMatches.push(...displayStages.final);
    } else { 
        currentSeason.rounds.forEach((r) => {
            allMatches.push(...(r.matches || []));
        });
    }

    const realMatches = allMatches.filter(m => m.id && !m.id.startsWith('v-'));
    const params = new URLSearchParams(window.location.search);
    const urlMatchId = params.get('matchId');
    
    let targetMatchId: string | null = null;
    let urlTargetMatch: Match | null = null;

    let isSeasonCompleted = currentSeason.status === 'COMPLETED';
    if (!isSeasonCompleted && realMatches.length > 0) {
        const totalValid = realMatches.filter(m => m.home !== 'BYE' && m.away !== 'BYE').length;
        const finished = realMatches.filter(m => m.status === 'COMPLETED' || (m.homeScore !== '' && m.awayScore !== '')).length;
        if (totalValid > 0 && totalValid === finished) isSeasonCompleted = true;
    }

    if (urlMatchId) {
        targetMatchId = urlMatchId;
        urlTargetMatch = realMatches.find(m => m.id === urlMatchId) || null;
    } else if (!isSeasonCompleted) {
        const upcomingMatch = realMatches.find(m => m.status !== 'COMPLETED' && m.homeScore === '' && m.awayScore === '');
        if (upcomingMatch) {
            targetMatchId = upcomingMatch.id;
        } else {
            const completedMatches = realMatches.filter(m => (m.status === 'COMPLETED' || m.homeScore !== '') && m.id);
            if (completedMatches.length > 0) {
                targetMatchId = completedMatches[completedMatches.length - 1].id;
            }
        }
    }

    if (targetMatchId && matchRefs.current[targetMatchId]) {
        const finalId = targetMatchId; 
        setTimeout(() => {
            matchRefs.current[finalId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (urlTargetMatch) {
                onMatchClick(urlTargetMatch);
                params.delete('matchId');
                window.history.replaceState(null, '', `?${params.toString()}`);
            }
        }, 300);
    }
  }, [currentSeason, displayStages, viewSeasonId]);

  return (
    <div className="space-y-10">
        {displayStages && (
            <div className="overflow-x-auto pb-4 no-scrollbar border-b border-slate-800/50 mb-8">
                <div className="min-w-max md:min-w-[760px] px-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-1 h-5 bg-yellow-500 rounded-full shadow-[0_0_10px_#eab308]"></div>
                        <h3 className="text-lg font-black italic text-white uppercase tracking-tighter">Tournament Bracket</h3>
                    </div>
                    {/* 🔥 픽스: 유저 뷰임을 알려주는 스위치 작동! */}
                    <AdminMatching_TournamentBracketView knockoutStages={displayStages} isUserView={true} />
                </div>
            </div>
        )}

        <div className="space-y-12 max-w-[1500px] mx-auto overflow-hidden px-1">
            {displayStages ? (
                <>
                    {currentSeason?.rounds?.map((r, rIdx) => {
                        const groupMatches = r.matches.filter(m => m.stage.toUpperCase().includes('GROUP') || m.stage.includes('조별'));
                        if (groupMatches.length === 0) return null;
                        const uniqueGroups = Array.from(new Set(groupMatches.map(m => m.group))).sort();
                        return (
                            <React.Fragment key={`group-stage-${rIdx}`}>
                                {uniqueGroups.map(gName => (
                                    <div key={`group-${rIdx}-${gName}`} className="space-y-6">
                                        <div className="flex items-center gap-2 pl-2 border-l-4 border-emerald-500"><h3 className="text-lg font-black italic text-white uppercase tracking-tight">GROUP {gName}</h3></div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 items-start">
                                            {groupMatches.filter(m => m.group === gName).map((m, mIdx) => {
                                                const homeActive = getActiveOwner(m.homeOwner, (m as any).homeOwnerUid, m.home);
                                                const awayActive = getActiveOwner(m.awayOwner, (m as any).awayOwnerUid, m.away);
                                                const translatedHomeOwner = resolveOwnerInfo(owners, homeActive.name || '', homeActive.uid).nickname;
                                                const translatedAwayOwner = resolveOwnerInfo(owners, awayActive.name || '', awayActive.uid).nickname;
                                                const customMatchLabel = `[${m.group}조] ${mIdx + 1}경기`;
                                                const safeMatch = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo, homeOwner: translatedHomeOwner, awayOwner: translatedAwayOwner, matchLabel: customMatchLabel };
                                                
                                                return (
                                                    <div key={m.id} ref={(el) => matchRefs.current[m.id] = el} className="flex flex-col mb-2">
                                                        <div className="relative rounded-xl overflow-hidden bg-[#0f172a] shadow-lg border border-transparent transition-colors hover:border-slate-600 z-10">
                                                            <MatchCard match={safeMatch} onClick={() => onMatchClick(safeMatch)} activeRankingData={activeRankingData} historyData={historyData} masterTeams={masterTeams} owners={owners} />
                                                            {m.commentary && (<div className="mx-4 mb-4 p-3 bg-slate-900/50 border border-slate-800 rounded-xl"><p className="text-[11px] text-slate-400 leading-relaxed italic"><span className="text-emerald-500 font-bold mr-1">ANALYSIS:</span>{m.commentary}</p></div>)}
                                                            <div className="absolute bottom-2 right-3 text-[8px] text-slate-500/80 font-bold italic pointer-events-none z-10">{`시즌 '${pureSeasonName}' / ${getTodayFormatted()}`}</div>
                                                        </div>
                                                        <MatchCommentSnippet matchId={safeMatch.id} onClick={() => onMatchClick(safeMatch)} owners={owners} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </React.Fragment>
                        );
                    })}

                    {[ 
                        { title: 'Quarter-Finals (8강)', matches: displayStages.roundOf8, id: 'qf' }, 
                        { title: 'Semi-Finals (4강)', matches: displayStages.roundOf4, id: 'sf' }, 
                        { title: '🥉 3rd Place Match (3·4위전)', matches: displayStages.thirdPlace, id: 'tp' },
                        { title: '🏆 Grand Final (결승전)', matches: displayStages.final, id: 'fn' } 
                    ].map((section) => (
                        section.matches && (
                            <div key={section.id} className="space-y-6">
                                <div className="flex items-center gap-2 pl-2 border-l-4 border-emerald-500"><h3 className="text-lg font-black italic text-white uppercase tracking-tight">{section.title}</h3></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 items-start">
                                    {section.matches.map((m: any, mIdx: number) => {
                                        const isPlaceholder = m.id && m.id.startsWith('v-');
                                        const homeActive = getActiveOwner(m.homeOwner, (m as any).homeOwnerUid, m.home);
                                        const awayActive = getActiveOwner(m.awayOwner, (m as any).awayOwnerUid, m.away);
                                        const translatedHomeOwner = resolveOwnerInfo(owners, homeActive.name || '', homeActive.uid).nickname;
                                        const translatedAwayOwner = resolveOwnerInfo(owners, awayActive.name || '', awayActive.uid).nickname;
                                        const customMatchLabel = `${section.title.split(' ')[0]} / ${mIdx + 1}경기`;
                                        const safeMatch = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo, homeOwner: translatedHomeOwner, awayOwner: translatedAwayOwner, matchLabel: customMatchLabel };
                                        
                                        return (
                                            <div key={m.id || `${section.id}-${mIdx}`} ref={(el) => { if (m.id && !isPlaceholder) matchRefs.current[m.id] = el; }} className={`flex flex-col mb-2 transition-all ${isPlaceholder ? 'opacity-60 grayscale-[50%] pointer-events-none' : ''}`}>
                                                <div className="relative rounded-xl overflow-hidden bg-[#0f172a] shadow-lg border border-transparent transition-colors hover:border-slate-600 z-10">
                                                    <MatchCard match={safeMatch} onClick={() => !isPlaceholder && onMatchClick(safeMatch)} activeRankingData={activeRankingData} historyData={historyData} masterTeams={masterTeams} owners={owners} />
                                                    {m.commentary && !isPlaceholder && (<div className="mx-4 mb-4 p-3 bg-slate-900/50 border border-slate-800 rounded-xl"><p className="text-[11px] text-slate-400 leading-relaxed italic"><span className="text-emerald-500 font-bold mr-1">COMMENTARY:</span>{m.commentary}</p></div>)}
                                                    <div className="absolute bottom-2 right-3 text-[8px] text-slate-500/80 font-bold italic pointer-events-none z-10">{`시즌 '${pureSeasonName}' / ${getTodayFormatted()}`}</div>
                                                </div>
                                                {!isPlaceholder && <MatchCommentSnippet matchId={safeMatch.id} onClick={() => onMatchClick(safeMatch)} owners={owners} />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    ))}
                </>
            ) : (
                currentSeason?.rounds?.map((r, rIdx) => (
                    <div key={rIdx} className="space-y-8">
                         {Array.from(new Set(r.matches.map(m => m.stage))).map((stageName) => (
                            <div key={stageName} className="space-y-6">
                                <div className="flex items-center gap-2 pl-2 border-l-4 border-emerald-500"><h3 className="text-lg font-black italic text-white uppercase tracking-tight">{stageName}</h3></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 items-start">
                                    {r.matches.filter(m => m.stage === stageName).map((m, mIdx) => {
                                        const homeActive = getActiveOwner(m.homeOwner, (m as any).homeOwnerUid, m.home);
                                        const awayActive = getActiveOwner(m.awayOwner, (m as any).awayOwnerUid, m.away);
                                        const translatedHomeOwner = resolveOwnerInfo(owners, homeActive.name || '', homeActive.uid).nickname;
                                        const translatedAwayOwner = resolveOwnerInfo(owners, awayActive.name || '', awayActive.uid).nickname;
                                        const customMatchLabel = m.group ? `[${m.group}조] ${mIdx + 1}경기` : `${mIdx + 1}경기`;
                                        const safeMatch = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo, homeOwner: translatedHomeOwner, awayOwner: translatedAwayOwner, matchLabel: customMatchLabel };
                                        
                                        return (
                                            <div key={m.id} ref={(el) => matchRefs.current[m.id] = el} className="flex flex-col mb-2">
                                                <div className="relative rounded-xl overflow-hidden bg-[#0f172a] shadow-lg border border-transparent transition-colors hover:border-slate-600 z-10">
                                                    <MatchCard match={safeMatch} onClick={() => onMatchClick(safeMatch)} activeRankingData={activeRankingData} historyData={historyData} masterTeams={masterTeams} owners={owners} />
                                                    {m.commentary && (<div className="mx-4 mb-4 p-3 bg-slate-900/50 border border-slate-800 rounded-xl"><p className="text-[11px] text-slate-400 leading-relaxed italic">{m.commentary}</p></div>)}
                                                    <div className="absolute bottom-2 right-3 text-[8px] text-slate-500/80 font-bold italic pointer-events-none z-10">{`시즌 '${pureSeasonName}' / ${getTodayFormatted()}`}</div>
                                                </div>
                                                <MatchCommentSnippet matchId={safeMatch.id} onClick={() => onMatchClick(safeMatch)} owners={owners} />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ))
            )}
        </div>
    </div>
  );
};

export default CupSchedule;