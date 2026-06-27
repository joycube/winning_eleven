"use client";

import React, { useEffect, useState } from 'react';

interface Props {
  src?: string;
  alt?: string;
  className?: string;
  onError?: (e: any) => void;
  /** (폴백 전용) 캐시버스트 재시작 주기(ms). 기본 3000 */
  loopMs?: number;
}

/**
 * 🛠️ [v2.5] GIF 강제 무한 반복.
 *   1순위(끊김 없음): GIF 바이너리의 NETSCAPE 루프 카운트를 무한(0)으로 패치 → 브라우저가 네이티브로 매끄럽게 반복.
 *     - GIF 를 fetch 해서 바이트를 고친 뒤 메모리 blob URL 로 표시 (CORS 허용 호스트에서 동작)
 *   2순위(폴백): fetch/패치 실패(CORS 등) 시, 주기적으로 src 에 캐시버스트 쿼리를 붙여 재시작.
 *   GIF(.gif)가 아니면 원본 그대로 렌더(타이머/fetch 없음).
 */

// GIF 의 루프 카운트를 무한(0)으로 만든 새 바이트를 반환. 실패 시 null.
function forceInfiniteLoopGif(bytes: Uint8Array): Uint8Array | null {
  try {
    if (bytes.length < 14) return null;
    if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46) return null; // 'GIF'
    const packed = bytes[10];
    const gctSize = (packed & 0x80) ? 3 * (1 << ((packed & 0x07) + 1)) : 0;
    const pos = 13 + gctSize; // 6(header)+7(LSD)+GCT
    const ns = [0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30]; // "NETSCAPE2.0"
    for (let i = pos; i <= bytes.length - 19; i++) {
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xff && bytes[i + 2] === 0x0b) {
        let match = true;
        for (let j = 0; j < 11; j++) { if (bytes[i + 3 + j] !== ns[j]) { match = false; break; } }
        if (match && bytes[i + 14] === 0x03 && bytes[i + 15] === 0x01) {
          if (bytes[i + 16] === 0 && bytes[i + 17] === 0) return bytes; // 이미 무한
          const out = bytes.slice();
          out[i + 16] = 0; out[i + 17] = 0; // 루프 카운트 = 0(무한)
          return out;
        }
      }
    }
    // NETSCAPE 확장이 없으면(=대개 1회 재생) GCT 직후에 무한 루프 블록 삽입
    const block = new Uint8Array([
      0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30,
      0x03, 0x01, 0x00, 0x00, 0x00,
    ]);
    const out = new Uint8Array(bytes.length + block.length);
    out.set(bytes.subarray(0, pos), 0);
    out.set(block, pos);
    out.set(bytes.subarray(pos), pos + block.length);
    return out;
  } catch {
    return null;
  }
}

export const LoopingGif = ({ src, alt = '', className, onError, loopMs = 3000 }: Props) => {
  const isGif = typeof src === 'string' && /\.gif(\?|#|$)/i.test(src);
  const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined);
  const [cycle, setCycle] = useState(0);
  const blobReady = !!blobUrl;

  // 1순위: 루프 카운트를 무한으로 패치한 blob 생성
  useEffect(() => {
    setBlobUrl(undefined);
    if (!isGif || !src) return;
    let cancelled = false;
    let created: string | undefined;
    fetch(src)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        if (cancelled) return;
        const patched = forceInfiniteLoopGif(new Uint8Array(buf));
        if (!patched) return; // 실패 → 폴백(캐시버스트)
        created = URL.createObjectURL(new Blob([patched], { type: 'image/gif' }));
        setBlobUrl(created);
      })
      .catch(() => { /* CORS 등 → 폴백 */ });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [src, isGif]);

  // 2순위 폴백: blob 이 없을 때만 캐시버스트로 주기 재시작
  useEffect(() => {
    if (!isGif || blobReady) return;
    const delay = Math.random() * loopMs; // 동시 깜빡임 방지
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      setCycle((c) => c + 1);
      interval = setInterval(() => setCycle((c) => c + 1), loopMs);
    }, delay);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [isGif, blobReady, loopMs]);

  let finalSrc = src;
  if (blobUrl) finalSrc = blobUrl;
  else if (isGif && cycle > 0 && src) finalSrc = `${src}${src.includes('?') ? '&' : '?'}_gifloop=${cycle}`;

  return <img src={finalSrc} alt={alt} className={className} onError={onError} />;
};

export default LoopingGif;
