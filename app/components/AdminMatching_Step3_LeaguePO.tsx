"use client";

import React from 'react';
import { db } from '../firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { Season, MasterTeam, Owner } from '../types';
import { TeamCard } from './TeamCard';
import { AdminMatching_LeaguePOBracketView } from './AdminMatching_LeaguePOBracketView';

interface Props {
    state: any;
    targetSeason: Season;
    masterTeams: MasterTeam[];
    owners: Owner[];
}

export const AdminMatching_Step3_LeaguePO = ({ state, targetSeason, masterTeams, owners }: Props) => {
    const {
        poWaitingPool, setPoWaitingPool,
        poBracket, setPoBracket,
        isPoLocked, handleLoadPlayoffTeams
    } = state;

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
        const filteredRounds = targetSeason.rounds?.filter(r => !['ROUND_OF_4', 'PO_FINAL', 'SEMI_FINAL', 'FINAL'].includes(r.name)) || [];
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { rounds: filteredRounds });
        if(handleLoadPlayoffTeams) handleLoadPlayoffTeams();
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

        let team = source === 'pool' ? poWaitingPool.find((t: any) => t.id === teamId) : poBracket[index!];
        if (!team) return;

        const newBracket = [...poBracket];
        const newPool = [...poWaitingPool];
        const existingTeam = newBracket[targetIndex];

        newBracket[targetIndex] = team;

        if (source === 'pool') {
            newPool.splice(newPool.findIndex((t: any) => t.id === teamId), 1);
        } else if (source === 'bracket') {
            newBracket[index!] = existingTeam; 
        }

        if (source === 'pool' && existingTeam) {
            newPool.push(existingTeam); 
            newPool.sort((a: any, b: any) => a._realRank - b._realRank);
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

    const handleConfirmPlayoffBracket = async () => {
        if (isPoLocked) return;
        if (poBracket.includes(null)) return alert("🚨 5개의 모든 대진 슬롯에 팀을 배치해주세요.\n(대진표 가장 위의 '리그 1위 직행' 슬롯도 채워야 합니다.)");

        const [t1, t2, t5, t3, t4] = poBracket; 
        const isCivilWar = (t2.ownerUid && t5.ownerUid && t2.ownerUid === t5.ownerUid) || (t3.ownerUid && t4.ownerUid && t3.ownerUid === t4.ownerUid) || (t2.ownerName === t5.ownerName) || (t3.ownerName === t4.ownerName);

        if (isCivilWar) {
            const forceGenerate = confirm("🚨 [경고] 4강 대진에 동일 오너(내전) 매치업이 포함되어 있습니다!\n무시하고 플레이오프 스케줄을 강제로 발행하시겠습니까?");
            if (!forceGenerate) return;
        } else {
            if (!confirm("현재 설정된 대진표로 플레이오프 스케줄을 공식 발행하시겠습니까?")) return;
        }

        try {
            const filteredRounds = targetSeason.rounds?.filter(r => !['ROUND_OF_4', 'PO_FINAL', 'SEMI_FINAL', 'FINAL'].includes(r.name)) || [];
            const s = (val: any) => val === undefined ? '' : val;
            const matchStatus: "UPCOMING" | "BYE" | "COMPLETED" = "UPCOMING";

            const roundOf4 = {
                name: 'ROUND_OF_4',
                matches: [
                    { id: `po_4_1_1`, home: s(t5.name), away: s(t2.name), homeScore: '', awayScore: '', status: matchStatus, homeLogo: s(t5.logo), awayLogo: s(t2.logo), homeOwner: s(t5.ownerName), awayOwner: s(t2.ownerName), matchLabel: 'PO 4강 1경기 (1차전: 5위 홈 vs 2위)', stage: 'ROUND_OF_4', seasonId: targetSeason.id, homeOwnerUid: s(t5.ownerUid), awayOwnerUid: s(t2.ownerUid), youtubeUrl: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [] },
                    { id: `po_4_1_2`, home: s(t2.name), away: s(t5.name), homeScore: '', awayScore: '', status: matchStatus, homeLogo: s(t2.logo), awayLogo: s(t5.logo), homeOwner: s(t2.ownerName), awayOwner: s(t5.ownerName), matchLabel: 'PO 4강 1경기 (2차전: 2위 홈 vs 5위)', stage: 'ROUND_OF_4', seasonId: targetSeason.id, homeOwnerUid: s(t2.ownerUid), awayOwnerUid: s(t5.ownerUid), youtubeUrl: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [] },
                    { id: `po_4_2_1`, home: s(t4.name), away: s(t3.name), homeScore: '', awayScore: '', status: matchStatus, homeLogo: s(t4.logo), awayLogo: s(t3.logo), homeOwner: s(t4.ownerName), awayOwner: s(t3.ownerName), matchLabel: 'PO 4강 2경기 (1차전: 4위 홈 vs 3위)', stage: 'ROUND_OF_4', seasonId: targetSeason.id, homeOwnerUid: s(t4.ownerUid), awayOwnerUid: s(t3.ownerUid), youtubeUrl: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [] },
                    { id: `po_4_2_2`, home: s(t3.name), away: s(t4.name), homeScore: '', awayScore: '', status: matchStatus, homeLogo: s(t3.logo), awayLogo: s(t4.logo), homeOwner: s(t3.ownerName), awayOwner: s(t4.ownerName), matchLabel: 'PO 4강 2경기 (2차전: 3위 홈 vs 4위)', stage: 'ROUND_OF_4', seasonId: targetSeason.id, homeOwnerUid: s(t3.ownerUid), awayOwnerUid: s(t4.ownerUid), youtubeUrl: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [] },
                ]
            };

            const poFinal = {
                name: 'SEMI_FINAL', 
                matches: [
                    { id: `po_fin_1`, home: 'TBD', away: 'TBD', homeScore: '', awayScore: '', status: matchStatus, homeLogo: '', awayLogo: '', homeOwner: '-', awayOwner: '-', matchLabel: 'PO 결승 (1차전)', stage: 'SEMI_FINAL', seasonId: targetSeason.id, youtubeUrl: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [] },
                    { id: `po_fin_2`, home: 'TBD', away: 'TBD', homeScore: '', awayScore: '', status: matchStatus, homeLogo: '', awayLogo: '', homeOwner: '-', awayOwner: '-', matchLabel: 'PO 결승 (2차전)', stage: 'SEMI_FINAL', seasonId: targetSeason.id, youtubeUrl: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [] },
                ]
            };

            const grandFinal = {
                name: 'FINAL',
                matches: [
                    { id: `grand_fin_1`, home: s(t1.name), away: 'TBD', homeScore: '', awayScore: '', status: matchStatus, homeLogo: s(t1.logo), awayLogo: '', homeOwner: s(t1.ownerName), awayOwner: '-', matchLabel: '🏆 최종 챔피언 결정전 (단판)', stage: 'FINAL', seasonId: targetSeason.id, homeOwnerUid: s(t1.ownerUid), youtubeUrl: '', homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [] },
                ]
            };

            const updatedRounds = [...filteredRounds, roundOf4, poFinal, grandFinal];
            await updateDoc(doc(db, "seasons", String(targetSeason.id)), { rounds: updatedRounds });
            alert(`🎉 플레이오프 대진표 확정 완료!\n1위 ${t1.name}가 최종 결승전에 선착했습니다.`);
            
        } catch (error) { console.error("Firebase Update Error: ", error); alert("🚨 저장 에러 발생."); }
    };

    return (
        <div id="po-setup-section" className={`bg-[#0b0e14] p-4 md:p-6 rounded-[2.5rem] border relative transition-all duration-300 overflow-hidden ${isPoLocked ? 'border-slate-800 bg-[#05070a]' : 'border-slate-800'}`}>
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
                            <button onClick={handleAutoFillPoBracket} className="px-4 py-2 rounded-xl font-black italic text-xs shadow-lg transition-all bg-indigo-600 text-white hover:bg-indigo-50 active:scale-95">
                                ⚡ AUTO (순위 기반)
                            </button>
                            <button onClick={handleResetPoBracket} className="px-4 py-2 rounded-xl font-black italic text-xs shadow-lg transition-all bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700">
                                🔄 대기실로 빼기
                            </button>
                        </>
                    )}
                </div>
            </div>

            {isPoLocked ? (
                <div className="mt-6 flex justify-center w-full overflow-x-auto custom-scrollbar pb-6 bg-slate-900/30 rounded-3xl border border-slate-800/50">
                    <AdminMatching_LeaguePOBracketView 
                        currentSeason={targetSeason} 
                        owners={owners} 
                        masterTeams={masterTeams} 
                    />
                </div>
            ) : (
                <>
                    <div className={`mb-8 p-4 rounded-2xl border transition-all duration-300 bg-slate-900/50 border-slate-700/50`}>
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Qualified Teams Inventory ({poWaitingPool.length})</span>
                            <span className="text-[10px] text-slate-500 italic hidden sm:block">Drag team to bracket slot</span>
                        </div>
                        
                        {poWaitingPool.length === 0 ? (
                            <div className="text-center py-6 text-slate-600 text-xs italic font-bold">진출팀이 대기실에 없습니다. (정규리그 마감 후 버튼을 누르세요)</div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 max-h-[350px] overflow-y-auto custom-scrollbar p-1">
                                {poWaitingPool.map((t: any) => (
                                    <div key={t.id} draggable onDragStart={(e) => handleDragStart(e, 'pool', null, t)} className="relative cursor-grab active:cursor-grabbing hover:-translate-y-1 transition-transform">
                                        <span className="absolute -top-2.5 -right-1 bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-lg z-10 border border-emerald-400">{t._realRank}위</span>
                                        <TeamCard team={t} size="small" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-6 relative pb-8 max-w-4xl mx-auto flex flex-col items-center">
                        <div className={`relative flex flex-col p-5 sm:p-6 rounded-3xl border transition-all shadow-xl w-full max-w-2xl bg-slate-900/20 border-yellow-500/30`}>
                            <div className="text-center mb-5 border-b border-slate-800/50 pb-2 relative">
                                <span className="absolute -top-10 left-1/2 -translate-x-1/2 text-3xl animate-bounce drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">👑</span>
                                <span className="text-[12px] text-yellow-500 font-black italic tracking-widest uppercase">챔피언 결정전 (Grand Final)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 relative items-center">
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                                    <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-slate-700 text-[10px] font-black text-slate-500 italic shadow-lg">VS</div>
                                </div>
                                <div onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 0)} onClick={() => handleSlotClick(0)} className={`relative min-h-[110px] rounded-xl border-2 flex flex-col items-center justify-center transition-all group overflow-hidden ${poBracket[0] ? 'border-yellow-500 bg-yellow-900/20 hover:border-red-500/50 hover:bg-red-900/10 cursor-pointer border-solid' : 'border-yellow-700/50 bg-slate-900/30 hover:border-yellow-500 border-dashed cursor-pointer'}`}>
                                    <span className="absolute -top-0 w-full bg-yellow-600 text-black text-[8px] font-black py-0.5 text-center tracking-widest uppercase z-10">리그 1위 직행</span>
                                    {poBracket[0] ? (
                                        <div className="w-full h-full pt-4 relative" draggable onDragStart={(e) => handleDragStart(e, 'bracket', 0, poBracket[0])}>
                                            <TeamCard team={poBracket[0]} size="small" className={`w-full h-full border-none shadow-none bg-transparent`} />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] z-30">
                                                <span className="text-red-400 font-black text-[10px] uppercase">REMOVE ✕</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center text-slate-600 group-hover:text-yellow-500 pt-3">
                                            <span className="text-xl font-black">+</span>
                                            <span className="text-[9px] font-bold">ADD TEAM</span>
                                        </div>
                                    )}
                                </div>
                                <div className="relative min-h-[110px] rounded-xl border-2 border-slate-800 bg-slate-900/30 flex flex-col items-center justify-center opacity-60 cursor-not-allowed select-none">
                                    <span className="absolute -top-0 w-full bg-slate-800 text-slate-400 text-[8px] font-black py-0.5 text-center tracking-widest uppercase z-10">최종 도전자</span>
                                    <span className="text-3xl mb-1 mt-3">⚔️</span>
                                    <span className="text-[9px] font-bold text-slate-500 tracking-widest mt-1">PO 결승 승자</span>
                                </div>
                            </div>
                        </div>

                        <div className="w-px h-8 bg-slate-700"></div>

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

                        <div className="w-full flex justify-center relative h-10">
                            <div className="w-px h-full bg-slate-700"></div>
                            <div className="absolute top-1/2 left-[25%] right-[25%] h-px bg-slate-700"></div>
                            <div className="absolute top-1/2 left-[25%] bottom-0 w-px bg-slate-700"></div>
                            <div className="absolute top-1/2 right-[25%] bottom-0 w-px bg-slate-700"></div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 relative w-full">
                            <div className={`relative flex flex-col p-5 sm:p-6 rounded-3xl border transition-all bg-slate-900/20 border-slate-800/50 shadow-xl`}>
                                <div className="text-center mb-5 border-b border-slate-800/50 pb-2">
                                    <span className="text-[10px] text-emerald-500 font-black italic tracking-widest uppercase">PO 4강 1경기</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 relative items-center">
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                                        <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-slate-700 text-[10px] font-black text-slate-500 italic shadow-lg">VS</div>
                                    </div>
                                    {[1, 2].map((slotIdx) => (
                                        <div key={slotIdx} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, slotIdx)} onClick={() => handleSlotClick(slotIdx)} className={`relative min-h-[110px] rounded-xl border-2 flex flex-col items-center justify-center transition-all group overflow-hidden ${poBracket[slotIdx] ? 'border-emerald-500/30 bg-emerald-900/10 hover:border-red-500/50 hover:bg-red-900/10 cursor-pointer border-solid' : 'border-slate-700 bg-slate-900/30 hover:border-emerald-500/50 hover:bg-slate-800 border-dashed cursor-pointer'}`}>
                                            <span className="absolute -top-0 w-full bg-slate-800 text-slate-400 text-[8px] font-black py-0.5 text-center tracking-widest uppercase z-10">
                                                {slotIdx === 1 ? '2위 자리' : '5위 자리'}
                                            </span>
                                            {poBracket[slotIdx] ? (
                                                <div className="w-full h-full pt-4 relative" draggable onDragStart={(e) => handleDragStart(e, 'bracket', slotIdx, poBracket[slotIdx])}>
                                                    <TeamCard team={poBracket[slotIdx]} size="small" className={`w-full h-full border-none shadow-none bg-transparent`} />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] z-30">
                                                        <span className="text-red-400 font-black text-[10px] uppercase">REMOVE ✕</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center text-slate-600 pt-3 group-hover:text-emerald-500">
                                                    <span className="text-xl font-black">+</span>
                                                    <span className="text-[9px] font-bold">ADD TEAM</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {poBracket[1] && poBracket[2] && poBracket[1].ownerUid === poBracket[2].ownerUid && (
                                    <div className="mt-4 bg-red-950/80 border border-red-500 text-red-400 text-[11px] font-bold py-2 rounded-lg text-center animate-pulse shadow-lg shadow-red-900/20">
                                        🚨 동일 오너(내전) 매치업 발생!
                                    </div>
                                )}
                            </div>

                            <div className={`relative flex flex-col p-5 sm:p-6 rounded-3xl border transition-all bg-slate-900/20 border-slate-800/50 shadow-xl`}>
                                <div className="text-center mb-5 border-b border-slate-800/50 pb-2">
                                    <span className="text-[10px] text-emerald-500 font-black italic tracking-widest uppercase">PO 4강 2경기</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 relative items-center">
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                                        <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-slate-700 text-[10px] font-black text-slate-500 italic shadow-lg">VS</div>
                                    </div>
                                    {[3, 4].map((slotIdx) => (
                                        <div key={slotIdx} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, slotIdx)} onClick={() => handleSlotClick(slotIdx)} className={`relative min-h-[110px] rounded-xl border-2 flex flex-col items-center justify-center transition-all group overflow-hidden ${poBracket[slotIdx] ? 'border-emerald-500/30 bg-emerald-900/10 hover:border-red-500/50 hover:bg-red-900/10 cursor-pointer border-solid' : 'border-slate-700 bg-slate-900/30 hover:border-emerald-500/50 hover:bg-slate-800 border-dashed cursor-pointer'}`}>
                                            <span className="absolute -top-0 w-full bg-slate-800 text-slate-400 text-[8px] font-black py-0.5 text-center tracking-widest uppercase z-10">
                                                {slotIdx === 3 ? '3위 자리' : '4위 자리'}
                                            </span>
                                            {poBracket[slotIdx] ? (
                                                <div className="w-full h-full pt-4 relative" draggable onDragStart={(e) => handleDragStart(e, 'bracket', slotIdx, poBracket[slotIdx])}>
                                                    <TeamCard team={poBracket[slotIdx]} size="small" className={`w-full h-full border-none shadow-none bg-transparent`} />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] z-30">
                                                        <span className="text-red-400 font-black text-[10px] uppercase">REMOVE ✕</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center text-slate-600 pt-3 group-hover:text-emerald-500">
                                                    <span className="text-xl font-black">+</span>
                                                    <span className="text-[9px] font-bold">ADD TEAM</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {poBracket[3] && poBracket[4] && poBracket[3].ownerUid === poBracket[4].ownerUid && (
                                    <div className="mt-4 bg-red-950/80 border border-red-500 text-red-400 text-[11px] font-bold py-2 rounded-lg text-center animate-pulse shadow-lg shadow-red-900/20">
                                        🚨 동일 오너(내전) 매치업 발생!
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-2 pt-6 border-t border-slate-800 flex justify-center">
                        <button onClick={handleConfirmPlayoffBracket} className="px-10 py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black italic rounded-2xl shadow-2xl shadow-emerald-900/50 text-lg transition-transform active:scale-95 flex items-center gap-3">
                            <span>🚀</span> CONFIRM & GENERATE PLAYOFF
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};