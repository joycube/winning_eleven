/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo } from 'react';
import { Banner } from '../types';

interface BannerSliderProps {
  banners: Banner[];
}

// 🔥 [추가] 유튜브 ID 추출 헬퍼 함수 (다양한 URL 포맷 대응)
const getYouTubeId = (url: string | undefined) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// 🔥 [추가] 유튜브 썸네일 추출 헬퍼 함수 (어드민 리스트 등에서 사용 가능)
export const getYouTubeThumbnail = (url: string) => {
    const vId = getYouTubeId(url);
    if (vId) return `https://img.youtube.com/vi/${vId}/hqdefault.jpg`;
    return url; // 유튜브가 아니면 원래 URL 반환
};

export const BannerSlider = ({ banners }: BannerSliderProps) => {
  const [bannerIdx, setBannerIdx] = useState<number>(0); 
  const [isBannerInitialized, setIsBannerInitialized] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const renderBannerContent = (b: Banner) => {
    const url = b.url || '';
    const vId = getYouTubeId(url); // 🔥 [수정] 헬퍼 함수 사용하여 ID 추출 안정화

    if (vId) {
        // 🔥 [수정] 유튜브 영상 재생을 위한 Embed URL 구성 (자동재생, 음소거 필수)
        const embedUrl = `https://www.youtube.com/embed/${vId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${vId}&playsinline=1&enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`;
        
        return (
            <div className="w-full h-full bg-black relative">
                 <iframe 
                    src={embedUrl} 
                    className="w-full h-full object-cover pointer-events-none opacity-60" 
                    allow="autoplay; encrypted-media; gyroscope; picture-in-picture" 
                    title={b.description || 'Banner Video'} 
                 />
                 {/* 터치 스크롤 등을 위한 오버레이 */}
                 <div className="absolute inset-0 z-20" />
            </div>
        );
    } else {
        // 🔥 [수정] 일반 이미지의 경우 그대로 노출
        return <img src={url} className="w-full h-full object-cover opacity-60" alt={b.description || 'Banner'} />;
    }
  };

  const sortedBannersDisplay = useMemo(() => {
      if (!banners) return [];
      // 🔥 [수정] "아무 영상이나 먼저 노출 후 랜덤" 요구사항을 위해 강제 정렬 로직 제거
      // 원본 배열 순서를 유지하거나 섞어서 사용해야 인덱스 관리가 용이함
      return [...banners];
  }, [banners]);

  useEffect(() => {
    if (!sortedBannersDisplay || sortedBannersDisplay.length === 0) return;

    // 🔥 [수정] 초기 진입 시 로직: 영상이 있으면 영상 먼저 랜덤 노출
    if (!isBannerInitialized) {
        const videoIndices = sortedBannersDisplay.map((b, i) => {
            return getYouTubeId(b.url) ? i : -1;
        }).filter(i => i !== -1);

        if (videoIndices.length > 0) {
            // 영상이 하나라도 있으면 그 중 하나 랜덤 선택
            const randomVideoIdx = videoIndices[Math.floor(Math.random() * videoIndices.length)];
            setBannerIdx(randomVideoIdx);
        } else {
            // 영상 없으면 전체 중 랜덤
            setBannerIdx(Math.floor(Math.random() * sortedBannersDisplay.length));
        }
        setIsBannerInitialized(true);
        return;
    }

    const currentBanner = sortedBannersDisplay[bannerIdx];
    if (!currentBanner) return;

    const isVideo = !!getYouTubeId(currentBanner.url);
    // 🔥 [수정] 영상은 15초, 이미지는 5초 노출
    const delay = isVideo ? 15000 : 5000; 

    const t = setTimeout(() => {
        // 🔥 [수정] 이후에는 전체 배너 중 랜덤 노출
        let nextIdx = Math.floor(Math.random() * sortedBannersDisplay.length);
        
        // 배너가 여러 개일 경우, 같은 배너가 연속으로 나오는 것 방지 (선택 사항)
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