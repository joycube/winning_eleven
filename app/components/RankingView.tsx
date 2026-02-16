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
  
  // 조별리그 탭 상태
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

  // 🔥 [공통 사용] 엠블럼 + 폼 오버레이 렌더링 함수 (디자인 통일)
  const renderLogoWithForm = (logo: string, condition: string, isTbd: boolean = false) => {
    const c = (condition || '').toUpperCase();
    const circleBase = "absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[#0f172a] border border-slate-600 flex items-center justify-center shadow-md z-10";
    
    let formIcon = null;
    if (!isTbd) {
        switch (c) {
            case 'A': formIcon = <div className={`${circleBase} border-emerald-500/50`}><span className="text-[7px] font-black leading-none text-emerald-400">↑</span></div>; break;
            case 'B': formIcon = <div className={`${circleBase} border-lime-500/50`}><span className="text-[7px] font-black leading-none text-lime-400">↗</span></div>; break;
            case 'C': formIcon = <div className={`${circleBase} border-yellow-500/50`}><span className="text-[7px] font-black leading-none text-yellow-400">→</span></div>; break;
            case 'D': formIcon = <div className={`${circleBase} border-orange-500/50`}><span className="text-[7px] font-black leading-none text-orange-400">↘</span></div>; break;
            case 'E': formIcon = <div className={`${circleBase} border-red-500/50`}><span className="text-[7px] font-black leading-none text-red-500">↓</span></div>;
            default: formIcon = null;
        }
    }

    return (
        <div className="relative w-7 h-7 flex-shrink-0">
            <div className={`w-7 h-7 rounded-full p-[1.5px] shadow-sm flex items-center justify-center overflow-hidden ${isTbd ? 'bg-slate-700' : 'bg-white'}`}>
                <img src={logo} className="w-full h-full object-contain" alt="" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>
            </div>
            {formIcon}
        </div>
    );
  };

  const renderOverlayCondition = (cond: string) => {
    // 하위 호환성 및 독립적 사용을 위해 남겨둠 (필요 시 삭제 가능)
    return null; 
  };

  const normalize = (str: string) => str ? str.toString().trim().toLowerCase() : "";

  const getTeamExtendedInfo = (teamName: string) => {
      const tbdTeam = {
          id: 0, name: teamName || 'TBD', logo: FALLBACK_IMG, ownerName: '-',
          region: '', tier: '', realRankScore: 0, realFormScore: 0, condition: '', real_rank: null
      };

      if (!teamName || teamName === 'TBD') return tbdTeam;

      const stats = activeRankingData?.teams?.find((t:any) => normalize(t.name) === normalize(teamName));
      // masterTeams 타입 에러 방지
      const master = (masterTeams as any[])?.find((m:any) => normalize(m.name) === normalize(teamName) || normalize(m.teamName) === normalize(teamName));
      
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

  const sortedGroupKeys = useMemo(() => {
      if (!groupStandings) return [];
      return Object.keys(groupStandings).sort();
  }, [groupStandings]);

  useEffect(() => {
      if (sortedGroupKeys.length > 0) {
          if (!sortedGroupKeys.includes(selectedGroupTab)) {
              setSelectedGroupTab(sortedGroupKeys[0]);
          }
      }
  }, [sortedGroupKeys, selectedGroupTab]);

  // 🔥 [핵심] 토너먼트 매치 로드 로직 (슬롯 강제 배정)
  const knockoutStages = useMemo(() => {
    if (currentSeason?.type !== 'CUP' || !currentSeason?.rounds) return null;
    
    let matches: any[] = [];
    if (Array.isArray(currentSeason.rounds)) {
        matches = currentSeason.rounds.flatMap((r: any) => r.matches || [])
            .filter((m: any) => m && (m.stage !== 'GROUP_STAGE' && m.stage !== 'Group Stage'));
    }

    // 빈 슬롯 생성
    const slots = {
        roundOf8: Array(4).fill(null),
        roundOf4: Array(2).fill(null),
        final: Array(1).fill(null)
    };

    // 슬롯 매핑
    matches.forEach((m: any) => {
        const label = m.matchLabel || '';
        const stage = m.stage || '';
        
        const matchNumMatch = label.match(/(\d+)경기/) || label.match(/Match (\d+)/);
        const matchNum = matchNumMatch ? parseInt(matchNumMatch[1]) : 0; 

        if (stage === 'ROUND_OF_8' || label.includes('8강') || label.includes('토너먼트')) {
            if (matchNum >= 1 && matchNum <= 4) slots.roundOf8[matchNum - 1] = m;
            else { const empty = slots.roundOf8.indexOf(null); if(empty!==-1) slots.roundOf8[empty]=m; }
        }
        else if (stage === 'ROUND_OF_4' || label.includes('4강') || label.toUpperCase().includes('SEMI')) {
            if (matchNum >= 1 && matchNum <= 2) slots.roundOf4[matchNum - 1] = m;
            else { const empty = slots.roundOf4.indexOf(null); if(empty!==-1) slots.roundOf4[empty]=m; }
        }
        else if (stage === 'FINAL' || label.includes('결승') || label.toUpperCase().includes('FINAL')) {
            slots.final[0] = m;
        }
    });

    const hasRoundOf8 = slots.roundOf8.some(m => m !== null);

    return { 
        roundOf8: hasRoundOf8 ? slots.roundOf8 : [], 
        roundOf4: slots.roundOf4, 
        final: slots.final 
    };
  }, [currentSeason]);

  const TournamentTeamRow = ({ team, score, isWinner }: { team: any, score: number | null, isWinner: boolean }) => (
      <div className={`flex items-center justify-between p-3 ${isWinner ? 'bg-gradient-to-r from-emerald-900/40 to-transparent' : ''} ${team.name === 'TBD' ? 'opacity-30' : ''}`}>
          <div className="flex items-center gap-3 min-w-0">
              {/* 🔥 공통 엠블럼 사용 */}
              {renderLogoWithForm(team.logo, team.condition, team.name === 'TBD')}
              
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
      const safeMatch = match || { home: 'TBD', away: 'TBD', homeScore: '', awayScore: '' };
      
      const home = getTeamExtendedInfo(safeMatch.home);
      const away = getTeamExtendedInfo(safeMatch.away);
      const homeScore = safeMatch.homeScore !== '' ? Number(safeMatch.homeScore) : null;
      const awayScore = safeMatch.awayScore !== '' ? Number(safeMatch.awayScore) : null;
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
                        {/* 1. 토너먼트 트리 */}
                        {(knockoutStages?.roundOf8?.length! > 0 || knockoutStages?.roundOf4.some(m => m !== null) || knockoutStages?.final.some(m => m !== null)) && (
                            <div className="overflow-x-auto pb-4">
                                <div className="min-w-[700px] px-4">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-1.5 h-6 bg-yellow-500 rounded-full shadow-[0_0_10px_#eab308]"></div>
                                        <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">Tournament Bracket</h3>
                                    </div>

                                    <div className="bracket-tree">
                                        {knockoutStages?.roundOf8 && knockoutStages.roundOf8.length > 0 && (
                                            <div className="bracket-column">
                                                {knockoutStages.roundOf8.map((match: any, idx: number) => (
                                                    <TournamentMatchBox key={match?.id || `tbd_8_${idx}`} title={`Match ${idx + 1}`} match={match} />
                                                ))}
                                            </div>
                                        )}
                                        <div className="bracket-column">
                                            {knockoutStages!.roundOf4.map((match: any, idx: number) => (
                                                <TournamentMatchBox key={match?.id || `tbd_4_${idx}`} title={`Semi-Final ${idx + 1}`} match={match} />
                                            ))}
                                        </div>
                                        <div className="bracket-column">
                                            <div className="relative scale-110 mt-8">
                                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-3xl crown-icon">👑</div>
                                                <TournamentMatchBox title="Final" match={knockoutStages!.final[0]} highlight />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. 조별리그 순위표 */}
                        <div className="space-y-4">
                            <div className="flex flex-col gap-3 px-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"></div>
                                    <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">Group Standings</h3>
                                </div>
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
                                                        {renderLogoWithForm(t.logo, teamInfo.condition, false)}
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

                        {/* 3. 통합 순위 (생략 - 위와 동일하게 적용) */}
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
                                                        {renderLogoWithForm(t.logo, teamInfo.condition, false)}
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
                    /* 일반 모드 */
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
                                                {renderLogoWithForm(t.logo, teamInfo.condition, false)}
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
        
        {/* OWNERS TAB: 복구됨 */}
        {rankingTab === 'OWNERS' && (
            <div className="space-y-4">
                {activeRankingData.owners.length > 0 && (() => {
                    const firstOwner = activeRankingData.owners[0];
                    const matchedOwner = (owners && owners.length > 0) ? owners.find(owner => owner.nickname === firstOwner.name) : null;
                    const displayPhoto = matchedOwner?.photo || FALLBACK_IMG;
                    const displayPrize = getOwnerPrize(firstOwner.name);
                    return (
                        <div className="relative w-full rounded-2xl overflow-hidden border border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.15)] mb-6 transform hover:scale-[1.02] transition-transform duration-300">
                            <div className="absolute inset-0 rank-1-shimmer z-0"></div>
                            <div className="relative z-10 flex flex-col md:flex-row items-center p-5 gap-4 bg-slate-900/40 backdrop-blur-sm">
                                <div className="relative pt-3"> 
                                    <div className="absolute -top-6 -left-4 text-5xl filter drop-shadow-lg z-20 crown-bounce origin-bottom-left" style={{ transform: 'rotate(-10deg)' }}>👑</div>
                                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-full p-[3px] bg-gradient-to-tr from-yellow-300 via-yellow-500 to-yellow-200 shadow-2xl relative z-10">
                                        <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-900">
                                            <img src={displayPhoto} alt={firstOwner.name} className="w-full h-full object-cover"/>
                                        </div>
                                    </div>
                                    <div className="absolute -bottom-3 inset-x-0 flex justify-center z-30">
                                        <span className="bg-gradient-to-r from-yellow-600 to-yellow-500 text-white text-xs font-black px-4 py-1 rounded-full border-2 border-slate-900 shadow-lg tracking-wider">1st WINNER</span>
                                    </div>
                                </div>
                                <div className="flex-1 text-center md:text-left pt-3 md:pt-0">
                                    <h3 className="text-xs md:text-sm text-yellow-500 font-bold tracking-[0.2em] mb-0.5 uppercase">The Champion</h3>
                                    <h2 className="text-3xl md:text-4xl font-black text-white mb-3 drop-shadow-md tracking-tight">{firstOwner.name}</h2>
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                        <div className="bg-slate-900/80 rounded-xl px-4 py-2.5 border border-slate-700 min-w-[80px]">
                                            <span className="text-[10px] text-slate-400 block font-bold mb-0.5">POINTS</span>
                                            <span className="text-xl font-black text-emerald-400">{firstOwner.points}</span>
                                        </div>
                                        <div className="bg-slate-900/80 rounded-xl px-4 py-2.5 border border-slate-700 min-w-[100px]">
                                            <span className="text-[10px] text-slate-400 block font-bold mb-0.5">RECORD</span>
                                            <span className="text-lg font-bold text-white tracking-tight">{firstOwner.win}<span className="text-sm">W</span> <span className="text-slate-500">{firstOwner.draw}<span className="text-xs">D</span></span> <span className="text-red-400">{firstOwner.loss}<span className="text-xs">L</span></span></span>
                                        </div>
                                        <div className="bg-gradient-to-r from-yellow-600/30 to-yellow-900/30 rounded-xl px-5 py-2.5 border border-yellow-500/40">
                                            <span className="text-[10px] text-yellow-500 block font-black mb-0.5">PRIZE MONEY</span>
                                            <span className="text-xl font-black text-yellow-400">₩ {displayPrize.toLocaleString()}</span>
                                        </div>
                                    </div>
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
                            {activeRankingData.owners.slice(1).map((o: any, i: number) => { 
                                const actualRank = i + 2; 
                                const matchedOwner = (owners && owners.length > 0) ? owners.find(owner => owner.nickname === o.name) : null;
                                return (
                                    <tr key={i} className={`border-b border-slate-800/50 ${actualRank <= 3 ? 'bg-slate-800/30' : ''}`}>
                                        <td className={`p-4 text-center font-bold ${actualRank===2?'text-slate-300':actualRank===3?'text-orange-400':'text-slate-600'}`}>{actualRank}</td>
                                        <td className="p-4"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full bg-slate-800 border overflow-hidden flex-shrink-0 shadow-lg ${actualRank===2 ? 'border-slate-400' : actualRank===3 ? 'border-orange-500' : 'border-slate-700'}`}><img src={matchedOwner?.photo || FALLBACK_IMG} alt={o.name} className="w-full h-full object-cover" onError={(e:any) => e.target.src = FALLBACK_IMG} /></div><span className="font-bold text-sm whitespace-nowrap">{o.name}</span></div></td>
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

        {/* PLAYERS TAB: 복구됨 */}
        {rankingTab === 'PLAYERS' && (
             <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
                <div className="flex bg-slate-950 border-b border-slate-800">
                    <button onClick={()=>setRankPlayerMode('GOAL')} className={`flex-1 py-3 text-xs font-bold ${rankPlayerMode==='GOAL'?'text-yellow-400 bg-slate-900':'text-slate-500'}`}>⚽ TOP SCORERS</button>
                    <button onClick={()=>setRankPlayerMode('ASSIST')} className={`flex-1 py-3 text-xs font-bold ${rankPlayerMode==='ASSIST'?'text-blue-400 bg-slate-900':'text-slate-500'}`}>🅰️ TOP ASSISTS</button>
                </div>
                <table className="w-full text-left text-xs uppercase">
                    <thead className="bg-slate-900 text-slate-500"><tr><th className="p-3 w-8">#</th><th className="p-3">Player</th><th className="p-3">Team</th><th className="p-3 text-right">{rankPlayerMode}</th></tr></thead>
                    <tbody>
                        {rankedPlayers.slice(0, 20).map((p:any, i:number) => (
                            <tr key={i} className="border-b border-slate-800/50">
                                <td className={`p-3 text-center ${p.rank<=3?'text-emerald-400 font-bold':'text-slate-600'}`}>{p.rank}</td>
                                <td className="p-3 font-bold text-white">{p.name} <span className="text-[9px] text-slate-500 font-normal ml-1">({p.owner})</span></td>
                                <td className="p-3 text-slate-400 flex items-center gap-2"><img src={p.teamLogo} className="w-5 h-5 object-contain rounded-full bg-white p-0.5" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /><span>{p.team}</span></td>
                                <td className={`p-3 text-right font-bold ${rankPlayerMode==='GOAL'?'text-yellow-400':'text-blue-400'}`}>{rankPlayerMode==='GOAL'?p.goals:p.assists}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {/* HIGHLIGHTS TAB: 복구됨 */}
        {rankingTab === 'HIGHLIGHTS' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {activeRankingData.highlights.map((m:any, idx:number) => {
                    const isDraw = m.homeScore === m.awayScore;
                    return (
                        <div key={idx} className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 group hover:border-emerald-500 transition-all cursor-pointer" onClick={() => window.open(m.youtubeUrl, '_blank')}>
                            <div className="relative aspect-video">
                                <img src={getYouTubeThumbnail(m.youtubeUrl)} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                                <div className="absolute inset-0 flex items-center justify-center"><div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-110 transition-transform">▶</div></div>
                            </div>
                            <div className="p-3 flex items-center gap-3">
                                {isDraw ? (
                                    <div className="relative w-8 h-8 flex-shrink-0">
                                        <img src={m.homeLogo} className="w-6 h-6 absolute top-0 left-0 rounded-full bg-white object-contain p-0.5 z-10 shadow-sm border border-slate-300" alt="" />
                                        <img src={m.awayLogo} className="w-6 h-6 absolute bottom-0 right-0 rounded-full bg-white object-contain p-0.5 opacity-80" alt="" />
                                    </div>
                                ) : (
                                    <img src={m.winnerLogo} className="w-8 h-8 rounded-full bg-white object-contain p-0.5" alt="" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">{m.stage} • {m.matchLabel}</p>
                                    <p className="text-xs font-bold text-white truncate">{m.home} <span className="text-emerald-400">{m.homeScore}:{m.awayScore}</span> {m.away}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {activeRankingData.highlights.length === 0 && <div className="col-span-3 text-center py-10 text-slate-500">등록된 하이라이트가 없습니다.</div>}
            </div>
        )}
    </div>
  );
};