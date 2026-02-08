import { Team, MasterTeam } from '../types';

// =========================================================
// 1. 가중치 설정: 상성(45%) + 오너(35%) = 80% (상성 깡패)
// =========================================================
const WEIGHTS = {
  OWNER_BASE: 0.35,   // 오너 기본 피지컬
  HEAD_TO_HEAD: 0.45, // 🔥 [핵심] 상대 전적 (가장 높음)
  SQUAD_SPEC: 0.20    // 팀 스펙 (아무리 좋아도 20%만 반영)
};

// =========================================================
// 2. 팀 체급 점수 (격차 극도로 축소)
// S급과 A급의 차이를 거의 없애서 변별력 삭제
// =========================================================
const TIER_SCORES: Record<string, number> = {
  'S': 88, // 기존 90 -> 88
  'A': 86, // 기존 87 -> 86 (격차 2점)
  'B': 82, 
  'C': 75,
  'D': 65
};

const CONDITION_BONUS: Record<string, number> = {
  'A': 2,   // 보너스 점수도 축소
  'B': 1,
  'C': 0,
  'D': -2,
  'E': -4
};

// =========================================================
// 3. 헬퍼 함수들
// =========================================================

const getHeadToHeadWinRate = (me: string, opponent: string, historyData: any): { rate: number, count: number } => {
  if (!historyData || !historyData.matches) return { rate: 50, count: 0 };

  const h2hMatches = historyData.matches.filter((m: any) => 
    (m.homeOwner === me && m.awayOwner === opponent) || 
    (m.homeOwner === opponent && m.awayOwner === me)
  );

  const total = h2hMatches.length;
  if (total === 0) return { rate: 50, count: 0 };

  let wins = 0;
  h2hMatches.forEach((m: any) => {
    if (m.homeOwner === me && Number(m.homeScore) > Number(m.awayScore)) wins++;
    if (m.awayOwner === me && Number(m.awayScore) > Number(m.homeScore)) wins++;
  });

  return { rate: (wins / total) * 100, count: total };
};

const getOwnerGeneralWinRate = (ownerName: string, historyData: any): number => {
  if (!historyData || !historyData.owners) return 50;
  const owner = historyData.owners.find((o: any) => o.nickname === ownerName);
  if (!owner || owner.totalMatches < 5) return 50;
  return (owner.win / owner.totalMatches) * 100;
};

const getTeamSpecScore = (team: Team, masterTeams: MasterTeam[]): number => {
  let baseScore = TIER_SCORES[team.tier] || 75;
  const master = masterTeams.find(m => m.name === team.name);
  if (master) {
    if (master.real_rank) baseScore += Math.max(0, (10 - master.real_rank) * 0.1); // 순위 영향력 최소화
    const cond = master.condition || 'C';
    baseScore += (CONDITION_BONUS[cond] || 0);
  }
  return baseScore;
};

// =========================================================
// 4. 메인 예측 로직
// =========================================================
export const getPrediction = (
  homeName: string, 
  awayName: string, 
  activeRankingData: any,
  historyData: any,
  masterTeams: MasterTeam[] = []
) => {
  const homeTeam = activeRankingData?.teams?.find((t: Team) => t.name === homeName);
  const awayTeam = activeRankingData?.teams?.find((t: Team) => t.name === awayName);

  if (!homeTeam || !awayTeam) return { hRate: 50, aRate: 50 };

  const hBase = getOwnerGeneralWinRate(homeTeam.ownerName, historyData);
  const aBase = getOwnerGeneralWinRate(awayTeam.ownerName, historyData);
  
  const hSpec = getTeamSpecScore(homeTeam, masterTeams);
  const aSpec = getTeamSpecScore(awayTeam, masterTeams);

  const hHead = getHeadToHeadWinRate(homeTeam.ownerName, awayTeam.ownerName, historyData);
  const aHeadRate = hHead.count > 0 ? (100 - hHead.rate) : 50;

  let finalH, finalA;
  
  if (hHead.count > 0) {
    // 🔥 전적이 1판이라도 있으면 상성 비중 45% 즉시 적용
    finalH = (hBase * WEIGHTS.OWNER_BASE) + (hHead.rate * WEIGHTS.HEAD_TO_HEAD) + (hSpec * WEIGHTS.SQUAD_SPEC);
    finalA = (aBase * WEIGHTS.OWNER_BASE) + (aHeadRate * WEIGHTS.HEAD_TO_HEAD) + (aSpec * WEIGHTS.SQUAD_SPEC);
  } else {
    // 전적이 아예 없으면 기본기 싸움
    finalH = (hBase * 0.7) + (hSpec * 0.3);
    finalA = (aBase * 0.7) + (aSpec * 0.3);
  }

  // 예측 승률 계산
  const diff = finalH - finalA;
  let hRatePrediction = 50 + (diff * 2.0);

  // =========================================================
  // 🔥 [천적 관계 절대 보정 (Absolute Nemesis Rule)]
  // 조건: 상대 전적 1판 이상 & 승률 0% -> 무조건 패배 예측 (최대 42%)
  // 조건: 상대 전적 3판 이상 & 승률 0% -> 압도적 패배 예측 (최대 30%)
  // =========================================================
  if (hHead.count >= 1) {
      if (hHead.rate === 0) {
          // 1패라도 있고 이긴 적 없으면 -> 팀이 아무리 좋아도 42%를 못 넘김 (열세 확정)
          hRatePrediction = Math.min(hRatePrediction, 42); 
          
          // 3패 이상이고 이긴 적 없으면 -> 30% 못 넘김 (절대 열세)
          if (hHead.count >= 3) hRatePrediction = Math.min(hRatePrediction, 30);
      } 
      else if (hHead.rate === 100) {
          // 반대 경우 (전승 중)
          hRatePrediction = Math.max(hRatePrediction, 58); // 최소 우세 보장
          if (hHead.count >= 3) hRatePrediction = Math.max(hRatePrediction, 70);
      }
  }

  return { 
    hRate: Math.round(Math.max(5, Math.min(95, hRatePrediction))), 
    aRate: Math.round(100 - Math.max(5, Math.min(95, hRatePrediction))) 
  };
};

export const calculateMatchSnapshot = (
  homeName: string, awayName: string, activeRankingData: any, historyData: any, masterTeams: any[]
) => {
  if (['BYE', 'TBD'].includes(homeName) || ['BYE', 'TBD'].includes(awayName)) {
    return { homePredictRate: 0, awayPredictRate: 0 };
  }
  const { hRate, aRate } = getPrediction(homeName, awayName, activeRankingData, historyData, masterTeams);
  return { homePredictRate: hRate, awayPredictRate: aRate };
};