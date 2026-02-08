import { Team, MasterTeam } from '../types';

// =========================================================
// [설정] 점수 산정 기준표
// =========================================================

// 1. 팀 체급 점수 (격차를 합리적인 수준으로 조정)
// 기존 90, 80점 단위가 아니라, 최종 승률에 보정할 '가산점' 개념으로 변경
// S급과 A급의 차이는 3점 (승률 약 3.6% 영향)
const TIER_SCORES: Record<string, number> = {
  'S': 10, 
  'A': 7, 
  'B': 4, 
  'C': 1,
  'D': 0
};

// 2. 컨디션 보너스 (승률에 미세 조정)
const CONDITION_BONUS: Record<string, number> = {
  'A': 3,   // 최상: +3점
  'B': 1,   // 좋음: +1점
  'C': 0,   // 보통
  'D': -1,  // 나쁨
  'E': -3   // 최악
};

// =========================================================
// [Helper] 데이터 추출 및 정규화 함수
// =========================================================

// 이름 정규화 (공백 제거, 소문자화) - 매칭 정확도 향상용
const normalize = (name: string) => name ? name.replace(/\s+/g, '').trim().toLowerCase() : '';

/**
 * (A) 상대 전적(Head-to-Head) 계산
 * @returns { rate: 승률(0~100), count: 맞대결 횟수 }
 */
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
    const hScore = Number(m.homeScore);
    const aScore = Number(m.awayScore);

    if (hOwner === myName && hScore > aScore) wins++;
    if (aOwner === myName && aScore > hScore) wins++;
  });

  return { rate: (wins / total) * 100, count: total };
};

/**
 * (B) 오너의 전체 승률 (General Win Rate)
 * 데이터가 없으면 기본 50% 반환
 */
const getOwnerGeneralWinRate = (ownerName: string, historyData: any): number => {
  if (!historyData || !historyData.owners) return 50;
  
  const targetName = normalize(ownerName);
  const owner = historyData.owners.find((o: any) => normalize(o.nickname) === targetName);
  
  if (!owner || owner.totalMatches < 1) return 50;
  return (owner.win / owner.totalMatches) * 100;
};

/**
 * (C) 팀 스펙 점수 계산 (티어 + 순위 + 컨디션)
 * 이 점수는 나중에 '격차(Diff)'를 구하는 데 사용됨
 */
const getTeamSpecScore = (team: Team, masterTeams: MasterTeam[]): number => {
  let score = TIER_SCORES[team.tier] || 0;
  const master = masterTeams.find(m => m.name === team.name);
  
  if (master) {
    // 실축 순위 보정: (10 - 순위) * 0.5 (최대 5점)
    if (master.real_rank && master.real_rank <= 20) {
      score += Math.max(0, (10 - master.real_rank) * 0.5);
    }
    // 컨디션 보정
    const cond = master.condition || 'C';
    score += (CONDITION_BONUS[cond] || 0);
  }
  return score;
};

// =========================================================
// [Main] 최종 승률 예측 로직 (Sliding Weight Algorithm)
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

  // 1. 기본 데이터 수집
  const hGen = getOwnerGeneralWinRate(homeTeam.ownerName, historyData);
  const aGen = getOwnerGeneralWinRate(awayTeam.ownerName, historyData);
  
  const hHead = getHeadToHeadWinRate(homeTeam.ownerName, awayTeam.ownerName, historyData);
  const aHeadRate = hHead.count > 0 ? (100 - hHead.rate) : 50;

  // 2. [알고리즘 핵심] 신뢰도 기반 가중치 (Sliding Weight)
  // 맞대결 횟수(N)가 늘어날수록, 상대 전적(H2H)의 비중을 높임
  // N=0 -> 가중치 0 (전체 승률 100%)
  // N=1 -> 가중치 0.2 (전체 80% + 상대 20%)
  // N=5 -> 가중치 1.0 (전체 0% + 상대 100%) -> 천적 관계 완전 반영
  const weight = Math.min(1.0, hHead.count * 0.2);

  // 3. 오너 실력 점수 계산 (Weighted Sum)
  const hSkill = (hGen * (1 - weight)) + (hHead.rate * weight);
  const aSkill = (aGen * (1 - weight)) + (aHeadRate * weight);

  // 4. 팀 스펙 보너스 (Modifier)
  // 팀 점수를 더하는게 아니라, "차이(Diff)"만큼 보너스로 줌
  const hSpec = getTeamSpecScore(homeTeam, masterTeams);
  const aSpec = getTeamSpecScore(awayTeam, masterTeams);
  
  // 팀 스펙 차이 1점당 승률 1.2% 변동
  const teamBonus = (hSpec - aSpec) * 1.2;

  // 5. 최종 승률 도출
  // 기본 50% + (실력 차이 * 0.8) + 팀 보너스
  const skillDiff = hSkill - aSkill;
  let hRatePrediction = 50 + (skillDiff * 0.8) + teamBonus;

  // 디버깅 로그
  console.log(`[분석] ${normalize(homeTeam.ownerName)} vs ${normalize(awayTeam.ownerName)}`);
  console.log(`- 가중치(w): ${weight} (판수: ${hHead.count})`);
  console.log(`- 실력점수: 홈(${hSkill.toFixed(1)}) vs 원정(${aSkill.toFixed(1)})`);
  console.log(`- 팀보너스: ${teamBonus.toFixed(1)}% (홈스펙: ${hSpec} - 원정스펙: ${aSpec})`);
  console.log(`- 최종예측: ${hRatePrediction.toFixed(1)}%`);

  // 6. 범위 제한 (최소 5% ~ 최대 95%)
  hRatePrediction = Math.max(5, Math.min(95, hRatePrediction));

  return { 
    hRate: Math.round(hRatePrediction), 
    aRate: 100 - Math.round(hRatePrediction) 
  };
};

// DB 저장용 스냅샷 함수
export const calculateMatchSnapshot = (
  homeName: string, awayName: string, activeRankingData: any, historyData: any, masterTeams: any[]
) => {
  if (['BYE', 'TBD'].includes(homeName) || ['BYE', 'TBD'].includes(awayName)) {
    return { homePredictRate: 0, awayPredictRate: 0 };
  }
  const { hRate, aRate } = getPrediction(homeName, awayName, activeRankingData, historyData, masterTeams);
  return { homePredictRate: hRate, awayPredictRate: aRate };
};