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
  status: 'UPCOMING' | 'COMPLETED' | 'BYE';
  youtubeUrl?: string;
  stage: string;
  matchLabel: string;
  homeScorers: any[];
  awayScorers: any[];
  homeAssists: any[];
  awayAssists: any[];
  
  homePredictRate?: number; 
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
  legacyName?: string | null; // 🔥 과거 기록 추적용 꼬리표
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

export const FALLBACK_IMG = "https://via.placeholder.com/64?text=FC";

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