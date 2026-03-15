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
  transpilePackages: ['undici'],
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
      { protocol: 'https', hostname: '**' },                 // 와일드카드
    ],
  },
};

// 🔥 기존 nextConfig를 PWA 설정으로 감싸서 내보냅니다.
module.exports = withPWA(nextConfig);