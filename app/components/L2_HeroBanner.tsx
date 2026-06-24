"use client";

import React, { useMemo } from 'react';
import { Season } from '../types';

interface Props {
  seasons: Season[];
  viewSeasonId: number;
}

/**
 * 🛠️ [L2] 락커룸 상단 Hero 배너
 *  - 현재 진행 중 시즌 정보 + 진행률
 *  - 비활성 시즌이면 "현재 진행 중인 시즌이 없습니다" 표시
 */
export const L2_HeroBanner = ({ seasons, viewSeasonId }: Props) => {
  const { current, doneMatches, totalMatches, progress, seasonIdx } = useMemo(() => {
    // 진행 중 시즌 우선 — viewSeasonId 매칭 → 없으면 status 'ACTIVE'/'IN_PROGRESS' → 없으면 마지막 시즌
    const activeStatuses = ['ACTIVE', 'IN_PROGRESS', 'OPEN'];
    const sorted = [...(seasons || [])].sort((a: any, b: any) => a.id - b.id);
    let s =
      sorted.find((x: any) => x.id === viewSeasonId) ||
      sorted.find((x: any) => activeStatuses.includes(String(x.status || '').toUpperCase())) ||
      sorted.filter((x: any) => x.status !== 'COMPLETED').slice(-1)[0] ||
      sorted.slice(-1)[0];

    if (!s) return { current: null, doneMatches: 0, totalMatches: 0, progress: 0, seasonIdx: 0 };

    let done = 0;
    let total = 0;
    (s.rounds || []).forEach((r: any) => {
      (r.matches || []).forEach((m: any) => {
        if (m.home === 'BYE' || m.away === 'BYE') return;
        total += 1;
        if (m.status === 'COMPLETED') done += 1;
      });
    });

    const idx = sorted.findIndex((x: any) => x.id === s.id) + 1;
    return {
      current: s,
      doneMatches: done,
      totalMatches: total,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
      seasonIdx: idx,
    };
  }, [seasons, viewSeasonId]);

  if (!current) {
    return (
      <div className="rounded-2xl border border-slate-800 p-4 sm:p-5 mb-3 bg-slate-900/40 text-center">
        <span className="text-[11px] text-slate-500 font-bold tracking-widest uppercase">No active season</span>
        <div className="text-sm text-slate-400 mt-1">현재 진행 중인 시즌이 없습니다</div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-slate-700/50 p-4 sm:p-5 mb-3 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #064e3b 0%, #0a0f1a 70%)' }}
    >
      <div className="flex items-center justify-between mb-2.5 gap-3">
        <div className="min-w-0 flex-1">
          <span className="text-[9px] sm:text-[10px] font-bold tracking-widest text-emerald-300/80 uppercase">
            {seasonIdx > 0 ? `SEASON ${seasonIdx} · ` : ''}CURRENT
          </span>
          <div className="text-sm sm:text-lg font-black italic text-white mt-0.5 truncate">
            🏆 {current.name}
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[9px] sm:text-[10px] font-bold tracking-widest text-emerald-300/80 uppercase">
            Progress
          </span>
          <div className="text-sm sm:text-lg font-black text-emerald-300 tabular-nums">
            {doneMatches}<span className="text-xs opacity-60">/{totalMatches}</span>
          </div>
        </div>
      </div>
      <div className="h-1 bg-slate-800/80 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-300 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
