// app/types.ts

export interface Match {
  id: string;
  seasonId: number;
  home: string;
  away: string;
  homeLogo: string;
  awayLogo: string;
  
  // [기존 유산] 텍스트 이름
  homeOwner: string;
  awayOwner: string;
  
  // 🔥 [UID 뼈대] 앞으로 저장될 구글 UID 공간
  homeOwnerUid?: string; 
  awayOwnerUid?: string; 

  homeScore: string;
  awayScore: string;
  timestamp?: number; // 🛠️ [v2.4] 점수 확정(기록) 시각 — LAST RESULTS/OWNERS FORM 최신순 정렬용
  // 🔒 [High 패치 H4] 'PENDING' 추가 — 일부 레거시 매치 데이터가 PENDING 으로 남아있어
  //   분기 처리(L_MatchCenter 등)에서 사용. 신규 매치는 항상 'UPCOMING' 으로 생성,
  //   점수 확정 시 'COMPLETED' 로 전환. 'PENDING' 은 레거시 호환 + 의도된 대기 상태용.
  status: 'UPCOMING' | 'PENDING' | 'COMPLETED' | 'BYE';
  youtubeUrl?: string;
  stage: string;
  matchLabel: string;
  homeScorers: any[];
  awayScorers: any[];
  homeAssists: any[];
  awayAssists: any[];
  
  homePredictRate?: number;
  drawPredictRate?: number; // 🛠️ [v3 알고리즘] 무승부 예측 (신규 매치만 저장, 레거시는 deriveThreeWayFromLegacy 로 복원)
  awayPredictRate?: number;

  nextMatchId?: string | null;
  loserMatchId?: string | null;

  group?: string;
  commentary?: string; 
}

export interface Team {
  id: number;
  seasonId: number;
  name: string;
  logo: string;
  
  ownerName: string; // [기존 유산]
  ownerUid?: string; // 🔥 [UID 뼈대]

  region: string;
  tier: string;
  win: number;
  draw: number;
  loss: number;
  points: number;
  gf: number;
  ga: number;
  gd: number;

  realRankScore?: number; 
  realFormScore?: number; 
}

export interface Round {
  round: number;
  name: string;
  seasonId: number;
  matches: Match[];
}

export interface Prizes {
  champion?: number; 
  first: number;     
  second: number;    
  third: number;     
  scorer: number;
  assist: number;
  poScorer?: number; // 🔥 [추가] 토너먼트(PO) 득점왕 상금
  poAssist?: number; // 🔥 [추가] 토너먼트(PO) 도움왕 상금
}

export type CupPhase = 'GROUP_STAGE' | 'KNOCKOUT_STAGE';

export interface Season {
  id: number;
  name: string;
  type: 'LEAGUE' | 'TOURNAMENT' | 'CUP' | 'LEAGUE_PLAYOFF';
  leagueMode?: 'SINGLE' | 'DOUBLE';
  teams: Team[];
  rounds?: Round[];
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
  prizes?: Prizes;

  cupPhase?: CupPhase; 
  groups?: {
    [key: string]: number[];
  };
  advancementRule?: {
    fromGroup: number; 
    method: 'CROSS' | 'RANDOM'; 
  };
}

export interface Owner {
  id: number;
  docId?: string;
  uid?: string;       // 🔥 구글 연동 UID
  nickname: string;
  email?: string;     // 🔥 TS(2339) 에러 해결을 위한 핵심 필드
  role?: 'USER' | 'ADMIN'; // 🔥 권한 필드
  legacyName?: string | null; // 🔥 과거 기록 추적용 꼬리표 (단수, 구버전)
  legacyNames?: string[]; // 🔥 [추가] 과거 닉네임 누적 배열 (다중 닉네임 변경 추적용)
  photo?: string;
  password?: string;
  totalWins?: number; 
  totalMatches?: number; 
  createdAt?: string; // 🔥 생성일
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
  
  ownerName?: string; // [기존 유산]
  ownerUid?: string;  // 🔥 [UID 뼈대]

  region: string;
  tier: string;
  category: 'CLUB' | 'NATIONAL';
  real_rank?: number;
  condition?: string;
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

export interface CupEntry {
  id: string;
  masterId: number;
  name: string;
  logo: string;
  
  ownerName: string; // [기존 유산]
  ownerUid?: string; // 🔥 [UID 뼈대]

  region: string;
  tier: string;
  rank?: number; 
  group?: string; 
  realRankScore?: number;
  realFormScore?: number;
  size?: string; 
}

// 🛠️ [v2.3 픽스] 폴백 이미지를 인라인 데이터 URI로 교체.
//   기존: https://via.placeholder.com — 외부 서비스 종료(2024)로 로드 실패.
//   → onError 핸들러가 폴백도 실패시켜 무한 반복 → 모바일 사파리 메모리 폭주/크래시 유발.
//   데이터 URI는 네트워크 요청이 없어 절대 실패하지 않음 → 루프 원천 차단.
export const FALLBACK_IMG = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='64'%3E%3Crect%20width='64'%20height='64'%20fill='%23334155'/%3E%3Ccircle%20cx='32'%20cy='26'%20r='11'%20fill='%23475569'/%3E%3Crect%20x='14'%20y='40'%20width='36'%20height='18'%20rx='9'%20fill='%23475569'/%3E%3C/svg%3E";

export interface NoticeComment {
  id: string;
  ownerId: string; 
  ownerUid?: string; // 🔥 [UID 뼈대] 진짜 구글 UID
  ownerName: string;
  ownerPhoto: string;
  text: string;
  createdAt: string;
  likedBy?: string[];         
  replies?: NoticeComment[];  
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  youtubeUrl?: string;
  isPopup: boolean;
  createdAt: string;
  updatedAt?: string;         
  likedBy?: string[];
  dislikedBy?: string[];
  comments?: NoticeComment[];
}

// ==========================================
// 🔥 [신규 추가] 하이라이트 미디어 전용 데이터 타입
// ==========================================
export interface HighlightPost {
  id: string;             // 매치 ID와 동일하게 맞춰서 1:1 매핑
  matchId: string;        
  seasonId: number;
  seasonName: string;
  youtubeUrl: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  homeScore: number | string;
  awayScore: number | string;
  matchLabel: string;     // 예: "ROUND_OF_8 / 1경기"
  createdAt: number;      // 정렬을 위한 타임스탬프
  views: number;          // 조회수
  likes: string[];        // 좋아요 누른 유저 UID 배열
  commentCount: number;   // 댓글 갯수
}