import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueId = searchParams.get('league') || '39'; // 기본 EPL (39)
  
  // 💡 실시간 스코어(live) 또는 오늘 일정 파라미터 처리 가능
  const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${leagueId}&season=2025&date=2026-04-17`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
        'x-rapidapi-key': process.env.NEXT_PUBLIC_FOOTBALL_API_KEY || '', // .env 파일에 저장하세요
      },
      next: { revalidate: 60 } // 1분마다 캐시 갱신
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}