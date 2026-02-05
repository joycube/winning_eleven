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
// 2. 리그 매칭 알고리즘 (Best-Effort Constraints)
// ==========================================

// 라운드 내 충돌(내전) 횟수 계산
const countConflictsInRound = (matches: MatchSlot[]): number => {
    let conflicts = 0;
    for (const match of matches) {
        if (match.home.name !== 'BYE' && match.away.name !== 'BYE') {
            if (match.home.ownerName === match.away.ownerName) {
                conflicts++;
            }
        }
    }
    return conflicts;
};

// 전체 스케줄의 충돌 횟수 계산
const countTotalConflicts = (rounds: MatchSlot[][]): number => {
    return rounds.reduce((sum, round) => sum + countConflictsInRound(round), 0);
};

// 백트래킹 + 최선 노력(Best Effort) 리그 일정 생성기
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
    
    // 최대 시도 횟수
    const MAX_ATTEMPTS = 5000;
    
    let bestSchedule: MatchSlot[][] | null = null;
    let minConflicts = Infinity;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        // 매 시도마다 팀 순서를 섞음
        const shuffledTeams = shuffleArray([...scheduleTeams]);
        const fixedTeam = shuffledTeams[0];
        const rotatingTeams = shuffledTeams.slice(1);

        const currentSchedule: MatchSlot[][] = [];
        
        // 라운드 로빈 생성 (Circle Method)
        for (let r = 0; r < roundsPerCycle; r++) {
            const currentRoundMatches: MatchSlot[] = [];
            
            // 첫 번째 매치
            currentRoundMatches.push({ home: fixedTeam, away: rotatingTeams[0] });

            // 나머지 매치
            for (let i = 1; i < matchesPerRound; i++) {
                const home = rotatingTeams[i];
                const away = rotatingTeams[rotatingTeams.length - i];
                currentRoundMatches.push({ home, away });
            }

            currentSchedule.push(currentRoundMatches);
            
            // 회전
            rotatingTeams.push(rotatingTeams.shift()!);
        }

        // 이번 스케줄의 충돌(내전) 횟수 확인
        const totalConflicts = countTotalConflicts(currentSchedule);

        // 1. 충돌이 0이면 즉시 반환 (완벽한 스케줄)
        if (totalConflicts === 0) {
            if (!isDouble) return currentSchedule;
            const returnRounds = currentSchedule.map(round => 
                round.map(match => ({ home: match.away, away: match.home }))
            );
            return [...currentSchedule, ...returnRounds];
        }

        // 2. 완벽하진 않지만, 지금까지 중 가장 좋은 스케줄이라면 저장
        if (totalConflicts < minConflicts) {
            minConflicts = totalConflicts;
            bestSchedule = currentSchedule;
        }
    }

    // 완벽한 해를 못 찾았다면, 시도했던 것 중 가장 내전이 적은 스케줄 반환
    console.warn(`⚠️ 완벽한 대진표 생성 실패. 최소 충돌(${minConflicts}회) 스케줄을 사용합니다.`);
    
    if (!bestSchedule) {
        // 혹시라도 bestSchedule이 없으면 기본 로직(Fallback) 실행
        return generateLeagueScheduleFallback(teams, isDouble);
    }

    if (!isDouble) return bestSchedule;
    
    const returnRounds = bestSchedule.map(round => 
        round.map(match => ({ home: match.away, away: match.home }))
    );
    return [...bestSchedule, ...returnRounds];
};

// 최후의 수단 (단순 순차 생성)
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

// 분할 정복 시딩
const distributeTeamsSmartly = (teams: Team[], targetSize: number): Team[] => {
    const slots: (Team | null)[] = new Array(targetSize).fill(null);
    const ownerGroups = groupTeamsByOwner(teams);
    
    // 오너별 팀 많은 순으로 정렬
    const sortedOwners = Object.keys(ownerGroups).sort((a, b) => ownerGroups[b].length - ownerGroups[a].length);

    // 비트 리버스 순열 (Bit-Reversal Permutation)
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

// [Helper] 토너먼트 단계 이름 (English)
export const getTournamentStageName = (totalTeams: number, matchIndex: number): string => {
    if (matchIndex === totalTeams - 1) return '3rd Place Match'; 

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

// [Helper] 토너먼트 경기 라벨 (English)
export const getTournamentMatchLabel = (totalTeams: number, matchIndex: number): string => {
    if (matchIndex === totalTeams - 1) return '3rd Place';

    let roundMatches = totalTeams / 2;
    let currentIdx = matchIndex;
    
    while (currentIdx >= roundMatches) {
        currentIdx -= roundMatches;
        roundMatches /= 2;
    }
    
    if (roundMatches === 1) return 'Final';
    
    let stagePrefix = '';
    if (roundMatches === 2) stagePrefix = 'Semi-Final';
    else if (roundMatches === 4) stagePrefix = 'Quarter-Final';
    else stagePrefix = `Ro${roundMatches * 2}`; // Ro16, Ro32

    return `${stagePrefix} ${currentIdx + 1}`;
};


export const generateRoundsLogic = (season: Season): Round[] => {
    const teams = season.teams || [];
    const teamCount = teams.length;
    if (teamCount < 2) return [];

    let rounds: Round[] = [];

    // [TYPE 1] 리그 모드 (풀리그)
    if (season.type === 'LEAGUE') {
        const isDouble = season.leagueMode === 'DOUBLE';
        
        // 1. 최적화된 리그 스케줄 생성 (Best-Effort)
        const schedule = generateLeagueSchedule(teams, isDouble);
        
        // 2. Round 포맷 변환 및 영문 표기 적용
        schedule.forEach((matches, rIndex) => {
            const roundMatches: Match[] = matches
                .filter(m => m.home.name !== 'BYE' && m.away.name !== 'BYE')
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
                    stage: `ROUND ${rIndex+1}`, // English Style
                    matchLabel: `Game ${mIndex+1}`, // English Style
                    homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: []
                }));

            if (roundMatches.length > 0) {
                rounds.push({
                    round: rIndex + 1,
                    name: `ROUND ${rIndex + 1}`, // English Style
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
                status: (home.name === 'BYE' || away.name === 'BYE') ? 'BYE' : 'UPCOMING',
                youtubeUrl: '', 
                stage: stageName,
                matchLabel: labelName,
                homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [],
                nextMatchId: hasNext ? `${season.id}_M${nextMatchIdx}` : null,
            });
        }

        // 3/4위전 추가
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
                    stage: '3rd Place Match', // English Style
                    matchLabel: '3rd Place', // English Style
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