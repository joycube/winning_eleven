"use client";

import React, { useState } from 'react';
import { db } from '../firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { Season, MasterTeam, Owner } from '../types';
import { TeamCard } from './TeamCard';
import { AdminLiveBracket_LeaguePO } from './AdminLiveBracket_LeaguePO';

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

    const [isLoaded, setIsLoaded] = useState(false);

    // =======================================================
    // 💡 PLAYOFF 세팅 로직
    // =======================================================
    const extractTop5FromLeague = () => {
        if (isPoLocked) return alert("이미 확정되었습니다. 해제 후 이용하세요.");

        const stats: Record<string, any> = {};
        const leagueRounds = targetSeason.rounds?.filter(r => !['ROUND_OF_4', 'PO_FINAL', 'SEMI_FINAL', 'FINAL'].includes(r.name)) || [];

        leagueRounds.forEach(round => {
            round.matches.forEach(m => {
                if (m.status !== 'COMPLETED' || m.home === 'BYE' || m.away === 'BYE') return;

                const hs = Number(m.homeScore || 0);
                const as = Number(m.awayScore || 0);

                if (!stats[m.home]) stats[m.home] = { id: m.home, name: m.home, pts: 0, gd: 0, gf: 0, logo: m.homeLogo, ownerUid: m.homeOwnerUid, ownerName: m.homeOwner };
                if (!stats[m.away]) stats[m.away] = { id: m.away, name: m.away, pts: 0, gd: 0, gf: 0, logo: m.awayLogo, ownerUid: m.awayOwnerUid, ownerName: m.awayOwner };

                stats[m.home].gf += hs;
                stats[m.home].gd += (hs - as);
                stats[m.away].gf += as;
                stats[m.away].gd += (as - hs);

                if (hs > as) stats[m.home].pts += 3;
                else if (as > hs) stats[m.away].pts += 3;
                else { stats[m.home].pts += 1; stats[m.away].pts += 1; }
            });
        });

        const sortedTeams = Object.values(stats).sort((a: any, b: any) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.gf - a.gf;
        });

        const top5 = sortedTeams.slice(0, 5).map((t: any, idx) => ({
            ...t,
            _realRank: idx + 1
        }));

        if (top5.length === 0) {
            return alert("정규리그 경기 결과가 없습니다. 스케줄에 점수를 먼저 입력해주세요.");
        }

        setPoWaitingPool(top5);
        setIsLoaded(true);
    };

    const handleAutoFillPoBracket = () => {
        if (isPoLocked) return;
        if (poWaitingPool.length === 0 && poBracket.every((t:any) => t === null)) {
            return alert("먼저 '정규리그 1~5위 자동 추출'을 진행해주세요.");
        }

        const allTeams = [...poWaitingPool, ...poBracket.filter((t: any) => Boolean(t))];
        const newBracket = Array(5).fill(null);
        allTeams.forEach((t: any) => {
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
        if (isPoLocked) return;
        const allTeams = [...poWaitingPool, ...poBracket.filter((t: any) => Boolean(t))].sort((a: any, b: any) => a._realRank - b._realRank);
        setPoWaitingPool(allTeams);
        setPoBracket(Array(5).fill(null));
    };

    const handleUnlockPoBracket = async () => {
        if (!confirm("확정된 대진을 해제하고 초기화하시겠습니까?")) return;
        const filteredRounds = targetSeason.rounds?.filter(r => !['ROUND_OF_4', 'PO_FINAL', 'SEMI_FINAL', 'FINAL'].includes(r.name)) || [];
        await updateDoc(doc(db, "seasons", String(targetSeason.id)), { rounds: filteredRounds });
        
        setIsLoaded(true); 
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
        const newPool = [...poWaitingPool, team].sort((a: any, b: any) => a._realRank - b._realRank);
        
        setPoBracket(newBracket);
        setPoWaitingPool(newPool);
    };

    const handleConfirmPlayoffBracket = async () => {
        if (isPoLocked) return;
        if (poBracket.includes(null)) return alert("🚨 5개의 모든 대진 슬롯에 팀을 배치해주세요.");

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
            alert(`🎉 플레이오프 대진표 확정 완료!`);
            
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
                            {!isLoaded && poWaitingPool.length === 0 && poBracket.every((t:any) => t === null) ? (
                                <button onClick={extractTop5FromLeague} className="px-4 py-2 rounded-xl font-black italic text-xs shadow-lg transition-all bg-blue-600 text-white hover:bg-blue-500 active:scale-95 animate-pulse">
                                    📥 정규리그 1~5위 자동 추출
                                </button>
                            ) : (
                                <>
                                    <button onClick={handleAutoFillPoBracket} className="px-4 py-2 rounded-xl font-black italic text-xs shadow-lg transition-all bg-yellow-600 text-black hover:bg-yellow-500 active:scale-95">
                                        ⚡ AUTO (순위 자동 배정)
                                    </button>
                                    <button onClick={handleResetPoBracket} className="px-4 py-2 rounded-xl font-black italic text-xs shadow-lg transition-all bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700">
                                        🔄 대기실로 빼기
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* 🔥 [디벨롭 핵심] 대기실(Inventory)은 isPoLocked 조건 밖으로 꺼내어 항상 노출합니다! */}
            <div className={`mb-8 p-4 rounded-2xl border transition-all duration-300 ${isPoLocked ? 'bg-black/40 border-slate-800/50 opacity-40 grayscale pointer-events-none' : 'bg-slate-900/50 border-slate-700/50'}`}>
                <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Qualified Teams Inventory ({poWaitingPool.length})</span>
                    {!isPoLocked && <span className="text-[10px] text-slate-500 italic hidden sm:block">Drag team to bracket slot</span>}
                </div>
                
                {poWaitingPool.length === 0 ? (
                    <div className="text-center py-6 text-slate-600 text-xs italic font-bold">
                        {isPoLocked 
                            ? "모든 팀이 대진표에 배치되었습니다."
                            : (!isLoaded && poBracket.every((t:any) => t === null) 
                                ? "상단의 '정규리그 1~5위 자동 추출' 버튼을 눌러 진출팀을 셋업하세요." 
                                : "모든 팀이 대진표에 배치되었습니다.")}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 max-h-[350px] overflow-y-auto custom-scrollbar p-1">
                        {poWaitingPool.map((t: any) => (
                            <div key={t.id} draggable onDragStart={(e: React.DragEvent) => handleDragStart(e, 'pool', null, t)} className="relative cursor-grab active:cursor-grabbing hover:-translate-y-1 transition-transform">
                                <span className="absolute -top-2.5 -right-1 bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-lg z-10 border border-emerald-400">{t._realRank}위</span>
                                <TeamCard team={t} size="small" />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Locked 상태면 실시간 뷰어 호출, 아니면 세팅 화면 노출 */}
            {isPoLocked ? (
                <div className="mt-8 relative">
                    <AdminLiveBracket_LeaguePO 
                        targetSeason={targetSeason} 
                        masterTeams={masterTeams} 
                        owners={owners} 
                    />
                </div>
            ) : (
                <>
                    {/* 세팅용 1라운드(4강) 및 1위 직행 슬롯 그리드 */}
                    <div className="w-full flex flex-col items-center gap-10 md:gap-16 mt-8 relative">
                        {/* 1위 직행 슬롯 */}
                        <div className="flex flex-col items-center w-full relative">
                            <div className="text-center mb-3">
                                <span className="text-[16px] font-black italic tracking-widest text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)] uppercase">👑 챔피언 결정전 선착</span>
                            </div>
                            <div className="relative flex flex-col p-4 sm:p-5 rounded-3xl border transition-all w-full max-w-[340px] bg-slate-900/40 border-yellow-500/50 shadow-xl shadow-yellow-900/20">
                                <div 
                                    onDragOver={handleDragOver} 
                                    onDrop={(e: React.DragEvent) => handleDrop(e, 0)} 
                                    onClick={() => handleSlotClick(0)} 
                                    className={`relative min-h-[96px] sm:min-h-[110px] rounded-xl border-2 flex flex-col items-center justify-center transition-all group overflow-hidden ${
                                        poBracket[0] 
                                            ? 'border-yellow-500/30 bg-yellow-900/10 hover:border-red-500/50 hover:bg-red-900/10 cursor-pointer border-dashed' 
                                            : 'border-slate-700 bg-slate-900/30 hover:border-yellow-500/50 hover:bg-slate-800 border-dashed cursor-pointer'
                                    }`}
                                >
                                    <span className="absolute -top-0 w-full bg-slate-800 text-slate-400 text-[8px] font-black py-0.5 text-center tracking-widest uppercase z-10">정규리그 1위 직행</span>
                                    {poBracket[0] ? (
                                        <div className="w-full h-full pt-4 relative">
                                            <div className="w-full h-full" draggable onDragStart={(e: React.DragEvent) => handleDragStart(e, 'bracket', 0, poBracket[0])}>
                                                <TeamCard team={poBracket[0]} size="small" className="w-full h-full border-none shadow-none bg-transparent flex items-center justify-center" />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] z-30">
                                                    <span className="text-red-400 font-black text-xs uppercase">REMOVE ✕</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center transition-colors text-slate-600 group-hover:text-yellow-500">
                                            <span className="text-xl font-black">+</span>
                                            <span className="text-[9px] font-bold">ADD TEAM</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* PO 4강 (2위~5위 매칭) 슬롯 */}
                        <div className="w-full flex flex-col items-center relative">
                            <div className="text-center mb-6">
                                <span className="text-[14px] font-black italic tracking-widest text-emerald-500 uppercase">⚔️ 플레이오프 4강 (세팅)</span>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 relative w-full max-w-7xl mx-auto justify-items-center">
                                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-800 hidden lg:block opacity-20"></div>
                                
                                {[
                                    { title: 'PO 4강 1경기', slot1: 1, slot1Title: '정규리그 2위', slot2: 2, slot2Title: '정규리그 5위' },
                                    { title: 'PO 4강 2경기', slot1: 3, slot1Title: '정규리그 3위', slot2: 4, slot2Title: '정규리그 4위' }
                                ].map((matchData, mIdx) => {
                                    const team1 = poBracket[matchData.slot1];
                                    const team2 = poBracket[matchData.slot2];
                                    const isInnerCivilWar = team1 && team2 && (team1.ownerUid === team2.ownerUid || team1.ownerName === team2.ownerName);

                                    return (
                                        <div key={mIdx} className="relative flex flex-col p-4 sm:p-5 rounded-3xl border transition-all w-full max-w-[340px] bg-slate-900/20 border-slate-800/50">
                                            <div className="text-center mb-4 border-b border-slate-800/50 pb-2">
                                                <span className="text-[10px] text-emerald-500 font-black italic tracking-widest uppercase">{matchData.title}</span>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-3 sm:gap-4 relative items-center">
                                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                                                    <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-slate-700 text-[9px] font-black text-slate-500 italic shadow-lg">VS</div>
                                                </div>

                                                {[
                                                    { idx: matchData.slot1, title: matchData.slot1Title, team: team1 },
                                                    { idx: matchData.slot2, title: matchData.slot2Title, team: team2 }
                                                ].map(({ idx, title, team }) => (
                                                    <div 
                                                        key={idx}
                                                        onDragOver={handleDragOver} 
                                                        onDrop={(e: React.DragEvent) => handleDrop(e, idx)} 
                                                        onClick={() => handleSlotClick(idx)} 
                                                        className={`relative min-h-[96px] sm:min-h-[110px] rounded-xl border-2 flex flex-col items-center justify-center transition-all group overflow-hidden ${
                                                            team 
                                                                ? 'border-emerald-500/30 bg-emerald-900/10 hover:border-red-500/50 hover:bg-red-900/10 cursor-pointer border-dashed' 
                                                                : 'border-slate-700 bg-slate-900/30 hover:border-emerald-500/50 hover:bg-slate-800 border-dashed cursor-pointer'
                                                        }`}
                                                    >
                                                        <span className="absolute -top-0 w-full bg-slate-800 text-slate-400 text-[8px] font-black py-0.5 text-center tracking-widest uppercase z-10">{title}</span>
                                                        {team ? (
                                                            <div className="w-full h-full pt-4 relative">
                                                                <div className="w-full h-full" draggable onDragStart={(e: React.DragEvent) => handleDragStart(e, 'bracket', idx, team)}>
                                                                    <TeamCard team={team} size="small" className="w-full h-full border-none shadow-none bg-transparent flex items-center justify-center" />
                                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] z-30">
                                                                        <span className="text-red-400 font-black text-xs uppercase">REMOVE ✕</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center pt-3 transition-colors text-slate-600 group-hover:text-emerald-500">
                                                                <span className="text-xl font-black">+</span>
                                                                <span className="text-[9px] font-bold">ADD TEAM</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            {isInnerCivilWar && (
                                                <div className="mt-3 bg-red-950/80 border border-red-500 text-red-400 text-[10px] font-bold py-1.5 rounded-lg text-center animate-pulse shadow-lg shadow-red-900/20">🚨 동일 오너(내전) 매치업 발생!</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="mt-2 pt-6 border-t border-slate-800 flex justify-center">
                        <button onClick={handleConfirmPlayoffBracket} className="px-10 py-5 bg-yellow-600 hover:bg-yellow-500 text-black font-black italic rounded-2xl shadow-2xl shadow-yellow-900/50 text-lg transition-transform active:scale-95 flex items-center gap-3">
                            <span>🚀</span> CONFIRM & GENERATE PLAYOFF
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};