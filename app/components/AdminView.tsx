"use client";

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { deleteDoc, doc, updateDoc, collection, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { Season, Owner, League, MasterTeam, Banner } from '../types';
import { AdminLeagueManager, AdminTeamManager } from './AdminTeamManagement';
import { AdminBannerManager } from './AdminBannerManager';
import { AdminSeasonCreate } from './AdminSeasonCreate';
import { AdminOwnerManager } from './AdminOwnerManager';
import { AdminTeamMatching } from './AdminTeamMatching';
import { AdminCupSetup } from './AdminCupSetup';
import { AdminRealWorldManager } from './AdminRealWorldManager';
import { AdminNoticeManager } from './AdminNoticeManager';

// 🔥 [에러 해결] Trash2 (휴지통 아이콘) import 추가 완료!
import { PlusCircle, UserCheck, Megaphone, Flag, Shield, Crown, Image as ImageIcon, Globe, ArrowLeft, Trophy, Settings, Trash2 } from 'lucide-react';

// @ts-ignore
import { AdminUserTracker } from './AdminUserTracker';

interface AdminViewProps {
    adminTab: number | 'NEW' | 'OWNER' | 'BANNER' | 'LEAGUES' | 'TEAMS' | 'REAL' | 'NOTICE' | 'USERS' | 'SYSTEM_MENU' | 'SEASON_MENU' | 'CREATE_SEASON' | string;
    setAdminTab: (tab: any) => void;
    seasons: Season[];
    owners: Owner[];
    leagues: League[];
    masterTeams: MasterTeam[];
    banners: Banner[];
    onAdminLogin?: (pw: string) => Promise<boolean> | boolean;
    onCreateSeason: (name: string, type: string, mode: string, prize: number, prizesObj: any) => void; 
    onSaveOwner: (name: string, photo: string, editId: string | null) => void; 
    onNavigateToSchedule: (seasonId: number) => void;
}

export const AdminView = ({
    adminTab, setAdminTab, seasons, owners, leagues, masterTeams, banners,
    onNavigateToSchedule
}: AdminViewProps) => {

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

            setAdminTab('SEASON_MENU');
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

                    if (!['ROUND_OF_4', 'SEMI_FINAL', 'FINAL'].includes(r.name)) {
                        teamStats[hTeam].gf += hs; teamStats[hTeam].gd += (hs - as);
                        teamStats[aTeam].gf += as; teamStats[aTeam].gd += (as - hs);

                        if (hs > as) teamStats[hTeam].pts += 3;
                        else if (as > hs) teamStats[aTeam].pts += 3;
                        else { teamStats[hTeam].pts += 1; teamStats[aTeam].pts += 1; }
                    }

                    const processRecords = (records: any[], targetMap: any, ownerName: string) => {
                        if (!records || !Array.isArray(records)) return;
                        records.forEach(p => {
                            const pName = typeof p === 'string' ? p : p.name;
                            const count = typeof p === 'string' ? 1 : (p.count || 1);
                            if (!pName) return;
                            
                            if (!targetMap[pName]) targetMap[pName] = { owner: ownerName, count: 0 };
                            targetMap[pName].count += count;
                        });
                    };

                    processRecords(m.homeScorers, playerGoals, m.homeOwner);
                    processRecords(m.awayScorers, playerGoals, m.awayOwner);
                    processRecords(m.homeAssists, playerAssists, m.homeOwner);
                    processRecords(m.awayAssists, playerAssists, m.awayOwner);
                });
            });

            let firstOwner = '', secondOwner = '', thirdOwner = '';
            let grandChampionOwner = ''; 

            const sortedTeams = Object.values(teamStats).sort((a:any, b:any) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
            
            if (season.type === 'LEAGUE') {
                firstOwner = sortedTeams[0]?.owner || ''; 
                secondOwner = sortedTeams[1]?.owner || ''; 
                thirdOwner = sortedTeams[2]?.owner || '';
            } else if (season.type === 'LEAGUE_PLAYOFF' || season.type === 'CUP') {
                firstOwner = sortedTeams[0]?.owner || ''; 
                secondOwner = sortedTeams[1]?.owner || ''; 
                thirdOwner = sortedTeams[2]?.owner || '';

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
                let finalMatch: any = null;
                season.rounds?.forEach(r => {
                    if (r.matches && r.matches.length > 0) {
                        finalMatch = r.matches[r.matches.length - 1]; 
                    }
                });

                if (finalMatch && finalMatch.status === 'COMPLETED') {
                    const hs = Number(finalMatch.homeScore); const as = Number(finalMatch.awayScore);
                    if (hs > as) { firstOwner = finalMatch.homeOwner; secondOwner = finalMatch.awayOwner; }
                    else { firstOwner = finalMatch.awayOwner; secondOwner = finalMatch.homeOwner; }
                }
                const sortedFallback = Object.values(teamStats).filter((t:any) => t.owner !== firstOwner && t.owner !== secondOwner).sort((a:any, b:any) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
                thirdOwner = sortedFallback[0]?.owner || '';
            }

            const topScorer = Object.values(playerGoals).sort((a:any, b:any) => b.count - a.count)[0]?.owner || '';
            const topAssist = Object.values(playerAssists).sort((a:any, b:any) => b.count - a.count)[0]?.owner || '';

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

            if (season.type === 'LEAGUE_PLAYOFF' || season.type === 'CUP') {
                addPrize(getOwnerId(grandChampionOwner), prizes.champion, `👑 ${season.name} 최종 우승`);
                addPrize(getOwnerId(firstOwner), prizes.first, `🚩 ${season.name} 리그 1위`);
                addPrize(getOwnerId(secondOwner), prizes.second, `🚩 ${season.name} 리그 2위`);
                addPrize(getOwnerId(thirdOwner), prizes.third, `🚩 ${season.name} 리그 3위`);
            } else {
                addPrize(getOwnerId(firstOwner), prizes.first, `${season.name} 우승 🏆`);
                addPrize(getOwnerId(secondOwner), prizes.second, `${season.name} 준우승 🥈`);
                addPrize(getOwnerId(thirdOwner), prizes.third, `${season.name} 3위 🥉`);
            }

            addPrize(getOwnerId(topScorer), prizes.scorer, `${season.name} 득점왕 ⚽`);
            addPrize(getOwnerId(topAssist), prizes.assist, `${season.name} 도움왕 🅰️`);

            batch.update(doc(db, 'seasons', String(season.id)), { status: 'COMPLETED' });

            await batch.commit();
            alert(`🎉 [${season.name}] 마감 및 상금 지급 완료!`);
            setAdminTab('SEASON_MENU'); 
        } catch (error) {
            console.error("🚨 정산 오류:", error);
            alert("정산 중 오류가 발생했습니다.");
        }
    };

    const isSeasonView = typeof adminTab === 'number' || adminTab === 'SEASON_MENU';
    const activeTopTab = isSeasonView ? 'SEASON' : 'SYSTEM';

    const SystemCard = ({ title, subtitle, icon, color, onClick }: any) => (
        <div 
            onClick={onClick} 
            className={`relative overflow-hidden rounded-3xl p-6 cursor-pointer transition-all hover:scale-105 hover:shadow-2xl hover:shadow-emerald-900/20 group border border-slate-700/50 bg-gradient-to-br ${color} h-[130px] sm:h-[150px] flex flex-col justify-between`}
        >
            <div className="absolute -right-4 -bottom-4 opacity-20 transform group-hover:scale-125 transition-transform duration-500">
                {icon}
            </div>
            <div className="text-white drop-shadow-md">
                {icon}
            </div>
            <div className="relative z-10">
                <h3 className="text-white font-black text-[16px] sm:text-lg drop-shadow-md leading-tight">{title}</h3>
                {subtitle && <p className="text-white/70 text-[10px] sm:text-[11px] font-bold mt-1 tracking-widest uppercase">{subtitle}</p>}
            </div>
        </div>
    );

    return (
        <div className="bg-[#0B1120] p-3 sm:p-6 rounded-3xl border border-slate-800 shadow-2xl animate-in fade-in">
            
            {/* 🔥 상단 토글 탭 */}
            <div className="flex bg-slate-900 rounded-2xl p-1.5 border border-slate-800 mb-6 sm:mb-8 shadow-inner">
                <button
                    onClick={() => setAdminTab('SYSTEM_MENU')}
                    className={`flex-1 py-3 sm:py-4 text-[13px] sm:text-[15px] font-black rounded-xl transition-all flex items-center justify-center gap-2 ${activeTopTab === 'SYSTEM' ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                >
                    <Settings size={18} /> 시스템 관리
                </button>
                <button
                    onClick={() => setAdminTab('SEASON_MENU')}
                    className={`flex-1 py-3 sm:py-4 text-[13px] sm:text-[15px] font-black rounded-xl transition-all flex items-center justify-center gap-2 ${activeTopTab === 'SEASON' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                >
                    <Trophy size={18} /> 시즌 관리
                </button>
            </div>

            {/* 🔥 시스템 관리 영역 */}
            {activeTopTab === 'SYSTEM' && (
                <>
                    {(adminTab === 'SYSTEM_MENU' || adminTab === 'NEW') ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 animate-in slide-in-from-bottom-4">
                            <SystemCard title="시즌 생성" subtitle="Create Season" icon={<PlusCircle size={36}/>} color="from-emerald-500 to-teal-800" onClick={() => setAdminTab('CREATE_SEASON')} />
                            <SystemCard title="가입 승인" subtitle="User Approval" icon={<UserCheck size={36}/>} color="from-blue-500 to-indigo-800" onClick={() => setAdminTab('USERS')} />
                            <SystemCard title="공지 관리" subtitle="Notice Board" icon={<Megaphone size={36}/>} color="from-purple-500 to-fuchsia-800" onClick={() => setAdminTab('NOTICE')} />
                            <SystemCard title="리그 관리" subtitle="League Setup" icon={<Flag size={36}/>} color="from-cyan-500 to-blue-800" onClick={() => setAdminTab('LEAGUES')} />
                            <SystemCard title="팀 DB 관리" subtitle="Team Setup" icon={<Shield size={36}/>} color="from-red-500 to-rose-800" onClick={() => setAdminTab('TEAMS')} />
                            <SystemCard title="오너 명부" subtitle="Owner Roster" icon={<Crown size={36}/>} color="from-orange-500 to-amber-800" onClick={() => setAdminTab('OWNER')} />
                            <SystemCard title="배너 관리" subtitle="Main Banners" icon={<ImageIcon size={36}/>} color="from-pink-500 to-rose-700" onClick={() => setAdminTab('BANNER')} />
                            <SystemCard title="실축 데이터" subtitle="Real-World Data" icon={<Globe size={36}/>} color="from-yellow-500 to-orange-700" onClick={() => setAdminTab('REAL')} />
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in slide-in-from-right-4">
                            <div className="mb-4 pb-4 border-b border-slate-800">
                                <button onClick={() => setAdminTab('SYSTEM_MENU')} className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold w-max transition-colors shadow-inner">
                                    <ArrowLeft size={16} /> <span>시스템 메뉴로 돌아가기</span>
                                </button>
                            </div>
                            
                            {adminTab === 'CREATE_SEASON' && <AdminSeasonCreate onCreateSuccess={(id) => setAdminTab(id)} />}
                            {adminTab === 'USERS' && <AdminUserTracker owners={owners} />}
                            {adminTab === 'NOTICE' && <AdminNoticeManager />}
                            {adminTab === 'LEAGUES' && <AdminLeagueManager leagues={leagues} masterTeams={masterTeams} />}
                            {adminTab === 'TEAMS' && <AdminTeamManager leagues={leagues} masterTeams={masterTeams} />}
                            {adminTab === 'BANNER' && <AdminBannerManager banners={banners} />}
                            {adminTab === 'OWNER' && <AdminOwnerManager owners={owners} />}
                            {adminTab === 'REAL' && <AdminRealWorldManager leagues={leagues} masterTeams={masterTeams} />}
                        </div>
                    )}
                </>
            )}

            {/* 🔥 시즌 관리 영역 */}
            {activeTopTab === 'SEASON' && (
                <>
                    {adminTab === 'SEASON_MENU' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 animate-in slide-in-from-bottom-4">
                            {seasons.slice().sort((a, b) => b.id - a.id).map(s => {
                                const isCompleted = s.status === 'COMPLETED';
                                return (
                                    <div 
                                        key={s.id} 
                                        onClick={() => setAdminTab(s.id)} 
                                        className={`p-5 sm:p-6 rounded-3xl cursor-pointer transition-all hover:-translate-y-1.5 shadow-xl group border ${isCompleted ? 'bg-slate-900 border-slate-800 hover:border-slate-600' : 'bg-slate-800/80 border-blue-900/50 hover:border-blue-500/50 hover:bg-slate-800'}`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <span className="text-3xl bg-slate-950 p-3 rounded-2xl border border-slate-800 shadow-inner group-hover:scale-110 transition-transform">
                                                {s.type === 'CUP' ? '🏆' : s.type === 'TOURNAMENT' ? '⚔️' : s.type === 'LEAGUE_PLAYOFF' ? '⭐' : '🏳️'}
                                            </span>
                                            <span className={`text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest shadow-sm ${isCompleted ? 'bg-slate-950 text-slate-500 border border-slate-800' : 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/30'}`}>
                                                {isCompleted ? '마감됨' : '진행중'}
                                            </span>
                                        </div>
                                        <h3 className={`font-black text-lg sm:text-xl leading-tight mb-2 transition-colors line-clamp-2 ${isCompleted ? 'text-slate-400 group-hover:text-slate-200' : 'text-white group-hover:text-blue-400'}`}>
                                            {s.name}
                                        </h3>
                                        <div className="flex items-center gap-3 mt-4 text-[11px] font-bold text-slate-500">
                                            <span className="bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
                                                {s.type}
                                            </span>
                                            <span>• 참가 {s.teams?.length || 0}팀</span>
                                        </div>
                                    </div>
                                )
                            })}
                            {seasons.length === 0 && (
                                <div className="col-span-full py-16 text-center text-slate-500 font-bold bg-slate-900 rounded-3xl border border-slate-800 border-dashed">
                                    생성된 시즌이 없습니다.<br/>시스템 관리에서 새로운 시즌을 생성해보세요!
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-right-4">
                            {(() => {
                                const targetSeason = seasons.find(s => s.id === adminTab);
                                if (!targetSeason) return <div className="text-center text-red-400 py-10">시즌 정보를 찾을 수 없습니다.</div>;
                                return (
                                    <>
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-slate-800 pb-5 bg-slate-900 p-4 sm:p-5 rounded-2xl shadow-inner">
                                            <button onClick={() => setAdminTab('SEASON_MENU')} className="flex items-center gap-2 text-slate-400 hover:text-blue-400 bg-[#0B1120] border border-slate-800 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold w-max transition-colors shrink-0">
                                                <ArrowLeft size={16} /> <span>시즌 목록으로</span>
                                            </button>
                                            <div className="flex flex-col items-center flex-1 justify-center min-w-0">
                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Manage Season</span>
                                                <h2 className="text-lg md:text-xl font-black text-blue-400 truncate w-full text-center px-4">
                                                    {targetSeason.name} 
                                                    {targetSeason.status === 'COMPLETED' && <span className="text-[10px] text-yellow-500 ml-2 border border-yellow-500/50 bg-yellow-950/30 px-2.5 py-1 rounded-md uppercase tracking-widest align-middle">Closed</span>}
                                                </h2>
                                            </div>
                                            <div className="flex items-center justify-end gap-2 shrink-0">
                                                {targetSeason.status !== 'COMPLETED' && (
                                                    <button onClick={() => handleCloseSeason(targetSeason)} className="bg-yellow-600 hover:bg-yellow-500 px-4 py-2.5 rounded-xl text-xs font-black text-white shadow-[0_0_15px_rgba(202,138,4,0.3)] transition-all flex items-center gap-1.5">
                                                        💰 마감/정산
                                                    </button>
                                                )}
                                                <button onClick={() => handleDeleteSeason(targetSeason.id)} className="bg-red-950/50 hover:bg-red-600 border border-red-900/50 hover:border-red-500 px-4 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:text-white transition-all flex items-center gap-1.5">
                                                    <Trash2 size={14} /> 파기
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {targetSeason.type === 'CUP' ? (
                                            <AdminCupSetup targetSeason={targetSeason} owners={owners} leagues={leagues} masterTeams={masterTeams} onNavigateToSchedule={onNavigateToSchedule} />
                                        ) : (
                                            <AdminTeamMatching targetSeason={targetSeason} owners={owners} leagues={leagues} masterTeams={masterTeams} onNavigateToSchedule={onNavigateToSchedule} onDeleteSchedule={() => handleDeleteSchedule(targetSeason.id)} />
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};