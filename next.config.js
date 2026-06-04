// 🔒 [Day 1 — Next.js 14.2.30 보안 업그레이드]
//   CVE-2024-34351 (SSRF), CVE-2024-46982 (캐시 포이즈닝),
//   CVE-2025-29927 (미들웨어 인증우회), CVE-2024-47831 (이미지 최적화 DoS) 패치
//
// 주요 변경:
//   1) next 13.5.1 → 14.2.30
//   2) react/react-dom 18.2.0 → 18.3.1
//   3) eslint 8.49.0 → 8.57.1, eslint-config-next 14.2.30
//   4) typescript 5.2.2 → 5.4.5
//   5) undici 강제 pin 제거 — Next 14 는 내장 undici 안정화
//   6) transpilePackages: ['undici'] 제거 (불필요)
//
// 🛡️ 다음 작업 권고 (Day 6에서 진행 예정):
//   - images.remotePatterns 의 와일드카드('**') 제거 — SSRF 위험

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  // 개발(로컬) 환경에서는 PWA 캐싱을 꺼서 코드 수정이 바로바로 보이게 합니다.
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 🔥 [Day 1 변경] Next 14 부터 undici 호환 이슈 해결되어 transpilePackages 제거
  // 🔥 외부 도메인 이미지 허용 화이트리스트 (구단주님 기존 설정 유지)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lootlevelchill.com' }, // 에러가 발생한 배너 사이트
      { protocol: 'https', hostname: 'www.konami.com' },     // 코나미
      { protocol: 'https', hostname: 'img.konami.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },        // 유튜브 썸네일
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // 구글 프로필
      { protocol: 'https', hostname: 'i.pinimg.com' },
      { protocol: 'https', hostname: 'stickershop.line-scdn.net' },
      // ⚠️ [Day 6 작업 예정] 와일드카드는 SSRF 위험 — 추후 명시적 도메인만 허용으로 좁힐 것
      { protocol: 'https', hostname: '**' },                 // 와일드카드
    ],
  },
};

// 🔥 기존 nextConfig를 PWA 설정으로 감싸서 내보냅니다.
module.exports = withPWA(nextConfig);
