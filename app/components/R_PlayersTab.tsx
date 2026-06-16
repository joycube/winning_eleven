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

// 🛠️ [v3.1] TOTAL = 현재 시즌의 전 단계 (정규 + 토너먼트/PO 합산)
//   REGULAR = 정규/조별만 / PLAYOFF = 토너먼트/PO 만
type StageMode = 'TOTAL' | 'REGULAR' | 'PLAYOFF';

// 🛠️ [v3.2] Load More — 기본 10명, 더보기마다 +10명
const PLAYER_PAGE_SIZE = 10;

export default function R_PlayersTab({ currentSeason, activeRankingData, isHybridSeason, owners }: RPlayersTabProps) {
  const [rankPlayerMode, setRankPlayerMode] = useState<'GOAL' | 'ASSIST'>('GOAL');
  // 🛠️ [v3] TOTAL 탭이 기본. TOTAL/REGULAR/PLAYOFF 세 모드 지원
  const [rankPlayerStageMode, setRankPlayerStageMode] = useState<StageMode>('TOTAL');
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  // 🛠️ [v3.2] 현재 노출 인원 수
  const [visibleCount, setVisibleCount] = useState<number>(PLAYER_PAGE_SIZE);

  // 모드 (TOTAL/REGULAR/PLAYOFF, GOAL/ASSIST) 변경 시 카운트 리셋 — 새 리스트는 10명부터 다시
  React.useEffect(() => {
      setVisibleCount(PLAYER_PAGE_SIZE);
      setExpandedPlayer(null);
  }, [rankPlayerStageMode, rankPlayerMode]);

  const resolveOwnerNickname = (ownerName: any, ownerUid?: string) => {
    try {
        if (!ownerName) return '-';
        const strName = String(ownerName).trim();
        if (['-', 'CPU', 'SYSTEM', 'TBD', 'BYE', 'GUEST'].includes(strName.toUpperCase())) return strName;
        
        const foundByUid = owners.find(o => (ownerUid && (o.uid === ownerUid || o.docId === ownerUid)) || (o.uid === strName || o.docId === strName));
        if (foundByUid) return foundByUid.nickname;
        
        const foundByName = owners.find(o => o.nickname === strName || o.legacyName === strName || (((o as any).legacyNames || []) as any[]).includes(strName));
        return foundByName ? foundByName.nickname : strName;
    } catch (e) {
        return String(ownerName || '-');
    }
  };

  // 🔥 핵심: 메인 랭킹 숫자와 아코디언 분포도를 currentSeason 에서 모드별로 자체 계산
  //   TOTAL    → 현재 시즌의 모든 경기 (정규 + PO/토너 합산)
  //   REGULAR  → 정규/조별 경기만
  //   PLAYOFF  → PO/토너 경기만
  const { rankedPlayers, distributionMap } = useMemo(() => {
      const distMap: any = {};
      const playerStats: any = {};

      const playoffKeywords = ['ROUND_OF', 'QUARTER', 'SEMI', 'FINAL', '결승', '4강', '8강', '16강', 'PO', '플레이오프', '토너먼트', '34', 'KNOCKOUT'];

      if (currentSeason?.rounds) {
          currentSeason.rounds.forEach((r: any) => {
              const isPlayoffRound = playoffKeywords.some(kw => (r.name || '').toUpperCase().includes(kw));

              r.matches?.forEach((m: any) => {
                  if (m.status !== 'COMPLETED') return;

                  const matchStr = `${m.stage || ''} ${m.matchLabel || ''}`.toUpperCase();
                  const isPlayoffMatch = isPlayoffRound || playoffKeywords.some(kw => matchStr.includes(kw));

                  // REGULAR / PLAYOFF 모드: hybrid 시즌에서만 분리. TOTAL 은 무필터 (정규+PO 합산)
                  if (rankPlayerStageMode !== 'TOTAL' && isHybridSeason) {
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

      const sortedPlayers = Object.values(playerStats)
          .filter((p: any) => rankPlayerMode === 'GOAL' ? p.goals > 0 : p.assists > 0)
          .sort((a: any, b: any) => {
              if (rankPlayerMode === 'GOAL') return b.goals - a.goals || b.assists - a.assists;
              return b.assists - a.assists || b.goals - a.goals;
          });

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
      
      {/* 🛠️ [v3] 3탭 — TOTAL 항상 노출 + 디폴트, REGULAR/PLAYOFF 는 hybrid 시즌일 때만 활성 */}
      <div className="flex bg-[#0b0e14] p-2 sm:p-3 border-b border-slate-800 gap-2">
          <button
              onClick={() => { setRankPlayerStageMode('TOTAL'); setExpandedPlayer(null); }}
              className={`flex-1 py-2.5 rounded-lg text-[11px] sm:text-xs font-black italic transition-all ${rankPlayerStageMode === 'TOTAL' ? 'bg-violet-600 text-white shadow-lg' : 'bg-slate-900 text-slate-500 hover:text-slate-300 border border-slate-800'}`}
          >
              🌍 TOTAL
          </button>
          <button
              onClick={() => { if (isHybridSeason) { setRankPlayerStageMode('REGULAR'); setExpandedPlayer(null); } }}
              disabled={!isHybridSeason}
              className={`flex-1 py-2.5 rounded-lg text-[11px] sm:text-xs font-black italic transition-all ${rankPlayerStageMode === 'REGULAR' ? 'bg-emerald-600 text-white shadow-lg' : isHybridSeason ? 'bg-slate-900 text-slate-500 hover:text-slate-300 border border-slate-800' : 'bg-slate-900/50 text-slate-700 border border-slate-800/50 cursor-not-allowed'}`}
              title={!isHybridSeason ? '리그+PO / 컵 시즌에서만 활성' : ''}
          >
              🚩 REGULAR
          </button>
          <button
              onClick={() => { if (isHybridSeason) { setRankPlayerStageMode('PLAYOFF'); setExpandedPlayer(null); } }}
              disabled={!isHybridSeason}
              className={`flex-1 py-2.5 rounded-lg text-[11px] sm:text-xs font-black italic transition-all ${rankPlayerStageMode === 'PLAYOFF' ? 'bg-indigo-600 text-white shadow-lg' : isHybridSeason ? 'bg-slate-900 text-slate-500 hover:text-slate-300 border border-slate-800' : 'bg-slate-900/50 text-slate-700 border border-slate-800/50 cursor-not-allowed'}`}
              title={!isHybridSeason ? '리그+PO / 컵 시즌에서만 활성' : ''}
          >
              🏆 PLAYOFF
          </button>
      </div>

      {/* 🛠️ [v3.1] TOTAL 모드 = 현재 시즌 정규+PO 합산 */}
      {rankPlayerStageMode === 'TOTAL' && isHybridSeason && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#0a1322] border-b border-slate-800">
              <span className="text-[8px] sm:text-[9px] font-black tracking-widest text-slate-500">CURRENT VIEW</span>
              <span className="text-[9px] sm:text-[10px] font-black text-violet-400 italic bg-violet-950/50 border border-violet-900/50 px-2 py-[1px] rounded-full">🏁 SEASON ALL</span>
              <span className="text-[9px] sm:text-[10px] text-slate-500 italic">· 정규 + 토너먼트/PO 합산</span>
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
                ) : rankedPlayers.slice(0, visibleCount).map((p: any, i: number) => {
                    // 🛠️ [v3.2] Load More — 기본 10명, 더보기마다 +10명씩 추가 노출
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
          {/* 🛠️ [v3.2] Load More — 기본 10명, 추가 +10명/click */}
          {rankedPlayers.length > visibleCount && (
              <div className="flex justify-center py-3 border-t border-slate-800/50 bg-[#0a1322]">
                  <button
                      onClick={() => setVisibleCount(c => c + PLAYER_PAGE_SIZE)}
                      className={`bg-slate-900 text-[11px] font-black italic tracking-widest uppercase px-5 py-2 rounded-full transition-all shadow-lg active:scale-95 flex items-center gap-2 border ${
                          rankPlayerMode === 'GOAL'
                              ? 'border-yellow-500/40 hover:border-yellow-400 text-yellow-300 hover:bg-yellow-900/30 hover:text-white shadow-yellow-900/20'
                              : 'border-blue-500/40 hover:border-blue-400 text-blue-300 hover:bg-blue-900/30 hover:text-white shadow-blue-900/20'
                      }`}
                  >
                      <span>▾ 더보기</span>
                      <span className="text-slate-500 text-[9px] tracking-normal">({rankedPlayers.length - visibleCount}명 더)</span>
                  </button>
              </div>
          )}
          {/* 진행률 안내 — 모두 노출되면 표시 */}
          {rankedPlayers.length > PLAYER_PAGE_SIZE && rankedPlayers.length <= visibleCount && (
              <div className="flex justify-center py-2 border-t border-slate-800/50 bg-[#0a1322]/50">
                  <span className="text-[10px] text-slate-500 italic">전체 {rankedPlayers.length}명 모두 표시 중</span>
              </div>
          )}
      </div>
    </div>
  );
}