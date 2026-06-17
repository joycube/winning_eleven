/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

// 🛠️ [v3.4] 노출 시간
const IMAGE_DURATION_MS = 5000;   // 이미지 5초
const VIDEO_DURATION_MS = 20000;  // 영상 최소 20초

export const BannerSlider = ({ banners }: BannerSliderProps) => {
  const [bannerIdx, setBannerIdx] = useState<number>(0);
  const [isBannerInitialized, setIsBannerInitialized] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  // 🛠️ [v3.5] 로드 실패 누적 — 한 번 깨진 배너는 풀에서 영구 제외
  const [failedSet, setFailedSet] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 🛠️ [v3.6] 셔플 사이클용 — 타입별 "이미 본 인덱스" 기억
  //   해당 타입의 모든 배너를 한 사이클에 한 번씩 노출 후에만 다시 풀로 복귀
  const seenImagesRef = useRef<Set<number>>(new Set());
  const seenVideosRef = useRef<Set<number>>(new Set());

  const sortedBannersDisplay = useMemo(() => {
      if (!banners) return [];
      return [...banners];
  }, [banners]);

  // 🛠️ [v3.4] 배너 타입별 인덱스 풀 (실패한 배너 제외)
  const { imageIndices, videoIndices } = useMemo(() => {
      const imgs: number[] = [];
      const vids: number[] = [];
      sortedBannersDisplay.forEach((b, i) => {
          if (failedSet.has(i)) return;
          if (getYouTubeId(b.url)) vids.push(i);
          else imgs.push(i);
      });
      return { imageIndices: imgs, videoIndices: vids };
  }, [sortedBannersDisplay, failedSet]);

  // 🛠️ [v3.6] 다음 인덱스 선택 — 교차 + 셔플 사이클
  //   1) 우선 반대 타입 풀에서 픽 (이미지↔영상 교차 보장)
  //   2) 같은 타입 안에서는 "이미 본 인덱스" 를 제외한 미경험 풀에서 랜덤
  //   3) 해당 타입 모두 한 번씩 본 뒤에만 seen 셋 리셋 → 처음부터 다시
  //   4) 반대 타입이 0개일 때만 같은 타입으로 폴백 (안전망)
  const pickNextIdx = useCallback((fromIdx: number): number => {
      if (sortedBannersDisplay.length === 0) return 0;
      if (sortedBannersDisplay.length === 1) return 0;

      const currentIsVideo = !!getYouTubeId(sortedBannersDisplay[fromIdx]?.url);
      const targetPool = currentIsVideo ? imageIndices : videoIndices;
      const fallbackPool = currentIsVideo ? videoIndices : imageIndices;
      const targetSeen = currentIsVideo ? seenImagesRef : seenVideosRef;
      const fallbackSeen = currentIsVideo ? seenVideosRef : seenImagesRef;

      // 1) 반대 타입에서 미경험 항목으로 픽 (교차 + 셔플)
      if (targetPool.length > 0) {
          let unseen = targetPool.filter(i => !targetSeen.current.has(i));
          if (unseen.length === 0) {
              // 해당 타입 모두 봤음 → 사이클 리셋, fromIdx 만 제외해서 즉시 같은 게 다시 안 뜨게
              targetSeen.current.clear();
              unseen = targetPool.filter(i => i !== fromIdx);
              if (unseen.length === 0) unseen = targetPool;
          }
          const next = unseen[Math.floor(Math.random() * unseen.length)];
          targetSeen.current.add(next);
          return next;
      }

      // 2) 반대 타입이 비어 있을 때만 같은 타입으로 폴백 (예: 영상 0개)
      if (fallbackPool.length === 0) return fromIdx;
      let unseen = fallbackPool.filter(i => !fallbackSeen.current.has(i) && i !== fromIdx);
      if (unseen.length === 0) {
          fallbackSeen.current.clear();
          unseen = fallbackPool.filter(i => i !== fromIdx);
          if (unseen.length === 0) unseen = fallbackPool;
      }
      const next = unseen[Math.floor(Math.random() * unseen.length)];
      fallbackSeen.current.add(next);
      return next;
  }, [sortedBannersDisplay, imageIndices, videoIndices]);

  // 🛠️ [v3.5] 로드 실패 핸들러 — failedSet 에 추가 + 현재 노출 중이면 즉시 다음으로
  const handleBannerError = useCallback((failedIdx: number) => {
      setFailedSet(prev => {
          if (prev.has(failedIdx)) return prev;
          const next = new Set(prev);
          next.add(failedIdx);
          return next;
      });
      console.warn(`[BannerSlider] 배너 #${failedIdx} 로드 실패 — 다음으로 자동 스킵`);
      // 현재 보고 있는 배너가 실패한 경우 즉시 다음으로 (타이머 대기 안 함)
      setBannerIdx(prev => prev === failedIdx ? pickNextIdx(prev) : prev);
      if (timerRef.current) clearTimeout(timerRef.current);
  }, [pickNextIdx]);

  const goNext = useCallback(() => {
      setBannerIdx(prev => pickNextIdx(prev));
  }, [pickNextIdx]);

  const goPrev = useCallback(() => {
      // 이전도 같은 규칙 (교차) — 진정한 history 가 아니라 "이전 타입에서 새 랜덤" 의미
      setBannerIdx(prev => pickNextIdx(prev));
  }, [pickNextIdx]);

  // 🛠️ [v3.4] 초기 진입 — 무조건 이미지 풀에서 랜덤
  //   이미지가 0개면 영상 풀에서 랜덤 (안전 폴백)
  //   v3.6: 시작 인덱스를 seen 셋에 등록 → 사이클 처음부터 정상 동작
  useEffect(() => {
      if (sortedBannersDisplay.length === 0 || isBannerInitialized) return;

      const useImagePool = imageIndices.length > 0;
      const pool = useImagePool ? imageIndices : videoIndices;
      if (pool.length === 0) {
          setBannerIdx(0);
      } else {
          const startIdx = pool[Math.floor(Math.random() * pool.length)];
          setBannerIdx(startIdx);
          (useImagePool ? seenImagesRef : seenVideosRef).current.add(startIdx);
      }
      setIsBannerInitialized(true);
  }, [sortedBannersDisplay, imageIndices, videoIndices, isBannerInitialized]);

  // 🛠️ [v3.4] 자동 전환 타이머
  useEffect(() => {
      if (!isBannerInitialized || sortedBannersDisplay.length < 2) return;
      const currentBanner = sortedBannersDisplay[bannerIdx];
      if (!currentBanner) return;
      const isVideo = !!getYouTubeId(currentBanner.url);
      const delay = isVideo ? VIDEO_DURATION_MS : IMAGE_DURATION_MS;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(goNext, delay);

      return () => {
          if (timerRef.current) clearTimeout(timerRef.current);
      };
  }, [bannerIdx, isBannerInitialized, sortedBannersDisplay, goNext]);

  // 수동 네비게이션 (꺽쇠 / 스와이프) — 타이머 리셋
  const handleNavigate = useCallback((dir: 'prev' | 'next') => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (dir === 'next') goNext();
      else goPrev();
  }, [goNext, goPrev]);

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const handleTouchEnd = () => {
      if (!touchStart || !touchEnd) return;
      const dist = touchStart - touchEnd;
      if (dist > 50) handleNavigate('next');
      if (dist < -50) handleNavigate('prev');
      setTouchStart(0); setTouchEnd(0);
  };

  const renderBannerContent = (b: Banner, idx: number) => {
    const url = b.url || '';
    const vId = getYouTubeId(url);

    if (vId) {
        const embedUrl = `https://www.youtube.com/embed/${vId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${vId}&playsinline=1&enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`;
        const thumbUrl = `https://img.youtube.com/vi/${vId}/maxresdefault.jpg`;

        return (
            <div className="w-full h-full bg-black relative overflow-hidden">
                <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-cover bg-center scale-125 blur-2xl opacity-70"
                    style={{ backgroundImage: `url(${thumbUrl})` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                    <iframe
                        src={embedUrl}
                        className="block w-full sm:w-auto sm:h-full pointer-events-none shadow-2xl"
                        style={{ aspectRatio: '16/9' }}
                        allow="autoplay; encrypted-media; gyroscope; picture-in-picture"
                        title={b.description || 'Banner Video'}
                    />
                </div>
                <div className="absolute inset-0 z-20 bg-gradient-to-b from-black/30 via-transparent to-black/30" />
                {/* 🛠️ [v3.5] 비디오 썸네일 사전 검증 — 썸네일조차 못 불러오는 영상이면 영상도 안 뜸 → 실패 처리 */}
                <img
                    src={thumbUrl}
                    alt=""
                    aria-hidden
                    style={{ display: 'none' }}
                    onError={() => handleBannerError(idx)}
                />
            </div>
        );
    } else {
        return (
            <div className="w-full h-full bg-black relative overflow-hidden">
                <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-cover bg-center scale-125 blur-2xl opacity-70"
                    style={{ backgroundImage: `url(${url})` }}
                />
                <Image
                    src={url}
                    alt={b.description || 'Banner'}
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, 1200px"
                    className="object-cover sm:object-contain"
                    onError={() => handleBannerError(idx)}
                    unoptimized={url.startsWith('data:') || url.startsWith('blob:')}
                />
                <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/30 via-transparent to-black/30 pointer-events-none" />
            </div>
        );
    }
  };

  // 🛠️ [v3.4] 인디케이터용 — 점은 최대 8개 노출 (그 이상은 카운터만)
  const MAX_DOTS = 8;
  const totalBanners = sortedBannersDisplay.length;

  return (
    <div
        className="group w-full h-[225px] md:h-[330px] relative border-b border-slate-800 shadow-2xl overflow-hidden bg-black"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
        {totalBanners > 0 ? sortedBannersDisplay.map((b, i) => (
            <div key={b.id || i} className={`absolute inset-0 transition-opacity duration-1000 ${i === bannerIdx ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                {!failedSet.has(i) && renderBannerContent(b, i)}
            </div>
        )) : null}

        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent z-10 pointer-events-none" />

        {/* 🛠️ [v3.4] 좌우 꺽쇠 — 모바일 상시 / 데스크탑 hover 시에만 (sm: 이상 group-hover) */}
        {totalBanners > 1 && (
            <>
                <button
                    onClick={() => handleNavigate('prev')}
                    aria-label="이전 배너"
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/55 hover:bg-black/85 border border-slate-600/50 hover:border-slate-400 backdrop-blur-sm flex items-center justify-center text-white transition-all active:scale-95 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                >
                    <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
                <button
                    onClick={() => handleNavigate('next')}
                    aria-label="다음 배너"
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/55 hover:bg-black/85 border border-slate-600/50 hover:border-slate-400 backdrop-blur-sm flex items-center justify-center text-white transition-all active:scale-95 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                >
                    <ChevronRight size={18} strokeWidth={2.5} />
                </button>
            </>
        )}

        {/* 🛠️ [v3.4] 하단 인디케이터 — 점 + 카운터 */}
        {totalBanners > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-black/45 backdrop-blur-sm rounded-full px-3 py-1.5 border border-slate-700/50">
                {totalBanners <= MAX_DOTS ? (
                    <div className="flex items-center gap-1.5">
                        {sortedBannersDisplay.map((_, i) => (
                            <span
                                key={i}
                                className={`block transition-all rounded-full ${
                                    i === bannerIdx
                                        ? 'w-4 h-1.5 bg-white'
                                        : 'w-1.5 h-1.5 bg-slate-500'
                                }`}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5">
                        {Array.from({ length: MAX_DOTS }).map((_, i) => {
                            const isActive = Math.floor((bannerIdx / totalBanners) * MAX_DOTS) === i;
                            return (
                                <span
                                    key={i}
                                    className={`block transition-all rounded-full ${
                                        isActive ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-slate-500'
                                    }`}
                                />
                            );
                        })}
                    </div>
                )}
                <span className="text-[10px] font-bold text-slate-300 tabular-nums">
                    {bannerIdx + 1} / {totalBanners}
                </span>
            </div>
        )}

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
