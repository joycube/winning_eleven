/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['undici'],
  // 🔥 Next.js Image 컴포넌트 외부 도메인 허용 화이트리스트
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lootlevelchill.com' }, // 방금 에러난 배너 사이트
      { protocol: 'https', hostname: 'www.konami.com' },     // 코나미 배너
      { protocol: 'https', hostname: 'img.konami.com' },     // 코나미 이미지
      { protocol: 'https', hostname: 'i.ytimg.com' },        // 유튜브 썸네일
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // 구글 프로필 사진
      { protocol: 'https', hostname: 'i.pinimg.com' },       // 핀터레스트 (불타는 베컴)
      { protocol: 'https', hostname: 'stickershop.line-scdn.net' }, // 라인 스티커
      { protocol: 'https', hostname: '**' },                 // 최신 Next.js 버전용 범용 허용
    ],
  },
};

module.exports = nextConfig;