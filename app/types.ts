// [수정] Match 인터페이스에 토너먼트 진행용 id 속성 추가 (nextMatchId, loserMatchId)
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
  youtubeUrl?: string; // 유튜브 URL (필수 아님, undefined 가능하게 ? 처리하거나 scheduler에서 빈 문자열 '' 할당)
  stage: string;
  matchLabel: string;
  homeScorers: any[];
  awayScorers: any[];
  homeAssists: any[];
  awayAssists: any[];
  
  // 🔥 [추가된 속성] 토너먼트 로직용
  nextMatchId?: string | null;  // 승자가 진출할 다음 경기 ID
  loserMatchId?: string | null; // 패자가 진출할 다음 경기 ID (3,4위전용)
}

// (참고) 아래는 기존에 존재했을 Team, Season 등의 타입들입니다. 
// 기존 파일에 이미 있다면 Match 부분만 위와 같이 수정하시면 됩니다.
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

export const FALLBACK_IMG = "https://via.placeholder.com/64?text=FC";