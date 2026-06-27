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
 *   브라우저엔 루프 횟수를 바꾸는 표준 API 가 없으므로, 주기적으로 src 에 캐시버스트 쿼리(_gifloop=N)를
 *   붙여 "새 리소스"로 만들어 프레임0부터 다시 디코딩/재생시킨다.
 *   - src 만 바꾸므로 새 이미지가 로드될 때까지 이전 프레임이 유지됨 → 깜빡임(빈 화면) 최소화
 *   - GIF(확장자 .gif)가 아니면 캐시버스트 없이 원본 그대로 렌더(타이머 없음)
 *   - 여러 아바타가 동시에 재시작하지 않도록 시작 시점을 분산(stagger)
 */
export const LoopingGif = ({ src, alt = '', className, onError, loopMs = 3000 }: Props) => {
  const isGif = typeof src === 'string' && /\.gif(\?|#|$)/i.test(src);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!isGif) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const startDelay = Math.random() * loopMs; // 동시 깜빡임 방지
    const start = setTimeout(() => {
      setCycle((c) => c + 1);
      interval = setInterval(() => setCycle((c) => c + 1), loopMs);
    }, startDelay);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [isGif, loopMs]);

  const finalSrc =
    isGif && cycle > 0 && src
      ? `${src}${src.includes('?') ? '&' : '?'}_gifloop=${cycle}`
      : src;

  return <img src={finalSrc} alt={alt} className={className} onError={onError} />;
};

export default LoopingGif;
