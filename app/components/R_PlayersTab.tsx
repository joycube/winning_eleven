"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useMemo } from 'react';
import { FALLBACK_IMG, Owner } from '../types';

interface RPlayersTabProps {
  activeRankingData: any;
  isHybridSeason: boolean;
  owners: Owner[];
}

export default function R_PlayersTab({ activeRankingData, isHybridSeason, owners }: RPlayersTabProps) {
  // 탭 내부에서 독립적으로 상태를 관리하여 부모 렌더링 부하를 줄입니다.
  const [rankPlayerMode, setRankPlayerMode] = useState<'GOAL' | 'ASSIST'>('GOAL');
  const [rankPlayerStageMode, setRankPlayerStageMode] = useState<'REGULAR' | 'PLAYOFF'>('REGULAR');

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
  }, [activeRankingData, rankPlayerMode, rankPlayerStageMode, isHybridSeason, owners]);

  return (
    <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col animate-in fade-in">
      
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
          {/* 🔥 [수술 포인트] 선수 탭 테이블 간격 밀착 및 너비 조정 */}
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
                    return (
                        <tr key={i} className={`hover:bg-slate-800/30 transition-colors ${isTop3 ? 'bg-slate-900/30' : ''}`}>
                            <td className={`py-3 pl-4 pr-1 text-center font-black text-xs ${p.rank === 1 ? 'text-yellow-400' : p.rank === 2 ? 'text-slate-300' : p.rank === 3 ? 'text-orange-400' : 'text-slate-600'}`}>
                                {p.rank}
                            </td>
                            <td className="py-3 pl-1 pr-3 overflow-hidden">
                                <div className="flex items-baseline gap-1.5 whitespace-nowrap overflow-hidden">
                                    {/* 🔥 [수술 포인트] 선수 이름과 오너 닉네임 폰트 크기 하향 및 잘림 방지 여백 */}
                                    <span className="font-bold text-white uppercase text-sm shrink-0">{p.name}</span>
                                    <span className="text-[11px] text-slate-500 font-bold tracking-tight italic truncate pr-1">({p.owner})</span>
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
  );
}