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

    } else if (season.type === 'LEAGUE_PLAYOFF') {
        // 🔥 [디벨롭] 신규 모드: 엄격한 리그 스케줄링 + 플레이오프 빈 슬롯 부착
        const schedule = generateLeagueSchedule(teams, season.leagueMode === 'DOUBLE');
        
        if (!schedule) {
            console.error("균일한 스케줄 생성 실패 (조건이 너무 까다로움)");
            return [];
        }

        // 1. 정규 리그 라운드 매핑
        const rounds: Round[] = schedule.map((matches, rIdx) => ({
            round: rIdx + 1,
            name: `ROUND ${rIdx + 1}`,
            seasonId: season.id,
            matches: matches.map((m, mIdx) => ({
                id: `${season.id}_R${rIdx+1}_M${mIdx}`,
                seasonId: season.id,
                home: m.home.name, away: m.away.name,
                homeLogo: m.home.logo, awayLogo: m.away.logo,
                homeOwner: m.home.ownerName, awayOwner: m.away.ownerName,
                status: 'UPCOMING', stage: `ROUND ${rIdx+1}`, matchLabel: `리그 ${rIdx+1}R`,
                homeScore: '', awayScore: '', youtubeUrl: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: []
            }))
        }));

        let roundIndex = rounds.length + 1;
        let matchCounter = 1;
        const TBD_LOGO = "https://img.uefa.com/imgml/uefacom/club-generic-badge-new.svg";

        const createTbdMatch = (stageName: string, label: string): Match => ({
            id: `${season.id}_po_tbd_${matchCounter++}`,
            seasonId: season.id,
            home: 'TBD', away: 'TBD',
            homeLogo: TBD_LOGO, awayLogo: TBD_LOGO,
            homeOwner: '-', awayOwner: '-',
            homeScore: '', awayScore: '',
            status: 'UPCOMING',
            stage: stageName,
            matchLabel: label,
            homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [], youtubeUrl: ''
        });

        // 2. PO 4강 (1차전, 2차전)
        rounds.push({
            round: roundIndex++, name: 'ROUND_OF_4', seasonId: season.id,
            matches: [
                createTbdMatch('ROUND_OF_4', 'PO 4강 1차전 (5위 홈 vs 2위)'),
                createTbdMatch('ROUND_OF_4', 'PO 4강 1차전 (4위 홈 vs 3위)')
            ]
        });
        rounds.push({
            round: roundIndex++, name: 'ROUND_OF_4', seasonId: season.id,
            matches: [
                createTbdMatch('ROUND_OF_4', 'PO 4강 2차전 (2위 홈 vs 5위)'),
                createTbdMatch('ROUND_OF_4', 'PO 4강 2차전 (3위 홈 vs 4위)')
            ]
        });

        // 3. PO 결승 (1차전, 2차전)
        rounds.push({
            round: roundIndex++, name: 'SEMI_FINAL', seasonId: season.id,
            matches: [
                createTbdMatch('SEMI_FINAL', 'PO 결승 1차전 (하위승자 홈 vs 상위승자)')
            ]
        });
        rounds.push({
            round: roundIndex++, name: 'SEMI_FINAL', seasonId: season.id,
            matches: [
                createTbdMatch('SEMI_FINAL', 'PO 결승 2차전 (상위승자 홈 vs 하위승자)')
            ]
        });

        // 4. 최종 결승 (단판)
        rounds.push({
            round: roundIndex++, name: 'FINAL', seasonId: season.id,
            matches: [
                createTbdMatch('FINAL', '🏆 최종 결승전 (1위 vs PO승자)')
            ]
        });

        return rounds;

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
                // 🔥 [TypeScript 버그 픽스] 빈 배열을 number 타입 배열로 명시적 선언
                const res: number[] = []; 
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
        
        // 🔥 [디벨롭] 마지막 경기를 결승전(FINAL)으로 인식하도록 로직 개선
        const totalMatches = nextPowerOf2 - 1;
        for (let i = 0; i < totalMatches; i++) {
            const isFirst = i < nextPowerOf2 / 2;
            const isFinal = i === totalMatches - 1; // 마지막 경기가 곧 결승전

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
                homeScore: '', 
                awayScore: '', 
                stage: isFinal ? 'FINAL' : 'TOURNAMENT', // 🔥 결승전 명찰 부착
                matchLabel: isFinal ? '🏆 결승전' : `Match ${i+1}`, // 🔥 결승전 텍스트 부착
                youtubeUrl: '', 
                homeScorers: [], 
                awayScorers: [], 
                homeAssists: [], 
                awayAssists: []
            });
        }
        return [{ round: 1, name: 'Tournament Bracket', seasonId: season.id, matches }];
    }
};

// ============================================================================
// 🔥 [신규 추가] 토너먼트 승자 자동 진출 (Auto-Advancement) 엔진
// ============================================================================

/**
 * 경기 결과(스코어)를 분석하여 승자를 찾고, 이진 트리 공식을 활용해
 * 다음 라운드의 정확한 매치 슬롯(Home or Away)에 승자 데이터를 꽂아 넣습니다.
 * * @param currentMatches 현재 토너먼트의 전체 매치 배열 (1라운드 ~ 결승전)
 * @param matchId 방금 점수가 입력 및 확정된 매치의 ID
 * @param homeScore 홈팀의 최종 점수
 * @param awayScore 원정팀의 최종 점수
 * @returns 승자가 다음 라운드로 이동 적용된 새로운 전체 매치 배열
 */
export const processTournamentAdvancement = (
    currentMatches: Match[],
    matchId: string,
    homeScore: number,
    awayScore: number
): Match[] => {
    // 1. 원본 훼손 방지를 위한 깊은 복사 (Deep Copy)
    const newMatches = JSON.parse(JSON.stringify(currentMatches)) as Match[];
    
    // 2. 점수가 입력된 현재 매치의 배열 내 인덱스 찾기
    const matchIndex = newMatches.findIndex(m => m.id === matchId);
    if (matchIndex === -1) return newMatches; // 매치를 못 찾으면 원본 그대로 반환

    const currentMatch = newMatches[matchIndex];
    const totalMatches = newMatches.length; // 예: 8팀 출전 시 총 7경기
    
    // 3. 현재 라운드가 전체 배열 중 어디서 시작하는지(Index), 경기 수가 몇 개인지 찾기
    let roundStartIndex = 0;
    let matchesInRound = (totalMatches + 1) / 2; // 1라운드의 총 경기 수 (예: 4)

    // 반복문을 돌며 내가 속한 라운드의 블록 구간을 찾음
    while (matchIndex >= roundStartIndex + matchesInRound) {
        roundStartIndex += matchesInRound;
        matchesInRound /= 2;
    }

    // 현재 매치가 이미 결승전(해당 라운드 경기 수가 1)이면 올라갈 다음 라운드가 없으므로 종료
    if (matchesInRound <= 1) return newMatches;

    // 4. 다음 라운드의 정확한 매치 슬롯(Index) 계산 (🌟 이진 트리 핵심 공식)
    const relIdx = matchIndex - roundStartIndex; // 현재 라운드 내에서의 내 위치 (예: 0, 1, 2, 3)
    const nextRoundStartIndex = roundStartIndex + matchesInRound; // 다음 라운드의 배열 내 시작 인덱스
    const nextMatchIndex = nextRoundStartIndex + Math.floor(relIdx / 2); // 내가 들어갈 다음 매치 인덱스
    const isHomeSlot = relIdx % 2 === 0; // 내 위치가 짝수면 Home, 홀수면 Away 자리로 들어감

    // 5. 점수에 따른 승자(Winner) 판별
    let winner: any = null;
    if (homeScore > awayScore) {
        winner = { 
            name: currentMatch.home, 
            logo: currentMatch.homeLogo, 
            ownerName: currentMatch.homeOwner, 
            ownerUid: currentMatch.homeOwnerUid, 
            tier: (currentMatch as any).homeTier 
        };
    } else if (awayScore > homeScore) {
        winner = { 
            name: currentMatch.away, 
            logo: currentMatch.awayLogo, 
            ownerName: currentMatch.awayOwner, 
            ownerUid: currentMatch.awayOwnerUid, 
            tier: (currentMatch as any).awayTier 
        };
    }
    // ※ 동점(무승부)일 경우는 승부차기 등의 이유로 승자가 확정되지 않았다고 판단하여 진행하지 않음

    // 6. 승자가 확정되었다면, 다음 매치 슬롯의 데이터를 덮어씌움
    if (winner && newMatches[nextMatchIndex]) {
        if (isHomeSlot) {
            newMatches[nextMatchIndex].home = winner.name;
            newMatches[nextMatchIndex].homeLogo = winner.logo;
            newMatches[nextMatchIndex].homeOwner = winner.ownerName;
            newMatches[nextMatchIndex].homeOwnerUid = winner.ownerUid;
            (newMatches[nextMatchIndex] as any).homeTier = winner.tier;
        } else {
            newMatches[nextMatchIndex].away = winner.name;
            newMatches[nextMatchIndex].awayLogo = winner.logo;
            newMatches[nextMatchIndex].awayOwner = winner.ownerName;
            newMatches[nextMatchIndex].awayOwnerUid = winner.ownerUid;
            (newMatches[nextMatchIndex] as any).awayTier = winner.tier;
        }
    }

    return newMatches; // 업데이트된 새로운 배열 반환
};