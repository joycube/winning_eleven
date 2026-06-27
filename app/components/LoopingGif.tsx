"use client";

import React from 'react';

interface Props {
  src?: string;
  alt?: string;
  className?: string;
  onError?: (e: any) => void;
}

/**
 * 🛠️ [v2.5] GIF 강제 무한 반복.
 *   외부 GIF(.gif http(s) URL)는 서버 프록시(/api/loopgif)를 거쳐 받는다.
 *   프록시가 GIF 의 루프 카운트를 무한(0)으로 패치해 돌려주므로, 브라우저가 네이티브로
 *   끊김 없이 무한 반복한다(타이머·재요청 없음). GIF 가 아니거나 외부 http(s) 가 아니면 원본 그대로.
 */
export const LoopingGif = ({ src, alt = '', className, onError }: Props) => {
  const isRemoteGif =
    typeof src === 'string' && /^https?:\/\//i.test(src) && /\.gif(\?|#|$)/i.test(src);
  const finalSrc = isRemoteGif ? `/api/loopgif?url=${encodeURIComponent(src!)}` : src;

  return <img src={finalSrc} alt={alt} className={className} onError={onError} />;
};

export default LoopingGif;
