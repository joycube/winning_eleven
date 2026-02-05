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
  youtubeUrl?: string; // 유튜브 URL
  stage: string;
  matchLabel: string;
  homeScorers: any[];
  awayScorers: any[];
  homeAssists: any[];
  awayAssists: any[];
  
  // 토너먼트 로직용 속성
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

export interface Season {
  id: number;
  name: string;
  type: 'LEAGUE' | 'TOURNAMENT';
  leagueMode?: 'SINGLE' | 'DOUBLE';
  teams: Team[];
  rounds?: Round[];
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
}

export interface Owner {
  id: number;
  nickname: string;
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

// 🔥 [수정됨] imageUrl -> url로 변경 (기존 코드와 호환되도록)
export interface Banner {
  id: number;
  docId?: string;
  url: string;      // 여기가 수정되었습니다!
  linkUrl?: string;
}

export const FALLBACK_IMG = "https://via.placeholder.com/64?text=FC";