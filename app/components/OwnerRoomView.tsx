"use client";
import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ShieldCheck, User, CheckCircle2, TrendingUp, Trophy, Coins, Activity, Clock, Swords, Flame, Skull, Crosshair, Settings, Users, Sparkles } from 'lucide-react';
import { FALLBACK_IMG } from '../types';

export default function OwnerRoomView({ user, masterTeams, historyData, seasons, owners }: any) {
    const [isEditing, setIsEditing] = useState(false);
    const [editPhoto, setEditPhoto] = useState('');
    const [editCategory, setEditCategory] = useState<'CLUB'|'NATIONAL'>('CLUB'); 
    const [editRegion, setEditRegion] = useState(''); 
    const [editTeamId, setEditTeamId] = useState(''); 
    const [isSaving, setIsSaving] = useState(false);

    const [playerTab, setPlayerTab] = useState<'GOAL' | 'ASSIST'>('GOAL');
    const [h2hFilter, setH2HFilter] = useState<'TEAM' | 'OWNER'>('TEAM');

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center animate-in fade-in zoom-in-95 mt-10">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-5 shadow-lg border border-slate-700">
                    <User size={32} className="text-slate-400" />
                </div>
                <h2 className="text-xl font-black text-white italic mb-2 tracking-tighter">구단주 로그인이 필요합니다</h2>
                <p className="text-slate-400 text-xs font-medium">우측 상단의 로그인 버튼을 눌러 계정을 연결해주세요.</p>
            </div>
        );
    }

    const isMapped = !!user.mappedOwnerId;

    if (!isMapped) {
        return (
            <div className="max-w-md mx-auto mt-10 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-5 text-center">
                <div className="flex justify-center mb-5 relative">
                    <Clock size={50} className="text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] animate-pulse" />
                    <div className="absolute top-0 right-1/3 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900"></div>
                </div>
                <h2 className="text-2xl font-black text-white italic tracking-tighter mb-2">라이선스 발급 대기 중</h2>
                <p className="text-slate-400 text-[11px] mb-8 leading-relaxed px-4">
                    현재 접속 중인 계정의 보안 승인 절차가 진행 중입니다.<br/>
                    리그 관리자가 <strong className="text-yellow-500">구단주 명부 연동</strong>을 완료하면<br/>자동으로 구단주실이 오픈됩니다.
                </p>

                <div className="bg-[#0B1120] p-4 rounded-xl border border-slate-800 flex items-center justify-center gap-3 shadow-inner">
                    <img src={user.photoURL} alt="profile" className="w-11 h-11 rounded-full border border-slate-700 shadow-sm" />
                    <div className="flex flex-col text-left">
                        <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-0.5">대기 중인 계정</span>
                        <span className="text-sm font-black text-white truncate max-w-[180px]">{user.displayName || user.email}</span>
                    </div>
                </div>
            </div>
        );
    }

    const myTeam = masterTeams?.find((m:any) => m.ownerName === user.mappedOwnerId);
    const myHistory = historyData?.owners?.find((o:any) => o.name === user.mappedOwnerId);
    const myOwnerData = owners?.find((o:any) => o.nickname === user.mappedOwnerId);
    const profileImage = user.photo || myOwnerData?.photo || myTeam?.logo || user.photoURL || FALLBACK_IMG;

    const points = myHistory?.points || 0;
    const wins = myHistory?.win || 0;
    const draws = myHistory?.draw || 0;
    const losses = myHistory?.loss || 0;
    const totalGames = wins + draws + losses;
    const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : "0.0";
    const prizeMoney = myHistory?.prize || 0;

    const getTierBadgeColor = (tier?: string) => {
        const t = (tier || 'C').toUpperCase();
        return t === 'S' ? 'bg-purple-600 text-white border-purple-400' 
             : t === 'A' ? 'bg-emerald-600 text-white border-emerald-400' 
             : t === 'B' ? 'bg-blue-600 text-white border-blue-400' 
             : t === 'C' ? 'bg-slate-600 text-white border-slate-400'
             : t === 'D' ? 'bg-orange-700 text-white border-orange-500'
             : 'bg-slate-800 text-slate-400 border-slate-700';
    };

    const getMyMatches = () => {
        let ownerMatches: any[] = [];
        seasons?.forEach((s: any) => {
            s.rounds?.forEach((r: any) => {
                r.matches?.forEach((m: any) => {
                    const isMyMatch = m.homeOwner === user.mappedOwnerId || m.awayOwner === user.mappedOwnerId;
                    const isNotBye = m.home !== 'BYE' && m.away !== 'BYE' && !m.home?.includes('부전승') && !m.away?.includes('부전승');
                    
                    if (m.status === 'COMPLETED' && isMyMatch && isNotBye) {
                        ownerMatches.push(m);
                    }
                });
            });
        });
        return ownerMatches;
    };

    const myMatches = getMyMatches();

    let gf = 0; let ga = 0;
    myMatches.forEach(m => {
        const isHome = m.homeOwner === user.mappedOwnerId;
        gf += isHome ? Number(m.homeScore || 0) : Number(m.awayScore || 0);
        ga += isHome ? Number(m.awayScore || 0) : Number(m.homeScore || 0);
    });
    const avgGF = myMatches.length > 0 ? (gf / myMatches.length) : 0;
    const avgGA = myMatches.length > 0 ? (ga / myMatches.length) : 0;

    let playStyle = { label: '뉴비 구단주', color: 'text-slate-400', border: 'border-slate-500' };
    if (myMatches.length >= 3) {
        if (avgGF >= 2.5) playStyle = { label: '닥공 폭격기 🚀', color: 'text-red-400', border: 'border-red-500' };
        else if (avgGA <= 0.8) playStyle = { label: '통곡의 벽 🛡️', color: 'text-emerald-400', border: 'border-emerald-500' };
        else if (avgGF >= 1.5 && avgGA <= 1.2) playStyle = { label: '육각형 마스터 💎', color: 'text-purple-400', border: 'border-purple-500' };
        else if (avgGA >= 2.0) playStyle = { label: '낭만 축구 🔥', color: 'text-orange-400', border: 'border-orange-500' };
        else playStyle = { label: '밸런스 조율사 ⚖️', color: 'text-blue-400', border: 'border-blue-500' };
    }

    const getTrophies = () => {
        let gold = 0; let silver = 0;
        myMatches.forEach(m => {
            if (m.stage === 'FINAL' || m.matchLabel === 'Final') {
                const isHome = m.homeOwner === user.mappedOwnerId;
                const hScore = Number(m.homeScore || 0);
                const aScore = Number(m.awayScore || 0);
                if (isHome) { hScore > aScore ? gold++ : silver++; } 
                else { aScore > hScore ? gold++ : silver++; }
            }
        });
        return { gold, silver };
    };
    const trophies = getTrophies();

    const getH2HStats = () => {
        const stats: Record<string, { name: string, logo: string, tier?: string, w: number, d: number, l: number, total: number }> = {};
        
        myMatches.forEach(m => {
            const isHome = m.homeOwner === user.mappedOwnerId;
            const targetName = isHome ? (h2hFilter === 'TEAM' ? m.away : m.awayOwner) : (h2hFilter === 'TEAM' ? m.home : m.homeOwner);
            
            if (!targetName || targetName === 'SYSTEM' || targetName === 'CPU') return;

            let logo = FALLBACK_IMG;
            let tier = 'C';

            if (h2hFilter === 'TEAM') {
                const opTeamData = masterTeams?.find((t:any) => t.name === targetName);
                logo = opTeamData?.logo || FALLBACK_IMG;
                tier = opTeamData?.tier || 'C';
            } else {
                const opOwnerData = owners?.find((o:any) => o.nickname === targetName);
                logo = opOwnerData?.photo || FALLBACK_IMG;
                tier = 'O'; 
            }

            if (!stats[targetName]) {
                stats[targetName] = { name: targetName, logo, tier, w: 0, d: 0, l: 0, total: 0 };
            }
            
            const myScore = isHome ? Number(m.homeScore || 0) : Number(m.awayScore || 0);
            const opScore = isHome ? Number(m.awayScore || 0) : Number(m.homeScore || 0);
            
            stats[targetName].total += 1;
            if (myScore > opScore) stats[targetName].w += 1;
            else if (myScore < opScore) stats[targetName].l += 1;
            else stats[targetName].d += 1;
        });

        const statArray = Object.values(stats).filter(s => s.total > 0);
        const mostWins = [...statArray].sort((a, b) => b.w - a.w || (b.w/b.total) - (a.w/a.total))[0];
        const mostLosses = [...statArray].sort((a, b) => b.l - a.l || (b.l/b.total) - (a.l/a.total))[0];
        const rival = [...statArray].filter(s => s.total >= 2).sort((a, b) => b.d - a.d || b.total - a.total)[0];

        return { mostWins, mostLosses, rival };
    };

    const { mostWins, mostLosses, rival } = getH2HStats();

    const getMyBestStats = () => {
        const teamStats: Record<string, any> = {};
        const playerGoals: Record<string, any> = {};
        const playerAssists: Record<string, any> = {};

        myMatches.forEach(m => {
            const isHome = m.homeOwner === user.mappedOwnerId;
            const myTeamName = isHome ? m.home : m.away;
            const myScore = isHome ? Number(m.homeScore || 0) : Number(m.awayScore || 0);
            const opScore = isHome ? Number(m.awayScore || 0) : Number(m.homeScore || 0);

            if (!teamStats[myTeamName]) {
                const teamData = masterTeams?.find((t:any) => t.name === myTeamName);
                teamStats[myTeamName] = { 
                    name: myTeamName, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, 
                    logo: teamData?.logo || FALLBACK_IMG, tier: teamData?.tier || 'C' 
                };
            }
            teamStats[myTeamName].gf += myScore;
            teamStats[myTeamName].ga += opScore;
            if (myScore > opScore) { teamStats[myTeamName].w++; teamStats[myTeamName].pts += 3; }
            else if (myScore === opScore) { teamStats[myTeamName].d++; teamStats[myTeamName].pts += 1; }
            else { teamStats[myTeamName].l++; }

            const scorers = isHome ? (m.homeScorers || []) : (m.awayScorers || []);
            const assists = isHome ? (m.homeAssists || []) : (m.awayAssists || []);

            scorers.forEach((p: any) => {
                const pName = (p && typeof p === 'object') ? (p.name || 'Unknown') : p;
                if (!pName) return;
                if(!playerGoals[pName]) playerGoals[pName] = { name: pName, count: 0, team: myTeamName, logo: teamStats[myTeamName].logo };
                playerGoals[pName].count++;
            });
            assists.forEach((p: any) => {
                const pName = (p && typeof p === 'object') ? (p.name || 'Unknown') : p;
                if (!pName) return;
                if(!playerAssists[pName]) playerAssists[pName] = { name: pName, count: 0, team: myTeamName, logo: teamStats[myTeamName].logo };
                playerAssists[pName].count++;
            });
        });

        Object.values(teamStats).forEach((t: any) => {
            t.gd = t.gf - t.ga;
            t.winRate = (t.w + t.d + t.l) > 0 ? ((t.w / (t.w + t.d + t.l)) * 100).toFixed(1) : '0.0';
        });

        return {
            topTeams: Object.values(teamStats).sort((a:any, b:any) => b.pts - a.pts || b.gd - a.gd).slice(0, 5),
            topScorers: Object.values(playerGoals).sort((a:any, b:any) => b.count - a.count).slice(0, 5),
            topAssists: Object.values(playerAssists).sort((a:any, b:any) => b.count - a.count).slice(0, 5)
        };
    };

    const { topTeams, topScorers, topAssists } = getMyBestStats();

    const availableTeams = masterTeams?.filter((t:any) => !t.ownerName || t.ownerName === user.mappedOwnerId) || [];
    const uniqueRegions = Array.from(new Set(
        availableTeams.filter((t:any) => (t.category || 'CLUB') === editCategory).map((t:any) => t.region).filter(Boolean)
    )).sort() as string[];
    const filteredTeamsForDropdown = availableTeams.filter((t:any) => (t.category || 'CLUB') === editCategory && t.region === editRegion).sort((a:any, b:any) => a.name.localeCompare(b.name));

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            const targetOwnerDocId = myOwnerData?.docId || myOwnerData?.id;
            if (targetOwnerDocId) await updateDoc(doc(db, 'users', String(targetOwnerDocId)), { photo: editPhoto });
            const oldTeamId = myTeam?.docId || myTeam?.id;
            if (String(editTeamId) !== String(oldTeamId)) {
                if (oldTeamId) await updateDoc(doc(db, 'master_teams', String(oldTeamId)), { ownerName: '' });
                if (editTeamId) await updateDoc(doc(db, 'master_teams', String(editTeamId)), { ownerName: user.mappedOwnerId });
            }
            alert('✅ 설정이 성공적으로 저장되었습니다!');
            setIsEditing(false);
        } catch (e: any) {
            console.error(e);
            alert(`설정 저장 중 오류가 발생했습니다: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const openEditModal = () => {
        setEditPhoto(user.photo || myOwnerData?.photo || '');
        setEditCategory(myTeam?.category || 'CLUB'); 
        setEditRegion(myTeam?.region || '');
        setEditTeamId(myTeam?.docId || myTeam?.id || '');
        setIsEditing(true);
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-10 mt-4 relative text-left">
            
            <div className="bg-[#050609] border border-slate-700/50 rounded-3xl p-6 sm:p-9 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-[url('/img/metal_pattern.png')] opacity-10 pointer-events-none"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-[#0B1120] to-black pointer-events-none"></div>
                
                <div className="absolute -left-10 -top-10 w-60 h-60 bg-emerald-600/20 rounded-full blur-[80px] pointer-events-none group-hover:scale-110 transition-transform duration-700"></div>
                <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none"></div>

                <div className="absolute top-4 right-5 sm:top-7 sm:right-9 flex gap-1.5 z-20 pointer-events-none">
                    {Array.from({length: trophies.gold}).map((_, i) => <Trophy key={`g-${i}`} size={22} className="text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.7)]" />)}
                    {Array.from({length: trophies.silver}).map((_, i) => <Trophy key={`s-${i}`} size={20} className="text-slate-300 drop-shadow-[0_0_8px_rgba(203,213,225,0.5)] mt-0.5" />)}
                    {trophies.gold === 0 && trophies.silver === 0 && <div className="text-[10px] text-slate-700 font-bold italic tracking-wider">NO TROPHIES YET</div>}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-6 relative z-10">
                    <div className="relative shrink-0 flex justify-center">
                        <div className="relative">
                            <div className="absolute inset-0 rounded-full blur-md bg-emerald-500/30 scale-105 group-hover:bg-emerald-500/50 transition-colors"></div>
                            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-b from-slate-700 via-white to-slate-700 p-0.5 shadow-2xl overflow-hidden flex items-center justify-center relative z-10">
                                <div className="w-full h-full rounded-full bg-[#050b14] p-1 flex items-center justify-center overflow-hidden">
                                    <img src={profileImage} alt="logo" className="w-full h-full object-cover rounded-full" />
                                    <div className="absolute top-0 left-0 w-full h-[45%] bg-gradient-to-b from-white/20 to-transparent rounded-t-full"></div>
                                </div>
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-1.5 sm:p-2 rounded-full border-2 border-[#0B1120] shadow-xl z-20">
                                <CheckCircle2 size={16} className="stroke-[3.5]" />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col min-w-0 flex-1 pt-1">
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-2.5">
                            <span className="flex items-center gap-1.5 text-emerald-300 font-black text-[11px] tracking-[0.15em] uppercase bg-emerald-950/70 px-3 py-1.5 rounded-lg border border-emerald-500/30 shadow-[0_0_10px_rgba(52,211,153,0.2)]">
                                <ShieldCheck size={14} className="text-emerald-400"/> VERIFIED OWNER
                            </span>
                            <span className={`px-3 py-1.5 text-[10px] font-black rounded-lg border shadow-[0_0_10px_rgba(0,0,0,0.3)] flex items-center gap-1 bg-[#0f172a] ${playStyle.color} ${playStyle.border}`}>
                                <Sparkles size={12}/> {playStyle.label}
                            </span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-black text-white italic tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] overflow-visible text-center sm:text-left break-all pr-0 sm:pr-10">
                            {user.mappedOwnerId}
                        </h2>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start mt-2 gap-x-2 gap-y-1.5">
                            <p className="text-slate-300 text-sm sm:text-base font-bold break-keep">{myTeam?.name || '소속 구단 없음'}</p>
                            {myTeam && <span className={`px-2 py-1 rounded text-[11px] font-black border shadow-[0_2px_5px_rgba(0,0,0,0.3)] ${getTierBadgeColor(myTeam.tier)}`}>{myTeam.tier} Tier</span>}
                        </div>
                    </div>

                    <button onClick={openEditModal} className="absolute bottom-4 right-5 sm:bottom-6 sm:right-8 flex items-center gap-1.5 text-[10px] sm:text-xs font-black text-slate-500 hover:text-white bg-black/40 hover:bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-800 hover:border-slate-700 transition-all shadow-inner z-20">
                        <Settings size={13} /> <span>EDIT</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-center shadow-lg relative overflow-hidden text-left">
                    <div className="absolute -right-4 -bottom-4 opacity-5"><Trophy size={80} /></div>
                    <span className="flex items-center gap-1.5 text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1 sm:mb-2 relative z-10"><Trophy size={12} className="text-yellow-500" /> 통산 승점</span>
                    <span className="text-2xl sm:text-3xl font-black text-white italic relative z-10">{points} <span className="text-xs sm:text-sm text-slate-500 not-italic font-medium">pts</span></span>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-center shadow-lg relative overflow-hidden text-left">
                    <div className="absolute -right-4 -bottom-4 opacity-5"><Activity size={80} /></div>
                    <span className="flex items-center gap-1.5 text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1 sm:mb-2 relative z-10"><Activity size={12} className="text-blue-400" /> 통산 전적</span>
                    <span className="text-lg sm:text-2xl font-black text-slate-200 italic tracking-tight relative z-10"><span className="text-emerald-400">{wins}W</span> - {draws}D - <span className="text-red-400">{losses}L</span></span>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-center shadow-lg relative overflow-hidden text-left">
                    <div className="absolute -right-4 -bottom-4 opacity-5"><TrendingUp size={80} /></div>
                    <span className="flex items-center gap-1.5 text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1 sm:mb-2 relative z-10"><TrendingUp size={12} className="text-emerald-400" /> 통산 승률</span>
                    <span className="text-2xl sm:text-3xl font-black text-white italic relative z-10">{winRate} <span className="text-xs sm:text-sm text-slate-500 not-italic font-medium">%</span></span>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-center shadow-lg relative overflow-hidden text-left">
                    <div className="absolute -right-4 -bottom-4 opacity-5"><Coins size={80} /></div>
                    <span className="flex items-center gap-1.5 text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1 sm:mb-2 relative z-10"><Coins size={12} className="text-yellow-400" /> 누적 상금</span>
                    <span className="text-lg sm:text-2xl font-black text-white italic relative z-10">₩ {prizeMoney.toLocaleString()}</span>
                </div>
            </div>

            <div className="pt-2">
                <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                        <Swords size={18} className="text-emerald-400" />
                        <h3 className="text-[13px] sm:text-[15px] font-black text-white italic tracking-widest uppercase">상성 분석기</h3>
                    </div>
                    <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800 shadow-inner">
                        <button onClick={() => setH2HFilter('TEAM')} className={`px-3 py-1.5 text-[10px] font-black rounded-md transition-all flex items-center gap-1 ${h2hFilter === 'TEAM' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}><ShieldCheck size={12}/> 구단 기준</button>
                        <button onClick={() => setH2HFilter('OWNER')} className={`px-3 py-1.5 text-[10px] font-black rounded-md transition-all flex items-center gap-1 ${h2hFilter === 'OWNER' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}><Users size={12}/> 구단주 기준</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { title: 'FAVORITE', sub: '나의 맛집', data: mostWins, icon: <Flame size={14}/>, color: 'text-emerald-400', label: (d:any) => `전적 ${d.w}승 ${d.d}무 ${d.l}패 | 승률 ${((d.w/d.total)*100).toFixed(0)}%` },
                        { title: 'NEMESIS', sub: '나의 천적', data: mostLosses, icon: <Skull size={14}/>, color: 'text-red-400', label: (d:any) => `전적 ${d.w}승 ${d.d}무 ${d.l}패 | 패배율 ${((d.l/d.total)*100).toFixed(0)}%` },
                        { title: 'RIVALRY', sub: '영원의 라이벌', data: rival, icon: <Crosshair size={14}/>, color: 'text-purple-400', label: (d:any) => `전적 ${d.w}승 ${d.d}무 ${d.l}패 | ${d.total}번의 혈투` }
                    ].map((card, i) => (
                        <div key={i} className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden flex flex-col justify-center text-left transition-all duration-300 hover:border-slate-600 shadow-sm hover:shadow-xl">
                            <div className="absolute -right-2 -bottom-2 opacity-5 scale-150">{card.icon}</div>
                            <h3 className={`text-[11px] font-black ${card.color} uppercase tracking-widest mb-4 flex items-center gap-1.5`}>{card.icon} {card.title} <span className="text-slate-500 ml-1 text-[9px]">{card.sub}</span></h3>
                            {card.data ? (
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="relative shrink-0">
                                        <div className={`w-14 h-14 rounded-full flex items-center justify-center overflow-hidden ${h2hFilter === 'OWNER' ? 'border border-slate-700 bg-slate-900' : 'bg-white p-1 shadow-md'}`}>
                                            <img src={card.data.logo} className={`w-full h-full ${h2hFilter === 'OWNER' ? 'object-cover' : 'object-contain'}`} alt="logo" />
                                        </div>
                                        <div className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 text-[8px] font-black rounded border shadow-sm ${h2hFilter === 'OWNER' ? 'bg-slate-800 text-white border-slate-600' : getTierBadgeColor(card.data.tier)}`}>
                                            {h2hFilter === 'OWNER' ? 'O' : card.data.tier}
                                        </div>
                                    </div>
                                    <div className="flex flex-col min-w-0 pr-10 overflow-visible">
                                        <span className="text-base font-black text-white italic leading-tight whitespace-nowrap">{card.data.name}</span>
                                        <span className="text-[10px] font-bold text-slate-400 mt-1 whitespace-nowrap">{card.label(card.data)}</span>
                                    </div>
                                </div>
                            ) : <div className="text-xs text-slate-600 font-bold italic py-2">기록 부족</div>}
                        </div>
                    ))}
                </div>
            </div>

            {/* 4. 베스트 팀 & 플레이어 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                
                {/* --- 4-1. MY BEST TEAMS --- */}
                <div className="bg-[#050b14] border border-slate-800 rounded-3xl overflow-hidden shadow-lg flex flex-col">
                    {/* 🔥 헤더 높이를 우측 탭 메뉴와 똑같이 맞춤 (py-4, border-b-2 흉내) */}
                    <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/50">
                        <div className="py-4 px-5 flex items-center gap-2 w-full border-b-2 border-transparent">
                            <div className="w-1.5 h-5 bg-blue-500 rounded-full"></div>
                            <h3 className="text-base font-black text-white italic tracking-tighter uppercase text-left leading-none">MY BEST TEAMS</h3>
                        </div>
                    </div>
                    
                    <div className="p-4 flex-1 space-y-2">
                        {topTeams.length > 0 ? (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center text-[10px] font-bold text-slate-500 uppercase px-3 mb-1 text-left">
                                    <div className="w-8 text-center">#</div>
                                    <div className="flex-1 ml-4">CLUB</div>
                                    <div className="flex w-[120px] justify-between text-center pl-2">
                                        <span className="w-6">W</span><span className="w-6">D</span><span className="w-6">L</span>
                                        <span className="w-8 text-emerald-400">PTS</span>
                                    </div>
                                </div>
                                
                                {/* 🔥 p-3.5 로 통일, 높이 min-h-[64px] 강제 고정 */}
                                {topTeams.map((team:any, idx:number) => (
                                    <div key={idx} className="flex items-center bg-slate-900/40 border border-slate-800/60 rounded-2xl p-3.5 hover:bg-slate-800/60 transition-all text-left min-h-[64px]">
                                        <div className={`w-8 text-center text-sm font-black italic ${idx < 3 ? 'text-yellow-400' : 'text-slate-600'}`}>
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 flex items-center gap-4 ml-4 min-w-0 pr-10 overflow-visible">
                                            <div className="relative shrink-0">
                                                <div className="w-10 h-10 bg-white rounded-full p-1 flex items-center justify-center shadow-md">
                                                    <img src={team.logo} alt="logo" className="w-full h-full object-contain" />
                                                </div>
                                                <div className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 text-[7px] font-black rounded border ${getTierBadgeColor(team.tier)}`}>
                                                    {team.tier}
                                                </div>
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-black text-white italic leading-tight whitespace-nowrap pr-2">{team.name}</span>
                                                <span className="text-[9px] text-slate-500 font-bold mt-1 uppercase tracking-wider">WIN RATE {team.winRate}%</span>
                                            </div>
                                        </div>
                                        <div className="flex w-[120px] justify-between text-center text-[10px] font-bold pl-2 items-center">
                                            <span className="w-6 text-slate-400">{team.w}W</span>
                                            <span className="w-6 text-slate-400">{team.d}D</span>
                                            <span className="w-6 text-slate-400">{team.l}L</span>
                                            <span className="w-8 text-emerald-400 font-black text-xs">{team.pts}P</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center py-10 text-center text-slate-500 text-xs font-bold italic">진행된 경기 기록이 없습니다.</div>
                        )}
                    </div>
                </div>

                {/* --- 4-2. MY BEST PLAYERS --- */}
                <div className="bg-[#0B1120] border border-slate-800 rounded-3xl overflow-hidden shadow-lg flex flex-col">
                    <div className="flex border-b border-slate-800">
                        <button onClick={() => setPlayerTab('GOAL')} className={`flex-1 py-4 flex justify-center items-center gap-1.5 text-xs font-black tracking-widest transition-all leading-none ${playerTab === 'GOAL' ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-400' : 'bg-slate-950 text-slate-500 hover:text-slate-300 border-b-2 border-transparent'}`}>⚽ TOP SCORERS</button>
                        <button onClick={() => setPlayerTab('ASSIST')} className={`flex-1 py-4 flex justify-center items-center gap-1.5 text-xs font-black tracking-widest transition-all leading-none ${playerTab === 'ASSIST' ? 'bg-slate-900 text-red-400 border-b-2 border-red-400' : 'bg-slate-950 text-slate-500 hover:text-slate-300 border-b-2 border-transparent'}`}>🅰️ TOP ASSISTS</button>
                    </div>

                    <div className="p-4 flex-1">
                        {((playerTab === 'GOAL' && topScorers.length > 0) || (playerTab === 'ASSIST' && topAssists.length > 0)) ? (
                            <div className="flex flex-col gap-2 text-left">
                                <div className="flex items-center text-[10px] font-bold text-slate-500 uppercase px-3 mb-1">
                                    <div className="w-8 text-center">#</div>
                                    <div className="w-[35%] text-left ml-4">PLAYER</div>
                                    <div className="flex-1 text-left ml-2">TEAM</div>
                                    <div className="w-12 text-right">{playerTab === 'GOAL' ? 'GOAL' : 'AST'}</div>
                                </div>

                                {/* 🔥 p-3.5 로 통일, 높이 min-h-[64px] 강제 고정 */}
                                {(playerTab === 'GOAL' ? topScorers : topAssists).map((p:any, idx:number) => (
                                    <div key={idx} className="flex items-center bg-slate-900/40 border border-slate-800/60 rounded-2xl p-3.5 hover:bg-slate-800/60 transition-all min-h-[64px]">
                                        <div className={`w-8 text-center text-sm font-black italic ${idx < 3 ? 'text-emerald-400' : 'text-slate-600'}`}>{idx + 1}</div>
                                        <div className="w-[35%] ml-4 pr-6 min-w-0 overflow-visible">
                                            <span className="text-sm font-black text-white italic leading-tight whitespace-nowrap">{p.name}</span>
                                        </div>
                                        <div className="flex-1 flex items-center justify-start gap-2 min-w-0 pr-8 overflow-visible ml-2">
                                            {/* 🔥 팀 리스트와 동일한 사이즈감 부여 (w-8 h-8) */}
                                            <div className="w-8 h-8 bg-white rounded-full p-1 flex shrink-0 items-center justify-center shadow-md">
                                                <img src={p.logo} alt="logo" className="w-full h-full object-contain" />
                                            </div>
                                            <span className="text-[11px] font-bold text-slate-400 italic whitespace-nowrap">{p.team}</span>
                                        </div>
                                        <div className={`w-12 text-right font-black text-lg italic ${playerTab === 'GOAL' ? 'text-yellow-400' : 'text-red-400'}`}>
                                            {p.count}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center py-10 text-center text-slate-500 text-xs font-bold italic">기록된 데이터가 없습니다.</div>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-5 text-center shadow-inner mt-4">
                <p className="text-emerald-400 text-xs sm:text-sm font-bold leading-relaxed break-keep">
                    ✨ 구단주실 세팅이 완료되었습니다!<br/>
                    <span className="text-slate-400 text-[10px] sm:text-[11px] font-medium mt-1 block">위 기록은 공식 리그 매치 결과를 바탕으로 실시간 자동 계산됩니다.</span>
                </p>
            </div>

            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/90 backdrop-blur-md px-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl">
                        <h3 className="text-xl sm:text-2xl font-black text-white italic tracking-tighter mb-6 flex items-center gap-2">
                            <Settings className="text-emerald-400" /> 프로필 및 구단 설정
                        </h3>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="text-[11px] text-emerald-400 font-bold uppercase tracking-widest mb-1.5 block">📸 프로필 이미지 URL</label>
                                <input type="text" value={editPhoto} onChange={e => setEditPhoto(e.target.value)} placeholder="이미지 주소를 붙여넣으세요" className="w-full bg-[#0B1120] text-slate-200 text-xs sm:text-sm font-bold p-3.5 rounded-xl border border-slate-700 focus:border-emerald-500 outline-none transition-all shadow-inner" />
                            </div>
                            <div>
                                <label className="text-[11px] text-emerald-400 font-bold uppercase tracking-widest mb-1.5 block">🛡️ 나의 소속 구단 선택</label>
                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        <select value={editCategory} onChange={e => { setEditCategory(e.target.value as any); setEditRegion(''); setEditTeamId(''); }} className="w-1/3 bg-[#0B1120] text-slate-200 text-xs sm:text-sm font-bold p-3.5 rounded-xl border border-slate-700 focus:border-emerald-500 cursor-pointer"><option value="CLUB">⚽ 클럽</option><option value="NATIONAL">🌍 국대</option></select>
                                        <select value={editRegion} onChange={e => { setEditRegion(e.target.value); setEditTeamId(''); }} className="w-2/3 bg-[#0B1120] text-slate-200 text-xs sm:text-sm font-bold p-3.5 rounded-xl border border-slate-700 focus:border-emerald-500 cursor-pointer"><option value="">-- 리그/지역 선택 --</option>{uniqueRegions.map((region) => (<option key={region} value={region}>{region}</option>))}</select>
                                    </div>
                                    <select value={editTeamId} onChange={e => setEditTeamId(e.target.value)} disabled={!editRegion} className="w-full bg-[#0B1120] text-slate-200 text-xs sm:text-sm font-bold p-3.5 rounded-xl border border-slate-700 focus:border-emerald-500 cursor-pointer disabled:opacity-50"><option value="">{editRegion ? '-- 구단 선택 --' : '👆 지역을 먼저 선택하세요'}</option>{filteredTeamsForDropdown.map((t:any) => (<option key={t.docId || t.id} value={t.docId || t.id}>{t.name}</option>))}</select>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-4">
                                <button onClick={handleSaveSettings} disabled={isSaving} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black py-3.5 rounded-xl transition-all shadow-lg">{isSaving ? '저장 중...' : '저장 완료'}</button>
                                <button onClick={() => setIsEditing(false)} className="px-6 bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm font-black py-3.5 rounded-xl transition-all">취소</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}