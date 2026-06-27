import { NextRequest } from 'next/server';

// 🛠️ [v2.5] GIF 무한 반복 프록시.
//   외부 GIF 를 서버에서 받아(브라우저 CORS 제약 없음) NETSCAPE 루프 카운트를 무한(0)으로 패치해 돌려준다.
//   브라우저는 같은 출처(/api/loopgif)에서 받으므로 네이티브로 매끄럽게 무한 반복 → 타이머/끊김 없음.
//   실패하거나 GIF 가 아니면 원본 URL 로 리다이렉트(최소한 표시는 됨).

export const runtime = 'nodejs';

// GIF 바이트의 루프 카운트를 무한(0)으로. 실패 시 null.
function forceInfiniteLoopGif(bytes: Uint8Array): Uint8Array | null {
  try {
    if (bytes.length < 14) return null;
    if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46) return null; // 'GIF'
    const packed = bytes[10];
    const gctSize = (packed & 0x80) ? 3 * (1 << ((packed & 0x07) + 1)) : 0;
    const pos = 13 + gctSize;
    const ns = [0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30]; // "NETSCAPE2.0"
    for (let i = pos; i <= bytes.length - 19; i++) {
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xff && bytes[i + 2] === 0x0b) {
        let match = true;
        for (let j = 0; j < 11; j++) { if (bytes[i + 3 + j] !== ns[j]) { match = false; break; } }
        if (match && bytes[i + 14] === 0x03 && bytes[i + 15] === 0x01) {
          if (bytes[i + 16] === 0 && bytes[i + 17] === 0) return bytes;
          const out = bytes.slice();
          out[i + 16] = 0; out[i + 17] = 0;
          return out;
        }
      }
    }
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

// 간단한 SSRF 방지: https 만 허용 + 사설/로컬 호스트 차단
function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return false;
    if (/^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') || '';
  if (!isSafeUrl(url)) return new Response('bad url', { status: 400 });
  try {
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) return Response.redirect(url, 302);
    const ct = r.headers.get('content-type') || '';
    const buf = new Uint8Array(await r.arrayBuffer());
    const isGif = ct.includes('gif') || (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46);
    if (!isGif) return Response.redirect(url, 302); // GIF 아니면 원본으로
    const out = forceInfiniteLoopGif(buf) || buf;
    return new Response(Buffer.from(out), {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch {
    return Response.redirect(url, 302); // 실패 시 원본 표시
  }
}
