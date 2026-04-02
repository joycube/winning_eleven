"use client";

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { deleteDoc, doc, updateDoc, collection, writeBatch, query, where, getDocs, setDoc, getDoc } from 'firebase/firestore'; 
import { Season, Owner, League, MasterTeam, Banner } from '../types';
import { AdminLeagueManager, AdminTeamManager } from './AdminTeamManagement';
import { AdminBannerManager } from './AdminBannerManager';
import { AdminSeasonCreate } from './AdminSeasonCreate';
import { AdminOwnerManager } from './AdminOwnerManager';
import { AdminTeamMatching } from './AdminTeamMatching';
import { AdminCupSetup } from './AdminCupSetup';
import { AdminRealWorldManager } from './AdminRealWorldManager';
import { AdminNoticeManager } from './AdminNoticeManager';

import { PlusCircle, UserCheck, Megaphone, Flag, Shield, Crown, Image as ImageIcon, Globe, ArrowLeft, Trophy, Settings, Trash2, DatabaseBackup, PlaySquare } from 'lucide-react';

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

            batch.delete(doc(db, "history_records", String(seasonId)));

            await batch.commit();

            setAdminTab('SEASON_MENU');
            alert("✅ 시즌 및 연관된 재무 기록, 명예의 전당 스냅샷까지 깔끔하게 파기 완료되었습니다!");
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
        const isAlreadyCompleted = season.status === 'COMPLETED';
        
        const confirmMsg = isAlreadyCompleted 
            ? `이미 마감된 '${season.name}' 시즌입니다.\n과거 기록 보존을 위해 명예의 전당용 '스냅샷'만 새롭게(UID 기반으로) 재생성하시겠습니까?\n(상금 장부는 중복 지급되지 않습니다.)`
            : `정말 '${season.name}' 시즌을 마감하시겠습니까?\n\n💰 수익이 장부에 등록되며\n🏆 명예의 전당 스냅샷에 영구 박제됩니다.`;

        if (!confirm(confirmMsg)) return;

        try {
            const ledgerRef = collection(db, 'finance_ledger');
            const q = query(ledgerRef, where("seasonId", "==", String(season.id)), where("type", "==", "REVENUE"));
            const existingDocs = await getDocs(q);
            
            const skipFinance = !existingDocs.empty;
            
            if (skipFinance && !isAlreadyCompleted) {
                alert("🚨 이미 상금이 정산된 시즌입니다. 스냅샷만 재생성합니다.");
            }

            const userAccSnapshot = await getDocs(collection(db, 'user_accounts'));
            const userAccounts = userAccSnapshot.docs.map(d => {
                const data = d.data();
                return { 
                    uid: d.id, 
                    mappedOwnerId: data.mappedOwnerId as string | undefined, 
                    displayName: data.displayName as string | undefined 
                };
            });

            const getRealUid = (legacyName: string) => {
                if (!legacyName || ['-', 'TBD', 'SYSTEM', 'BYE', 'CPU'].includes(legacyName.trim())) return null;
                const search = legacyName.trim();
                
                const foundByUid = userAccounts.find(u => u.uid === search);
                if (foundByUid) return foundByUid.uid;

                const foundByName = userAccounts.find(u => u.mappedOwnerId === search || u.displayName === search);
                return foundByName ? foundByName.uid : search; 
            };

            const teamStats: Record<string, any> = {};
            const playerStats: Record<string, any> = {};

            season.rounds?.forEach(r => {
                r.matches?.filter(m => m.status === 'COMPLETED').forEach(m => {
                    const hTeam = m.home; const aTeam = m.away;
                    
                    if (!teamStats[hTeam]) teamStats[hTeam] = { name: hTeam, owner: m.homeOwner, win: 0, draw: 0, loss: 0, pts: 0, gd: 0, gf: 0, ga: 0 };
                    if (!teamStats[aTeam]) teamStats[aTeam] = { name: aTeam, owner: m.awayOwner, win: 0, draw: 0, loss: 0, pts: 0, gd: 0, gf: 0, ga: 0 };

                    const hs = Number(m.homeScore || 0); const as = Number(m.awayScore || 0);

                    const stageUpper = (m.stage || '').toUpperCase();
                    const isKnockout = ['ROUND_OF', 'SEMI', 'FINAL', 'PO', '34'].some(k => stageUpper.includes(k) || (r.name || '').toUpperCase().includes(k));

                    if (!isKnockout) {
                        teamStats[hTeam].gf += hs; teamStats[hTeam].ga += as; teamStats[hTeam].gd += (hs - as);
                        teamStats[aTeam].gf += as; teamStats[aTeam].ga += hs; teamStats[aTeam].gd += (as - hs);

                        if (hs > as) { teamStats[hTeam].win++; teamStats[hTeam].pts += 3; teamStats[aTeam].loss++; }
                        else if (as > hs) { teamStats[aTeam].win++; teamStats[aTeam].pts += 3; teamStats[hTeam].loss++; }
                        else { teamStats[hTeam].draw++; teamStats[aTeam].draw++; teamStats[hTeam].pts += 1; teamStats[aTeam].pts += 1; }
                    }

                    const processPlayers = (records: any[], teamName: string, ownerName: string, type: 'goals' | 'assists') => {
                        if (!records || !Array.isArray(records)) return;
                        records.forEach(p => {
                            const pName = typeof p === 'string' ? p : p.name;
                            const count = typeof p === 'string' ? 1 : (p.count || 1);
                            if (!pName) return;
                            
                            const pKey = `${pName}-${teamName}`;
                            if (!playerStats[pKey]) playerStats[pKey] = { name: pName, team: teamName, owner: ownerName, goals: 0, assists: 0 };
                            playerStats[pKey][type] += count;
                        });
                    };

                    processPlayers(m.homeScorers, hTeam, m.homeOwner, 'goals');
                    processPlayers(m.awayScorers, aTeam, m.awayOwner, 'goals');
                    processPlayers(m.homeAssists, hTeam, m.homeOwner, 'assists');
                    processPlayers(m.awayAssists, aTeam, m.awayOwner, 'assists');
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

            const topScorer = Object.values(playerStats).sort((a:any, b:any) => b.goals - a.goals)[0]?.owner || '';
            const topAssist = Object.values(playerStats).sort((a:any, b:any) => b.assists - a.assists)[0]?.owner || '';

            const batch = writeBatch(db);
            const prizes = (season as any).prizes || {};

            if (!skipFinance) {
                const addPrize = (legacyOwnerName: string, amount: number, title: string) => {
                    const realUid = getRealUid(legacyOwnerName);
                    if (realUid && amount > 0) {
                        batch.set(doc(ledgerRef), {
                            seasonId: String(season.id), 
                            ownerId: String(realUid),
                            type: 'REVENUE',
                            amount: Number(amount), 
                            title: title, 
                            createdAt: new Date().toISOString()
                        });
                    }
                };

                if (season.type === 'LEAGUE_PLAYOFF' || season.type === 'CUP') {
                    addPrize(grandChampionOwner, prizes.champion, `👑 ${season.name} 최종 우승`);
                    addPrize(firstOwner, prizes.first, `🚩 ${season.name} 리그 1위`);
                    addPrize(secondOwner, prizes.second, `🚩 ${season.name} 리그 2위`);
                    addPrize(thirdOwner, prizes.third, `🚩 ${season.name} 리그 3위`);
                } else {
                    addPrize(firstOwner, prizes.first, `${season.name} 우승 🏆`);
                    addPrize(secondOwner, prizes.second, `${season.name} 준우승 🥈`);
                    addPrize(thirdOwner, prizes.third, `${season.name} 3위 🥉`);
                }

                addPrize(topScorer, prizes.scorer, `${season.name} 득점왕 ⚽`);
                addPrize(topAssist, prizes.assist, `${season.name} 도움왕 🅰️`);
            }

            const historySnapshot = {
                seasonId: season.id,
                seasonName: season.name,
                type: season.type,
                closedAt: new Date().toISOString(),
                teams: Object.values(teamStats).map((t: any) => ({
                    ...t,
                    ownerId: getRealUid(t.owner) || null, 
                    legacyName: t.owner || ''
                })).sort((a:any, b:any) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf),
                players: Object.values(playerStats).map((p: any) => ({
                    ...p,
                    ownerId: getRealUid(p.owner) || null, 
                    legacyName: p.owner || ''
                })).sort((a:any, b:any) => b.goals - a.goals),
                awards: {
                    champion: getRealUid(grandChampionOwner || firstOwner) || null,
                    second: getRealUid(secondOwner) || null,
                    third: getRealUid(thirdOwner) || null,
                    topScorer: getRealUid(topScorer) || null,
                    topAssist: getRealUid(topAssist) || null
                }
            };

            batch.set(doc(db, 'history_records', String(season.id)), historySnapshot);
            batch.update(doc(db, 'seasons', String(season.id)), { status: 'COMPLETED' });

            await batch.commit();
            
            alert(`🎉 [${season.name}] ${skipFinance ? '스냅샷 재생성' : '정산 및 박제'} 완료!`);
            setAdminTab('SEASON_MENU'); 
        } catch (error) {
            console.error("🚨 정산/박제 오류:", error);
            alert("정산 및 스냅샷 생성 중 오류가 발생했습니다.");
        }
    };

    const isSeasonView = typeof adminTab === 'number' || adminTab === 'SEASON_MENU';
    const activeTopTab = isSeasonView ? 'SEASON' : 'SYSTEM';

    // 🚨 픽스: 라운딩(rounded-3xl -> rounded-xl) 및 패딩 축소로 모던한 버튼형태로 개편
    const SystemCard = ({ title, subtitle, icon, color, onClick }: any) => (
        <div 
            onClick={onClick} 
            className={`relative overflow-hidden rounded-xl p-5 cursor-pointer transition-all hover:scale-105 hover:shadow-xl hover:shadow-emerald-900/20 group border border-slate-700/50 bg-gradient-to-br ${color} h-[110px] sm:h-[130px] flex flex-col justify-between`}
        >
            <div className="absolute -right-4 -bottom-4 opacity-20 transform group-hover:scale-125 transition-transform duration-500">
                {icon}
            </div>
            <div className="text-white drop-shadow-md">
                {icon}
            </div>
            <div className="relative z-10">
                <h3 className="text-white font-black text-[15px] sm:text-[17px] drop-shadow-md leading-tight">{title}</h3>
                {subtitle && <p className="text-white/70 text-[9px] sm:text-[10px] font-bold mt-1 tracking-widest uppercase">{subtitle}</p>}
            </div>
        </div>
    );

    return (
        // 🚨 픽스: 외부 라운딩 박스 제거 및 풀블리드(오픈형) 레이아웃 적용
        <div className="w-full animate-in fade-in flex flex-col pb-10">
            
            {/* 타이틀 */}
            <div className="flex justify-between items-center mb-6 px-2 w-full">
                <h2 className="text-[18px] sm:text-[22px] font-black italic text-emerald-400 tracking-widest uppercase">ADMIN DASHBOARD</h2>
            </div>

            {/* 🚨 픽스: 탭 메뉴를 캡슐 박스 형태에서 시원한 언더라인(플랫) 형태로 교체 */}
            <div className="flex gap-4 border-b border-slate-800/60 mb-6 sm:mb-8 w-full px-2">
                <button 
                    onClick={() => setAdminTab('SYSTEM_MENU')}
                    className={`pb-3 pr-2 text-[14px] sm:text-[15px] font-black tracking-widest transition-all relative flex items-center gap-2 ${activeTopTab === 'SYSTEM' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Settings size={18} /> 시스템 관리
                    {activeTopTab === 'SYSTEM' && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-emerald-400" />}
                </button>
                <button 
                    onClick={() => setAdminTab('SEASON_MENU')}
                    className={`pb-3 px-2 text-[14px] sm:text-[15px] font-black tracking-widest transition-all relative flex items-center gap-2 ${activeTopTab === 'SEASON' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Trophy size={18} /> 시즌 관리
                    {activeTopTab === 'SEASON' && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-blue-400" />}
                </button>
            </div>

            {/* 콘텐츠 영역 */}
            <div className="w-full">
                {activeTopTab === 'SYSTEM' && (
                    <>
                        {(adminTab === 'SYSTEM_MENU' || adminTab === 'NEW') ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 animate-in slide-in-from-bottom-4 px-1">
                                <SystemCard title="시즌 생성" subtitle="Create Season" icon={<PlusCircle size={32}/>} color="from-emerald-500 to-teal-800" onClick={() => setAdminTab('CREATE_SEASON')} />
                                <SystemCard title="가입 승인" subtitle="User Approval" icon={<UserCheck size={32}/>} color="from-blue-500 to-indigo-800" onClick={() => setAdminTab('USERS')} />
                                <SystemCard title="공지 관리" subtitle="Notice Board" icon={<Megaphone size={32}/>} color="from-purple-500 to-fuchsia-800" onClick={() => setAdminTab('NOTICE')} />
                                <SystemCard title="리그 관리" subtitle="League Setup" icon={<Flag size={32}/>} color="from-cyan-500 to-blue-800" onClick={() => setAdminTab('LEAGUES')} />
                                <SystemCard title="팀 DB 관리" subtitle="Team Setup" icon={<Shield size={32}/>} color="from-red-500 to-rose-800" onClick={() => setAdminTab('TEAMS')} />
                                <SystemCard title="오너 명부" subtitle="Owner Roster" icon={<Crown size={32}/>} color="from-orange-500 to-amber-800" onClick={() => setAdminTab('OWNER')} />
                                <SystemCard title="배너 관리" subtitle="Main Banners" icon={<ImageIcon size={32}/>} color="from-pink-500 to-rose-700" onClick={() => setAdminTab('BANNER')} />
                                <SystemCard title="실축 데이터" subtitle="Real-World Data" icon={<Globe size={32}/>} color="from-yellow-500 to-orange-700" onClick={() => setAdminTab('REAL')} />
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in slide-in-from-right-4 w-full">
                                {/* 🚨 픽스: 뒤로 가기 버튼 영역을 답답하지 않게 트임 처리 */}
                                <div className="mb-4 pb-4 border-b border-slate-800/60 px-2 w-full">
                                    <button onClick={() => setAdminTab('SYSTEM_MENU')} className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors font-bold text-[11px] sm:text-[12px] bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 shadow-inner w-max">
                                        <ArrowLeft size={14} /> <span>시스템 메뉴로 돌아가기</span>
                                    </button>
                                </div>
                                
                                {adminTab === 'CREATE_SEASON' && <AdminSeasonCreate onCreateSuccess={(id) => setAdminTab(id)} />}
                                {adminTab === 'USERS' && <AdminUserTracker owners={owners} />}
                                {adminTab === 'NOTICE' && <AdminNoticeManager />}
                                {adminTab === 'LEAGUES' && <AdminLeagueManager leagues={leagues} masterTeams={masterTeams} />}
                                
                                {adminTab === 'TEAMS' && <AdminTeamManager leagues={leagues} masterTeams={masterTeams} owners={owners} />}
                                
                                {adminTab === 'BANNER' && <AdminBannerManager banners={banners} />}
                                {adminTab === 'OWNER' && <AdminOwnerManager owners={owners} />}
                                {adminTab === 'REAL' && <AdminRealWorldManager leagues={leagues} masterTeams={masterTeams} />}
                            </div>
                        )}
                    </>
                )}

                {activeTopTab === 'SEASON' && (
                    <>
                        {adminTab === 'SEASON_MENU' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-bottom-4 px-1">
                                {seasons.slice().sort((a, b) => b.id - a.id).map(s => {
                                    const isCompleted = s.status === 'COMPLETED';
                                    return (
                                        // 🚨 픽스: 시즌 카드의 라운딩 축소 (3xl -> xl) 및 보더/배경 스타일 톤다운
                                        <div 
                                            key={s.id} 
                                            onClick={() => setAdminTab(s.id)} 
                                            className={`p-5 rounded-xl cursor-pointer transition-all hover:-translate-y-1 shadow-md group border ${isCompleted ? 'bg-slate-900/50 border-slate-800 hover:border-slate-600' : 'bg-slate-900 border-slate-800 hover:border-blue-500/50 hover:bg-slate-800'}`}
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <span className="text-2xl sm:text-3xl bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80 shadow-inner group-hover:scale-110 transition-transform">
                                                    {s.type === 'CUP' ? '🏆' : s.type === 'TOURNAMENT' ? '⚔️' : s.type === 'LEAGUE_PLAYOFF' ? '⭐' : '🏳️'}
                                                </span>
                                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest shadow-sm ${isCompleted ? 'bg-slate-900 text-slate-500 border border-slate-800' : 'bg-emerald-950/30 text-emerald-400 border border-emerald-500/20'}`}>
                                                    {isCompleted ? '마감됨' : '진행중'}
                                                </span>
                                            </div>
                                            <h3 className={`font-black text-[16px] sm:text-[18px] leading-tight mb-2 transition-colors line-clamp-2 ${isCompleted ? 'text-slate-400 group-hover:text-slate-200' : 'text-white group-hover:text-blue-400'}`}>
                                                {s.name}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-3 text-[11px] font-bold text-slate-500">
                                                <span className="bg-slate-950/80 px-2 py-1 rounded border border-slate-800/50">
                                                    {s.type}
                                                </span>
                                                <span>• 참가 {s.teams?.length || 0}팀</span>
                                            </div>
                                        </div>
                                    )
                                })}
                                {seasons.length === 0 && (
                                    <div className="col-span-full py-16 text-center text-slate-500 font-bold bg-slate-900 rounded-2xl border border-slate-800 border-dashed">
                                        생성된 시즌이 없습니다.<br/>시스템 관리에서 새로운 시즌을 생성해보세요!
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in slide-in-from-right-4 w-full">
                                {(() => {
                                    const targetSeason = seasons.find(s => s.id === adminTab);
                                    if (!targetSeason) return <div className="text-center text-red-400 py-10">시즌 정보를 찾을 수 없습니다.</div>;
                                    return (
                                        <>
                                            {/* 🚨 픽스: 관리자 세부 화면 상단 헤더 박스 해체 (오픈형) */}
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-800/60 pb-5 w-full px-2">
                                                <button onClick={() => setAdminTab('SEASON_MENU')} className="flex items-center gap-1.5 text-slate-400 hover:text-blue-400 transition-colors font-bold text-[11px] sm:text-[12px] bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 shadow-inner w-max shrink-0">
                                                    <ArrowLeft size={14} /> <span>시즌 목록으로 돌아가기</span>
                                                </button>
                                                <div className="flex flex-col items-center flex-1 justify-center min-w-0">
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Manage Season</span>
                                                    <h2 className="text-[16px] md:text-[18px] font-black text-blue-400 truncate w-full text-center">
                                                        {targetSeason.name} 
                                                        {targetSeason.status === 'COMPLETED' && <span className="text-[10px] text-yellow-500 ml-2 border border-yellow-500/50 bg-yellow-950/30 px-2 py-0.5 rounded uppercase tracking-widest align-middle">Closed</span>}
                                                    </h2>
                                                </div>
                                                <div className="flex items-center justify-end gap-2 shrink-0">
                                                    <button onClick={() => handleCloseSeason(targetSeason)} className={`${targetSeason.status === 'COMPLETED' ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-yellow-600 hover:bg-yellow-500 text-white shadow-[0_0_15px_rgba(202,138,4,0.3)]'} px-3 py-2 rounded-lg text-[11px] sm:text-xs font-black transition-all flex items-center gap-1.5`}>
                                                        {targetSeason.status === 'COMPLETED' ? <><DatabaseBackup size={14}/> 스냅샷 재생성</> : <>💰 마감/정산/박제</>}
                                                    </button>
                                                    <button onClick={() => handleDeleteSeason(targetSeason.id)} className="bg-slate-900 hover:bg-red-900/50 border border-slate-700 hover:border-red-500 px-3 py-2 rounded-lg text-[11px] sm:text-xs font-bold text-red-400 hover:text-white transition-all flex items-center gap-1.5">
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
        </div>
    );
};