import { Team, MasterTeam } from '../types';

// =========================================================
// 🛠️ [v3 알고리즘 — 2026.06.12]
//   기존 예측 공식이 과거 누적치 위주라 실제 결과와 잘 안 맞았다는 피드백.
//   가중 평균 4-팩터 모델로 전면 재설계 + 무승부 확률 별도 산출.
//
//   가중치 (사용자 지정 우선순위)
//     ① 승점         40%  — 최근 N경기 한정으로 통계 노이즈 차단
//     ② H2H 상대전적  30%  — 표본 부족시 신뢰도 가중으로 50% 수렴
//     ③ 팀 레이팅     20%  — tier + real_rank
//     ④ 팀 폼        10%  — condition + 최근 5경기 해당 팀 성적
//
//   무승부 산출
//     격차(|H - A|) 기반. 박빙(0%)일수록 32%, 일방(>80%)일수록 12% 수렴.
//     스케일 후 hRate + dRate + aRate = 100 보장.
// =========================================================

// ───────────────────────── 설정 상수 ─────────────────────────
const WEIGHTS = {
  points: 0.40,
  h2h:    0.30,
  rating: 0.20,
  form:   0.10,
};

const RECENT_OWNER_MATCHES = 20;  // 최근 N경기로 승점 통계 한정 (누적 통계 오류 차단)
const RECENT_H2H_MATCHES   = 10;  // 최근 N경기로 H2H 한정
const TEAM_FORM_WINDOW     = 5;   // 팀 폼 최근 매치 윈도우
const H2H_FULL_CONFIDENCE  = 5;   // H2H 표본 N건 이상이면 신뢰도 100%

const TIER_SCORES: Record<string, number> = {
  'S': 10, 'A': 7, 'B': 4, 'C': 1, 'D': 0
};

const CONDITION_BONUS: Record<string, number> = {
  'A': 3, 'B': 1, 'C': 0, 'D': -1, 'E': -3
};

// ───────────────────────── 유틸 ─────────────────────────
const normalize = (name: string) => name ? name.replace(/\s+/g, '').trim().toLowerCase() : '';

const safeNumber = (v: any, fallback = 0) => {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
};

// 매치를 최근순으로 정렬 (matchDate / createdAt / timestamp 중 첫 유효값)
const sortRecent = (matches: any[]) => {
  return [...matches].sort((a, b) => {
    const aTs = safeNumber(a.matchDate ?? a.createdAt ?? a.timestamp);
    const bTs = safeNumber(b.matchDate ?? b.createdAt ?? b.timestamp);
    return bTs - aTs;
  });
};

// ──────────── ① 승점 (Points per Match, 최근 N경기 기준) ────────────
//   - W=3 / D=1 / L=0 → 평균 승점(0~3) 반환
//   - 표본 0 → 중립값 1.5
const getRecentPointsPerMatch = (ownerName: string, historyData: any): number => {
  if (!historyData?.matches || !Array.isArray(historyData.matches)) return 1.5;
  const target = normalize(ownerName);
  if (!target) return 1.5;

  const ownerMatches = historyData.matches.filter((m: any) =>
    normalize(m.homeOwner) === target || normalize(m.awayOwner) === target
  );
  if (ownerMatches.length === 0) return 1.5;

  const recent = sortRecent(ownerMatches).slice(0, RECENT_OWNER_MATCHES);

  let points = 0;
  recent.forEach((m: any) => {
    const isHome = normalize(m.homeOwner) === target;
    const me = safeNumber(isHome ? m.homeScore : m.awayScore);
    const op = safeNumber(isHome ? m.awayScore : m.homeScore);
    if (me > op) points += 3;
    else if (me === op) points += 1;
  });
  return points / recent.length;  // 0 ~ 3
};

// ──────────── ② H2H (최근 N경기 기준, 표본 신뢰도 가중) ────────────
//   - 홈 입장 승률(0~100) + 표본 수 반환
const getRecentH2H = (homeOwner: string, awayOwner: string, historyData: any): { homeRate: number, count: number } => {
  if (!historyData?.matches) return { homeRate: 50, count: 0 };
  const home = normalize(homeOwner);
  const away = normalize(awayOwner);
  if (!home || !away) return { homeRate: 50, count: 0 };

  const all = historyData.matches.filter((m: any) => {
    const h = normalize(m.homeOwner);
    const a = normalize(m.awayOwner);
    return (h === home && a === away) || (h === away && a === home);
  });
  if (all.length === 0) return { homeRate: 50, count: 0 };

  const recent = sortRecent(all).slice(0, RECENT_H2H_MATCHES);

  let homeWins = 0;
  let draws = 0;
  recent.forEach((m: any) => {
    const meIsHome = normalize(m.homeOwner) === home;
    const meScore = safeNumber(meIsHome ? m.homeScore : m.awayScore);
    const opScore = safeNumber(meIsHome ? m.awayScore : m.homeScore);
    if (meScore > opScore) homeWins++;
    else if (meScore === opScore) draws++;
  });
  // 무승부는 0.5승으로 환산
  const winShare = (homeWins + draws * 0.5) / recent.length;
  return { homeRate: winShare * 100, count: recent.length };
};

// ──────────── ③ 팀 레이팅 (tier + real_rank) ────────────
const getTeamRating = (team: Team, masterTeams: MasterTeam[]): number => {
  let score = TIER_SCORES[team.tier] || 0;
  const master = masterTeams.find(m => m.name === team.name);
  if (master?.real_rank && master.real_rank <= 30) {
    // 순위 1위 = +12점, 30위 = 0점 (선형)
    score += Math.max(0, (31 - master.real_rank) * 0.4);
  }
  return score;
};

// ──────────── ④ 팀 폼 (condition + 최근 윈도우 매치 결과) ────────────
const getTeamForm = (teamName: string, masterTeams: MasterTeam[], historyData: any): number => {
  const master = masterTeams.find(m => m.name === teamName);
  const conditionBonus = CONDITION_BONUS[master?.condition || 'C'] || 0;

  let formPoints = TEAM_FORM_WINDOW * 0.5; // 중립값
  if (historyData?.matches) {
    const teamMatches = historyData.matches.filter((m: any) =>
      m.home === teamName || m.away === teamName
    );
    const recent = sortRecent(teamMatches).slice(0, TEAM_FORM_WINDOW);
    if (recent.length > 0) {
      let pts = 0;
      recent.forEach((m: any) => {
        const isHome = m.home === teamName;
        const me = safeNumber(isHome ? m.homeScore : m.awayScore);
        const op = safeNumber(isHome ? m.awayScore : m.homeScore);
        if (me > op) pts += 1;
        else if (me === op) pts += 0.5;
      });
      formPoints = pts;
    }
  }
  // 폼(0~5) + 컨디션 보너스 (음수일 수 있음) → 양수 보장 위해 +5 shift
  return Math.max(0.1, formPoints + conditionBonus + 5);
};

// ──────────── 두 값을 0~100 share 로 정규화 + 차이 증폭 ────────────
//   기본 비율 → 50% 기준 1.6배 스트레치
//   예) home/away=1.5/1.0 → raw 60% → stretched 66% (차이 명확)
//      home/away=2.0/1.0 → raw 67% → stretched 77%
//      home/away=3.0/1.0 → raw 75% → stretched 90% (clamp)
const toShare = (home: number, away: number, stretch = 1.6): number => {
  const total = home + away;
  if (total <= 0) return 50;
  const raw = (home / total) * 100;
  const stretched = 50 + (raw - 50) * stretch;
  return Math.max(2, Math.min(98, stretched));
};

// ──────────── 무승부 산출 ────────────
//   범위를 8~22% 로 축소 (기존 12~32%) — 가운데 회색 영역 너무 두껍지 않게
//   - 격차 0%   → 22% (박빙)
//   - 격차 80%+ → 8% (일방)
const calcDrawRate = (homeWin: number): number => {
  const gap = Math.abs(homeWin - (100 - homeWin));  // 0 ~ 100
  let draw = 22 - gap * 0.175;
  return Math.max(8, Math.min(22, draw));
};

// =========================================================
// [Main] 4-팩터 가중 평균 + 무승부 산출
// =========================================================
export interface PredictionResult {
  hRate: number;
  dRate: number;
  aRate: number;
}

export const getPrediction = (
  homeName: string,
  awayName: string,
  activeRankingData: any,
  historyData: any,
  masterTeams: MasterTeam[] = []
): PredictionResult => {
  // BYE/TBD 매치
  if (!homeName || !awayName || ['BYE', 'TBD'].includes(homeName) || ['BYE', 'TBD'].includes(awayName)) {
    return { hRate: 50, dRate: 0, aRate: 50 };
  }

  const homeTeam = activeRankingData?.teams?.find((t: Team) => t.name === homeName);
  const awayTeam = activeRankingData?.teams?.find((t: Team) => t.name === awayName);

  // 활성 시즌 데이터 없음 → 50/0/50 (디폴트는 무승부 미적용으로 깔끔)
  if (!homeTeam || !awayTeam) return { hRate: 50, dRate: 0, aRate: 50 };

  // ───── ① 승점 (40%) ─────
  const hPts = getRecentPointsPerMatch(homeTeam.ownerName, historyData);
  const aPts = getRecentPointsPerMatch(awayTeam.ownerName, historyData);
  const pointsShare = toShare(hPts, aPts);

  // ───── ② H2H (30%) — 표본 부족시 신뢰도 가중으로 50% 수렴 ─────
  const h2h = getRecentH2H(homeTeam.ownerName, awayTeam.ownerName, historyData);
  const h2hConfidence = Math.min(1, h2h.count / H2H_FULL_CONFIDENCE);
  const h2hShare = h2h.homeRate * h2hConfidence + 50 * (1 - h2hConfidence);

  // ───── ③ 팀 레이팅 (20%) ─────
  const hRat = getTeamRating(homeTeam, masterTeams);
  const aRat = getTeamRating(awayTeam, masterTeams);
  // tier=0인 팀끼리는 모두 0이라 share=50으로 수렴됨 (정상)
  const ratingShare = (hRat + aRat) === 0 ? 50 : toShare(hRat + 1, aRat + 1);

  // ───── ④ 팀 폼 (10%) ─────
  const hForm = getTeamForm(homeTeam.name, masterTeams, historyData);
  const aForm = getTeamForm(awayTeam.name, masterTeams, historyData);
  const formShare = toShare(hForm, aForm);

  // ───── 통합 (가중 평균) ─────
  let homeWinRaw =
    pointsShare * WEIGHTS.points +
    h2hShare    * WEIGHTS.h2h +
    ratingShare * WEIGHTS.rating +
    formShare   * WEIGHTS.form;

  // 🛠️ [v3.1] 신뢰도 보정 — 신호가 강할수록 50% 에서 멀어지도록 한번 더 스트레치
  //   가중 평균만으로는 swing 이 작은 경향이 있어 최종 단계에서 +20% 확장
  homeWinRaw = 50 + (homeWinRaw - 50) * 1.2;

  // 극단값 클램프 (5% ~ 95%)
  homeWinRaw = Math.max(5, Math.min(95, homeWinRaw));

  // ───── 무승부 산출 + 최종 분배 ─────
  const drawRaw = calcDrawRate(homeWinRaw);
  const scale = (100 - drawRaw) / 100;
  const hRate = Math.round(homeWinRaw * scale);
  const dRate = Math.round(drawRaw);
  const aRate = 100 - hRate - dRate;  // 100 정확히 맞추기 위해 잔여로 계산

  // 디버깅 (운영 시 한 줄로 압축)
  if (typeof window !== 'undefined' && (window as any).__PREDICT_DEBUG__) {
    console.log(`[예측 v3] ${homeTeam.ownerName} vs ${awayTeam.ownerName}`);
    console.log(`  ① 승점  ${hPts.toFixed(2)} vs ${aPts.toFixed(2)} → ${pointsShare.toFixed(1)}%`);
    console.log(`  ② H2H  ${h2h.homeRate.toFixed(1)}% (${h2h.count}경기, 신뢰도 ${(h2hConfidence*100).toFixed(0)}%) → ${h2hShare.toFixed(1)}%`);
    console.log(`  ③ 레이팅 ${hRat.toFixed(1)} vs ${aRat.toFixed(1)} → ${ratingShare.toFixed(1)}%`);
    console.log(`  ④ 폼   ${hForm.toFixed(1)} vs ${aForm.toFixed(1)} → ${formShare.toFixed(1)}%`);
    console.log(`  → 종합: 홈 ${hRate}% / 무 ${dRate}% / 원정 ${aRate}%`);
  }

  return { hRate, dRate, aRate };
};

// =========================================================
// [Snapshot] DB 저장용 — drawPredictRate 신규 필드 포함
// =========================================================
export const calculateMatchSnapshot = (
  homeName: string,
  awayName: string,
  activeRankingData: any,
  historyData: any,
  masterTeams: any[]
) => {
  if (['BYE', 'TBD'].includes(homeName) || ['BYE', 'TBD'].includes(awayName)) {
    return { homePredictRate: 0, drawPredictRate: 0, awayPredictRate: 0 };
  }
  const { hRate, dRate, aRate } = getPrediction(homeName, awayName, activeRankingData, historyData, masterTeams);
  return { homePredictRate: hRate, drawPredictRate: dRate, awayPredictRate: aRate };
};

// =========================================================
// [Legacy Bridge] 2-way만 저장된 매치를 3-way 로 변환
//   - 기존 매치 (drawPredictRate 없음) UI 표시용
// =========================================================
export const deriveThreeWayFromLegacy = (savedHome: number, savedAway: number): PredictionResult => {
  const draw = calcDrawRate(savedHome);
  const scale = (100 - draw) / 100;
  const hRate = Math.round(savedHome * scale);
  const dRate = Math.round(draw);
  const aRate = 100 - hRate - dRate;
  return { hRate, dRate, aRate };
};
