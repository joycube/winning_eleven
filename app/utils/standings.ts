// 🛠️ [순위 단일 소스] 조별리그 순위 정렬 유틸.
//   정렬 기준: 승점 → 골득실 → 승자승(head-to-head) → 득점.
//   순위표(R_StandingsTab)·메인랭킹(RankingView)·토너먼트 시드(AdminCupSetup)가 동일 로직을 공유한다.

const norm = (s: any) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, '');

export type H2HMap = Record<string, Record<string, { pts: number; gd: number; gf: number }>>;

// 매치 목록으로 맞대결(head-to-head) 집계 맵 생성
export function buildHeadToHead(matches: any[]): H2HMap {
  const map: H2HMap = {};
  const ensure = (a: string, b: string) => { if (!map[a]) map[a] = {}; if (!map[a][b]) map[a][b] = { pts: 0, gd: 0, gf: 0 }; };
  (matches || []).forEach((m: any) => {
    if (!m || m.status !== 'COMPLETED') return;
    if ([m.home, m.away].some((x: any) => !x || x === 'BYE' || x === 'TBD')) return;
    const h = norm(m.home), a = norm(m.away), hs = Number(m.homeScore || 0), as = Number(m.awayScore || 0);
    ensure(h, a); ensure(a, h);
    map[h][a].gf += hs; map[h][a].gd += (hs - as);
    map[a][h].gf += as; map[a][h].gd += (as - hs);
    if (hs > as) map[h][a].pts += 3; else if (as > hs) map[a][h].pts += 3; else { map[h][a].pts++; map[a][h].pts++; }
  });
  return map;
}

// 두 팀의 승자승 비교 (음수면 a 우선). 맞대결 없으면 0.
export function compareHeadToHead(a: any, b: any, h2h: H2HMap): number {
  const na = norm(a.name || a.teamName), nb = norm(b.name || b.teamName);
  const ab = h2h[na]?.[nb]; const ba = h2h[nb]?.[na];
  if (!ab || !ba) return 0;
  if (ab.pts !== ba.pts) return ba.pts - ab.pts;
  if (ab.gd !== ba.gd) return ba.gd - ab.gd;
  return (ba.gf || 0) - (ab.gf || 0);
}

// 순위 정렬 + rank 부여. 완전 동률(승점·골득실·승자승·득점)일 때만 동순위.
export function rankGroupTeams<T extends { name?: string; teamName?: string; points: number; gd: number; gf?: number }>(
  teams: T[], matches: any[]
): (T & { rank: number })[] {
  const h2h = buildHeadToHead(matches);
  const sorted = [...(teams || [])].sort((a: any, b: any) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    const h = compareHeadToHead(a, b, h2h);
    if (h !== 0) return h;
    return (b.gf || 0) - (a.gf || 0);
  });
  const ranked: (T & { rank: number })[] = [];
  sorted.forEach((t: any, i) => {
    let rank = i + 1;
    if (i > 0) {
      const p: any = ranked[i - 1];
      if (t.points === p.points && t.gd === p.gd && compareHeadToHead(t, p, h2h) === 0 && (t.gf || 0) === (p.gf || 0)) {
        rank = p.rank;
      }
    }
    ranked.push({ ...t, rank });
  });
  return ranked;
}
