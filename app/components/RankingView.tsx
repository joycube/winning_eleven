/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { FALLBACK_IMG, Owner, Match } from '../types'; 
import { getYouTubeThumbnail } from '../utils/helpers';

const TBD_LOGO = "https://img.uefa.com/imgml/uefacom/club-generic-badge-new.svg";
const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

// 💣 [캡처 방어막 완전 해제] 
// 캡처를 안 하므로 crossOrigin 등 사파리가 싫어하는 모든 보안 속성을 제거한 가장 순수한 형태
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
                        {/* 🔥 순정 img 태그 적용 */}
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

  const getTeamExtendedInfo = (teamIdentifier: string) => {
    const tbdTeam = { id: 0, name: teamIdentifier || 'TBD', logo: SAFE_TBD_LOGO, ownerName: '-', region: '', tier: 'C', realRankScore: 0, realFormScore: 0, condition: 'C', real_rank: null };
    if (!teamIdentifier || teamIdentifier === 'TBD') return tbdTeam;
    if (teamIdentifier === 'BYE') return { ...tbdTeam, name: 'BYE', ownerName: 'SYSTEM' };
    const normId = normalize(teamIdentifier);
    let stats = activeRankingData?.teams?.find((t: any) => normalize(t.name) === normId);
    let master = masterTeams.find((m: any) => m.name === teamIdentifier || normalize(m.name) === normId || normalize(m.teamName) === normId || m.id === teamIdentifier);
    return { id: stats?.id || master?.id || 0, name: stats?.name || master?.name || teamIdentifier, logo: stats?.logo || master?.logo || SAFE_TBD_LOGO, ownerName: stats?.ownerName || (master as any)?.ownerName || 'CPU', region: master?.region || '', tier: master?.tier || 'C', realRankScore: master?.realRankScore, realFormScore: master?.realFormScore, condition: master?.condition || 'C', real_rank: master?.real_rank };
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
            {/* 🔥 순정 img 태그 적용 */}
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
          if (!teamName || teamName === 'TBD') return { name: 'TBD', logo: SAFE_TBD_LOGO, owner: '-' };
          const tNorm = teamName.trim().toLowerCase().replace(/\s+/g, '');
          const stats = activeRankingData?.teams?.find((t: any) => t.name.trim().toLowerCase().replace(/\s+/g, '') === tNorm);
          const master = masterTeams.find(m => m.name.trim().toLowerCase().replace(/\s+/g, '') === tNorm);
          return {
              name: stats?.name || master?.name || teamName,
              logo: stats?.logo || master?.logo || FALLBACK_IMG,
              owner: stats?.ownerName || (master as any)?.ownerName || '-' 
          };
      };

      if (compSemi1?.aggWinner && compSemi1.aggWinner !== 'TBD') {
          poFinalRounds.forEach((m: any) => {
              const info = getTeamInfoLocal(compSemi1.aggWinner);
              m.home = info.name; m.homeLogo = info.logo; m.homeOwner = info.owner;
          });
      }
      if (compSemi2?.aggWinner && compSemi2.aggWinner !== 'TBD') {
          poFinalRounds.forEach((m: any) => {
              const info = getTeamInfoLocal(compSemi2.aggWinner);
              m.away = info.name; m.awayLogo = info.logo; m.awayOwner = info.owner;
          });
      }

      const poFinal_leg1 = poFinalRounds.find((m: any) => m.matchLabel.includes('1차전'));
      const poFinal_leg2 = poFinalRounds.find((m: any) => m.matchLabel.includes('2차전'));
      const compPoFinal = calcAgg(poFinal_leg1, poFinal_leg2);

      if (compPoFinal?.aggWinner && compPoFinal.aggWinner !== 'TBD') {
          grandFinalRounds.forEach((m: any) => {
              const info = getTeamInfoLocal(compPoFinal.aggWinner);
              m.away = info.name; m.awayLogo = info.logo; m.awayOwner = info.owner;
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
          {['STANDINGS', 'OWNERS', 'PLAYERS', 'HIGHLIGHTS'].map(sub => (
            <button key={sub} onClick={() => setRankingTab(sub as any)} className={`px-4 py-2 rounded-lg text-xs font-black italic transition-all whitespace-nowrap ${rankingTab === sub ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}>{sub}</button>
          ))}
        </div>
      </div>

      {rankingTab === 'STANDINGS' && (
        <div className="space-y-12">
          
          {currentSeason?.type === 'LEAGUE_PLAYOFF' && hybridPlayoffData && (
             <div className="overflow-x-auto pb-4 no-scrollbar border-b border-slate-800/50 mb-8">
                <div className="min-w-max md:min-w-[760px] px-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-1.5 h-6 bg-yellow-500 rounded-full shadow-[0_0_10px_#eab308]"></div>
                        <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">PLAYOFF BRACKET</h3>
                    </div>
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
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-6 bg-yellow-500 rounded-full shadow-[0_0_10px_#eab308]"></div>
                  <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">Tournament Bracket</h3>
                </div>
                <div className="bracket-tree no-scrollbar">
                  {knockoutStages.roundOf8 && (
                    <div className="bracket-column">
                      {knockoutStages.roundOf8.map((m: any, idx: number) => <BracketMatchBox key={`r8-${idx}`} title={`Match ${idx + 1}`} match={m} />)}
                    </div>
                  )}
                  <div className="bracket-column">
                    {knockoutStages.roundOf4?.map((m: any, idx: number) => <BracketMatchBox key={`r4-${idx}`} title={`Semi ${idx + 1}`} match={m} />)}
                  </div>
                  <div className="bracket-column">
                    <div className="relative scale-110 ml-4">
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-2xl animate-bounce">👑</div>
                        <BracketMatchBox title="Final" match={knockoutStages.final?.[0]} highlight />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentSeason?.type === 'CUP' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"></div>
                <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">Group Standings</h3>
              </div>
              <div className="flex w-full gap-2 overflow-x-auto no-scrollbar pb-1">
                {sortedGroupKeys.map((gName) => (
                  <button key={gName} onClick={() => setSelectedGroupTab(gName)} className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black italic border transition-all ${selectedGroupTab === gName ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg' : 'bg-slate-900 text-slate-500 border-slate-700'}`}>GROUP {gName}</button>
                ))}
              </div>
              <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                <table className="w-full text-left text-xs uppercase border-collapse">
                  <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                    <tr><th className="p-4 w-8">#</th><th className="p-4">Club</th><th className="p-2 text-center">W</th><th className="p-2 text-center">D</th><th className="p-2 text-center">L</th><th className="p-2 text-center">GD</th><th className="p-2 text-center text-emerald-400">Pts</th></tr>
                  </thead>
                  <tbody>
                    {groupStandings?.[selectedGroupTab]?.map((t: any) => (
                      <tr key={t.id} className="border-b border-slate-800/50">
                        <td className={`p-4 text-center font-bold ${t.rank === 1 ? 'text-yellow-400' : t.rank === 2 ? 'text-slate-300' : t.rank === 3 ? 'text-slate-600' : 'text-slate-600'}`}>{t.rank}</td>
                        <td className="p-4">{renderBroadcastTeamCell(t)}</td>
                        <td className="p-2 text-center text-white">{t.win}</td>
                        <td className="p-2 text-center text-slate-500">{t.draw}</td>
                        <td className="p-2 text-center text-slate-500">{t.loss}</td>
                        <td className="p-2 text-center text-slate-400 font-bold">{t.gd > 0 ? `+${t.gd}` : t.gd}</td>
                        <td className="p-2 text-center font-black text-emerald-400 text-sm">{t.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"></div>
              <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">
                  {currentSeason?.type === 'LEAGUE_PLAYOFF' ? 'Regular League Standing' : 'League Total Standing'}
              </h3>
            </div>
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
              <table className="w-full text-left text-xs uppercase border-collapse">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                  <tr><th className="p-4 w-8">#</th><th className="p-4">Club</th><th className="p-2 text-center">W</th><th className="p-2 text-center">D</th><th className="p-2 text-center">L</th><th className="p-2 text-center">GD</th><th className="p-2 text-center text-emerald-400">Pts</th></tr>
                </thead>
                <tbody>
                  {sortedTeams.map((t: any) => (
                    <tr key={t.id} className="border-b border-slate-800/50">
                      <td className={`p-4 text-center font-bold ${t.rank === 1 ? 'text-yellow-400' : t.rank === 2 ? 'text-slate-300' : t.rank === 3 ? 'text-orange-400' : 'text-slate-600'}`}>{t.rank}</td>
                      <td className="p-4">{renderBroadcastTeamCell(t)}</td>
                      <td className="p-2 text-center text-white">{t.win}</td>
                      <td className="p-2 text-center text-slate-500">{t.draw}</td>
                      <td className="p-2 text-center text-slate-500">{t.loss}</td>
                      <td className="p-2 text-center text-slate-400 font-bold">{t.gd > 0 ? `+${t.gd}` : t.gd}</td>
                      <td className="p-2 text-center font-black text-emerald-400 text-sm">{t.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {rankingTab === 'OWNERS' && (
        <div className="space-y-6">
          
          {(currentSeason?.type === 'CUP' || currentSeason?.type === 'LEAGUE_PLAYOFF') && grandChampionInfo && (() => {
              const champOwnerInfo = (owners && owners.length > 0) ? owners.find(o => o.nickname === grandChampionInfo.ownerName) : null;
              const displayPhoto = champOwnerInfo?.photo || FALLBACK_IMG;
              const team = sortedTeams.find((t: any) => t.name === grandChampionInfo.name) || grandChampionInfo;
              const teamPlayers = (activeRankingData?.players || []).filter((p: any) => p.team === team.name && p.goals > 0);
              const topScorer = teamPlayers.length > 0 ? teamPlayers.sort((a: any, b: any) => b.goals - a.goals)[0] : null;

              return (
                <div className="mb-8">
                  {/* 🔥 캡처 속성/버튼 완전 제거된 순수 렌더링 카드 */}
                  <div className="relative w-full rounded-xl overflow-hidden border-2 border-yellow-400/50 champion-glow transform transition-all duration-500 group bg-[#020617]">
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/40 via-yellow-900/60 to-black z-0"></div>
                    <div className="absolute top-1/2 right-10 -translate-y-1/2 opacity-20 group-hover:opacity-40 transition-opacity duration-700 pointer-events-none">
                      {/* 🔥 배경 이미지 순정화 */}
                      <div className="w-[160px] h-[160px] filter drop-shadow-[0_0_30px_rgba(234,179,8,0.8)]" style={{ backgroundImage: `url(${team.logo})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}></div>
                    </div>

                    <div className="relative z-10 flex flex-col md:flex-row items-center p-8 gap-8 backdrop-blur-sm pb-12">
                      <div className="relative pt-3 shrink-0">
                        <div className="absolute -top-10 -left-6 text-7xl filter drop-shadow-2xl z-20 crown-bounce origin-bottom-left" style={{ transform: 'rotate(-15deg)' }}>👑</div>
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full p-[4px] bg-gradient-to-tr from-yellow-200 via-yellow-500 to-yellow-100 shadow-[0_0_30px_rgba(234,179,8,0.6)] relative z-10">
                          <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-950 bg-slate-900">
                            {/* 🔥 순정 img 태그 */}
                            <img src={displayPhoto} className="w-full h-full object-cover" alt="owner" onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} />
                          </div>
                        </div>
                        <div className="absolute -bottom-2 -right-2 w-14 h-14 bg-white rounded-full p-2 shadow-2xl border-2 border-yellow-400 z-30 overflow-hidden flex items-center justify-center">
                            {/* 🔥 순정 img 태그 */}
                            <img src={team.logo || FALLBACK_IMG} className="w-[70%] h-[70%] object-contain" alt="" onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} />
                        </div>
                      </div>
                      <div className="flex-1 text-center md:text-left">
                        <div className="inline-flex items-center gap-2 bg-yellow-500 text-black px-4 py-1 rounded-full font-black text-xs tracking-widest mb-4 shadow-lg"><span>👑</span> GRAND FINAL CHAMPION</div>
                        <h2 className="text-4xl md:text-6xl font-black text-white mb-2 tracking-tighter italic uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">{team.ownerName}</h2>
                        <p className="text-yellow-400 font-bold tracking-widest text-sm md:text-base opacity-80 uppercase italic mb-6">With {team.name}</p>
                        
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                          <div className="bg-slate-900/80 rounded-xl px-4 py-2.5 border border-yellow-500/30 min-w-[100px]">
                            <span className="text-[10px] text-yellow-500/80 block font-black mb-0.5">OVERALL RECORD</span>
                            <span className="text-lg font-bold text-white tracking-tight">{team.win || 0}W <span className="text-slate-400">{team.draw || 0}D</span> <span className="text-red-400">{team.loss || 0}L</span></span>
                          </div>
                          <div className="bg-slate-900/80 rounded-xl px-4 py-2.5 border border-yellow-500/30 min-w-[100px]">
                            <span className="text-[10px] text-yellow-500/80 block font-black mb-0.5">OVERALL GOAL DIFF</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-black text-yellow-400">{(team.gd || 0) > 0 ? `+${team.gd}` : team.gd || 0}</span>
                              <span className="text-[10px] text-slate-400 font-medium">({team.gf || 0}득 / {team.ga || 0}실)</span>
                            </div>
                          </div>
                          {topScorer && (
                            <div className="bg-gradient-to-r from-yellow-600/20 to-yellow-900/20 rounded-xl px-5 py-2.5 border border-yellow-400/50">
                              <span className="text-[10px] text-yellow-500 block font-black mb-0.5">TEAM MVP (TOP SCORER)</span>
                              <span className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5">⚽ {topScorer.name} <span className="text-sm text-yellow-400 ml-1">({topScorer.goals} Goals)</span></span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="absolute bottom-3 right-4 text-[9px] text-slate-500/60 font-bold italic tracking-wider z-20">
                      {footerText}
                    </div>
                  </div>
                </div>
              );
          })()}

          {sortedTeams.length > 0 && currentSeason?.type !== 'TOURNAMENT' && (() => {
            const leagueChampTeam = sortedTeams[0];
            const champOwnerInfo = (owners && owners.length > 0) ? owners.find(o => o.nickname === leagueChampTeam.ownerName) : null;
            const displayPhoto = champOwnerInfo?.photo || FALLBACK_IMG;
            const teamInfo = getTeamExtendedInfo(leagueChampTeam.name);

            const teamPlayers = (activeRankingData?.players || []).filter((p: any) => p.team === leagueChampTeam.name && p.goals > 0);
            const topScorer = teamPlayers.length > 0 ? teamPlayers.sort((a: any, b: any) => b.goals - a.goals)[0] : null;

            const isHybridOrCup = currentSeason?.type === 'CUP' || currentSeason?.type === 'LEAGUE_PLAYOFF';
            const badgeIcon = isHybridOrCup ? '🚩' : '🏆';
            const badgeText = isHybridOrCup ? (currentSeason?.type === 'CUP' ? 'GROUP STAGE 1ST' : 'REGULAR LEAGUE 1ST') : 'LEAGUE CHAMPION';
            
            const borderColor = isHybridOrCup ? 'border-blue-400/50' : 'border-yellow-400/50';
            const glowClass = isHybridOrCup ? 'shadow-[0_0_50px_rgba(59,130,246,0.3)]' : 'champion-glow';
            const bgGradient = isHybridOrCup ? 'from-blue-600/40 via-blue-900/60' : 'from-yellow-600/40 via-yellow-900/60';
            const dropShadow = isHybridOrCup ? 'drop-shadow-[0_0_30px_rgba(59,130,246,0.8)]' : 'drop-shadow-[0_0_30px_rgba(234,179,8,0.8)]';
            const ringGradient = isHybridOrCup ? 'from-blue-200 via-blue-500 to-blue-100' : 'from-yellow-200 via-yellow-500 to-yellow-100';
            const ringShadow = isHybridOrCup ? 'shadow-[0_0_30px_rgba(59,130,246,0.6)]' : 'shadow-[0_0_30px_rgba(234,179,8,0.6)]';
            const badgeBg = isHybridOrCup ? 'bg-blue-500 text-white' : 'bg-yellow-500 text-black';
            const subTextColor = isHybridOrCup ? 'text-blue-400' : 'text-yellow-400';
            const boxBorder = isHybridOrCup ? 'border-blue-500/30' : 'border-yellow-500/30';

            return (
              <div className="mb-6">
                {/* 🔥 캡처 속성/버튼 완전 제거된 순수 렌더링 카드 */}
                <div className={`relative w-full rounded-xl overflow-hidden border-2 ${borderColor} ${glowClass} transform transition-all duration-500 group bg-[#020617]`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} to-black z-0`}></div>
                  
                  <div className={`absolute top-1/2 right-10 -translate-y-1/2 opacity-20 group-hover:opacity-40 transition-opacity duration-700 pointer-events-none`}>
                     {/* 🔥 배경 이미지 순정화 */}
                     <div className={`w-[160px] h-[160px] filter ${dropShadow}`} style={{ backgroundImage: `url(${teamInfo.logo})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}></div>
                  </div>

                  <div className="relative z-10 flex flex-col md:flex-row items-center p-8 gap-8 backdrop-blur-sm pb-12">
                    <div className="relative pt-3 shrink-0">
                      {!isHybridOrCup && <div className="absolute -top-10 -left-6 text-7xl filter drop-shadow-2xl z-20 crown-bounce origin-bottom-left" style={{ transform: 'rotate(-15deg)' }}>👑</div>}
                      <div className={`w-32 h-32 md:w-40 md:h-40 rounded-full p-[4px] bg-gradient-to-tr ${ringGradient} ${ringShadow} relative z-10`}>
                        <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-950 bg-slate-900">
                          {/* 🔥 순정 img 태그 */}
                          <img src={displayPhoto} className="w-full h-full object-cover" alt="owner" onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} />
                        </div>
                      </div>
                      <div className={`absolute -bottom-2 -right-2 w-14 h-14 bg-white rounded-full p-2 shadow-2xl border-2 ${isHybridOrCup ? 'border-blue-400' : 'border-yellow-400'} z-30 overflow-hidden flex items-center justify-center`}>
                          {/* 🔥 순정 img 태그 */}
                          <img src={teamInfo.logo || FALLBACK_IMG} className="w-[70%] h-[70%] object-contain" alt="" onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} />
                      </div>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <div className={`inline-flex items-center gap-2 ${badgeBg} px-4 py-1 rounded-full font-black text-xs tracking-widest mb-4 shadow-lg`}><span>{badgeIcon}</span> {badgeText}</div>
                      <h2 className="text-4xl md:text-6xl font-black text-white mb-2 tracking-tighter italic uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">{leagueChampTeam.ownerName}</h2>
                      <p className={`${subTextColor} font-bold tracking-widest text-sm md:text-base opacity-80 uppercase italic mb-6`}>With {leagueChampTeam.name}</p>
                      
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                        <div className={`bg-slate-900/80 rounded-xl px-4 py-2.5 border ${boxBorder} min-w-[100px]`}>
                          <span className={`text-[10px] ${subTextColor} opacity-80 block font-black mb-0.5`}>RECORD</span>
                          <span className="text-lg font-bold text-white tracking-tight">{leagueChampTeam.win}W <span className="text-slate-400">{leagueChampTeam.draw}D</span> <span className="text-red-400">{leagueChampTeam.loss}L</span></span>
                        </div>
                        <div className={`bg-slate-900/80 rounded-xl px-4 py-2.5 border ${boxBorder} min-w-[100px]`}>
                          <span className={`text-[10px] ${subTextColor} opacity-80 block font-black mb-0.5`}>GOAL DIFF</span>
                          <div className="flex items-baseline gap-1">
                            <span className={`text-xl font-black ${subTextColor}`}>{leagueChampTeam.gd > 0 ? `+${leagueChampTeam.gd}` : leagueChampTeam.gd}</span>
                            <span className="text-[10px] text-slate-400 font-medium">({leagueChampTeam.gf}득 / {leagueChampTeam.ga}실)</span>
                          </div>
                        </div>
                        {topScorer && (
                          <div className={`bg-slate-900/80 rounded-xl px-5 py-2.5 border ${boxBorder}`}>
                            <span className={`text-[10px] ${subTextColor} block font-black mb-0.5`}>TEAM MVP (TOP SCORER)</span>
                            <span className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5">⚽ {topScorer.name} <span className={`text-sm ${subTextColor} ml-1`}>({topScorer.goals} Goals)</span></span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-3 right-4 text-[9px] text-slate-500/60 font-bold italic tracking-wider z-20">
                    {footerText}
                  </div>
                </div>
              </div>
            );
          })()}

          {(activeRankingData?.owners || []).length > 0 && (() => {
            const firstOwner = activeRankingData.owners[0];
            const matchedOwner = (owners && owners.length > 0) ? owners.find(owner => owner.nickname === firstOwner.name) : null;
            const displayPhoto = matchedOwner?.photo || FALLBACK_IMG;
            const displayPrize = getOwnerPrize(firstOwner.name);
            return (
              <div className="mb-6">
                {/* 🔥 캡처 속성/버튼 완전 제거된 순수 렌더링 카드 */}
                <div className="relative w-full rounded-xl overflow-hidden border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)] transform transition-transform duration-300 bg-[#020617]">
                  <div className="absolute inset-0 z-0 bg-gradient-to-tr from-emerald-900/40 via-transparent to-transparent"></div>
                  <div className="relative z-10 flex flex-col md:flex-row items-center p-5 gap-4 bg-slate-900/60 backdrop-blur-sm pb-10">
                    <div className="relative pt-3">
                      <div className="w-24 h-24 md:w-32 md:h-32 rounded-full p-[3px] bg-gradient-to-tr from-emerald-300 via-emerald-500 to-emerald-200 shadow-2xl relative z-10">
                        <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-900 bg-slate-800">
                          {/* 🔥 순정 img 태그 적용 */}
                          <img src={displayPhoto} className="w-full h-full object-cover" alt="owner" onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} />
                        </div>
                      </div>
                      <div className="absolute -bottom-3 inset-x-0 flex justify-center z-30">
                        <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full border-2 border-slate-900 shadow-lg tracking-wider">TOP POINTS</span>
                      </div>
                    </div>
                    <div className="flex-1 text-center md:text-left pt-3 md:pt-0">
                      <h3 className="text-xs md:text-sm text-emerald-400 font-bold tracking-[0.2em] mb-0.5 uppercase">Overall Top Points</h3>
                      <h2 className="text-3xl md:text-4xl font-black text-white mb-3 drop-shadow-md tracking-tight">{firstOwner.name}</h2>
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                        <div className="bg-slate-950/80 rounded-xl px-4 py-2.5 border border-slate-800 min-w-[80px]"><span className="text-[10px] text-slate-400 block font-bold mb-0.5">POINTS</span><span className="text-xl font-black text-emerald-400">{firstOwner.points}</span></div>
                        <div className="bg-slate-950/80 rounded-xl px-4 py-2.5 border border-slate-800 min-w-[100px]"><span className="text-[10px] text-slate-400 block font-bold mb-0.5">RECORD</span><span className="text-lg font-bold text-white tracking-tight">{firstOwner.win}W <span className="text-slate-500">{firstOwner.draw}D</span> <span className="text-red-400">{firstOwner.loss}L</span></span></div>
                        <div className="bg-emerald-900/20 rounded-xl px-5 py-2.5 border border-emerald-500/20"><span className="text-[10px] text-emerald-500 block font-black mb-0.5">TOTAL PRIZE MONEY</span><span className="text-xl font-black text-emerald-400">₩ {displayPrize.toLocaleString()}</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-4 text-[9px] text-slate-500/60 font-bold italic tracking-wider z-20">
                    {footerText}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
            <table className="w-full text-left text-xs uppercase border-collapse">
              <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                <tr><th className="p-4 w-8">#</th><th className="p-4">Owner</th><th className="p-4 text-center">Record</th><th className="p-4 text-center text-emerald-400">Pts</th><th className="p-4 text-right">Prize</th></tr>
              </thead>
              <tbody>
                {(activeRankingData?.owners || []).slice(1).map((o: any, i: number) => {
                  const actualRank = i + 2;
                  const matchedOwner = (owners && owners.length > 0) ? owners.find(owner => owner.nickname === o.name) : null;
                  return (
                    <tr key={i} className={`border-b border-slate-800/50 ${actualRank <= 3 ? 'bg-slate-800/30' : ''}`}>
                      <td className={`p-4 text-center font-bold ${actualRank === 2 ? 'text-slate-300' : actualRank === 3 ? 'text-orange-400' : 'text-slate-600'}`}>{actualRank}</td>
                      <td className="p-4"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full bg-slate-800 border overflow-hidden flex-shrink-0 shadow-lg ${actualRank === 2 ? 'border-slate-400' : actualRank === 3 ? 'border-orange-500' : 'border-slate-700'}`}>
                          {/* 🔥 순정 img 태그 적용 */}
                          <img 
                              src={matchedOwner?.photo || FALLBACK_IMG} 
                              className="w-full h-full object-cover" 
                              alt="" 
                              onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} 
                          />
                      </div><span className="font-bold text-sm whitespace-nowrap">{o.name}</span></div></td>
                      <td className="p-4 text-center text-slate-400 font-medium"><span className="text-white">{o.win}</span>W <span className="text-slate-500">{o.draw}D</span> <span className="text-red-400">{o.loss}L</span></td>
                      <td className="p-4 text-center text-emerald-400 font-black text-sm">{o.points}</td>
                      <td className={`p-4 text-right font-bold ${getOwnerPrize(o.name) > 0 ? 'text-yellow-400' : 'text-slate-600'}`}>₩ {getOwnerPrize(o.name).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rankingTab === 'PLAYERS' && (
        <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
          <div className="flex bg-slate-950 border-b border-slate-800">
            <button onClick={() => setRankPlayerMode('GOAL')} className={`flex-1 py-3 text-xs font-bold ${rankPlayerMode === 'GOAL' ? 'text-yellow-400 bg-slate-900' : 'text-slate-500'}`}>⚽ TOP SCORERS</button>
            <button onClick={() => setRankPlayerMode('ASSIST')} className={`flex-1 py-3 text-xs font-bold ${rankPlayerMode === 'ASSIST' ? 'text-blue-400 bg-slate-900' : 'text-slate-500'}`}>🅰️ TOP ASSISTS</button>
          </div>
          <table className="w-full text-left text-xs uppercase">
            <thead className="bg-slate-950 text-slate-500"><tr><th className="p-3 w-8">#</th><th className="p-3">Player</th><th className="p-3">Team</th><th className="p-3 text-right">{rankPlayerMode}</th></tr></thead>
            <tbody>
              {rankedPlayers.slice(0, 20).map((p: any, i: number) => (
                <tr key={i} className="border-b border-slate-800/50">
                  <td className={`p-3 text-center ${p.rank <= 3 ? 'text-emerald-400 font-bold' : 'text-slate-600'}`}>{p.rank}</td>
                  <td className="p-3 font-bold text-white">{p.name} <span className="text-[9px] text-slate-500 font-normal ml-1">({p.owner})</span></td>
                  <td className="p-3 text-slate-400 flex items-center gap-2">
                      {/* 🔥 순정 img 태그 적용 */}
                      <img 
                          src={p.teamLogo} 
                          className="w-5 h-5 object-contain rounded-full bg-white p-0.5" 
                          alt="" 
                          onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} 
                      />
                      <span>{p.team}</span>
                  </td>
                  <td className={`p-3 text-right font-bold ${rankPlayerMode === 'GOAL' ? 'text-yellow-400' : 'text-blue-400'}`}>{rankPlayerMode === 'GOAL' ? p.goals : p.assists}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rankingTab === 'HIGHLIGHTS' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(activeRankingData?.highlights || []).map((m: any, idx: number) => (
            <div key={idx} className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 group hover:border-emerald-500 transition-all cursor-pointer" onClick={() => window.open(m.youtubeUrl, '_blank')}>
              <div className="relative aspect-video">
                {/* 🔥 순정 img 태그 적용 */}
                <img 
                    src={getYouTubeThumbnail(m.youtubeUrl)} 
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                    alt="" 
                />
                <div className="absolute inset-0 flex items-center justify-center"><div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-110 transition-transform">▶</div></div>
              </div>
              <div className="p-3 flex items-center gap-3">
                {/* 🔥 순정 img 태그 적용 */}
                <img 
                    src={m.winnerLogo || FALLBACK_IMG} 
                    className="w-8 h-8 rounded-full bg-white object-contain p-0.5" 
                    alt="" 
                    onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} 
                />
                <div className="flex-1 min-w-0"><p className="text-[10px] text-slate-500 font-bold uppercase">{m.stage} • {m.matchLabel}</p><p className="text-xs font-bold text-white truncate">{m.home} <span className="text-emerald-400">{m.homeScore}:{m.awayScore}</span> {m.away}</p></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RankingView;