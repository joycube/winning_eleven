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
        console.log(`✅ [Finance] ${ownerIds.length}명의 참가비(-${entryFee}원) 장부 기록 완료!`);
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

    const [filterCategory, setFilterCategory] = useState('ALL');
    const [filterLeague, setFilterLeague] = useState('');
    const [filterTier, setFilterTier] = useState('ALL');
    const [searchTeam, setSearchTeam] = useState('');

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const hasSchedule = targetSeason.rounds && targetSeason.rounds.length > 0;

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
        if (hasSchedule) return alert("🚫 스케줄이 이미 생성되어 팀을 추가할 수 없습니다.\n먼저 스케줄을 삭제해주세요.");
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
        if (hasSchedule) return alert("🚫 스케줄이 생성된 상태에서는 팀을 추가할 수 없습니다.\n[Step 2]에서 스케줄을 먼저 삭제(초기화)해주세요.");
        if (isRolling) return;
        if (!selectedOwnerId || !selectedMasterTeamDocId) return alert("오너와 팀을 선택하세요.");
        const owner = owners.find(o => String(o.id) === selectedOwnerId);
        const mTeam = masterTeams.find(t => (t.docId || String(t.id)) === selectedMasterTeamDocId);
        if (!owner || !mTeam) return;

        const isDuplicate = targetSeason.teams?.some(t => t.name === mTeam.name);
        if (isDuplicate) {
            return alert(`🚫 이미 등록된 팀입니다: ${mTeam.name}\n다른 팀을 선택해주세요.`);
        }

        const newTeam: Team = {
            id: Date.now(), seasonId: targetSeason.id, name: mTeam.name, logo: mTeam.logo, ownerName: owner.nickname,
            region: mTeam.region, tier: mTeam.tier, win: 0, draw: 0, loss: 0, points: 0, gf: 0, ga: 0, gd: 0
        };
        const updatedTeams = [...(targetSeason.teams || []), newTeam];
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { teams: updatedTeams });
        setSelectedMasterTeamDocId('');
        setRandomResult(null);
        setIsFlipping(false);
    };

    const handleRemoveTeam = async (teamId: number, teamName: string) => {
        if (hasSchedule) return alert("🚫 스케줄이 생성된 상태에서는 팀을 삭제할 수 없습니다.\n[Step 2]에서 스케줄을 먼저 삭제(초기화)해주세요.");
        if (!confirm("정말 삭제하시겠습니까?")) return;
        const updatedTeams = targetSeason.teams.filter(t => t.id !== teamId);
        let updatedRounds = targetSeason.rounds ? [...targetSeason.rounds] : [];
        if (updatedRounds.length > 0) {
            updatedRounds = updatedRounds.map(r => ({
                ...r, matches: r.matches.filter(m => m.home !== teamName && m.away !== teamName)
            })).filter(r => r.matches.length > 0);
        }
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { teams: updatedTeams, rounds: updatedRounds });
    };

    const handleGenerateSchedule = async (isRegen = false) => {
        if (targetSeason.teams.length < 2) return alert("최소 2팀 이상 필요.");
        
        const teamNames = targetSeason.teams.map(t => t.name);
        const uniqueNames = new Set(teamNames);
        if (teamNames.length !== uniqueNames.size) {
            return alert("🚫 중복된 팀이 등록되어 있습니다!\n[Step 2] 목록에서 중복된 팀을 삭제한 후 다시 시도해주세요.");
        }

        if (isRegen && !confirm("기존 스케줄을 덮어씌우시겠습니까?")) return;

        const refreshedTeams = targetSeason.teams.map(seasonTeam => {
            const master = masterTeams.find(m => m.name === seasonTeam.name);
            if (master) {
                return { ...seasonTeam, logo: master.logo, tier: master.tier, region: master.region };
            }
            return seasonTeam;
        });

        const shuffledTeams = [...refreshedTeams].sort(() => Math.random() - 0.5);
        
        const tempSeason = { ...targetSeason, teams: shuffledTeams, rounds: [] };

        const rounds = generateRoundsLogic(tempSeason);
        
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { teams: shuffledTeams, rounds });

        if (!isRegen && (targetSeason as any).totalPrize) {
            const uniqueOwnerNames = Array.from(new Set(shuffledTeams.map(t => t.ownerName)));
            const uniqueOwnerIds = uniqueOwnerNames.map(name => {
                const owner = owners.find(o => o.nickname === name);
                return owner ? String(owner.id) : '';
            }).filter(id => id !== '');

            recordEntryFees(
                targetSeason.id,
                targetSeason.name,
                (targetSeason as any).totalPrize,
                uniqueOwnerIds
            );
        }

        if (confirm("스케줄 생성 완료. 이동하시겠습니까?")) onNavigateToSchedule(targetSeason.id);
    };

    const handleDraftApply = async (newTeams: Team[]) => {
        const existingNames = new Set(targetSeason.teams?.map(t => t.name) || []);
        const filteredNewTeams = newTeams.filter(t => !existingNames.has(t.name));

        if (filteredNewTeams.length < newTeams.length) {
            alert(`⚠️ 중복된 ${newTeams.length - filteredNewTeams.length}개 팀은 제외하고 추가합니다.`);
        }

        if (filteredNewTeams.length === 0) return;

        const teamsWithSeason = filteredNewTeams.map(t => ({ ...t, seasonId: targetSeason.id }));
        const updatedTeams = [...(targetSeason.teams || []), ...teamsWithSeason];
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { teams: updatedTeams });
    };

    // 💣 [핵심 디벨롭] 하이브리드 모드 TBD 자리에 1~5위 자동 매핑!
    const handleConfirmPlayoffBracket = async () => {
        if (!targetSeason.rounds) return;
        
        if (!confirm("현재 순위를 기반으로 플레이오프 대진표를 확정하시겠습니까?\n(정규 리그의 모든 경기가 종료되었는지 확인하세요!)")) return;

        // 1. 순위 계산 로직 (승점 -> 골득실 -> 다득점)
        const leagueMatches = targetSeason.rounds
            .filter(r => !['ROUND_OF_4', 'SEMI_FINAL', 'FINAL'].includes(r.name))
            .flatMap(r => r.matches)
            .filter(m => m.status === 'COMPLETED');

        const statsMap: Record<string, any> = {};
        targetSeason.teams.forEach(t => {
            statsMap[t.name] = { ...t, win: 0, draw: 0, loss: 0, points: 0, gd: 0, gf: 0 };
        });

        leagueMatches.forEach(m => {
            if (!statsMap[m.home] || !statsMap[m.away]) return;
            const hScore = Number(m.homeScore);
            const aScore = Number(m.awayScore);
            
            statsMap[m.home].gf += hScore; statsMap[m.away].gf += aScore;
            statsMap[m.home].gd += (hScore - aScore); statsMap[m.away].gd += (aScore - hScore);

            if (hScore > aScore) {
                statsMap[m.home].win += 1; statsMap[m.home].points += 3;
                statsMap[m.away].loss += 1;
            } else if (aScore > hScore) {
                statsMap[m.away].win += 1; statsMap[m.away].points += 3;
                statsMap[m.home].loss += 1;
            } else {
                statsMap[m.home].draw += 1; statsMap[m.home].points += 1;
                statsMap[m.away].draw += 1; statsMap[m.away].points += 1;
            }
        });

        const rankedTeams = Object.values(statsMap).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.gf - a.gf;
        });

        if (rankedTeams.length < 5) return alert("리그에 참가한 팀이 5팀 미만이라 PO를 구성할 수 없습니다.");

        const t1 = rankedTeams[0]; // 1위 (결승 직행)
        const t2 = rankedTeams[1]; // 2위
        const t3 = rankedTeams[2]; // 3위
        const t4 = rankedTeams[3]; // 4위
        const t5 = rankedTeams[4]; // 5위

        // 2. 새로운 라운드 배열 복사
        const updatedRounds = targetSeason.rounds.map(round => {
            if (!['ROUND_OF_4', 'FINAL'].includes(round.name)) return round;

            const newMatches = round.matches.map(m => {
                const newMatch = { ...m };
                
                // PO 4강 1차전 매핑 (5위 홈 vs 2위 / 4위 홈 vs 3위)
                if (round.name === 'ROUND_OF_4' && m.matchLabel.includes('1차전')) {
                    if (m.matchLabel.includes('5위')) {
                        newMatch.home = t5.name; newMatch.homeLogo = t5.logo; newMatch.homeOwner = t5.ownerName;
                        newMatch.away = t2.name; newMatch.awayLogo = t2.logo; newMatch.awayOwner = t2.ownerName;
                    } else if (m.matchLabel.includes('4위')) {
                        newMatch.home = t4.name; newMatch.homeLogo = t4.logo; newMatch.homeOwner = t4.ownerName;
                        newMatch.away = t3.name; newMatch.awayLogo = t3.logo; newMatch.awayOwner = t3.ownerName;
                    }
                }
                // PO 4강 2차전 매핑 (2위 홈 vs 5위 / 3위 홈 vs 4위)
                if (round.name === 'ROUND_OF_4' && m.matchLabel.includes('2차전')) {
                    if (m.matchLabel.includes('2위')) {
                        newMatch.home = t2.name; newMatch.homeLogo = t2.logo; newMatch.homeOwner = t2.ownerName;
                        newMatch.away = t5.name; newMatch.awayLogo = t5.logo; newMatch.awayOwner = t5.ownerName;
                    } else if (m.matchLabel.includes('3위')) {
                        newMatch.home = t3.name; newMatch.homeLogo = t3.logo; newMatch.homeOwner = t3.ownerName;
                        newMatch.away = t4.name; newMatch.awayLogo = t4.logo; newMatch.awayOwner = t4.ownerName;
                    }
                }
                // 최종 결승 (1위 직행)
                if (round.name === 'FINAL') {
                    newMatch.home = t1.name; newMatch.homeLogo = t1.logo; newMatch.homeOwner = t1.ownerName;
                }
                return newMatch;
            });
            return { ...round, matches: newMatches };
        });

        // 3. DB 업데이트
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { rounds: updatedRounds });
        alert(`🎉 플레이오프 대진표 확정 완료!\n1위 ${t1.name}가 결승전에 안착했습니다.`);
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
            `}</style>

            {(isRolling || isFlipping) && <div className="stage-overlay" />}
            {isFlipping && <div className="reveal-flash" />}

            {/* Step 1 */}
            <div className={`bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-4 relative ${isRolling || isFlipping ? 'z-[55]' : ''}`}>
                <h3 className="text-white font-bold text-sm border-b border-slate-800 pb-2">Step 1. 팀 & 오너 매칭</h3>

                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-3 rounded-xl border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-3 mb-2">
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <div className="text-white font-black italic flex items-center gap-2 text-sm">
                            <span className="text-yellow-400">⚡</span> 퀵 팀매칭 (Quick Match)
                            <span className="text-[9px] bg-yellow-500 text-black px-1.5 rounded font-black tracking-tighter">HOT</span>
                        </div>
                        <p className="text-sm text-white mt-1 font-bold">
                            ✨ 지금 자동으로 팀을 추천 받으세요 ✨
                        </p>
                    </div>
                    <button 
                        onClick={() => {
                            if (hasSchedule) return alert("🚫 스케줄이 생성된 상태에서는 실행할 수 없습니다.\n[Step 2]에서 스케줄을 먼저 삭제해주세요.");
                            setIsDraftOpen(true);
                        }}
                        disabled={hasSchedule}
                        className={`h-10 px-6 bg-indigo-600 text-white font-black italic rounded-lg shadow-lg text-xs tracking-tighter transition-all flex items-center justify-center gap-2 ${hasSchedule ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-500 hover:scale-105 active:scale-95'}`}
                    >
                        <span>⚡</span> 퀵 매칭 시작
                    </button>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-500 font-bold">1. Select Owner (Manual)</label>
                    <select value={selectedOwnerId} onChange={e => setSelectedOwnerId(e.target.value)} disabled={isRolling} className="bg-slate-950 p-3 rounded border border-slate-700 text-white w-full text-sm font-bold">
                        <option value="">👤 Select Owner</option>
                        {owners.map(o => <option key={o.id} value={o.id}>{o.nickname}</option>)}
                    </select>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-slate-500 font-bold">2. Search Options (Manual)</label>
                        <button 
                            onClick={handleRandom} 
                            disabled={isRolling || hasSchedule}
                            className={`h-10 px-6 rounded-lg text-xs font-black italic tracking-tighter text-white shadow-lg border border-purple-500 flex items-center justify-center gap-2 transition-all ${isRolling || hasSchedule ? 'bg-purple-900 cursor-not-allowed opacity-50' : 'bg-purple-700 hover:bg-purple-600 active:scale-95 hover:shadow-purple-500/50'}`}
                        >
                            {isRolling ? <span className="animate-spin text-lg">🎰</span> : <span className="text-lg">🎲</span>} 
                            {isRolling ? 'OPENING...' : '랜덤 매칭 시작'}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} disabled={isRolling} className="bg-black p-2 rounded border border-slate-700 text-slate-300 text-xs font-bold"><option value="ALL">All Categories</option><option value="CLUB">Club</option><option value="NATIONAL">National</option></select>
                        <select value={filterLeague} onChange={e => setFilterLeague(e.target.value)} disabled={isRolling} className="bg-black p-2 rounded border border-slate-700 text-slate-300 text-xs font-bold"><option value="">All Leagues</option>{getSortedLeagues(leagues.map(l => l.name)).map(l => <option key={l} value={l}>{l}</option>)}</select>
                        <select value={filterTier} onChange={e => setFilterTier(e.target.value)} disabled={isRolling} className="bg-black p-2 rounded border border-slate-700 text-slate-300 text-xs font-bold"><option value="ALL">All Tiers</option><option value="S">S Tier</option><option value="A">A Tier</option><option value="B">B Tier</option><option value="C">C Tier</option></select>
                        <input type="text" value={searchTeam} onChange={e => setSearchTeam(e.target.value)} disabled={isRolling} placeholder="🔍 Name..." className="bg-black p-2 rounded border border-slate-700 text-white text-xs font-bold" />
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-slate-500 font-bold">3. Pack Result</label>
                        {!isRolling && (filterLeague || randomResult) && <button onClick={() => { setFilterLeague(''); setRandomResult(null); setIsFlipping(false); }} className="text-[10px] text-slate-400 border border-slate-700 px-2 rounded hover:text-white font-bold">↩ Back to Leagues</button>}
                    </div>

                    {randomResult ? (
                        <div className="flex justify-center py-8 relative" style={{ perspective: '1000px' }}>
                            {isFlipping && <div className="blast-circle" />}
                            <div className={`relative p-6 rounded-[2rem] border-4 flex flex-col items-center gap-4 transition-all duration-500 min-w-[240px] 
                                ${isFlipping ? 'fc-card-reveal' : ''} 
                                ${randomResult.tier === 'S' ? 'bg-gradient-to-b from-yellow-600/30 to-slate-900 border-yellow-500 fc-gold-glow' : 'bg-slate-900 border-emerald-500'}
                                ${isRolling ? 'blur-md scale-90 grayscale opacity-60' : 'scale-100 opacity-100'}
                            `}>
                                <div className={`absolute -top-4 text-white text-xs font-black italic tracking-tighter px-4 py-1.5 rounded-full shadow-2xl transition-all ${isRolling ? 'bg-purple-600 animate-pulse' : 'bg-gradient-to-r from-emerald-600 to-teal-600'}`}>
                                    {isRolling ? '🎰 SHUFFLING PACK...' : '🏆 PACK OPENED!'}
                                </div>
                                <div className={`w-32 h-32 bg-white rounded-full flex items-center justify-center p-4 shadow-2xl relative z-10 ${randomResult.tier === 'S' ? 'ring-4 ring-yellow-400/50' : 'ring-4 ring-emerald-400/30'}`}>
                                    <img src={randomResult.logo} className={`w-full h-full object-contain ${isRolling ? 'animate-bounce' : ''}`} alt="" onError={(e: any) => e.target.src = FALLBACK_IMG} />
                                </div>
                                <div className="text-center relative z-10">
                                    <p className="text-2xl font-black italic tracking-tighter text-white uppercase leading-none">{randomResult.name}</p>
                                    <div className="flex items-center justify-center gap-2 mt-2">
                                        <span className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest">{randomResult.region}</span>
                                        <span className={`text-xs px-3 py-0.5 rounded-full font-black italic ${getTierBadgeColor(randomResult.tier)} shadow-lg`}>{randomResult.tier} TIER</span>
                                    </div>
                                </div>
                                {randomResult.tier === 'S' && !isRolling && (
                                    <div className="absolute inset-0 bg-yellow-400/10 blur-[60px] rounded-full -z-10 animate-pulse"></div>
                                )}
                            </div>
                        </div>
                    ) : (
                        !filterLeague && !searchTeam ? (
                            <div className="space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar p-1">
                                {(filterCategory === 'ALL' || filterCategory === 'CLUB') && (
                                    <div>
                                        <p className="text-[10px] text-emerald-500 font-black italic mb-2 ml-1 border-l-4 border-emerald-500 pl-2 uppercase tracking-tighter">Club Leagues</p>
                                        <div className="grid grid-cols-3 gap-3">{displaySortedLeagues.filter(l=>l.category==='CLUB').map(l => {
                                            const count = masterTeams.filter(t => t.region === l.name).length;
                                            return (<div key={l.id} onClick={() => setFilterLeague(l.name)} className="bg-slate-900 p-3 rounded-2xl border border-slate-800 cursor-pointer hover:border-emerald-500 flex flex-col items-center gap-2 group transition-all hover:bg-slate-800 shadow-xl"><div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-2 shadow-inner"><img src={l.logo} className="w-full h-full object-contain" alt="" /></div><div className="text-center w-full"><p className="text-[10px] text-white font-black italic group-hover:text-emerald-400 truncate w-full tracking-tighter uppercase">{l.name}</p><p className="text-[9px] text-slate-500 font-bold">{count} Teams</p></div></div>);
                                        })}</div>
                                    </div>
                                )}
                                {(filterCategory === 'ALL' || filterCategory === 'NATIONAL') && (
                                    <div>
                                        <p className="text-[10px] text-blue-500 font-black italic mb-2 ml-1 border-l-4 border-blue-500 pl-2 uppercase tracking-tighter">National Teams</p>
                                        <div className="grid grid-cols-3 gap-3">{displaySortedLeagues.filter(l=>l.category==='NATIONAL').map(l => {
                                            const count = masterTeams.filter(t => t.region === l.name).length;
                                            return (<div key={l.id} onClick={() => setFilterLeague(l.name)} className="bg-slate-900 p-3 rounded-2xl border border-slate-800 cursor-pointer hover:border-blue-500 flex flex-col items-center gap-2 group transition-all hover:bg-slate-800 shadow-xl"><div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-2 shadow-inner"><img src={l.logo} className="w-full h-full object-contain" alt="" /></div><div className="text-center w-full"><p className="text-[10px] text-white font-black italic group-hover:text-blue-400 truncate w-full tracking-tighter uppercase">{l.name}</p><p className="text-[9px] text-slate-500 font-bold">{count} Teams</p></div></div>);
                                        })}</div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar p-1">
                                {availableTeams.map(t => {
                                    const isSelected = selectedMasterTeamDocId === (t.docId || String(t.id));
                                    return (<div id={`team-card-${t.id}`} key={t.id} onClick={() => setSelectedMasterTeamDocId(t.docId || String(t.id))} className={`relative bg-slate-900 p-3 rounded-2xl border flex flex-col items-center cursor-pointer group transition-all ${isSelected ? 'border-emerald-500 ring-2 ring-emerald-500 bg-emerald-900/10' : 'border-slate-800 hover:border-slate-600'}`}><div className="w-14 h-14 bg-white rounded-full flex items-center justify-center overflow-hidden shadow-2xl p-2 mb-2"><img src={t.logo} className="w-full h-full object-contain" alt="" onError={(e: any) => e.target.src = FALLBACK_IMG} /></div><span className="text-[10px] text-center text-slate-300 w-full truncate font-black italic tracking-tighter group-hover:text-white uppercase">{t.name}</span><span className={`text-[9px] px-2 py-0.5 rounded-full mt-1 font-black italic ${getTierBadgeColor(t.tier)}`}>{t.tier}</span></div>);
                                })}
                            </div>
                        )
                    )}
                </div>

                <button 
                    onClick={handleAddTeam} 
                    disabled={isRolling || hasSchedule} 
                    className={`w-full py-4 font-black italic tracking-tighter rounded-2xl shadow-2xl text-sm transition-all ${isRolling || hasSchedule ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white uppercase active:scale-95'}`}
                >
                    {hasSchedule ? '🔒 SCHEDULE GENERATED (LOCKED)' : (isRolling ? 'PACK OPENING...' : '✅ SIGN THIS TEAM TO SEASON')}
                </button>
            </div>

            {/* Step 2 */}
            <div className="bg-black p-5 rounded-[2rem] border border-slate-800">
                <div className="flex flex-col md:flex-row md:justify-between items-center gap-4 mb-6 border-b border-slate-800 pb-4">
                    <h3 className="text-white font-black italic tracking-tighter uppercase w-full md:w-auto">Step 2. Season Members ({targetSeason.teams?.length || 0})</h3>
                    <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                        {hasSchedule ? (
                            <>
                                {/* 🔥 [핵심 디벨롭] 하이브리드 전용 플레이오프 확정 버튼 추가! */}
                                {targetSeason.type === 'LEAGUE_PLAYOFF' && (
                                    <button onClick={handleConfirmPlayoffBracket} className="bg-emerald-600 px-3 py-2 rounded-lg text-[10px] font-black italic tracking-tighter uppercase hover:bg-emerald-500 shadow-lg shadow-emerald-900/50 animate-bounce">
                                        🌟 PO 대진 확정 (순위 반영)
                                    </button>
                                )}
                                <button onClick={() => handleGenerateSchedule(true)} className="bg-blue-700 px-3 py-2 rounded-lg text-[10px] font-black italic tracking-tighter uppercase hover:bg-blue-600">Re-Gen</button>
                                <button onClick={() => onDeleteSchedule(targetSeason.id)} className="bg-red-900 px-3 py-2 rounded-lg text-[10px] font-black italic tracking-tighter uppercase hover:bg-red-700">Clear</button>
                            </>
                        ) : (
                            <button onClick={() => handleGenerateSchedule(false)} className="bg-purple-700 px-4 py-2 rounded-lg text-xs font-black italic tracking-tighter uppercase hover:bg-purple-600 shadow-xl shadow-purple-900/50 animate-pulse">Generate Schedule</button>
                        )}
                    </div>
                </div>
                
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {targetSeason.teams?.map(t => {
                        const master = masterTeams.find(m => m.name === t.name);
                        const displayTeam = {
                            ...t,
                            logo: master ? master.logo : t.logo,
                            tier: master ? master.tier : t.tier,
                            region: master ? master.region : t.region
                        };

                        return (
                            <div key={t.id} className="relative group">
                                <TeamCard team={displayTeam} />
                                
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleRemoveTeam(t.id, t.name); }} 
                                    className={`absolute top-2 right-2 z-20 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 hover:bg-red-600 text-white transition-colors ${hasSchedule ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                    <span className="text-[10px] font-bold">{hasSchedule ? '🔒' : '✕'}</span>
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

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