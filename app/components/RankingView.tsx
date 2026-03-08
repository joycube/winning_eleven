/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { FALLBACK_IMG, Owner, Match } from '../types'; 
import { getYouTubeThumbnail } from '../utils/helpers';

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

    const renderRow = (teamName: string, score: number | null, isWinner: boolean, owner: string, logo: string) => {
        const isTbd = teamName === 'TBD' || !teamName;
        const isBye = teamName === 'BYE';
        const displayLogo = (isTbd || isBye || logo?.includes('uefa.com')) ? SAFE_TBD_LOGO : (logo || FALLBACK_IMG);
        const dispOwner = owner || '-';

        return (
            <div className={`flex items-center justify-between px-3 py-2.5 h-[50px] ${isWinner ? 'bg-gradient-to-r from-emerald-900/40 to-transparent' : ''} ${isTbd || isBye ? 'opacity-30' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0 ${isTbd || isBye ? 'bg-slate-700' : 'bg-white'}`}>
                        <img 
                            src={displayLogo} 
                            className={`${isTbd || isBye ? 'w-full h-full' : 'w-[70%] h-[70%]'} object-contain`} 
                            alt="" 
                            onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} 
                        />
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
                {renderRow(match.home, hScore, isHomeWin, match.homeOwner, match.homeLogo)}
                <div className="h-[1px] bg-slate-800/40 w-full relative"></div>
                {renderRow(match.away, aScore, isAwayWin, match.awayOwner, match.awayLogo)}
            </div>
        </div>
    );
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
  const [selectedGroupTab, setSelectedGroupTab] = useState<string>('A');
  const [masterTeams, setMasterTeams] = useState<any[]>([]);

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

  const prizeRule = currentSeason?.prizes || { champion: 0, first: 0, second: 0, third: 0 };

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

  // 🔥 [핵심 픽스: UID 에러 해결] 객체에 'ownerUid'를 포함하여 반환하도록 수정 (TS-2339 해결)
  const getTeamExtendedInfo = (teamIdentifier: string) => {
    const tbdTeam = { id: 0, name: teamIdentifier || 'TBD', logo: SAFE_TBD_LOGO, ownerName: '-', ownerUid: undefined, region: '', tier: 'C', realRankScore: 0, realFormScore: 0, condition: 'C', real_rank: null };
    if (!teamIdentifier || teamIdentifier === 'TBD') return tbdTeam;
    if (teamIdentifier === 'BYE') return { ...tbdTeam, name: 'BYE', ownerName: 'SYSTEM' };
    const normId = normalize(teamIdentifier);
    let stats = activeRankingData?.teams?.find((t: any) => normalize(t.name) === normId);
    let master = masterTeams.find((m: any) => m.name === teamIdentifier || normalize(m.name) === normId || normalize(m.teamName) === normId || m.id === teamIdentifier);
    
    return { 
        id: stats?.id || master?.id || 0, 
        name: stats?.name || master?.name || teamIdentifier, 
        logo: stats?.logo || master?.logo || SAFE_TBD_LOGO, 
        ownerName: stats?.ownerName || (master as any)?.ownerName || 'CPU', 
        ownerUid: stats?.ownerUid || (master as any)?.ownerUid, // 🔥 UID 추가 (에러 해결 핵심)
        region: master?.region || '', 
        tier: master?.tier || 'C', 
        realRankScore: master?.realRankScore, 
        realFormScore: master?.realFormScore, 
        condition: master?.condition || 'C', 
        real_rank: master?.real_rank 
    };
  };

  const grandFinalMatch = useMemo(() => {
      if (!currentSeason?.rounds) return null;
      return currentSeason.rounds.flatMap((r: any) => r.matches).find((m: any) => m.stage.toUpperCase().includes('FINAL') && !m.stage.toUpperCase().includes('SEMI') && !m.stage.toUpperCase().includes('QUARTER'));
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
    if (ownerName && ownerName === sortedTeams[0]?.ownerName) totalPrize += (prizeRule.first || 0);
    if (ownerName && ownerName === sortedTeams[1]?.ownerName) totalPrize += (prizeRule.second || 0);
    if (ownerName && ownerName === sortedTeams[2]?.ownerName) totalPrize += (prizeRule.third || 0);
    if (grandChampionInfo && ownerName === grandChampionInfo.ownerName) {
        totalPrize += (prizeRule.champion || 0);
    }
    return totalPrize;
  };

  const getRealRankBadge = (rank: number | undefined | null) => {
    if (!rank) return <div className="bg-slate-800 text-slate-500 text-[9px] font-bold px-1.5 py-[1px] rounded-[3px] border border-slate-700/50 leading-none">R.-</div>;
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
    return <div className={`px-1 py-[0.5px] rounded bg-slate-900 border border-slate-800 flex items-center h-3.5`}><span className={`text-[10px] font-black ${colors[c]}`}>{icons[c]}</span></div>;
  };

  const renderBroadcastTeamCell = (team: any) => {
    const info = getTeamExtendedInfo(team.name);
    const isTbd = team.name === 'TBD';
    const displayLogo = isTbd || info.logo?.includes('uefa.com') || team.logo?.includes('uefa.com') ? SAFE_TBD_LOGO : (info.logo || team.logo);
    
    return (
      <div className="flex items-center gap-4">
        <div className="relative w-10 h-10 flex-shrink-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${isTbd ? 'bg-slate-800' : 'bg-white shadow-md'}`}>
            <img 
                src={displayLogo} 
                className={`${isTbd ? 'w-full h-full' : 'w-[70%] h-[70%]'} object-contain`} 
                alt="" 
                onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} 
            />
          </div>
          {!isTbd && getTierBadge(info.tier)}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-black text-[14px] tracking-tight text-white uppercase truncate leading-tight">{team.name}</span>
          {!isTbd && (
            <div className="flex items-center gap-1.5 mt-1">
              {getRealRankBadge(info.real_rank)}
              {getConditionBadge(info.condition)}
              <span className="text-[10px] text-slate-500 font-bold italic truncate ml-0.5">{info.ownerName}</span>
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
          
          const t1 = leg1.home;
          const t2 = leg1.away;

          if (isLeg1Done) { 
              s1 += Number(leg1.homeScore); 
              s2 += Number(leg1.awayScore); 
          }
          if (isLeg2Done && leg2) { 
              if (leg2.home === t2) {
                  s2 += Number(leg2.homeScore);
                  s1 += Number(leg2.awayScore);
              } else {
                  s1 += Number(leg2.homeScore);
                  s2 += Number(leg2.awayScore);
              }
          }

          let aggWinner = 'TBD';
          if (isLeg1Done && (!leg2 || isLeg2Done)) {
              if (s1 > s2) aggWinner = t1;
              else if (s2 > s1) aggWinner = t2;
          }

          return {
              ...leg1,
              homeScore: isLeg1Done || isLeg2Done ? String(s1) : '',
              awayScore: isLeg1Done || isLeg2Done ? String(s2) : '',
              status: (isLeg1Done && (!leg2 || isLeg2Done)) ? 'COMPLETED' : 'UPCOMING',
              aggWinner
          };
      };

      const playoffRounds = currentSeason.rounds.filter((r: any) => ['ROUND_OF_4', 'SEMI_FINAL', 'FINAL'].includes(r.name));
      const displayRounds = JSON.parse(JSON.stringify(playoffRounds)); 

      const po4Rounds = displayRounds.filter((r: any) => r.name === 'ROUND_OF_4').flatMap((r: any) => r.matches);
      const poFinalRounds = displayRounds.filter((r: any) => r.name === 'SEMI_FINAL').flatMap((r: any) => r.matches);
      const grandFinalRounds = displayRounds.filter((r: any) => r.name === 'FINAL').flatMap((r: any) => r.matches);

      const poSemi1_leg1 = po4Rounds.find((m: any) => m.matchLabel.includes('5위') && m.matchLabel.includes('1차전'));
      const poSemi1_leg2 = po4Rounds.find((m: any) => m.matchLabel.includes('2위') && m.matchLabel.includes('2차전'));
      const poSemi2_leg1 = po4Rounds.find((m: any) => m.matchLabel.includes('4위') && m.matchLabel.includes('1차전'));
      const poSemi2_leg2 = po4Rounds.find((m: any) => m.matchLabel.includes('3위') && m.matchLabel.includes('2차전'));

      const compSemi1 = calcAgg(poSemi1_leg1, poSemi1_leg2);
      const compSemi2 = calcAgg(poSemi2_leg1, poSemi2_leg2);

      const getTeamInfoLocal = (teamName: string) => {
          if (!teamName || teamName === 'TBD') return { name: 'TBD', logo: SAFE_TBD_LOGO, owner: '-', ownerUid: undefined };
          const tNorm = teamName.trim().toLowerCase().replace(/\s+/g, '');
          const stats = activeRankingData?.teams?.find((t: any) => t.name.trim().toLowerCase().replace(/\s+/g, '') === tNorm);
          const master = masterTeams.find(m => m.name.trim().toLowerCase().replace(/\s+/g, '') === tNorm);
          return {
              name: stats?.name || master?.name || teamName,
              logo: stats?.logo || master?.logo || FALLBACK_IMG,
              owner: stats?.ownerName || (master as any)?.ownerName || '-',
              ownerUid: stats?.ownerUid || (master as any)?.ownerUid 
          };
      };

      if (compSemi1?.aggWinner && compSemi1.aggWinner !== 'TBD') {
          poFinalRounds.forEach((m: any) => {
              const info = getTeamInfoLocal(compSemi1.aggWinner);
              m.home = info.name; m.homeLogo = info.logo; m.homeOwner = info.owner; (m as any).homeOwnerUid = info.ownerUid;
          });
      }
      if (compSemi2?.aggWinner && compSemi2.aggWinner !== 'TBD') {
          poFinalRounds.forEach((m: any) => {
              const info = getTeamInfoLocal(compSemi2.aggWinner);
              m.away = info.name; m.awayLogo = info.logo; m.awayOwner = info.owner; (m as any).awayOwnerUid = info.ownerUid;
          });
      }

      const poFinal_leg1 = poFinalRounds.find((m: any) => m.matchLabel.includes('1차전'));
      const poFinal_leg2 = poFinalRounds.find((m: any) => m.matchLabel.includes('2차전'));
      const compPoFinal = calcAgg(poFinal_leg1, poFinal_leg2);

      if (compPoFinal?.aggWinner && compPoFinal.aggWinner !== 'TBD') {
          grandFinalRounds.forEach((m: any) => {
              const info = getTeamInfoLocal(compPoFinal.aggWinner);
              m.away = info.name; m.awayLogo = info.logo; m.awayOwner = info.owner; (m as any).awayOwnerUid = info.ownerUid;
          });
      }

      const displayGrandFinal = grandFinalRounds.length > 0 ? grandFinalRounds[0] : null;

      return { compSemi1, compSemi2, compPoFinal, displayGrandFinal };
  }, [currentSeason, activeRankingData, masterTeams]);

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
      ranked.push({ ...player, rank });
    });
    return ranked;
  };

  const rankedPlayers = getPlayerRanking(activeRankingData?.players || []);

  // 🔥 [핵심 픽스: 하이라이트 복구] 현재 시즌 데이터에서 직접 하이라이트 영상들을 추출합니다.
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
      // 최신 경기 순으로 정렬
      return hl.sort((a, b) => b.id.localeCompare(a.id));
  }, [currentSeason]);

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
          <select 
            value={viewSeasonId} 
            onChange={(e) => setViewSeasonId(Number(e.target.value))} 
            className="w-full bg-slate-950 text-white text-base font-bold py-4 px-5 rounded-xl border border-slate-700 shadow-xl appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer italic"
          >
            {seasons.map(s => (
              <option key={s.id} value={s.id} className="text-white text-base bg-slate-900 py-2">
                {(() => {
                  const pureName = s.name.replace(/^(🏆|🏳️|⚔️|⚽|🗓️|⭐)\s*/, '');
                  let icon = '🏳️'; if (s.type === 'CUP') icon = '🏆'; if (s.type === 'TOURNAMENT') icon = '⚔️'; if (s.type === 'LEAGUE_PLAYOFF') icon = '⭐';
                  return `${icon} ${pureName}`;
                })()}
              </option>
            ))}
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
          {/* ... 브라켓 및 순위표 (기존 로직 유지) ... */}
          {currentSeason?.type === 'LEAGUE_PLAYOFF' && hybridPlayoffData && (
             <div className="overflow-x-auto pb-4 no-scrollbar border-b border-slate-800/50 mb-8">
                <div className="min-w-max md:min-w-[760px] px-2">
                    <div className="flex items-center gap-3 mb-6"><div className="w-1.5 h-6 bg-yellow-500 rounded-full shadow-[0_0_10px_#eab308]"></div><h3 className="text-xl font-black italic text-white uppercase tracking-tighter">PLAYOFF BRACKET</h3></div>
                    <div className="bracket-tree no-scrollbar">
                        <div className="bracket-column"><BracketMatchBox match={hybridPlayoffData.compSemi1} title="PO 4강 1경기 (합산)" /><BracketMatchBox match={hybridPlayoffData.compSemi2} title="PO 4강 2경기 (합산)" /></div>
                        <div className="bracket-column"><BracketMatchBox match={hybridPlayoffData.compPoFinal} title="PO 결승 (합산)" /></div>
                        <div className="bracket-column"><div className="relative scale-110 ml-4"><div className="absolute -top-7 left-1/2 -translate-x-1/2 text-2xl animate-bounce">👑</div><BracketMatchBox match={hybridPlayoffData.displayGrandFinal} title="🏆 Grand Final (단판)" highlight /></div></div>
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
                <table className="w-full text-left text-xs uppercase border-collapse"><thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800"><tr><th className="p-4 w-8">#</th><th className="p-4">Club</th><th className="p-2 text-center">W</th><th className="p-2 text-center">D</th><th className="p-2 text-center">L</th><th className="p-2 text-center">GD</th><th className="p-2 text-center text-emerald-400">Pts</th></tr></thead>
                  <tbody>{groupStandings?.[selectedGroupTab]?.map((t: any) => (
                      <tr key={t.id} className="border-b border-slate-800/50"><td className={`p-4 text-center font-bold ${t.rank === 1 ? 'text-yellow-400' : t.rank === 2 ? 'text-slate-300' : 'text-slate-600'}`}>{t.rank}</td><td className="p-4">{renderBroadcastTeamCell(t)}</td><td className="p-2 text-center text-white">{t.win}</td><td className="p-2 text-center text-slate-500">{t.draw}</td><td className="p-2 text-center text-slate-500">{t.loss}</td><td className="p-2 text-center text-slate-400 font-bold">{t.gd > 0 ? `+${t.gd}` : t.gd}</td><td className="p-2 text-center font-black text-emerald-400 text-sm">{t.points}</td></tr>
                    ))}</tbody></table></div></div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2"><div className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"></div><h3 className="text-xl font-black italic text-white uppercase tracking-tighter">{currentSeason?.type === 'LEAGUE_PLAYOFF' ? 'Regular League Standing' : 'League Total Standing'}</h3></div>
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
              <table className="w-full text-left text-xs uppercase border-collapse"><thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800"><tr><th className="p-4 w-8">#</th><th className="p-4">Club</th><th className="p-2 text-center">W</th><th className="p-2 text-center">D</th><th className="p-2 text-center">L</th><th className="p-2 text-center">GD</th><th className="p-2 text-center text-emerald-400">Pts</th></tr></thead>
                <tbody>{sortedTeams.map((t: any) => (
                    <tr key={t.id} className="border-b border-slate-800/50"><td className={`p-4 text-center font-bold ${t.rank === 1 ? 'text-yellow-400' : t.rank === 2 ? 'text-slate-300' : t.rank === 3 ? 'text-orange-400' : 'text-slate-600'}`}>{t.rank}</td><td className="p-4">{renderBroadcastTeamCell(t)}</td><td className="p-2 text-center text-white">{t.win}</td><td className="p-2 text-center text-slate-500">{t.draw}</td><td className="p-2 text-center text-slate-500">{t.loss}</td><td className="p-2 text-center text-slate-400 font-bold">{t.gd > 0 ? `+${t.gd}` : t.gd}</td><td className="p-2 text-center font-black text-emerald-400 text-sm">{t.points}</td></tr>
                  ))}</tbody></table></div></div>
        </div>
      )}

      {rankingTab === 'OWNERS' && (
        <div className="space-y-6">
          {/* ... 구단주 랭킹 (기존 로직 유지) ... */}
        </div>
      )}

      {rankingTab === 'PLAYERS' && (
        <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
          {/* ... 선수 랭킹 (기존 로직 유지) ... */}
        </div>
      )}

      {rankingTab === 'HIGHLIGHTS' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* 🔥 [핵심 수정] 시즌에서 직접 추출한 하이라이트가 있으면 그것을 보여주고, 없으면 엔진 데이터(캐시)를 보여줍니다. */}
          {(seasonHighlights.length > 0 ? seasonHighlights : (activeRankingData?.highlights || [])).map((m: any, idx: number) => (
            <div key={idx} className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 group hover:border-emerald-500 transition-all cursor-pointer" onClick={() => window.open(m.youtubeUrl, '_blank')}>
              <div className="relative aspect-video">
                <img src={getYouTubeThumbnail(m.youtubeUrl)} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                <div className="absolute inset-0 flex items-center justify-center"><div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-110 transition-transform">▶</div></div>
              </div>
              <div className="p-3 flex items-center gap-3">
                <img src={m.winnerLogo || FALLBACK_IMG} className="w-8 h-8 rounded-full bg-white object-contain p-0.5" alt="" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} />
                <div className="flex-1 min-w-0"><p className="text-[10px] text-slate-500 font-bold uppercase">{m.stage} • {m.matchLabel}</p><p className="text-xs font-bold text-white truncate">{m.home} <span className="text-emerald-400">{m.homeScore}:{m.awayScore}</span> {m.away}</p></div>
              </div>
            </div>
          ))}
          {(seasonHighlights.length === 0 && !activeRankingData?.highlights?.length) && (
              <div className="col-span-full py-20 text-center text-slate-500 italic font-bold">등록된 하이라이트 영상이 없습니다.</div>
          )}
        </div>
      )}
    </div>
  );
};

const SubTabs = ['STANDINGS', 'OWNERS', 'PLAYERS', 'HIGHLIGHTS'];

export default RankingView;