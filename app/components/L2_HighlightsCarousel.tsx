"use client";

import React, { useMemo, useState } from 'react';
import { Season, MasterTeam, Owner, FALLBACK_IMG } from '../types';
import { L2_Carousel } from './L2_Carousel';

interface Props {
  seasons: Season[];
  masterTeams: MasterTeam[];
  owners: Owner[];
  onHighlightClick?: (h: any) => void;
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
 * 🛠️ [L2] 하이라이트 캐러셀 (최대 5개)
 *  - youtubeUrl 있는 COMPLETED 매치
 *  - 메인 카드 + 하단 5개 썸네일 nav
 */
export const L2_HighlightsCarousel = ({ seasons, masterTeams, onHighlightClick }: Props) => {
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
    }).slice(0, 5);
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
      <L2_Carousel
        items={highlights}
        autoSlideMs={5000}
        dotColor="bg-red-500"
        showDots={false}
        headerLeft={
          <div className="flex items-center gap-2">
            <span className="w-[3px] h-[14px] rounded bg-red-500" />
            <span className="text-[13px] font-black italic text-white tracking-wide">HIGHLIGHTS</span>
            <span className="text-[10px] text-red-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {highlights.length}개
            </span>
          </div>
        }
        renderItem={(h: any) => (
          <div
            onClick={() => onHighlightClick && onHighlightClick(h)}
            className="px-1 cursor-pointer group"
          >
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-red-500/50 transition">
              <div className="relative aspect-video bg-slate-800">
                {h._thumbnail ? (
                  <img
                    src={h._thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e: any) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-900/40 to-slate-900" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition">
                  <div className="w-12 h-12 rounded-full bg-red-600/95 text-white flex items-center justify-center text-lg shadow-lg group-hover:scale-110 transition">▶</div>
                </div>
                <div className="absolute top-2 right-2 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded">YT</div>
                {/* 매치 정보 오버레이 */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 bg-black/65 px-2 py-1 rounded">
                    <span className="text-[10px] text-white font-bold">{h.home}</span>
                    <span className="text-[10px] text-white font-bold">{h.homeScore}:{h.awayScore}</span>
                    <span className="text-[10px] text-white font-bold">{h.away}</span>
                  </div>
                  {h.matchLabel && (
                    <span className="text-[9px] bg-black/65 text-white px-2 py-1 rounded font-bold truncate">{h.matchLabel}</span>
                  )}
                </div>
              </div>
              <div className="p-3">
                <div className="text-[11px] font-black text-white italic line-clamp-1">
                  {h.home} {h.homeScore}:{h.awayScore} {h.away}
                </div>
                <div className="text-[9px] text-slate-500 mt-1 flex justify-between">
                  <span className="truncate">{h._seasonName}</span>
                  <span className="ml-2 shrink-0">{h.matchLabel || ''}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        renderThumbnail={(h: any, idx: number, isActive: boolean) => (
          <div className="relative aspect-video bg-slate-800 rounded-md overflow-hidden">
            {h._thumbnail ? (
              <img src={h._thumbnail} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-red-900/40 to-slate-900" />
            )}
            {isActive && (
              <div className="absolute inset-0 bg-emerald-500/20" />
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-black/65 px-1 py-0.5">
              <span className="text-[7px] text-white font-bold block truncate">{h.home} {h.homeScore}:{h.awayScore}</span>
            </div>
          </div>
        )}
      />
    </div>
  );
};
