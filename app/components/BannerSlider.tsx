/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image'; // 🔥 [추가] Next.js 강력한 이미지 최적화 컴포넌트 임포트
import { Banner } from '../types';

interface BannerSliderProps {
  banners: Banner[];
}

// 유튜브 ID 추출 헬퍼 함수
const getYouTubeId = (url: string | undefined) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// 유튜브 썸네일 추출 헬퍼 함수
export const getYouTubeThumbnail = (url: string) => {
    const vId = getYouTubeId(url);
    if (vId) return `https://img.youtube.com/vi/${vId}/hqdefault.jpg`;
    return url; 
};

export const BannerSlider = ({ banners }: BannerSliderProps) => {
  const [bannerIdx, setBannerIdx] = useState<number>(0); 
  const [isBannerInitialized, setIsBannerInitialized] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const renderBannerContent = (b: Banner) => {
    const url = b.url || '';
    const vId = getYouTubeId(url); 

    if (vId) {
        const embedUrl = `https://www.youtube.com/embed/${vId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${vId}&playsinline=1&enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`;
        const thumbUrl = `https://img.youtube.com/vi/${vId}/maxresdefault.jpg`;

        return (
            <div className="w-full h-full bg-black relative overflow-hidden">
                {/* 1. 블러 썸네일 배경 — 데스크탑 레터박스 영역을 채움 */}
                <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-cover bg-center scale-125 blur-2xl opacity-70"
                    style={{ backgroundImage: `url(${thumbUrl})` }}
                />
                {/* 2. iframe — 모바일은 가로 풀 (위아래 살짝 잘림), 데스크탑은 16:9 비율 유지 중앙 정렬 */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <iframe
                        src={embedUrl}
                        className="block w-full sm:w-auto sm:h-full pointer-events-none shadow-2xl"
                        style={{ aspectRatio: '16/9' }}
                        allow="autoplay; encrypted-media; gyroscope; picture-in-picture"
                        title={b.description || 'Banner Video'}
                    />
                </div>
                {/* 3. 클릭 차단 + 살짝 다크 그라데이션 (상단 공지 가독성용) */}
                <div className="absolute inset-0 z-20 bg-gradient-to-b from-black/30 via-transparent to-black/30" />
            </div>
        );
    } else {
        // 🛠️ 모바일은 object-cover (가로 가득, 위아래 살짝 잘림), sm 이상은 object-contain + 블러 BG
        return (
            <div className="w-full h-full bg-black relative overflow-hidden">
                {/* 1. 블러 처리된 동일 이미지 배경 */}
                <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-cover bg-center scale-125 blur-2xl opacity-70"
                    style={{ backgroundImage: `url(${url})` }}
                />
                {/* 2. 본 이미지 — 모바일 cover / 데스크탑 contain */}
                <Image
                    src={url}
                    alt={b.description || 'Banner'}
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, 1200px"
                    className="object-cover sm:object-contain"
                />
                {/* 3. 살짝 다크 그라데이션 (상단 공지 가독성용) */}
                <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/30 via-transparent to-black/30 pointer-events-none" />
            </div>
        );
    }
  };

  const sortedBannersDisplay = useMemo(() => {
      if (!banners) return [];
      return [...banners];
  }, [banners]);

  useEffect(() => {
    if (!sortedBannersDisplay || sortedBannersDisplay.length === 0) return;

    if (!isBannerInitialized) {
        const videoIndices = sortedBannersDisplay.map((b, i) => {
            return getYouTubeId(b.url) ? i : -1;
        }).filter(i => i !== -1);

        if (videoIndices.length > 0) {
            const randomVideoIdx = videoIndices[Math.floor(Math.random() * videoIndices.length)];
            setBannerIdx(randomVideoIdx);
        } else {
            setBannerIdx(Math.floor(Math.random() * sortedBannersDisplay.length));
        }
        setIsBannerInitialized(true);
        return;
    }

    const currentBanner = sortedBannersDisplay[bannerIdx];
    if (!currentBanner) return;

    const isVideo = !!getYouTubeId(currentBanner.url);
    const delay = isVideo ? 15000 : 5000; 

    const t = setTimeout(() => {
        let nextIdx = Math.floor(Math.random() * sortedBannersDisplay.length);
        if (sortedBannersDisplay.length > 1 && nextIdx === bannerIdx) {
            nextIdx = (nextIdx + 1) % sortedBannersDisplay.length;
        }
        setBannerIdx(nextIdx);
    }, delay);

    return () => clearTimeout(t);
  }, [sortedBannersDisplay, bannerIdx, isBannerInitialized]);

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const handleTouchEnd = () => { 
    if (!touchStart || !touchEnd) return; 
    const dist = touchStart - touchEnd; 
    if (dist > 50) setBannerIdx((p) => (p + 1) % sortedBannersDisplay.length); 
    if (dist < -50) setBannerIdx((p) => (p - 1 + sortedBannersDisplay.length) % sortedBannersDisplay.length); 
    setTouchStart(0); setTouchEnd(0); 
  };

  return (
    <div 
        className="w-full h-[225px] md:h-[330px] relative border-b border-slate-800 shadow-2xl overflow-hidden bg-black" 
        onTouchStart={handleTouchStart} 
        onTouchMove={handleTouchMove} 
        onTouchEnd={handleTouchEnd}
    >
        {sortedBannersDisplay.length > 0 ? sortedBannersDisplay.map((b, i) => (
            <div key={b.id || i} className={`absolute inset-0 transition-opacity duration-1000 ${i === bannerIdx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                {renderBannerContent(b)}
            </div>
        )) : null}
        
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent z-10 pointer-events-none" />
        
        {sortedBannersDisplay[bannerIdx] && (
            <div className="absolute bottom-12 left-6 z-20">
                <p className="text-white text-xs font-bold bg-black/50 px-2 py-1 rounded backdrop-blur-sm border border-slate-700/50">
                    {sortedBannersDisplay[bannerIdx].description}
                </p>
            </div>
        )}
    </div>
  );
};