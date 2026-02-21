import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
// 🔥 [Finance] 마이그레이션을 위한 파이어베이스 함수 추가
import { deleteDoc, doc, updateDoc, collection, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { Season, Owner, League, MasterTeam, Banner } from '../types';
import { AdminLeagueManager, AdminTeamManager } from './AdminTeamManagement';
import { AdminBannerManager } from './AdminBannerManager';
import { AdminSeasonCreate } from './AdminSeasonCreate';
import { AdminOwnerManager } from './AdminOwnerManager';
import { AdminTeamMatching } from './AdminTeamMatching';
import { AdminCupSetup } from './AdminCupSetup';
import { AdminRealWorldManager } from './AdminRealWorldManager';

interface AdminViewProps {
    adminTab: number | 'NEW' | 'OWNER' | 'BANNER' | 'LEAGUES' | 'TEAMS' | 'REAL';
    setAdminTab: (tab: any) => void;
    seasons: Season[];
    owners: Owner[];
    leagues: League[];
    masterTeams: MasterTeam[];
    banners: Banner[];
    onAdminLogin: (pw: string) => Promise<boolean> | boolean;
    onCreateSeason: (name: string, type: string, mode: string, prize: number, prizesObj: any) => void; 
    onSaveOwner: (name: string, photo: string, editId: string | null) => void; 
    onNavigateToSchedule: (seasonId: number) => void;
}

export const AdminView = ({
    adminTab, setAdminTab, seasons, owners, leagues, masterTeams, banners,
    onAdminLogin, onNavigateToSchedule
}: AdminViewProps) => {
    const [adminUnlocked, setAdminUnlocked] = useState(false);
    const [adminPwInput, setAdminPwInput] = useState('');

    useEffect(() => {
        const loginTime = localStorage.getItem('adminLoginTime');
        if (loginTime && Date.now() - Number(loginTime) < 3 * 60 * 60 * 1000) setAdminUnlocked(true);
    }, []);

    const handleLogin = async () => {
        const isSuccess = await onAdminLogin(adminPwInput);
        if (isSuccess) {
            setAdminUnlocked(true);
            localStorage.setItem('adminLoginTime', String(Date.now()));
            setAdminPwInput('');
        } else alert("비밀번호가 일치하지 않습니다.");
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleLogin();
    };

    const handleDeleteSeason = async (seasonId: number) => {
        if (!confirm("시즌을 삭제할 경우, 모든 기록이 삭제됩니다. 삭제하시겠습니까?")) return;
        await deleteDoc(doc(db, "seasons", String(seasonId)));
        setAdminTab('NEW');
        alert("시즌 삭제 완료");
    };

    const handleDeleteSchedule = async (seasonId: number) => {
        if (!confirm("해당 시즌의 스케줄만 삭제하시겠습니까?")) return;
        await updateDoc(doc(db, "seasons", String(seasonId)), { rounds: [] });
        alert("스케줄 삭제 완료");
    };

    // 🔥 시즌 마감 및 상금(REVENUE) 일괄 지급 로직
    const handleCloseSeason = async (season: Season) => {
        if (season.status === 'COMPLETED') return alert("이미 마감된 시즌입니다.");
        if (!confirm(`정말 '${season.name}' 시즌을 마감하고 상금을 정산하시겠습니까?\n수익 기록이 장부에 즉시 등록됩니다.`)) return;

        try {
            const ledgerRef = collection(db, 'finance_ledger');
            const q = query(ledgerRef, where("seasonId", "==", String(season.id)), where("type", "==", "REVENUE"));
            const existingDocs = await getDocs(q);
            if (!existingDocs.empty) return alert("🚨 이미 상금이 정산된 시즌입니다.");

            const teamStats: Record<string, any> = {};
            const playerGoals: Record<string, any> = {};
            const playerAssists: Record<string, any> = {};

            season.rounds?.forEach(r => {
                r.matches?.filter(m => m.status === 'COMPLETED').forEach(m => {
                    const hTeam = m.home; const aTeam = m.away;
                    if (!teamStats[hTeam]) teamStats[hTeam] = { owner: m.homeOwner, pts: 0, gd: 0, gf: 0 };
                    if (!teamStats[aTeam]) teamStats[aTeam] = { owner: m.awayOwner, pts: 0, gd: 0, gf: 0 };

                    const hs = Number(m.homeScore || 0); const as = Number(m.awayScore || 0);

                    teamStats[hTeam].gf += hs; teamStats[hTeam].gd += (hs - as);
                    teamStats[aTeam].gf += as; teamStats[aTeam].gd += (as - hs);

                    if (hs > as) teamStats[hTeam].pts += 3;
                    else if (as > hs) teamStats[aTeam].pts += 3;
                    else { teamStats[hTeam].pts += 1; teamStats[aTeam].pts += 1; }

                    m.homeScorers?.forEach((p: string) => { if(!playerGoals[p]) playerGoals[p] = { owner: m.homeOwner, goals: 0 }; playerGoals[p].goals += 1; });
                    m.awayScorers?.forEach((p: string) => { if(!playerGoals[p]) playerGoals[p] = { owner: m.awayOwner, goals: 0 }; playerGoals[p].goals += 1; });
                    m.homeAssists?.forEach((p: string) => { if(!playerAssists[p]) playerAssists[p] = { owner: m.homeOwner, assists: 0 }; playerAssists[p].assists += 1; });
                    m.awayAssists?.forEach((p: string) => { if(!playerAssists[p]) playerAssists[p] = { owner: m.awayOwner, assists: 0 }; playerAssists[p].assists += 1; });
                });
            });

            let firstOwner = '', secondOwner = '', thirdOwner = '';
            
            if (season.type === 'LEAGUE') {
                const sortedTeams = Object.values(teamStats).sort((a:any, b:any) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
                firstOwner = sortedTeams[0]?.owner || ''; secondOwner = sortedTeams[1]?.owner || ''; thirdOwner = sortedTeams[2]?.owner || '';
            } else {
                // 🔥 TS 에러 해결을 위해 명시적으로 any 타입 지정
                let finalMatch: any = null;
                season.rounds?.forEach(r => r.matches?.forEach(m => {
                    if (m.stage === 'FINAL' || m.matchLabel?.toUpperCase().includes('FINAL')) finalMatch = m;
                }));
                if (finalMatch && finalMatch.status === 'COMPLETED') {
                    const hs = Number(finalMatch.homeScore); const as = Number(finalMatch.awayScore);
                    if (hs > as) { firstOwner = finalMatch.homeOwner; secondOwner = finalMatch.awayOwner; }
                    else { firstOwner = finalMatch.awayOwner; secondOwner = finalMatch.homeOwner; }
                }
                const sortedFallback = Object.values(teamStats).filter((t:any) => t.owner !== firstOwner && t.owner !== secondOwner).sort((a:any, b:any) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
                thirdOwner = sortedFallback[0]?.owner || '';
            }

            const topScorer = Object.values(playerGoals).sort((a:any, b:any) => b.goals - a.goals)[0]?.owner || '';
            const topAssist = Object.values(playerAssists).sort((a:any, b:any) => b.assists - a.assists)[0]?.owner || '';

            const getOwnerId = (nick: string) => owners.find(o => o.nickname === nick)?.id;

            const batch = writeBatch(db);
            const prizes = (season as any).prizes || {};

            const addPrize = (oId: any, amount: number, title: string) => {
                if (oId && amount > 0) {
                    batch.set(doc(ledgerRef), {
                        seasonId: String(season.id), ownerId: String(oId), type: 'REVENUE',
                        amount: Number(amount), title: title, createdAt: new Date().toISOString()
                    });
                }
            };

            addPrize(getOwnerId(firstOwner), prizes.first, `${season.name} 우승 🏆`);
            addPrize(getOwnerId(secondOwner), prizes.second, `${season.name} 준우승 🥈`);
            addPrize(getOwnerId(thirdOwner), prizes.third, `${season.name} 3위 🥉`);
            addPrize(getOwnerId(topScorer), prizes.scorer, `${season.name} 득점왕 ⚽`);
            addPrize(getOwnerId(topAssist), prizes.assist, `${season.name} 도움왕 🅰️`);

            batch.update(doc(db, 'seasons', String(season.id)), { status: 'COMPLETED' });

            await batch.commit();
            alert(`🎉 [${season.name}] 마감 및 상금 지급 완료!`);
            setAdminTab('NEW'); 
        } catch (error) {
            console.error("🚨 정산 오류:", error);
            alert("정산 중 오류가 발생했습니다.");
        }
    };

    // 🔥 [서버 부하/렉 해결 핵심] 과거 시즌 데이터를 진짜 DB로 영구 이관하는 1회성 함수
    const handleMigratePastData = async () => {
        if (!confirm("⚠️ 주의: 서버 부하를 줄이기 위해 과거 시즌 기록을 DB에 영구 저장합니다.\n1회만 실행하면 되며, 진행하시겠습니까?")) return;

        try {
            const ledgerRef = collection(db, 'finance_ledger');
            const existingSnap = await getDocs(ledgerRef);
            const existingDocs = existingSnap.docs.map(d => d.data());

            const batch = writeBatch(db);
            let writeCount = 0;

            seasons.forEach(s => {
                if (s.status !== 'COMPLETED') return;

                const hasExpense = existingDocs.some(l => String(l.seasonId) === String(s.id) && l.type === 'EXPENSE');
                const hasRevenue = existingDocs.some(l => String(l.seasonId) === String(s.id) && l.type === 'REVENUE');
                if (hasExpense && hasRevenue) return; // 이미 이관된 시즌 패스

                const teamStats: Record<string, any> = {};
                const playerGoals: Record<string, any> = {};
                const playerAssists: Record<string, any> = {};
                const participants = new Set<string>();

                s.rounds?.forEach(r => {
                    r.matches?.forEach(m => {
                        if (m.homeOwner && m.homeOwner !== '-' && m.homeOwner !== 'CPU' && m.home !== 'BYE') participants.add(m.homeOwner);
                        if (m.awayOwner && m.awayOwner !== '-' && m.awayOwner !== 'CPU' && m.away !== 'BYE') participants.add(m.awayOwner);

                        if (m.status === 'COMPLETED' && m.homeScore !== '' && m.awayScore !== '') {
                            const hTeam = m.home; const aTeam = m.away;
                            if (!teamStats[hTeam]) teamStats[hTeam] = { owner: m.homeOwner, pts: 0, gd: 0, gf: 0 };
                            if (!teamStats[aTeam]) teamStats[aTeam] = { owner: m.awayOwner, pts: 0, gd: 0, gf: 0 };
                            const hs = Number(m.homeScore || 0); const as = Number(m.awayScore || 0);
                            teamStats[hTeam].gf += hs; teamStats[hTeam].gd += (hs - as);
                            teamStats[aTeam].gf += as; teamStats[aTeam].gd += (as - hs);
                            if (hs > as) teamStats[hTeam].pts += 3; else if (as > hs) teamStats[aTeam].pts += 3; else { teamStats[hTeam].pts += 1; teamStats[aTeam].pts += 1; }
                            m.homeScorers?.forEach((p: string) => { if(!playerGoals[p]) playerGoals[p] = { owner: m.homeOwner, goals: 0 }; playerGoals[p].goals += 1; });
                            m.awayScorers?.forEach((p: string) => { if(!playerGoals[p]) playerGoals[p] = { owner: m.awayOwner, goals: 0 }; playerGoals[p].goals += 1; });
                            m.homeAssists?.forEach((p: string) => { if(!playerAssists[p]) playerAssists[p] = { owner: m.homeOwner, assists: 0 }; playerAssists[p].assists += 1; });
                            m.awayAssists?.forEach((p: string) => { if(!playerAssists[p]) playerAssists[p] = { owner: m.awayOwner, assists: 0 }; playerAssists[p].assists += 1; });
                        }
                    });
                });

                const prizes = (s as any).prizes || { first: 0, second: 0, third: 0, scorer: 0, assist: 0 };
                const totalPrize = (s as any).totalPrize || (prizes.first + prizes.second + prizes.third + prizes.scorer + prizes.assist);
                const fallbackDate = new Date(s.id).toISOString(); 

                if (!hasExpense && participants.size > 0 && totalPrize > 0) {
                    const entryFee = Math.floor(totalPrize / participants.size);
                    participants.forEach(nick => {
                        const oId = owners.find(o => o.nickname === nick)?.id;
                        if (oId) {
                            batch.set(doc(ledgerRef), { seasonId: String(s.id), ownerId: String(oId), type: 'EXPENSE', amount: entryFee, title: `[과거] ${s.name} 참가비`, createdAt: fallbackDate });
                            writeCount++;
                        }
                    });
                }

                if (!hasRevenue) {
                    let firstOwner = '', secondOwner = '', thirdOwner = '';
                    const sortedByPts = Object.values(teamStats).sort((a:any, b:any) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
                    if (s.type === 'LEAGUE') {
                        firstOwner = sortedByPts[0]?.owner || ''; secondOwner = sortedByPts[1]?.owner || ''; thirdOwner = sortedByPts[2]?.owner || '';
                    } else {
                        const allMatches = s.rounds?.flatMap(r => r.matches) || [];
                        const finalMatch = allMatches.find(m => m?.stage?.toUpperCase().includes('FINAL') || m?.matchLabel?.toUpperCase().includes('FINAL'));
                        if (finalMatch && finalMatch.status === 'COMPLETED' && finalMatch.homeScore !== '' && finalMatch.awayScore !== '') {
                            const hs = Number(finalMatch.homeScore); const as = Number(finalMatch.awayScore);
                            if (hs > as) { firstOwner = finalMatch.homeOwner; secondOwner = finalMatch.awayOwner; } else { firstOwner = finalMatch.awayOwner; secondOwner = finalMatch.homeOwner; }
                        } else { firstOwner = sortedByPts[0]?.owner || ''; secondOwner = sortedByPts[1]?.owner || ''; }
                        const sortedFallback = Object.values(teamStats).filter((t:any) => t.owner !== firstOwner && t.owner !== secondOwner).sort((a:any, b:any) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
                        thirdOwner = sortedFallback[0]?.owner || '';
                    }

                    const topScorer = Object.values(playerGoals).sort((a:any, b:any) => b.goals - a.goals)[0]?.owner || '';
                    const topAssist = Object.values(playerAssists).sort((a:any, b:any) => b.assists - a.assists)[0]?.owner || '';

                    const addVirtualPrize = (nick: string, amount: number, title: string) => {
                        const oId = owners.find(o => o.nickname === nick)?.id;
                        if (oId && amount > 0) {
                            batch.set(doc(ledgerRef), { seasonId: String(s.id), ownerId: String(oId), type: 'REVENUE', amount: Number(amount), title: title, createdAt: fallbackDate });
                            writeCount++;
                        }
                    };

                    addVirtualPrize(firstOwner, prizes.first, `${s.name} 우승 🏆`);
                    addVirtualPrize(secondOwner, prizes.second, `${s.name} 준우승 🥈`);
                    addVirtualPrize(thirdOwner, prizes.third, `${s.name} 3위 🥉`);
                    addVirtualPrize(topScorer, prizes.scorer, `${s.name} 득점왕 ⚽`);
                    addVirtualPrize(topAssist, prizes.assist, `${s.name} 도움왕 🅰️`);
                }
            });

            if (writeCount > 0) {
                await batch.commit();
                alert(`✅ 성공! 총 ${writeCount}개의 과거 장부 데이터가 DB에 영구 이관되었습니다.\n이제 파이낸스 페이지가 0.1초 만에 로딩됩니다.`);
            } else {
                alert("✅ 이관할 과거 데이터가 없습니다. (이미 최신 상태)");
            }
        } catch (error) {
            console.error("🚨 이관 오류:", error);
            alert("이관 중 오류가 발생했습니다.");
        }
    };

    if (!adminUnlocked) return <div className="flex flex-col items-center justify-center py-20 space-y-4"><div className="text-4xl animate-bounce">🔒</div><input type="password" value={adminPwInput} onChange={e => setAdminPwInput(e.target.value)} onKeyDown={handleKeyDown} className="bg-slate-950 border border-slate-700 p-3 rounded-xl text-center text-white" placeholder="Password" /><button onClick={handleLogin} className="bg-slate-800 px-6 py-2 rounded-xl font-bold text-emerald-400">LOGIN</button></div>;

    const handleTabChange = (val: string) => {
        setAdminTab(isNaN(Number(val)) ? val : Number(val));
    };

    return (
        <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 animate-in fade-in">
            {/* 🔥 상단 메뉴 옆에 과거 데이터 DB 마이그레이션 버튼 배치 */}
            <div className="flex justify-between items-center mb-4 gap-2">
                <select value={adminTab} onChange={(e) => handleTabChange(e.target.value)} className="flex-1 w-full bg-slate-950 p-4 rounded-xl border border-slate-700 text-sm h-14 font-bold text-white">
                    <option value="NEW">➕ Create New Season</option>
                    <option value="LEAGUES">🏳️ League Management</option>
                    <option value="TEAMS">🛡️ Team Management</option>
                    <option value="OWNER">👤 Owner Management</option>
                    <option value="BANNER">🖼️ Banner Management</option>
                    <option value="REAL">🌏 Real-World Data Patch</option>
                    <optgroup label="Select Season to Manage">
                        {seasons.map(s => (
                            <option key={s.id} value={s.id}>
                                {(() => {
                                    const pureName = s.name.replace(/^(🏆|🏳️|⚔️)\s*/, '');
                                    let icon = '🏳️';
                                    if (s.type === 'CUP') icon = '🏆';
                                    if (s.type === 'TOURNAMENT') icon = '⚔️';
                                    return `${icon} ${pureName} ${s.status === 'COMPLETED' ? '(마감)' : ''}`;
                                })()}
                            </option>
                        ))}
                    </optgroup>
                </select>
                <button onClick={handleMigratePastData} className="h-14 px-4 bg-indigo-900/50 hover:bg-indigo-700 border border-indigo-500 rounded-xl text-[10px] font-black italic text-indigo-200 transition-all shrink-0 leading-tight">
                    🛠️ 과거시즌<br/>DB 영구이관
                </button>
            </div>

            {adminTab === 'LEAGUES' && <AdminLeagueManager leagues={leagues} masterTeams={masterTeams} />}
            {adminTab === 'TEAMS' && <AdminTeamManager leagues={leagues} masterTeams={masterTeams} />}
            {adminTab === 'BANNER' && <AdminBannerManager banners={banners} />}
            {adminTab === 'OWNER' && <AdminOwnerManager owners={owners} />}
            {adminTab === 'NEW' && <AdminSeasonCreate onCreateSuccess={(id) => setAdminTab(id)} />}
            {adminTab === 'REAL' && <AdminRealWorldManager leagues={leagues} masterTeams={masterTeams} />}

            {typeof adminTab === 'number' && (() => {
                const targetSeason = seasons.find(s => s.id === adminTab);
                if (!targetSeason) return <div>Season Not Found</div>;
                return (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-4">
                            <button onClick={() => setAdminTab('NEW')} className="text-slate-500 hover:text-white shrink-0">← Back</button>
                            <div className="flex items-center flex-1 justify-center">
                                <h2 className="text-lg md:text-xl font-bold text-emerald-400 truncate">
                                    Manage: {targetSeason.name} 
                                    {targetSeason.status === 'COMPLETED' && <span className="text-[10px] text-yellow-500 ml-2 border border-yellow-500/50 px-2 py-0.5 rounded-full uppercase tracking-widest align-middle">Closed</span>}
                                </h2>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 justify-end">
                                {targetSeason.status !== 'COMPLETED' && (
                                    <button onClick={() => handleCloseSeason(targetSeason)} className="bg-yellow-600 px-3 py-1.5 rounded-lg text-xs font-black italic hover:bg-yellow-500 text-white shadow-[0_0_15px_rgba(202,138,4,0.4)] transition-all">💰 마감/정산</button>
                                )}
                                <button onClick={() => handleDeleteSeason(targetSeason.id)} className="bg-red-900/80 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 text-red-200 transition-all">Delete</button>
                            </div>
                        </div>
                        
                        {targetSeason.type === 'CUP' ? (
                            <AdminCupSetup targetSeason={targetSeason} owners={owners} leagues={leagues} masterTeams={masterTeams} onNavigateToSchedule={onNavigateToSchedule} />
                        ) : (
                            <AdminTeamMatching targetSeason={targetSeason} owners={owners} leagues={leagues} masterTeams={masterTeams} onNavigateToSchedule={onNavigateToSchedule} onDeleteSchedule={() => handleDeleteSchedule(targetSeason.id)} />
                        )}
                    </div>
                );
            })()}
        </div>
    );
};