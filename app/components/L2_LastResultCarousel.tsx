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
  /** 매치카드 클릭 → 스케쥴표 + 해당 매치 자동 스크롤 */
  onNavigateToSchedule?: (seasonId: number, matchId?: string) => void;
  onMatchClick?: (m: Match) => void;
}

/**
 * 🛠️ [L2] 최근 완료 경기 캐러셀 (최대 5경기)
 *  - COMPLETED + BYE 아닌 매치
 *  - timestamp 역순 (없으면 시즌 id + 라운드 id 역순)
 *  - 매치카드 그대로 사용
 */
export const L2_LastResultCarousel = ({
  seasons, masterTeams, owners, activeRankingData, historyData, onNavigateToSchedule, onMatchClick,
}: Props) => {
  const lastMatches = useMemo(() => {
    // 🛠️ [v2.4] 현재 진행 시즌(가장 나중에 만든 시즌)만 대상으로 — Hero/랭킹과 동일 시즌 노출.
    const cur = resolveCurrentSeason(seasons);
    if (!cur) return [];
    const all: any[] = [];
    (cur.rounds || []).forEach((r: any, rIdx: number) => {
      (r.matches || []).forEach((m: any, mIdx: number) => {
        if (m.status !== 'COMPLETED') return;
        if (m.home === 'BYE' || m.away === 'BYE') return;
        all.push({
          ...m,
          _seasonName: cur.name,
          _seasonId: cur.id,
          _rIdx: rIdx,
          _mIdx: mIdx,
          _ts: Number(m.timestamp || 0),
        });
      });
    });
    // 🛠️ [v2.4] 가장 최신 경기부터 — 실제 진행 시각(timestamp) 내림차순.
    //   timestamp 가 같거나(둘 다 미기록) 없으면 스케쥴 위치(라운드 → 매치) 내림차순으로 보정.
    return all.sort((a, b) => {
      if (a._ts !== b._ts) return b._ts - a._ts;
      if (a._rIdx !== b._rIdx) return b._rIdx - a._rIdx;
      return b._mIdx - a._mIdx;
    }).slice(0, 5);
  }, [seasons]);

  if (lastMatches.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center mb-3">
        <div className="text-2xl mb-2 opacity-50">🏁</div>
        <span className="text-[10px] font-bold tracking-widest text-yellow-400 uppercase block mb-1">LAST RESULTS</span>
        <span className="text-[11px] text-slate-500">완료된 경기가 없습니다</span>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <L2_Carousel
        items={lastMatches}
        autoSlideMs={5000}
        dotColor="bg-yellow-400"
        headerLeft={
          <div className="flex items-center gap-2">
            <span className="w-[3px] h-[14px] rounded bg-yellow-400" />
            <span className="text-[13px] font-black italic text-white tracking-wide">LAST RESULTS</span>
            <span className="text-[10px] text-yellow-400 font-bold">{lastMatches.length}경기</span>
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
              {/* 시즌명 헤더 — 시즌만 (matchId 없음) */}
              <button
                onClick={() => onNavigateToSchedule && onNavigateToSchedule(m._seasonId || m.seasonId)}
                className="w-full mb-1.5 px-3 py-1.5 bg-yellow-950/20 border border-yellow-900/40 hover:border-yellow-500/50 rounded-lg flex items-center justify-between gap-2 transition group"
              >
                <span className="text-[10px] sm:text-[11px] font-bold text-yellow-300 tracking-wider truncate">
                  🏆 {m._seasonName}
                </span>
                <span className="text-[9px] text-yellow-400/70 group-hover:text-yellow-300 whitespace-nowrap">
                  스케쥴 →
                </span>
              </button>
              {/* 매치카드 클릭 → 해당 매치 자동 스크롤 */}
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
