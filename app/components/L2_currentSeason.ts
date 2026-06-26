import { Season } from '../types';

/**
 * 🛠️ [L2 공통] "현재 진행 시즌" 해석 — Hero/Ranking/TopScorers 가 동일 시즌을 가리키도록 단일화.
 *   우선순위: 진행 중(ACTIVE/IN_PROGRESS/OPEN) → 미완료 중 최신 → id 최대(가장 최근 생성).
 */
export const resolveCurrentSeason = (seasons: Season[]): Season | null => {
  const activeStatuses = ['ACTIVE', 'IN_PROGRESS', 'OPEN'];
  const sorted = [...(seasons || [])].sort((a: any, b: any) => a.id - b.id);
  const s =
    sorted.find((x: any) => activeStatuses.includes(String(x.status || '').toUpperCase())) ||
    sorted.filter((x: any) => x.status !== 'COMPLETED').slice(-1)[0] ||
    sorted.slice(-1)[0];
  return s || null;
};

export const resolveCurrentSeasonId = (seasons: Season[]): number =>
  resolveCurrentSeason(seasons)?.id ?? 0;
