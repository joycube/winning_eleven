"use client";

import React, { useMemo } from 'react';
import { Season, Match, MasterTeam, Owner } from '../types';
import { L2_Carousel } from './L2_Carousel';
import { MatchCard } from './MatchCard';
import { resolveCurrentSeason } from './L2_currentSeason';

interface Props {
  seasons: Season[];
  masterTeams: MasterTeam[];
  owners: Owner[];
  activeRankingData: any;
  historyData: any;
  /** 매치카드 클릭 → 스케쥴표 + 해당 매치 자동 스크롤 (seasonId + matchId) */
  onNavigateToSchedule?: (seasonId: number, matchId?: string) => void;
  onMatchClick?: (m: Match) => void;
}

/**
 * 🛠️ [L2] 다음 경기 캐러셀 (최대 5경기)
 *  - UPCOMING + 점수 미입력 + TBD/BYE 아닌 매치
 *  - 시즌 id 오름차순 + 매치 id 오름차순 (생성 순)
 *  - 매치카드 그대로 사용
 */
export const L2_NextMatchCarousel = ({
  seasons, masterTeams, owners, activeRankingData, historyData, onNavigateToSchedule, onMatchClick,
}: Props) => {
  const nextMatches = useMemo(() => {
    // 🛠️ [v2.4] 현재 진행 시즌(가장 나중에 만든 시즌)만 대상으로 — Hero/랭킹과 동일 시즌 노출.
    const cur = resolveCurrentSeason(seasons);
    if (!cur) return [];
    const all: any[] = [];
    (cur.rounds || []).forEach((r: any, rIdx: number) => {
      (r.matches || []).forEach((m: any, mIdx: number) => {
        // 매치 필터 — COMPLETED 제외 + 점수 박힌 매치 제외 + TBD/BYE 제외
        if (m.status === 'COMPLETED') return;
        if (m.home === 'BYE' || m.away === 'BYE') return;
        if (m.home === 'TBD' || m.away === 'TBD') return;
        if (!m.home || !m.away) return;
        const hsStr = String(m.homeScore ?? '').trim();
        const asStr = String(m.awayScore ?? '').trim();
        if (hsStr !== '' || asStr !== '') return; // 점수 들어가 있으면 NEXT 아님
        all.push({ ...m, _seasonName: cur.name, _seasonId: cur.id, _rIdx: rIdx, _mIdx: mIdx });
      });
    });
    // 가장 먼저 해야 할 경기부터 — 스케쥴(라운드 → 매치) 오름차순
    all.sort((a, b) => {
      if (a._rIdx !== b._rIdx) return a._rIdx - b._rIdx;
      return a._mIdx - b._mIdx;
    });
    return all.slice(0, 5);
  }, [seasons]);

  if (nextMatches.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center mb-3">
        <div className="text-2xl mb-2 opacity-50">⏱</div>
        <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase block mb-1">NEXT MATCHES</span>
        <span className="text-[11px] text-slate-500">예정된 경기가 없습니다</span>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <L2_Carousel
        items={nextMatches}
        autoSlideMs={5000}
        dotColor="bg-emerald-400"
        headerLeft={
          <div className="flex items-center gap-2">
            <span className="w-[3px] h-[14px] rounded bg-emerald-400" />
            <span className="text-[13px] font-black italic text-white tracking-wide">NEXT MATCHES</span>
            <span className="text-[10px] text-emerald-400 font-bold">{nextMatches.length}경기</span>
          </div>
        }
        renderItem={(m: any) => {
          // 🛠️ [v2.2] 매치 클릭 → 해당 시즌 스케쥴 + 해당 매치 자동 스크롤
          const navigateToMatch = () => {
            if (onNavigateToSchedule) onNavigateToSchedule(m._seasonId || m.seasonId, m.id);
            else if (onMatchClick) onMatchClick(m);
          };
          return (
            <div className="px-1">
              {/* 시즌명 헤더 — 시즌만 (matchId 없음) → 스케쥴 진입 후 첫 진행 매치로 자동 스크롤 */}
              <button
                onClick={() => onNavigateToSchedule && onNavigateToSchedule(m._seasonId || m.seasonId)}
                className="w-full mb-1.5 px-3 py-1.5 bg-emerald-950/30 border border-emerald-900/40 hover:border-emerald-500/50 rounded-lg flex items-center justify-between gap-2 transition group"
              >
                <span className="text-[10px] sm:text-[11px] font-bold text-emerald-300 tracking-wider truncate">
                  🏆 {m._seasonName}
                </span>
                <span className="text-[9px] text-emerald-400/70 group-hover:text-emerald-300 whitespace-nowrap">
                  스케쥴 →
                </span>
              </button>
              {/* 매치카드 — 클릭 시 해당 매치까지 자동 스크롤 */}
              <MatchCard
                match={m}
                onClick={navigateToMatch}
                activeRankingData={activeRankingData}
                historyData={historyData}
                masterTeams={masterTeams}
                owners={owners}
              />
            </div>
          );
        }}
      />
    </div>
  );
};
