"use client";

import React, { useMemo } from 'react';
import { Season, MasterTeam, Owner } from '../types';

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
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
};

/**
 * 🛠️ [L2 v2.6] 하이라이트 — 세로 카드 한 줄 가로 스와이프.
 *  - 가로(16:9) 영상을 세로 카드에 넣고, 위아래는 썸네일을 블러한 "레터박스"로 채워 영상과 색이 어우러짐.
 *  - 상단 밴드: 시즌명 + 경기  / 하단 밴드: 팀 스코어(예: 노르웨이 3:0 한국)
 *  - PC/태블릿은 한 줄에 여러 장, 모바일은 좌우 스와이프 → 공간 활용 ↑
 */
export const L2_HighlightsCarousel = ({ seasons, onHighlightClick, onViewAll }: Props) => {
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
            className="relative shrink-0 w-[150px] sm:w-[160px] rounded-xl overflow-hidden border border-slate-800 hover:border-red-500/60 snap-start text-left group transition"
          >
            {/* 레터박스 배경 — 썸네일 블러 (영상과 색 어우러짐) */}
            {h._thumbnail ? (
              <img
                src={h._thumbnail}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover scale-125"
                style={{ filter: 'blur(14px)', opacity: 0.5 }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-red-900/40 to-slate-900" />
            )}
            <div className="absolute inset-0 bg-slate-950/45" />

            {/* 콘텐츠 */}
            <div className="relative flex flex-col">
              {/* 상단 밴드: 시즌 + 경기 */}
              <div className="px-2.5 pt-2.5 pb-2 min-w-0">
                <div className="text-[10px] font-black italic text-white truncate">🏆 {h._seasonName}</div>
                <div className="text-[9px] text-white/65 truncate mt-0.5">{h.matchLabel || '경기'}</div>
              </div>

              {/* 영상 (16:9) */}
              <div className="relative aspect-video bg-black/40">
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
                  <div className="w-9 h-9 rounded-full bg-red-600/95 text-white flex items-center justify-center text-base shadow-lg group-hover:scale-110 transition">▶</div>
                </div>
                <div className="absolute top-1.5 right-1.5 bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">YT</div>
              </div>

              {/* 하단 밴드: 스코어 */}
              <div className="px-2 pt-2 pb-2.5 text-center">
                <div className="text-[10px] font-black italic text-white truncate">
                  {h.home} <span className="text-red-300">{h.homeScore}:{h.awayScore}</span> {h.away}
                </div>
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
