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
// 2. 리그 매칭 알고리즘 (내전 방지 + 백트래킹)
// ==========================================

export const generateLeagueSchedule = (teams: Team[], isDouble: boolean): MatchSlot[][] => {
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
    const roundLimit = teams.length % 2 === 0 ? Math.ceil(allMatches.length / matchesPerRound) : teams.length + 2;

    // B. 백트래킹을 이용한 라운드 배정
    const solve = (remainingMatches: MatchSlot[], currentRounds: MatchSlot[][]): MatchSlot[][] | null => {
        if (remainingMatches.length === 0) return currentRounds;
        
        let rIdx = 0;
        while (rIdx < roundLimit) {
            if (!currentRounds[rIdx]) currentRounds[rIdx] = [];
            if (currentRounds[rIdx].length >= matchesPerRound) {
                rIdx++;
                continue;
            }

            const busyTeams = new Set<string>();
            currentRounds[rIdx].forEach(m => {
                busyTeams.add(m.home.name);
                busyTeams.add(m.away.name);
            });

            for (let i = 0; i < remainingMatches.length; i++) {
                const match = remainingMatches[i];
                if (!busyTeams.has(match.home.name) && !busyTeams.has(match.away.name)) {
                    currentRounds[rIdx].push(match);
                    const nextRemaining = [...remainingMatches.slice(0, i), ...remainingMatches.slice(i + 1)];
                    const result = solve(nextRemaining, currentRounds);
                    if (result) return result;
                    currentRounds[rIdx].pop(); // Backtrack
                }
            }
            rIdx++;
        }
        return null;
    };

    for (let attempt = 0; attempt < 50; attempt++) {
        const result = solve(shuffleArray(allMatches), []);
        if (result) return result.filter(r => r.length > 0);
    }

    // 예외 케이스용 Fallback
    return allMatches.length > 0 ? [allMatches] : []; 
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
    
    // 비트 리버스 오더로 시드 거리 최대화
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
// 4. 메인 통합 로직 (Vercel 에러 해결 포인트)
// ==========================================

export const generateRoundsLogic = (season: Season): Round[] => {
    const teams = season.teams || [];
    if (teams.length < 2) return [];

    if (season.type === 'LEAGUE') {
        const schedule = generateLeagueSchedule(teams, season.leagueMode === 'DOUBLE');
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
        const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(teams.length)));
        const seeded = distributeTeamsSmartly(teams, nextPowerOf2);
        const matches: Match[] = [];
        // ... (상세 매칭 루프는 기존 내용과 동일하되, generateRoundsLogic 내부에 위치)
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