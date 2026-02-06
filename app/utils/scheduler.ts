import { Season, Team, Match, Round, FALLBACK_IMG } from '../types';

// ==========================================
// 1. 공통 타입 및 유틸리티
// ==========================================

export interface MatchSlot {
    home: Team;
    away: Team;
}

const shuffleArray = <T>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

// ==========================================
// 2. 리그 매칭 알고리즘 (Randomized Greedy - 최적화됨)
// ==========================================

export const generateLeagueSchedule = (teams: Team[], isDouble: boolean): MatchSlot[][] | null => {
    // A. 오너가 다를 때만 매치 풀 생성 (내전 원천 차단)
    let allMatches: MatchSlot[] = [];
    for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
            if (teams[i].ownerName !== teams[j].ownerName) {
                allMatches.push({ home: teams[i], away: teams[j] });
                if (isDouble) {
                    allMatches.push({ home: teams[j], away: teams[i] });
                }
            }
        }
    }

    const matchesPerRound = Math.floor(teams.length / 2);
    
    // B. 무작위 탐욕 알고리즘 (속도 및 안정성 해결)
    // - 기존 백트래킹보다 수천 배 빠름
    // - 최대 100번 시도하며, 막히면 즉시 버리고 다시 섞어서 시도함.
    for (let attempt = 0; attempt < 100; attempt++) {
        let pool = shuffleArray([...allMatches]); // 매번 다르게 섞음 (균등 분산 유도)
        const rounds: MatchSlot[][] = [];
        let isFail = false;

        // 풀이 빌 때까지 라운드 생성
        while (pool.length > 0) {
            const currentRound: MatchSlot[] = [];
            const busyTeams = new Set<string>();
            const nextPool: MatchSlot[] = [];

            // 이번 라운드 채우기
            for (const match of pool) {
                // 라운드가 꽉 차지 않았고, 두 팀 모두 이번 라운드에 경기가 없다면 배정
                if (currentRound.length < matchesPerRound && 
                    !busyTeams.has(match.home.name) && !busyTeams.has(match.away.name)) {
                    
                    currentRound.push(match);
                    busyTeams.add(match.home.name);
                    busyTeams.add(match.away.name);
                } else {
                    nextPool.push(match); // 다음 라운드로 이월
                }
            }

            // 더 이상 배정할 수 없는데 경기가 남았다면? -> 교착 상태(Deadlock) -> 즉시 실패 처리 후 재시도
            if (currentRound.length === 0 && pool.length > 0) {
                isFail = true;
                break;
            }

            rounds.push(currentRound);
            pool = nextPool;
        }

        // 성공했다면 결과 반환
        if (!isFail) return rounds;
    }

    // 100번 시도해도 실패한 경우 (팀 구성이 수학적으로 불가능에 가까움) -> null 반환하여 에러 처리 유도
    return null; 
};

// ==========================================
// 3. 토너먼트 시딩 알고리즘 (Smart Seeding)
// ==========================================

const distributeTeamsSmartly = (teams: Team[], targetSize: number): Team[] => {
    const slots: (Team | null)[] = new Array(targetSize).fill(null);
    const ownerGroups = teams.reduce((acc, team) => {
        if (!acc[team.ownerName]) acc[team.ownerName] = [];
        acc[team.ownerName].push(team);
        return acc;
    }, {} as Record<string, Team[]>);

    const sortedOwners = Object.keys(ownerGroups).sort((a, b) => ownerGroups[b].length - ownerGroups[a].length);
    
    // 비트 리버스 오더
    const getOrder = (n: number) => {
        const res = [];
        const bits = Math.log2(n);
        for (let i = 0; i < n; i++) {
            let rev = 0, temp = i;
            for (let b = 0; b < bits; b++) { rev = (rev << 1) | (temp & 1); temp >>= 1; }
            res.push(rev);
        }
        return res;
    };

    const order = getOrder(targetSize);
    let currentIdx = 0;

    sortedOwners.forEach(owner => {
        ownerGroups[owner].forEach(team => {
            while (slots[order[currentIdx]] !== null) { currentIdx = (currentIdx + 1) % targetSize; }
            slots[order[currentIdx]] = team;
        });
    });

    return slots.map(t => t || { id: -1, name: 'BYE', logo: FALLBACK_IMG, ownerName: '-', seasonId: 0, region: '', tier: '', win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0 });
};

// ==========================================
// 4. 메인 통합 로직 (수정됨)
// ==========================================

export const generateRoundsLogic = (season: Season): Round[] => {
    const teams = season.teams || [];
    if (teams.length < 2) return [];

    if (season.type === 'LEAGUE') {
        const schedule = generateLeagueSchedule(teams, season.leagueMode === 'DOUBLE');
        
        // 🚨 중요: 스케줄 생성 실패 시 빈 배열 반환 (기존처럼 이상한 데이터를 욱여넣지 않음)
        if (!schedule) {
            console.error("스케줄 생성 실패: 조건을 만족하는 대진표를 만들 수 없습니다.");
            return [];
        }

        return schedule.map((matches, rIdx) => ({
            round: rIdx + 1,
            name: `ROUND ${rIdx + 1}`,
            seasonId: season.id,
            matches: matches.map((m, mIdx) => ({
                id: `${season.id}_R${rIdx+1}_M${mIdx}`,
                seasonId: season.id,
                home: m.home.name, away: m.away.name,
                homeLogo: m.home.logo, awayLogo: m.away.logo,
                homeOwner: m.home.ownerName, awayOwner: m.away.ownerName,
                status: 'UPCOMING', stage: `ROUND ${rIdx+1}`, matchLabel: `Game ${mIdx+1}`,
                homeScore: '', awayScore: '', youtubeUrl: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: []
            }))
        }));
    } else {
        // 토너먼트 로직
        const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(teams.length)));
        const seeded = distributeTeamsSmartly(teams, nextPowerOf2);
        const matches: Match[] = [];
        
        for (let i = 0; i < nextPowerOf2 - 1; i++) {
            const isFirst = i < nextPowerOf2 / 2;
            matches.push({
                id: `${season.id}_M${i}`,
                seasonId: season.id,
                home: isFirst ? seeded[i*2].name : 'TBD',
                away: isFirst ? seeded[i*2+1].name : 'TBD',
                homeLogo: isFirst ? seeded[i*2].logo : FALLBACK_IMG,
                awayLogo: isFirst ? seeded[i*2+1].logo : FALLBACK_IMG,
                homeOwner: isFirst ? seeded[i*2].ownerName : 'TBD',
                awayOwner: isFirst ? seeded[i*2+1].ownerName : 'TBD',
                status: (isFirst && (seeded[i*2].name === 'BYE' || seeded[i*2+1].name === 'BYE')) ? 'BYE' : 'UPCOMING',
                homeScore: '', awayScore: '', stage: 'TOURNAMENT', matchLabel: `Match ${i+1}`,
                youtubeUrl: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: []
            });
        }
        return [{ round: 1, name: 'Tournament Bracket', seasonId: season.id, matches }];
    }
};