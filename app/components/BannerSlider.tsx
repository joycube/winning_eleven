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
        // 🛠️ 태블릿/PC 레터박스 축소 — 썸네일 블러 배경 채움 + iframe 중앙 정렬
        const thumbUrl = `https://img.youtube.com/vi/${vId}/maxresdefault.jpg`;

        return (
            <div className="w-full h-full bg-black relative overflow-hidden">
                {/* 1. 블러 처리된 썸네일 배경 — 레터박스 자리를 채움 */}
                <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-cover bg-center scale-110 blur-2xl opacity-60"
                    style={{ backgroundImage: `url(${thumbUrl})` }}
                />
                {/* 2. iframe — 16:9 비율 유지하면서 컨테이너에 cover 처리 (좌우 잘림 허용, 중앙은 보존) */}
                <iframe
                    src={embedUrl}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[177.78vh] min-w-full h-[56.25vw] min-h-full pointer-events-none opacity-90"
                    allow="autoplay; encrypted-media; gyroscope; picture-in-picture"
                    title={b.description || 'Banner Video'}
                />
                {/* 3. 클릭 차단 + 약간의 다크 그라데이션 */}
                <div className="absolute inset-0 z-20 bg-gradient-to-b from-black/10 via-transparent to-black/30" />
            </div>
        );
    } else {
        // 🔥 [수정] 무거운 원본 <img> 태그 대신 Next.js <Image> 컴포넌트 적용 (자동 압축, 리사이징, 최우선 로딩)
        return (
            <Image 
                src={url} 
                alt={b.description || 'Banner'} 
                fill // 부모 요소를 꽉 채우도록 설정 (기존 w-full h-full 대체)
                priority // 최상단 배너이므로 브라우저가 최우선으로 로딩하도록 강제
                sizes="(max-width: 768px) 100vw, 1200px" // 모바일과 PC 화면에 맞게 최적화된 용량만 다운로드
                className="object-cover opacity-60" 
            />
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