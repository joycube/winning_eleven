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
            batch.delete(doc(db, "seasons", String(seasonId)));

            const ledgerRef = collection(db, 'finance_ledger');
            const q = query(ledgerRef, where("seasonId", "==", String(seasonId)));
            const ledgerDocs = await getDocs(q);

            ledgerDocs.forEach((docSnap) => {
                batch.delete(docSnap.ref);
            });

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

            // 1. 경기 통계 취합 (정규 리그 순위 및 개인상 계산용)
            // 하이브리드/컵 모드의 토너먼트 경기도 개인상(골/어시)에 포함됨!
            season.rounds?.forEach(r => {
                r.matches?.filter(m => m.status === 'COMPLETED').forEach(m => {
                    const hTeam = m.home; const aTeam = m.away;
                    if (!teamStats[hTeam]) teamStats[hTeam] = { owner: m.homeOwner, pts: 0, gd: 0, gf: 0 };
                    if (!teamStats[aTeam]) teamStats[aTeam] = { owner: m.awayOwner, pts: 0, gd: 0, gf: 0 };

                    const hs = Number(m.homeScore || 0); const as = Number(m.awayScore || 0);

                    // 리그 승점/득실 계산 (토너먼트 경기인 ROUND_OF_4, SEMI_FINAL, FINAL은 순위 계산에서 제외)
                    if (!['ROUND_OF_4', 'SEMI_FINAL', 'FINAL'].includes(r.name)) {
                        teamStats[hTeam].gf += hs; teamStats[hTeam].gd += (hs - as);
                        teamStats[aTeam].gf += as; teamStats[aTeam].gd += (as - hs);

                        if (hs > as) teamStats[hTeam].pts += 3;
                        else if (as > hs) teamStats[aTeam].pts += 3;
                        else { teamStats[hTeam].pts += 1; teamStats[aTeam].pts += 1; }
                    }

                    // 골, 어시스트는 모든 경기에서 누적
                    m.homeScorers?.forEach((p: string) => { if(!playerGoals[p]) playerGoals[p] = { owner: m.homeOwner, goals: 0 }; playerGoals[p].goals += 1; });
                    m.awayScorers?.forEach((p: string) => { if(!playerGoals[p]) playerGoals[p] = { owner: m.awayOwner, goals: 0 }; playerGoals[p].goals += 1; });
                    m.homeAssists?.forEach((p: string) => { if(!playerAssists[p]) playerAssists[p] = { owner: m.homeOwner, assists: 0 }; playerAssists[p].assists += 1; });
                    m.awayAssists?.forEach((p: string) => { if(!playerAssists[p]) playerAssists[p] = { owner: m.awayOwner, assists: 0 }; playerAssists[p].assists += 1; });
                });
            });

            let firstOwner = '', secondOwner = '', thirdOwner = '';
            let grandChampionOwner = ''; // 🔥 [디벨롭] 최종 우승자 오너 ID (하이브리드/컵 모드 전용)

            // 2. 순위 및 우승자 분리 판별
            const sortedTeams = Object.values(teamStats).sort((a:any, b:any) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
            
            if (season.type === 'LEAGUE') {
                firstOwner = sortedTeams[0]?.owner || ''; 
                secondOwner = sortedTeams[1]?.owner || ''; 
                thirdOwner = sortedTeams[2]?.owner || '';
            } else if (season.type === 'LEAGUE_PLAYOFF' || season.type === 'CUP') {
                // 🔥 하이브리드 & 컵 모드: 정규/조별 리그 1,2,3위 그대로 유지
                firstOwner = sortedTeams[0]?.owner || ''; 
                secondOwner = sortedTeams[1]?.owner || ''; 
                thirdOwner = sortedTeams[2]?.owner || '';

                // 🔥 결승전(FINAL) 승자를 찾아 최종 우승자로 선정!
                let finalMatch: any = null;
                season.rounds?.forEach(r => r.matches?.forEach(m => {
                    if (m.stage.toUpperCase().includes('FINAL') && !m.stage.toUpperCase().includes('SEMI') && !m.stage.toUpperCase().includes('QUARTER')) {
                        finalMatch = m;
                    }
                }));

                if (finalMatch && finalMatch.status === 'COMPLETED') {
                    const hs = Number(finalMatch.homeScore); const as = Number(finalMatch.awayScore);
                    if (hs > as) grandChampionOwner = finalMatch.homeOwner;
                    else if (as > hs) grandChampionOwner = finalMatch.awayOwner;
                }
            } else {
                // 일반 토너먼트 모드 (기존 로직 유지)
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

            // 3. 상금 쏴주기
            if (season.type === 'LEAGUE_PLAYOFF' || season.type === 'CUP') {
                // 🔥 하이브리드 & 컵 모드: 명칭 분리해서 상금 지급!
                addPrize(getOwnerId(grandChampionOwner), prizes.champion, `👑 ${season.name} 최종 우승`);
                addPrize(getOwnerId(firstOwner), prizes.first, `🚩 ${season.name} 리그 1위`);
                addPrize(getOwnerId(secondOwner), prizes.second, `🚩 ${season.name} 리그 2위`);
                addPrize(getOwnerId(thirdOwner), prizes.third, `🚩 ${season.name} 리그 3위`);
            } else {
                // 일반 모드 (기존과 동일)
                addPrize(getOwnerId(firstOwner), prizes.first, `${season.name} 우승 🏆`);
                addPrize(getOwnerId(secondOwner), prizes.second, `${season.name} 준우승 🥈`);
                addPrize(getOwnerId(thirdOwner), prizes.third, `${season.name} 3위 🥉`);
            }

            // 개인상 지급 (공통)
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
            
            <div className="relative mb-8">
                <select 
                    value={String(adminTab)} 
                    onChange={(e) => handleTabChange(e.target.value)}
                    className="w-full bg-slate-950 text-white text-base font-bold py-4 px-5 rounded-xl border border-slate-700 shadow-xl appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
                >
                    <optgroup label="⚙️ System Management" className="bg-slate-800 text-slate-400 font-bold text-sm">
                        <option value="NEW" className="text-white text-base bg-slate-900 py-2">➕ Create New Season</option>
                        <option value="NOTICE" className="text-white text-base bg-slate-900 py-2">📢 Notice Management</option>
                        <option value="LEAGUES" className="text-white text-base bg-slate-900 py-2">🏳️ League Management</option>
                        <option value="TEAMS" className="text-white text-base bg-slate-900 py-2">🛡️ Team Management</option>
                        <option value="OWNER" className="text-white text-base bg-slate-900 py-2">👤 Owner Management</option>
                        <option value="BANNER" className="text-white text-base bg-slate-900 py-2">🖼️ Banner Management</option>
                        <option value="REAL" className="text-white text-base bg-slate-900 py-2">🌏 Real-World Data Patch</option>
                    </optgroup>
                    
                    <optgroup label="📋 Select Season to Manage" className="bg-slate-800 text-slate-400 font-bold text-sm">
                        {seasons.map(s => (
                            <option key={s.id} value={s.id} className="text-white text-base bg-slate-900 py-2">
                                {(() => {
                                    const pureName = s.name.replace(/^(🏆|🏳️|⚔️|⭐)\s*/, '');
                                    let icon = '🏳️';
                                    if (s.type === 'CUP') icon = '🏆';
                                    if (s.type === 'TOURNAMENT') icon = '⚔️';
                                    if (s.type === 'LEAGUE_PLAYOFF') icon = '⭐';
                                    return `${icon} ${pureName} ${s.status === 'COMPLETED' ? '(마감)' : ''}`;
                                })()}
                            </option>
                        ))}
                    </optgroup>
                </select>
                
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </div>
            </div>

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