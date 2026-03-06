/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['undici'],
  // 🔥 외부 도메인 이미지 허용 화이트리스트
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

module.exports = nextConfig;