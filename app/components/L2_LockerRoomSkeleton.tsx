"use client";

import React from 'react';

/**
 * 🛠️ [L2] 락커룸 대시보드 스켈레톤 로딩
 *  - 데이터 로딩(seasons 등) 동안 표시되는 골격 UI
 *  - 실제 L2_LockerRoomDashboard 의 섹션 레이아웃과 1:1 대응
 *  - animate-pulse 로 shimmer 효과
 */

// 공용 회색 블록
const Bar = ({ className = '' }: { className?: string }) => (
  <div className={`bg-slate-700/60 rounded ${className}`} />
);

// 섹션 헤더 (색 막대 + 제목 placeholder)
const SectionHead = ({ color }: { color: string }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className={`w-[3px] h-[14px] rounded ${color}`} />
    <Bar className="w-28 h-3.5" />
  </div>
);

// 랭킹/득점왕 한 줄
const RankRow = () => (
  <div className="flex items-center gap-2 sm:gap-3 p-2 bg-slate-800/50 rounded-lg">
    <Bar className="w-3 h-3" />
    <div className="w-7 h-7 rounded-full bg-slate-700/60 shrink-0" />
    <div className="flex-1 min-w-0">
      <Bar className="w-20 h-2.5 mb-1.5" />
      <Bar className="w-12 h-2" />
    </div>
    <Bar className="flex-1 h-2 hidden sm:block" />
    <Bar className="w-7 h-3" />
  </div>
);

export const L2_LockerRoomSkeleton = () => {
  return (
    <div className="w-full animate-pulse" aria-busy="true" aria-label="락커룸 불러오는 중">
      {/* 1. Hero */}
      <div
        className="rounded-2xl border border-slate-700/50 p-4 sm:p-5 mb-3"
        style={{ background: 'linear-gradient(135deg, #064e3b 0%, #0a0f1a 70%)' }}
      >
        <div className="flex items-center justify-between mb-2.5 gap-3">
          <div className="min-w-0 flex-1">
            <Bar className="w-20 h-2 mb-2" />
            <Bar className="w-40 h-4" />
          </div>
          <Bar className="w-12 h-5 shrink-0" />
        </div>
        <Bar className="w-full h-1 rounded-full" />
      </div>

      {/* 2. Quick Stats — 모바일 2열 / PC 4열 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-700/60 shrink-0" />
            <div className="flex-1 min-w-0">
              <Bar className="w-12 h-2 mb-1.5" />
              <Bar className="w-16 h-3" />
            </div>
          </div>
        ))}
      </div>

      {/* 3+4. NEXT / LAST 캐러셀 — 모바일 1열 / PC 2열 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        {[{ c: 'bg-emerald-400' }, { c: 'bg-yellow-400' }].map((s, i) => (
          <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <SectionHead color={s.c} />
            <Bar className="w-full h-7 rounded-lg mb-2" />
            <div className="bg-slate-800/50 rounded-lg p-3 flex items-center justify-between gap-2">
              <div className="w-9 h-9 rounded-full bg-slate-700/60" />
              <Bar className="w-10 h-5" />
              <div className="w-9 h-9 rounded-full bg-slate-700/60" />
            </div>
          </div>
        ))}
      </div>

      {/* 5+6. Team Ranking + Top Scorers — 모바일 1열 / PC 2열 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[{ c: 'bg-blue-500' }, { c: 'bg-emerald-500' }].map((s, i) => (
          <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 sm:p-4 mb-3">
            <SectionHead color={s.c} />
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, j) => <RankRow key={j} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default L2_LockerRoomSkeleton;
