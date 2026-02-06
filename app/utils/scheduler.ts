import { Season, Team, Match, Round, FALLBACK_IMG } from '../types';

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

/**
 * [엄격한 라운드 배정] 리그 매칭 알고리즘
 * - 목표: 모든 라운드의 경기 수를 균일하게(꽉 채워서) 생성
 * - 방식: 무작위 재시작 (Random Restart)
 * -> 한 라운드라도 꽉 차지 않으면 즉시 실패 처리하고 처음부터 다시 시도
 */
export const generateLeagueSchedule = (teams: Team[], isDouble: boolean): MatchSlot[][] | null => {
    let allMatches: MatchSlot[] = [];
    
    // 1. 매치 풀 생성 (내전 방지)
    for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
            if (teams[i].ownerName !== teams[j].ownerName) {
                allMatches.push({ home: teams[i], away: teams[j] });
                if (isDouble) allMatches.push({ home: teams[j], away: teams[i] });
            }
        }
    }

    const matchesPerRound = Math.floor(teams.length / 2);
    
    // 최대 2000번 시도 (속도가 매우 빠르므로 횟수를 늘려 성공률을 높임)
    for (let attempt = 0; attempt < 2000; attempt++) {
        // 매 시도마다 매치 풀을 랜덤하게 섞음
        let pool = shuffleArray([...allMatches]);
        const rounds: MatchSlot[][] = [];
        let isSuccess = true;

        // 풀이 빌 때까지 라운드 생성
        while (pool.length > 0) {
            const currentRound: MatchSlot[] = [];
            const busyTeams = new Set<string>();
            
            // 이번 라운드에 들어갈 경기를 찾음
            // 중요: 순차적으로 돌면서 '꽉 채울 수 있는지' 확인
            for (let i = 0; i < pool.length; i++) {
                const match = pool[i];
                
                // 라운드가 아직 꽉 차지 않았고, 해당 팀들이 이번 라운드에 경기가 없다면 배정
                if (currentRound.length < matchesPerRound) {
                    if (!busyTeams.has(match.home.name) && !busyTeams.has(match.away.name)) {
                        currentRound.push(match);
                        busyTeams.add(match.home.name);
                        busyTeams.add(match.away.name);
                    }
                } else {
                    // 라운드가 꽉 찼으면 더 이상 탐색 중단
                    break;
                }
            }

            // 🔥 [핵심 로직]
            // 만약 이번 라운드를 꽉 채우지 못했는데(팀 수 절반 미만),
            // 아직 남은 경기가 있다면? -> 이 시도는 '균일한 스케줄' 실패임.
            // (마지막 짜투리 라운드는 허용)
            const remainingCount = pool.length - currentRound.length;
            if (currentRound.length < matchesPerRound && remainingCount > 0) {
                isSuccess = false;
                break; // 즉시 이 시도를 버림
            }

            // 성공적으로 라운드를 채웠다면 결과에 추가하고 풀에서 제거
            rounds.push(currentRound);
            
            // 현재 라운드에 배정된 경기들을 풀에서 제거
            // (filter를 쓰면 느리므로 Set이나 ID 비교 등을 쓸 수 있으나, 
            // 여기서는 직관적인 filter 사용. 데이터가 작아서 성능 문제 없음)
            pool = pool.filter(p => !currentRound.includes(p));
        }

        // 모든 라운드가 성공적으로 균일하게 만들어졌다면 반환
        if (isSuccess) return rounds;
    }

    return null; // 실패 시
};

// ... generateRoundsLogic 및 distributeTeamsSmartly 등 나머지 코드는 그대로 유지 ...
export const generateRoundsLogic = (season: Season): Round[] => {
    const teams = season.teams || [];
    if (teams.length < 2) return [];

    if (season.type === 'LEAGUE') {
        // null 체크를 위해 반환 타입 수정이 필요할 수 있으나, 
        // 기존 코드와의 호환성을 위해 실패 시 빈 배열([]) 반환으로 처리
        const schedule = generateLeagueSchedule(teams, season.leagueMode === 'DOUBLE');
        
        if (!schedule) {
            console.error("균일한 스케줄 생성 실패 (조건이 너무 까다로움)");
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
        // 토너먼트 로직 (기존 유지)
        const distributeTeamsSmartly = (teams: Team[], targetSize: number): Team[] => {
            const slots: (Team | null)[] = new Array(targetSize).fill(null);
            const ownerGroups = teams.reduce((acc, team) => {
                if (!acc[team.ownerName]) acc[team.ownerName] = [];
                acc[team.ownerName].push(team);
                return acc;
            }, {} as Record<string, Team[]>);
        
            const sortedOwners = Object.keys(ownerGroups).sort((a, b) => ownerGroups[b].length - ownerGroups[a].length);
            
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