import { Team, MasterTeam } from '../types';

// ==========================================
// 1. 가중치 설정 (기획안 반영)
// ==========================================
const WEIGHTS = {
  OWNER: 0.5,   // 오너 실력 (50%)
  SQUAD: 0.3,   // 팀 체급/티어 (30%)
  REAL: 0.2     // 현실 반영 (20%) - 랭킹 + 컨디션
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
  'A': 100, // 최상의 기세
  'B': 90,
  'C': 80,  // 보통
  'D': 70,
  'E': 60   // 최악의 기세
};

// ==========================================
// 2. 헬퍼 함수들
// ==========================================

/**
 * 현실 점수 계산 (랭킹 점수 50% + 컨디션 점수 50%)
 */
const getRealWorldScore = (teamName: string, masterTeams: MasterTeam[]): number => {
  const masterTeam = masterTeams.find(t => t.name === teamName);
  
  // 데이터가 없으면 기본점수(80) 리턴
  if (!masterTeam) return 80;

  // 1. 랭킹 점수 계산 (1위=100점 ~ 20위=60점)
  // 순위가 없으면(0) 중간인 10위로 가정
  const rank = masterTeam.real_rank && masterTeam.real_rank > 0 ? masterTeam.real_rank : 10;
  const rankScore = Math.max(60, 102 - (rank * 2)); // 1위:100, 10위:82, 20위:62

  // 2. 컨디션 점수 계산
  const cond = masterTeam.condition || 'C';
  const conditionScore = CONDITION_SCORES[cond] || 80;

  // 현실 점수 = (랭킹점수 + 컨디션점수) / 2
  return (rankScore + conditionScore) / 2;
};

/**
 * 오너의 역대 승률 계산
 */
const getOwnerWinRate = (ownerName: string, historyData: any): number => {
  if (!historyData || !historyData.owners) return 50; 

  const ownerStat = historyData.owners.find((o: any) => o.nickname === ownerName);
  
  if (!ownerStat || ownerStat.totalMatches < 5) return 50; // 데이터 부족 시 50점

  const winRate = (ownerStat.win / ownerStat.totalMatches) * 100;
  
  // 승률 보정 (최소 30점 ~ 최대 90점)
  return Math.max(30, Math.min(90, winRate));
};

// ==========================================
// 3. 메인 예측 함수
// ==========================================

export const getPrediction = (
  homeName: string, 
  awayName: string, 
  activeRankingData: any, // 현재 시즌 팀 정보
  historyData: any,       // 역대 전적 정보
  masterTeams: MasterTeam[] = [] // 🔥 [추가] 실제 데이터 (기본값 빈배열)
) => {
  // 1. 팀 정보 찾기
  const homeTeam = activeRankingData?.teams?.find((t: Team) => t.name === homeName);
  const awayTeam = activeRankingData?.teams?.find((t: Team) => t.name === awayName);

  if (!homeTeam || !awayTeam) {
    return { hRate: 50, aRate: 50 };
  }

  // ----------------------------------------------------
  // A. 오너 점수 계산 (가중치 50%)
  // ----------------------------------------------------
  const homeOwnerScore = getOwnerWinRate(homeTeam.ownerName, historyData);
  const awayOwnerScore = getOwnerWinRate(awayTeam.ownerName, historyData);

  // ----------------------------------------------------
  // B. 스쿼드(티어) 점수 계산 (가중치 30%)
  // ----------------------------------------------------
  const homeSquadScore = TIER_SCORES[homeTeam.tier] || 65;
  const awaySquadScore = TIER_SCORES[awayTeam.tier] || 65;

  // ----------------------------------------------------
  // C. 현실 반영 점수 계산 (가중치 20%) - 🔥 실데이터 연결
  // ----------------------------------------------------
  const homeRealScore = getRealWorldScore(homeTeam.name, masterTeams);
  const awayRealScore = getRealWorldScore(awayTeam.name, masterTeams);

  // ----------------------------------------------------
  // D. 최종 파워 스코어 합산
  // ----------------------------------------------------
  const calculateTotalPower = (owner: number, squad: number, real: number) => {
    return (owner * WEIGHTS.OWNER) + (squad * WEIGHTS.SQUAD) + (real * WEIGHTS.REAL);
  };

  const homePower = calculateTotalPower(homeOwnerScore, homeSquadScore, homeRealScore);
  const awayPower = calculateTotalPower(awayOwnerScore, awaySquadScore, awayRealScore);

  // ----------------------------------------------------
  // E. 승률 백분율 변환
  // ----------------------------------------------------
  const totalPower = homePower + awayPower;
  
  if (totalPower === 0) return { hRate: 50, aRate: 50 };

  let hRate = Math.round((homePower / totalPower) * 100);
  let aRate = 100 - hRate;

  // 극단값 보정 (15% ~ 85%) - 스포츠의 의외성 반영
  if (hRate > 85) { hRate = 85; aRate = 15; }
  if (hRate < 15) { hRate = 15; aRate = 85; }

  return { hRate, aRate };
};