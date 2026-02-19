/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { FALLBACK_IMG, Owner } from '../types';
import { getYouTubeThumbnail } from '../utils/helpers';

declare module 'react' {
  interface StyleHTMLAttributes<T> extends React.HTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}

const TBD_LOGO = "https://img.uefa.com/imgml/uefacom/club-generic-badge-new.svg";

interface RankingViewProps {
  seasons: any[];
  viewSeasonId: number;
  setViewSeasonId: (id: number) => void;
  activeRankingData: any;
  owners?: Owner[];
  knockoutStages: any;
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
  const prizeRule = currentSeason?.prizes || { first: 0, second: 0, third: 0 };

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

  const sortedTeams = useMemo(() => getRankedTeams(activeRankingData.teams), [activeRankingData.teams]);

  const getOwnerPrize = (ownerName: string) => {
    let totalPrize = 0;
    if (ownerName && ownerName === sortedTeams[0]?.ownerName) totalPrize += (prizeRule.first || 0);
    if (ownerName && ownerName === sortedTeams[1]?.ownerName) totalPrize += (prizeRule.second || 0);
    if (ownerName && ownerName === sortedTeams[2]?.ownerName) totalPrize += (prizeRule.third || 0);
    return totalPrize;
  };

  const normalize = (str: string) => str ? str.toString().trim().toLowerCase().replace(/\s+/g, '') : "";

  const getWinnerName = (match: any): string => {
    if (!match) return 'TBD';
    if (match.home === 'BYE' && match.away !== 'BYE') return match.away;
    if (match.away === 'BYE' && match.home !== 'BYE') return match.home;
    if (match.home === 'BYE' && match.away === 'BYE') return 'BYE';
    if (match.status !== 'COMPLETED') return 'TBD';
    const h = Number(match.homeScore || 0);
    const a = Number(match.awayScore || 0);
    return h > a ? match.home : a > h ? match.away : 'TBD';
  };

  const getTeamExtendedInfo = (teamIdentifier: string) => {
    const tbdTeam = { id: 0, name: teamIdentifier || 'TBD', logo: TBD_LOGO, ownerName: '-', region: '', tier: 'C', realRankScore: 0, realFormScore: 0, condition: 'C', real_rank: null };
    if (!teamIdentifier || teamIdentifier === 'TBD') return tbdTeam;
    if (teamIdentifier === 'BYE') return { ...tbdTeam, name: 'BYE', ownerName: 'SYSTEM' };
    const normId = normalize(teamIdentifier);
    let stats = activeRankingData?.teams?.find((t: any) => normalize(t.name) === normId);
    let master = masterTeams.find((m: any) => m.name === teamIdentifier || normalize(m.name) === normId || normalize(m.teamName) === normId || m.id === teamIdentifier);
    return { id: stats?.id || master?.id || 0, name: stats?.name || master?.name || teamIdentifier, logo: stats?.logo || master?.logo || TBD_LOGO, ownerName: stats?.ownerName || master?.ownerName || 'CPU', region: master?.region || '', tier: master?.tier || 'C', realRankScore: master?.realRankScore, realFormScore: master?.realFormScore, condition: master?.condition || 'C', real_rank: master?.real_rank };
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
    return (
      <div className="flex items-center gap-4">
        <div className="relative w-10 h-10 flex-shrink-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${isTbd ? 'bg-slate-800' : 'bg-white shadow-md'}`}>
            <img src={info.logo || team.logo} className={`${isTbd ? 'w-full h-full' : 'w-[70%] h-[70%]'} object-contain`} alt="" onError={(e) => { e.currentTarget.src = FALLBACK_IMG }} />
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
      const teamIds = currentSeason.groups[gName];
      if (teamIds && teamIds.length > 0) {
        const groupTeams = activeRankingData.teams.filter((t: any) => teamIds.includes(t.id));
        groups[gName] = getRankedTeams(groupTeams);
      }
    });
    return groups;
  }, [currentSeason, activeRankingData.teams]);

  const sortedGroupKeys = useMemo(() => groupStandings ? Object.keys(groupStandings).sort() : [], [groupStandings]);

  useEffect(() => {
    if (sortedGroupKeys.length > 0 && !sortedGroupKeys.includes(selectedGroupTab)) setSelectedGroupTab(sortedGroupKeys[0]);
  }, [sortedGroupKeys, selectedGroupTab]);

  const tournamentChampion = useMemo(() => {
    const final = knockoutStages?.final?.[0];
    if (!final) return null;
    const winnerName = getWinnerName(final);
    if (winnerName === 'TBD' || winnerName === 'BYE') return null;
    const teamInfo = activeRankingData?.teams?.find((t: any) => t.name === winnerName);
    const ownerName = teamInfo?.ownerName;
    return (owners && owners.length > 0) ? owners.find(o => o.nickname === ownerName) : { nickname: ownerName, photo: FALLBACK_IMG };
  }, [knockoutStages, activeRankingData, owners]);

  const TournamentMatchBox = ({ match, title, highlight = false, isFinal = false }: { match: any, title?: string, highlight?: boolean, isFinal?: boolean }) => {
    const safeMatch = match || { home: 'TBD', away: 'TBD', homeScore: '', awayScore: '' };
    const home = getTeamExtendedInfo(safeMatch.home);
    const away = getTeamExtendedInfo(safeMatch.away);
    const winner = getWinnerName(safeMatch);
    const isHomeWin = winner !== 'TBD' && winner === safeMatch.home;
    const isAwayWin = winner !== 'TBD' && winner === safeMatch.away;
    const hScore = safeMatch.homeScore !== '' ? Number(safeMatch.homeScore) : (safeMatch.home === 'BYE' ? 0 : null);
    const aScore = safeMatch.awayScore !== '' ? Number(safeMatch.awayScore) : (safeMatch.away === 'BYE' ? 0 : null);
    const Row = ({ team, score, isWinner }: { team: any, score: any, isWinner: boolean }) => {
      const isTbd = team.name === 'TBD';
      const isBye = team.name === 'BYE';
      return (
        <div className={`flex items-center justify-between p-3 ${isWinner ? 'bg-gradient-to-r from-emerald-900/40 to-transparent' : ''} ${isTbd || isBye ? 'opacity-30' : ''}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-7 h-7 flex-shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center overflow-hidden ${isTbd || isBye ? 'bg-slate-700' : 'bg-white shadow-sm'}`}>
                <img src={team.logo} className={`${isTbd || isBye ? 'w-full h-full' : 'w-[70%] h-[70%]'} object-contain`} alt="" />
              </div>
              {!isTbd && !isBye && getTierBadge(team.tier)}
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <span className={`text-[13px] font-black leading-tight truncate uppercase tracking-tight ${isWinner ? 'text-white' : isTbd || isBye ? 'text-slate-500' : 'text-slate-400'}`}>{team.name}</span>
              {!isTbd && !isBye && (
                <div className="flex items-center gap-1.5 mt-0.5 scale-[0.85] origin-left">
                  {getRealRankBadge(team.real_rank)}
                  {getConditionBadge(team.condition)}
                  <span className="text-[9px] text-slate-500 font-bold italic truncate">{team.ownerName}</span>
                </div>
              )}
              {isBye && <span className="text-[9px] text-slate-600 font-bold italic">Unassigned Slot</span>}
            </div>
          </div>
          <div className={`text-xl font-black italic tracking-tighter w-8 text-right ${isWinner ? 'text-emerald-400' : 'text-slate-600'}`}>{isBye ? '0' : (score ?? '-')}</div>
        </div>
      );
    };
    return (
      <div className={`flex flex-col w-full ${isFinal ? 'scale-110 origin-top' : ''}`}>
        {title && <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 pl-1 tracking-widest opacity-70">{title}</div>}
        <div className={`flex flex-col w-[210px] bg-[#0f141e] border rounded-xl overflow-hidden shadow-sm relative z-10 transition-all ${highlight || isFinal ? 'border-yellow-500/50 shadow-yellow-500/10' : 'border-slate-800/50'}`}>
          <Row team={home} score={hScore} isWinner={isHomeWin} />
          <div className="h-[1px] bg-slate-800/40 w-full relative"></div>
          <Row team={away} score={aScore} isWinner={isAwayWin} />
        </div>
      </div>
    );
  };

  const getPlayerRanking = (players: any[]) => {
    const sortedPlayers = [...players]
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

  const rankedPlayers = getPlayerRanking(activeRankingData.players || []);

  return (
    <div className="space-y-6 animate-in fade-in">
      <style jsx>{`
        .crown-icon { animation: bounce 2s infinite; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .champion-glow { box-shadow: 0 0 50px rgba(234, 179, 8, 0.4); }
      `}</style>

      <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col gap-4">
        <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="w-full bg-slate-950 text-white text-sm p-3 rounded-xl border border-slate-700 font-bold italic">
          {seasons.map(s => (
            <option key={s.id} value={s.id}>
              {(() => {
                const pureName = s.name.replace(/^(🏆|🏳️|⚔️|⚽|🗓️)\s*/, '');
                let icon = '🏳️'; if (s.type === 'CUP') icon = '🏆'; if (s.type === 'TOURNAMENT') icon = '⚔️';
                return `${icon} ${pureName}`;
              })()}
            </option>
          ))}
        </select>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {['STANDINGS', 'OWNERS', 'PLAYERS', 'HIGHLIGHTS'].map(sub => (
            <button key={sub} onClick={() => setRankingTab(sub as any)} className={`px-4 py-2 rounded-lg text-xs font-black italic transition-all whitespace-nowrap ${rankingTab === sub ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}>{sub}</button>
          ))}
        </div>
      </div>

      {rankingTab === 'STANDINGS' && (
        <div className="space-y-12">
          {currentSeason?.type === 'CUP' && knockoutStages && (
            <div className="overflow-x-auto pb-4 no-scrollbar">
              <div className={`${knockoutStages.roundOf8 ? 'min-w-[700px]' : 'min-w-[500px]'} px-4`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-6 bg-yellow-500 rounded-full shadow-[0_0_10px_#eab308]"></div>
                  <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">Tournament Bracket</h3>
                </div>
                <div className="flex items-center gap-10">
                  {knockoutStages.roundOf8 && (
                    <div className="flex flex-col gap-5">
                      {knockoutStages.roundOf8.map((m: any, idx: number) => <TournamentMatchBox key={`r8-${idx}`} title={`Match ${idx + 1}`} match={m} />)}
                    </div>
                  )}
                  <div className="flex flex-col gap-12">
                    {knockoutStages.roundOf4.map((m: any, idx: number) => <TournamentMatchBox key={`r4-${idx}`} title={`Semi ${idx + 1}`} match={m} />)}
                  </div>
                  <div className="relative pt-8">
                    <div className="absolute -top-0 left-1/2 -translate-x-1/2 text-3xl crown-icon">👑</div>
                    <TournamentMatchBox title="Final" match={knockoutStages.final?.[0]} isFinal highlight />
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
                        <td className={`p-4 text-center font-bold ${t.rank === 1 ? 'text-yellow-400' : t.rank === 2 ? 'text-slate-300' : 'text-slate-600'}`}>{t.rank}</td>
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
              <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">League Total Standing</h3>
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
          
          {/* 🔥 1. [디벨롭] 리그 1위 우승 오너 카드 (신규 추가) */}
          {sortedTeams.length > 0 && (() => {
            const leagueChampTeam = sortedTeams[0];
            const champOwnerInfo = (owners && owners.length > 0) ? owners.find(o => o.nickname === leagueChampTeam.ownerName) : null;
            const displayPhoto = champOwnerInfo?.photo || FALLBACK_IMG;
            const teamInfo = getTeamExtendedInfo(leagueChampTeam.name);

            return (
              <div className="relative w-full rounded-[2rem] overflow-hidden border-2 border-yellow-400/50 champion-glow transform hover:scale-[1.03] transition-all duration-500 mb-4 group">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/40 via-yellow-900/60 to-black z-0"></div>
                <div className="absolute top-1/2 right-10 -translate-y-1/2 opacity-20 group-hover:opacity-40 transition-opacity duration-700 pointer-events-none">
                  <img src={teamInfo.logo} className="w-[160px] h-[160px] object-contain filter drop-shadow-[0_0_30px_rgba(234,179,8,0.8)]" alt=""/>
                </div>
                <div className="relative z-10 flex flex-col md:flex-row items-center p-8 gap-8 backdrop-blur-sm">
                  <div className="relative pt-3">
                    <div className="absolute -top-10 -left-6 text-7xl filter drop-shadow-2xl z-20 crown-bounce origin-bottom-left" style={{ transform: 'rotate(-15deg)' }}>👑</div>
                    <div className="w-32 h-32 md:w-40 md:h-40 rounded-full p-[4px] bg-gradient-to-tr from-yellow-200 via-yellow-500 to-yellow-100 shadow-[0_0_30px_rgba(234,179,8,0.6)] relative z-10">
                      <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-950">
                        <img src={displayPhoto} alt={leagueChampTeam.ownerName} className="w-full h-full object-cover" />
                      </div>
                    </div>
                    {/* 🔥 챔피언 팀 엠블럼 뱃지 */}
                    <div className="absolute -bottom-2 -right-2 w-14 h-14 bg-white rounded-full p-2 shadow-2xl border-2 border-yellow-400 z-30">
                        <img src={teamInfo.logo} className="w-full h-full object-contain" alt="챔피언 팀" />
                    </div>
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 bg-yellow-500 text-black px-4 py-1 rounded-full font-black text-xs tracking-widest mb-4 shadow-lg"><span>🏆</span> LEAGUE CHAMPION</div>
                    <h2 className="text-4xl md:text-6xl font-black text-white mb-2 tracking-tighter italic uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">{leagueChampTeam.ownerName}</h2>
                    <p className="text-yellow-400 font-bold tracking-widest text-sm md:text-base opacity-80 uppercase italic">With {leagueChampTeam.name}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 🔥 2. 누적 승점 1위 오너 카드 (기존 카드 스타일 유지 및 타이틀 변경) */}
          {activeRankingData.owners.length > 0 && (() => {
            const firstOwner = activeRankingData.owners[0];
            const matchedOwner = (owners && owners.length > 0) ? owners.find(owner => owner.nickname === firstOwner.name) : null;
            const displayPhoto = matchedOwner?.photo || FALLBACK_IMG;
            const displayPrize = getOwnerPrize(firstOwner.name);
            return (
              <div className="relative w-full rounded-2xl overflow-hidden border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)] mb-6 transform hover:scale-[1.02] transition-transform duration-300">
                <div className="absolute inset-0 z-0 bg-gradient-to-tr from-emerald-900/40 via-transparent to-transparent"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center p-5 gap-4 bg-slate-900/60 backdrop-blur-sm">
                  <div className="relative pt-3">
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-full p-[3px] bg-gradient-to-tr from-emerald-300 via-emerald-500 to-emerald-200 shadow-2xl relative z-10">
                      <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-900">
                        <img src={displayPhoto} alt={firstOwner.name} className="w-full h-full object-cover" />
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
                      <div className="bg-slate-950/80 rounded-xl px-4 py-2.5 border border-slate-800 min-w-[100px]"><span className="text-[10px] text-slate-400 block font-bold mb-0.5">RECORD</span><span className="text-lg font-bold text-white tracking-tight">{firstOwner.win}W {firstOwner.draw}D {firstOwner.loss}L</span></div>
                      <div className="bg-emerald-900/20 rounded-xl px-5 py-2.5 border border-emerald-500/20"><span className="text-[10px] text-emerald-500 block font-black mb-0.5">PRIZE MONEY</span><span className="text-xl font-black text-emerald-400">₩ {displayPrize.toLocaleString()}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 오너 랭킹 테이블 (기존 유지) */}
          <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
            <table className="w-full text-left text-xs uppercase border-collapse">
              <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                <tr><th className="p-4 w-8">#</th><th className="p-4">Owner</th><th className="p-4 text-center">Record</th><th className="p-4 text-center text-emerald-400">Pts</th><th className="p-4 text-right">Prize</th></tr>
              </thead>
              <tbody>
                {activeRankingData.owners.slice(1).map((o: any, i: number) => {
                  const actualRank = i + 2;
                  const matchedOwner = (owners && owners.length > 0) ? owners.find(owner => owner.nickname === o.name) : null;
                  return (
                    <tr key={i} className={`border-b border-slate-800/50 ${actualRank <= 3 ? 'bg-slate-800/30' : ''}`}>
                      <td className={`p-4 text-center font-bold ${actualRank === 2 ? 'text-slate-300' : actualRank === 3 ? 'text-orange-400' : 'text-slate-600'}`}>{actualRank}</td>
                      <td className="p-4"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full bg-slate-800 border overflow-hidden flex-shrink-0 shadow-lg ${actualRank === 2 ? 'border-slate-400' : actualRank === 3 ? 'border-orange-500' : 'border-slate-700'}`}><img src={matchedOwner?.photo || FALLBACK_IMG} alt={o.name} className="w-full h-full object-cover" onError={(e: any) => e.target.src = FALLBACK_IMG} /></div><span className="font-bold text-sm whitespace-nowrap">{o.name}</span></div></td>
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
            <thead className="bg-slate-900 text-slate-500"><tr><th className="p-3 w-8">#</th><th className="p-3">Player</th><th className="p-3">Team</th><th className="p-3 text-right">{rankPlayerMode}</th></tr></thead>
            <tbody>
              {rankedPlayers.slice(0, 20).map((p: any, i: number) => (
                <tr key={i} className="border-b border-slate-800/50">
                  <td className={`p-3 text-center ${p.rank <= 3 ? 'text-emerald-400 font-bold' : 'text-slate-600'}`}>{p.rank}</td>
                  <td className="p-3 font-bold text-white">{p.name} <span className="text-[9px] text-slate-500 font-normal ml-1">({p.owner})</span></td>
                  <td className="p-3 text-slate-400 flex items-center gap-2"><img src={p.teamLogo} className="w-5 h-5 object-contain rounded-full bg-white p-0.5" alt="" onError={(e: any) => e.target.src = FALLBACK_IMG} /><span>{p.team}</span></td>
                  <td className={`p-3 text-right font-bold ${rankPlayerMode === 'GOAL' ? 'text-yellow-400' : 'text-blue-400'}`}>{rankPlayerMode === 'GOAL' ? p.goals : p.assists}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rankingTab === 'HIGHLIGHTS' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {activeRankingData.highlights.map((m: any, idx: number) => (
            <div key={idx} className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 group hover:border-emerald-500 transition-all cursor-pointer" onClick={() => window.open(m.youtubeUrl, '_blank')}>
              <div className="relative aspect-video">
                <img src={getYouTubeThumbnail(m.youtubeUrl)} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                <div className="absolute inset-0 flex items-center justify-center"><div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-110 transition-transform">▶</div></div>
              </div>
              <div className="p-3 flex items-center gap-3">
                <img src={m.winnerLogo || FALLBACK_IMG} className="w-8 h-8 rounded-full bg-white object-contain p-0.5" alt="" />
                <div className="flex-1 min-w-0"><p className="text-[10px] text-slate-500 font-bold uppercase">{m.stage} • {m.matchLabel}</p><p className="text-xs font-bold text-white truncate">{m.home} <span className="text-emerald-400">{m.homeScore}:{m.awayScore}</span> {m.away}</p></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};