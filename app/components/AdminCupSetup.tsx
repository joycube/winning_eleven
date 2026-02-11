/* eslint-disable @next/next/no-img-element */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { Season, MasterTeam, Owner, Team, League, FALLBACK_IMG } from '../types';
import { getSortedLeagues, getSortedTeamsLogic, getTierBadgeColor } from '../utils/helpers';
import { QuickDraftModal } from './QuickDraftModal';

// 🔥 리그 인지도 정렬 순서
const LEAGUE_RANKING: { [key: string]: number } = {
    "PREMIER LEAGUE": 1, "LA LIGA": 2, "BUNDESLIGA": 3, "SERIE A": 4, "LIGUE 1": 5,
    "CHAMPIONS LEAGUE": 6, "EUROPA LEAGUE": 7, "EREDIVISIE": 8, "LIGA PORTUGAL": 9,
    "BRASILEIRAO": 10, "ARGENTINE LPF": 11, "MLS": 12, "SAUDI PRO LEAGUE": 13, 
    "SUPER LIG": 14, "SCOTTISH PREMIERSHIP": 15, "K LEAGUE": 16, "J LEAGUE": 17,
    "EUROPE": 1, "SOUTH AMERICA": 2, "NORTH AMERICA": 3, "AFRICA": 4, "ASIA-OCEANIA": 5
};

interface AdminCupSetupProps {
    targetSeason: Season;
    owners: Owner[];
    leagues: League[];
    masterTeams: MasterTeam[];
    onNavigateToSchedule: (seasonId: number) => void;
}

interface CupEntry {
    id: string;
    masterId: number;
    name: string;
    logo: string;
    ownerName: string;
    region: string;
    tier: string;
    realRankScore?: number;
    realFormScore?: number;
}

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
    const [groups, setGroups] = useState<{ [key: string]: (CupEntry | null)[] }>({
        "A": [null, null, null, null],
        "B": [null, null, null, null],
        "C": [null, null, null, null],
        "D": [null, null, null, null]
    });
    
    const [targetSlot, setTargetSlot] = useState<{ group: string, idx: number } | null>(null);
    
    // 🔥 [추가] 드래그 앤 드롭 상태 관리
    const [draggedEntry, setDraggedEntry] = useState<CupEntry | null>(null);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []);

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

    // ================= ACTIONS =================
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

        const owner = owners.find(o => String(o.id) === selectedOwnerId);
        
        const newEntry: CupEntry = {
            id: `entry_${Date.now()}`,
            masterId: target.id,
            name: target.name,
            logo: target.logo,
            ownerName: owner ? owner.nickname : 'CPU',
            region: target.region,
            tier: target.tier,
            realRankScore: target.realRankScore,
            realFormScore: target.realFormScore
        };

        setUnassignedPool(prev => [...prev, newEntry]);
        setRandomResult(null);
        setIsFlipping(false);
    };

    const handleDraftApply = async (newTeams: Team[]) => {
        const newEntries: CupEntry[] = newTeams.map((t, idx) => ({
            id: `draft_${Date.now()}_${idx}`,
            masterId: t.id,
            name: t.name,
            logo: t.logo,
            ownerName: t.ownerName,
            region: t.region,
            tier: t.tier,
            realRankScore: t.realRankScore,
            realFormScore: t.realFormScore
        }));

        const assignedNames = new Set<string>();
        unassignedPool.forEach(t => assignedNames.add(t.name));
        Object.values(groups).flat().forEach(t => { if(t) assignedNames.add(t.name); });

        const filtered = newEntries.filter(e => !assignedNames.has(e.name));
        if (filtered.length < newEntries.length) alert(`중복된 ${newEntries.length - filtered.length}개 팀은 제외되었습니다.`);
        setUnassignedPool(prev => [...prev, ...filtered]);
    };

    // 공통 배정 로직 (클릭 & 드래그)
    const assignTeamToGroup = (entry: CupEntry, gName: string, idx: number) => {
        setGroups(prev => ({
            ...prev,
            [gName]: prev[gName].map((slot, i) => i === idx ? entry : slot)
        }));
        setUnassignedPool(prev => prev.filter(p => p.id !== entry.id));
    };

    // Slot Click (기존 모달 방식)
    const handleSlotClick = (gName: string, idx: number) => {
        const currentEntry = groups[gName][idx];
        if (currentEntry) {
            setUnassignedPool(prev => [...prev, currentEntry]);
            setGroups(prev => ({ ...prev, [gName]: prev[gName].map((slot, i) => i === idx ? null : slot) }));
        } else {
            if (unassignedPool.length === 0) return alert("대기실(Waiting Pool)에 팀이 없습니다. Step 1에서 팀을 뽑아주세요.");
            setTargetSlot({ group: gName, idx });
        }
    };

    const confirmSlotSelection = (entry: CupEntry) => {
        if (!targetSlot) return;
        assignTeamToGroup(entry, targetSlot.group, targetSlot.idx);
        setTargetSlot(null);
    };

    // 🔥 [추가] Drag & Drop Handlers
    const handleDragStart = (e: React.DragEvent, entry: CupEntry) => {
        setDraggedEntry(entry);
        // 드래그 시 반투명 효과용
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", entry.id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Drop 허용
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, gName: string, idx: number) => {
        e.preventDefault();
        const currentEntry = groups[gName][idx];
        
        if (currentEntry) {
            // 이미 팀이 있는 경우 교체는 복잡하므로 일단 막거나, 
            // alert("빈 슬롯에만 넣을 수 있습니다."); 
            return; 
        }

        if (draggedEntry) {
            assignTeamToGroup(draggedEntry, gName, idx);
            setDraggedEntry(null);
        }
    };

    const handleAutoDraw = () => {
        if (unassignedPool.length === 0) return alert("대기실에 팀이 없습니다.");
        const shuffled = [...unassignedPool].sort(() => 0.5 - Math.random());
        const newGroups = { ...groups };
        let poolIdx = 0;
        Object.keys(newGroups).forEach(gName => {
            newGroups[gName] = newGroups[gName].map(slot => {
                if (slot === null && poolIdx < shuffled.length) return shuffled[poolIdx++];
                return slot;
            });
        });
        setGroups(newGroups);
        setUnassignedPool(shuffled.slice(poolIdx));
    };

    const handleResetDraw = () => {
        if (!confirm("모든 조 편성을 초기화하고 대기실로 되돌리겠습니까?")) return;
        const allAssigned = Object.values(groups).flat().filter(Boolean) as CupEntry[];
        setUnassignedPool(prev => [...prev, ...allAssigned]);
        setGroups({ "A": [null, null, null, null], "B": [null, null, null, null], "C": [null, null, null, null], "D": [null, null, null, null] });
    };

    const handleCreateSchedule = async () => {
        const filledSlots = Object.values(groups).flat().filter(Boolean).length;
        if (filledSlots < 4) return alert("최소 4개 이상의 팀이 편성되어야 합니다.");
        if (!confirm("현재 조 편성으로 컵 대회를 시작하시겠습니까?\n스케줄이 생성됩니다.")) return;

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

        const roundsData = [{ round: 1, name: "Group Stage", matches: groupMatches.sort(() => 0.5 - Math.random()) }];

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
                
                /* 🔥 드래그 중인 아이템 스타일 */
                .is-dragging { opacity: 0.5; transform: scale(0.9); }
            `}</style>

            {(isRolling || isFlipping) && <div className="stage-overlay" />}
            {isFlipping && <div className="reveal-flash" />}

            {/* ================= STEP 1: TEAM SELECTION ================= */}
            <div className={`bg-slate-900 p-5 rounded-3xl border border-slate-800 relative ${isRolling ? 'z-[55]' : ''}`}>
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
                            {/* 1. Club Leagues */}
                            {(filterCategory === 'ALL' || filterCategory === 'CLUB') && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3"><div className="w-1 h-4 bg-emerald-500 rounded-full"></div><h4 className="text-emerald-500 font-black italic text-xs uppercase tracking-widest">Club Leagues</h4></div>
                                    <div className="grid grid-cols-3 gap-3">
                                        {clubLeagues.map(l => {
                                            const count = masterTeams.filter(t => t.region === l.name).length;
                                            return (
                                                <div key={l.id} onClick={() => setFilterLeague(l.name)} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 cursor-pointer hover:border-emerald-500 flex flex-col items-center gap-3 group transition-all hover:bg-slate-900 shadow-lg aspect-[4/5] justify-center relative overflow-hidden">
                                                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center p-2.5 shadow-inner shrink-0 z-10"><img src={l.logo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /></div>
                                                    <div className="text-center w-full z-10"><p className="text-[10px] text-white font-black italic group-hover:text-emerald-400 truncate w-full tracking-tighter uppercase">{l.name}</p><p className="text-[9px] text-slate-500 font-bold">{count} Teams</p></div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {/* 2. National Teams */}
                            {(filterCategory === 'ALL' || filterCategory === 'NATIONAL') && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3"><div className="w-1 h-4 bg-blue-500 rounded-full"></div><h4 className="text-blue-500 font-black italic text-xs uppercase tracking-widest">National Teams</h4></div>
                                    <div className="grid grid-cols-3 gap-3">
                                        {nationalLeagues.map(l => {
                                            const count = masterTeams.filter(t => t.region === l.name).length;
                                            return (
                                                <div key={l.id} onClick={() => setFilterLeague(l.name)} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 cursor-pointer hover:border-blue-500 flex flex-col items-center gap-3 group transition-all hover:bg-slate-900 shadow-lg aspect-[4/5] justify-center relative overflow-hidden">
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
                        <div className="grid grid-cols-3 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                            {availableTeams.length > 0 ? availableTeams.slice(0, 30).map(t => (
                                <div key={t.id} onClick={() => handleSignTeam(t)} className="bg-slate-900 p-2 rounded-xl border border-slate-800 cursor-pointer hover:border-emerald-500 hover:bg-slate-800 transition-all flex flex-col items-center gap-1 group">
                                    <div className="w-10 h-10 bg-white rounded-full p-1.5 shadow-md"><img src={t.logo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /></div>
                                    <span className="text-[9px] text-slate-300 font-bold truncate w-full text-center group-hover:text-white">{t.name}</span>
                                </div>
                            )) : <div className="col-span-3 text-center py-10 text-slate-500">No teams found.</div>}
                        </div>
                    )
                )}
            </div>

            {/* ================= STEP 2: GROUP DRAW BOARD ================= */}
            <div className="bg-black p-6 rounded-[2.5rem] border border-slate-800 relative">
                <div className="flex flex-col gap-4 mb-6 border-b border-slate-800 pb-4">
                    <h3 className="text-white font-black italic uppercase tracking-tighter text-xl">Step 2. Group Draw Board</h3>
                    <div className="flex gap-2 justify-end">
                        <button onClick={handleResetDraw} className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl font-bold text-xs hover:bg-red-900 hover:text-white transition-colors">🔄 Reset</button>
                        <button onClick={handleAutoDraw} className="px-6 py-2 bg-yellow-600 text-black rounded-xl font-black italic text-xs shadow-lg shadow-yellow-900/40 hover:bg-yellow-500 active:scale-95 transition-all">⚡ AUTO FILL</button>
                    </div>
                </div>

                {/* 🔥 [수정] 대기실: 가로 스크롤 -> 그리드 (줄바꿈 지원) & 드래그 가능 */}
                <div className="mb-6 bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold text-slate-400">WAITING POOL ({unassignedPool.length})</span>
                        <span className="text-[10px] text-slate-600">Drag team to group slot or Click</span>
                    </div>
                    {unassignedPool.length === 0 ? (
                        <div className="text-center py-4 text-slate-600 text-xs italic">Step 1에서 팀을 선발해주세요.</div>
                    ) : (
                        // 🔥 가로 스크롤(overflow-x) 제거하고 Grid로 변경
                        <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2 max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                            {unassignedPool.map(t => (
                                <div 
                                    key={t.id} 
                                    // 🔥 드래그 이벤트 연결
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, t)}
                                    className={`
                                        flex flex-col items-center gap-1 group cursor-grab active:cursor-grabbing hover:scale-105 transition-transform
                                        ${draggedEntry?.id === t.id ? 'is-dragging' : ''}
                                    `}
                                >
                                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1.5 shadow-md border border-slate-700 group-hover:border-yellow-500 transition-colors relative">
                                        <img src={t.logo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-slate-950 rounded-full flex items-center justify-center text-[8px] border border-slate-700 text-white font-bold">{t.tier}</div>
                                    </div>
                                    <span className="text-[8px] text-slate-400 truncate w-full text-center group-hover:text-white font-bold">{t.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 그룹 보드 (드롭존) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.keys(groups).sort().map(gName => (
                        <div key={gName} className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
                            <div className="bg-slate-800/80 px-4 py-3 flex justify-between items-center border-b border-slate-700">
                                <span className="text-sm font-black italic text-emerald-400">GROUP {gName}</span>
                                <span className="text-[10px] text-slate-500 font-bold">{groups[gName].filter(Boolean).length}/4</span>
                            </div>
                            <div className="p-3 grid grid-cols-2 gap-2">
                                {groups[gName].map((slot, idx) => (
                                    <div 
                                        key={idx} 
                                        // 🔥 드롭 이벤트 연결
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, gName, idx)}
                                        onClick={() => handleSlotClick(gName, idx)} 
                                        className={`
                                            relative aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all group 
                                            ${slot 
                                                ? 'border-emerald-500/30 bg-emerald-900/10 hover:border-red-500/50 hover:bg-red-900/10' 
                                                : 'border-slate-700 bg-slate-900/30 hover:border-yellow-500/50 hover:bg-slate-800'
                                            }
                                        `}
                                    >
                                        {slot ? (
                                            <>
                                                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center p-1 shadow-md mb-1"><img src={slot.logo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /></div>
                                                <span className="text-[10px] font-bold text-white truncate w-full text-center px-1">{slot.name}</span>
                                                <span className="text-[8px] text-emerald-400 font-bold">{slot.ownerName}</span>
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl backdrop-blur-sm"><span className="text-red-400 font-black text-xs">REMOVE ✕</span></div>
                                            </>
                                        ) : (
                                            <div className="text-slate-600 group-hover:text-yellow-500 transition-colors flex flex-col items-center"><span className="text-xl font-black">+</span><span className="text-[9px] font-bold">ADD TEAM</span></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-800 flex justify-end">
                    <button onClick={handleCreateSchedule} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black italic rounded-2xl shadow-2xl text-lg transition-transform active:scale-95 flex items-center gap-3"><span>💾</span> CREATE SCHEDULE</button>
                </div>
            </div>

            {/* Modal */}
            {targetSlot && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setTargetSlot(null)} />
                    <div className="bg-slate-900 w-full max-w-md rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-5 border-b border-slate-800 bg-slate-950"><h3 className="text-white font-black italic text-lg">Select Team for {targetSlot.group}-{targetSlot.idx + 1}</h3><p className="text-xs text-slate-400">Choose from Waiting Pool ({unassignedPool.length})</p></div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {unassignedPool.length === 0 ? <div className="text-center py-10 text-slate-500 font-bold">No teams available.<br/>Go to Step 1 to sign teams!</div> : unassignedPool.map(entry => (
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

            {/* Quick Draft Modal */}
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