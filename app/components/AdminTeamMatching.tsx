"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { updateDoc, doc, collection, writeBatch } from 'firebase/firestore';
import { Season, Owner, League, MasterTeam, Team, FALLBACK_IMG, Match } from '../types';
import { generateRoundsLogic } from '../utils/scheduler';
import { getSortedLeagues, getSortedTeamsLogic, getTierBadgeColor } from '../utils/helpers';
import { QuickDraftModal } from './QuickDraftModal';
import { TeamCard } from './TeamCard'; 

const recordEntryFees = async (seasonId: number | string, seasonName: string, totalPrize: number, ownerIds: string[]) => {
    try {
        if (!ownerIds || ownerIds.length === 0 || !totalPrize) return;
        const entryFee = Math.floor(totalPrize / ownerIds.length);
        if (entryFee <= 0) return;

        const batch = writeBatch(db);
        const ledgerRef = collection(db, 'finance_ledger');

        ownerIds.forEach(ownerId => {
            const newDocRef = doc(ledgerRef); 
            batch.set(newDocRef, {
                seasonId: String(seasonId),
                ownerId: String(ownerId),
                type: 'EXPENSE',
                amount: entryFee,
                title: `${seasonName} 참가비 🎫`,
                createdAt: new Date().toISOString()
            });
        });

        await batch.commit();
    } catch (error) {
        console.error("🚨 [Finance] 참가비 기록 중 에러 발생:", error);
    }
};

interface Props {
    targetSeason: Season;
    owners: Owner[];
    leagues: League[];
    masterTeams: MasterTeam[];
    onNavigateToSchedule: (id: number) => void;
    onDeleteSchedule: (id: number) => void;
}

export const AdminTeamMatching = ({ targetSeason, owners, leagues, masterTeams, onNavigateToSchedule, onDeleteSchedule }: Props) => {
    const [selectedOwnerId, setSelectedOwnerId] = useState('');
    const [selectedMasterTeamDocId, setSelectedMasterTeamDocId] = useState('');
    const [randomResult, setRandomResult] = useState<MasterTeam | null>(null);
    const [isRolling, setIsRolling] = useState(false);
    const [isFlipping, setIsFlipping] = useState(false); 
    const [isDraftOpen, setIsDraftOpen] = useState(false);

    // 🔥 플레이오프 드래그 앤 드롭 상태
    const [poWaitingPool, setPoWaitingPool] = useState<any[]>([]);
    // bracket: [0: Final(1st), 1: Semi1_Home(2nd), 2: Semi1_Away(5th), 3: Semi2_Home(3rd), 4: Semi2_Away(4th)]
    const [poBracket, setPoBracket] = useState<(any | null)[]>(Array(5).fill(null));

    const [filterCategory, setFilterCategory] = useState('ALL');
    const [filterLeague, setFilterLeague] = useState('');
    const [filterTier, setFilterTier] = useState('ALL');
    const [searchTeam, setSearchTeam] = useState('');

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const hasSchedule = targetSeason.rounds && targetSeason.rounds.length > 0;

    // 🔥 플레이오프 락(Lock) 상태 판별 (방어 로직 추가)
    const isPoLocked = useMemo(() => {
        if (targetSeason.type !== 'LEAGUE_PLAYOFF' || !targetSeason.rounds) return false;
        const finalRound = targetSeason.rounds.find(r => r.name === 'FINAL');
        if (!finalRound || !finalRound.matches || finalRound.matches.length === 0) return false;
        
        // 방어막: matches[0]이 없거나 home 속성이 없을 경우 에러 방지
        const finalHome = finalRound.matches[0]?.home || '';
        return finalHome !== 'TBD' && finalHome !== 'BYE' && !finalHome.includes('1위');
    }, [targetSeason.rounds, targetSeason.type]);

    // 확정(Locked)된 경우 초기 마운트 시 브래킷 데이터 복원 (방어 로직 추가)
    useEffect(() => {
        if (isPoLocked && targetSeason.rounds && targetSeason.type === 'LEAGUE_PLAYOFF') {
            const getTeam = (name: string) => targetSeason.teams?.find(t => t.name === name) || null;
            // 방어막: matches 배열 접근 시 optional chaining(?.) 적용
            const finalMatch = targetSeason.rounds.find(r => r.name === 'FINAL')?.matches?.[0];
            const r4Match1 = targetSeason.rounds.find(r => r.name === 'ROUND_OF_4')?.matches?.find(m => m.matchLabel?.includes('1차전') && m.matchLabel?.includes('5위'));
            const r4Match2 = targetSeason.rounds.find(r => r.name === 'ROUND_OF_4')?.matches?.find(m => m.matchLabel?.includes('1차전') && m.matchLabel?.includes('4위'));

            let t1 = finalMatch ? getTeam(finalMatch.home) : null;
            let t2 = r4Match1 ? getTeam(r4Match1.away) : null;
            let t5 = r4Match1 ? getTeam(r4Match1.home) : null;
            let t3 = r4Match2 ? getTeam(r4Match2.away) : null;
            let t4 = r4Match2 ? getTeam(r4Match2.home) : null;

            setPoBracket([t1, t2, t5, t3, t4]);
            setPoWaitingPool([]);
        }
    }, [isPoLocked, targetSeason]);

    useEffect(() => { 
        if (randomResult && !isRolling) setRandomResult(null); 
    }, [filterCategory, filterLeague, filterTier, searchTeam]);

    useEffect(() => {
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []);

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

    const handleRandom = () => {
        if (hasSchedule) return alert("🚫 스케줄이 이미 생성되어 팀을 추가할 수 없습니다.");
        if (!selectedOwnerId) return alert("오너를 먼저 선택해주세요.");
        if (availableTeams.length === 0) return alert("조건에 맞는 남은 팀이 없습니다.");
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
            setSelectedMasterTeamDocId(finalWinner.docId || String(finalWinner.id));
            
            setIsFlipping(true);
            setIsRolling(false); 

            setTimeout(() => {
                document.getElementById(`team-card-${finalWinner.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 500);
        }, 2500);
    };

    const handleAddTeam = async () => {
        if (hasSchedule) return alert("🚫 스케줄이 생성된 상태에서는 팀을 추가할 수 없습니다.");
        if (isRolling) return;
        if (!selectedOwnerId || !selectedMasterTeamDocId) return alert("오너와 팀을 선택하세요.");
        
        const owner = owners.find(o => String(o.id) === selectedOwnerId || o.uid === selectedOwnerId);
        const mTeam = masterTeams.find(t => (t.docId || String(t.id)) === selectedMasterTeamDocId);
        if (!owner || !mTeam) return;

        const isDuplicate = targetSeason.teams?.some(t => t.name === mTeam.name);
        if (isDuplicate) return alert(`🚫 이미 등록된 팀입니다: ${mTeam.name}\n다른 팀을 선택해주세요.`);

        const newTeam: Team = {
            id: Date.now(), seasonId: targetSeason.id, name: mTeam.name, logo: mTeam.logo, 
            ownerName: owner.nickname, ownerUid: owner.uid || owner.docId || '', 
            region: mTeam.region, tier: mTeam.tier, 
            win: 0, draw: 0, loss: 0, points: 0, gf: 0, ga: 0, gd: 0
        };
        
        const updatedTeams = [...(targetSeason.teams || []), newTeam];
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { teams: updatedTeams });
        setSelectedMasterTeamDocId('');
        setRandomResult(null);
        setIsFlipping(false);
    };

    const handleRemoveTeam = async (teamId: number, teamName: string) => {
        if (hasSchedule) return alert("🚫 스케줄이 생성된 상태에서는 팀을 삭제할 수 없습니다.");
        if (!confirm("정말 삭제하시겠습니까?")) return;
        const updatedTeams = targetSeason.teams.filter(t => t.id !== teamId);
        let updatedRounds = targetSeason.rounds ? [...targetSeason.rounds] : [];
        if (updatedRounds.length > 0) {
            // 방어막: r.matches가 비어있을 수 있으므로 || [] 추가
            updatedRounds = updatedRounds.map(r => ({
                ...r, matches: (r.matches || []).filter(m => m.home !== teamName && m.away !== teamName)
            })).filter(r => r.matches && r.matches.length > 0);
        }
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { teams: updatedTeams, rounds: updatedRounds });
    };

    const handleGenerateSchedule = async (isRegen = false) => {
        if (targetSeason.teams.length < 2) return alert("최소 2팀 이상 필요.");
        
        const teamNames = targetSeason.teams.map(t => t.name);
        const uniqueNames = new Set(teamNames);
        if (teamNames.length !== uniqueNames.size) return alert("🚫 중복된 팀이 등록되어 있습니다!");

        if (isRegen && !confirm("기존 스케줄을 덮어씌우시겠습니까?")) return;

        const refreshedTeams = targetSeason.teams.map(seasonTeam => {
            const master = masterTeams.find(m => m.name === seasonTeam.name);
            if (master) return { ...seasonTeam, logo: master.logo, tier: master.tier, region: master.region, ownerUid: (seasonTeam as any).ownerUid || master.ownerUid };
            return seasonTeam;
        });

        const shuffledTeams = [...refreshedTeams].sort(() => Math.random() - 0.5);
        const tempSeason = { ...targetSeason, teams: shuffledTeams, rounds: [] };
        const rounds = generateRoundsLogic(tempSeason);
        
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { teams: shuffledTeams, rounds });

        if (!isRegen && (targetSeason as any).totalPrize) {
            const uniqueOwnerUids = Array.from(new Set(shuffledTeams.map(t => (t as any).ownerUid))).filter(uid => uid);
            let finalOwnerUids = [...uniqueOwnerUids];
            if (finalOwnerUids.length === 0) {
                const uniqueOwnerNames = Array.from(new Set(shuffledTeams.map(t => t.ownerName)));
                finalOwnerUids = uniqueOwnerNames.map(name => {
                    const owner = owners.find(o => o.nickname === name);
                    return owner ? String(owner.uid || owner.id) : '';
                }).filter(id => id !== '');
            }
            recordEntryFees(targetSeason.id, targetSeason.name, (targetSeason as any).totalPrize, finalOwnerUids);
        }

        if (confirm("스케줄 생성 완료. 이동하시겠습니까?")) onNavigateToSchedule(targetSeason.id);
    };

    const handleDraftApply = async (newTeams: Team[]) => {
        const existingNames = new Set(targetSeason.teams?.map(t => t.name) || []);
        const filteredNewTeams = newTeams.filter(t => !existingNames.has(t.name));
        if (filteredNewTeams.length === 0) return;
        const teamsWithSeason = filteredNewTeams.map(t => ({ ...t, seasonId: targetSeason.id }));
        const updatedTeams = [...(targetSeason.teams || []), ...teamsWithSeason];
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { teams: updatedTeams });
    };

    // =========================================================================
    // 🔥 플레이오프 드래그 앤 드롭 대기실 및 편성 로직
    // =========================================================================
    const handleLoadPlayoffTeams = () => {
        if (!targetSeason.rounds) return;
        
        // 방어막: r.matches 접근 시 || [] 처리
        const leagueMatches = targetSeason.rounds
            .filter(r => !['ROUND_OF_4', 'SEMI_FINAL', 'FINAL'].includes(r.name))
            .flatMap(r => r.matches || [])
            .filter(m => m.status === 'COMPLETED');

        const statsMap: Record<string, any> = {};
        targetSeason.teams.forEach(t => {
            const master = masterTeams.find(m => m.name === t.name);
            statsMap[t.name] = { 
                ...t, logo: master?.logo || t.logo, tier: master?.tier || t.tier, ownerUid: (t as any).ownerUid || master?.ownerUid,
                win: 0, draw: 0, loss: 0, points: 0, gd: 0, gf: 0 
            };
        });

        leagueMatches.forEach(m => {
            if (!statsMap[m.home] || !statsMap[m.away]) return;
            const hScore = Number(m.homeScore); const aScore = Number(m.awayScore);
            statsMap[m.home].gf += hScore; statsMap[m.away].gf += aScore;
            statsMap[m.home].gd += (hScore - aScore); statsMap[m.away].gd += (aScore - hScore);
            if (hScore > aScore) { statsMap[m.home].win += 1; statsMap[m.home].points += 3; statsMap[m.away].loss += 1; } 
            else if (aScore > hScore) { statsMap[m.away].win += 1; statsMap[m.away].points += 3; statsMap[m.home].loss += 1; } 
            else { statsMap[m.home].draw += 1; statsMap[m.home].points += 1; statsMap[m.away].draw += 1; statsMap[m.away].points += 1; }
        });

        const rankedTeams = Object.values(statsMap).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.gf - a.gf;
        }).slice(0, 5).map((t, idx) => ({ ...t, _realRank: idx + 1 })); 

        if (rankedTeams.length < 5) return alert("리그에 참가한 팀이 5팀 미만이라 PO를 구성할 수 없습니다.");

        setPoWaitingPool(rankedTeams);
        setPoBracket(Array(5).fill(null)); 
        
        setTimeout(() => { document.getElementById('po-setup-section')?.scrollIntoView({ behavior: 'smooth' }); }, 100);
    };

    const handleAutoFillPoBracket = () => {
        if (isPoLocked) return alert("이미 확정되었습니다. 해제 후 이용하세요.");
        const allTeams = [...poWaitingPool, ...poBracket.filter(Boolean)];
        const newBracket = Array(5).fill(null);
        
        allTeams.forEach(t => {
            if (t._realRank === 1) newBracket[0] = t; 
            if (t._realRank === 2) newBracket[1] = t; 
            if (t._realRank === 5) newBracket[2] = t; 
            if (t._realRank === 3) newBracket[3] = t; 
            if (t._realRank === 4) newBracket[4] = t; 
        });

        setPoBracket(newBracket);
        setPoWaitingPool([]);
    };

    const handleResetPoBracket = () => {
        if (isPoLocked) return alert("이미 확정되었습니다. 해제 후 이용하세요.");
        const allTeams = [...poWaitingPool, ...poBracket.filter(Boolean)].sort((a, b) => a._realRank - b._realRank);
        setPoWaitingPool(allTeams);
        setPoBracket(Array(5).fill(null));
    };

    const handleUnlockPoBracket = async () => {
        if (!confirm("확정된 대진을 해제하고 초기화하시겠습니까?")) return;
        
        // 1. 기존 라운드에서 PO 라운드 3개를 완전히 제거
        const filteredRounds = targetSeason.rounds?.filter(r => 
            !['ROUND_OF_4', 'PO_FINAL', 'SEMI_FINAL', 'FINAL'].includes(r.name)
        ) || [];

        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { rounds: filteredRounds });
        handleLoadPlayoffTeams();
    };

    const handleDragStart = (e: React.DragEvent, source: 'pool' | 'bracket', index: number | null, team: any) => {
        if (isPoLocked) return;
        e.dataTransfer.setData('text/plain', JSON.stringify({ source, index, teamId: team.id }));
    };

    const handleDragOver = (e: React.DragEvent) => { if (!isPoLocked) e.preventDefault(); };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        if (isPoLocked) return;
        e.preventDefault();
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const { source, index, teamId } = data;

        let team = source === 'pool' ? poWaitingPool.find(t => t.id === teamId) : poBracket[index!];
        if (!team) return;

        const newBracket = [...poBracket];
        const newPool = [...poWaitingPool];
        const existingTeam = newBracket[targetIndex];

        newBracket[targetIndex] = team;

        if (source === 'pool') {
            newPool.splice(newPool.findIndex(t => t.id === teamId), 1);
        } else if (source === 'bracket') {
            newBracket[index!] = existingTeam; 
        }

        if (source === 'pool' && existingTeam) {
            newPool.push(existingTeam); 
            newPool.sort((a, b) => a._realRank - b._realRank);
        }

        setPoBracket(newBracket);
        setPoWaitingPool(newPool);
    };

    const handleSlotClick = (index: number) => {
        if (isPoLocked) return;
        const team = poBracket[index];
        if (!team) return;
        const newBracket = [...poBracket];
        newBracket[index] = null;
        
        const newPool = [...poWaitingPool, team].sort((a, b) => a._realRank - b._realRank);
        setPoBracket(newBracket);
        setPoWaitingPool(newPool);
    };

    // 🔥 [수술 포인트] 스케줄 3단계 구조 연동 완벽 적용 (4강 -> PO결승 -> 최종결승)
    const handleConfirmPlayoffBracket = async () => {
        if (isPoLocked) return;
        if (poBracket.includes(null)) return alert("🚨 5개의 모든 대진 슬롯에 팀을 배치해주세요.");
        if (!confirm("현재 설정된 대진표로 플레이오프 스케줄을 공식 발행하시겠습니까?")) return;

        const [t1, t2, t5, t3, t4] = poBracket; 

        // 기존 라운드에서 PO 관련 라운드를 싹 지우고 시작
        const filteredRounds = targetSeason.rounds?.filter(r => 
            !['ROUND_OF_4', 'PO_FINAL', 'SEMI_FINAL', 'FINAL'].includes(r.name)
        ) || [];

        // 1. PO 4강 라운드 생성 (홈&어웨이 2연전)
        const roundOf4 = {
            name: 'ROUND_OF_4',
            matches: [
                { id: `po_4_1_1`, home: t5.name, away: t2.name, homeScore: '', awayScore: '', status: 'UPCOMING', homeLogo: t5.logo, awayLogo: t2.logo, homeOwner: t5.ownerName, awayOwner: t2.ownerName, matchLabel: 'PO 4강 1경기 (1차전: 5위 홈 vs 2위)', stage: 'ROUND_OF_4', seasonId: targetSeason.id, homeOwnerUid: t5.ownerUid, awayOwnerUid: t2.ownerUid },
                { id: `po_4_1_2`, home: t2.name, away: t5.name, homeScore: '', awayScore: '', status: 'UPCOMING', homeLogo: t2.logo, awayLogo: t5.logo, homeOwner: t2.ownerName, awayOwner: t5.ownerName, matchLabel: 'PO 4강 1경기 (2차전: 2위 홈 vs 5위)', stage: 'ROUND_OF_4', seasonId: targetSeason.id, homeOwnerUid: t2.ownerUid, awayOwnerUid: t5.ownerUid },
                { id: `po_4_2_1`, home: t4.name, away: t3.name, homeScore: '', awayScore: '', status: 'UPCOMING', homeLogo: t4.logo, awayLogo: t3.logo, homeOwner: t4.ownerName, awayOwner: t3.ownerName, matchLabel: 'PO 4강 2경기 (1차전: 4위 홈 vs 3위)', stage: 'ROUND_OF_4', seasonId: targetSeason.id, homeOwnerUid: t4.ownerUid, awayOwnerUid: t3.ownerUid },
                { id: `po_4_2_2`, home: t3.name, away: t4.name, homeScore: '', awayScore: '', status: 'UPCOMING', homeLogo: t3.logo, awayLogo: t4.logo, homeOwner: t3.ownerName, awayOwner: t4.ownerName, matchLabel: 'PO 4강 2경기 (2차전: 3위 홈 vs 4위)', stage: 'ROUND_OF_4', seasonId: targetSeason.id, homeOwnerUid: t3.ownerUid, awayOwnerUid: t4.ownerUid },
            ]
        };

        // 2. PO 결승 라운드 생성 (홈&어웨이 2연전 - 대진팀 미정)
        const poFinal = {
            name: 'SEMI_FINAL', // 스케줄 렌더러 호환을 위해 SEMI_FINAL로 네이밍
            matches: [
                { id: `po_fin_1`, home: 'TBD', away: 'TBD', homeScore: '', awayScore: '', status: 'UPCOMING', homeLogo: '', awayLogo: '', homeOwner: '-', awayOwner: '-', matchLabel: 'PO 결승 (1차전)', stage: 'SEMI_FINAL', seasonId: targetSeason.id },
                { id: `po_fin_2`, home: 'TBD', away: 'TBD', homeScore: '', awayScore: '', status: 'UPCOMING', homeLogo: '', awayLogo: '', homeOwner: '-', awayOwner: '-', matchLabel: 'PO 결승 (2차전)', stage: 'SEMI_FINAL', seasonId: targetSeason.id },
            ]
        };

        // 3. 최종 챔피언 결정전 라운드 생성 (단판 - 1위 vs PO결승 승자)
        const grandFinal = {
            name: 'FINAL',
            matches: [
                { id: `grand_fin_1`, home: t1.name, away: 'TBD', homeScore: '', awayScore: '', status: 'UPCOMING', homeLogo: t1.logo, awayLogo: '', homeOwner: t1.ownerName, awayOwner: '-', matchLabel: '🏆 최종 챔피언 결정전 (단판)', stage: 'FINAL', seasonId: targetSeason.id, homeOwnerUid: t1.ownerUid },
            ]
        };

        const updatedRounds = [...filteredRounds, roundOf4, poFinal, grandFinal];

        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { rounds: updatedRounds });
        alert(`🎉 플레이오프 대진표 확정 완료!\n1위 ${t1.name}가 최종 결승전에 선착했습니다.`);
    };

    return (
        <div className="space-y-6 animate-in fade-in relative">
            <style jsx>{`
                .stage-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.92); z-index: 50; backdrop-filter: blur(8px); animation: fadeIn 0.3s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .reveal-flash { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: white; z-index: 60; pointer-events: none; animation: flashAnim 0.6s ease-out forwards; }
                @keyframes flashAnim { 0% { opacity: 0; } 10% { opacity: 0.8; } 100% { opacity: 0; } }
                .blast-circle { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.5); width: 100px; height: 100px; border-radius: 50%; border: 4px solid ${randomResult?.tier === 'S' ? '#fbbf24' : '#34d399'}; box-shadow: 0 0 50px ${randomResult?.tier === 'S' ? '#fbbf24' : '#34d399'}; z-index: 52; pointer-events: none; animation: blastOut 0.8s cubic-bezier(0.165, 0.84, 0.44, 1) forwards; }
                @keyframes blastOut { 0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; border-width: 10px; } 100% { transform: translate(-50%, -50%) scale(4); opacity: 0; border-width: 0px; } }
                .fc-card-reveal { animation: card-flip 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; z-index: 55; }
                @keyframes card-flip { 0% { transform: rotateY(90deg) scale(0.8); filter: brightness(3); } 100% { transform: rotateY(0deg) scale(1.1); filter: brightness(1); } }
                .fc-gold-glow { animation: gold-glow 2s infinite; }
                @keyframes gold-glow { 0%, 100% { box-shadow: 0 0 30px rgba(251, 191, 36, 0.3); } 50% { box-shadow: 0 0 60px rgba(251, 191, 36, 0.8); } }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
            `}</style>

            {(isRolling || isFlipping) && <div className="stage-overlay" />}
            {isFlipping && <div className="reveal-flash" />}

            {/* ==========================================
                STEP 1. 팀 매칭
            ========================================== */}
            <div className={`bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-4 relative ${isRolling || isFlipping ? 'z-[55]' : ''}`}>
                <h3 className="text-white font-bold text-sm border-b border-slate-800 pb-2">Step 1. 팀 & 오너 매칭</h3>

                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-3 rounded-xl border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-3 mb-2">
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <div className="text-white font-black italic flex items-center gap-2 text-sm">
                            <span className="text-yellow-400">⚡</span> 퀵 팀매칭 (Quick Match)
                            <span className="text-[9px] bg-yellow-500 text-black px-1.5 rounded font-black tracking-tighter">HOT</span>
                        </div>
                        <p className="text-sm text-white mt-1 font-bold">✨ 지금 자동으로 팀을 추천 받으세요 ✨</p>
                    </div>
                    <button onClick={() => { if (hasSchedule) return alert("🚫 스케줄이 생성된 상태에서는 실행할 수 없습니다.\n[Step 2]에서 스케줄을 먼저 삭제해주세요."); setIsDraftOpen(true); }} disabled={hasSchedule} className={`h-10 px-6 bg-indigo-600 text-white font-black italic rounded-lg shadow-lg text-xs tracking-tighter transition-all flex items-center justify-center gap-2 ${hasSchedule ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-500 hover:scale-105 active:scale-95'}`}><span>⚡</span> 퀵 매칭 시작</button>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-500 font-bold">1. Select Owner (Manual)</label>
                    <select value={selectedOwnerId} onChange={e => setSelectedOwnerId(e.target.value)} disabled={isRolling} className="bg-slate-950 p-3 rounded border border-slate-700 text-white w-full text-sm font-bold">
                        <option value="">👤 Select Owner</option>
                        {owners.map(o => <option key={o.id} value={o.uid || o.docId || String(o.id)}>{o.nickname}</option>)}
                    </select>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-slate-500 font-bold">2. Search Options (Manual)</label>
                        <button onClick={handleRandom} disabled={isRolling || hasSchedule} className={`h-10 px-6 rounded-lg text-xs font-black italic tracking-tighter text-white shadow-lg border border-purple-500 flex items-center justify-center gap-2 transition-all ${isRolling || hasSchedule ? 'bg-purple-900 cursor-not-allowed opacity-50' : 'bg-purple-700 hover:bg-purple-600 active:scale-95 hover:shadow-purple-500/50'}`}>{isRolling ? <span className="animate-spin text-lg">🎰</span> : <span className="text-lg">🎲</span>} {isRolling ? 'OPENING...' : '랜덤 매칭 시작'}</button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} disabled={isRolling} className="bg-black p-2 rounded border border-slate-700 text-slate-300 text-xs font-bold"><option value="ALL">All Categories</option><option value="CLUB">Club</option><option value="NATIONAL">National</option></select>
                        <select value={filterLeague} onChange={e => setFilterLeague(e.target.value)} disabled={isRolling} className="bg-black p-2 rounded border border-slate-700 text-slate-300 text-xs font-bold"><option value="">All Leagues</option>{getSortedLeagues(leagues.map(l => l.name)).map(l => <option key={l} value={l}>{l}</option>)}</select>
                        <select value={filterTier} onChange={e => setFilterTier(e.target.value)} disabled={isRolling} className="bg-black p-2 rounded border border-slate-700 text-slate-300 text-xs font-bold"><option value="ALL">All Tiers</option><option value="S">S Tier</option><option value="A">A Tier</option><option value="B">B Tier</option><option value="C">C Tier</option></select>
                        <input type="text" value={searchTeam} onChange={e => setSearchTeam(e.target.value)} disabled={isRolling} placeholder="🔍 Name..." className="bg-black p-2 rounded border border-slate-700 text-white text-xs font-bold" />
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center"><label className="text-[10px] text-slate-500 font-bold">3. Pack Result</label>{!isRolling && (filterLeague || randomResult) && <button onClick={() => { setFilterLeague(''); setRandomResult(null); setIsFlipping(false); }} className="text-[10px] text-slate-400 border border-slate-700 px-2 rounded hover:text-white font-bold">↩ Back to Leagues</button>}</div>
                    {randomResult ? (
                        <div className="flex justify-center py-8 relative" style={{ perspective: '1000px' }}>
                            {isFlipping && <div className="blast-circle" />}
                            <div className={`relative p-6 rounded-[2rem] border-4 flex flex-col items-center gap-4 transition-all duration-500 min-w-[240px] ${isFlipping ? 'fc-card-reveal' : ''} ${randomResult.tier === 'S' ? 'bg-gradient-to-b from-yellow-600/30 to slate-900 border-yellow-500 fc-gold-glow' : 'bg-slate-900 border-emerald-500'} ${isRolling ? 'blur-md scale-90 grayscale opacity-60' : 'scale-100 opacity-100'}`}>
                                <div className={`absolute -top-4 text-white text-xs font-black italic tracking-tighter px-4 py-1.5 rounded-full shadow-2xl transition-all ${isRolling ? 'bg-purple-600 animate-pulse' : 'bg-gradient-to-r from-emerald-600 to-teal-600'}`}>{isRolling ? '🎰 SHUFFLING PACK...' : '🏆 PACK OPENED!'}</div>
                                <div className={`w-32 h-32 bg-white rounded-full flex items-center justify-center p-4 shadow-2xl relative z-10 ${randomResult.tier === 'S' ? 'ring-4 ring-yellow-400/50' : 'ring-4 ring-emerald-400/30'}`}><img src={randomResult.logo} className={`w-full h-full object-contain ${isRolling ? 'animate-bounce' : ''}`} alt="" onError={(e: any) => e.target.src = FALLBACK_IMG} /></div>
                                <div className="text-center relative z-10"><p className="text-2xl font-black italic tracking-tighter text-white uppercase leading-none">{randomResult.name}</p><div className="flex items-center justify-center gap-2 mt-2"><span className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest">{randomResult.region}</span><span className={`text-xs px-3 py-0.5 rounded-full font-black italic ${getTierBadgeColor(randomResult.tier)} shadow-lg`}>{randomResult.tier} TIER</span></div></div>
                                {randomResult.tier === 'S' && !isRolling && <div className="absolute inset-0 bg-yellow-400/10 blur-[60px] rounded-full -z-10 animate-pulse"></div>}
                            </div>
                        </div>
                    ) : (
                        !filterLeague && !searchTeam ? (
                            <div className="space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar p-1">
                                {(filterCategory === 'ALL' || filterCategory === 'CLUB') && (<div><p className="text-[10px] text-emerald-500 font-black italic mb-2 ml-1 border-l-4 border-emerald-500 pl-2 uppercase tracking-tighter">Club Leagues</p><div className="grid grid-cols-3 gap-3">{displaySortedLeagues.filter(l=>l.category==='CLUB').map(l => { const count = masterTeams.filter(t => t.region === l.name).length; return (<div key={l.id} onClick={() => setFilterLeague(l.name)} className="bg-slate-900 p-3 rounded-2xl border border-slate-800 cursor-pointer hover:border-emerald-500 flex flex-col items-center gap-2 group transition-all hover:bg-slate-800 shadow-xl"><div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-2 shadow-inner"><img src={l.logo} className="w-full h-full object-contain" alt="" /></div><div className="text-center w-full"><p className="text-[10px] text-white font-black italic group-hover:text-emerald-400 truncate w-full tracking-tighter uppercase">{l.name}</p><p className="text-[9px] text-slate-500 font-bold">{count} Teams</p></div></div>); })}</div></div>)}
                                {(filterCategory === 'ALL' || filterCategory === 'NATIONAL') && (<div><p className="text-[10px] text-blue-500 font-black italic mb-2 ml-1 border-l-4 border-blue-500 pl-2 uppercase tracking-tighter">National Teams</p><div className="grid grid-cols-3 gap-3">{displaySortedLeagues.filter(l=>l.category==='NATIONAL').map(l => { const count = masterTeams.filter(t => t.region === l.name).length; return (<div key={l.id} onClick={() => setFilterLeague(l.name)} className="bg-slate-900 p-3 rounded-2xl border border-slate-800 cursor-pointer hover:border-blue-500 flex flex-col items-center gap-2 group transition-all hover:bg-slate-800 shadow-xl"><div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-2 shadow-inner"><img src={l.logo} className="w-full h-full object-contain" alt="" /></div><div className="text-center w-full"><p className="text-[10px] text-white font-black italic group-hover:text-blue-400 truncate w-full tracking-tighter uppercase">{l.name}</p><p className="text-[9px] text-slate-500 font-bold">{count} Teams</p></div></div>); })}</div></div>)}
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar p-1">{availableTeams.map(t => { const isSelected = selectedMasterTeamDocId === (t.docId || String(t.id)); return (<div id={`team-card-${t.id}`} key={t.id} onClick={() => setSelectedMasterTeamDocId(t.docId || String(t.id))} className={`relative bg-slate-900 p-3 rounded-2xl border flex flex-col items-center cursor-pointer group transition-all ${isSelected ? 'border-emerald-500 ring-2 ring-emerald-500 bg-emerald-900/10' : 'border-slate-800 hover:border-slate-600'}`}><div className="w-14 h-14 bg-white rounded-full flex items-center justify-center overflow-hidden shadow-2xl p-2 mb-2"><img src={t.logo} className="w-full h-full object-contain" alt="" onError={(e: any) => e.target.src = FALLBACK_IMG} /></div><span className="text-[10px] text-center text-slate-300 w-full truncate font-black italic tracking-tighter group-hover:text-white uppercase">{t.name}</span><span className={`text-[9px] px-2 py-0.5 rounded-full mt-1 font-black italic ${getTierBadgeColor(t.tier)}`}>{t.tier}</span></div>); })}</div>
                        )
                    )}
                </div>

                <button onClick={handleAddTeam} disabled={isRolling || hasSchedule} className={`w-full py-4 font-black italic tracking-tighter rounded-2xl shadow-2xl text-sm transition-all ${isRolling || hasSchedule ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white uppercase active:scale-95'}`}>{hasSchedule ? '🔒 SCHEDULE GENERATED (LOCKED)' : (isRolling ? 'PACK OPENING...' : '✅ SIGN THIS TEAM TO SEASON')}</button>
            </div>

            {/* ==========================================
                STEP 2. 시즌 멤버 및 정규 스케줄 생성
            ========================================== */}
            <div className="bg-black p-5 rounded-[2rem] border border-slate-800">
                <div className="flex flex-col md:flex-row md:justify-between items-center gap-4 mb-6 border-b border-slate-800 pb-4">
                    <h3 className="text-white font-black italic tracking-tighter uppercase w-full md:w-auto">Step 2. Season Members ({targetSeason.teams?.length || 0})</h3>
                    <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                        {hasSchedule ? (
                            <>
                                {targetSeason.type === 'LEAGUE_PLAYOFF' && !isPoLocked && (
                                    <button onClick={handleLoadPlayoffTeams} className="bg-emerald-600 px-3 py-2 rounded-lg text-[10px] font-black italic tracking-tighter uppercase hover:bg-emerald-500 shadow-lg shadow-emerald-900/50 animate-pulse">🌟 PO 진출팀 대기실로 이동</button>
                                )}
                                <button onClick={() => handleGenerateSchedule(true)} className="bg-blue-700 px-3 py-2 rounded-lg text-[10px] font-black italic tracking-tighter uppercase hover:bg-blue-600">Re-Gen</button>
                                <button onClick={() => onDeleteSchedule(targetSeason.id)} className="bg-red-900 px-3 py-2 rounded-lg text-[10px] font-black italic tracking-tighter uppercase hover:bg-red-700">Clear</button>
                            </>
                        ) : (<button onClick={() => handleGenerateSchedule(false)} className="bg-purple-700 px-4 py-2 rounded-lg text-xs font-black italic tracking-tighter uppercase hover:bg-purple-600 shadow-xl shadow-purple-900/50 animate-pulse">Generate Schedule</button>)}
                    </div>
                </div>
                
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {targetSeason.teams?.map(t => {
                        const master = masterTeams.find(m => m.name === t.name);
                        const displayTeam = { ...t, logo: master ? master.logo : t.logo, tier: master ? master.tier : t.tier, region: master ? master.region : t.region };
                        return (
                            <div key={t.id} className="relative group"><TeamCard team={displayTeam} /><button onClick={(e) => { e.stopPropagation(); handleRemoveTeam(t.id, t.name); }} className={`absolute top-2 right-2 z-20 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 hover:bg-red-600 text-white transition-colors ${hasSchedule ? 'cursor-not-allowed opacity-50' : ''}`}><span className="text-[10px] font-bold">{hasSchedule ? '🔒' : '✕'}</span></button></div>
                        );
                    })}
                </div>
            </div>

            <QuickDraftModal isOpen={isDraftOpen} onClose={() => setIsDraftOpen(false)} owners={owners} masterTeams={masterTeams} onConfirm={handleDraftApply} />

            {/* ==============================================================================
                STEP 3. 플레이오프 3단계 대진표 인라인 에디터 (수직 피라미드 구조 완벽 복구)
            ============================================================================== */}
            {hasSchedule && targetSeason.type === 'LEAGUE_PLAYOFF' && (
                <div id="po-setup-section" className={`bg-[#0b0e14] p-4 md:p-6 rounded-[2.5rem] border relative transition-all duration-300 overflow-hidden ${isPoLocked ? 'border-slate-800 bg-[#05070a]' : 'border-slate-800'}`}>
                    
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-slate-800 pb-4 gap-4">
                        <div className="flex items-center gap-3">
                            <h3 className="text-white font-black italic uppercase tracking-tighter text-xl">Step 3. Playoff Bracket Setup</h3>
                            {isPoLocked && (
                                <div className="flex items-center gap-1 bg-red-900/30 border border-red-500/30 px-3 py-1 rounded-full">
                                    <span className="text-sm">🔒</span><span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">LOCKED</span>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {isPoLocked ? (
                                <button onClick={handleUnlockPoBracket} className="px-4 py-2 rounded-xl font-black italic text-xs shadow-lg transition-all bg-red-900/80 text-red-400 hover:bg-red-800 hover:text-white border border-red-800/50">
                                    🔄 UNLOCK & RESET
                                </button>
                            ) : (
                                <>
                                    <button onClick={handleAutoFillPoBracket} className="px-4 py-2 rounded-xl font-black italic text-xs shadow-lg transition-all bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95">
                                        ⚡ AUTO (순위 기반)
                                    </button>
                                    <button onClick={handleResetPoBracket} className="px-4 py-2 rounded-xl font-black italic text-xs shadow-lg transition-all bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700">
                                        🔄 대기실로 빼기
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Waiting Pool */}
                    <div className={`mb-8 p-4 rounded-2xl border transition-all duration-300 ${isPoLocked ? 'bg-black/40 border-slate-800/50 opacity-40 grayscale pointer-events-none' : 'bg-slate-900/50 border-slate-700/50'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Qualified Teams Inventory ({poWaitingPool.length})</span>
                            {!isPoLocked && <span className="text-[10px] text-slate-500 italic hidden sm:block">Drag team to bracket slot</span>}
                        </div>
                        
                        {poWaitingPool.length === 0 ? (
                            <div className="text-center py-6 text-slate-600 text-xs italic font-bold">진출팀이 대기실에 없습니다. (정규리그 마감 후 버튼을 누르세요)</div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 max-h-[350px] overflow-y-auto custom-scrollbar p-1">
                                {poWaitingPool.map(t => (
                                    <div key={t.id} draggable={!isPoLocked} onDragStart={(e) => !isPoLocked && handleDragStart(e, 'pool', null, t)} className="relative cursor-grab active:cursor-grabbing hover:-translate-y-1 transition-transform">
                                        <span className="absolute -top-2.5 -right-1 bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-lg z-10 border border-emerald-400">{t._realRank}위</span>
                                        <TeamCard team={t} size="small" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 🔥 3단계 수직 피라미드 대진표 */}
                    <div className="space-y-6 relative pb-8 max-w-4xl mx-auto flex flex-col items-center">
                        
                        {/* 1층: 최종 결승전 (1위 vs PO 결승 승자) */}
                        <div className={`relative flex flex-col p-5 sm:p-6 rounded-3xl border transition-all shadow-xl w-full max-w-2xl ${isPoLocked ? 'bg-black/20 border-slate-800/30' : 'bg-slate-900/20 border-yellow-500/30'}`}>
                            <div className="text-center mb-5 border-b border-slate-800/50 pb-2 relative">
                                <span className="absolute -top-10 left-1/2 -translate-x-1/2 text-3xl animate-bounce drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">👑</span>
                                <span className="text-[12px] text-yellow-500 font-black italic tracking-widest uppercase">챔피언 결정전 (Grand Final)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 relative items-center">
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                                    <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-slate-700 text-[10px] font-black text-slate-500 italic shadow-lg">VS</div>
                                </div>
                                
                                {/* Slot 0: 리그 1위 자리 (드래그 가능) */}
                                <div 
                                    onDragOver={isPoLocked ? undefined : handleDragOver} onDrop={(e) => !isPoLocked && handleDrop(e, 0)} onClick={() => !isPoLocked && handleSlotClick(0)}
                                    className={`relative min-h-[110px] rounded-xl border-2 flex flex-col items-center justify-center transition-all group overflow-hidden ${
                                        isPoLocked ? 'border-slate-800/50 bg-black/20 cursor-default' : 
                                        poBracket[0] ? 'border-yellow-500 bg-yellow-900/20 hover:border-red-500/50 hover:bg-red-900/10 cursor-pointer border-solid' : 'border-yellow-700/50 bg-slate-900/30 hover:border-yellow-500 border-dashed cursor-pointer'
                                    }`}
                                >
                                    <span className="absolute -top-0 w-full bg-yellow-600 text-black text-[8px] font-black py-0.5 text-center tracking-widest uppercase z-10">리그 1위 직행</span>
                                    {poBracket[0] ? (
                                        <div className="w-full h-full pt-4 relative" draggable={!isPoLocked} onDragStart={(e) => !isPoLocked && handleDragStart(e, 'bracket', 0, poBracket[0])}>
                                            <TeamCard team={poBracket[0]} size="small" className={`w-full h-full border-none shadow-none bg-transparent ${isPoLocked ? 'grayscale opacity-80' : ''}`} />
                                            {!isPoLocked && <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] z-30"><span className="text-red-400 font-black text-[10px] uppercase">REMOVE ✕</span></div>}
                                        </div>
                                    ) : <div className="flex flex-col items-center text-slate-600 group-hover:text-yellow-500 pt-3"><span className="text-xl font-black">+</span><span className="text-[9px] font-bold">ADD TEAM</span></div>}
                                </div>

                                {/* Slot X: PO 결승 승리팀 대기 자리 (고정 슬롯, 드래그 불가) */}
                                <div className="relative min-h-[110px] rounded-xl border-2 border-slate-800 bg-slate-900/30 flex flex-col items-center justify-center opacity-60 cursor-not-allowed select-none">
                                    <span className="absolute -top-0 w-full bg-slate-800 text-slate-400 text-[8px] font-black py-0.5 text-center tracking-widest uppercase z-10">최종 도전자</span>
                                    <span className="text-3xl mb-1 mt-3">⚔️</span>
                                    <span className="text-[9px] font-bold text-slate-500 tracking-widest mt-1">PO 결승 승자</span>
                                </div>
                            </div>
                        </div>

                        {/* 수직 연결선 1 */}
                        <div className="w-px h-8 bg-slate-700"></div>

                        {/* 2층: PO 결승전 (중간 단계 가시화 블록) */}
                        <div className={`relative flex flex-col p-4 sm:p-5 rounded-3xl border bg-slate-900/40 border-slate-800/50 shadow-xl w-full max-w-[400px] opacity-80 pointer-events-none`}>
                            <div className="text-center mb-4 border-b border-slate-800/50 pb-2">
                                <span className="text-[10px] text-slate-400 font-black italic tracking-widest uppercase">플레이오프 결승 (PO Final)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 relative items-center">
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                                    <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-slate-700 text-[9px] font-black text-slate-500 italic shadow-lg">VS</div>
                                </div>
                                <div className="h-[90px] rounded-xl border border-slate-800 bg-slate-900/80 flex flex-col items-center justify-center">
                                    <span className="text-2xl text-slate-600 mb-1">🛡️</span>
                                    <span className="text-[9px] font-bold text-slate-500 tracking-widest text-center leading-tight">4강 1경기 승자</span>
                                </div>
                                <div className="h-[90px] rounded-xl border border-slate-800 bg-slate-900/80 flex flex-col items-center justify-center">
                                    <span className="text-2xl text-slate-600 mb-1">🛡️</span>
                                    <span className="text-[9px] font-bold text-slate-500 tracking-widest text-center leading-tight">4강 2경기 승자</span>
                                </div>
                            </div>
                        </div>

                        {/* 수직 연결선 2 */}
                        <div className="w-full flex justify-center relative h-10">
                            <div className="w-px h-full bg-slate-700"></div>
                            {/* 가로 분기선 */}
                            <div className="absolute top-1/2 left-[25%] right-[25%] h-px bg-slate-700"></div>
                            <div className="absolute top-1/2 left-[25%] bottom-0 w-px bg-slate-700"></div>
                            <div className="absolute top-1/2 right-[25%] bottom-0 w-px bg-slate-700"></div>
                        </div>

                        {/* 3층: PO 4강전 (하단 2개 매치업) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 relative w-full">
                            
                            {/* Semi 1: 2nd vs 5th */}
                            <div className={`relative flex flex-col p-5 sm:p-6 rounded-3xl border transition-all ${isPoLocked ? 'bg-black/20 border-slate-800/30' : 'bg-slate-900/20 border-slate-800/50 shadow-xl'}`}>
                                <div className="text-center mb-5 border-b border-slate-800/50 pb-2">
                                    <span className="text-[10px] text-emerald-500 font-black italic tracking-widest uppercase">PO 4강 1경기</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 relative items-center">
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                                        <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-slate-700 text-[10px] font-black text-slate-500 italic shadow-lg">VS</div>
                                    </div>
                                    {[1, 2].map((slotIdx) => (
                                        <div key={slotIdx} onDragOver={isPoLocked ? undefined : handleDragOver} onDrop={(e) => !isPoLocked && handleDrop(e, slotIdx)} onClick={() => !isPoLocked && handleSlotClick(slotIdx)}
                                            className={`relative min-h-[110px] rounded-xl border-2 flex flex-col items-center justify-center transition-all group overflow-hidden ${
                                                isPoLocked ? 'border-slate-800/50 bg-black/20 cursor-default' : 
                                                poBracket[slotIdx] ? 'border-emerald-500/30 bg-emerald-900/10 hover:border-red-500/50 hover:bg-red-900/10 cursor-pointer border-solid' : 'border-slate-700 bg-slate-900/30 hover:border-emerald-500/50 hover:bg-slate-800 border-dashed cursor-pointer'
                                            }`}
                                        >
                                            <span className="absolute -top-0 w-full bg-slate-800 text-slate-400 text-[8px] font-black py-0.5 text-center tracking-widest uppercase z-10">{slotIdx === 1 ? '2위 자리' : '5위 자리'}</span>
                                            {poBracket[slotIdx] ? (
                                                <div className="w-full h-full pt-4 relative" draggable={!isPoLocked} onDragStart={(e) => !isPoLocked && handleDragStart(e, 'bracket', slotIdx, poBracket[slotIdx])}>
                                                    <TeamCard team={poBracket[slotIdx]} size="small" className={`w-full h-full border-none shadow-none bg-transparent ${isPoLocked ? 'grayscale opacity-80' : ''}`} />
                                                    {!isPoLocked && <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] z-30"><span className="text-red-400 font-black text-[10px] uppercase">REMOVE ✕</span></div>}
                                                </div>
                                            ) : <div className="flex flex-col items-center text-slate-600 pt-3 group-hover:text-emerald-500"><span className="text-xl font-black">+</span><span className="text-[9px] font-bold">ADD TEAM</span></div>}
                                        </div>
                                    ))}
                                </div>
                                {!isPoLocked && poBracket[1] && poBracket[2] && poBracket[1].ownerUid === poBracket[2].ownerUid && (
                                    <div className="mt-4 bg-red-950/80 border border-red-500 text-red-400 text-[11px] font-bold py-2 rounded-lg text-center animate-pulse shadow-lg shadow-red-900/20">🚨 동일 오너(내전) 매치업 발생!</div>
                                )}
                            </div>

                            {/* Semi 2: 3rd vs 4th */}
                            <div className={`relative flex flex-col p-5 sm:p-6 rounded-3xl border transition-all ${isPoLocked ? 'bg-black/20 border-slate-800/30' : 'bg-slate-900/20 border-slate-800/50 shadow-xl'}`}>
                                <div className="text-center mb-5 border-b border-slate-800/50 pb-2">
                                    <span className="text-[10px] text-emerald-500 font-black italic tracking-widest uppercase">PO 4강 2경기</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 relative items-center">
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                                        <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-slate-700 text-[10px] font-black text-slate-500 italic shadow-lg">VS</div>
                                    </div>
                                    {[3, 4].map((slotIdx) => (
                                        <div key={slotIdx} onDragOver={isPoLocked ? undefined : handleDragOver} onDrop={(e) => !isPoLocked && handleDrop(e, slotIdx)} onClick={() => !isPoLocked && handleSlotClick(slotIdx)}
                                            className={`relative min-h-[110px] rounded-xl border-2 flex flex-col items-center justify-center transition-all group overflow-hidden ${
                                                isPoLocked ? 'border-slate-800/50 bg-black/20 cursor-default' : 
                                                poBracket[slotIdx] ? 'border-emerald-500/30 bg-emerald-900/10 hover:border-red-500/50 hover:bg-red-900/10 cursor-pointer border-solid' : 'border-slate-700 bg-slate-900/30 hover:border-emerald-500/50 hover:bg-slate-800 border-dashed cursor-pointer'
                                            }`}
                                        >
                                            <span className="absolute -top-0 w-full bg-slate-800 text-slate-400 text-[8px] font-black py-0.5 text-center tracking-widest uppercase z-10">{slotIdx === 3 ? '3위 자리' : '4위 자리'}</span>
                                            {poBracket[slotIdx] ? (
                                                <div className="w-full h-full pt-4 relative" draggable={!isPoLocked} onDragStart={(e) => !isPoLocked && handleDragStart(e, 'bracket', slotIdx, poBracket[slotIdx])}>
                                                    <TeamCard team={poBracket[slotIdx]} size="small" className={`w-full h-full border-none shadow-none bg-transparent ${isPoLocked ? 'grayscale opacity-80' : ''}`} />
                                                    {!isPoLocked && <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] z-30"><span className="text-red-400 font-black text-[10px] uppercase">REMOVE ✕</span></div>}
                                                </div>
                                            ) : <div className="flex flex-col items-center text-slate-600 pt-3 group-hover:text-emerald-500"><span className="text-xl font-black">+</span><span className="text-[9px] font-bold">ADD TEAM</span></div>}
                                        </div>
                                    ))}
                                </div>
                                {!isPoLocked && poBracket[3] && poBracket[4] && poBracket[3].ownerUid === poBracket[4].ownerUid && (
                                    <div className="mt-4 bg-red-950/80 border border-red-500 text-red-400 text-[11px] font-bold py-2 rounded-lg text-center animate-pulse shadow-lg shadow-red-900/20">🚨 동일 오너(내전) 매치업 발생!</div>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="mt-2 pt-6 border-t border-slate-800 flex justify-center">
                        {isPoLocked ? (
                            <div className="px-10 py-5 bg-slate-900 text-slate-500 font-black italic rounded-2xl border border-slate-800 flex items-center gap-3 cursor-not-allowed select-none shadow-inner">
                                <span>🔒</span> PLAYOFF BRACKET IS LOCKED
                            </div>
                        ) : (
                            <button onClick={handleConfirmPlayoffBracket} className="px-10 py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black italic rounded-2xl shadow-2xl shadow-emerald-900/50 text-lg transition-transform active:scale-95 flex items-center gap-3">
                                <span>🚀</span> CONFIRM & GENERATE PLAYOFF
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};