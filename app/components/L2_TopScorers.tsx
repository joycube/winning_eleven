"use client";

import React, { useMemo, useState } from 'react';
import { Season, Owner, MasterTeam, FALLBACK_IMG } from '../types';
import LoopingGif from './LoopingGif';

interface Props {
  seasons: Season[];
  owners: Owner[];
  masterTeams: MasterTeam[];
  viewSeasonId: number;
  // 🛠️ [v2.5 성능] 무거운 집계는 부모(대시보드)에서 1회 계산해 전달받음
  historyData?: any;       // 누적(ALL) — useHistoryRecords 결과
  seasonRanking?: any;     // 시즌 — useLeagueStats(activeRankingData) 결과
}

const findOwnerProfile = (owners: Owner[], key?: string, name?: string) => {
  if (!owners || owners.length === 0) return { nickname: name || '-', photo: FALLBACK_IMG };
  const found = owners.find((o: any) =>
    (key && (o.uid === key || o.docId === key || String(o.id) === key)) ||
    (name && (o.nickname === name || o.legacyName === name || (Array.isArray(o.legacyNames) && o.legacyNames.includes(name))))
  );
  return {
    nickname: (found as any)?.nickname || name || '-',
    photo: (found as any)?.photo || FALLBACK_IMG,
  };
};

const findTeamMaster = (masterTeams: MasterTeam[], teamName: string) => {
  if (!teamName) return null;
  const clean = teamName.replace(/\s+/g, '').toLowerCase();
  return (masterTeams || []).find((t: any) =>
    ((t.name || t.teamName || '').replace(/\s+/g, '').toLowerCase()) === clean
  ) || null;
};

/**
 * [L2] 득점왕 랭킹 — 시즌/누적 토글
 *  - 시즌: 공식 엔진(useLeagueStats)의 현재 시즌 득점 집계 사용
 *  - 누적: history_records.players
 *  - 각 행: 선수명 + 팀 엠블럼 + 팀명 + 오너 프로필 + 오너이름 + 수평바 + 골수
 */
export const L2_TopScorers = ({ owners, masterTeams, historyData, seasonRanking }: Props) => {
  const [mode, setMode] = useState<'SEASON' | 'ALL'>('SEASON');

  const players = useMemo(() => {
    if (mode === 'SEASON') {
      // 공식 엔진 결과(부모 전달) — 정규 + 플레이오프 골을 선수별로 합산 후 재정렬.
      const merged = new Map<string, any>();
      const addAll = (list: any[]) => (list || []).forEach((p: any) => {
        const key = `${p.name}|${p.team}|${p.owner}`;
        if (!merged.has(key)) {
          merged.set(key, { name: p.name, team: p.team, teamLogo: p.teamLogo, ownerName: p.owner, ownerUid: undefined, goals: 0 });
        }
        merged.get(key).goals += (Number(p.goals) || 0);
      });
      addAll(seasonRanking?.regularPlayers || []);
      addAll(seasonRanking?.playoffPlayers || []);
      return Array.from(merged.values())
        .sort((a: any, b: any) => b.goals - a.goals)
        .slice(0, 8);
    } else {
      return (historyData?.players || [])
        .slice()
        .sort((a: any, b: any) => (Number(b.goals) || 0) - (Number(a.goals) || 0))
        .slice(0, 8)
        .map((p: any) => ({
          name: p.name,
          team: p.team,
          teamLogo: p.teamLogo,
          ownerName: p.owner,
          ownerUid: p.ownerId,
          goals: p.goals,
        }));
    }
  }, [mode, seasonRanking, historyData]);

  const maxGoals = players.length > 0 ? Math.max(...players.map((p: any) => p.goals || 0)) : 1;

  const rankColors = ['text-yellow-400', 'text-slate-300', 'text-orange-400'];

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 sm:p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-[3px] h-[14px] rounded bg-emerald-500" />
          <span className="text-[13px] font-black italic text-white tracking-wide">TOP SCORERS</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setMode('SEASON')}
            className={`text-[10px] px-2.5 py-1 rounded-md font-bold transition ${
              mode === 'SEASON' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >시즌</button>
          <button
            onClick={() => setMode('ALL')}
            className={`text-[10px] px-2.5 py-1 rounded-md font-bold transition ${
              mode === 'ALL' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >누적</button>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="text-center text-[11px] text-slate-500 py-6">집계할 데이터가 없습니다</div>
      ) : (
        <div className="flex flex-col gap-2">
          {players.map((p: any, idx: number) => {
            const rankColor = idx < 3 ? rankColors[idx] : 'text-slate-500';
            const ownerInfo = findOwnerProfile(owners, p.ownerUid, p.ownerName);
            const master = findTeamMaster(masterTeams, p.team);
            const teamLogo = master?.logo || p.teamLogo || FALLBACK_IMG;
            return (
              <div key={`${p.name}_${p.team}_${idx}`} className="flex items-center gap-2 sm:gap-3 p-2 bg-slate-800/50 rounded-lg">
                {/* 정보 영역 — 고정 폭(그래프 시작점 정렬, 길면 말줄임) */}
                <div className="flex items-center gap-2 shrink-0 w-[108px] sm:w-[128px]">
                  <span className={`text-[13px] font-black italic w-4 text-center shrink-0 ${rankColor}`}>{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-black italic text-white truncate block">{p.name}</span>
                    <div className="flex items-center gap-1 mt-0.5 min-w-0">
                      <div className="w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0 p-px" style={{ transform: 'translateZ(0)' }}>
                        <img src={teamLogo} alt="" className="w-full h-full object-contain" onError={(e: any) => { e.target.src = FALLBACK_IMG; }} />
                      </div>
                      <span className="text-[8px] text-slate-400 truncate">{p.team || '-'}</span>
                    </div>
                  </div>
                </div>
                {/* 그래프 영역 */}
                <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      idx === 0 ? 'bg-yellow-400' :
                      idx === 1 ? 'bg-slate-300' :
                      idx === 2 ? 'bg-orange-400' : 'bg-emerald-500/60'
                    }`}
                    style={{ width: `${Math.max(5, (p.goals / Math.max(maxGoals, 1)) * 100)}%` }}
                  />
                </div>
                {/* 오너 — 고정 폭(그래프 끝점 정렬) */}
                <div className="flex items-center gap-1 shrink-0 w-[58px] sm:w-[78px] justify-end">
                  <LoopingGif src={ownerInfo.photo} alt="" className="w-3.5 h-3.5 rounded-full object-cover bg-slate-700 border border-slate-800 shrink-0" onError={(e: any) => { e.target.src = FALLBACK_IMG; }} />
                  <span className="text-[8px] sm:text-[9px] text-slate-400 truncate">{ownerInfo.nickname}</span>
                </div>
                <span className={`text-[12px] font-black italic w-8 text-right tabular-nums shrink-0 ${rankColor}`}>
                  {p.goals}<span className="text-[8px] opacity-60 ml-0.5">⚽</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
