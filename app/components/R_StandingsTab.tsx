"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useMemo } from 'react';
import { FALLBACK_IMG, Owner, Match } from '../types'; 
import { ChevronRight, PlayCircle } from 'lucide-react'; 

import AdminMatching_TournamentBracketView from './AdminMatching_TournamentBracketView';
import { AdminMatching_LeaguePOBracketView } from './AdminMatching_LeaguePOBracketView';

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

interface R_StandingsTabProps {
  currentSeason: any;
  computedTeamsData: any[]; 
  sortedTeams: any[];       
  masterTeams: any[];
  owners: Owner[];
  knockoutStages?: any;
  getTeamExtendedInfo: (teamIdentifier: string) => any;
}

export default function R_StandingsTab({ currentSeason, computedTeamsData, sortedTeams, masterTeams, owners, knockoutStages, getTeamExtendedInfo }: R_StandingsTabProps) {
  const [selectedGroupTab, setSelectedGroupTab] = useState<string>('A');
  const [expandedGroupTeam, setExpandedGroupTeam] = useState<string | null>(null);
  const [expandedTotalTeam, setExpandedTotalTeam] = useState<string | null>(null);
  // 🛠️ [UI 픽스 v2] Season 탭의 BRACKET 접기/펼치기 토글 (TOURNAMENT / LEAGUE_PLAYOFF / CUP 공유)
  const [bracketExpanded, setBracketExpanded] = useState<boolean>(false);

  // 🔥 [핵심 픽스] 스탠딩 탭에도 똑똑한 뇌(스마트 파서)를 완벽하게 이식합니다!
  const internalKnockoutStages = useMemo(() => {
      if (!['CUP', 'TOURNAMENT'].includes(currentSeason?.type || '') || !currentSeason?.rounds) return knockoutStages;
      
      const createPlaceholder = (vId: string, stageName: string): Match => ({ 
          id: vId, home: 'TBD', away: 'TBD', homeScore: '', awayScore: '', status: 'UPCOMING',
          seasonId: currentSeason.id, homeLogo: SAFE_TBD_LOGO, awayLogo: SAFE_TBD_LOGO, homeOwner: '-', awayOwner: '-',
          homePredictRate: 0, awayPredictRate: 0, stage: stageName, matchLabel: 'TBD', youtubeUrl: '',
          homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [] 
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

      currentSeason.rounds.forEach((round: any) => {
          if (!round.matches) return;
          const totalMatchesInRound = round.matches.length;

          round.matches.forEach((m: any, localIdx: number) => {
              const stage = m.stage?.toUpperCase() || "";
              const label = m.matchLabel?.toUpperCase() || "";
              
              if (stage.includes("GROUP") || stage.includes("조별")) {
                  if (m.group) groupSet.add(m.group);
                  return;
              }

              const idMatch = m.id?.match ? m.id.match(/_M?(\d+)$/) : null;
              const idx = idMatch ? parseInt(idMatch[1], 10) : localIdx;
              const mSafe = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };

              const isThird = stage.includes("3RD") || stage.includes("34") || stage.includes("THIRD") || stage.includes("3·4위") || label.includes("3·4위");
              const isFinal = stage.includes("FINAL") || stage.includes("결승") || label.includes("결승");
              const isSemi = stage.includes("SEMI") || stage.includes("ROUND_OF_4") || stage.includes("4강") || stage.includes("준결승") || label.includes("4강");
              const isQuarter = stage.includes("ROUND_OF_8") || stage.includes("QUARTER") || stage.includes("8강") || label.includes("8강");

              let fallbackFinal = false;
              let fallbackSemi = false;
              let fallbackQuarter = false;

              if (stage === "TOURNAMENT" || stage === "토너먼트") {
                   if (totalMatchesInRound === 1) fallbackFinal = true;
                   else if (totalMatchesInRound === 2) fallbackSemi = true; 
                   else if (totalMatchesInRound === 3) {
                       if (localIdx === 2) fallbackFinal = true;
                       else fallbackSemi = true;
                   }
                   else if (totalMatchesInRound === 4) fallbackQuarter = true;
                   else if (totalMatchesInRound === 7) {
                       if (localIdx === 6) fallbackFinal = true;
                       else if (localIdx >= 4) fallbackSemi = true;
                       else fallbackQuarter = true;
                   }
              }

              if (isThird) {
                  slots.thirdPlace[0] = mSafe;
              } else if (isFinal || fallbackFinal) {
                  slots.final[0] = mSafe;
              } else if (isSemi || fallbackSemi) {
                  let targetIdx = idx < 2 ? idx : localIdx;
                  if (totalMatchesInRound === 3) targetIdx = localIdx;
                  else if (totalMatchesInRound === 7) targetIdx = localIdx - 4;
                  
                  if (targetIdx < slots.roundOf4.length) {
                      slots.roundOf4[targetIdx] = mSafe;
                      hasActualRoundOf4 = true;
                  }
              } else if (isQuarter || fallbackQuarter) {
                  let targetIdx = idx < 4 ? idx : localIdx;
                  if (targetIdx < slots.roundOf8.length) {
                      slots.roundOf8[targetIdx] = mSafe;
                      hasActualRoundOf8 = true; 
                  }
              }
          });
      });

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

      const getTeamMasterInfo = (teamName: string) => {
          if (!masterTeams || masterTeams.length === 0) return undefined;
          const cleanTarget = teamName.replace(/\s+/g, '').toLowerCase();
          return masterTeams.find((t: any) => (t.name || (t as any).teamName || '').replace(/\s+/g, '').toLowerCase() === cleanTarget);
      };

      const syncWinner = (target: any, side: 'home' | 'away', source: Match | null) => {
          if (!target || !source) return;
          const winner = getWinnerName(source);
          if (winner !== 'TBD' && winner !== 'BYE' && (target[side] === 'TBD' || !target[side] || target[side] === 'BYE')) {
              target[side] = winner;
              const master = getTeamMasterInfo(winner);
              target[`${side}Logo`] = master?.logo || FALLBACK_IMG;
              const owner = owners?.find((o:any) => o.nickname === master?.ownerName || o.legacyName === master?.ownerName || (((o as any).legacyNames || []) as any[]).includes(master?.ownerName) || (o as any).mappedOwnerId === master?.ownerName);
              target[`${side}Owner`] = owner?.nickname || (owner as any)?.mappedOwnerId || master?.ownerName || '-';
              target[`${side}OwnerUid`] = owner?.uid || master?.ownerUid || '';
          }
      };

      const syncLoser = (target: any, side: 'home' | 'away', source: Match | null) => {
          if (!target || !source) return;
          const winner = getWinnerName(source);
          if (winner !== 'TBD' && winner !== 'BYE') {
              const loser = winner === source.home ? source.away : source.home;
              if (loser !== 'TBD' && loser !== 'BYE' && (target[side] === 'TBD' || !target[side] || target[side] === 'BYE')) {
                  target[side] = loser;
                  const master = getTeamMasterInfo(loser);
                  target[`${side}Logo`] = master?.logo || FALLBACK_IMG;
                  const owner = owners?.find((o:any) => o.nickname === master?.ownerName || o.legacyName === master?.ownerName || (((o as any).legacyNames || []) as any[]).includes(master?.ownerName) || (o as any).mappedOwnerId === master?.ownerName);
                  target[`${side}Owner`] = owner?.nickname || (owner as any)?.mappedOwnerId || master?.ownerName || '-';
                  target[`${side}OwnerUid`] = owner?.uid || master?.ownerUid || '';
              }
          }
      };

      if (hasActualRoundOf8) {
          syncWinner(slots.roundOf4[0], 'home', slots.roundOf8[0]);
          syncWinner(slots.roundOf4[0], 'away', slots.roundOf8[1]);
          syncWinner(slots.roundOf4[1], 'home', slots.roundOf8[2]);
          syncWinner(slots.roundOf4[1], 'away', slots.roundOf8[3]);
      }
      syncWinner(slots.final[0], 'home', slots.roundOf4[0]);
      syncWinner(slots.final[0], 'away', slots.roundOf4[1]);
      syncLoser(slots.thirdPlace[0], 'home', slots.roundOf4[0]);
      syncLoser(slots.thirdPlace[0], 'away', slots.roundOf4[1]);

      const teamCount = currentSeason.teams?.length || 0;
      const needsRoundOf8 = hasActualRoundOf8 || groupSet.size >= 3 || teamCount >= 8;
      const needsRoundOf4 = hasActualRoundOf4 || groupSet.size > 0 || teamCount >= 3;

      return { 
          ...slots, 
          roundOf8: needsRoundOf8 ? slots.roundOf8 : null,
          roundOf4: needsRoundOf4 ? slots.roundOf4 : null
      };
  }, [currentSeason, knockoutStages, masterTeams, owners]);

  const getRankedTeams = (teams: any[]) => {
    const sorted = [...(teams || [])].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return (b.gf || 0) - (a.gf || 0);
    });
    
    const ranked: any[] = [];
    sorted.forEach((t, i) => {
      let rank = i + 1;
      if (i > 0) {
        const p = ranked[i - 1];
        if (t.points === p.points && t.gd === p.gd && (t.gf || 0) === (p.gf || 0)) {
          rank = p.rank;
        }
      }
      ranked.push({ ...t, rank });
    });
    return ranked;
  };

  const getRealRankBadge = (rank: number | undefined | null) => {
    if (!rank) return <div className="bg-slate-800 text-slate-500 text-[9px] font-bold px-1.5 py-[1px] rounded-[3px] border border-slate-700/50 leading-none shrink-0">R.-</div>;
    let bgClass = rank === 1 ? "bg-yellow-500 text-black border-yellow-600" : rank === 2 ? "bg-slate-300 text-black border-slate-400" : rank === 3 ? "bg-orange-400 text-black border-orange-500" : "bg-slate-800 text-slate-400 border-slate-700";
    return <div className={`${bgClass} border text-[9px] font-black px-1.5 py-[1px] rounded-[3px] italic shadow-sm shrink-0 leading-none`}>R.{rank}</div>;
  };

  const getTierBadge = (tier?: string) => {
    const t = (tier || 'C').toUpperCase();
    let colors = t === 'S' ? 'bg-yellow-500 text-black border-yellow-200' : t === 'A' ? 'bg-slate-300 text-black border-white' : t === 'B' ? 'bg-amber-600 text-white border-amber-400' : 'bg-slate-800 text-slate-400 border-slate-700';
    return <div className={`absolute -bottom-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full border-2 border-[#0f172a] font-black text-[8px] z-20 shadow-md ${colors}`}>{t}</div>;
  };

  const getConditionBadge = (condition?: string) => {
    const icons: any = { 'A': '↑', 'B': '↗', 'C': '→', 'D': '↘', 'E': '⬇' };
    const colors: any = { 'A': 'text-emerald-400', 'B': 'text-teal-400', 'C': 'text-slate-400', 'D': 'text-orange-400', 'E': 'text-red-500' };
    const c = (condition || 'C').toUpperCase();
    return <div className={`px-1 py-[0.5px] rounded bg-slate-900 border border-slate-800 flex items-center h-3.5 shrink-0`}><span className={`text-[10px] font-black ${colors[c]}`}>{icons[c]}</span></div>;
  };

  const getTeamMatches = (teamName: string) => {
    if (!currentSeason?.rounds) return [];
    
    const teamMatches: any[] = [];
    currentSeason.rounds.forEach((round: any) => {
        round.matches?.forEach((match: any) => {
            if (match.status === 'COMPLETED' && (match.home === teamName || match.away === teamName) && match.home !== 'BYE' && match.away !== 'BYE') {
                const isHome = match.home === teamName;
                const opponentName = isHome ? match.away : match.home;
                const opponentInfo = getTeamExtendedInfo(opponentName);
                
                const myScore = isHome ? Number(match.homeScore) : Number(match.awayScore);
                const opScore = isHome ? Number(match.awayScore) : Number(match.homeScore);
                
                let result = '무';
                let resultColor = 'text-slate-400 bg-slate-800 border-slate-600';
                if (myScore > opScore) { result = '승'; resultColor = 'text-emerald-400 bg-emerald-900/40 border-emerald-500/30'; }
                else if (myScore < opScore) { result = '패'; resultColor = 'text-red-400 bg-red-900/40 border-red-500/30'; }

                const myScorers = isHome ? (match.homeScorers || []) : (match.awayScorers || []);
                const myAssists = isHome ? (match.homeAssists || []) : (match.awayAssists || []);
                const opScorers = isHome ? (match.awayScorers || []) : (match.homeScorers || []);
                const opAssists = isHome ? (match.awayAssists || []) : (match.homeAssists || []);

                const formatPlayers = (list: any[]) => {
                    return list.map(p => {
                        const name = (p.name || p).toString().trim();
                        return p.count > 1 ? `${name}(${p.count})` : name;
                    }).join(', ');
                };

                teamMatches.push({
                    roundName: match.matchLabel || round.name,
                    opponent: opponentInfo,
                    myScore,
                    opScore,
                    result,
                    resultColor,
                    scorersStr: formatPlayers(myScorers),
                    assistsStr: formatPlayers(myAssists),
                    opScorersStr: formatPlayers(opScorers),
                    opAssistsStr: formatPlayers(opAssists),
                    youtubeUrl: match.youtubeUrl
                });
            }
        });
    });
    return teamMatches;
  };

  const renderBroadcastTeamCell = (team: any, isExpanded: boolean, onToggle: () => void) => {
    const info = getTeamExtendedInfo(team.name);
    const isTbd = team.name === 'TBD';
    const displayLogo = isTbd || info.logo?.includes('uefa.com') || team.logo?.includes('uefa.com') ? SAFE_TBD_LOGO : (info.logo || team.logo);
    
    return (
      <div 
        className="flex items-center gap-3 cursor-pointer group w-full"
        onClick={() => {
            if (!isTbd) onToggle();
        }}
      >
        <div className="relative w-10 h-10 flex-shrink-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${isTbd ? 'bg-slate-800' : 'bg-white shadow-md'}`}>
            <img src={displayLogo} className={`${isTbd ? 'w-full h-full' : 'w-[70%] h-[70%]'} object-contain`} alt="" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} />
          </div>
          {!isTbd && getTierBadge(info.tier)}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
              <span className="font-black text-[14px] tracking-tight text-white uppercase truncate leading-tight group-hover:text-emerald-400 transition-colors">{team.name}</span>
              {!isTbd && (
                  <div className={`flex items-center justify-center w-[16px] h-[16px] rounded-full bg-emerald-400 text-slate-900 shrink-0 shadow-sm transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}>
                      <ChevronRight size={12} strokeWidth={4} />
                  </div>
              )}
          </div>
          {!isTbd && (
            <div className="flex items-center gap-1.5 mt-1 pr-8 min-w-0">
              {getRealRankBadge(info.real_rank)}
              {getConditionBadge(info.condition)}
              <span className="text-[10px] text-slate-500 font-bold italic truncate ml-0.5 min-w-0 pr-1">{info.ownerName}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderExpandedMatchRow = (teamMatches: any[], teamName: string) => (
    <tr>
        <td colSpan={7} className="p-0 border-b border-slate-800">
            <div className="bg-[#0b0e14] py-3 px-3 sm:px-8 shadow-inner border-l-2 border-emerald-500 animate-in slide-in-from-top-2 duration-200">
                {teamMatches.length === 0 ? (
                    <div className="text-slate-500 text-[11px] italic text-center py-4">완료된 경기가 없습니다.</div>
                ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pb-2">
                        {teamMatches.map((m, idx) => (
                            <div key={idx} className="flex flex-col bg-[#0f141e] border border-slate-800/80 rounded-xl overflow-hidden shadow-sm hover:border-slate-700 transition-colors relative">
                                <div className="bg-slate-900/80 px-3 py-1.5 border-b border-slate-800/50 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">{m.roundName?.replace('리그', '')}</span>
                                    </div>
                                    <span className={`text-[9px] font-black px-1.5 py-[1px] rounded border ${m.resultColor}`}>{m.result}</span>
                                </div>
                                <div className="p-3 flex flex-col gap-2 relative pr-10">
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <span className="text-slate-500 text-[10px] font-bold shrink-0">vs</span>
                                            <img src={m.opponent.logo} className="w-5 h-5 sm:w-6 sm:h-6 object-contain rounded-full bg-white shrink-0 shadow-sm" alt="" />
                                            <span className="text-[12px] sm:text-[13px] font-black text-white uppercase truncate">{m.opponent.name}</span>
                                            <span className="text-[10px] text-slate-400 font-bold truncate">({m.opponent.ownerName})</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 ml-2 bg-slate-900/50 px-2 py-0.5 rounded-lg border border-slate-800">
                                            <span className="text-[14px] sm:text-[16px] font-black text-emerald-400">{m.myScore}</span>
                                            <span className="text-[11px] text-slate-600">:</span>
                                            <span className="text-[14px] sm:text-[16px] font-black text-slate-400">{m.opScore}</span>
                                        </div>
                                    </div>
                                    {(m.scorersStr || m.assistsStr || m.opScorersStr || m.opAssistsStr) && (
                                        <div className="flex flex-col gap-1.5 mt-1 border-t border-slate-800/50 pt-2">
                                            {(m.scorersStr || m.assistsStr) && (
                                                <div className="flex items-start gap-1.5 w-full">
                                                    <span className="text-[9px] font-bold px-1.5 py-[1px] rounded bg-emerald-950/50 text-emerald-500 border border-emerald-800/50 shrink-0 mt-0.5">[{teamName}]</span>
                                                    <span className="text-[10px] sm:text-[11px] text-slate-200 break-words flex-1 leading-snug">
                                                        {m.scorersStr && `⚽ ${m.scorersStr}`}
                                                        {m.scorersStr && m.assistsStr && <span className="mx-1 text-slate-600">|</span>}
                                                        {m.assistsStr && `🅰️ ${m.assistsStr}`}
                                                    </span>
                                                </div>
                                            )}
                                            {(m.opScorersStr || m.opAssistsStr) && (
                                                <div className="flex items-start gap-1.5 w-full">
                                                    <span className="text-[9px] font-bold px-1.5 py-[1px] rounded bg-slate-800/80 text-slate-400 border border-slate-700 shrink-0 mt-0.5">[{m.opponent.name}]</span>
                                                    <span className="text-[10px] sm:text-[11px] text-slate-400 break-words flex-1 leading-snug">
                                                        {m.opScorersStr && `⚽ ${m.opScorersStr}`}
                                                        {m.opScorersStr && m.opAssistsStr && <span className="mx-1 text-slate-600">|</span>}
                                                        {m.opAssistsStr && `🅰️ ${m.opAssistsStr}`}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {m.youtubeUrl && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center shrink-0">
                                            <button onClick={() => window.open(m.youtubeUrl, '_blank')} className="text-red-500 hover:text-red-400 transition-transform hover:scale-110 p-1" title="하이라이트 보기">
                                                <PlayCircle size={22} strokeWidth={2} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </td>
    </tr>
  );

  const groupStandings = useMemo(() => {
    if (currentSeason?.type !== 'CUP' || !currentSeason?.groups) return null;
    const groups: { [key: string]: any[] } = {};
    Object.keys(currentSeason.groups).forEach(gName => {
      const teamIds = currentSeason.groups![gName];
      if (teamIds && teamIds.length > 0) {
        const groupTeams = computedTeamsData.filter((t: any) => teamIds.includes(t.id));
        groups[gName] = getRankedTeams(groupTeams);
      }
    });
    return groups;
  }, [currentSeason, computedTeamsData]);

  const sortedGroupKeys = useMemo(() => groupStandings ? Object.keys(groupStandings).sort() : [], [groupStandings]);

  React.useEffect(() => {
    if (sortedGroupKeys.length > 0 && !sortedGroupKeys.includes(selectedGroupTab)) setSelectedGroupTab(sortedGroupKeys[0]);
  }, [sortedGroupKeys, selectedGroupTab]);

  return (
    <div className="space-y-12 fade-in">
        
        {currentSeason?.type === 'TOURNAMENT' && (
            <div className="pb-4 border-b border-slate-800/50 mb-8">
                <div className="overflow-x-auto no-scrollbar bracket-scroll-smooth">
                    <div className="min-w-max md:min-w-[760px] px-2">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"></div>
                            <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">TOURNAMENT BRACKET</h3>
                        </div>
                        {/* 🛠️ [UI 픽스 v2] 접기/펼치기 토글 */}
                        <div className={`relative transition-all duration-500 ease-out ${bracketExpanded ? 'max-h-[6000px]' : 'max-h-[380px] overflow-hidden'}`}>
                            <AdminMatching_TournamentBracketView
                                knockoutStages={internalKnockoutStages}
                                isUserView={true}
                            />
                            {!bracketExpanded && (
                                <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-[#020617] via-[#020617]/85 to-transparent pointer-events-none" />
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex justify-center mt-2">
                    <button
                        onClick={() => setBracketExpanded(v => !v)}
                        className="group bg-slate-900/80 hover:bg-indigo-900/30 border border-indigo-500/30 hover:border-indigo-400 text-indigo-300 hover:text-white text-[11px] font-black italic tracking-widest uppercase px-5 py-2 rounded-full transition-all shadow-lg shadow-indigo-900/20 active:scale-95 flex items-center gap-2"
                    >
                        <span>{bracketExpanded ? '▴ 접기' : '▾ 더보기'}</span>
                        <span className="text-slate-500 group-hover:text-indigo-200 text-[9px] tracking-normal">
                            {bracketExpanded ? '(BRACKET 닫기)' : '(BRACKET 펼치기)'}
                        </span>
                    </button>
                </div>
            </div>
        )}

        {currentSeason?.type === 'LEAGUE_PLAYOFF' && (
            <div className="pb-4 border-b border-slate-800/50 mb-8">
                <div className="overflow-x-auto no-scrollbar bracket-scroll-smooth">
                    <div className="min-w-max md:min-w-[760px] px-2">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-1.5 h-6 bg-yellow-500 rounded-full shadow-[0_0_10px_#eab308]"></div>
                            <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">PLAYOFF BRACKET</h3>
                        </div>
                        {/* 🛠️ [UI 픽스 v2] 접기/펼치기 토글 */}
                        <div className={`relative transition-all duration-500 ease-out ${bracketExpanded ? 'max-h-[6000px]' : 'max-h-[380px] overflow-hidden'}`}>
                            <AdminMatching_LeaguePOBracketView
                                currentSeason={currentSeason}
                                owners={owners}
                                masterTeams={masterTeams}
                                activeRankingData={computedTeamsData}
                            />
                            {!bracketExpanded && (
                                <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-[#020617] via-[#020617]/85 to-transparent pointer-events-none" />
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex justify-center mt-2">
                    <button
                        onClick={() => setBracketExpanded(v => !v)}
                        className="group bg-slate-900/80 hover:bg-indigo-900/30 border border-indigo-500/30 hover:border-indigo-400 text-indigo-300 hover:text-white text-[11px] font-black italic tracking-widest uppercase px-5 py-2 rounded-full transition-all shadow-lg shadow-indigo-900/20 active:scale-95 flex items-center gap-2"
                    >
                        <span>{bracketExpanded ? '▴ 접기' : '▾ 더보기'}</span>
                        <span className="text-slate-500 group-hover:text-indigo-200 text-[9px] tracking-normal">
                            {bracketExpanded ? '(BRACKET 닫기)' : '(BRACKET 펼치기)'}
                        </span>
                    </button>
                </div>
            </div>
        )}

        {currentSeason?.type === 'CUP' && internalKnockoutStages && (
            <div className="pb-4 mb-8">
                <div className="overflow-x-auto no-scrollbar bracket-scroll-smooth">
                    <div className={`${internalKnockoutStages.roundOf8 ? 'min-w-[750px]' : 'min-w-[500px]'} px-4`}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-1.5 h-6 bg-yellow-500 rounded-full shadow-[0_0_10px_#eab308]"></div>
                            <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">Tournament Bracket</h3>
                        </div>
                        {/* 🛠️ [UI 픽스 v2] 접기/펼치기 토글 */}
                        <div className={`relative transition-all duration-500 ease-out ${bracketExpanded ? 'max-h-[6000px]' : 'max-h-[380px] overflow-hidden'}`}>
                            <AdminMatching_TournamentBracketView
                                knockoutStages={internalKnockoutStages}
                                isUserView={true}
                            />
                            {!bracketExpanded && (
                                <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-[#020617] via-[#020617]/85 to-transparent pointer-events-none" />
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex justify-center mt-2">
                    <button
                        onClick={() => setBracketExpanded(v => !v)}
                        className="group bg-slate-900/80 hover:bg-indigo-900/30 border border-indigo-500/30 hover:border-indigo-400 text-indigo-300 hover:text-white text-[11px] font-black italic tracking-widest uppercase px-5 py-2 rounded-full transition-all shadow-lg shadow-indigo-900/20 active:scale-95 flex items-center gap-2"
                    >
                        <span>{bracketExpanded ? '▴ 접기' : '▾ 더보기'}</span>
                        <span className="text-slate-500 group-hover:text-indigo-200 text-[9px] tracking-normal">
                            {bracketExpanded ? '(BRACKET 닫기)' : '(BRACKET 펼치기)'}
                        </span>
                    </button>
                </div>
            </div>
        )}

        {currentSeason?.type === 'CUP' && (
        <div className="space-y-4">
            <div className="flex items-center gap-3 px-2"><div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"></div><h3 className="text-xl font-black italic text-white uppercase tracking-tighter">Group Standings</h3></div>
            <div className="flex w-full gap-2 overflow-x-auto no-scrollbar pb-1">{sortedGroupKeys.map((gName) => <button key={gName} onClick={() => setSelectedGroupTab(gName)} className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black italic border transition-all ${selectedGroupTab === gName ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg' : 'bg-slate-900 text-slate-500 border-slate-700'}`}>GROUP {gName}</button>)}</div>
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
            <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase"><tr><th className="py-4 pl-4 pr-1 w-10 text-center">R..</th><th className="py-4 pl-1 pr-4">Club</th><th className="p-2 text-center">W</th><th className="p-2 text-center">D</th><th className="p-2 text-center">L</th><th className="p-2 text-center">GD</th><th className="p-2 text-center text-emerald-400">Pts</th></tr></thead>
                <tbody>{groupStandings?.[selectedGroupTab]?.map((t: any) => {
                    const isExpanded = expandedGroupTeam === t.name;
                    const teamMatches = isExpanded ? getTeamMatches(t.name) : [];
                    return (
                        <React.Fragment key={t.id}>
                            <tr className={`border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors ${isExpanded ? 'bg-slate-900/40' : ''}`}>
                                <td className={`py-4 pl-4 pr-1 text-center font-bold ${t.rank === 1 ? 'text-yellow-400' : t.rank === 2 ? 'text-slate-300' : t.rank === 4 ? 'text-slate-600' : 'text-slate-600'}`}>{t.rank}</td>
                                <td className="py-4 pl-1 pr-4">{renderBroadcastTeamCell(t, isExpanded, () => setExpandedGroupTeam(isExpanded ? null : t.name))}</td>
                                <td className="p-2 text-center text-white">{t.win}</td>
                                <td className="p-2 text-center text-slate-500">{t.draw}</td>
                                <td className="p-2 text-center text-slate-500">{t.loss}</td>
                                <td className="p-2 text-center text-slate-400 font-bold">{t.gd > 0 ? `+${t.gd}` : t.gd}</td>
                                <td className="p-2 text-center font-black text-emerald-400 text-sm">{t.points}</td>
                            </tr>
                            {isExpanded && renderExpandedMatchRow(teamMatches, t.name)}
                        </React.Fragment>
                    );
                })}</tbody></table></div></div>
        )}

        <div className="space-y-4">
        <div className="flex items-center gap-3 px-2">
            <div className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"></div>
            <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">
                {currentSeason?.type === 'LEAGUE_PLAYOFF' ? 'Regular League Standing' : 'League Total Standing'}
            </h3>
        </div>
        <div className="bg-[#0f172a] rounded-xl border border-slate-800 shadow-2xl">
            <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase">
                <tr>
                    <th className="py-4 pl-4 pr-1 w-10 text-center">R.</th>
                    <th className="py-4 pl-1 pr-4">Club</th>
                    <th className="p-2 text-center">W</th><th className="p-2 text-center">D</th><th className="p-2 text-center">L</th>
                    <th className="p-2 text-center">GD</th><th className="p-2 text-center text-emerald-400">Pts</th>
                </tr>
            </thead>
            <tbody>
                {sortedTeams.length === 0 ? (
                    <tr><td colSpan={7} className="p-10 text-center text-slate-500 font-bold italic">진행된 경기가 없습니다.</td></tr>
                ) : sortedTeams.map((t: any) => {
                    const isExpanded = expandedTotalTeam === t.name;
                    const teamMatches = isExpanded ? getTeamMatches(t.name) : [];

                    return (
                    <React.Fragment key={t.id}>
                        <tr className={`border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors ${isExpanded ? 'bg-slate-900/40' : ''}`}>
                            <td className={`py-4 pl-4 pr-1 text-center font-bold ${t.rank === 1 ? 'text-yellow-400' : t.rank === 2 ? 'text-slate-300' : t.rank === 3 ? 'text-orange-400' : 'text-slate-600'}`}>{t.rank}</td>
                            <td className="py-4 pl-1 pr-4 w-[40%]">{renderBroadcastTeamCell(t, isExpanded, () => setExpandedTotalTeam(isExpanded ? null : t.name))}</td>
                            <td className="p-2 text-center text-white">{t.win}</td>
                            <td className="p-2 text-center text-slate-500">{t.draw}</td>
                            <td className="p-2 text-center text-slate-500">{t.loss}</td>
                            <td className="p-2 text-center text-slate-400 font-bold">{t.gd > 0 ? `+${t.gd}` : t.gd}</td>
                            <td className="p-2 text-center font-black text-emerald-400 text-sm">{t.points}</td>
                        </tr>
                        {isExpanded && renderExpandedMatchRow(teamMatches, t.name)}
                    </React.Fragment>
                    );
                })}
            </tbody></table></div>
        </div>
    </div>
  );
}