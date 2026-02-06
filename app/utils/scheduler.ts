import { Season, Team, Match, Round, FALLBACK_IMG } from '../types';

// ==========================================
// 1. 공통 유틸리티 및 타입 정의
// ==========================================

interface MatchSlot {
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
// 2. 리그 매칭 알고리즘 (백트래킹 & 풀 소진)
// ==========================================

/**
 * 4x1, 4x2, 4x3 등 '완벽한 스케줄'이 가능한 경우 최소 라운드에 맞춤.
 * 4x4 처럼 빡빡한 경우(예외)에는 라운드를 늘려서라도 안전하게 생성.
 */
const generateLeagueSchedule = (teams: Team[], isDouble: boolean): MatchSlot[][] => {
    // A. 모든 가능한 매치업 생성 (내전 제외)
    let allMatches: MatchSlot[] = [];
    
    for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
            const t1 = teams[i];
            const t2 = teams[j];
            
            // 🔥 핵심: 오너가 다를 때만 매치 생성 (내전 방지)
            if (t1.ownerName !== t2.ownerName) {
                allMatches.push({ home: t1, away: t2 });
                if (isDouble) {
                    allMatches.push({ home: t2, away: t1 });
                }
            }
        }
    }

    const totalMatches = allMatches.length;
    const matchesPerRound = Math.floor(teams.length / 2);
    
    // 최소 라운드 계산 (이론상 값)
    // 예: 4x2(8팀) -> 24경기 / 4경기perR = 6라운드
    let minRounds = Math.ceil(totalMatches / matchesPerRound);
    
    // 홀수 팀일 경우, 각 팀은 (라운드 수 - 경기 수) 만큼 휴식.
    // 보통 팀 수만큼의 라운드가 필요함 (또는 그 이상)
    if (teams.length % 2 !== 0) {
        // 홀수 팀은 최소 팀 수만큼의 라운드가 필요
        // (각 팀이 모든 상대와 붙으려면)
        // 하지만 여기선 '오너간 대결'이므로 다를 수 있음. 
        // 안전하게 계산된 minRounds 사용하되, 홀수면 +@ 보정 가능성 열어둠
    }

    // B. 스케줄 생성 함수 (시도용)
    const tryCreateSchedule = (roundLimit: number): MatchSlot[][] | null => {
        let pool = shuffleArray([...allMatches]);
        const rounds: MatchSlot[][] = [];

        for (let r = 0; r < roundLimit; r++) {
            const roundMatches: MatchSlot[] = [];
            const teamsInRound = new Set<string>();
            const nextPool: MatchSlot[] = [];

            // 이번 라운드 채우기 (Greedy)
            for (const m of pool) {
                // 라운드가 꽉 찼으면 스킵
                if (roundMatches.length >= matchesPerRound) {
                    nextPool.push(m);
                    continue;
                }

                if (!teamsInRound.has(m.home.name) && !teamsInRound.has(m.away.name)) {
                    roundMatches.push(m);
                    teamsInRound.add(m.home.name);
                    teamsInRound.add(m.away.name);
                } else {
                    nextPool.push(m);
                }
            }

            // 짝수 팀인데 라운드를 꽉 못 채웠다면? -> 실패로 간주 (완벽한 압축을 위해)
            // 단, 마지막 라운드 근처거나, 4x4 같은 예외 케이스는 허용해야 함.
            // 여기서는 '엄격 모드'로 체크
            
            rounds.push(roundMatches);
            pool = nextPool;

            if (pool.length === 0) break;
        }

        if (pool.length === 0) return rounds;
        return null; // 실패 (잔여 경기 남음)
    };

    // C. 메인 실행 루프
    // 1단계: 이론상 최소 라운드로 시도 (4x2, 4x3 등은 여기서 성공함)
    for (let i = 0; i < 2000; i++) {
        const result = tryCreateSchedule(minRounds);
        if (result) return result; // 성공하면 바로 리턴
    }

    // 2단계: 예외 상황 (4x4 등) -> 라운드 제한 풀고 안전하게 생성
    // "Fallback" - 그냥 매치 풀 빌 때까지 계속 라운드 만듦 (13, 14라운드 ...)
    let finalPool = shuffleArray([...allMatches]);
    const safeRounds: MatchSlot[][] = [];
    
    while (finalPool.length > 0) {
        const currentRound: MatchSlot[] = [];
        const teamsInRound = new Set<string>();
        const remaining: MatchSlot[] = [];

        for (const m of finalPool) {
            if (!teamsInRound.has(m.home.name) && !teamsInRound.has(m.away.name)) {
                currentRound.push(m);
                teamsInRound.add(m.home.name);
                teamsInRound.add(m.away.name);
            } else {
                remaining.push(m);
            }
        }
        
        if (currentRound.length > 0) safeRounds.push(currentRound);
        else {
            // 더 이상 배정 불가한 교착 상태 (거의 없지만 방어코드)
            if (remaining.length > 0) {
                 // 강제로 하나 넣고 다음 라운드로 미룸
                 safeRounds.push([remaining[0]]);
                 remaining.shift();
            }
        }
        finalPool = remaining;
    }

    return safeRounds;
};


// ==========================================
// 3. 토너먼트 시딩 알고리즘 (Smart Seeding)
// ==========================================

const groupTeamsByOwner = (teams: Team[]): Record<string, Team[]> => {
    return teams.reduce((acc, team) => {
        if (!acc[team.ownerName]) acc[team.ownerName] = [];
        acc[team.ownerName].push(team);
        return acc;
    }, {} as Record<string, Team[]>);
};

const distributeTeamsSmartly = (teams: Team[], targetSize: number): Team[] => {
    const slots: (Team | null)[] = new Array(targetSize).fill(null);
    const ownerGroups = groupTeamsByOwner(teams);
    const sortedOwners = Object.keys(ownerGroups).sort((a, b) => ownerGroups[b].length - ownerGroups[a].length);

    // 비트 리버스 순서 (1, 8, 4, 5... 처럼 멀리 떨어뜨리는 순서)
    const bitReversePermutation = (n: number): number[] => {
        const result: number[] = [];
        const bits = Math.log2(n);
        for (let i = 0; i < n; i++) {
            let reversed = 0;
            let temp = i;
            for (let b = 0; b < bits; b++) {
                reversed = (reversed << 1) | (temp & 1);
                temp >>= 1;
            }
            result.push(reversed);
        }
        return result;
    }

    const order = bitReversePermutation(targetSize);
    let currentOrderIdx = 0;

    sortedOwners.forEach(owner => {
        const myTeams = ownerGroups[owner];
        myTeams.forEach(team => {
            // 빈 자리 찾아서 넣기
            while (slots[order[currentOrderIdx]] !== null) {
                currentOrderIdx = (currentOrderIdx + 1) % targetSize;
            }
            slots[order[currentOrderIdx]] = team;
        });
    });

    return slots.map(t => 
        t ? t : { id: -1, name: 'BYE', logo: FALLBACK_IMG, ownerName: '-', seasonId: 0, region: '', tier: '', win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0 }
    );
};


// ==========================================
// 4. 메인 로직: generateRoundsLogic
// ==========================================

export const getTournamentStageName = (totalTeams: number, matchIndex: number): string => {
    // 결승전 및 3,4위전 처리
    const totalMainMatches = totalTeams - 1;
    if (matchIndex === totalMainMatches) return '3rd Place Match'; // 3-4위전
    
    // 라운드 계산
    let roundMatches = totalTeams / 2;
    let currentIdx = matchIndex;
    
    while (currentIdx >= roundMatches) {
        currentIdx -= roundMatches;
        roundMatches /= 2;
    }
    
    if (roundMatches === 1) return 'FINAL';
    if (roundMatches === 2) return 'SEMI-FINAL';
    if (roundMatches === 4) return 'QUARTER-FINAL';
    
    return `ROUND OF ${roundMatches * 2}`;
};

export const getTournamentMatchLabel = (totalTeams: number, matchIndex: number): string => {
    const totalMainMatches = totalTeams - 1;
    if (matchIndex === totalMainMatches) return '3rd Place';

    let roundMatches = totalTeams / 2;
    let currentIdx = matchIndex;
    
    while (currentIdx >= roundMatches) {
        currentIdx -= roundMatches;
        roundMatches /= 2;
    }
    
    if (roundMatches === 1) return 'Final';
    
    // 8강 이하는 Match 번호 붙이기
    return `Match ${currentIdx + 1}`;
};


export const generateRoundsLogic = (season: Season): Round[] => {
    const teams = season.teams || [];
    const teamCount = teams.length;
    if (teamCount < 2) return [];

    let rounds: Round[] = [];

    // [TYPE 1] 리그 모드 (풀리그)
    if (season.type === 'LEAGUE') {
        const isDouble = season.leagueMode === 'DOUBLE';
        
        // 🔥 개선된 리그 스케줄러 호출
        const schedule = generateLeagueSchedule(teams, isDouble);
        
        schedule.forEach((matches, rIndex) => {
            const roundMatches: Match[] = matches
                .map((m, mIndex) => ({
                    id: `${season.id}_R${rIndex+1}_M${mIndex}`,
                    seasonId: season.id,
                    home: m.home.name,
                    away: m.away.name,
                    homeLogo: m.home.logo,
                    awayLogo: m.away.logo,
                    homeOwner: m.home.ownerName,
                    awayOwner: m.away.ownerName,
                    homeScore: '', awayScore: '',
                    status: 'UPCOMING',
                    youtubeUrl: '', 
                    stage: `ROUND ${rIndex+1}`, 
                    matchLabel: `Game ${mIndex+1}`,
                    homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: []
                }));

            if (roundMatches.length > 0) {
                rounds.push({
                    round: rIndex + 1,
                    name: `ROUND ${rIndex + 1}`,
                    seasonId: season.id,
                    matches: roundMatches
                });
            }
        });
    } 
    // [TYPE 2] 토너먼트 모드
    else {
        const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(teamCount)));
        const seededTeams = distributeTeamsSmartly(teams, nextPowerOf2);

        const matches: Match[] = [];
        const totalMainMatches = nextPowerOf2 - 1; 
        
        for (let i = 0; i < totalMainMatches; i++) {
            const isFirstRound = i < nextPowerOf2 / 2;
            let home = { name: 'TBD', logo: FALLBACK_IMG, owner: 'TBD' };
            let away = { name: 'TBD', logo: FALLBACK_IMG, owner: 'TBD' };

            if (isFirstRound) {
                // 시드 배정된 팀 할당
                home = { 
                    name: seededTeams[i * 2].name, 
                    logo: seededTeams[i * 2].logo, 
                    owner: seededTeams[i * 2].ownerName 
                };
                away = { 
                    name: seededTeams[i * 2 + 1].name, 
                    logo: seededTeams[i * 2 + 1].logo, 
                    owner: seededTeams[i * 2 + 1].ownerName 
                };
            }

            const nextMatchIdx = Math.floor(nextPowerOf2 / 2 + i / 2);
            const hasNext = i < totalMainMatches - 1;

            const stageName = getTournamentStageName(nextPowerOf2, i);
            const labelName = getTournamentMatchLabel(nextPowerOf2, i);

            matches.push({
                id: `${season.id}_M${i}`,
                seasonId: season.id,
                home: home.name, away: away.name,
                homeLogo: home.logo, awayLogo: away.logo,
                homeOwner: home.owner, awayOwner: away.owner,
                homeScore: '', awayScore: '',
                // BYE 처리
                status: (home.name === 'BYE' || away.name === 'BYE') ? 'BYE' : 'UPCOMING',
                youtubeUrl: '', 
                stage: stageName,
                matchLabel: labelName,
                homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [],
                nextMatchId: hasNext ? `${season.id}_M${nextMatchIdx}` : null,
            });
        }

        // 3-4위전 추가 (4강 이상일 때)
        if (teamCount >= 4) {
            const finalId = `${season.id}_M${totalMainMatches - 1}`;
            const semiFinals = matches.filter(m => m.nextMatchId === finalId);
            
            if (semiFinals.length === 2) {
                const thirdPlaceId = `${season.id}_M${totalMainMatches}`;
                
                matches.push({
                    id: thirdPlaceId,
                    seasonId: season.id,
                    home: 'TBD', away: 'TBD',
                    homeLogo: FALLBACK_IMG, awayLogo: FALLBACK_IMG,
                    homeOwner: 'Loser of SF1', awayOwner: 'Loser of SF2',
                    homeScore: '', awayScore: '',
                    status: 'UPCOMING',
                    youtubeUrl: '', 
                    stage: '3rd Place Match', 
                    matchLabel: '3rd Place',
                    homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [],
                    nextMatchId: null
                });

                semiFinals.forEach(m => m.loserMatchId = thirdPlaceId);
            }
        }

        rounds.push({ round: 1, name: 'Tournament Bracket', seasonId: season.id, matches: matches });
    }

    return rounds;
};