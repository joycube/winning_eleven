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
  first: number;
  second: number;
  third: number;
  scorer: number;
  assist: number;
}

export type CupPhase = 'GROUP_STAGE' | 'KNOCKOUT_STAGE';

export interface Season {
  id: number;
  name: string;
  type: 'LEAGUE' | 'TOURNAMENT' | 'CUP' | 'LEAGUE_PLAYOFF'; // 🔥 LEAGUE_PLAYOFF 추가됨!
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
  nickname: string;
  photo?: string;
  password?: string;
  totalWins?: number; 
  totalMatches?: number; 
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
  ownerName: string;
  region: string;
  tier: string;
  rank?: number; 
  group?: string; 
  realRankScore?: number;
  realFormScore?: number;
  size?: string; 
}

export const FALLBACK_IMG = "https://via.placeholder.com/64?text=FC";

// 🔥 [디벨롭] 댓글 안에 좋아요(likedBy)와 대댓글(replies) 배열 추가!
export interface NoticeComment {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerPhoto: string;
  text: string;
  createdAt: string;
  likedBy?: string[];         // 댓글 좋아요 누른 사람
  replies?: NoticeComment[];  // 대댓글(답글) 목록
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  youtubeUrl?: string;
  isPopup: boolean;
  createdAt: string;
  updatedAt?: string;         // 🔥 [디벨롭] 최신 업데이트 시간 (N 뱃지용)
  likedBy?: string[];
  dislikedBy?: string[];
  comments?: NoticeComment[];
}