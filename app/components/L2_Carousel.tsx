"use client";

import React, { useState, useEffect, useCallback } from 'react';

interface L2_CarouselProps<T> {
  items: T[];
  renderItem: (item: T, idx: number) => React.ReactNode;
  /** auto-slide interval (ms). 0 또는 음수면 OFF. 기본 5000 */
  autoSlideMs?: number;
  /** active dot/ring 색상 클래스 (예: 'bg-emerald-400') */
  dotColor?: string;
  /** chevron 표시 (default: true on sm+) */
  showChevron?: boolean;
  /** 상단 인디케이터 dots 표시 */
  showDots?: boolean;
  /** 하단 thumbnail nav 렌더 (옵션) */
  renderThumbnail?: (item: T, idx: number, isActive: boolean) => React.ReactNode;
  /** 빈 상태 노드 */
  emptyState?: React.ReactNode;
  className?: string;
  /** 상단에 표시할 헤더 — 좌측 (제목 노드) / 우측은 인디케이터로 들어감 */
  headerLeft?: React.ReactNode;
}

/**
 * 🛠️ [L2 공통] 캐러셀
 *  - 자동 슬라이드 5초 (hover/touch 시 일시정지)
 *  - 좌우 chevron (PC 전용)
 *  - 상단 인디케이터 dots (active는 막대형)
 *  - 옵션: 하단 썸네일 nav
 *  - items.length === 0 → emptyState
 *  - items.length === 1 → 단일 노출 (인디케이터/chevron 숨김)
 */
export function L2_Carousel<T>({
  items,
  renderItem,
  autoSlideMs = 5000,
  dotColor = 'bg-emerald-400',
  showChevron = true,
  showDots = true,
  renderThumbnail,
  emptyState,
  className = '',
  headerLeft,
}: L2_CarouselProps<T>) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const n = items.length;

  // index 가 범위 밖이면 보정 (items 변동 시)
  useEffect(() => {
    if (currentIdx >= n && n > 0) setCurrentIdx(0);
  }, [n, currentIdx]);

  const goPrev = useCallback(() => {
    setCurrentIdx(i => (i - 1 + n) % n);
  }, [n]);
  const goNext = useCallback(() => {
    setCurrentIdx(i => (i + 1) % n);
  }, [n]);
  const goTo = useCallback((idx: number) => setCurrentIdx(idx), []);

  // 자동 슬라이드
  useEffect(() => {
    if (n <= 1 || autoSlideMs <= 0 || isPaused) return;
    const timer = setInterval(() => {
      setCurrentIdx(i => (i + 1) % n);
    }, autoSlideMs);
    return () => clearInterval(timer);
  }, [n, autoSlideMs, isPaused]);

  if (n === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <div className={`relative ${className}`}>
      {/* 상단 헤더: 좌측 (제목) + 우측 (인디케이터) */}
      {(headerLeft || (showDots && n > 1)) && (
        <div className="flex items-center justify-between mb-2.5">
          <div className="min-w-0">{headerLeft}</div>
          {showDots && n > 1 && (
            <div className="flex gap-1.5 items-center shrink-0 ml-2">
              {items.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goTo(idx)}
                  className={`transition-all rounded-full ${
                    idx === currentIdx ? `${dotColor} w-4 h-1.5` : 'bg-slate-700 w-1.5 h-1.5'
                  }`}
                  aria-label={`${idx + 1}번째 슬라이드로 이동`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 메인 컨텐츠 */}
      <div
        className="relative overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentIdx * 100}%)` }}
        >
          {items.map((item, idx) => (
            <div key={idx} className="w-full shrink-0">
              {renderItem(item, idx)}
            </div>
          ))}
        </div>

        {/* Chevron — n > 1 일 때만, PC 전용 */}
        {showChevron && n > 1 && (
          <>
            <button
              onClick={goPrev}
              className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900/85 border border-slate-700 items-center justify-center text-white text-base backdrop-blur-sm hover:bg-slate-800 hover:border-slate-500 transition z-10"
              aria-label="이전"
            >
              ‹
            </button>
            <button
              onClick={goNext}
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900/85 border border-slate-700 items-center justify-center text-white text-base backdrop-blur-sm hover:bg-slate-800 hover:border-slate-500 transition z-10"
              aria-label="다음"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* 하단 썸네일 nav */}
      {renderThumbnail && n > 1 && (
        <div
          className="grid gap-1.5 mt-2.5"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              className={`transition-all rounded-md overflow-hidden ${
                idx === currentIdx ? 'ring-2 ring-emerald-400' : 'opacity-55 hover:opacity-100'
              }`}
            >
              {renderThumbnail(item, idx, idx === currentIdx)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
