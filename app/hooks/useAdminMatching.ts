import { useState, useMemo, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { updateDoc, doc, collection, writeBatch } from 'firebase/firestore';
import { Season, Owner, League, MasterTeam, Team, Match, FALLBACK_IMG } from '../types';
import { generateRoundsLogic } from '../utils/scheduler';
import { getSortedLeagues, getSortedTeamsLogic } from '../utils/helpers';

export const useAdminMatching = (
    targetSeason: Season, 
    owners: Owner[], 
    leagues: League[], 
    masterTeams: MasterTeam[], 
    onNavigateToSchedule: (id: number) => void
) => {
    // 1. 공통 State
    const [selectedOwnerId, setSelectedOwnerId] = useState('');
    const [selectedMasterTeamDocId, setSelectedMasterTeamDocId] = useState('');
    const [randomResult, setRandomResult] = useState<MasterTeam | null>(null);
    const [isRolling, setIsRolling] = useState(false);
    const [isFlipping, setIsFlipping] = useState(false); 
    const [isDraftOpen, setIsDraftOpen] = useState(false);

    // 검색 필터 State
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [filterLeague, setFilterLeague] = useState('');
    const [filterTier, setFilterTier] = useState('ALL');
    const [searchTeam, setSearchTeam] = useState('');

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const hasSchedule = targetSeason.rounds && targetSeason.rounds.length > 0;

    // 2. Playoff 전용 State
    const [poWaitingPool, setPoWaitingPool] = useState<any[]>([]);
    const [poBracket, setPoBracket] = useState<(any | null)[]>(Array(5).fill(null));

    // 3. Tournament 전용 State
    const [tourneyWaitingPool, setTourneyWaitingPool] = useState<any[]>([]);
    const [tourneyBracket, setTourneyBracket] = useState<(any | null)[]>([]);
    const [tourneyTargetSize, setTourneyTargetSize] = useState<number>(0);

    // ==========================================
    // 💡 잠금(Lock) 확인 로직
    // ==========================================
    const isPoLocked = useMemo(() => {
        if (targetSeason.type !== 'LEAGUE_PLAYOFF' || !targetSeason.rounds) return false;
        const finalRound = targetSeason.rounds.find(r => r.name === 'FINAL');
        if (!finalRound || !finalRound.matches || finalRound.matches.length === 0) return false;
        const finalHome = finalRound.matches[0]?.home || '';
        return finalHome !== 'TBD' && finalHome !== 'BYE' && !finalHome.includes('1위');
    }, [targetSeason.rounds, targetSeason.type]);

    const isTourneyLocked = useMemo(() => {
        if (targetSeason.type !== 'TOURNAMENT' || !targetSeason.rounds || targetSeason.rounds.length === 0) return false;
        return targetSeason.rounds[0].matches.some(m => m.status === 'COMPLETED' || m.homeScore !== '' || m.awayScore !== '');
    }, [targetSeason.rounds, targetSeason.type]);

    // ==========================================
    // 💡 초기화 useEffect 로직 (PO & Tourney)
    // ==========================================
    useEffect(() => {
        if (isPoLocked && targetSeason.rounds && targetSeason.type === 'LEAGUE_PLAYOFF') {
            const getTeam = (name: string) => targetSeason.teams?.find(t => t.name === name) || null;
            const finalMatch = targetSeason.rounds.find(r => r.name === 'FINAL')?.matches?.[0];
            const r4Match1 = targetSeason.rounds.find(r => r.name === 'ROUND_OF_4')?.matches?.find(m => m.matchLabel?.includes('1차전') && m.matchLabel?.includes('5위'));
            const r4Match2 = targetSeason.rounds.find(r => r.name === 'ROUND_OF_4')?.matches?.find(m => m.matchLabel?.includes('1차전') && m.matchLabel?.includes('4위'));

            setPoBracket([
                finalMatch ? getTeam(finalMatch.home) : null,
                r4Match1 ? getTeam(r4Match1.away) : null,
                r4Match1 ? getTeam(r4Match1.home) : null,
                r4Match2 ? getTeam(r4Match2.away) : null,
                r4Match2 ? getTeam(r4Match2.home) : null
            ]);
            setPoWaitingPool([]);
        }
    }, [isPoLocked, targetSeason]);

    useEffect(() => {
        if (hasSchedule && targetSeason.type === 'TOURNAMENT' && targetSeason.rounds) {
            const teams = targetSeason.teams || [];
            const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(Math.max(2, teams.length))));
            setTourneyTargetSize(nextPowerOf2);

            const firstRoundMatches = targetSeason.rounds[0].matches.slice(0, nextPowerOf2 / 2);
            const currentBracket: (any|null)[] = Array(nextPowerOf2).fill(null);
            firstRoundMatches.forEach((m, idx) => {
                if (m.home !== 'BYE' && m.home !== 'TBD') currentBracket[idx * 2] = teams.find(t => t.name === m.home) || null;
                if (m.away !== 'BYE' && m.away !== 'TBD') currentBracket[idx * 2 + 1] = teams.find(t => t.name === m.away) || null;
            });

            setTourneyBracket(currentBracket);
            const bracketTeamNames = currentBracket.filter(Boolean).map(t => t.name);
            setTourneyWaitingPool(teams.filter(t => !bracketTeamNames.includes(t.name)));
        }
    }, [hasSchedule, targetSeason]);

    useEffect(() => { 
        if (randomResult && !isRolling) setRandomResult(null); 
    }, [filterCategory, filterLeague, filterTier, searchTeam]);

    useEffect(() => {
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []);

    // ==========================================
    // 💡 공통 필터 및 검색 로직
    // ==========================================
    const displaySortedLeagues = useMemo(() => {
        let targets = leagues;
        if (filterCategory !== 'ALL') targets = targets.filter(l => l.category === filterCategory);
        const sortedNames = getSortedLeagues(targets.map(l => l.name));
        return sortedNames.map(name => targets.find(l => l.name === name)).filter(Boolean) as League[];
    }, [leagues, filterCategory]);

    const availableTeams = useMemo(() => {
        const assignedNames = new Set(targetSeason.teams?.map(t => t.name) || []);
        let teams = masterTeams.filter(t => !assignedNames.has(t.name));
        if (filterCategory !== 'ALL') teams = teams.filter(t => filterCategory === 'CLUB' ? t.category !== 'NATIONAL' : t.category === 'NATIONAL');
        if (filterLeague) teams = teams.filter(t => t.region === filterLeague);
        if (filterTier !== 'ALL') teams = teams.filter(t => t.tier?.trim() === filterTier);
        if (searchTeam) teams = teams.filter(t => t.name.toLowerCase().includes(searchTeam.toLowerCase()));
        return getSortedTeamsLogic(teams, '');
    }, [masterTeams, targetSeason, filterCategory, filterLeague, filterTier, searchTeam]);

    // ==========================================
    // 💡 공통 핸들러 (Add, Remove, Generate)
    // ==========================================
    const handleRandom = () => {
        if (hasSchedule) return alert("🚫 스케줄이 이미 생성되어 팀을 추가할 수 없습니다.");
        if (!selectedOwnerId) return alert("오너를 먼저 선택해주세요.");
        if (availableTeams.length === 0) return alert("조건에 맞는 남은 팀이 없습니다.");
        if (isRolling) return;

        setIsRolling(true); setIsFlipping(false); setRandomResult(null);
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
            setSelectedMasterTeamDocId(finalWinner.docId || String(finalWinner.id));
            setIsFlipping(true); setIsRolling(false); 
            setTimeout(() => { document.getElementById(`team-card-${finalWinner.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 500);
        }, 2500);
    };

    const handleAddTeam = async () => {
        if (hasSchedule || isRolling || !selectedOwnerId || !selectedMasterTeamDocId) return;
        const owner = owners.find(o => String(o.id) === selectedOwnerId || o.uid === selectedOwnerId);
        const mTeam = masterTeams.find(t => (t.docId || String(t.id)) === selectedMasterTeamDocId);
        if (!owner || !mTeam) return;

        if (targetSeason.teams?.some(t => t.name === mTeam.name)) return alert(`🚫 이미 등록된 팀입니다: ${mTeam.name}`);

        const newTeam: Team = {
            id: Date.now(), seasonId: targetSeason.id, name: mTeam.name, logo: mTeam.logo, 
            ownerName: owner.nickname, ownerUid: owner.uid || owner.docId || '', 
            region: mTeam.region, tier: mTeam.tier, 
            win: 0, draw: 0, loss: 0, points: 0, gf: 0, ga: 0, gd: 0
        };
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { teams: [...(targetSeason.teams || []), newTeam] });
        setSelectedMasterTeamDocId(''); setRandomResult(null); setIsFlipping(false);
    };

    const handleRemoveTeam = async (teamId: number, teamName: string) => {
        if (hasSchedule || !confirm("정말 삭제하시겠습니까?")) return;
        const updatedTeams = targetSeason.teams.filter(t => t.id !== teamId);
        let updatedRounds = targetSeason.rounds ? [...targetSeason.rounds] : [];
        if (updatedRounds.length > 0) {
            updatedRounds = updatedRounds.map(r => ({
                ...r, matches: (r.matches || []).filter(m => m.home !== teamName && m.away !== teamName)
            })).filter(r => r.matches && r.matches.length > 0);
        }
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { teams: updatedTeams, rounds: updatedRounds });
    };

    const recordEntryFeesInternal = async (seasonId: number|string, seasonName: string, totalPrize: number, ownerIds: string[]) => {
        try {
            if (!ownerIds || ownerIds.length === 0 || !totalPrize) return;
            const entryFee = Math.floor(totalPrize / ownerIds.length);
            if (entryFee <= 0) return;
            const batch = writeBatch(db);
            ownerIds.forEach(id => {
                batch.set(doc(collection(db, 'finance_ledger')), {
                    seasonId: String(seasonId), ownerId: String(id), type: 'EXPENSE', amount: entryFee,
                    title: `${seasonName} 참가비 🎫`, createdAt: new Date().toISOString()
                });
            });
            await batch.commit();
        } catch (e) { console.error(e); }
    };

    const handleGenerateSchedule = async (isRegen = false) => {
        if (targetSeason.teams.length < 2) return alert("최소 2팀 이상 필요.");
        const teamNames = targetSeason.teams.map(t => t.name);
        if (teamNames.length !== new Set(teamNames).size) return alert("🚫 중복된 팀이 등록되어 있습니다!");
        if (isRegen && !confirm("기존 스케줄을 덮어씌우시겠습니까?")) return;

        const refreshedTeams = targetSeason.teams.map(st => {
            const m = masterTeams.find(mt => mt.name === st.name);
            return m ? { ...st, logo: m.logo, tier: m.tier, region: m.region, ownerUid: (st as any).ownerUid || m.ownerUid } : st;
        });

        const shuffledTeams = [...refreshedTeams].sort(() => Math.random() - 0.5);
        const rounds = generateRoundsLogic({ ...targetSeason, teams: shuffledTeams, rounds: [] });
        
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { teams: shuffledTeams, rounds });

        if (!isRegen && (targetSeason as any).totalPrize) {
            const uids = Array.from(new Set(shuffledTeams.map(t => (t as any).ownerUid))).filter(u => u) as string[];
            recordEntryFeesInternal(targetSeason.id, targetSeason.name, (targetSeason as any).totalPrize, uids);
        }

        if (targetSeason.type === 'TOURNAMENT') alert("스케줄 생성 완료.\n하단에서 1라운드 대진표를 배치해주세요!");
        else if (confirm("스케줄 생성 완료. 이동하시겠습니까?")) onNavigateToSchedule(targetSeason.id);
    };

    const handleDraftApply = async (newTeams: Team[]) => {
        const existingNames = new Set(targetSeason.teams?.map(t => t.name) || []);
        const filtered = newTeams.filter(t => !existingNames.has(t.name));
        if (filtered.length === 0) return;
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { 
            teams: [...(targetSeason.teams || []), ...filtered.map(t => ({ ...t, seasonId: targetSeason.id }))] 
        });
    };

    // ==========================================
    // 💡 최종 반환 (Return 객체)
    // ==========================================
    return {
        // 공통 상태
        hasSchedule, isRolling, isFlipping, randomResult,
        filterCategory, filterLeague, filterTier, searchTeam,
        selectedOwnerId, selectedMasterTeamDocId, isDraftOpen,
        displaySortedLeagues, availableTeams,
        
        // 공통 Setter
        setFilterCategory, setFilterLeague, setFilterTier, setSearchTeam,
        setSelectedOwnerId, setSelectedMasterTeamDocId, setIsDraftOpen, setRandomResult, setIsFlipping,

        // 공통 핸들러
        handleRandom, handleAddTeam, handleRemoveTeam, handleGenerateSchedule, handleDraftApply,

        // Playoff 특화
        poWaitingPool, setPoWaitingPool, poBracket, setPoBracket, isPoLocked,
        
        // Tournament 특화
        tourneyWaitingPool, setTourneyWaitingPool, tourneyBracket, setTourneyBracket, isTourneyLocked, tourneyTargetSize
    };
};