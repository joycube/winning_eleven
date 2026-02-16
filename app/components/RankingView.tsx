/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query } from 'firebase/firestore'; 
import { db } from '../firebase'; 
import { FALLBACK_IMG, Owner, MasterTeam } from '../types'; 
import { getYouTubeThumbnail } from '../utils/helpers'; 

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
  const [selectedGroupTab, setSelectedGroupTab] = useState<string>('A');
  const [masterTeams, setMasterTeams] = useState<any[]>([]);

  useEffect(() => {
    const fetchMasterTeams = async () => {
      try {
        const q = query(collection(db, 'master_teams'));
        const querySnapshot = await getDocs(q);
        const teams = querySnapshot.docs.map(doc => ({
            id: doc.id, 
            ...doc.data(),
            teamName: doc.data().team || doc.data().name || doc.id 
        }));
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

  const getOwnerPrize = (ownerName: string) => {
    let totalPrize = 0;
    if (ownerName === sortedTeams[0]?.ownerName) totalPrize += (prizeRule.first || 0);
    if (ownerName === sortedTeams[1]?.ownerName) totalPrize += (prizeRule.second || 0);
    if (ownerName === sortedTeams[2]?.ownerName) totalPrize += (prizeRule.third || 0);
    return totalPrize;
  };

  // 🔥 [리얼순위] 메탈릭 배지 스타일 정의
  const getRealRankBadge = (rank: number | undefined | null) => {
    if (!rank) return <div className="bg-slate-800 text-slate-500 text-[9px] font-bold px-1.5 py-[1px] rounded-[3px] border border-slate-700/50 leading-none">R.-</div>;
    let bgClass = "bg-slate-800 text-slate-400 border-slate-700"; 
    if (rank === 1) bgClass = "bg-yellow-500 text-black border-yellow-600 shadow-[0_0_8px_rgba(234,179,8,0.3)]";
    else if (rank === 2) bgClass = "bg-slate-300 text-black border-slate-400";
    else if (rank === 3) bgClass = "bg-orange-400 text-black border-orange-500";
    return (
        <div className={`${bgClass} border text-[9px] font-black px-1.5 py-[1px] rounded-[3px] italic shadow-sm shrink-0 leading-none`}>
            R.{rank}
        </div>
    );
  };

  // 🔥 [팀 등급] 엠블럼 우측 하단 오버레이 정의
  const getTierBadge = (tier?: string) => {
    const t = (tier || 'C').toUpperCase();
    let colors = 'bg-slate-800 text-slate-400 border-slate-700';
    if (t === 'S') colors = 'bg-yellow-500 text-black border-yellow-200';
    else if (t === 'A') colors = 'bg-slate-300 text-black border-white';
    else if (t === 'B') colors = 'bg-amber-600 text-white border-amber-400';
    return (
      <div className={`absolute -bottom-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full border-2 border-[#0f172a] font-black text-[8px] z-20 shadow-md ${colors}`}>
        {t}
      </div>
    );
  };

  // 🔥 [폼 화살표] 한 줄 배지 스타일 정의
  const getConditionBadge = (condition?: string) => {
    if (!condition) return null;
    const config: any = {
      'A': { icon: '↑', color: 'text-emerald-400', glow: 'shadow-[0_0_5px_rgba(52,211,153,0.4)]' },
      'B': { icon: '↗', color: 'text-teal-400', glow: '' },
      'C': { icon: '→', color: 'text-slate-400', glow: '' },
      'D': { icon: '↘', color: 'text-orange-400', glow: '' },
      'E': { icon: '⬇', color: 'text-red-500', glow: 'shadow-[0_0_5px_rgba(239,68,68,0.4)]' },
    };
    const c = config[condition.toUpperCase()] || config['C'];
    return (
      <div className={`px-1 py-[0.5px] rounded bg-slate-900 border border-slate-800 flex items-center h-3.5 ${c.glow}`}>
        <span className={`text-[10px] font-black ${c.color}`}>{c.icon}</span>
      </div>
    );
  };

  const normalize = (str: string) => str ? str.toString().trim().toLowerCase() : "";

  const getTeamExtendedInfo = (teamName: string) => {
      const stats = activeRankingData?.teams?.find((t:any) => normalize(t.name) === normalize(teamName));
      const master = (masterTeams as any[])?.find((m:any) => normalize(m.name) === normalize(teamName) || normalize(m.teamName) === normalize(teamName));
      return {
          ...stats,
          tier: master?.tier || 'C',
          condition: master?.condition || 'C',
          real_rank: master?.real_rank || null,
          ownerName: stats?.ownerName || master?.ownerName || 'CPU'
      };
  };

  // ─────────────────────────────────────────────────────────────
  // 🔥 [디벨롭] Broadcast 스타일 팀 정보 셀
  // ─────────────────────────────────────────────────────────────
  const renderBroadcastTeamCell = (team: any) => {
      const info = getTeamExtendedInfo(team.name);
      return (
          <div className="flex items-center gap-4">
              {/* 1. 엠블럼 + 등급 오버레이 */}
              <div className="relative w-10 h-10 flex-shrink-0">
                  <div className="w-10 h-10 rounded-full p-[2px] bg-white shadow-md flex items-center justify-center overflow-hidden">
                      <img src={team.logo} className="w-full h-full object-contain" alt="" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>
                  </div>
                  {getTierBadge(info.tier)}
              </div>

              {/* 2. 팀 정보 텍스트 영역 */}
              <div className="flex flex-col min-w-0">
                  <span className="font-black text-[14px] tracking-tight text-white uppercase truncate leading-tight">
                      {team.name}
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                      {getRealRankBadge(info.real_rank)}
                      {getConditionBadge(info.condition)}
                      <span className="text-[10px] text-slate-500 font-bold italic truncate ml-0.5">
                          {info.ownerName}
                      </span>
                  </div>
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
      if (sortedGroupKeys.length > 0 && !sortedGroupKeys.includes(selectedGroupTab)) {
          setSelectedGroupTab(sortedGroupKeys[0]);
      }
  }, [sortedGroupKeys, selectedGroupTab]);

  const knockoutStages = useMemo(() => {
    if (currentSeason?.type !== 'CUP' || !currentSeason?.rounds) return null;
    let matches = Array.isArray(currentSeason.rounds) 
        ? currentSeason.rounds.flatMap((r: any) => r.matches || []).filter((m: any) => m && m.stage !== 'GROUP_STAGE')
        : [];
    const slots = { roundOf8: Array(4).fill(null), roundOf4: Array(2).fill(null), final: Array(1).fill(null) };
    matches.forEach((m: any) => {
        const label = m.matchLabel || '';
        const stage = m.stage || '';
        const matchNumMatch = label.match(/(\d+)경기/);
        const matchNum = matchNumMatch ? parseInt(matchNumMatch[1]) : 0; 
        if (stage === 'ROUND_OF_8' || label.includes('8강')) {
            if (matchNum >= 1 && matchNum <= 4) slots.roundOf8[matchNum - 1] = m;
        } else if (stage === 'ROUND_OF_4' || label.includes('4강')) {
            if (matchNum >= 1 && matchNum <= 2) slots.roundOf4[matchNum - 1] = m;
        } else if (stage === 'FINAL' || label.includes('결승')) {
            slots.final[0] = m;
        }
    });
    return slots;
  }, [currentSeason]);

  const getPlayerRanking = (players: any[]) => {
    const sortedPlayers = players
        .filter((p:any) => rankPlayerMode === 'GOAL' ? p.goals > 0 : p.assists > 0)
        .sort((a:any,b:any) => rankPlayerMode === 'GOAL' ? b.goals - a.goals : b.assists - a.assists);
    let currentRank = 1;
    let skip = 0; 
    return sortedPlayers.map((player, index, array) => {
        if (index > 0) {
            const prevScore = rankPlayerMode === 'GOAL' ? array[index - 1].goals : array[index - 1].assists;
            const currScore = rankPlayerMode === 'GOAL' ? player.goals : player.assists;
            if (prevScore === currScore) skip++;
            else { currentRank += 1 + skip; skip = 0; }
        }
        return { ...player, rank: currentRank };
    });
  };

  const rankedPlayers = getPlayerRanking(activeRankingData.players || []);

  return (
    <div className="space-y-6 animate-in fade-in">
        <style jsx>{`
            .crown-icon { animation: bounce 2s infinite; }
            @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
            .no-scrollbar::-webkit-scrollbar { display: none; }
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
                    <div className="space-y-12">
                        {/* 1. 조별리그 순위표 */}
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
                                        <tr><th className="p-4 w-8">#</th><th className="p-4">Club</th><th className="p-2 text-center">W</th><th className="p-2 text-center text-emerald-400">Pts</th></tr>
                                    </thead>
                                    <tbody>
                                        {groupStandings?.[selectedGroupTab]?.map((t: any, i: number) => (
                                            <tr key={t.id} className="border-b border-slate-800/50">
                                                <td className={`p-4 text-center font-bold ${i===0?'text-yellow-400':i===1?'text-slate-300':'text-slate-600'}`}>{i+1}</td>
                                                <td className="p-4">{renderBroadcastTeamCell(t)}</td>
                                                <td className="p-2 text-center text-slate-400">{t.win}</td>
                                                <td className="p-2 text-center font-black text-emerald-400 text-sm">{t.points}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 2. 전체 통합 순위표 */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 px-2">
                                <div className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"></div>
                                <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">League Total Standing</h3>
                            </div>
                            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                                <table className="w-full text-left text-xs uppercase border-collapse">
                                    <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                                        <tr><th className="p-4 w-8">#</th><th className="p-4">Club</th><th className="p-2 text-center">GD</th><th className="p-2 text-center text-emerald-400">Pts</th></tr>
                                    </thead>
                                    <tbody>
                                        {sortedTeams.map((t: any, i: number) => (
                                            <tr key={t.id} className="border-b border-slate-800/50">
                                                <td className={`p-4 text-center font-bold ${i===0?'text-yellow-400':i===1?'text-slate-300':i===2?'text-orange-400':'text-slate-600'}`}>{i+1}</td>
                                                <td className="p-4">{renderBroadcastTeamCell(t)}</td>
                                                <td className="p-2 text-center text-slate-500 font-bold">{t.gd>0?`+${t.gd}`:t.gd}</td>
                                                <td className="p-2 text-center font-black text-emerald-400 text-sm">{t.points}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* 3. 일반 리그 모드 순위표 */
                    <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                        <table className="w-full text-left text-xs uppercase border-collapse">
                            <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                                <tr><th className="p-4 w-8">#</th><th className="p-4">Club</th><th className="p-2 text-center">GD</th><th className="p-2 text-center text-emerald-400">Pts</th></tr>
                            </thead>
                            <tbody>
                                {sortedTeams.map((t: any, i: number) => (
                                    <tr key={t.id} className="border-b border-slate-800/50">
                                        <td className={`p-4 text-center font-bold ${i===0?'text-yellow-400':i===1?'text-slate-300':i===2?'text-orange-400':'text-slate-600'}`}>{i+1}</td>
                                        <td className="p-4">{renderBroadcastTeamCell(t)}</td>
                                        <td className="p-2 text-center text-slate-500 font-bold">{t.gd>0?`+${t.gd}`:t.gd}</td>
                                        <td className="p-2 text-center font-black text-emerald-400 text-sm">{t.points}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}
        
        {/* ... (나머지 OWNERS, PLAYERS, HIGHLIGHTS 탭 기존 로직 유지) ... */}
        {rankingTab === 'OWNERS' && (
            <div className="space-y-4">
                {activeRankingData.owners.length > 0 && (() => {
                    const firstOwner = activeRankingData.owners[0];
                    const matchedOwner = (owners && owners.length > 0) ? owners.find(owner => owner.nickname === firstOwner.name) : null;
                    const displayPhoto = matchedOwner?.photo || FALLBACK_IMG;
                    const displayPrize = getOwnerPrize(firstOwner.name);
                    return (
                        <div className="relative w-full rounded-2xl overflow-hidden border border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.15)] mb-6 transform hover:scale-[1.02] transition-transform duration-300">
                            <div className="absolute inset-0 z-0 bg-gradient-to-tr from-yellow-500/10 via-transparent to-transparent"></div>
                            <div className="relative z-10 flex flex-col md:flex-row items-center p-5 gap-4 bg-slate-900/40 backdrop-blur-sm">
                                <div className="relative pt-3"> 
                                    <div className="absolute -top-6 -left-4 text-5xl filter drop-shadow-lg z-20 crown-icon origin-bottom-left" style={{ transform: 'rotate(-10deg)' }}>👑</div>
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
                            <tr><th className="p-4 w-8">#</th><th className="p-4">Owner</th><th className="p-4 text-center text-emerald-400">Pts</th><th className="p-4 text-right">Prize</th></tr>
                        </thead>
                        <tbody>
                            {activeRankingData.owners.slice(1).map((o: any, i: number) => { 
                                const actualRank = i + 2; 
                                const matchedOwner = (owners && owners.length > 0) ? owners.find(owner => owner.nickname === o.name) : null;
                                return (
                                    <tr key={i} className={`border-b border-slate-800/50 ${actualRank <= 3 ? 'bg-slate-800/30' : ''}`}>
                                        <td className={`p-4 text-center font-bold ${actualRank===2?'text-slate-300':actualRank===3?'text-orange-400':'text-slate-600'}`}>{actualRank}</td>
                                        <td className="p-4"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full bg-slate-800 border overflow-hidden flex-shrink-0 shadow-lg ${actualRank===2 ? 'border-slate-400' : actualRank===3 ? 'border-orange-500' : 'border-slate-700'}`}><img src={matchedOwner?.photo || FALLBACK_IMG} alt={o.name} className="w-full h-full object-cover" onError={(e:any) => e.target.src = FALLBACK_IMG} /></div><span className="font-bold text-sm whitespace-nowrap">{o.name}</span></div></td>
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

        {rankingTab === 'HIGHLIGHTS' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {activeRankingData.highlights.map((m:any, idx:number) => (
                    <div key={idx} className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 group hover:border-emerald-500 transition-all cursor-pointer" onClick={() => window.open(m.youtubeUrl, '_blank')}>
                        <div className="relative aspect-video">
                            <img src={getYouTubeThumbnail(m.youtubeUrl)} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                            <div className="absolute inset-0 flex items-center justify-center"><div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-110 transition-transform">▶</div></div>
                        </div>
                        <div className="p-3 flex items-center gap-3">
                            <img src={m.winnerLogo || FALLBACK_IMG} className="w-8 h-8 rounded-full bg-white object-contain p-0.5" alt="" />
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-slate-500 font-bold uppercase">{m.stage} • {m.matchLabel}</p>
                                <p className="text-xs font-bold text-white truncate">{m.home} <span className="text-emerald-400">{m.homeScore}:{m.awayScore}</span> {m.away}</p>
                            </div>
                        </div>
                    </div>
                ))}
                {activeRankingData.highlights.length === 0 && <div className="col-span-3 text-center py-10 text-slate-500">등록된 하이라이트가 없습니다.</div>}
            </div>
        )}
    </div>
  );
};