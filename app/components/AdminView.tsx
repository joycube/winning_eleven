"use client";

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { deleteDoc, doc, updateDoc, collection, writeBatch, query, where, getDocs, setDoc, getDoc } from 'firebase/firestore'; // 🔥 getDoc 추가
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

    // ==========================================
    // 🔥 [버그 픽스] 과거 하이라이트 일괄 동기화 마법 버튼 (안전성 강화버전)
    // ==========================================
    const handleSyncPastHighlights = async () => {
        if (!confirm("과거 시즌의 모든 유튜브 영상을 하이라이트 전용 게시판으로 일괄 동기화하시겠습니까?\n(기존 데이터는 보존되며, 없는 데이터만 추가됩니다.)")) return;
        
        try {
            let count = 0;
            const seasonsSnap = await getDocs(collection(db, "seasons"));
            
            // 🔥 Batch 대신 에러 추적이 쉬운 개별 setDoc + for...of 비동기 루프 사용
            for (const seasonDoc of seasonsSnap.docs) {
                const seasonData = seasonDoc.data();
                const rounds = seasonData.rounds || [];
                
                for (const r of rounds) {
                    const matches = r.matches || [];
                    for (const m of matches) {
                        // 💡 m.id가 확실히 존재하고 유튜브 링크가 있을 때만 실행 (에러 방어)
                        if (m.id && m.youtubeUrl && m.youtubeUrl.trim() !== '') {
                            const highlightRef = doc(db, "highlights", m.id);
                            
                            // 💡 기존 데이터가 있는지 확인 (없으면 초기값 세팅을 위해)
                            const docSnap = await getDoc(highlightRef);

                            await setDoc(highlightRef, {
                                id: m.id,
                                matchId: m.id,
                                seasonId: seasonData.id,
                                seasonName: seasonData.name,
                                youtubeUrl: m.youtubeUrl,
                                homeTeam: m.home || 'TBD',
                                awayTeam: m.away || 'TBD',
                                homeLogo: m.homeLogo || '',
                                awayLogo: m.awayLogo || '',
                                homeScore: m.homeScore || 0,
                                awayScore: m.awayScore || 0,
                                matchLabel: m.matchLabel || m.stage || '',
                                createdAt: seasonData.id, // 과거 영상은 해당 시즌 생성 시점으로 처리
                                // 🔥 문서가 없었을 때만 조회수, 좋아요, 댓글 0으로 셋팅
                                ...(docSnap.exists() ? {} : { views: 0, likes: [], commentCount: 0 })
                            }, { merge: true }); 
                            
                            count++;
                        }
                    }
                }
            }
            
            alert(`🎉 총 ${count}개의 과거 하이라이트 영상이 성공적으로 동기화되었습니다!`);
        } catch (error: any) {
            console.error("🚨 하이라이트 동기화 오류:", error);
            // 🔥 무슨 에러인지 화면에 직접 띄워줍니다 (권한 문제인지, 데이터 문제인지 파악용)
            alert(`동기화 중 오류가 발생했습니다.\n상세 에러: ${error.message}`); 
        }
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
            
            {/* 🔥 상단 메뉴에 DB 동기화용 미니 버튼 추가 */}
            <div className="flex justify-between items-center mb-4 px-2">
                <h2 className="text-xl font-black italic text-emerald-400 tracking-tighter">ADMIN DASHBOARD</h2>
                {activeTopTab === 'SYSTEM' && (
                    <button 
                        onClick={handleSyncPastHighlights}
                        className="bg-indigo-900/50 hover:bg-indigo-600 border border-indigo-700/50 text-indigo-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                        <PlaySquare size={14} /> 하이라이트 동기화
                    </button>
                )}
            </div>

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
                            
                            {/* 🔥 [핵심 수술 포인트] 여기에 owners={owners} 를 추가했습니다!!! */}
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
                                                <button onClick={() => handleCloseSeason(targetSeason)} className={`${targetSeason.status === 'COMPLETED' ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-yellow-600 hover:bg-yellow-500 text-white shadow-[0_0_15px_rgba(202,138,4,0.3)]'} px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5`}>
                                                    {targetSeason.status === 'COMPLETED' ? <><DatabaseBackup size={14}/> 스냅샷 재생성</> : <>💰 마감/정산/박제</>}
                                                </button>
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