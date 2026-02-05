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
// 2. 리그 매칭 알고리즘 (내전 삭제 로직 포함)
// ==========================================

// 조건 검증기: 특정 라운드의 매치업들이 유효한가?
const isValidRound = (matches: MatchSlot[]): boolean => {
    for (const match of matches) {
        if (match.home.name !== 'BYE' && match.away.name !== 'BYE') {
            if (match.home.ownerName === match.away.ownerName) return false;
        }
    }
    return true;
};

// 리그 일정 생성기
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
    // 내전 횟수가 적은 스케줄을 찾기 위한 변수 (초기값 무한대)
    let minConflicts = Infinity; 

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const shuffledTeams = shuffleArray([...scheduleTeams]);
        const fixedTeam = shuffledTeams[0];
        const rotatingTeams = shuffledTeams.slice(1);

        const currentSchedule: MatchSlot[][] = [];
        let currentConflicts = 0;
        
        // 라운드 로빈 생성
        for (let r = 0; r < roundsPerCycle; r++) {
            const currentRoundMatches: MatchSlot[] = [];
            
            currentRoundMatches.push({ home: fixedTeam, away: rotatingTeams[0] });

            for (let i = 1; i < matchesPerRound; i++) {
                const home = rotatingTeams[i];
                const away = rotatingTeams[rotatingTeams.length - i];
                currentRoundMatches.push({ home, away });
            }

            // 내전 발생 여부 카운트 (삭제를 위해 기록)
            for(const m of currentRoundMatches) {
                if(m.home.name !== 'BYE' && m.away.name !== 'BYE' && m.home.ownerName === m.away.ownerName) {
                    currentConflicts++;
                }
            }

            currentSchedule.push(currentRoundMatches);
            rotatingTeams.push(rotatingTeams.shift()!);
        }

        // 1. 내전이 0개인 완벽한 스케줄 발견 시 즉시 사용
        if (currentConflicts === 0) {
            bestSchedule = currentSchedule;
            break; 
        }

        // 2. 완벽하진 않지만, 지금까지 중 내전이 가장 적은 스케줄 저장
        if (currentConflicts < minConflicts) {
            minConflicts = currentConflicts;
            bestSchedule = currentSchedule;
        }
    }

    // 최적의 스케줄이 없으면 기본 로직(Fallback) 사용
    if (!bestSchedule) {
        console.warn("⚠️ 최적 스케줄 생성 실패, 기본 로직 사용");
        bestSchedule = generateLeagueScheduleFallback(teams, isDouble);
    }

    // 더블 라운드 처리
    let fullSchedule = [...bestSchedule];
    if (isDouble) {
        const returnRounds = bestSchedule.map(round => 
            round.map(match => ({ home: match.away, away: match.home }))
        );
        fullSchedule = [...bestSchedule, ...returnRounds];
    }

    // 🔥 [핵심 로직] 생성된 스케줄에서 '내전 경기'만 필터링하여 삭제
    const filteredSchedule = fullSchedule.map(round => {
        return round.filter(match => {
            // BYE 제거
            if (match.home.name === 'BYE' || match.away.name === 'BYE') return false;
            // 내전 제거 (같은 오너끼리 경기 삭제)
            if (match.home.ownerName === match.away.ownerName) return false;
            return true;
        });
    }).filter(round => round.length > 0); // 경기가 하나도 없는 빈 라운드는 제거

    return filteredSchedule;
};

// 실패 시 사용하는 기본 로직
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
    return rounds; // Fallback에서는 더블 처리를 위에서 함
}


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
    else stagePrefix = `Ro${roundMatches * 2}`; 

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
        
        // 🔥 [수정] 내전이 삭제된 스케줄 생성
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