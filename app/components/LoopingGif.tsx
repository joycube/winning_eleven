"use client";

import React, { useEffect, useState } from 'react';

interface Props {
  src?: string;
  alt?: string;
  className?: string;
  onError?: (e: any) => void;
  /** GIF 재시작 주기(ms). 기본 3000 */
  loopMs?: number;
}

/**
 * 🛠️ [v2.5] GIF 강제 무한 반복.
 *   일부 프로필 GIF 는 파일 자체가 "1회 재생(loop=1)"으로 인코딩돼 브라우저가 한 번만 돌리고 멈춤.
 *   브라우저엔 루프 횟수를 바꾸는 표준 API 가 없으므로, key 를 주기적으로 바꿔 <img> 를 remount → 처음부터 재생.
 *   - 같은 src 라 캐시에서 즉시 재생(네트워크 재요청 없음)
 *   - GIF(확장자 .gif)가 아니면 일반 <img> 로 렌더(타이머 없음, remount 없음)
 */
export const LoopingGif = ({ src, alt = '', className, onError, loopMs = 3000 }: Props) => {
  const isGif = typeof src === 'string' && /\.gif(\?|#|$)/i.test(src);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isGif) return;
    // 여러 아바타가 동시에 remount 돼 깜빡이지 않도록 시작 시점을 분산(stagger)
    let interval: ReturnType<typeof setInterval> | undefined;
    const startDelay = Math.random() * loopMs;
    const start = setTimeout(() => {
      setTick((t) => t + 1);
      interval = setInterval(() => setTick((t) => t + 1), loopMs);
    }, startDelay);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [isGif, loopMs]);

  return (
    <img
      key={isGif ? tick : 'static'}
      src={src}
      alt={alt}
      className={className}
      onError={onError}
    />
  );
};

export default LoopingGif;
