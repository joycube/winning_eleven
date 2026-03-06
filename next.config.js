/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['undici'],
  // 🔥 [이미지 최적화 설정 추가] 외부 도메인에서 가져오는 이미지를 Next.js 서버가 압축할 수 있도록 허용
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // 모든 https 이미지 허용
      },
      {
        protocol: 'http',
        hostname: '**', // 모든 http 이미지 허용
      },
    ],
  },
};
module.exports = nextConfig;