"use client";

import React, { useMemo } from 'react';
import { Season, MasterTeam, Owner, FALLBACK_IMG } from '../types';

// 팀 엠블럼 로고 — masterTeams 우선, 없으면 매치 로고, 그래도 없으면 폴백
const findTeamLogo = (masterTeams: any[], name: string, fallback?: string) => {
  if (!name) return fallback || FALLBACK_IMG;
  const clean = name.replace(/\s+/g, '').toLowerCase();
  const m = (masterTeams || []).find((t: any) =>
    ((t.name || t.teamName || '').replace(/\s+/g, '').toLowerCase()) === clean
  );
  return m?.logo || fallback || FALLBACK_IMG;
};

interface Props {
  seasons: Season[];
  masterTeams: MasterTeam[];
  owners: Owner[];
  onHighlightClick?: (h: any) => void;
  /** "더 보기" — 전체 하이라이트 보드로 이동 (옵션) */
  onViewAll?: () => void;
}

// YouTube ID 추출
const extractYoutubeId = (url: string): string | null => {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/);
  return m ? m[1] : null;
};

const getThumbnail = (url: string) => {
  const id = extractYoutubeId(url);
  // 🛠️ mqdefault = 16:9 (검은 레터박스 없음). hqdefault(4:3)는 상하단 검은 띠가 박혀 있어 사용 안 함.
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '';
};

/**
 * 🛠️ [L2 v2.6] 하이라이트 — 세로 카드 한 줄 가로 스와이프.
 *  - 가로(16:9) 영상을 세로 카드에 넣고, 위아래는 썸네일을 블러한 "레터박스"로 채워 영상과 색이 어우러짐.
 *  - 상단 밴드: 시즌명 + 경기  / 하단 밴드: 팀 스코어(예: 노르웨이 3:0 한국)
 *  - PC/태블릿은 한 줄에 여러 장, 모바일은 좌우 스와이프 → 공간 활용 ↑
 */
export const L2_HighlightsCarousel = ({ seasons, masterTeams, onHighlightClick, onViewAll }: Props) => {
  const highlights = useMemo(() => {
    const all: any[] = [];
    (seasons || []).forEach((s: any) => {
      (s.rounds || []).forEach((r: any) => {
        (r.matches || []).forEach((m: any) => {
          if (m.status !== 'COMPLETED' || !m.youtubeUrl) return;
          all.push({
            ...m,
            _seasonName: s.name,
            _seasonId: s.id,
            _ts: Number(m.timestamp || 0),
            _thumbnail: getThumbnail(m.youtubeUrl),
          });
        });
      });
    });
    return all.sort((a, b) => {
      if (a._ts !== b._ts) return b._ts - a._ts;
      return b._seasonId - a._seasonId;
    }).slice(0, 12);
  }, [seasons]);

  if (highlights.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center mb-3">
        <div className="text-2xl mb-2 opacity-50">▶</div>
        <span className="text-[10px] font-bold tracking-widest text-red-400 uppercase block mb-1">HIGHLIGHTS</span>
        <span className="text-[11px] text-slate-500">하이라이트 영상이 없습니다</span>
      </div>
    );
  }

  return (
    <div className="mb-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-[3px] h-[14px] rounded bg-red-500" />
          <span className="text-[13px] font-black italic text-white tracking-wide">HIGHLIGHTS</span>
          <span className="text-[10px] text-red-400 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            {highlights.length}개
          </span>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 border border-slate-700 hover:border-slate-500 px-2.5 py-1 rounded-full transition"
          >
            더 보기 <span className="text-[12px] leading-none">›</span>
          </button>
        )}
      </div>

      {/* 세로 카드 한 줄 — 가로 스와이프 */}
      <div
        className="flex gap-3 overflow-x-auto pb-1 snap-x [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {highlights.map((h: any, idx: number) => (
          <button
            key={`${h._seasonId}_${h.id || idx}`}
            onClick={() => onHighlightClick && onHighlightClick(h)}
            className="relative shrink-0 w-[158px] sm:w-[168px] rounded-2xl overflow-hidden border border-blue-900/50 hover:border-yellow-400/60 snap-start text-left group transition"
            style={{ backgroundColor: '#1c1cc0' }}
          >
            {/* 투톤 배경 — 큰 반원(밝은 형광 블루)으로 색 구분 (그라데이션 X) */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 -translate-x-1/2 rounded-full"
              style={{ width: '240%', aspectRatio: '1', top: '40%', backgroundColor: '#3a5bff' }}
            />

            {/* 콘텐츠 */}
            <div className="relative flex flex-col">
              {/* 상단: 시즌(옐로) + 게임(화이트) — 하단보다 높게 */}
              <div className="px-3 pt-3 pb-2.5 text-center min-w-0">
                <div className="text-[11px] font-black italic truncate drop-shadow" style={{ color: '#ffe600' }}>🏆 {h._seasonName}</div>
                <div className="text-[9px] font-semibold text-white truncate mt-0.5 drop-shadow">{h.matchLabel || '경기'}</div>
              </div>

              {/* 영상 — 카드 좌우 끝까지 꽉, 16:9 썸네일이라 검은 레터박스 없음 */}
              <div className="relative h-[150px] sm:h-[158px] bg-black overflow-hidden">
                {h._thumbnail ? (
                  <img
                    src={h._thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e: any) => { e.currentTarget.style.opacity = '0'; }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-900/40 to-slate-900" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition">
                  <div className="w-11 h-11 rounded-full bg-red-600/95 text-white flex items-center justify-center text-lg shadow-lg group-hover:scale-110 transition">▶</div>
                </div>
              </div>

              {/* 하단: 엠블럼 + 팀명 + 점수 — 상단보다 낮게 */}
              <div className="px-2 pt-2 pb-2.5 flex items-center justify-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-white p-0.5 overflow-hidden shrink-0 flex items-center justify-center" style={{ transform: 'translateZ(0)' }}>
                  <img src={findTeamLogo(masterTeams, h.home, h.homeLogo)} alt="" className="w-full h-full object-contain" onError={(e: any) => { e.target.src = FALLBACK_IMG; }} />
                </span>
                <span className="text-[10px] font-black italic text-white truncate min-w-0 drop-shadow">
                  {h.home} <span style={{ color: '#ffe600' }}>{h.homeScore}:{h.awayScore}</span> {h.away}
                </span>
                <span className="w-4 h-4 rounded-full bg-white p-0.5 overflow-hidden shrink-0 flex items-center justify-center" style={{ transform: 'translateZ(0)' }}>
                  <img src={findTeamLogo(masterTeams, h.away, h.awayLogo)} alt="" className="w-full h-full object-contain" onError={(e: any) => { e.target.src = FALLBACK_IMG; }} />
                </span>
              </div>
            </div>
          </button>
        ))}

        {/* 더 보기 카드 */}
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="shrink-0 w-[150px] sm:w-[160px] rounded-xl border border-dashed border-slate-700 hover:border-slate-500 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-white transition snap-start"
          >
            <span className="w-9 h-9 rounded-full border border-slate-600 flex items-center justify-center text-lg">›</span>
            <span className="text-[11px] font-bold">전체 보기</span>
          </button>
        )}
      </div>
    </div>
  );
};
