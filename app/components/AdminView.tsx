import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
// 🔥 [Finance] 마이그레이션(삭제)을 위한 파이어베이스 함수 추가
import { deleteDoc, doc, updateDoc, collection, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { Season, Owner, League, MasterTeam, Banner } from '../types';
import { AdminLeagueManager, AdminTeamManager } from './AdminTeamManagement';
import { AdminBannerManager } from './AdminBannerManager';
import { AdminSeasonCreate } from './AdminSeasonCreate';
import { AdminOwnerManager } from './AdminOwnerManager';
import { AdminTeamMatching } from './AdminTeamMatching';
import { AdminCupSetup } from './AdminCupSetup';
import { AdminRealWorldManager } from './AdminRealWorldManager';
// 🔥 [Notice] 공지사항 관리자 컴포넌트 추가
import { AdminNoticeManager } from './AdminNoticeManager';

// 🔥 [Notice] adminTab 타입에 'NOTICE' 추가
interface AdminViewProps {
    adminTab: number | 'NEW' | 'OWNER' | 'BANNER' | 'LEAGUES' | 'TEAMS' | 'REAL' | 'NOTICE';
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
        if (!confirm("⚠️ 시즌을 삭제할 경우 해당 시즌의 모든 기록과 '참가비/상금 장부 데이터'까지 영구 삭제됩니다.\n정말 삭제하시겠습니까?")) return;

        try {
            const batch = writeBatch(db);

            // 1. 시즌 문서 자체 삭제
            batch.delete(doc(db, "seasons", String(seasonId)));

            // 2. 해당 시즌과 묶인 finance_ledger (장부 데이터) 싹 다 긁어오기
            const ledgerRef = collection(db, 'finance_ledger');
            const q = query(ledgerRef, where("seasonId", "==", String(seasonId)));
            const ledgerDocs = await getDocs(q);

            // 3. 긁어온 장부 데이터들도 삭제 리스트에 추가
            ledgerDocs.forEach((docSnap) => {
                batch.delete(docSnap.ref);
            });

            // 4. 파이어베이스에 일괄 삭제 처리 쾅!
            await batch.commit();

            setAdminTab('NEW');
            alert("✅ 시즌 및 연관된 재무 기록까지 깔끔하게 파기 완료되었습니다!");
        } catch (error) {
            console.error("🚨 시즌 삭제 오류:", error);
            alert("시즌 및 장부 삭제 중 오류가 발생했습니다.");
        }
    };

    const handleDeleteSchedule = async (seasonId: number) => {
        if (!confirm("해당 시즌의 스케줄만 삭제하시겠습니까?")) return;
        await updateDoc(doc(db, "seasons", String(seasonId)), { rounds: [] });
        alert("스케줄 삭제 완료");
    };

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

    if (!adminUnlocked) return <div className="flex flex-col items-center justify-center py-20 space-y-4"><div className="text-4xl animate-bounce">🔒</div><input type="password" value={adminPwInput} onChange={e => setAdminPwInput(e.target.value)} onKeyDown={handleKeyDown} className="bg-slate-950 border border-slate-700 p-3 rounded-xl text-center text-white" placeholder="Password" /><button onClick={handleLogin} className="bg-slate-800 px-6 py-2 rounded-xl font-bold text-emerald-400">LOGIN</button></div>;

    const handleTabChange = (val: string) => {
        setAdminTab(isNaN(Number(val)) ? val : Number(val));
    };

    return (
        <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 animate-in fade-in">
            <select value={adminTab} onChange={(e) => handleTabChange(e.target.value)} className="w-full bg-slate-950 p-4 rounded-xl border border-slate-700 text-sm mb-4 h-14 font-bold text-white">
                <option value="NEW">➕ Create New Season</option>
                {/* 🔥 [Notice] 옵션 추가 */}
                <option value="NOTICE">📢 Notice Management</option>
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

            {/* 🔥 [Notice] 라우팅 추가 */}
            {adminTab === 'NOTICE' && <AdminNoticeManager />}
            
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