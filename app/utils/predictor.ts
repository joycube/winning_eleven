import { Team, MasterTeam } from '../types';

// =========================================================
// 1. 가중치 설정: 상성(60%) + 오너(30%) = 90%
// 팀 스펙은 10%로 사실상 무시 (리버풀 할아버지가 와도 안됨)
// =========================================================
const WEIGHTS = {
  OWNER_BASE: 0.3,    // 오너 기본 피지컬
  HEAD_TO_HEAD: 0.6,  // 🔥 [핵심] 상대 전적 (절대적)
  SQUAD_SPEC: 0.1     // 팀 스펙 (거의 영향 없음)
};

// =========================================================
// 2. 팀 체급 점수 (변별력 삭제)
// =========================================================
const TIER_SCORES: Record<string, number> = {
  'S': 85, 
  'A': 84, // 1점 차이
  'B': 82, 
  'C': 78,
  'D': 70
};

const CONDITION_BONUS: Record<string, number> = {
  'A': 1, 'B': 0, 'C': 0, 'D': -1, 'E': -2
};

// =========================================================
// 3. 헬퍼 함수들 (이름 매칭 강화)
// =========================================================

// 🔥 [중요] 이름 정규화 (띄어쓰기 제거)
const normalize = (name: string) => name ? name.replace(/\s+/g, '').trim() : '';

// (A) 상대 전적(Head-to-Head) - 띄어쓰기 무시하고 비교
const getHeadToHeadWinRate = (me: string, opponent: string, historyData: any): { rate: number, count: number } => {
  if (!historyData || !historyData.matches) return { rate: 50, count: 0 };

  const myName = normalize(me);
  const oppName = normalize(opponent);

  const h2hMatches = historyData.matches.filter((m: any) => {
    const hOwner = normalize(m.homeOwner);
    const aOwner = normalize(m.awayOwner);
    return (hOwner === myName && aOwner === oppName) || (hOwner === oppName && aOwner === myName);
  });

  const total = h2hMatches.length;
  if (total === 0) return { rate: 50, count: 0 };

  let wins = 0;
  h2hMatches.forEach((m: any) => {
    const hOwner = normalize(m.homeOwner);
    const aOwner = normalize(m.awayOwner);
    
    // 내가 홈일 때 승리
    if (hOwner === myName && Number(m.homeScore) > Number(m.awayScore)) wins++;
    // 내가 어웨이일 때 승리
    if (aOwner === myName && Number(m.awayScore) > Number(m.homeScore)) wins++;
  });

  return { rate: (wins / total) * 100, count: total };
};

// (B) 오너 기본 승률
const getOwnerGeneralWinRate = (ownerName: string, historyData: any): number => {
  if (!historyData || !historyData.owners) return 50;
  const target = normalize(ownerName);
  const owner = historyData.owners.find((o: any) => normalize(o.nickname) === target);
  if (!owner || owner.totalMatches < 5) return 50;
  return (owner.win / owner.totalMatches) * 100;
};

// (C) 팀 스펙
const getTeamSpecScore = (team: Team, masterTeams: MasterTeam[]): number => {
  let baseScore = TIER_SCORES[team.tier] || 75;
  const master = masterTeams.find(m => m.name === team.name);
  if (master) {
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

  // 상성 조회
  const hHead = getHeadToHeadWinRate(homeTeam.ownerName, awayTeam.ownerName, historyData);
  const aHeadRate = hHead.count > 0 ? (100 - hHead.rate) : 50;

  // 디버깅용 콘솔 (개발자 도구에서 확인 가능)
  console.log(`[예측] ${homeTeam.ownerName} vs ${awayTeam.ownerName}`);
  console.log(`- 전적: ${hHead.count}전 승률 ${hHead.rate}%`);

  let finalH, finalA;
  
  if (hHead.count > 0) {
    // 🔥 전적 있으면 상성 60% 반영
    finalH = (hBase * WEIGHTS.OWNER_BASE) + (hHead.rate * WEIGHTS.HEAD_TO_HEAD) + (hSpec * WEIGHTS.SQUAD_SPEC);
    finalA = (aBase * WEIGHTS.OWNER_BASE) + (aHeadRate * WEIGHTS.HEAD_TO_HEAD) + (aSpec * WEIGHTS.SQUAD_SPEC);
  } else {
    finalH = (hBase * 0.7) + (hSpec * 0.3);
    finalA = (aBase * 0.7) + (aSpec * 0.3);
  }

  const diff = finalH - finalA;
  let hRatePrediction = 50 + (diff * 2.0);

  // =========================================================
  // 🔥 [극약 처방] 1패라도 있는데 승리가 없다? -> 강제 너프
  // =========================================================
  if (hHead.count >= 1 && hHead.rate === 0) {
     // 1전 전패, 2전 전패... -> 무조건 35% 미만으로 강제 설정
     // 리버풀이고 나발이고 무조건 짐
     hRatePrediction = Math.min(hRatePrediction, 35);
     console.log("-> 천적 관계 발동: 강제 하향 조정 (Max 35%)");
  } 
  else if (hHead.count >= 1 && hHead.rate === 100) {
     hRatePrediction = Math.max(hRatePrediction, 65);
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