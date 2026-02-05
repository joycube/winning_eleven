import { Season, Team, Match, Round, FALLBACK_IMG } from '../types';

// ==========================================
// 1. 공통 유틸리티 및 타입 정의
// ==========================================

interface MatchSlot {
    home: Team;
    away: Team;
}

// 셔플 함수 (피셔-예이츠)
const shuffleArray = <T>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

// ==========================================
// 2. 리그 매칭 알고리즘 (Constraints-Based)
// ==========================================

// 조건 검증기: 특정 라운드의 매치업들이 유효한가? (동일 오너 내전 금지)
const isValidRound = (matches: MatchSlot[]): boolean => {
    for (const match of matches) {
        // BYE가 아닌 경우에만 오너 체크 (BYE는 ownerName이 '-'이므로 겹칠 일 없음)
        if (match.home.name !== 'BYE' && match.away.name !== 'BYE') {
            if (match.home.ownerName === match.away.ownerName) return false;
        }
    }
    return true;
};

// 백트래킹을 이용한 리그 일정 생성기
const generateLeagueSchedule = (teams: Team[], isDouble: boolean): MatchSlot[][] => {
    // 1. 팀 수가 홀수면 BYE 추가
    const scheduleTeams = [...teams];
    if (scheduleTeams.length % 2 !== 0) {
        scheduleTeams.push({
            id: -1, name: 'BYE', logo: FALLBACK_IMG, ownerName: '-', seasonId: 0, region: '', tier: '',
            win: 0, draw: 0, loss: 0, points: 0, gf: 0, ga: 0, gd: 0
        });
    }

    const n = scheduleTeams.length;
    const roundsPerCycle = n - 1;
    const matchesPerRound = n / 2;
    
    // 최대 시도 횟수 (무한 루프 방지)
    const MAX_ATTEMPTS = 2000;
    
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        // 매 시도마다 팀 순서를 섞어서 랜덤성 부여
        const shuffledTeams = shuffleArray([...scheduleTeams]);
        const fixedTeam = shuffledTeams[0];
        const rotatingTeams = shuffledTeams.slice(1);

        const tempRounds: MatchSlot[][] = [];
        let isSuccess = true;

        // 라운드 로빈 생성
        for (let r = 0; r < roundsPerCycle; r++) {
            const currentRoundMatches: MatchSlot[] = [];
            
            // 첫 번째 매치 (고정 팀 vs 회전 팀의 첫 번째)
            currentRoundMatches.push({ home: fixedTeam, away: rotatingTeams[0] });

            // 나머지 매치
            for (let i = 1; i < matchesPerRound; i++) {
                const home = rotatingTeams[i];
                const away = rotatingTeams[rotatingTeams.length - i];
                currentRoundMatches.push({ home, away });
            }

            // 이번 라운드가 유효한지 검증 (내전 체크)
            if (!isValidRound(currentRoundMatches)) {
                isSuccess = false;
                break; // 실패하면 바로 다음 시도로
            }

            tempRounds.push(currentRoundMatches);

            // 회전 (맨 앞을 맨 뒤로)
            rotatingTeams.push(rotatingTeams.shift()!);
        }

        if (isSuccess) {
            // 성공했다면 더블 라운드 처리 및 반환
            if (!isDouble) return tempRounds;

            // 더블 라운드: 홈/어웨이 반전하여 추가
            const returnRounds = tempRounds.map(round => 
                round.map(match => ({ home: match.away, away: match.home }))
            );
            return [...tempRounds, ...returnRounds];
        }
    }

    // 실패 시 (조건이 너무 까다로워 완벽한 해가 없을 때)
    console.warn("⚠️ 조건을 완벽히 만족하는 대진표를 찾지 못했습니다. 기본 로직으로 생성합니다.");
    return generateLeagueScheduleFallback(teams, isDouble);
};

// 실패 시 사용하는 기본 로직 (단순 회전, 내전 허용)
const generateLeagueScheduleFallback = (teams: Team[], isDouble: boolean): MatchSlot[][] => {
    const scheduleTeams = [...teams];
    if (scheduleTeams.length % 2 !== 0) scheduleTeams.push({ id: -1, name: 'BYE', logo: FALLBACK_IMG, ownerName: '-', seasonId: 0, region: '', tier: '', win: 0, draw: 0, loss: 0, points: 0, gf: 0, ga: 0, gd: 0 });
    
    const n = scheduleTeams.length;
    const rounds: MatchSlot[][] = [];
    const rotating = scheduleTeams.slice(1);
    const fixed = scheduleTeams[0];

    for(let r=0; r < n-1; r++) {
        const round: MatchSlot[] = [];
        round.push({ home: fixed, away: rotating[0] });
        for(let i=1; i<n/2; i++) {
            round.push({ home: rotating[i], away: rotating[rotating.length-i] });
        }
        rounds.push(round);
        rotating.push(rotating.shift()!);
    }
    if(isDouble) {
        const returnRounds = rounds.map(r => r.map(m => ({ home: m.away, away: m.home })));
        return [...rounds, ...returnRounds];
    }
    return rounds;
}


// ==========================================
// 3. 토너먼트 시딩 알고리즘 (Smart Seeding)
// ==========================================

// 오너별로 팀을 그룹화
const groupTeamsByOwner = (teams: Team[]): Record<string, Team[]> => {
    return teams.reduce((acc, team) => {
        if (!acc[team.ownerName]) acc[team.ownerName] = [];
        acc[team.ownerName].push(team);
        return acc;
    }, {} as Record<string, Team[]>);
};

// 분할 정복 시딩: 같은 오너 팀을 트리 상에서 최대한 멀리 배치
const distributeTeamsSmartly = (teams: Team[], targetSize: number): Team[] => {
    const slots: (Team | null)[] = new Array(targetSize).fill(null);
    const ownerGroups = groupTeamsByOwner(teams);
    
    // 오너별 팀 많은 순으로 정렬
    const sortedOwners = Object.keys(ownerGroups).sort((a, b) => ownerGroups[b].length - ownerGroups[a].length);

    // 비트 리버스 순열 사용 (가장 멀리 떨어진 인덱스 순서 생성)
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

    const order = bitReversePermutation(targetSize); // [0, 8, 4, 12, 2, 10...] 식의 순서
    let currentOrderIdx = 0;

    // 오너별로 팀을 하나씩 순서대로 배치 (Distribute)
    sortedOwners.forEach(owner => {
        const myTeams = ownerGroups[owner];
        myTeams.forEach(team => {
            // 빈 자리를 찾을 때까지 order 배열 순회
            while (slots[order[currentOrderIdx]] !== null) {
                currentOrderIdx = (currentOrderIdx + 1) % targetSize;
            }
            slots[order[currentOrderIdx]] = team;
        });
    });

    // 남은 빈자리는 BYE 팀으로 채우기
    return slots.map(t => 
        t ? t : { id: -1, name: 'BYE', logo: FALLBACK_IMG, ownerName: '-', seasonId: 0, region: '', tier: '', win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0 }
    );
};


// ==========================================
// 4. 메인 로직: generateRoundsLogic
// ==========================================

export const getTournamentStageName = (totalTeams: number, matchIndex: number): string => {
    // 4강 이상일 때, 마지막 매치는 3/4위전일 가능성이 높음 (호출부에서 처리하지만 방어적으로 추가)
    if (matchIndex === totalTeams - 1) return '3rd Place Match'; 

    if (totalTeams === 8) { // 8강 (7경기 + 3/4위전 = 8경기)
        if (matchIndex < 4) return 'Quarter-Final';
        if (matchIndex < 6) return 'Semi-Final';
        if (matchIndex === 6) return 'Final';
        return '3rd Place Match';
    }
    if (totalTeams === 4) { // 4강 (3경기 + 3/4위전 = 4경기)
        if (matchIndex < 2) return 'Semi-Final';
        if (matchIndex === 2) return 'Final';
        return '3rd Place Match';
    }
    
    const totalMainMatches = totalTeams - 1;
    if (matchIndex === totalMainMatches) return '3rd Place Match';
    
    let roundMatches = totalTeams / 2;
    let currentIdx = matchIndex;
    
    while (currentIdx >= roundMatches) {
        currentIdx -= roundMatches;
        roundMatches /= 2;
    }
    
    if (roundMatches === 1) return 'Final';
    if (roundMatches === 2) return 'Semi-Final';
    if (roundMatches === 4) return 'Quarter-Final';
    
    return `Round of ${roundMatches * 2}`;
};

export const generateRoundsLogic = (season: Season): Round[] => {
    const teams = season.teams || [];
    const teamCount = teams.length;
    if (teamCount < 2) return [];

    let rounds: Round[] = [];

    // [TYPE 1] 리그 모드 (풀리그)
    if (season.type === 'LEAGUE') {
        const isDouble = season.leagueMode === 'DOUBLE';
        
        // 1. 내전 회피 스케줄 생성
        const schedule = generateLeagueSchedule(teams, isDouble);
        
        // 2. Round 포맷으로 변환
        schedule.forEach((matches, rIndex) => {
            const roundMatches: Match[] = matches
                .filter(m => m.home.name !== 'BYE' && m.away.name !== 'BYE') // BYE 제거
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
                    stage: 'Regular Season',
                    matchLabel: `R${rIndex+1}`,
                    homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: []
                }));

            if (roundMatches.length > 0) {
                rounds.push({
                    round: rIndex + 1,
                    name: `Round ${rIndex + 1}`,
                    seasonId: season.id,
                    matches: roundMatches
                });
            }
        });
    } 
    // [TYPE 2] 토너먼트 모드
    else {
        // 1. 대진표 크기 설정 (2의 제곱수)
        const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(teamCount)));
        
        // 2. 스마트 시딩 (오너 분산 배치)
        const seededTeams = distributeTeamsSmartly(teams, nextPowerOf2);

        const matches: Match[] = [];
        const totalMainMatches = nextPowerOf2 - 1; // 결승까지의 경기 수
        
        for (let i = 0; i < totalMainMatches; i++) {
            const isFirstRound = i < nextPowerOf2 / 2;
            let home = { name: 'TBD', logo: FALLBACK_IMG, owner: 'TBD' };
            let away = { name: 'TBD', logo: FALLBACK_IMG, owner: 'TBD' };

            // 첫 라운드 팀 할당
            if (isFirstRound) {
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

            // 다음 경기 ID 계산
            const nextMatchIdx = Math.floor(nextPowerOf2 / 2 + i / 2);
            const hasNext = i < totalMainMatches - 1;

            matches.push({
                id: `${season.id}_M${i}`,
                seasonId: season.id,
                home: home.name, away: away.name,
                homeLogo: home.logo, awayLogo: away.logo,
                homeOwner: home.owner, awayOwner: away.owner,
                homeScore: '', awayScore: '',
                status: (home.name === 'BYE' || away.name === 'BYE') ? 'BYE' : 'UPCOMING',
                youtubeUrl: '', 
                stage: getTournamentStageName(nextPowerOf2, i),
                matchLabel: `Match ${i+1}`,
                homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [],
                nextMatchId: hasNext ? `${season.id}_M${nextMatchIdx}` : null,
            });
        }

        // 3. 3/4위전 매치 추가 (총 4팀 이상일 때만)
        if (teamCount >= 4) {
            const finalId = `${season.id}_M${totalMainMatches - 1}`;
            // 결승전으로 가는 두 경기(준결승)를 찾음
            const semiFinals = matches.filter(m => m.nextMatchId === finalId);
            
            if (semiFinals.length === 2) {
                const thirdPlaceId = `${season.id}_M${totalMainMatches}`; // ID: 마지막 인덱스
                
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

                // 준결승 매치에 loserMatchId 연결
                semiFinals.forEach(m => m.loserMatchId = thirdPlaceId);
            }
        }

        rounds.push({ round: 1, name: 'Tournament Bracket', seasonId: season.id, matches: matches });
    }

    return rounds;
};