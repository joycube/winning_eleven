// app/types.ts

export interface Match {
  id: string;
  seasonId: number;
  home: string;
  away: string;
  homeLogo: string;
  awayLogo: string;
  homeOwner: string;
  awayOwner: string;
  homeScore: string;
  awayScore: string;
  status: 'UPCOMING' | 'COMPLETED' | 'BYE';
  youtubeUrl?: string;
  stage: string;
  matchLabel: string;
  homeScorers: any[];
  awayScorers: any[];
  homeAssists: any[];
  awayAssists: any[];
  // 🔥 [추가] 승부 예측 결과 (Team/Owner 데이터 기반)
  homePredictRate?: number; // 홈 승리 확률 (0~100)
  awayPredictRate?: number; // 원정 승리 확률 (0~100)

  // 토너먼트 로직용
  nextMatchId?: string | null;
  loserMatchId?: string | null;

  // 🔥 [추가] 컵 모드 전용: 조별 예선 그룹 정보 (예: "A", "B")
  group?: string;

  // 🔥 [추가] 경기 분석 및 코멘터리 데이터
  commentary?: string; 
}

export interface Team {
  id: number;
  seasonId: number;
  name: string;
  logo: string;
  ownerName: string;
  region: string;
  tier: string;
  win: number;
  draw: number;
  loss: number;
  points: number;
  gf: number;
  ga: number;
  gd: number;

  // 🔥 [추가] 승률 예측 알고리즘용 리얼 데이터
  realRankScore?: number; // 실축 순위 점수 (0~100)
  realFormScore?: number; // 실축 폼/기세 점수 (0~100)
}

export interface Round {
  round: number;
  name: string;
  seasonId: number;
  matches: Match[];
}

export interface Prizes {
  first: number;
  second: number;
  third: number;
  scorer: number;
  assist: number;
}

// 🔥 [추가] 컵 모드의 현재 진행 상태 (조별리그 vs 토너먼트)
export type CupPhase = 'GROUP_STAGE' | 'KNOCKOUT_STAGE';

export interface Season {
  id: number;
  name: string;
  type: 'LEAGUE' | 'TOURNAMENT' | 'CUP';
  leagueMode?: 'SINGLE' | 'DOUBLE';
  teams: Team[];
  rounds?: Round[];
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
  prizes?: Prizes;

  // 🔥 [추가] 컵 모드 전용 데이터
  cupPhase?: CupPhase; // 현재 조별리그인지 토너먼트인지 상태값
  // 조 편성 데이터 (예: { "A": [101, 102], "B": [103, 104] } - Team ID 저장)
  groups?: {
    [key: string]: number[];
  };
  // 토너먼트 진출 규칙 설정
  advancementRule?: {
    fromGroup: number; // 조별 몇 위까지 진출? (보통 2)
    method: 'CROSS' | 'RANDOM'; // 토너먼트 매칭 방식 (크로스: A1vsB2 / 랜덤: 추첨)
  };
}

export interface Owner {
  id: number;
  docId?: string;
  nickname: string;
  photo?: string;
  password?: string;

  // 🔥 [추가] 오너 승률 가중치 계산용 통산 전적
  totalWins?: number; // 통산 승리 횟수
  totalMatches?: number; // 통산 경기 횟수
}

export interface League {
  id: number;
  docId?: string;
  name: string;
  logo: string;
  category: 'CLUB' | 'NATIONAL';
}

export interface MasterTeam {
  id: number;
  docId?: string;
  name: string;
  logo: string;
  region: string;
  tier: string;
  category: 'CLUB' | 'NATIONAL';
  real_rank?: number;
  condition?: string;

  // 🔥 [추가] 마스터 데이터에서 팀 생성 시 넘겨줄 점수
  realRankScore?: number;
  realFormScore?: number;
}

export interface Banner {
  id: number;
  docId?: string;
  url: string;
  linkUrl?: string;
  description?: string;
}

// 🔥 [추가] 컵 모드 드래그&드롭 및 대기실용 타입 (CupEntry)
export interface CupEntry {
  id: string;
  masterId: number;
  name: string;
  logo: string;
  ownerName: string;
  region: string;
  tier: string;
  rank?: number; // 조 순위 저장용
  group?: string; // 소속 조 저장용
  realRankScore?: number;
  realFormScore?: number;
  
  // 🔥 [추가] 컴포넌트 UI 사이즈 조절용 속성
  size?: string; 
}

export const FALLBACK_IMG = "https://via.placeholder.com/64?text=FC";