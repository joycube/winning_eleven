/* eslint-disable @next/next/no-img-element */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { updateDoc, doc } from 'firebase/firestore';
// 🔥 [수정 1] CupEntry 추가 (types.ts에서 불러옴)
import { Season, MasterTeam, Owner, Team, League, FALLBACK_IMG, Match, CupEntry } from '../types';
import { getSortedLeagues, getSortedTeamsLogic, getTierBadgeColor } from '../utils/helpers';
import { QuickDraftModal } from './QuickDraftModal';

// 🔥 [수정 2] 경로 수정 (./components/ 제거 -> 현재 폴더 ./)
import { TeamCard } from './TeamCard';
import { AdminCupStep2 } from './AdminCupStep2';
import { AdminCupStep3 } from './AdminCupStep3';

// 🔥 리그 인지도 정렬 순서
const LEAGUE_RANKING: { [key: string]: number } = {
"PREMIER LEAGUE": 1, "LA LIGA": 2, "BUNDESLIGA": 3, "SERIE A": 4, "LIGUE 1": 5,
"CHAMPIONS LEAGUE": 6, "EUROPA LEAGUE": 7, "EREDIVISIE": 8, "LIGA PORTUGAL": 9,
"BRASILEIRAO": 10, "ARGENTINE LPF": 11, "MLS": 12, "SAUDI PRO LEAGUE": 13,
"SUPER LIG": 14, "SCOTTISH PREMIERSHIP": 15, "K LEAGUE": 16, "J LEAGUE": 17,
"EUROPE": 1, "SOUTH AMERICA": 2, "NORTH AMERICA": 3, "AFRICA": 4, "ASIA-OCEANIA": 5
};

// 동적 조 생성을 위한 알파벳 배열
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');

interface AdminCupSetupProps {
targetSeason: Season;
owners: Owner[];
leagues: League[];
masterTeams: MasterTeam[];
onNavigateToSchedule: (seasonId: number) => void;
}

// ✂️ [삭제됨] interface CupEntry ... (types.ts로 이동)

export const AdminCupSetup = ({ targetSeason, owners, leagues, masterTeams, onNavigateToSchedule }: AdminCupSetupProps) => {
// ================= STATE =================
const [selectedOwnerId, setSelectedOwnerId] = useState('');
const [randomResult, setRandomResult] = useState<MasterTeam | null>(null);
const [isRolling, setIsRolling] = useState(false);
const [isFlipping, setIsFlipping] = useState(false);
const [isDraftOpen, setIsDraftOpen] = useState(false);

const [filterCategory, setFilterCategory] = useState('ALL');
const [filterLeague, setFilterLeague] = useState('');
const [filterTier, setFilterTier] = useState('ALL');
const [searchTeam, setSearchTeam] = useState('');

const [unassignedPool, setUnassignedPool] = useState<CupEntry[]>([]);
// 초기값은 빈 객체로 시작
const [groups, setGroups] = useState<{ [key: string]: (CupEntry | null)[] }>({
"A": [null, null, null, null],
"B": [null, null, null, null],
"C": [null, null, null, null],
"D": [null, null, null, null]
});

// 설정 모드 상태 관리
const [configMode, setConfigMode] = useState<'AUTO' | 'CUSTOM'>('AUTO');
const [customConfig, setCustomConfig] = useState({ groupCount: 4, teamCount: 4 });
// 🔥 [수정] targetSlot 인터페이스 확장 (isTournament 추가)
const [targetSlot, setTargetSlot] = useState<{ group: string, idx: number, isTournament?: boolean } | null>(null);
const [draggedEntry, setDraggedEntry] = useState<CupEntry | null>(null);

// 🔥 토너먼트 관련 상태
const [tournamentBracket, setTournamentBracket] = useState<(CupEntry | null)[]>([]);
const [draggedTournamentEntry, setDraggedTournamentEntry] = useState<CupEntry | null>(null);

const intervalRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
}, []);

// 🔥 [수정됨] 기존 조편성 데이터 불러오기 + 빈 그룹 자동 삭제 로직 적용
useEffect(() => {
if (targetSeason.groups && Object.keys(targetSeason.groups).length > 0) {
const loadedGroups: { [key: string]: (CupEntry | null)[] } = {};
const dbGroups = targetSeason.groups as { [key: string]: number[] }; // teamId list
// 1. 데이터 로드 및 최대 팀 수 감지
let maxTeamsInGroup = 0;

Object.keys(dbGroups).forEach(gName => {
const teamIds = dbGroups[gName];
maxTeamsInGroup = Math.max(maxTeamsInGroup, teamIds.length);

const entries = teamIds.map(tid => {
const teamData = targetSeason.teams?.find(t => t.id === tid);
if (!teamData) return null;
return {
id: `loaded_${tid}`,
masterId: tid,
name: teamData.name,
logo: teamData.logo,
ownerName: teamData.ownerName || 'CPU',
region: teamData.region,
tier: teamData.tier,
realRankScore: teamData.realRankScore,
realFormScore: teamData.realFormScore
} as CupEntry;
});
loadedGroups[gName] = entries;
});

// 2. 설정값 자동 계산
const detectedTeamCount = maxTeamsInGroup < 2 ? 4 : maxTeamsInGroup;
let calculatedGroupCount = 0;
const sortedKeys = Object.keys(loadedGroups).sort();
for (let i = sortedKeys.length - 1; i >= 0; i--) {
const gName = sortedKeys[i];
const hasTeam = loadedGroups[gName].some(t => t !== null);
if (hasTeam) {
calculatedGroupCount = i + 1;
break;
}
}
calculatedGroupCount = Math.max(2, calculatedGroupCount);

// 3. 최종 그룹 데이터 생성
const finalGroups: { [key: string]: (CupEntry | null)[] } = {};
for(let i=0; i<calculatedGroupCount; i++) {
const gName = ALPHABET[i];
const currentSlots = loadedGroups[gName] || [];
const filledSlots = [...currentSlots, ...Array(Math.max(0, detectedTeamCount - currentSlots.length)).fill(null)];
finalGroups[gName] = filledSlots;
}

// 4. 상태 일괄 업데이트
setGroups(finalGroups);
setCustomConfig({
groupCount: calculatedGroupCount,
teamCount: detectedTeamCount
});
setConfigMode('CUSTOM');
}
}, [targetSeason]);


// 🔥 리그 정렬 로직
const { clubLeagues, nationalLeagues, allSortedLeagues } = useMemo(() => {
const clubs = leagues.filter(l => l.category === 'CLUB');
const nationals = leagues.filter(l => l.category === 'NATIONAL');

const sortFunc = (a: League, b: League) => {
const rankA = LEAGUE_RANKING[a.name.toUpperCase()] || 999;
const rankB = LEAGUE_RANKING[b.name.toUpperCase()] || 999;
return rankA - rankB;
};

const sortedClubs = clubs.sort(sortFunc);
const sortedNationals = nationals.sort(sortFunc);

return {
clubLeagues: sortedClubs,
nationalLeagues: sortedNationals,
allSortedLeagues: [...sortedClubs, ...sortedNationals]
};
}, [leagues]);

// 🔥 선택 가능한 팀 목록
const availableTeams = useMemo(() => {
const assignedNames = new Set<string>();
unassignedPool.forEach(t => assignedNames.add(t.name));
Object.values(groups).flat().forEach(t => { if(t) assignedNames.add(t.name); });

let teams = masterTeams.filter(t => !assignedNames.has(t.name));
if (filterCategory !== 'ALL') teams = teams.filter(t => filterCategory === 'CLUB' ? t.category !== 'NATIONAL' : t.category === 'NATIONAL');
if (filterLeague) teams = teams.filter(t => t.region === filterLeague);
if (filterTier !== 'ALL') teams = teams.filter(t => t.tier?.trim() === filterTier);
if (searchTeam) teams = teams.filter(t => t.name.toLowerCase().includes(searchTeam.toLowerCase()));
return getSortedTeamsLogic(teams, '');
}, [masterTeams, unassignedPool, groups, filterCategory, filterLeague, filterTier, searchTeam]);

// 🔥 조별리그 결과 분석하여 진출팀(1,2위) 선별 로직
const qualifiedTeams = useMemo(() => {
if (!targetSeason.rounds || !targetSeason.rounds[0]) return [];
const matches = targetSeason.rounds[0].matches;
const stats: { [key: string]: any } = {};

matches.forEach((m: Match) => {
if (m.status !== 'COMPLETED') return;
[m.home, m.away].forEach(t => {
if (!stats[t]) {
const isHome = t === m.home;
stats[t] = {
name: t, points: 0, gd: 0, gf: 0,
group: m.group,
logo: (isHome ? m.homeLogo : m.awayLogo),
ownerName: (isHome ? m.homeOwner : m.awayOwner)
};
}
});

const h = Number(m.homeScore);
const a = Number(m.awayScore);
stats[m.home].gf += h; stats[m.home].gd += (h - a);
stats[m.away].gf += a; stats[m.away].gd += (a - h);

if (h > a) stats[m.home].points += 3;
else if (a > h) stats[m.away].points += 3;
else { stats[m.home].points += 1; stats[m.away].points += 1; }
});

const groupsList = Array.from(new Set(matches.map(m => m.group))).sort();
const winners: CupEntry[] = [];

groupsList.forEach(g => {
if (!g) return;
const groupTeams = Object.values(stats)
.filter((t: any) => t.group === g)
.sort((a: any, b: any) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
if (groupTeams[0]) winners.push({ ...groupTeams[0], masterId: 0, id: `q_${g}_1`, tier: 'S', region: '', rank: 1 });
if (groupTeams[1]) winners.push({ ...groupTeams[1], masterId: 0, id: `q_${g}_2`, tier: 'A', region: '', rank: 2 });
});

return winners;
}, [targetSeason]);

// 🔥 진출 팀 수에 맞춰 대진표 슬롯 생성
useEffect(() => {
if (qualifiedTeams.length > 0) {
if (tournamentBracket.length !== qualifiedTeams.length) {
setTournamentBracket(Array(qualifiedTeams.length).fill(null));
}
}
}, [qualifiedTeams]);

// 🔥 토너먼트 대기 풀
const tournamentWaitingPool = useMemo(() => {
const assignedNames = new Set(tournamentBracket.filter(Boolean).map(t => t?.name));
return qualifiedTeams.filter(t => !assignedNames.has(t.name));
}, [qualifiedTeams, tournamentBracket]);

// ================= ACTIONS =================
// 보드 구조 변경 핸들러
const updateBoardStructure = (mode: 'AUTO' | 'CUSTOM', gCount: number, tCount: number) => {
if (!confirm("설정을 변경하면 현재 배정된 팀들이 모두 대기실로 이동합니다. 계속하시겠습니까?")) return;

// 1. 현재 조에 배정된 모든 팀 회수
const recoveredTeams = Object.values(groups).flat().filter(Boolean) as CupEntry[];
// 2. 새로운 그룹 구조 생성
const newGroups: { [key: string]: (CupEntry | null)[] } = {};
for (let i = 0; i < gCount; i++) {
const groupName = ALPHABET[i];
newGroups[groupName] = Array(tCount).fill(null);
}

// 3. 상태 업데이트
setUnassignedPool(prev => [...prev, ...recoveredTeams]);
setGroups(newGroups);
setConfigMode(mode);
setCustomConfig({ groupCount: gCount, teamCount: tCount });
};

const handleRandom = () => {
if (!selectedOwnerId) return alert("오너를 먼저 선택해주세요.");
if (availableTeams.length === 0) return alert("조건에 맞는 팀이 없습니다.");
if (isRolling) return;

setIsRolling(true);
setIsFlipping(false);
setRandomResult(null);

const winnerIndex = Math.floor(Math.random() * availableTeams.length);
const finalWinner = availableTeams[winnerIndex];

let shuffleCount = 0;
intervalRef.current = setInterval(() => {
const tempIndex = Math.floor(Math.random() * availableTeams.length);
setRandomResult(availableTeams[tempIndex]);
shuffleCount++;
if (shuffleCount > 20 && intervalRef.current) {
clearInterval(intervalRef.current);
intervalRef.current = setInterval(() => {
const slowIndex = Math.floor(Math.random() * availableTeams.length);
setRandomResult(availableTeams[slowIndex]);
}, 150);
}
}, 60);

setTimeout(() => {
if (intervalRef.current) clearInterval(intervalRef.current);
setRandomResult(finalWinner);
setIsFlipping(true);
setIsRolling(false);
}, 2500);
};

const handleSignTeam = (master: MasterTeam | null) => {
const target = master || randomResult;
if (!target) return;

if (!selectedOwnerId) return alert("오너를 선택해주세요.");
const owner = owners.find(o => String(o.id) === String(selectedOwnerId));
if (!owner) return alert("유효하지 않은 오너입니다.");

const isDuplicate = unassignedPool.some(p => p.masterId === target.id) ||
Object.values(groups).flat().some(g => g && g.masterId === target.id);
if (isDuplicate) return alert("이미 선발된 팀입니다.");

const newEntry: CupEntry = {
id: `entry_${Date.now()}`,
masterId: target.id,
name: target.name,
logo: target.logo,
ownerName: owner.nickname,
region: target.region,
tier: target.tier,
realRankScore: target.realRankScore,
realFormScore: target.realFormScore
};

setUnassignedPool(prev => [...prev, newEntry]);
setRandomResult(null);
setIsFlipping(false);
};

// 🔥 [복구] handleDraftApply 함수
const handleDraftApply = async (newTeams: Team[]) => {
const usedMasterIds = new Set<number>();
unassignedPool.forEach(t => usedMasterIds.add(t.masterId));
Object.values(groups).flat().forEach(t => { if(t) usedMasterIds.add(t.masterId); });

const newEntries: CupEntry[] = newTeams
.filter(t => !usedMasterIds.has(t.id))
.map((t, idx) => ({
id: `draft_${Date.now()}_${idx}_${Math.random()}`,
masterId: t.id,
name: t.name,
logo: t.logo,
ownerName: t.ownerName || 'CPU',
region: t.region,
tier: t.tier,
realRankScore: t.realRankScore,
realFormScore: t.realFormScore
}));

const duplicateCount = newTeams.length - newEntries.length;
if (duplicateCount > 0) {
alert(`⚠️ 중복된 ${duplicateCount}개 팀은 제외하고 추가했습니다.`);
}
if (newEntries.length > 0) {
setUnassignedPool(prev => [...prev, ...newEntries]);
}
};

const assignTeamToGroup = (entry: CupEntry, gName: string, idx: number) => {
const targetGroup = groups[gName];
const hasSameOwner = targetGroup.some(slot => slot && slot.ownerName === entry.ownerName);
if (hasSameOwner) {
alert(`🚫 [배정 불가]\nGroup ${gName}에는 이미 '${entry.ownerName}'님의 팀이 있습니다.\n공정한 대회를 위해 다른 조를 선택해주세요.`);
return;
}

setGroups(prev => ({
...prev,
[gName]: prev[gName].map((slot, i) => i === idx ? entry : slot)
}));
setUnassignedPool(prev => prev.filter(p => p.id !== entry.id));
};

const handleSlotClick = (gName: string, idx: number) => {
const currentEntry = groups[gName][idx];
if (currentEntry) {
setUnassignedPool(prev => [...prev, currentEntry]);
setGroups(prev => ({ ...prev, [gName]: prev[gName].map((slot, i) => i === idx ? null : slot) }));
} else {
if (unassignedPool.length === 0) return alert("대기실(Waiting Pool)에 팀이 없습니다. Step 1에서 팀을 뽑아주세요.");
setTargetSlot({ group: gName, idx, isTournament: false });
}
};

const confirmSlotSelection = (entry: CupEntry) => {
if (!targetSlot) return;
// 🔥 [수정] 토너먼트 배정과 일반 조 배정 분기 처리
if (targetSlot.isTournament) {
const newBracket = [...tournamentBracket];
newBracket[targetSlot.idx] = entry;
setTournamentBracket(newBracket);
} else {
assignTeamToGroup(entry, targetSlot.group, targetSlot.idx);
}
setTargetSlot(null);
};

const handleDragStart = (e: React.DragEvent, entry: CupEntry) => {
setDraggedEntry(entry);
// 🔥 [수정] 드래그 시 토너먼트용 엔트리도 동시에 설정하여 Step 3 드래그 활성화
setDraggedTournamentEntry(entry);
e.dataTransfer.effectAllowed = "move";
e.dataTransfer.setData("text/plain", entry.id);
};

// 🔥 [복구] handleDragOver 함수
const handleDragOver = (e: React.DragEvent) => {
e.preventDefault();
e.dataTransfer.dropEffect = "move";
};

const handleDrop = (e: React.DragEvent, gName: string, idx: number) => {
e.preventDefault();
const currentEntry = groups[gName][idx];
if (currentEntry) return;
if (draggedEntry) {
assignTeamToGroup(draggedEntry, gName, idx);
setDraggedEntry(null);
}
};

const handleAutoDraw = () => {
if (unassignedPool.length === 0) return alert("대기실에 팀이 없습니다.");
const tempGroups: { [key: string]: (CupEntry | null)[] } = JSON.parse(JSON.stringify(groups));
const ownerCounts: Record<string, number> = {};
unassignedPool.forEach(p => ownerCounts[p.ownerName] = (ownerCounts[p.ownerName] || 0) + 1);
const sortedPool = [...unassignedPool].sort((a, b) => {
const countDiff = ownerCounts[b.ownerName] - ownerCounts[a.ownerName];
return countDiff !== 0 ? countDiff : 0.5 - Math.random();
});

const remainingPool: CupEntry[] = [];
const groupKeys = Object.keys(tempGroups).sort();

sortedPool.forEach(team => {
let placed = false;
for (const gName of groupKeys) {
const group = tempGroups[gName];
const emptyIdx = group.indexOf(null);
const hasOwner = group.some(s => s?.ownerName === team.ownerName);

if (emptyIdx !== -1 && !hasOwner) {
tempGroups[gName][emptyIdx] = team;
placed = true;
break;
}
}
if (!placed) {
for (const gName of groupKeys) {
const emptyIdx = tempGroups[gName].indexOf(null);
if (emptyIdx !== -1) {
tempGroups[gName][emptyIdx] = team;
placed = true;
break;
}
}
}
if (!placed) remainingPool.push(team);
});

setGroups(tempGroups);
setUnassignedPool(remainingPool);
};

const handleResetDraw = () => {
if (!confirm("모든 조 편성을 초기화하고 대기실로 되돌리겠습니까?")) return;
const allAssigned = Object.values(groups).flat().filter(Boolean) as CupEntry[];
setUnassignedPool(prev => [...prev, ...allAssigned]);
// 현재 설정 유지하면서 초기화
const newGroups: { [key: string]: (CupEntry | null)[] } = {};
Object.keys(groups).forEach(key => {
newGroups[key] = Array(groups[key].length).fill(null);
});
setGroups(newGroups);
};

// 🔥 토너먼트 매칭 함수들
const handleTournamentAutoMatch = () => {
const newBracket = Array(tournamentBracket.length).fill(null);
const find = (g: string, r: number) => qualifiedTeams.find(t => t.group === g && t.rank === r);

if (qualifiedTeams.length === 8) {
newBracket[0] = find('A', 1) || null; newBracket[1] = find('B', 2) || null;
newBracket[2] = find('C', 1) || null; newBracket[3] = find('D', 2) || null;
newBracket[4] = find('B', 1) || null; newBracket[5] = find('A', 2) || null;
newBracket[6] = find('D', 1) || null; newBracket[7] = find('C', 2) || null;
}
else if (qualifiedTeams.length === 4) {
newBracket[0] = find('A', 1) || null; newBracket[1] = find('B', 2) || null;
newBracket[2] = find('B', 1) || null; newBracket[3] = find('A', 2) || null;
}
else {
qualifiedTeams.forEach((t, i) => { if(i < newBracket.length) newBracket[i] = t; });
}

setTournamentBracket(newBracket);
};

const handleTournamentRandomMatch = () => {
const shuffled = [...qualifiedTeams].sort(() => Math.random() - 0.5);
const newBracket = Array(tournamentBracket.length).fill(null);
shuffled.slice(0, newBracket.length).forEach((t, i) => newBracket[i] = t);
setTournamentBracket(newBracket);
};

const handleTournamentDrop = (e: React.DragEvent, idx: number) => {
e.preventDefault();
if (draggedTournamentEntry) {
const newBracket = [...tournamentBracket];
newBracket[idx] = draggedTournamentEntry;
setTournamentBracket(newBracket);
setDraggedTournamentEntry(null);
}
};

// 🔥 [신규] 토너먼트 슬롯 클릭 시 삭제 또는 배정 모달 띄우기
const handleTournamentSlotClick = (idx: number) => {
if (tournamentBracket[idx]) {
const newBracket = [...tournamentBracket];
newBracket[idx] = null;
setTournamentBracket(newBracket);
} else {
// 🔥 [수정] 조별리그와 똑같이 클릭 시 배정 모달이 뜨도록 설정
if (tournamentWaitingPool.length === 0) return alert("진출 팀 대기실에 팀이 없습니다.");
setTargetSlot({ group: 'TOURNAMENT', idx, isTournament: true });
}
};

// 🔥 [디벨롭] 토너먼트 스케줄 생성 로직 (연결 고리 데이터 추가 및 필수 필드 보강)
const handleCreateTournamentSchedule = async () => {
if (tournamentBracket.includes(null)) {
if (!confirm("⚠️ 대진표에 빈 자리가 있습니다. 그대로 진행하시겠습니까?")) return;
} else {
if (!confirm("⚔️ 토너먼트 대진을 확정하고 스케줄을 생성하시겠습니까?")) return;
}

const knockoutMatches: any[] = [];
const totalSlots = tournamentBracket.length; // 8강이면 8, 4강이면 4
const matchCount = totalSlots / 2; // 8강이면 4경기, 4강이면 2경기
// 1. 단계별 설정값 정의
const stageName = matchCount === 4 ? 'ROUND_OF_8' : matchCount === 2 ? 'ROUND_OF_4' : 'KNOCKOUT';
const labelPrefix = matchCount === 4 ? '8강' : matchCount === 2 ? '4강' : '토너먼트';
const nextStageIdPrefix = matchCount === 4 ? 'ko_4' : 'ko_final';

// 2. 현재 라운드 매치 생성
for (let i = 0; i < totalSlots; i += 2) {
const matchIndex = i / 2;
const h = tournamentBracket[i];
const a = tournamentBracket[i+1];
const nextMatchIndex = Math.floor(matchIndex / 2);
const nextMatchId = matchCount > 1 ? `${nextStageIdPrefix}_${nextMatchIndex}` : null;
const nextMatchSide = matchIndex % 2 === 0 ? 'HOME' : 'AWAY';

knockoutMatches.push({
id: `ko_${matchCount}_${matchIndex}`,
seasonId: targetSeason.id,
stage: stageName,
matchLabel: `${labelPrefix} ${matchIndex + 1}경기`,
home: h?.name || 'TBD',
homeLogo: h?.logo || FALLBACK_IMG,
homeOwner: h?.ownerName || 'TBD',
away: a?.name || 'TBD',
awayLogo: a?.logo || FALLBACK_IMG,
awayOwner: a?.ownerName || 'TBD',
homeScore: '',
awayScore: '',
status: 'UPCOMING',
homeScorers: [],
awayScorers: [],
homeAssists: [],
awayAssists: [],
nextMatchId: nextMatchId,
nextMatchSide: nextMatchSide
});
}

// 3. 다음 라운드(4강/결승) 빈 매치 미리 생성 (TBD 상태)
if (matchCount === 4) {
for (let j = 0; j < 2; j++) {
knockoutMatches.push({
id: `ko_4_${j}`,
seasonId: targetSeason.id,
stage: 'ROUND_OF_4',
matchLabel: `4강 ${j + 1}경기 (TBD)`,
home: 'TBD', homeLogo: FALLBACK_IMG, homeOwner: 'TBD',
away: 'TBD', awayLogo: FALLBACK_IMG, awayOwner: 'TBD',
homeScore: '', awayScore: '',
homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [],
status: 'UPCOMING', nextMatchId: `ko_final_0`, nextMatchSide: j === 0 ? 'HOME' : 'AWAY'
});
}
knockoutMatches.push({
id: `ko_final_0`,
seasonId: targetSeason.id,
stage: 'FINAL',
matchLabel: `결승전 (TBD)`,
home: 'TBD', homeLogo: FALLBACK_IMG, homeOwner: 'TBD',
away: 'TBD', awayLogo: FALLBACK_IMG, awayOwner: 'TBD',
homeScore: '', awayScore: '',
homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [],
status: 'UPCOMING', nextMatchId: null
});
} else if (matchCount === 2) {
knockoutMatches.push({
id: `ko_final_0`,
seasonId: targetSeason.id,
stage: 'FINAL',
matchLabel: `결승전 (TBD)`,
home: 'TBD', homeLogo: FALLBACK_IMG, homeOwner: 'TBD',
away: 'TBD', awayLogo: FALLBACK_IMG, awayOwner: 'TBD',
homeScore: '', awayScore: '',
homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [],
status: 'UPCOMING', nextMatchId: null
});
}

const existingRounds = targetSeason.rounds || [];
const updatedRounds = [...existingRounds];
// 🔥 [수정 포인트] Round 객체에 seasonId 필수 필드 추가
updatedRounds[1] = {
round: 2,
name: "Knockout Stage",
seasonId: targetSeason.id,
matches: knockoutMatches
};

// 🔥 [수정 포인트] cupPhase를 KNOCKOUT으로 설정하여 토너먼트 탭 자동 포커싱 유도
await updateDoc(doc(db, "seasons", String(targetSeason.id)), {
rounds: updatedRounds,
cupPhase: 'KNOCKOUT'
});

alert("⚔️ 토너먼트 대진 및 자동 진출 경로가 생성되었습니다!");
onNavigateToSchedule(targetSeason.id);
};

const handleCreateSchedule = async () => {
const totalSlots = Object.values(groups).flat().length;
const filledSlots = Object.values(groups).flat().filter(Boolean).length;
if (filledSlots < totalSlots) {
if (!confirm(`⚠️ 전체 ${totalSlots}자리 중 ${filledSlots}팀만 배정되었습니다.\n빈 자리는 무시하고 진행하시겠습니까?`)) return;
} else {
if (!confirm("현재 조 편성으로 컵 대회를 시작하시겠습니까?\n스케줄이 생성됩니다.")) return;
}

const finalTeams: Team[] = [];
const groupsForDB: { [key: string]: number[] } = {};

Object.keys(groups).forEach(gName => {
groupsForDB[gName] = [];
groups[gName].forEach(entry => {
if (entry) {
const newTeam: Team = {
id: Number(entry.masterId),
seasonId: targetSeason.id,
name: entry.name,
logo: entry.logo,
ownerName: entry.ownerName,
region: entry.region,
tier: entry.tier,
win: 0, draw: 0, loss: 0, points: 0, gf: 0, ga: 0, gd: 0,
realRankScore: entry.realRankScore || 80,
realFormScore: entry.realFormScore || 80
};
finalTeams.push(newTeam);
groupsForDB[gName].push(newTeam.id);
}
});
});

const groupMatches: any[] = [];
Object.keys(groups).forEach(gName => {
const gTeams = finalTeams.filter(t => groupsForDB[gName].includes(t.id));
for (let i = 0; i < gTeams.length; i++) {
for (let j = i + 1; j < gTeams.length; j++) {
const home = gTeams[i];
const away = gTeams[j];
groupMatches.push({
id: `match_${Date.now()}_${home.id}_${away.id}_${Math.random().toString(36).substr(2, 5)}`,
seasonId: targetSeason.id,
stage: `GROUP STAGE`,
matchLabel: `Group ${gName} Match`,
group: gName,
home: home.name, homeLogo: home.logo, homeOwner: home.ownerName,
away: away.name, awayLogo: away.logo, awayOwner: away.ownerName,
homeScore: '', awayScore: '', status: 'UPCOMING',
homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: []
});
}
}
});

// 🔥 [수정 포인트] 조별리그 라운드 생성 시에도 seasonId 추가
const roundsData = [{
round: 1,
name: "Group Stage",
seasonId: targetSeason.id,
matches: groupMatches.sort(() => 0.5 - Math.random())
}];

await updateDoc(doc(db, "seasons", String(targetSeason.id)), {
teams: finalTeams,
rounds: roundsData,
groups: groupsForDB,
cupPhase: 'GROUP_STAGE',
status: 'ACTIVE'
});

alert("🏆 컵 대회가 시작되었습니다!");
onNavigateToSchedule(targetSeason.id);
};

return (
<div className="space-y-8 animate-in fade-in relative pb-20">
<style jsx>{`
.stage-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.92); z-index: 50; backdrop-filter: blur(8px); }
.fc-gold-glow { animation: gold-glow 2s infinite; }
@keyframes gold-glow { 0%, 100% { box-shadow: 0 0 30px rgba(251, 191, 36, 0.3); } 50% { box-shadow: 0 0 60px rgba(251, 191, 36, 0.8); } }
.reveal-flash { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: white; z-index: 60; pointer-events: none; animation: flashAnim 0.6s ease-out forwards; }
@keyframes flashAnim { 0% { opacity: 0; } 10% { opacity: 0.8; } 100% { opacity: 0; } }
.blast-circle { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.5); width: 100px; height: 100px; border-radius: 50%; border: 4px solid ${randomResult?.tier === 'S' ? '#fbbf24' : '#34d399'}; box-shadow: 0 0 50px ${randomResult?.tier === 'S' ? '#fbbf24' : '#34d399'}; z-index: 52; pointer-events: none; animation: blastOut 0.8s cubic-bezier(0.165, 0.84, 0.44, 1) forwards; }
@keyframes blastOut { 0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; border-width: 10px; } 100% { transform: translate(-50%, -50%) scale(4); opacity: 0; border-width: 0px; } }
.fc-card-reveal { animation: card-flip 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; z-index: 55; }
@keyframes card-flip { 0% { transform: rotateY(90deg) scale(0.8); filter: brightness(3); } 100% { transform: rotateY(0deg) scale(1.1); filter: brightness(1); } }
.is-dragging { opacity: 0.5; transform: scale(0.9); }
`}</style>

{(isRolling || isFlipping) && <div className="stage-overlay" />}
{isFlipping && <div className="reveal-flash" />}

{/* ================= STEP 1: TEAM SELECTION ================= */}
<div className={`bg-slate-900 p-5 rounded-3xl border border-slate-800 relative ${isRolling || isFlipping ? 'z-[55]' : ''}`}>
<div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
<h3 className="text-white font-black italic uppercase tracking-tighter">Step 1. Team & Owner Matching</h3>
<div className="text-xs text-slate-400">Waiting Pool: <span className="text-emerald-400 font-bold text-lg">{unassignedPool.length}</span> Teams</div>
</div>

{/* 퀵 팀매칭 배너 */}
<div className="bg-gradient-to-r from-slate-800 to-slate-900 p-3 rounded-xl border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-3 mb-2">
<div className="flex-1 flex flex-col items-center justify-center text-center">
<div className="text-white font-black italic flex items-center gap-2 text-sm">
<span className="text-yellow-400">⚡</span> 퀵 팀매칭 (Quick Match)
<span className="text-[9px] bg-yellow-500 text-black px-1.5 rounded font-black tracking-tighter">HOT</span>
</div>
<p className="text-sm text-white mt-1 font-bold">✨ 지금 자동으로 팀을 추천 받으세요 ✨</p>
</div>
<button onClick={() => setIsDraftOpen(true)} disabled={isRolling} className="h-10 px-6 bg-indigo-600 text-white font-black italic rounded-lg shadow-lg text-xs tracking-tighter transition-all flex items-center justify-center gap-2 hover:bg-indigo-500 hover:scale-105 active:scale-95"><span>⚡</span> 퀵 매칭 시작</button>
</div>

{/* 오너 선택 */}
<div className="flex flex-col gap-1 mb-4">
<label className="text-[10px] text-slate-500 font-bold">1. Select Owner (Manual)</label>
<select value={selectedOwnerId} onChange={e => setSelectedOwnerId(e.target.value)} disabled={isRolling} className="bg-slate-950 p-3 rounded border border-slate-700 text-white w-full text-sm font-bold">
<option value="">👤 Select Owner</option>
{owners.map(o => <option key={o.id} value={o.id}>{o.nickname}</option>)}
</select>
</div>

{/* 검색 옵션 */}
<div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-3 mb-4">
<div className="flex justify-between items-center">
<label className="text-[10px] text-slate-500 font-bold">2. Search Options (Manual)</label>
<button onClick={handleRandom} disabled={isRolling} className={`h-10 px-6 rounded-lg text-xs font-black italic tracking-tighter text-white shadow-lg border border-purple-500 flex items-center justify-center gap-2 transition-all ${isRolling ? 'bg-purple-900 cursor-not-allowed opacity-50' : 'bg-purple-700 hover:bg-purple-600 active:scale-95'}`}>{isRolling ? <span className="animate-spin text-lg">🎰</span> : <span className="text-lg">🎲</span>} 랜덤 매칭 시작</button>
</div>
<div className="grid grid-cols-2 md:grid-cols-4 gap-2">
<select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} disabled={isRolling} className="bg-black p-2 rounded border border-slate-700 text-white text-xs font-bold"><option value="ALL">All Categories</option><option value="CLUB">Club</option><option value="NATIONAL">National</option></select>
<select value={filterLeague} onChange={e => setFilterLeague(e.target.value)} disabled={isRolling} className="bg-black p-2 rounded border border-slate-700 text-white text-xs font-bold"><option value="">All Leagues</option>{allSortedLeagues.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}</select>
<select value={filterTier} onChange={e => setFilterTier(e.target.value)} disabled={isRolling} className="bg-black p-2 rounded border border-slate-700 text-white text-xs font-bold"><option value="ALL">All Tiers</option><option value="S">S Tier</option><option value="A">A Tier</option><option value="B">B Tier</option><option value="C">C Tier</option></select>
<input type="text" value={searchTeam} onChange={e => setSearchTeam(e.target.value)} disabled={isRolling} placeholder="🔍 Name..." className="bg-black p-2 rounded border border-slate-700 text-white text-xs font-bold" />
</div>
</div>

{/* 3. Pack Result / List */}
{randomResult ? (
<div className="flex justify-center py-8 relative" style={{ perspective: '1000px' }}>
{/* 랜덤 결과 애니메이션 (기존 유지) */}
{isFlipping && <div className="blast-circle" />}
<div className={`relative p-6 rounded-[2rem] border-4 flex flex-col items-center gap-4 transition-all duration-500 min-w-[240px] bg-slate-900 ${isFlipping ? 'fc-card-reveal' : ''} ${randomResult.tier === 'S' ? 'border-yellow-500 fc-gold-glow' : 'border-emerald-500'}`}>
<div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg">NEW SIGNING</div>
<div className="w-32 h-32 bg-white rounded-full flex items-center justify-center p-4 shadow-inner"><img src={randomResult.logo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /></div>
<div className="text-center">
<h2 className="text-2xl font-black italic text-white uppercase tracking-tighter">{randomResult.name}</h2>
<p className="text-xs font-bold text-slate-400 mt-1">{randomResult.region} • {randomResult.tier} Tier</p>
</div>
<button onClick={() => handleSignTeam(null)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black italic py-3 rounded-xl shadow-lg mt-2 transition-transform active:scale-95">✅ SIGN THIS TEAM</button>
</div>
</div>
) : (
!filterLeague && !searchTeam ? (
<div className="space-y-8 max-h-[400px] overflow-y-auto custom-scrollbar p-1">
{/* 리그 목록 (기존 유지) */}
{(filterCategory === 'ALL' || filterCategory === 'CLUB') && (
<div>
<div className="flex items-center gap-2 mb-3"><div className="w-1 h-4 bg-emerald-500 rounded-full"></div><h4 className="text-emerald-500 font-black italic text-xs uppercase tracking-widest">Club Leagues</h4></div>
<div className="grid grid-cols-3 gap-3">
{clubLeagues.map(l => {
const count = masterTeams.filter(t => t.region === l.name).length;
return (
<div key={l.id} onClick={() => setFilterLeague(l.name)} className="bg-slate-900 p-3 rounded-2xl border border-slate-800 cursor-pointer hover:border-emerald-500 flex flex-col items-center gap-3 group transition-all hover:bg-slate-900 shadow-lg aspect-[4/5] justify-center relative overflow-hidden">
<div className="w-14 h-14 bg-white rounded-full flex items-center justify-center p-2.5 shadow-inner shrink-0 z-10"><img src={l.logo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /></div>
<div className="text-center w-full z-10"><p className="text-[10px] text-white font-black italic group-hover:text-emerald-400 truncate w-full tracking-tighter uppercase">{l.name}</p><p className="text-[9px] text-slate-500 font-bold">{count} Teams</p></div>
</div>
);
})}
</div>
</div>
)}
{(filterCategory === 'ALL' || filterCategory === 'NATIONAL') && (
<div>
<div className="flex items-center gap-2 mb-3"><div className="w-1 h-4 bg-blue-500 rounded-full"></div><h4 className="text-blue-500 font-black italic text-xs uppercase tracking-widest">National Teams</h4></div>
<div className="grid grid-cols-3 gap-3">
{nationalLeagues.map(l => {
const count = masterTeams.filter(t => t.region === l.name).length;
return (
<div key={l.id} onClick={() => setFilterLeague(l.name)} className="bg-slate-900 p-3 rounded-2xl border border-slate-800 cursor-pointer hover:border-blue-500 flex flex-col items-center gap-3 group transition-all hover:bg-slate-900 shadow-lg aspect-[4/5] justify-center relative overflow-hidden">
<div className="w-14 h-14 bg-white rounded-full flex items-center justify-center p-2.5 shadow-inner shrink-0 z-10"><img src={l.logo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /></div>
<div className="text-center w-full z-10"><p className="text-[10px] text-white font-black italic group-hover:text-blue-400 truncate w-full tracking-tighter uppercase">{l.name}</p><p className="text-[9px] text-slate-500 font-bold">{count} Teams</p></div>
</div>
);
})}
</div>
</div>
)}
</div>
) : (
// 🔥 [수정됨] 검색 결과 리스트 (Step 1) - TeamCard 컴포넌트 적용!
<div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
{availableTeams.length > 0 ? availableTeams.slice(0, 30).map(t => (
<TeamCard
key={t.id}
team={t}
onClick={() => handleSignTeam(t)}
className="cursor-pointer"
/>
)) : <div className="col-span-3 text-center py-10 text-slate-500">No teams found.</div>}
</div>
)
)}
</div>

{/* ================= STEP 2: GROUP DRAW BOARD ================= */}
{/* ✨ 여기가 교체 포인트! AdminCupStep2 컴포넌트로 대체 */}
<AdminCupStep2
unassignedPool={unassignedPool}
groups={groups}
customConfig={customConfig}
configMode={configMode}
onDragStart={handleDragStart}
onDrop={handleDrop}
onDragOver={handleDragOver}
onSlotClick={handleSlotClick}
onUpdateStructure={updateBoardStructure}
onAutoDraw={handleAutoDraw}
onResetDraw={handleResetDraw}
onCreateSchedule={handleCreateSchedule}
/>

{/* ================= STEP 3: TOURNAMENT BRACKET SETUP ================= */}
{/* ✨ 여기가 교체 포인트! AdminCupStep3 컴포넌트로 대체 */}
<AdminCupStep3
waitingPool={tournamentWaitingPool}
bracket={tournamentBracket}
onDragStart={handleDragStart} // 🔥 [수정] handleDragStart에서 토너먼트 드래그용 상태도 함께 업데이트하도록 로직 보강함
onDragOver={handleDragOver}
onDrop={handleTournamentDrop}
onSlotClick={handleTournamentSlotClick} // 🔥 [수정] 조별리그와 동일한 로직으로 클릭 시 배정 기능 구현
onAutoMatch={handleTournamentAutoMatch}
onRandomMatch={handleTournamentRandomMatch}
onCreateSchedule={handleCreateTournamentSchedule}
/>

{/* 🔥 [통합] 배정 모달 (조별리그 & 토너먼트 공통 사용) */}
{targetSlot && (
<div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
<div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setTargetSlot(null)} />
<div className="bg-slate-900 w-full max-w-md rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden flex flex-col max-h-[80vh]">
<div className="p-5 border-b border-slate-800 bg-slate-950">
    <h3 className="text-white font-black italic text-lg">
        {targetSlot.isTournament ? `Select Team for Tournament Slot ${targetSlot.idx + 1}` : `Select Team for ${targetSlot.group}-${targetSlot.idx + 1}`}
    </h3>
    <p className="text-xs text-slate-400">
        Choose from {targetSlot.isTournament ? `Qualified Teams (${tournamentWaitingPool.length})` : `Waiting Pool (${unassignedPool.length})`}
    </p>
</div>
<div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
{/* 🔥 [수정] 토너먼트냐 조별리그냐에 따라 보여주는 풀(Pool) 변경 */}
{(targetSlot.isTournament ? tournamentWaitingPool : unassignedPool).length === 0 ? (
    <div className="text-center py-10 text-slate-500 font-bold">No teams available.</div>
) : (targetSlot.isTournament ? tournamentWaitingPool : unassignedPool).map(entry => (
<div key={entry.id} onClick={() => confirmSlotSelection(entry)} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700 cursor-pointer hover:bg-emerald-900/30 hover:border-emerald-500 transition-all">
<div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1.5 shrink-0"><img src={entry.logo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /></div>
<div className="flex-1 min-w-0"><h4 className="text-sm font-bold text-white truncate">{entry.name}</h4><p className="text-xs text-emerald-400">{entry.ownerName} • <span className="text-slate-500">{entry.region}</span></p></div>
<div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white">➜</div>
</div>
))}
</div>
<div className="p-4 bg-slate-950 border-t border-slate-800 text-center"><button onClick={() => setTargetSlot(null)} className="text-xs text-slate-500 hover:text-white underline">Cancel Selection</button></div>
</div>
</div>
)}

{/* Quick Draft Modal (기존 코드 유지) */}
<QuickDraftModal
isOpen={isDraftOpen}
onClose={() => setIsDraftOpen(false)}
owners={owners}
masterTeams={masterTeams}
onConfirm={handleDraftApply}
/>
</div>
);
};