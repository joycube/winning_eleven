// app/api/football/route.ts
// 🔒 [Critical 패치 v4] (C3)
//   1) NEXT_PUBLIC_FOOTBALL_API_KEY → FOOTBALL_API_KEY 로 변경 (클라이언트 번들 노출 방지)
//   2) 하드코딩된 date(2026-04-17) 제거 → 오늘 날짜 기반 동적 계산
//   3) season 도 오늘 날짜 기반으로 계산 (유럽 시즌은 8월부터 다음해 5월까지)
import { NextResponse } from 'next/server';

// 캐싱 동작 명시 (1분마다 갱신)
export const revalidate = 60;

/**
 * 유럽 축구 시즌 계산 (1~7월: 전년도 시즌 / 8~12월: 당해 시즌)
 * 예) 2026-04-17 → season=2025 (2025/26 시즌)
 *     2026-09-01 → season=2026 (2026/27 시즌)
 */
function getCurrentSeason(date: Date): number {
  const month = date.getMonth() + 1; // 1~12
  const year = date.getFullYear();
  return month >= 8 ? year : year - 1;
}

function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueId = searchParams.get('league') || '39'; // 기본 EPL (39)

  // 🔥 동적 날짜/시즌 계산 (요청 시 파라미터로 덮어쓸 수도 있음)
  const now = new Date();
  const date = searchParams.get('date') || formatDateYYYYMMDD(now);
  const season = searchParams.get('season') || String(getCurrentSeason(now));

  // 🔒 API 키 누락 시 즉시 500 (silent fail 방지)
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'FOOTBALL_API_KEY 환경변수가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${leagueId}&season=${season}&date=${date}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
        'x-rapidapi-key': apiKey, // ✅ 서버 전용 환경변수 (NEXT_PUBLIC_ 제거됨)
      },
      next: { revalidate: 60 }, // 1분마다 캐시 갱신
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
