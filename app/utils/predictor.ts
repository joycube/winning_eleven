import { Team, MasterTeam } from '../types';

// ==========================================
// 1. 가중치 재설정 (실력 위주로 변경)
// ==========================================
const WEIGHTS = {
  OWNER: 0.7,   // 🔥 오너 실력 비중 대폭 상향 (50% -> 70%)
  SQUAD: 0.15,  // 팀 체급 비중 축소 (30% -> 15%)
  REAL: 0.15    // 현실 반영 비중 축소 (20% -> 15%)
};

// 티어별 기본 점수
const TIER_SCORES: Record<string, number> = {
  'S': 95, 
  'A': 85, 
  'B': 75, 
  'C': 65
};

// 컨디션별 가산점 (A~E)
const CONDITION_SCORES: Record<string, number> = {
  'A': 100,
  'B': 90,
  'C': 80,
  'D': 70,
  'E': 60
};

// ==========================================
// 2. 헬퍼 함수들
// ==========================================

const getRealWorldScore = (teamName: string, masterTeams: MasterTeam[]): number => {
  const masterTeam = masterTeams.find(t => t.name === teamName);
  if (!masterTeam) return 80;

  const rank = masterTeam.real_rank && masterTeam.real_rank > 0 ? masterTeam.real_rank : 10;
  const rankScore = Math.max(60, 102 - (rank * 2)); 

  const cond = masterTeam.condition || 'C';
  const conditionScore = CONDITION_SCORES[cond] || 80;

  return (rankScore + conditionScore) / 2;
};

/**
 * 오너의 역대 승률 계산 (보정 로직 완화)
 */
const getOwnerWinRate = (ownerName: string, historyData: any): number => {
  if (!historyData || !historyData.owners) return 50; 

  const ownerStat = historyData.owners.find((o: any) => o.nickname === ownerName);
  
  // 데이터가 너무 적으면(5판 미만) 50점 처리
  if (!ownerStat || ownerStat.totalMatches < 5) return 50;

  const winRate = (ownerStat.win / ownerStat.totalMatches) * 100;
  
  // 🔥 [수정] 하한선을 30점에서 10점으로 낮춤 (못하면 가차없이 깎임)
  // 잘하는 사람은 95점까지 인정
  return Math.max(10, Math.min(95, winRate));
};

// ==========================================
// 3. 메인 예측 함수
// ==========================================

export const getPrediction = (
  homeName: string, 
  awayName: string, 
  activeRankingData: any,
  historyData: any,
  masterTeams: MasterTeam[] = []
) => {
  const homeTeam = activeRankingData?.teams?.find((t: Team) => t.name === homeName);
  const awayTeam = activeRankingData?.teams?.find((t: Team) => t.name === awayName);

  if (!homeTeam || !awayTeam) {
    return { hRate: 50, aRate: 50 };
  }

  // A. 오너 점수 (가중치 70%)
  const homeOwnerScore = getOwnerWinRate(homeTeam.ownerName, historyData);
  const awayOwnerScore = getOwnerWinRate(awayTeam.ownerName, historyData);

  // B. 스쿼드 점수 (가중치 15%)
  const homeSquadScore = TIER_SCORES[homeTeam.tier] || 65;
  const awaySquadScore = TIER_SCORES[awayTeam.tier] || 65;

  // C. 현실 점수 (가중치 15%)
  const homeRealScore = getRealWorldScore(homeTeam.name, masterTeams);
  const awayRealScore = getRealWorldScore(awayTeam.name, masterTeams);

  // D. 총점 계산
  const calculateTotalPower = (owner: number, squad: number, real: number) => {
    return (owner * WEIGHTS.OWNER) + (squad * WEIGHTS.SQUAD) + (real * WEIGHTS.REAL);
  };

  const homePower = calculateTotalPower(homeOwnerScore, homeSquadScore, homeRealScore);
  const awayPower = calculateTotalPower(awayOwnerScore, awaySquadScore, awayRealScore);

  // E. 격차 기반 승률 계산 (Gap Logic)
  // 점수 차이를 더 민감하게 반응하도록 계수 조정 (2.0 -> 2.5)
  const powerDiff = homePower - awayPower; 
  let hRate = 50 + (powerDiff * 2.5);

  hRate = Math.round(hRate);
  
  // 최소/최대 승률 제한 (5% ~ 95%로 범위를 넓혀서 압도적인 상황 표현)
  if (hRate > 95) hRate = 95;
  if (hRate < 5) hRate = 5;

  let aRate = 100 - hRate;

  return { hRate, aRate };
};

/**
 * DB 저장용 스냅샷 함수
 */
export const calculateMatchSnapshot = (
  homeName: string,
  awayName: string,
  activeRankingData: any, 
  historyData: any,
  masterTeams: any[] 
) => {
  if (
    homeName === 'BYE' || 
    awayName === 'BYE' || 
    homeName === 'TBD' || 
    awayName === 'TBD'
  ) {
    return {
      homePredictRate: 0,
      awayPredictRate: 0
    };
  }

  const { hRate, aRate } = getPrediction(
    homeName, 
    awayName, 
    activeRankingData, 
    historyData, 
    masterTeams
  );

  return {
    homePredictRate: hRate,
    awayPredictRate: aRate
  };
};