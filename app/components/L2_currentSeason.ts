import { Season } from '../types';

/**
 * 🛠️ [L2 공통] "현재 진행 시즌" 해석 — Hero/Ranking/TopScorers 가 동일 시즌을 가리키도록 단일화.
 *   정책: "가장 최신 시즌". id 는 생성 타임스탬프라 클수록 최신.
 *   - 완료(COMPLETED)되지 않은 시즌 중 id 최대(가장 최근) 우선
 *   - 전부 완료면 전체에서 id 최대
 *   (이전 버전은 'ACTIVE 중 첫 번째'를 골라 활성 시즌이 여러 개일 때 가장 오래된 걸 집는 버그가 있었음)
 */
export const resolveCurrentSeason = (seasons: Season[]): Season | null => {
  const sorted = [...(seasons || [])].sort((a: any, b: any) => a.id - b.id);
  const notCompleted = sorted.filter((x: any) => String(x.status || '').toUpperCase() !== 'COMPLETED');
  return notCompleted.slice(-1)[0] || sorted.slice(-1)[0] || null;
};

export const resolveCurrentSeasonId = (seasons: Season[]): number =>
  resolveCurrentSeason(seasons)?.id ?? 0;
