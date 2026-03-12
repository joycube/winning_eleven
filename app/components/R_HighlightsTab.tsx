"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useMemo } from 'react';
import { FALLBACK_IMG } from '../types'; 
import { getYouTubeThumbnail } from '../utils/helpers';

interface RHighlightsTabProps {
  currentSeason: any;
  activeRankingData: any;
}

export default function R_HighlightsTab({ currentSeason, activeRankingData }: RHighlightsTabProps) {

  // 현재 시즌의 하이라이트 영상만 필터링하여 모아주는 로직
  const seasonHighlights = useMemo(() => {
      const hl: any[] = [];
      if (!currentSeason?.rounds) return [];
      
      currentSeason.rounds.forEach((r: any) => {
          r.matches?.forEach((m: any) => {
              if (m.status === 'COMPLETED' && m.youtubeUrl) {
                  hl.push({
                      ...m,
                      winnerLogo: Number(m.homeScore) > Number(m.awayScore) ? m.homeLogo : m.awayLogo
                  });
              }
          });
      });
      // 최신 경기가 위로 오도록 정렬
      return hl.sort((a, b) => b.id.localeCompare(a.id));
  }, [currentSeason]);

  const displayHighlights = seasonHighlights.length > 0 ? seasonHighlights : (activeRankingData?.highlights || []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 animate-in fade-in">
      {displayHighlights.map((m: any, idx: number) => (
        <div 
            key={idx} 
            className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 group hover:border-emerald-500 transition-all cursor-pointer" 
            onClick={() => window.open(m.youtubeUrl, '_blank')}
        >
            <div className="relative aspect-video">
                <img 
                    src={getYouTubeThumbnail(m.youtubeUrl)} 
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                    alt="Highlight Thumbnail" 
                />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-110 transition-transform">
                        ▶
                    </div>
                </div>
            </div>
            <div className="p-3 flex items-center gap-3">
                <img 
                    src={m.winnerLogo || FALLBACK_IMG} 
                    className="w-8 h-8 rounded-full bg-white object-contain p-0.5" 
                    alt="Winner Logo" 
                    onError={(e:any) => { e.target.src = FALLBACK_IMG; }} 
                />
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{m.stage} • {m.matchLabel}</p>
                    <p className="text-xs font-bold text-white truncate uppercase">
                        {m.home} <span className="text-emerald-400 mx-1">{m.homeScore}:{m.awayScore}</span> {m.away}
                    </p>
                </div>
            </div>
        </div>
      ))}
      
      {displayHighlights.length === 0 && (
          <div className="col-span-full py-20 text-center text-slate-500 italic font-bold">
              등록된 하이라이트 영상이 없습니다.
          </div>
      )}
    </div>
  );
}