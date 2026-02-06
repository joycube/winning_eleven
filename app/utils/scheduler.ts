import { Team } from '../types';

// 1. 필요한 타입 정의 (스크린샷 에러 해결)
export interface MatchSlot {
    home: Team;
    away: Team;
}

// 2. 누락된 shuffleArray 유틸리티 추가
const shuffleArray = <T>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

/**
 * 내전을 완벽하게 방지하는 리그 매칭 알고리즘
 */
export const generateLeagueSchedule = (teams: Team[], isDouble: boolean): MatchSlot[][] => {
    // 1. 모든 가능한 매치업 생성 (동일 오너 제외)
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
    const totalMatchesNeeded = allMatches.length;
    
    // 최소 필요 라운드 수 계산
    let minRounds = Math.ceil(totalMatchesNeeded / matchesPerRound);
    const roundLimit = teams.length % 2 === 0 ? minRounds : minRounds + 2;

    /**
     * 재귀적 스케줄 생성 (Backtracking)
     */
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

                    currentRounds[rIdx].pop();
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

    return fallbackGreedy(allMatches, matchesPerRound);
};

/**
 * 백트래킹 실패 시 안전 장치
 */
const fallbackGreedy = (allMatches: MatchSlot[], matchesPerRound: number): MatchSlot[][] => {
    let pool = shuffleArray([...allMatches]);
    const rounds: MatchSlot[][] = [];

    while (pool.length > 0) {
        const currentRound: MatchSlot[] = [];
        const busy = new Set<string>();
        const nextPool: MatchSlot[] = [];

        for (const m of pool) {
            if (currentRound.length < matchesPerRound && !busy.has(m.home.name) && !busy.has(m.away.name)) {
                currentRound.push(m);
                busy.add(m.home.name);
                busy.add(m.away.name);
            } else {
                nextPool.push(m);
            }
        }
        rounds.push(currentRound);
        pool = nextPool;
    }
    return rounds;
};