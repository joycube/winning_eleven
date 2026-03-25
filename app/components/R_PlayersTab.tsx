"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useMemo } from 'react';
import { FALLBACK_IMG, Owner } from '../types';
import { ChevronRight } from 'lucide-react'; 

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

interface RPlayersTabProps {
  currentSeason: any; 
  activeRankingData: any; // 프롭스 구조 유지를 위해 남겨두지만, 실제 계산에서는 무시합니다.
  isHybridSeason: boolean;
  owners: Owner[];
}

export default function R_PlayersTab({ currentSeason, activeRankingData, isHybridSeason, owners }: RPlayersTabProps) {
  const [rankPlayerMode, setRankPlayerMode] = useState<'GOAL' | 'ASSIST'>('GOAL');
  const [rankPlayerStageMode, setRankPlayerStageMode] = useState<'REGULAR' | 'PLAYOFF'>('REGULAR');
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

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

  // 🔥 핵심: 메인 랭킹 숫자와 아코디언 분포도를 currentSeason.rounds에서 '동시에 자체 계산'합니다.
  const { rankedPlayers, distributionMap } = useMemo(() => {
      const distMap: any = {};
      const playerStats: any = {}; 

      // 🔥 [버그 픽스] 'ROUND' 키워드를 제거하고 'ROUND_OF' 및 상세 키워드로 변경하여 정규리그 오인 방지!
      const playoffKeywords = ['ROUND_OF', 'QUARTER', 'SEMI', 'FINAL', '결승', '4강', '8강', '16강', 'PO', '플레이오프', '토너먼트', '34', 'KNOCKOUT'];

      if (currentSeason?.rounds) {
          currentSeason.rounds.forEach((r: any) => {
              // 라운드 이름으로 PO 여부 1차 판별
              const isPlayoffRound = playoffKeywords.some(kw => (r.name || '').toUpperCase().includes(kw));

              r.matches?.forEach((m: any) => {
                  if (m.status !== 'COMPLETED') return;

                  // 매치 라벨이나 스테이지 이름으로 PO 여부 2차 판별
                  const matchStr = `${m.stage || ''} ${m.matchLabel || ''}`.toUpperCase();
                  const isPlayoffMatch = isPlayoffRound || playoffKeywords.some(kw => matchStr.includes(kw));

                  // [필터링 로직] 사용자가 선택한 모드(정규/PO)에 맞지 않는 경기는 무시하여 스탯 분리
                  if (isHybridSeason) {
                      if (rankPlayerStageMode === 'REGULAR' && isPlayoffMatch) return; 
                      if (rankPlayerStageMode === 'PLAYOFF' && !isPlayoffMatch) return; 
                  }

                  const processStats = (scorersOrAssists: any[], isHome: boolean, isGoal: boolean) => {
                      const myTeam = isHome ? m.home : m.away;
                      const myTeamLogo = isHome ? m.homeLogo : m.awayLogo;
                      const myOwner = isHome ? m.homeOwner : m.awayOwner;
                      const myOwnerUid = isHome ? m.homeOwnerUid : m.awayOwnerUid;

                      const opTeam = isHome ? m.away : m.home;
                      const opLogo = isHome ? (m.awayLogo || SAFE_TBD_LOGO) : (m.homeLogo || SAFE_TBD_LOGO);
                      const opOwner = isHome ? m.awayOwner : m.homeOwner;
                      const opOwnerUid = isHome ? m.awayOwnerUid : m.homeOwnerUid;

                      scorersOrAssists.forEach((s: any) => {
                          const pName = s.name;
                          const count = s.count || 1;

                          // 1. 개인 전체 스탯(총 골/도움) 누적 -> 이 숫자가 메인 랭킹표에 찍힘
                          if (!playerStats[pName]) {
                              playerStats[pName] = {
                                  name: pName,
                                  team: myTeam,
                                  teamLogo: myTeamLogo,
                                  owner: resolveOwnerNickname(myOwner, myOwnerUid),
                                  goals: 0,
                                  assists: 0
                              };
                          }
                          if (isGoal) playerStats[pName].goals += count;
                          else playerStats[pName].assists += count;

                          // 2. 상대팀별 상세 분포도 누적 -> 이 숫자가 아코디언에 찍힘
                          if ((rankPlayerMode === 'GOAL' && isGoal) || (rankPlayerMode === 'ASSIST' && !isGoal)) {
                              if (!distMap[pName]) distMap[pName] = {};
                              if (!distMap[pName][opTeam]) {
                                  distMap[pName][opTeam] = { count: 0, logo: opLogo, owner: resolveOwnerNickname(opOwner, opOwnerUid) };
                              }
                              distMap[pName][opTeam].count += count;
                          }
                      });
                  };

                  processStats(m.homeScorers || [], true, true);   
                  processStats(m.awayScorers || [], false, true);  
                  processStats(m.homeAssists || [], true, false);  
                  processStats(m.awayAssists || [], false, false); 
              });
          });
      }

      // 3. 누적된 스탯을 바탕으로 정렬 (다득점->다도움 순)
      const sortedPlayers = Object.values(playerStats)
          .filter((p: any) => rankPlayerMode === 'GOAL' ? p.goals > 0 : p.assists > 0)
          .sort((a: any, b: any) => {
              if (rankPlayerMode === 'GOAL') return b.goals - a.goals || b.assists - a.assists; 
              return b.assists - a.assists || b.goals - a.goals; 
          });

      // 4. 동률 순위(Rank) 계산
      const ranked: any[] = [];
      sortedPlayers.forEach((player: any, index: number) => {
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

      return { rankedPlayers: ranked, distributionMap: distMap };

  }, [currentSeason, rankPlayerMode, rankPlayerStageMode, isHybridSeason, owners]);

  return (
    <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col animate-in fade-in">
      
      {isHybridSeason && (
        <div className="flex bg-[#0b0e14] p-2 sm:p-3 border-b border-slate-800 gap-2">
            <button 
                onClick={() => { setRankPlayerStageMode('REGULAR'); setExpandedPlayer(null); }} 
                className={`flex-1 py-2.5 rounded-lg text-xs font-black italic transition-all ${rankPlayerStageMode === 'REGULAR' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-900 text-slate-500 hover:text-slate-300 border border-slate-800'}`}
            >
                🚩 REGULAR (정규/조별)
            </button>
            <button 
                onClick={() => { setRankPlayerStageMode('PLAYOFF'); setExpandedPlayer(null); }} 
                className={`flex-1 py-2.5 rounded-lg text-xs font-black italic transition-all ${rankPlayerStageMode === 'PLAYOFF' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900 text-slate-500 hover:text-slate-300 border border-slate-800'}`}
            >
                🏆 PLAYOFF (토너먼트)
            </button>
        </div>
      )}

      <div className="flex bg-slate-950 border-b border-slate-800">
          <button 
              onClick={() => { setRankPlayerMode('GOAL'); setExpandedPlayer(null); }} 
              className={`flex-1 py-3.5 text-[11px] sm:text-xs font-black tracking-widest ${rankPlayerMode === 'GOAL' ? 'text-yellow-400 bg-slate-900 border-b-2 border-yellow-400' : 'text-slate-600 hover:text-slate-400'} uppercase transition-colors`}
          >
              ⚽ TOP SCORERS
          </button>
          <button 
              onClick={() => { setRankPlayerMode('ASSIST'); setExpandedPlayer(null); }} 
              className={`flex-1 py-3.5 text-[11px] sm:text-xs font-black tracking-widest ${rankPlayerMode === 'ASSIST' ? 'text-blue-400 bg-slate-900 border-b-2 border-blue-400' : 'text-slate-600 hover:text-slate-400'} uppercase transition-colors`}
          >
              🅰️ TOP ASSISTS
          </button>
      </div>

      <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap table-fixed">
              <thead className="bg-slate-950 text-slate-500 uppercase tracking-wider">
                  <tr>
                      <th className="py-3 pl-4 pr-1 w-10 text-center">R.</th>
                      <th className="py-3 pl-1 pr-3 w-[50%]">Player</th>
                      <th className="p-3 w-[35%]">Club</th>
                      <th className="p-3 text-right pr-6 w-20">{rankPlayerMode === 'GOAL' ? 'GOAL' : 'ASSIST'}</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {rankedPlayers.length === 0 ? (
                    <tr><td colSpan={4} className="p-12 text-center text-slate-500 font-bold italic">기록이 없습니다.</td></tr>
                ) : rankedPlayers.slice(0, 20).map((p: any, i: number) => {
                    if(!p) return null;
                    const isTop3 = p.rank <= 3;
                    const isExpanded = expandedPlayer === p.name;
                    const playerDist = distributionMap[p.name] || {};
                    const opponents = Object.keys(playerDist).sort((a, b) => playerDist[b].count - playerDist[a].count);

                    return (
                        <React.Fragment key={i}>
                            <tr 
                                className={`hover:bg-slate-800/30 transition-colors cursor-pointer ${isTop3 ? 'bg-slate-900/30' : ''} ${isExpanded ? 'bg-slate-800/40' : ''}`}
                                onClick={() => setExpandedPlayer(isExpanded ? null : p.name)}
                            >
                                <td className={`py-3 pl-4 pr-1 text-center font-black text-xs ${p.rank === 1 ? 'text-yellow-400' : p.rank === 2 ? 'text-slate-300' : p.rank === 3 ? 'text-orange-400' : 'text-slate-600'}`}>
                                    {p.rank}
                                </td>
                                <td className="py-3 pl-1 pr-3 overflow-hidden">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                                            <span className="font-bold text-white uppercase text-sm shrink-0">{p.name}</span>
                                            <span className="text-[11px] text-slate-500 font-bold tracking-tight italic truncate pr-1">({p.owner})</span>
                                        </div>
                                        <div className={`flex items-center justify-center w-[16px] h-[16px] rounded-full shrink-0 shadow-sm transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''} ${rankPlayerMode === 'GOAL' ? 'bg-yellow-400 text-slate-900' : 'bg-blue-500 text-white'}`}>
                                            <ChevronRight size={12} strokeWidth={4} />
                                        </div>
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

                            {isExpanded && (
                                <tr>
                                    <td colSpan={4} className="p-0 border-b border-slate-800 bg-[#0b0e14]">
                                        <div className={`py-3 px-4 shadow-inner border-l-2 animate-in slide-in-from-top-2 duration-200 ${rankPlayerMode === 'GOAL' ? 'border-yellow-500' : 'border-blue-500'}`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${rankPlayerMode === 'GOAL' ? 'text-yellow-500' : 'text-blue-500'}`}>
                                                    {rankPlayerMode === 'GOAL' ? 'Goal Distribution' : 'Assist Distribution'}
                                                </span>
                                                <div className="h-px flex-1 bg-slate-800"></div>
                                            </div>
                                            
                                            {opponents.length === 0 ? (
                                                <div className="text-slate-600 text-[10px] italic py-2">상세 기록을 찾을 수 없습니다.</div>
                                            ) : (
                                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                                                    {opponents.map((opName) => {
                                                        const data = playerDist[opName];
                                                        return (
                                                            <div key={opName} className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-lg p-2 min-w-[130px] shrink-0 hover:border-slate-700 transition-colors">
                                                                <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center p-1 shrink-0 shadow-sm">
                                                                    <img src={data.logo} className="w-full h-full object-contain" alt="" onError={(e:any) => { e.target.src = SAFE_TBD_LOGO; }} />
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <div className="flex items-baseline gap-1">
                                                                        <span className="text-[11px] font-black text-white uppercase truncate">{opName}</span>
                                                                        <span className={`text-[12px] font-black ${rankPlayerMode === 'GOAL' ? 'text-yellow-400' : 'text-blue-400'}`}>{data.count}</span>
                                                                    </div>
                                                                    <span className="text-[9px] text-slate-500 font-bold italic truncate">({data.owner})</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    )
                })}
              </tbody>
          </table>
      </div>
    </div>
  );
}