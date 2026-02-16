/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query } from 'firebase/firestore'; 
import { db } from '../firebase'; 
import { FALLBACK_IMG, Owner, MasterTeam } from '../types'; 
import { getYouTubeThumbnail } from '../utils/helpers'; 
import { MatchCard } from './MatchCard';
import { TeamCard } from './TeamCard';

interface RankingViewProps {
  seasons: any[];
  viewSeasonId: number;
  setViewSeasonId: (id: number) => void;
  activeRankingData: any;
  owners?: Owner[]; 
}

export const RankingView = ({ seasons, viewSeasonId, setViewSeasonId, activeRankingData, owners = [] }: RankingViewProps) => {
  const [rankingTab, setRankingTab] = useState<'STANDINGS' | 'OWNERS' | 'PLAYERS' | 'HIGHLIGHTS'>('STANDINGS');
  const [rankPlayerMode, setRankPlayerMode] = useState<'GOAL' | 'ASSIST'>('GOAL');
  
  // 조별리그 탭 상태 (기본값 A)
  const [selectedGroupTab, setSelectedGroupTab] = useState<string>('A');

  const [masterTeams, setMasterTeams] = useState<any[]>([]);

  useEffect(() => {
    const fetchMasterTeams = async () => {
      try {
        const q = query(collection(db, 'master_teams'));
        const querySnapshot = await getDocs(q);
        const teams = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id, 
                ...data,
                teamName: data.team || data.name || doc.id 
            };
        });
        setMasterTeams(teams); 
      } catch (error) {
        console.error("Error fetching master teams:", error);
      }
    };
    fetchMasterTeams();
  }, []); 

  const currentSeason = seasons.find(s => s.id === viewSeasonId);
  const prizeRule = currentSeason?.prizes || { first: 0, second: 0, third: 0 };

  const sortedTeams = [...(activeRankingData.teams || [])].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points; 
    if (b.gd !== a.gd) return b.gd - a.gd;                 
    return (b.gf || 0) - (a.gf || 0);                      
  });

  const firstPrizeOwnerName = sortedTeams[0]?.ownerName;  
  const secondPrizeOwnerName = sortedTeams[1]?.ownerName; 
  const thirdPrizeOwnerName = sortedTeams[2]?.ownerName; 

  const getOwnerPrize = (ownerName: string) => {
    let totalPrize = 0;
    if (ownerName === firstPrizeOwnerName) totalPrize += (prizeRule.first || 0);
    if (ownerName === secondPrizeOwnerName) totalPrize += (prizeRule.second || 0);
    if (ownerName === thirdPrizeOwnerName) totalPrize += (prizeRule.third || 0);
    return totalPrize;
  };

  const getPlayerRanking = (players: any[]) => {
    const sortedPlayers = players
        .filter((p:any) => rankPlayerMode === 'GOAL' ? p.goals > 0 : p.assists > 0)
        .sort((a:any,b:any) => rankPlayerMode === 'GOAL' ? b.goals - a.goals : b.assists - a.assists);

    let currentRank = 1;
    let skip = 0; 

    return sortedPlayers.map((player, index, array) => {
        if (index > 0) {
            const prevPlayer = array[index - 1];
            const prevScore = rankPlayerMode === 'GOAL' ? prevPlayer.goals : prevPlayer.assists;
            const currScore = rankPlayerMode === 'GOAL' ? player.goals : player.assists;
            if (prevScore === currScore) skip++;
            else { currentRank += 1 + skip; skip = 0; }
        }
        return { ...player, rank: currentRank };
    });
  };

  const rankedPlayers = getPlayerRanking(activeRankingData.players || []);

  const getRealRankBadge = (rank: number | undefined | null) => {
    if (!rank) return <div className="bg-slate-800 text-slate-500 text-[9px] font-bold px-1.5 py-[1px] rounded-[3px] border border-slate-700/50 leading-none">-</div>;
    let bgClass = "bg-slate-800 text-slate-400 border-slate-700"; 
    if (rank === 1) bgClass = "bg-yellow-500 text-black border-yellow-600";
    else if (rank === 2) bgClass = "bg-slate-300 text-black border-slate-400";
    else if (rank === 3) bgClass = "bg-orange-400 text-black border-orange-500";
    return (
        <div className={`${bgClass} border text-[9px] font-black px-1.5 py-[1px] rounded-[3px] italic shadow-sm shrink-0 leading-none`}>
            R.{rank}
        </div>
    );
  };

  const renderOverlayCondition = (cond: string) => {
    const c = (cond || '').toUpperCase();
    const circleBase = "absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[#0f172a] border border-slate-600 flex items-center justify-center shadow-md z-10";
    const iconBase = "text-[7px] font-black leading-none";
    switch (c) {
        case 'A': return <div className={`${circleBase} border-emerald-500/50`}><span className={`${iconBase} text-emerald-400`}>↑</span></div>;
        case 'B': return <div className={`${circleBase} border-lime-500/50`}><span className={`${iconBase} text-lime-400`}>↗</span></div>;
        case 'C': return <div className={`${circleBase} border-yellow-500/50`}><span className={`${iconBase} text-yellow-400`}>→</span></div>;
        case 'D': return <div className={`${circleBase} border-orange-500/50`}><span className={`${iconBase} text-orange-400`}>↘</span></div>;
        case 'E': return <div className={`${circleBase} border-red-500/50`}><span className={`${iconBase} text-red-500`}>↓</span></div>;
        default:  return null;
    }
  };

  const renderCondition = (cond: string) => {
      const c = (cond || '').toUpperCase();
      const circleBase = "w-5 h-5 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center shadow-sm shrink-0";
      const iconBase = "text-[10px] font-bold leading-none";
      switch (c) {
          case 'A': return <div className={`${circleBase} border-emerald-500/30`}><span className={`${iconBase} text-emerald-400`}>⬆</span></div>;
          case 'B': return <div className={`${circleBase} border-lime-500/30`}><span className={`${iconBase} text-lime-400`}>↗</span></div>;
          case 'C': return <div className={`${circleBase} border-yellow-500/30`}><span className={`${iconBase} text-yellow-400`}>➡</span></div>;
          case 'D': return <div className={`${circleBase} border-orange-500/30`}><span className={`${iconBase} text-orange-400`}>↘</span></div>;
          case 'E': return <div className={`${circleBase} border-red-500/30`}><span className={`${iconBase} text-red-500`}>⬇</span></div>;
          default:  return <div className={circleBase}><span className="text-[8px] text-slate-600">-</span></div>;
      }
  };

  const normalize = (str: string) => str ? str.toString().trim().toLowerCase() : "";

  const getTeamExtendedInfo = (teamName: string) => {
      const tbdTeam = {
          id: 0,
          name: teamName || 'TBD',
          logo: FALLBACK_IMG,
          ownerName: '-',
          region: '',
          tier: '', 
          realRankScore: 0,
          realFormScore: 0,
          condition: '',
          real_rank: null
      };

      if (!teamName || teamName === 'TBD') return tbdTeam;

      const stats = activeRankingData.teams?.find((t:any) => normalize(t.name) === normalize(teamName));
      const master = masterTeams.find(m => normalize(m.name) === normalize(teamName) || normalize(m.teamName) === normalize(teamName));
      
      if (!stats && !master) return { ...tbdTeam, name: teamName };

      return {
          id: stats?.id || master?.id || 0,
          name: teamName,
          logo: stats?.logo || master?.logo || FALLBACK_IMG,
          ownerName: stats?.ownerName || master?.ownerName || 'CPU',
          region: master?.region || '',
          tier: master?.tier || '',
          realRankScore: master?.realRankScore,
          realFormScore: master?.realFormScore,
          condition: master?.condition,
          real_rank: master?.real_rank
      };
  };

  const groupStandings = useMemo(() => {
    if (currentSeason?.type !== 'CUP' || !currentSeason?.groups) return null;
    const groups: { [key: string]: any[] } = {};
    Object.keys(currentSeason.groups).forEach(gName => {
        const teamIds = currentSeason.groups[gName];
        if (teamIds && teamIds.length > 0) { 
            groups[gName] = sortedTeams
                .filter(t => teamIds.includes(t.id))
                .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
        }
    });
    return groups;
  }, [currentSeason, sortedTeams]);

  // 🔥 [NEW] 조별리그 키 정렬 (A, B, C, D...)
  const sortedGroupKeys = useMemo(() => {
      if (!groupStandings) return [];
      return Object.keys(groupStandings).sort(); // 알파벳 순 정렬
  }, [groupStandings]);

  // 🔥 [Fix] 그룹 탭 자동 초기화 로직 수정 (강제 리셋 방지)
  useEffect(() => {
      if (sortedGroupKeys.length > 0) {
          // 현재 선택된 탭이 유효하지 않은 경우에만 첫 번째 그룹으로 설정
          if (!sortedGroupKeys.includes(selectedGroupTab)) {
              setSelectedGroupTab(sortedGroupKeys[0]);
          }
      }
  }, [sortedGroupKeys, selectedGroupTab]);

  const knockoutStages = useMemo(() => {
    if (currentSeason?.type !== 'CUP') return null;
    const allMatches = currentSeason.rounds?.find((r: any) => r.round === 2)?.matches || [];
    
    const isValidMatch = (m: any) => m.home !== undefined && m.away !== undefined;

    return {
      roundOf8: allMatches.filter((m: any) => m.stage === 'ROUND_OF_8' && isValidMatch(m)),
      roundOf4: allMatches.filter((m: any) => m.stage === 'ROUND_OF_4' && isValidMatch(m)),
      final: allMatches.filter((m: any) => (m.stage === 'FINAL' || m.stage === 'KNOCKOUT') && isValidMatch(m))
    };
  }, [currentSeason]);

  const TournamentTeamRow = ({ team, score, isWinner }: { team: any, score: number | null, isWinner: boolean }) => (
      <div className={`flex items-center justify-between px-3 py-2.5 h-[44px] ${isWinner ? 'bg-gradient-to-r from-emerald-900/40 to-transparent' : ''} ${team.name === 'TBD' ? 'opacity-30' : ''}`}>
          <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-7 h-7 flex-shrink-0">
                  <div className={`w-7 h-7 rounded-full p-[1.5px] shadow-sm flex items-center justify-center overflow-hidden ${team.name === 'TBD' ? 'bg-slate-700' : 'bg-white'}`}>
                      <img src={team.logo} className="w-full h-full object-contain" alt="" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>
                  </div>
                  {team.name !== 'TBD' && renderOverlayCondition(team.condition)}
              </div>
              <div className="flex flex-col justify-center">
                  <span className={`text-sm font-bold leading-none truncate uppercase tracking-tight ${isWinner ? 'text-white' : team.name === 'TBD' ? 'text-slate-500' : 'text-slate-400'}`}>
                      {team.name}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                      {team.name !== 'TBD' && getRealRankBadge(team.real_rank)}
                      <span className="text-[10px] text-slate-500 font-bold truncate">{team.ownerName}</span>
                  </div>
              </div>
          </div>
          <div className={`text-xl font-black italic tracking-tighter w-8 text-right ${isWinner ? 'text-emerald-400 drop-shadow-md' : 'text-slate-600'}`}>
              {score ?? '-'}
          </div>
      </div>
  );

  const TournamentMatchBox = ({ match, title, highlight = false }: { match: any, title?: string, highlight?: boolean }) => {
      const home = getTeamExtendedInfo(match.home);
      const away = getTeamExtendedInfo(match.away);
      const homeScore = match.homeScore !== '' ? Number(match.homeScore) : null;
      const awayScore = match.awayScore !== '' ? Number(match.awayScore) : null;
      const isHomeWin = homeScore !== null && awayScore !== null && homeScore > awayScore;
      const isAwayWin = homeScore !== null && awayScore !== null && awayScore > homeScore;

      return (
          <div className="flex flex-col w-full">
              {title && (
                  <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 pl-1 tracking-widest opacity-70">
                      {title}
                  </div>
              )}
              <div className={`flex flex-col w-[210px] bg-[#0f141e] border rounded-xl overflow-hidden shadow-sm relative z-10 transition-all ${highlight ? 'border-yellow-500/50 shadow-yellow-500/10' : 'border-slate-800/50'}`}>
                  <TournamentTeamRow team={home} score={homeScore} isWinner={isHomeWin} />
                  <div className="h-[1px] bg-slate-800/40 w-full relative"></div>
                  <TournamentTeamRow team={away} score={awayScore} isWinner={isAwayWin} />
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-6 animate-in fade-in">
        <style jsx>{`
            .qualified-row { position: relative; background: rgba(16, 185, 129, 0.05) !important; }
            .crown-icon { animation: bounce 2s infinite; }
            @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
            
            .bracket-tree { display: flex; align-items: center; justify-content: flex-start; gap: 40px; padding: 20px 0 20px 4px; }
            .bracket-column { display: flex; flex-direction: column; justify-content: center; gap: 20px; position: relative; }
            
            /* 가로 스크롤바 숨김 */
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>

        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col gap-4">
            <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="w-full bg-slate-950 text-white text-sm p-3 rounded-xl border border-slate-700 font-bold italic">
                {seasons.map(s => <option key={s.id} value={s.id}>{s.type === 'CUP' ? '🏆' : '⚽'} {s.name}</option>)}
            </select>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {['STANDINGS', 'OWNERS', 'PLAYERS', 'HIGHLIGHTS'].map(sub => (
                    <button key={sub} onClick={() => setRankingTab(sub as any)} className={`px-4 py-2 rounded-lg text-xs font-black italic transition-all whitespace-nowrap ${rankingTab === sub ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}>{sub}</button>
                ))}
            </div>
        </div>

        {rankingTab === 'STANDINGS' && (
            <div className="space-y-12">
                {currentSeason?.type === 'CUP' ? (
                    <>
                        {/* 1. 토너먼트 트리 영역 */}
                        {(knockoutStages?.roundOf8.length! > 0 || knockoutStages?.roundOf4.length! > 0 || knockoutStages?.final.length! > 0) && (
                            <div className="overflow-x-auto pb-4">
                                <div className="min-w-[700px] px-4">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-1.5 h-6 bg-yellow-500 rounded-full shadow-[0_0_10px_#eab308]"></div>
                                        <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">Tournament Bracket</h3>
                                    </div>

                                    <div className="bracket-tree">
                                        {/* --- 8강 Column --- */}
                                        {knockoutStages?.roundOf8.length! > 0 && (
                                            <div className="bracket-column">
                                                {knockoutStages!.roundOf8.map((match: any, idx: number) => (
                                                    <TournamentMatchBox key={match.id} title={`Match ${idx + 1}`} match={match} />
                                                ))}
                                            </div>
                                        )}

                                        {/* --- 4강 Column --- */}
                                        {knockoutStages?.roundOf4.length! > 0 && (
                                            <div className="bracket-column">
                                                {knockoutStages!.roundOf4.map((match: any, idx: number) => (
                                                    <TournamentMatchBox key={match.id} title={`Semi-Final ${idx + 1}`} match={match} />
                                                ))}
                                            </div>
                                        )}

                                        {/* --- 결승 Column --- */}
                                        {knockoutStages?.final.length! > 0 && (
                                            <div className="bracket-column">
                                                <div className="relative scale-110 mt-8">
                                                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-3xl crown-icon">👑</div>
                                                    <TournamentMatchBox title="Final" match={knockoutStages!.final[0]} highlight />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. 조별리그 순위표 (탭 UI 적용) */}
                        <div className="space-y-4">
                            <div className="flex flex-col gap-3 px-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"></div>
                                    <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">Group Standings</h3>
                                </div>
                                
                                {/* 🔥 [NEW] 정렬된 탭 버튼들 */}
                                <div className="flex w-full gap-2 overflow-x-auto no-scrollbar pb-1">
                                    {sortedGroupKeys.map((gName, idx, arr) => (
                                        <button 
                                            key={gName}
                                            onClick={() => setSelectedGroupTab(gName)}
                                            className={`
                                                flex-1 py-2.5 px-4 rounded-lg text-xs font-black italic transition-all border whitespace-nowrap text-center
                                                ${arr.length <= 2 ? 'w-1/2 min-w-[120px]' : 'min-w-[100px] flex-shrink-0'} 
                                                ${selectedGroupTab === gName ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/30' : 'bg-slate-900 text-slate-500 border-slate-700 hover:text-slate-300 hover:border-slate-600'}
                                            `}
                                        >
                                            GROUP {gName}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 🔥 선택된 탭의 그룹만 노출 */}
                            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                                <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
                                    <h4 className="text-xs font-black italic text-emerald-400 uppercase tracking-widest">Group {selectedGroupTab}</h4>
                                    <span className="text-[9px] font-bold text-slate-500 uppercase bg-slate-900 px-2 py-0.5 rounded">Top 2 Qualified</span>
                                </div>
                                <table className="w-full text-left text-xs uppercase border-collapse">
                                    <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                                        <tr>
                                            <th className="p-3 w-8">#</th>
                                            <th className="p-3">Club</th>
                                            <th className="p-1 text-center">W</th>
                                            <th className="p-1 text-center">D</th>
                                            <th className="p-1 text-center">L</th>
                                            <th className="p-1 text-center">GD</th>
                                            <th className="p-1 text-center text-emerald-400">Pts</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupStandings?.[selectedGroupTab]?.map((t: any, i: number) => {
                                            const teamInfo = getTeamExtendedInfo(t.name);
                                            const isQualified = i < 2;
                                            return (
                                                <tr key={t.id} className={`border-b border-slate-800/50 ${isQualified ? 'qualified-row' : ''}`}>
                                                    <td className={`p-3 text-center font-bold ${i===0?'text-yellow-400':i===1?'text-slate-300':'text-slate-600'}`}>{i+1}</td>
                                                    <td className="p-3 flex items-center gap-3">
                                                        <div className="relative flex-shrink-0 w-7 h-7">
                                                            <div className="w-7 h-7 rounded-full bg-white object-contain p-0.5 shadow-md flex items-center justify-center overflow-hidden">
                                                                <img src={t.logo} className="w-full h-full object-contain" alt="" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>
                                                            </div>
                                                            {renderOverlayCondition(teamInfo?.condition || '')}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className={`font-bold text-sm tracking-tight truncate ${isQualified ? 'text-white' : 'text-slate-400'}`}>{t.name}</span>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                {getRealRankBadge(teamInfo?.real_rank)}
                                                                <span className="text-[10px] text-slate-500 font-medium truncate">{t.ownerName}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-1 text-center text-slate-400 text-[10px]">{t.win}</td>
                                                    <td className="p-1 text-center text-slate-400 text-[10px]">{t.draw}</td>
                                                    <td className="p-1 text-center text-slate-400 text-[10px]">{t.loss}</td>
                                                    <td className="p-1 text-center text-slate-500 text-[10px] font-bold">{t.gd>0?`+${t.gd}`:t.gd}</td>
                                                    <td className={`p-1 text-center font-black text-sm ${isQualified ? 'text-emerald-400' : 'text-slate-500'}`}>{t.points}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 3. 통합 순위 (생략 - 위와 동일) */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 px-2">
                                <div className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"></div>
                                <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">League Total Standing</h3>
                            </div>
                            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                                <table className="w-full text-left text-xs uppercase border-collapse">
                                    <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                                        <tr>
                                            <th className="p-4 w-8">#</th>
                                            <th className="p-4">Club</th>
                                            <th className="p-2 text-center">W</th>
                                            <th className="p-2 text-center">D</th>
                                            <th className="p-2 text-center">L</th>
                                            <th className="p-2 text-center">GD</th>
                                            <th className="p-2 text-center text-emerald-400">Pts</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedTeams.map((t: any, i: number) => {
                                            const teamInfo = getTeamExtendedInfo(t.name);
                                            return (
                                                <tr key={t.id} className={`border-b border-slate-800/50 ${i<3 ? 'bg-emerald-900/10' : ''}`}>
                                                    <td className={`p-4 text-center font-bold ${i===0?'text-yellow-400':i===1?'text-slate-300':i===2?'text-orange-400':'text-slate-600'}`}>{i+1}</td>
                                                    <td className="p-4 flex items-center gap-4">
                                                        <div className="relative flex-shrink-0 w-7 h-7">
                                                            <div className="w-7 h-7 rounded-full bg-white object-contain p-0.5 shadow-md flex items-center justify-center overflow-hidden">
                                                                <img src={t.logo} className="w-full h-full object-contain" alt="" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>
                                                            </div>
                                                            {renderCondition(teamInfo?.condition || '')}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-sm tracking-tight">{t.name}</span>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                {getRealRankBadge(teamInfo?.real_rank)}
                                                                <span className="text-[10px] text-slate-500 font-medium">{t.ownerName}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-2 text-center text-slate-400">{t.win}</td>
                                                    <td className="p-2 text-center text-slate-400">{t.draw}</td>
                                                    <td className="p-2 text-center text-slate-400">{t.loss}</td>
                                                    <td className="p-2 text-center text-slate-500">{t.gd>0?`+${t.gd}`:t.gd}</td>
                                                    <td className="p-2 text-center text-emerald-400 font-bold text-sm">{t.points}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    /* 일반 모드 (기존 유지) */
                    <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                        <table className="w-full text-left text-xs uppercase border-collapse">
                            <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                                <tr>
                                    <th className="p-4 w-8">#</th>
                                    <th className="p-4">Club</th>
                                    <th className="p-2 text-center">W</th>
                                    <th className="p-2 text-center">D</th>
                                    <th className="p-2 text-center">L</th>
                                    <th className="p-2 text-center">GD</th>
                                    <th className="p-2 text-center text-emerald-400">Pts</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedTeams.map((t: any, i: number) => {
                                    const teamInfo = getTeamExtendedInfo(t.name);
                                    return (
                                        <tr key={t.id} className={`border-b border-slate-800/50 ${i<3 ? 'bg-emerald-900/10' : ''}`}>
                                            <td className={`p-4 text-center font-bold ${i===0?'text-yellow-400':i===1?'text-slate-300':i===2?'text-orange-400':'text-slate-600'}`}>{i+1}</td>
                                            <td className="p-4 flex items-center gap-4">
                                                <div className="relative flex-shrink-0 w-7 h-7">
                                                    <div className="w-7 h-7 rounded-full bg-white object-contain p-0.5 shadow-md flex items-center justify-center overflow-hidden">
                                                        <img src={t.logo} className="w-full h-full object-contain" alt="" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>
                                                    </div>
                                                    {renderCondition(teamInfo?.condition || '')}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm tracking-tight">{t.name}</span>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        {getRealRankBadge(teamInfo?.real_rank)}
                                                        <span className="text-[10px] text-slate-500 font-medium">{t.ownerName}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-2 text-center text-slate-400">{t.win}</td>
                                            <td className="p-2 text-center text-slate-400">{t.draw}</td>
                                            <td className="p-2 text-center text-slate-400">{t.loss}</td>
                                            <td className="p-2 text-center text-slate-500">{t.gd>0?`+${t.gd}`:t.gd}</td>
                                            <td className="p-2 text-center text-emerald-400 font-bold text-sm">{t.points}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}
        
        {/* OWNERS, PLAYERS, HIGHLIGHTS 탭 (기존 유지) */}
        {rankingTab === 'OWNERS' && <div className="text-center py-10 text-slate-500">Owners Content Here</div>}
        {rankingTab === 'PLAYERS' && <div className="text-center py-10 text-slate-500">Players Content Here</div>}
        {rankingTab === 'HIGHLIGHTS' && <div className="text-center py-10 text-slate-500">Highlights Content Here</div>}
    </div>
  );
};