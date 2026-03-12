"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { FALLBACK_IMG, Owner, Match } from '../types'; 
import { getYouTubeThumbnail } from '../utils/helpers';
import { ChevronRight, PlayCircle } from 'lucide-react'; 

const TBD_LOGO = "https://img.uefa.com/imgml/uefacom/club-generic-badge-new.svg";
const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

const SafeImage = ({ src, className, isBg = false }: { src: string, className?: string, isBg?: boolean }) => {
  const [imgSrc, setImgSrc] = useState<string>(src || FALLBACK_IMG);

  useEffect(() => {
    setImgSrc(src || FALLBACK_IMG);
  }, [src]);

  if (isBg) {
    return (
      <div 
        className={className} 
        style={{ backgroundImage: `url(${imgSrc})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
      ></div>
    );
  }

  return (
    <img 
      src={imgSrc} 
      className={className} 
      alt="" 
      onError={() => setImgSrc(FALLBACK_IMG)} 
    />
  );
};

const getTodayFormatted = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}.${month}.${day}`;
};

interface RankingViewProps {
  seasons: any[];
  viewSeasonId: number;
  setViewSeasonId: (id: number) => void;
  activeRankingData: any;
  owners?: Owner[];
  knockoutStages?: any; 
}

export const RankingView = ({ seasons, viewSeasonId, setViewSeasonId, activeRankingData, owners = [], knockoutStages }: RankingViewProps) => {
  const [rankingTab, setRankingTab] = useState<'STANDINGS' | 'OWNERS' | 'PLAYERS' | 'HIGHLIGHTS'>('STANDINGS');
  
  const [rankPlayerMode, setRankPlayerMode] = useState<'GOAL' | 'ASSIST'>('GOAL');
  const [rankPlayerStageMode, setRankPlayerStageMode] = useState<'REGULAR' | 'PLAYOFF'>('REGULAR');

  const [selectedGroupTab, setSelectedGroupTab] = useState<string>('A');
  const [masterTeams, setMasterTeams] = useState<any[]>([]);

  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  useEffect(() => {
    const fetchMasterTeams = async () => {
      try {
        const q = query(collection(db, 'master_teams'));
        const snap = await getDocs(q);
        const teams = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMasterTeams(teams);
      } catch (err) { console.error(err); }
    };
    fetchMasterTeams();
  }, []);

  const currentSeason = seasons.find(s => s.id === viewSeasonId);
  const seasonName = currentSeason?.name || 'Unknown Season';
  const todayDate = getTodayFormatted();
  const footerText = `시즌 '${seasonName}' / ${todayDate}`;

  const prizeRule = currentSeason?.prizes || { 
    champion: 0, first: 0, second: 0, third: 0, scorer: 0, assist: 0, poScorer: 0, poAssist: 0 
  };
  
  const isHybridSeason = currentSeason?.type === 'CUP' || currentSeason?.type === 'LEAGUE_PLAYOFF';

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

  const sortedTeams = useMemo(() => getRankedTeams(activeRankingData?.teams || []), [activeRankingData?.teams]);

  const normalize = (str: string) => str ? str.toString().trim().toLowerCase().replace(/\s+/g, '') : "";

  const getTeamExtendedInfo = (teamIdentifier: string) => {
    const tbdTeam = { id: 0, name: teamIdentifier || 'TBD', logo: SAFE_TBD_LOGO, ownerName: '-', ownerUid: undefined as string | undefined, region: '', tier: 'C', realRankScore: 0, realFormScore: 0, condition: 'C', real_rank: null };
    if (!teamIdentifier || teamIdentifier === 'TBD') return tbdTeam;
    if (teamIdentifier === 'BYE') return { ...tbdTeam, name: 'BYE', ownerName: 'SYSTEM' };
    
    const normId = normalize(teamIdentifier);
    let stats = activeRankingData?.teams?.find((t: any) => normalize(t.name) === normId);
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
              {/* 🔥 [수술 포인트] 글자 잘림(Clipping) 방지를 위해 span 자체에 내부 우측 여백(pr-1) 부여 */}
              <span className="text-[10px] text-slate-500 font-bold italic truncate ml-0.5 min-w-0 pr-1">{info.ownerName}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const grandFinalMatch = useMemo(() => {
      if (!currentSeason?.rounds) return null;
      return currentSeason.rounds.flatMap((r: any) => r.matches).find((m: any) => m.stage?.toUpperCase().includes('FINAL') && !m.stage?.toUpperCase().includes('SEMI') && !m.stage?.toUpperCase().includes('QUARTER'));
  }, [currentSeason]);

  const grandChampionName = useMemo(() => {
      if (!grandFinalMatch || grandFinalMatch.status !== 'COMPLETED') return null;
      const hScore = Number(grandFinalMatch.homeScore);
      const aScore = Number(grandFinalMatch.awayScore);
      if (hScore > aScore) return grandFinalMatch.home;
      if (aScore > hScore) return grandFinalMatch.away;
      return null; 
  }, [grandFinalMatch]);

  const grandChampionInfo = useMemo(() => {
      if (!grandChampionName || grandChampionName === 'TBD') return null;
      return getTeamExtendedInfo(grandChampionName);
  }, [grandChampionName, activeRankingData, masterTeams]);

  const getOwnerPrize = (ownerName: string) => {
    let totalPrize = 0;
    const resolvedInput = resolveOwnerNickname(ownerName);
    const checkMatch = (idx: number) => {
        const teamOwner = sortedTeams[idx]?.ownerName;
        return teamOwner && resolveOwnerNickname(teamOwner) === resolvedInput;
    };
    if (checkMatch(0)) totalPrize += (prizeRule.first || 0);
    if (checkMatch(1)) totalPrize += (prizeRule.second || 0);
    if (checkMatch(2)) totalPrize += (prizeRule.third || 0);
    if (grandChampionInfo && resolveOwnerNickname(grandChampionInfo.ownerName) === resolvedInput) {
        totalPrize += (prizeRule.champion || 0);
    }
    return totalPrize;
  };

  const groupStandings = useMemo(() => {
    if (currentSeason?.type !== 'CUP' || !currentSeason?.groups) return null;
    const groups: { [key: string]: any[] } = {};
    Object.keys(currentSeason.groups).forEach(gName => {
      const teamIds = currentSeason.groups![gName];
      if (teamIds && teamIds.length > 0) {
        const groupTeams = (activeRankingData?.teams || []).filter((t: any) => teamIds.includes(t.id));
        groups[gName] = getRankedTeams(groupTeams);
      }
    });
    return groups;
  }, [currentSeason, activeRankingData?.teams]);

  const sortedGroupKeys = useMemo(() => groupStandings ? Object.keys(groupStandings).sort() : [], [groupStandings]);

  useEffect(() => {
    if (sortedGroupKeys.length > 0 && !sortedGroupKeys.includes(selectedGroupTab)) setSelectedGroupTab(sortedGroupKeys[0]);
  }, [sortedGroupKeys, selectedGroupTab]);

  const hybridPlayoffData = useMemo(() => {
      if (currentSeason?.type !== 'LEAGUE_PLAYOFF' || !currentSeason?.rounds) return null;

      const calcAgg = (leg1: Match | undefined, leg2: Match | undefined) => {
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
          if (isLeg1Done && (!leg2 || isLeg2Done)) {
              if (s1 > s2) aggWinner = t1; else if (s2 > s1) aggWinner = t2;
          }
          return { ...leg1, homeScore: isLeg1Done || isLeg2Done ? String(s1) : '', awayScore: isLeg1Done || isLeg2Done ? String(s2) : '', status: (isLeg1Done && (!leg2 || isLeg2Done)) ? 'COMPLETED' : 'UPCOMING', aggWinner };
      };

      const playoffRounds = currentSeason.rounds.filter((r: any) => ['ROUND_OF_4', 'SEMI_FINAL', 'FINAL'].includes(r.name));
      const displayRounds = JSON.parse(JSON.stringify(playoffRounds)); 
      const po4Rounds = displayRounds.filter((r: any) => r.name === 'ROUND_OF_4').flatMap((r: any) => r.matches);
      const poFinalRounds = displayRounds.filter((r: any) => r.name === 'SEMI_FINAL').flatMap((r: any) => r.matches);
      const grandFinalRounds = displayRounds.filter((r: any) => r.name === 'FINAL').flatMap((r: any) => r.matches);

      const poSemi1_leg1 = po4Rounds.find((m: any) => m.matchLabel?.includes('5위') && m.matchLabel?.includes('1차전'));
      const poSemi1_leg2 = po4Rounds.find((m: any) => m.matchLabel?.includes('2위') && m.matchLabel?.includes('2차전'));
      const poSemi2_leg1 = po4Rounds.find((m: any) => m.matchLabel?.includes('4위') && m.matchLabel?.includes('1차전'));
      const poSemi2_leg2 = po4Rounds.find((m: any) => m.matchLabel?.includes('3위') && m.matchLabel?.includes('2차전'));

      const compSemi1 = calcAgg(poSemi1_leg1, poSemi1_leg2);
      const compSemi2 = calcAgg(poSemi2_leg1, poSemi2_leg2);

      if (compSemi1?.aggWinner && compSemi1.aggWinner !== 'TBD') {
          poFinalRounds.forEach((m: any) => { const info = getTeamExtendedInfo(compSemi1.aggWinner); m.home = info.name; m.homeLogo = info.logo; m.homeOwner = info.ownerName; m.homeOwnerUid = info.ownerUid; });
      }
      if (compSemi2?.aggWinner && compSemi2.aggWinner !== 'TBD') {
          poFinalRounds.forEach((m: any) => { const info = getTeamExtendedInfo(compSemi2.aggWinner); m.away = info.name; m.awayLogo = info.logo; m.awayOwner = info.ownerName; m.awayOwnerUid = info.ownerUid; });
      }

      const poFinal_leg1 = poFinalRounds.find((m: any) => m.matchLabel?.includes('1차전'));
      const poFinal_leg2 = poFinalRounds.find((m: any) => m.matchLabel?.includes('2차전'));
      const compPoFinal = calcAgg(poFinal_leg1, poFinal_leg2);

      if (compPoFinal?.aggWinner && compPoFinal.aggWinner !== 'TBD') {
          grandFinalRounds.forEach((m: any) => { const info = getTeamExtendedInfo(compPoFinal.aggWinner); m.away = info.name; m.awayLogo = info.logo; m.awayOwner = info.ownerName; m.awayOwnerUid = info.ownerUid; });
      }

      return { compSemi1, compSemi2, compPoFinal, displayGrandFinal: grandFinalRounds.length > 0 ? grandFinalRounds[0] : null };
  }, [currentSeason, activeRankingData, masterTeams, owners]);

  const getPlayerRanking = (players: any[]) => {
    const sortedPlayers = [...(players || [])]
      .filter((p: any) => rankPlayerMode === 'GOAL' ? p.goals > 0 : p.assists > 0)
      .sort((a: any, b: any) => {
        if (rankPlayerMode === 'GOAL') return b.goals - a.goals || b.assists - a.assists;
        return b.assists - a.assists || b.goals - a.goals;
      });
    
    const ranked: any[] = [];
    sortedPlayers.forEach((player, index) => {
      let rank = index + 1;
      if (index > 0) {
        const prev = ranked[index - 1];
        const isTie = rankPlayerMode === 'GOAL' 
          ? (player.goals === prev.goals && player.assists === prev.assists)
          : (player.assists === prev.assists && player.goals === prev.goals);
        if (isTie) rank = prev.rank;
      }
      ranked.push({ ...player, rank, owner: resolveOwnerNickname(player.owner, player.ownerUid) });
    });
    return ranked;
  };

  const rankedPlayers = useMemo(() => {
      if (isHybridSeason) {
          if (rankPlayerStageMode === 'PLAYOFF') {
              return getPlayerRanking(activeRankingData?.playoffPlayers || []);
          } else {
              return getPlayerRanking(activeRankingData?.regularPlayers || []);
          }
      }
      return getPlayerRanking(activeRankingData?.players || []);
  }, [activeRankingData, rankPlayerMode, rankPlayerStageMode, isHybridSeason]);

  const seasonHighlights = useMemo(() => {
      const hl: any[] = [];
      if (!currentSeason?.rounds) return [];
      currentSeason.rounds.forEach((r: any) => {
          r.matches?.forEach((m: any) => {
              if (m.status === 'COMPLETED' && m.youtubeUrl) {
                  hl.push({
                      ...m,
                      winnerLogo: Number(m.homeScore) > Number(m.awayScore) ? m.homeLogo : m.awayLogo
                  });
              }
          });
      });
      return hl.sort((a, b) => b.id.localeCompare(a.id));
  }, [currentSeason]);

  const SubTabs = ['STANDINGS', 'OWNERS', 'PLAYERS', 'HIGHLIGHTS'] as const;

  return (
    <div className="space-y-6 animate-in fade-in">
      <style dangerouslySetInnerHTML={{ __html: `
        .crown-icon { animation: bounce 2s infinite; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .champion-glow { box-shadow: 0 0 50px rgba(234, 179, 8, 0.4); }
        .bracket-tree { display: inline-flex; align-items: center; justify-content: flex-start; gap: 40px; padding: 10px 0 20px 4px; min-width: max-content; }
        .bracket-column { display: flex; flex-direction: column; justify-content: center; gap: 20px; position: relative; }
      `}} />

      <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col gap-4">
        <div className="relative">
          <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="w-full bg-slate-950 text-white text-base font-bold py-4 px-5 rounded-xl border border-slate-700 shadow-xl appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer italic">
            {seasons.map(s => {
                const pureName = s.name.replace(/^(🏆|🏳️|⚔️|⚽|🗓️|⭐)\s*/, '');
                let icon = '🏳️'; if (s.type === 'CUP') icon = '🏆'; if (s.type === 'TOURNAMENT') icon = '⚔️'; if (s.type === 'LEAGUE_PLAYOFF') icon = '⭐';
                return <option key={s.id} value={s.id} className="text-white text-base bg-slate-900 py-2">{icon} {pureName}</option>
            })}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {SubTabs.map(sub => (
            <button key={sub} onClick={() => setRankingTab(sub as any)} className={`px-4 py-2 rounded-lg text-xs font-black italic transition-all whitespace-nowrap ${rankingTab === sub ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}>{sub}</button>
          ))}
        </div>
      </div>

      {rankingTab === 'STANDINGS' && (
        <div className="space-y-12">
          
          {currentSeason?.type === 'LEAGUE_PLAYOFF' && hybridPlayoffData && (
             <div className="overflow-x-auto pb-4 no-scrollbar border-b border-slate-800/50 mb-8">
                <div className="min-w-max md:min-w-[760px] px-2">
                    <div className="flex items-center gap-3 mb-6"><div className="w-1.5 h-6 bg-yellow-500 rounded-full shadow-[0_0_10px_#eab308]"></div><h3 className="text-xl font-black italic text-white uppercase tracking-tighter">PLAYOFF BRACKET</h3></div>
                    
                    <div className="bracket-tree no-scrollbar">
                        <div className="bracket-column">
                            <BracketMatchBox match={hybridPlayoffData.compSemi1} title="PO 4강 1경기 (합산)" />
                            <BracketMatchBox match={hybridPlayoffData.compSemi2} title="PO 4강 2경기 (합산)" />
                        </div>
                        <div className="bracket-column">
                            <BracketMatchBox match={hybridPlayoffData.compPoFinal} title="PO 결승 (합산)" />
                        </div>
                        <div className="bracket-column">
                            <div className="relative scale-110 ml-4">
                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-2xl animate-bounce">👑</div>
                                <BracketMatchBox match={hybridPlayoffData.displayGrandFinal} title="🏆 Grand Final (단판)" highlight />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}

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
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase"><tr><th className="p-4 w-8 text-center">R.</th><th className="p-4">Club</th><th className="p-2 text-center">W</th><th className="p-2 text-center">D</th><th className="p-2 text-center">L</th><th className="p-2 text-center">GD</th><th className="p-2 text-center text-emerald-400">Pts</th></tr></thead>
                  <tbody>{groupStandings?.[selectedGroupTab]?.map((t: any) => (
                      <tr key={t.id} className="border-b border-slate-800/50"><td className={`p-4 text-center font-bold ${t.rank === 1 ? 'text-yellow-400' : t.rank === 2 ? 'text-slate-300' : t.rank === 4 ? 'text-slate-600' : 'text-slate-600'}`}>{t.rank}</td><td className="p-4">{renderBroadcastTeamCell(t)}</td><td className="p-2 text-center text-white">{t.win}</td><td className="p-2 text-center text-slate-500">{t.draw}</td><td className="p-2 text-center text-slate-500">{t.loss}</td><td className="p-2 text-center text-slate-400 font-bold">{t.gd > 0 ? `+${t.gd}` : t.gd}</td><td className="p-2 text-center font-black text-emerald-400 text-sm">{t.points}</td></tr>
                    ))}</tbody></table></div></div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2"><div className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"></div><h3 className="text-xl font-black italic text-white uppercase tracking-tighter">{currentSeason?.type === 'LEAGUE_PLAYOFF' ? 'Regular League Standing' : 'League Total Standing'}</h3></div>
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 shadow-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase">
                    <tr>
                        <th className="p-4 w-8 text-center">R.</th>
                        <th className="p-4">Club</th>
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
                                <td className={`p-4 text-center font-bold ${t.rank === 1 ? 'text-yellow-400' : t.rank === 2 ? 'text-slate-300' : t.rank === 3 ? 'text-orange-400' : 'text-slate-600'}`}>{t.rank}</td>
                                <td className="p-4 w-[40%]">{renderBroadcastTeamCell(t)}</td>
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
                                                                    {/* 🔥 [수술 포인트] 상대팀 오너명 우측 내부 여백(pr-1) 강제 부여 (잘림 방지) */}
                                                                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold truncate pr-1">({m.opponent.ownerName})</span>
                                                                </div>

                                                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                                                    <span className="text-[13px] sm:text-[15px] font-black text-emerald-400">{m.myScore}</span>
                                                                    <span className="text-[11px] text-slate-600">:</span>
                                                                    <span className="text-[13px] sm:text-[15px] font-black text-slate-400">{m.opScore}</span>
                                                                </div>

                                                                {/* PC용 기록 */}
                                                                <div className="hidden lg:flex items-center gap-3 ml-2 min-w-0">
                                                                    {(m.scorersStr || m.assistsStr) && (
                                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                                            <span className="text-[9px] font-bold px-1.5 py-[1px] rounded bg-emerald-950/50 text-emerald-500 border border-emerald-800/50">[{t.name}]</span>
                                                                            {/* 🔥 [수술 포인트] 선수 기록 텍스트에도 내부 우측 여백(pr-1) 부여 */}
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
                                                                            {/* 🔥 [수술 포인트] 선수 기록 텍스트에도 내부 우측 여백(pr-1) 부여 */}
                                                                            <span className="text-[10px] sm:text-[11px] text-slate-400 pr-1">
                                                                                {m.opScorersStr && `⚽ ${m.opScorersStr}`}
                                                                                {m.opScorersStr && m.opAssistsStr && <span className="mx-1 text-slate-600">|</span>}
                                                                                {m.opAssistsStr && `🅰️ ${m.opAssistsStr}`}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* 모바일용 기록 (팀별 각각 두 줄 처리) */}
                                                            <div className="flex lg:hidden flex-col pl-[40px] sm:pl-[44px] gap-1.5 mt-1 pr-12 min-w-0">
                                                                {(m.scorersStr || m.assistsStr) && (
                                                                    <div className="flex flex-col gap-1">
                                                                        {m.scorersStr && (
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="text-[9px] font-bold px-1.5 py-[1px] rounded bg-emerald-950/50 text-emerald-500 border border-emerald-800/50 shrink-0">[{t.name}]</span>
                                                                                {/* 🔥 [수술 포인트] 모바일 선수 기록 텍스트에도 내부 우측 여백(pr-1) 부여 */}
                                                                                <span className="text-[10px] text-slate-200 truncate pr-1">⚽ {m.scorersStr}</span>
                                                                            </div>
                                                                        )}
                                                                        {m.assistsStr && (
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="text-[9px] font-bold px-1.5 py-[1px] rounded bg-emerald-950/50 text-emerald-500 border border-emerald-800/50 shrink-0">[{t.name}]</span>
                                                                                {/* 🔥 [수술 포인트] 모바일 선수 기록 텍스트에도 내부 우측 여백(pr-1) 부여 */}
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
                                                                                {/* 🔥 [수술 포인트] 모바일 선수 기록 텍스트에도 내부 우측 여백(pr-1) 부여 */}
                                                                                <span className="text-[10px] text-slate-400 truncate pr-1">⚽ {m.opScorersStr}</span>
                                                                            </div>
                                                                        )}
                                                                        {m.opAssistsStr && (
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="text-[9px] font-bold px-1.5 py-[1px] rounded bg-slate-800/80 text-slate-400 border border-slate-700 shrink-0">[{m.opponent.name}]</span>
                                                                                {/* 🔥 [수술 포인트] 모바일 선수 기록 텍스트에도 내부 우측 여백(pr-1) 부여 */}
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
                </tbody></table></div></div>
        </div>
      )}

      {rankingTab === 'OWNERS' && (
        <div className="space-y-6">
          {(currentSeason?.type === 'CUP' || currentSeason?.type === 'LEAGUE_PLAYOFF') && grandChampionInfo && (() => {
              const resolvedNick = resolveOwnerNickname(grandChampionInfo.ownerName, grandChampionInfo.ownerUid);
              const champOwnerInfo = owners.find(o => o.nickname === resolvedNick);
              const displayPhoto = champOwnerInfo?.photo || FALLBACK_IMG;
              const team = sortedTeams.find((t: any) => t.name === grandChampionInfo.name) || grandChampionInfo;
              const teamPlayers = (activeRankingData?.players || []).filter((p: any) => p.team === team.name && p.goals > 0);
              const topScorer = teamPlayers.length > 0 ? teamPlayers.sort((a: any, b: any) => b.goals - a.goals)[0] : null;

              return (
                <div className="mb-8"><div className="relative w-full rounded-xl overflow-hidden border-2 border-yellow-400/50 champion-glow transform transition-all duration-500 group bg-[#020617]"><div className="absolute inset-0 bg-gradient-to-br from-yellow-600/40 via-yellow-900/60 to-black z-0"></div><div className="absolute top-1/2 right-10 -translate-y-1/2 opacity-20 group-hover:opacity-40 transition-opacity duration-700 pointer-events-none"><div className="w-[160px] h-[160px] filter drop-shadow-[0_0_30px_rgba(234,179,8,0.8)]" style={{ backgroundImage: `url(${team.logo})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}></div></div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center p-8 gap-8 backdrop-blur-sm pb-12"><div className="relative pt-3 shrink-0"><div className="absolute -top-10 -left-6 text-7xl filter drop-shadow-2xl z-20 crown-bounce origin-bottom-left" style={{ transform: 'rotate(-15deg)' }}>👑</div><div className="w-32 h-32 md:w-40 md:h-40 rounded-full p-[4px] bg-gradient-to-tr from-yellow-200 via-yellow-500 to-yellow-100 shadow-[0_0_30px_rgba(234,179,8,0.6)] relative z-10"><div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-950 bg-slate-900"><img src={displayPhoto} className="w-full h-full object-cover" alt="owner" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} /></div></div><div className="absolute -bottom-2 -right-2 w-14 h-14 bg-white rounded-full p-2 shadow-2xl border-2 border-yellow-400 z-30 overflow-hidden flex items-center justify-center"><img src={team.logo || FALLBACK_IMG} className="w-[70%] h-[70%] object-contain" alt="" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} /></div></div>
                      <div className="flex-1 text-center md:text-left"><div className="inline-flex items-center gap-2 bg-yellow-500 text-black px-4 py-1 rounded-full font-black text-xs tracking-widest mb-4 shadow-lg uppercase"><span>👑</span> GRAND FINAL CHAMPION</div><h2 className="text-4xl md:text-6xl font-black text-white mb-2 tracking-tighter italic drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">{resolvedNick}</h2><p className="text-yellow-400 font-bold tracking-widest text-sm md:text-base opacity-80 uppercase italic mb-6">With {team.name}</p>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3"><div className="bg-slate-900/80 rounded-xl px-4 py-2.5 border border-yellow-500/30 min-w-[100px]"><span className="text-[10px] text-yellow-500/80 block font-black mb-0.5 uppercase">OVERALL RECORD</span><span className="text-lg font-bold text-white tracking-tight">{team.win || 0}W <span className="text-slate-400">{team.draw || 0}D</span> <span className="text-red-400">{team.loss || 0}L</span></span></div><div className="bg-slate-900/80 rounded-xl px-4 py-2.5 border border-yellow-500/30 min-w-[100px]"><span className="text-[10px] text-yellow-500/80 block font-black mb-0.5 uppercase">OVERALL GOAL DIFF</span><div className="flex items-baseline gap-1"><span className="text-xl font-black text-yellow-400">{(team.gd || 0) > 0 ? `+${team.gd}` : team.gd || 0}</span><span className="text-[10px] text-slate-400 font-medium">({team.gf || 0}득 / {team.ga || 0}실)</span></div></div>{topScorer && (<div className="bg-gradient-to-r from-yellow-600/20 to-yellow-900/20 rounded-xl px-5 py-2.5 border border-yellow-400/50"><span className="text-[10px] text-yellow-500 block font-black mb-0.5 uppercase">TEAM MVP (TOP SCORER)</span><span className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5 uppercase">⚽ {topScorer.name} <span className="text-sm text-yellow-400 ml-1">({topScorer.goals} Goals)</span></span></div>)}</div></div></div>
                    <div className="absolute bottom-3 right-4 text-[9px] text-slate-500/60 font-bold italic tracking-wider z-20">{footerText}</div></div></div>
              );
          })()}

          {(!activeRankingData?.owners || activeRankingData.owners.length === 0) ? (
              <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-10 text-center text-slate-500 font-bold italic shadow-2xl">등록된 오너 포인트가 없습니다.</div>
          ) : (() => {
            const firstOwner = activeRankingData.owners[0];
            const resolvedNick = resolveOwnerNickname(firstOwner.name, firstOwner.ownerUid);
            const matchedOwner = owners.find(owner => owner.nickname === resolvedNick);
            const displayPhoto = matchedOwner?.photo || FALLBACK_IMG;
            const displayPrize = getOwnerPrize(firstOwner.name);
            return (
              <div className="mb-6"><div className="relative w-full rounded-xl overflow-hidden border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)] transform transition-transform duration-300 bg-[#020617]"><div className="absolute inset-0 z-0 bg-gradient-to-tr from-emerald-900/40 via-transparent to-transparent"></div><div className="relative z-10 flex flex-col md:flex-row items-center p-5 gap-4 bg-slate-900/60 backdrop-blur-sm pb-10"><div className="relative pt-3"><div className="w-24 h-24 md:w-32 md:h-32 rounded-full p-[3px] bg-gradient-to-tr from-emerald-300 via-emerald-500 to-emerald-200 shadow-2xl relative z-10"><div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-900 bg-slate-800"><img src={displayPhoto} className="w-full h-full object-cover" alt="owner" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} /></div></div><div className="absolute -bottom-3 inset-x-0 flex justify-center z-30"><span className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full border-2 border-slate-900 shadow-lg tracking-wider uppercase">TOP POINTS</span></div></div>
                    <div className="flex-1 text-center md:text-left pt-3 md:pt-0"><h3 className="text-xs md:text-sm text-emerald-400 font-bold tracking-[0.2em] mb-0.5 uppercase">Overall Top Points</h3><h2 className="text-3xl md:text-4xl font-black text-white mb-3 drop-shadow-md tracking-tight">{resolvedNick}</h2><div className="flex flex-wrap items-center justify-center md:justify-start gap-3"><div className="bg-slate-950/80 rounded-xl px-4 py-2.5 border border-slate-800 min-w-[80px]"><span className="text-[10px] text-slate-400 block font-bold mb-0.5 uppercase">POINTS</span><span className="text-xl font-black text-emerald-400">{firstOwner.points}</span></div><div className="bg-slate-950/80 rounded-xl px-4 py-2.5 border border-slate-800 min-w-[100px]"><span className="text-[10px] text-slate-400 block font-bold mb-0.5 uppercase">RECORD</span><span className="text-lg font-bold text-white tracking-tight">{firstOwner.win}W <span className="text-slate-500">{firstOwner.draw}D</span> <span className="text-red-400">{firstOwner.loss}L</span></span></div><div className="bg-emerald-900/20 rounded-xl px-5 py-2.5 border border-emerald-500/20"><span className="text-[10px] text-emerald-500 block font-black mb-0.5 uppercase">TOTAL PRIZE MONEY</span><span className="text-xl font-black text-emerald-400">₩ {displayPrize.toLocaleString()}</span></div></div></div></div>
                  <div className="absolute bottom-2 right-4 text-[9px] text-slate-500/60 font-bold italic tracking-wider z-20">{footerText}</div></div></div>
            );
          })()}

          {activeRankingData?.owners && activeRankingData.owners.length > 1 && (
              <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                <table className="w-full text-left text-xs border-collapse"><thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase"><tr><th className="p-4 w-8 text-center">R.</th><th className="p-4">Owner</th><th className="p-4 text-center">Record</th><th className="p-4 text-center text-emerald-400">Pts</th><th className="p-4 text-right">Prize</th></tr></thead>
                  <tbody>{(activeRankingData?.owners || []).slice(1).map((o: any, i: number) => {
                      if(!o) return null;
                      const actualRank = i + 2;
                      const resolvedNick = resolveOwnerNickname(o.name, o.ownerUid);
                      const matchedOwner = owners.find(owner => owner.nickname === resolvedNick);
                      return (
                        <tr key={i} className={`border-b border-slate-800/50 ${actualRank <= 3 ? 'bg-slate-800/30' : ''}`}><td className={`p-4 text-center font-bold ${actualRank === 2 ? 'text-slate-300' : actualRank === 3 ? 'text-orange-400' : 'text-slate-600'}`}>{actualRank}</td><td className="p-4"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full bg-slate-800 border overflow-hidden flex-shrink-0 shadow-lg ${actualRank === 2 ? 'border-slate-400' : actualRank === 3 ? 'border-orange-500' : 'border-slate-700'}`}><img src={matchedOwner?.photo || FALLBACK_IMG} className="w-full h-full object-cover" alt="" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} /></div><span className="font-bold text-sm whitespace-nowrap">{resolvedNick}</span></div></td><td className="p-4 text-center text-slate-400 font-medium"><span className="text-white">{o.win}</span>W <span className="text-slate-500">{o.draw}D</span> <span className="text-red-400">{o.loss}L</span></td><td className="p-4 text-center text-emerald-400 font-black text-sm">{o.points}</td><td className={`p-4 text-right font-bold ${getOwnerPrize(o.name) > 0 ? 'text-yellow-400' : 'text-slate-600'}`}>₩ {getOwnerPrize(o.name).toLocaleString()}</td></tr>
                      );
                    })}</tbody></table></div>
          )}
        </div>
      )}

      {rankingTab === 'PLAYERS' && (
        <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col">
          
          {isHybridSeason && (
            <div className="flex bg-[#0b0e14] p-2 sm:p-3 border-b border-slate-800 gap-2">
                <button 
                    onClick={() => setRankPlayerStageMode('REGULAR')} 
                    className={`flex-1 py-2.5 rounded-lg text-xs font-black italic transition-all ${rankPlayerStageMode === 'REGULAR' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-900 text-slate-500 hover:text-slate-300 border border-slate-800'}`}
                >
                    🚩 REGULAR (정규/조별)
                </button>
                <button 
                    onClick={() => setRankPlayerStageMode('PLAYOFF')} 
                    className={`flex-1 py-2.5 rounded-lg text-xs font-black italic transition-all ${rankPlayerStageMode === 'PLAYOFF' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900 text-slate-500 hover:text-slate-300 border border-slate-800'}`}
                >
                    🏆 PLAYOFF (토너먼트)
                </button>
            </div>
          )}

          <div className="flex bg-slate-950 border-b border-slate-800">
              <button 
                  onClick={() => setRankPlayerMode('GOAL')} 
                  className={`flex-1 py-3.5 text-[11px] sm:text-xs font-black tracking-widest ${rankPlayerMode === 'GOAL' ? 'text-yellow-400 bg-slate-900 border-b-2 border-yellow-400' : 'text-slate-600 hover:text-slate-400'} uppercase transition-colors`}
              >
                  ⚽ TOP SCORERS
              </button>
              <button 
                  onClick={() => setRankPlayerMode('ASSIST')} 
                  className={`flex-1 py-3.5 text-[11px] sm:text-xs font-black tracking-widest ${rankPlayerMode === 'ASSIST' ? 'text-blue-400 bg-slate-900 border-b-2 border-blue-400' : 'text-slate-600 hover:text-slate-400'} uppercase transition-colors`}
              >
                  🅰️ TOP ASSISTS
              </button>
          </div>

          <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs whitespace-nowrap table-fixed">
                  <thead className="bg-slate-950 text-slate-500 uppercase tracking-wider">
                      <tr>
                          <th className="p-3 w-12 text-center">R.</th>
                          <th className="p-3 w-[55%]">Player</th>
                          <th className="p-3 w-[30%]">Club</th>
                          <th className="p-3 text-right pr-6 w-20">{rankPlayerMode === 'GOAL' ? 'GOAL' : 'ASSIST'}</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {rankedPlayers.length === 0 ? (
                        <tr><td colSpan={4} className="p-12 text-center text-slate-500 font-bold italic">기록이 없습니다.</td></tr>
                    ) : rankedPlayers.slice(0, 20).map((p: any, i: number) => {
                        if(!p) return null;
                        const isTop3 = p.rank <= 3;
                        return (
                            <tr key={i} className={`hover:bg-slate-800/30 transition-colors ${isTop3 ? 'bg-slate-900/30' : ''}`}>
                                <td className={`p-4 text-center font-black text-sm ${p.rank === 1 ? 'text-yellow-400' : p.rank === 2 ? 'text-slate-300' : p.rank === 3 ? 'text-orange-400' : 'text-slate-600'}`}>
                                    {p.rank}
                                </td>
                                <td className="p-3 overflow-hidden">
                                    <div className="flex items-baseline gap-1.5 whitespace-nowrap overflow-hidden">
                                        <span className="font-bold text-white uppercase text-base shrink-0">{p.name}</span>
                                        <span className="text-xs text-slate-500 font-bold tracking-tight italic truncate">({p.owner})</span>
                                    </div>
                                </td>
                                <td className="p-3 text-slate-400">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <img src={p.teamLogo} className="w-6 h-6 object-contain rounded-full bg-white shadow-sm p-0.5 shrink-0" alt="" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} />
                                        <span className="font-bold text-xs truncate uppercase">{p.team}</span>
                                    </div>
                                </td>
                                <td className={`p-3 text-right pr-6 font-black text-lg ${rankPlayerMode === 'GOAL' ? 'text-yellow-400' : 'text-blue-400'}`}>
                                    {rankPlayerMode === 'GOAL' ? p.goals : p.assists}
                                </td>
                            </tr>
                        )
                    })}
                  </tbody>
              </table>
          </div>
        </div>
      )}

      {rankingTab === 'HIGHLIGHTS' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(seasonHighlights.length > 0 ? seasonHighlights : (activeRankingData?.highlights || [])).map((m: any, idx: number) => (
            <div key={idx} className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 group hover:border-emerald-500 transition-all cursor-pointer" onClick={() => window.open(m.youtubeUrl, '_blank')}><div className="relative aspect-video"><img src={getYouTubeThumbnail(m.youtubeUrl)} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" /><div className="absolute inset-0 flex items-center justify-center"><div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-110 transition-transform">▶</div></div></div><div className="p-3 flex items-center gap-3"><img src={m.winnerLogo || FALLBACK_IMG} className="w-8 h-8 rounded-full bg-white object-contain p-0.5" alt="" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} /><div className="flex-1 min-w-0"><p className="text-[10px] text-slate-500 font-bold uppercase">{m.stage} • {m.matchLabel}</p><p className="text-xs font-bold text-white truncate uppercase">{m.home} <span className="text-emerald-400">{m.homeScore}:{m.awayScore}</span> {m.away}</p></div></div></div>
          ))}
          {(seasonHighlights.length === 0 && !activeRankingData?.highlights?.length) && (
              <div className="col-span-full py-20 text-center text-slate-500 italic font-bold">등록된 하이라이트 영상이 없습니다.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default RankingView;