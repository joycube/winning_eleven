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
  
  // 토너먼트 로직용
  nextMatchId?: string | null;
  loserMatchId?: string | null;
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
}

export interface Round {
  round: number;
  name: string;
  seasonId: number;
  matches: Match[];
}

// 🔥 [추가] 상금 타입 정의
export interface Prizes {
  first: number;
  second: number;
  third: number;
  scorer: number;
  assist: number;
}

export interface Season {
  id: number;
  name: string;
  type: 'LEAGUE' | 'TOURNAMENT';
  leagueMode?: 'SINGLE' | 'DOUBLE';
  teams: Team[];
  rounds?: Round[];
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
  prizes?: Prizes; // 🔥 [수정] 여기에 상금 속성 추가!
}

export interface Owner {
  id: number;
  docId?: string;
  nickname: string;
  photo?: string;
  password?: string;
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
}

export interface Banner {
  id: number;
  docId?: string;
  url: string;
  linkUrl?: string;
  description?: string;
}

export const FALLBACK_IMG = "https://via.placeholder.com/64?text=FC";