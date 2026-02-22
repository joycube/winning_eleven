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
  
  // 승부 예측 결과 (Team/Owner 데이터 기반)
  homePredictRate?: number; 
  awayPredictRate?: number; 

  // 토너먼트 로직용
  nextMatchId?: string | null;
  loserMatchId?: string | null;

  // 컵 모드 전용: 조별 예선 그룹 정보
  group?: string;

  // 🔥 [필수 수정] 이 줄이 있어야 CupSchedule 오류가 해결됨!
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

  // 승률 예측 알고리즘용 리얼 데이터
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
  type: 'LEAGUE' | 'TOURNAMENT' | 'CUP';
  leagueMode?: 'SINGLE' | 'DOUBLE';
  teams: Team[];
  rounds?: Round[];
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
  prizes?: Prizes;

  // 컵 모드 전용 데이터
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

  // 오너 승률 가중치 계산용 통산 전적
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

  // 마스터 데이터에서 팀 생성 시 넘겨줄 점수
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
  
  // 🔥 [필수 수정] AdminCupStep2 빌드 오류 방지용 속성
  size?: string; 
}

export const FALLBACK_IMG = "https://via.placeholder.com/64?text=FC";

// 🔥 [NEW] 댓글 데이터 타입 (Notice 하위)
export interface NoticeComment {
  id: string;        // 댓글 고유 ID
  ownerId: string;   // 댓글 작성자(오너) ID
  ownerName: string; // 작성자 닉네임
  ownerPhoto: string;// 작성자 프로필 사진
  text: string;      // 댓글 내용
  createdAt: string; // 작성 시간
}

// 🔥 [NEW] 공지사항 및 팝업용 데이터 타입 (게시판 고도화 반영)
export interface Notice {
  id: string;        // 파이어베이스 문서 ID
  title: string;     // 공지 제목
  content: string;   // 공지 내용 (텍스트 에디터)
  imageUrl?: string;   // (추가) 이미지 업로드 URL
  youtubeUrl?: string; // (추가) 유튜브 엠베드 링크
  isPopup: boolean;  // 메인 화면 팝업 노출 여부
  createdAt: string; // 작성일 (ISO String)
  
  // 🔥 인터랙션 데이터 (게시판 기능용)
  likedBy?: string[];    // 좋아요 누른 오너 ID 배열 (중복 방지)
  dislikedBy?: string[]; // 싫어요 누른 오너 ID 배열
  comments?: NoticeComment[]; // 댓글 목록
}