"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useMemo, useEffect } from 'react';
import { FALLBACK_IMG, Owner, Match } from '../types'; 
import { ChevronRight, PlayCircle } from 'lucide-react'; 

// 🔥 신규 뷰어 컴포넌트 임포트
import { AdminMatching_TournamentBracketView } from './AdminMatching_TournamentBracketView';
import { AdminMatching_LeaguePOBracketView } from './AdminMatching_LeaguePOBracketView';

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

interface R_StandingsTabProps {
  currentSeason: any;
  activeRankingData: any;
  masterTeams: any[];
  owners: Owner[];
  knockoutStages?: any;
}

export default function R_StandingsTab({ currentSeason, activeRankingData, masterTeams, owners, knockoutStages }: R_StandingsTabProps) {
  const [selectedGroupTab, setSelectedGroupTab] = useState<string>('A');
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const computedTeamsData = useMemo(() => {
    const teamStats: Record<string, any> = {};

    (activeRankingData?.teams || []).forEach((t: any) => {
        teamStats[t.name] = { ...t, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, gd: 0, points: 0, played: 0 };
    });

    if (!currentSeason?.rounds) return activeRankingData?.teams || [];

    const playoffKeywords = ['ROUND', 'SEMI', 'FINAL', '결승', '4강', '8강', '16강', 'PO', '플레이오프', '토너먼트'];

    currentSeason.rounds.forEach((r: any) => {
        const isPlayoffRound = playoffKeywords.some(kw => (r.name || '').toUpperCase().includes(kw));

        r.matches?.forEach((m: any) => {
            if (m.status !== 'COMPLETED') return;
            if (m.home === 'BYE' || m.away === 'BYE' || m.home === 'TBD' || m.away === 'TBD') return;

            const matchStr = `${m.stage || ''} ${m.matchLabel || ''}`.toUpperCase();
            const isPlayoffMatch = isPlayoffRound || playoffKeywords.some(kw => matchStr.includes(kw));

            if ((currentSeason.type === 'CUP' || currentSeason.type === 'LEAGUE_PLAYOFF') && isPlayoffMatch) {
                return; 
            }

            const hTeam = m.home;
            const aTeam = m.away;
            const hScore = Number(m.homeScore);
            const aScore = Number(m.awayScore);

            if (!teamStats[hTeam]) teamStats[hTeam] = { name: hTeam, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, gd: 0, points: 0, played: 0, id: hTeam };
            if (!teamStats[aTeam]) teamStats[aTeam] = { name: aTeam, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, gd: 0, points: 0, played: 0, id: aTeam };

            teamStats[hTeam].played += 1;
            teamStats[aTeam].played += 1;
            teamStats[hTeam].gf += hScore;
            teamStats[aTeam].gf += aScore;
            teamStats[hTeam].ga += aScore;
            teamStats[aTeam].ga += hScore;

            if (hScore > aScore) {
                teamStats[hTeam].win += 1;
                teamStats[hTeam].points += 3;
                teamStats[aTeam].loss += 1;
            } else if (hScore < aScore) {
                teamStats[aTeam].win += 1;
                teamStats[aTeam].points += 3;
                teamStats[hTeam].loss += 1;
            } else {
                teamStats[hTeam].draw += 1;
                teamStats[aTeam].draw += 1;
                teamStats[hTeam].points += 1;
                teamStats[aTeam].points += 1;
            }

            teamStats[hTeam].gd = teamStats[hTeam].gf - teamStats[hTeam].ga;
            teamStats[aTeam].gd = teamStats[aTeam].gf - teamStats[aTeam].ga;
        });
    });

    return Object.values(teamStats);
  }, [currentSeason, activeRankingData?.teams]);

  const resolveOwnerNickname = (ownerName: any, ownerUid?: string) => {
    try {
        if (!ownerName) return '-';
        const strName = String(ownerName).trim();
        if (['-', 'CPU', 'SYSTEM', 'TBD', 'BYE', 'GUEST'].includes(strName.toUpperCase())) return strName;
        
        const foundByUid = owners.find(o => (ownerUid && (o.uid === ownerUid || o.docId === ownerUid)) || (o.uid === strName || o.docId === strName));
        if (foundByUid) return foundByUid.nickname;
        
        const foundByName = owners.find(o => o.nickname === strName || o.legacyName === strName);
        return foundByName ? foundByName.nickname : strName;
    } catch (e) {
        return String(ownerName || '-');
    }
  };

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

  const sortedTeams = useMemo(() => getRankedTeams(computedTeamsData), [computedTeamsData]);

  const normalize = (str: string) => str ? str.toString().trim().toLowerCase().replace(/\s+/g, '') : "";

  const getTeamExtendedInfo = (teamIdentifier: string) => {
    const tbdTeam = { id: 0, name: teamIdentifier || 'TBD', logo: SAFE_TBD_LOGO, ownerName: '-', ownerUid: undefined as string | undefined, region: '', tier: 'C', realRankScore: 0, realFormScore: 0, condition: 'C', real_rank: null };
    if (!teamIdentifier || teamIdentifier === 'TBD') return tbdTeam;
    if (teamIdentifier === 'BYE') return { ...tbdTeam, name: 'BYE', ownerName: 'SYSTEM' };
    
    const normId = normalize(teamIdentifier);
    let stats = computedTeamsData.find((t: any) => normalize(t.name) === normId);
    let master = masterTeams.find((m: any) => m.name === teamIdentifier || normalize(m.name) === normId || normalize(m.teamName) === normId || m.id === teamIdentifier);
    
    const rawOwnerName = stats?.ownerName || (master as any)?.ownerName || 'CPU';
    const rawOwnerUid = stats?.ownerUid || (master as any)?.ownerUid;

    return { 
        id: stats?.id || master?.id || 0, 
        name: stats?.name || master?.name || teamIdentifier, 
        logo: stats?.logo || master?.logo || SAFE_TBD_LOGO, 
        ownerName: resolveOwnerNickname(rawOwnerName, rawOwnerUid), 
        ownerUid: rawOwnerUid, 
        region: master?.region || '', 
        tier: master?.tier || 'C', 
        realRankScore: master?.realRankScore, 
        realFormScore: master?.realFormScore, 
        condition: master?.condition || 'C', 
        real_rank: master?.real_rank 
    };
  };

  const BracketMatchBox = ({ match, title, highlight = false }: any) => {
    if (!match) return null;
    const hScore = match.homeScore !== '' ? Number(match.homeScore) : null;
    const aScore = match.awayScore !== '' ? Number(match.awayScore) : null;
    let winner = match.aggWinner || 'TBD'; 
    if (winner === 'TBD' && match.status === 'COMPLETED') {
        if (hScore !== null && aScore !== null) {
            if (hScore > aScore) winner = match.home;
            else if (aScore > hScore) winner = match.away;
        }
    } else if (match.home === 'BYE') winner = match.away;
    else if (match.away === 'BYE') winner = match.home;

    const isHomeWin = winner !== 'TBD' && winner === match.home;
    const isAwayWin = winner !== 'TBD' && winner === match.away;

    const renderRow = (teamName: string, score: number | null, isWinner: boolean, owner: string, ownerUid: string | undefined, logo: string) => {
        const isTbd = teamName === 'TBD' || !teamName;
        const isBye = teamName === 'BYE';
        const displayLogo = (isTbd || isBye || logo?.includes('uefa.com')) ? SAFE_TBD_LOGO : (logo || FALLBACK_IMG);
        const dispOwner = resolveOwnerNickname(owner, ownerUid) || '-';

        return (
            <div className={`flex items-center justify-between px-3 py-2.5 h-[50px] ${isWinner ? 'bg-gradient-to-r from-emerald-900/40 to-transparent' : ''} ${isTbd || isBye ? 'opacity-30' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0 ${isTbd || isBye ? 'bg-slate-700' : 'bg-white'}`}>
                        <img src={displayLogo} className={`${isTbd || isBye ? 'w-full h-full' : 'w-[70%] h-[70%]'} object-contain`} alt="" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} />
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                        <span className={`text-[11px] font-black leading-tight truncate uppercase tracking-tight ${isWinner ? 'text-white' : isTbd || isBye ? 'text-slate-500' : 'text-slate-400'}`}>
                            {teamName || 'TBD'}
                        </span>
                        {!isTbd && !isBye && (
                            <span className="text-[9px] text-slate-500 font-bold italic truncate mt-0.5">{dispOwner}</span>
                        )}
                        {isBye && <span className="text-[9px] text-slate-600 font-bold italic">Unassigned</span>}
                    </div>
                </div>
                <div className={`text-lg font-black italic tracking-tighter w-8 text-right ${isWinner ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {isBye ? '0' : (score ?? '-')}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col w-[200px] sm:w-[220px]">
            {title && <div className="text-[9px] font-bold text-slate-500 uppercase mb-1.5 pl-1 tracking-widest opacity-60">{title}</div>}
            <div className={`flex flex-col bg-[#0f141e]/90 backdrop-blur-md border rounded-xl overflow-hidden shadow-xl relative z-10 ${highlight ? 'border-yellow-500/50 shadow-yellow-500/20' : 'border-slate-800/50'}`}>
                {renderRow(match.home, hScore, isHomeWin, match.homeOwner, (match as any).homeOwnerUid, match.homeLogo)}
                <div className="h-[1px] bg-slate-800/40 w-full relative"></div>
                {renderRow(match.away, aScore, isAwayWin, match.awayOwner, (match as any).awayOwnerUid, match.awayLogo)}
            </div>
        </div>
    );
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

  const renderBroadcastTeamCell = (team: any) => {
    const info = getTeamExtendedInfo(team.name);
    const isTbd = team.name === 'TBD';
    const displayLogo = isTbd || info.logo?.includes('uefa.com') || team.logo?.includes('uefa.com') ? SAFE_TBD_LOGO : (info.logo || team.logo);
    const isExpanded = expandedTeam === team.name;
    
    return (
      <div 
        className="flex items-center gap-3 cursor-pointer group w-full"
        onClick={() => {
            if (!isTbd) setExpandedTeam(isExpanded ? null : team.name);
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

  useEffect(() => {
    if (sortedGroupKeys.length > 0 && !sortedGroupKeys.includes(selectedGroupTab)) setSelectedGroupTab(sortedGroupKeys[0]);
  }, [sortedGroupKeys, selectedGroupTab]);

  return (
    <div className="space-y-12 fade-in">
        
        {/* 1. 순수 토너먼트 모드일 경우 뷰어 렌더링 */}
        {currentSeason?.type === 'TOURNAMENT' && (
            <div className="overflow-x-auto pb-4 no-scrollbar border-b border-slate-800/50 mb-8">
                <div className="min-w-max md:min-w-[760px] px-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"></div>
                        <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">TOURNAMENT BRACKET</h3>
                    </div>
                    <AdminMatching_TournamentBracketView matches={currentSeason.rounds?.[0]?.matches || []} />
                </div>
            </div>
        )}

        {/* 🔥 2. 리그+PO 모드일 경우 신규 공통 뷰어 렌더링 */}
        {currentSeason?.type === 'LEAGUE_PLAYOFF' && (
            <div className="overflow-x-auto pb-4 no-scrollbar border-b border-slate-800/50 mb-8">
                <div className="min-w-max md:min-w-[760px] px-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-1.5 h-6 bg-yellow-500 rounded-full shadow-[0_0_10px_#eab308]"></div>
                        <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">PLAYOFF BRACKET</h3>
                    </div>
                    {/* 우리가 만든 공통 컴포넌트 단 한 줄로 대체! */}
                    <AdminMatching_LeaguePOBracketView 
                        currentSeason={currentSeason} 
                        owners={owners} 
                        masterTeams={masterTeams} 
                        activeRankingData={activeRankingData}
                    />
                </div>
            </div>
        )}

        {/* 3. 컵 모드 대진표 및 조별 순위표 */}
        {currentSeason?.type === 'CUP' && knockoutStages && (
        <div className="overflow-x-auto pb-4 no-scrollbar">
            <div className={`${knockoutStages.roundOf8 ? 'min-w-[700px]' : 'min-w-[500px]'} px-4`}>
            <div className="flex items-center gap-3 mb-6"><div className="w-1.5 h-6 bg-yellow-500 rounded-full shadow-[0_0_10px_#eab308]"></div><h3 className="text-xl font-black italic text-white uppercase tracking-tighter">Tournament Bracket</h3></div>
            <div className="bracket-tree no-scrollbar">
                {knockoutStages.roundOf8 && <div className="bracket-column">{knockoutStages.roundOf8.map((m: any, idx: number) => <BracketMatchBox key={`r8-${idx}`} title={`Match ${idx + 1}`} match={m} />)}</div>}
                <div className="bracket-column">{knockoutStages.roundOf4?.map((m: any, idx: number) => <BracketMatchBox key={`r4-${idx}`} title={`Semi ${idx + 1}`} match={m} />)}</div>
                <div className="bracket-column"><div className="relative scale-110 ml-4"><div className="absolute -top-7 left-1/2 -translate-x-1/2 text-2xl animate-bounce">👑</div><BracketMatchBox title="Final" match={knockoutStages.final?.[0]} highlight /></div></div>
            </div>
            </div>
        </div>
        )}

        {currentSeason?.type === 'CUP' && (
        <div className="space-y-4">
            <div className="flex items-center gap-3 px-2"><div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"></div><h3 className="text-xl font-black italic text-white uppercase tracking-tighter">Group Standings</h3></div>
            <div className="flex w-full gap-2 overflow-x-auto no-scrollbar pb-1">{sortedGroupKeys.map((gName) => <button key={gName} onClick={() => setSelectedGroupTab(gName)} className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black italic border transition-all ${selectedGroupTab === gName ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg' : 'bg-slate-900 text-slate-500 border-slate-700'}`}>GROUP {gName}</button>)}</div>
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
            <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase"><tr><th className="py-4 pl-4 pr-1 w-10 text-center">R.</th><th className="py-4 pl-1 pr-4">Club</th><th className="p-2 text-center">W</th><th className="p-2 text-center">D</th><th className="p-2 text-center">L</th><th className="p-2 text-center">GD</th><th className="p-2 text-center text-emerald-400">Pts</th></tr></thead>
                <tbody>{groupStandings?.[selectedGroupTab]?.map((t: any) => (
                    <tr key={t.id} className="border-b border-slate-800/50"><td className={`py-4 pl-4 pr-1 text-center font-bold ${t.rank === 1 ? 'text-yellow-400' : t.rank === 2 ? 'text-slate-300' : t.rank === 4 ? 'text-slate-600' : 'text-slate-600'}`}>{t.rank}</td><td className="py-4 pl-1 pr-4">{renderBroadcastTeamCell(t)}</td><td className="p-2 text-center text-white">{t.win}</td><td className="p-2 text-center text-slate-500">{t.draw}</td><td className="p-2 text-center text-slate-500">{t.loss}</td><td className="p-2 text-center text-slate-400 font-bold">{t.gd > 0 ? `+${t.gd}` : t.gd}</td><td className="p-2 text-center font-black text-emerald-400 text-sm">{t.points}</td></tr>
                ))}</tbody></table></div></div>
        )}

        {/* 4. 모든 모드(리그, 토너먼트, 리그+PO)에서 공통으로 렌더링되는 통합 순위표 */}
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
                    const isExpanded = expandedTeam === t.name;
                    const teamMatches = isExpanded ? getTeamMatches(t.name) : [];

                    return (
                    <React.Fragment key={t.id}>
                        <tr className={`border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors ${isExpanded ? 'bg-slate-900/40' : ''}`}>
                            <td className={`py-4 pl-4 pr-1 text-center font-bold ${t.rank === 1 ? 'text-yellow-400' : t.rank === 2 ? 'text-slate-300' : t.rank === 3 ? 'text-orange-400' : 'text-slate-600'}`}>{t.rank}</td>
                            <td className="py-4 pl-1 pr-4 w-[40%]">{renderBroadcastTeamCell(t)}</td>
                            <td className="p-2 text-center text-white">{t.win}</td>
                            <td className="p-2 text-center text-slate-500">{t.draw}</td>
                            <td className="p-2 text-center text-slate-500">{t.loss}</td>
                            <td className="p-2 text-center text-slate-400 font-bold">{t.gd > 0 ? `+${t.gd}` : t.gd}</td>
                            <td className="p-2 text-center font-black text-emerald-400 text-sm">{t.points}</td>
                        </tr>
                        
                        {isExpanded && (
                            <tr>
                                <td colSpan={7} className="p-0 border-b border-slate-800">
                                    <div className="bg-[#0b0e14] py-3 px-3 sm:px-8 shadow-inner border-l-2 border-emerald-500 animate-in slide-in-from-top-2 duration-200">
                                        {teamMatches.length === 0 ? (
                                            <div className="text-slate-500 text-[11px] italic text-center py-4">완료된 경기가 없습니다.</div>
                                        ) : (
                                            <div className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                                                {teamMatches.map((m, idx) => (
                                                    <div key={idx} className="flex flex-col lg:flex-row lg:items-center bg-[#0f141e] border border-slate-800/80 rounded-xl p-3 hover:bg-slate-800/50 transition-colors gap-2 relative pr-12">
                                                        
                                                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                                            <span className="text-[10px] font-black text-slate-500 tracking-widest w-8 shrink-0">{m.roundName?.replace('리그', '')}</span>
                                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${m.resultColor} shrink-0`}>{m.result}</span>
                                                            
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <span className="text-slate-500 text-[10px] font-bold">vs</span>
                                                                <img src={m.opponent.logo} className="w-4 h-4 sm:w-5 sm:h-5 object-contain rounded-full bg-white shrink-0 shadow-sm" alt="" />
                                                                <span className="text-[11px] sm:text-[12px] font-black text-white uppercase truncate">{m.opponent.name}</span>
                                                                <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold truncate pr-1">({m.opponent.ownerName})</span>
                                                            </div>

                                                            <div className="flex items-center gap-1 shrink-0 ml-1">
                                                                <span className="text-[13px] sm:text-[15px] font-black text-emerald-400">{m.myScore}</span>
                                                                <span className="text-[11px] text-slate-600">:</span>
                                                                <span className="text-[13px] sm:text-[15px] font-black text-slate-400">{m.opScore}</span>
                                                            </div>

                                                            <div className="hidden lg:flex items-center gap-3 ml-2 min-w-0">
                                                                {(m.scorersStr || m.assistsStr) && (
                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        <span className="text-[9px] font-bold px-1.5 py-[1px] rounded bg-emerald-950/50 text-emerald-500 border border-emerald-800/50">[{t.name}]</span>
                                                                        <span className="text-[10px] sm:text-[11px] text-slate-200 pr-1">
                                                                            {m.scorersStr && `⚽ ${m.scorersStr}`}
                                                                            {m.scorersStr && m.assistsStr && <span className="mx-1 text-slate-600">|</span>}
                                                                            {m.assistsStr && `🅰️ ${m.assistsStr}`}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                
                                                                {(m.scorersStr || m.assistsStr) && (m.opScorersStr || m.opAssistsStr) && (
                                                                    <div className="w-px h-3 bg-slate-700 shrink-0 hidden md:block"></div>
                                                                )}
                                                                
                                                                {(m.opScorersStr || m.opAssistsStr) && (
                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        <span className="text-[9px] font-bold px-1.5 py-[1px] rounded bg-slate-800/80 text-slate-400 border border-slate-700">[{m.opponent.name}]</span>
                                                                        <span className="text-[10px] sm:text-[11px] text-slate-400 pr-1">
                                                                            {m.opScorersStr && `⚽ ${m.opScorersStr}`}
                                                                            {m.opScorersStr && m.opAssistsStr && <span className="mx-1 text-slate-600">|</span>}
                                                                            {m.opAssistsStr && `🅰️ ${m.opAssistsStr}`}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex lg:hidden flex-col pl-[40px] sm:pl-[44px] gap-1.5 mt-1 pr-12 min-w-0">
                                                            {(m.scorersStr || m.assistsStr) && (
                                                                <div className="flex flex-col gap-1">
                                                                    {m.scorersStr && (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-[9px] font-bold px-1.5 py-[1px] rounded bg-emerald-950/50 text-emerald-500 border border-emerald-800/50 shrink-0">[{t.name}]</span>
                                                                            <span className="text-[10px] text-slate-200 truncate pr-1">⚽ {m.scorersStr}</span>
                                                                        </div>
                                                                    )}
                                                                    {m.assistsStr && (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-[9px] font-bold px-1.5 py-[1px] rounded bg-emerald-950/50 text-emerald-500 border border-emerald-800/50 shrink-0">[{t.name}]</span>
                                                                            <span className="text-[10px] text-slate-200 truncate pr-1">🅰️ {m.assistsStr}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {(m.opScorersStr || m.opAssistsStr) && (
                                                                <div className="flex flex-col gap-1 mt-0.5">
                                                                    {m.opScorersStr && (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-[9px] font-bold px-1.5 py-[1px] rounded bg-slate-800/80 text-slate-400 border border-slate-700 shrink-0">[{m.opponent.name}]</span>
                                                                            <span className="text-[10px] text-slate-400 truncate pr-1">⚽ {m.opScorersStr}</span>
                                                                        </div>
                                                                    )}
                                                                    {m.opAssistsStr && (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-[9px] font-bold px-1.5 py-[1px] rounded bg-slate-800/80 text-slate-400 border border-slate-700 shrink-0">[{m.opponent.name}]</span>
                                                                            <span className="text-[10px] text-slate-400 truncate pr-1">🅰️ {m.opAssistsStr}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {m.youtubeUrl && (
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center shrink-0">
                                                                <button onClick={() => window.open(m.youtubeUrl, '_blank')} className="text-red-500 hover:text-red-400 transition-transform hover:scale-110 p-1" title="하이라이트 보기">
                                                                    <PlayCircle size={22} strokeWidth={2} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )}
                    </React.Fragment>
                    );
                })}
            </tbody></table></div>
        </div>
    </div>
  );
}