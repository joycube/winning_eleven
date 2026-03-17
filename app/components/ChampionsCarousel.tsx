"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useMemo, useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { Season, Owner, MasterTeam, FALLBACK_IMG } from '../types';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

interface ChampionsCarouselProps {
    seasons: Season[];
    owners: Owner[];
    masterTeams: MasterTeam[];
}

export const ChampionsCarousel = ({ seasons, owners, masterTeams }: ChampionsCarouselProps) => {
    const [historyData, setHistoryData] = useState<Record<string, any>>({});

    useEffect(() => {
        const fetchHistoryRecords = async () => {
            try {
                const q = query(collection(db, 'history_records'));
                const snap = await getDocs(q);
                const newHistory: Record<string, any> = {};
                snap.docs.forEach(doc => {
                    newHistory[doc.id] = doc.data(); 
                });
                setHistoryData(newHistory);
            } catch (err) {
                console.error("Failed to fetch history_records for champions:", err);
            }
        };
        fetchHistoryRecords();
    }, []);

    const resolveOwnerInfo = (rawName: any, rawUid?: any, masterTeamInfo?: any) => {
        let n = String(rawName || '').trim();
        if (n === 'undefined' || n === 'null') n = '';

        let u = String(rawUid || '').trim();
        if (u === 'undefined' || u === 'null') u = '';

        if (u) {
            const byUid = owners.find(o => o.uid === u || o.docId === u);
            if (byUid) return { nickname: byUid.nickname, photo: byUid.photo || (byUid as any).profileImage || DEFAULT_AVATAR };
        }

        if (n) {
            const byName = owners.find(o => o.nickname === n || o.legacyName === n || o.uid === n || o.docId === n);
            if (byName) return { nickname: byName.nickname, photo: byName.photo || (byName as any).profileImage || DEFAULT_AVATAR };
        }

        if (masterTeamInfo) {
            const mName = String(masterTeamInfo.ownerName || '').trim();
            const mUid = String(masterTeamInfo.ownerUid || '').trim();
            
            if (mUid) {
                const byMasterUid = owners.find(o => o.uid === mUid || o.docId === mUid);
                if (byMasterUid) return { nickname: byMasterUid.nickname, photo: byMasterUid.photo || (byMasterUid as any).profileImage || DEFAULT_AVATAR };
            }
            if (mName && mName !== 'undefined') {
                const byMasterName = owners.find(o => o.nickname === mName || o.legacyName === mName || o.uid === mName);
                if (byMasterName) return { nickname: byMasterName.nickname, photo: byMasterName.photo || (byMasterName as any).profileImage || DEFAULT_AVATAR };
                return { nickname: mName, photo: DEFAULT_AVATAR }; 
            }
        }

        return { nickname: n || 'Unknown', photo: DEFAULT_AVATAR };
    };

    const champions = useMemo(() => {
        if (!seasons || seasons.length === 0) return [];

        const champs: any[] = [];
        const sortedSeasons = [...seasons].sort((a, b) => b.id - a.id);

        sortedSeasons.forEach(season => {
            if (season.status !== 'COMPLETED') return;

            let winnerTeamName: string | null = null;
            let rawOwnerName: string | null | undefined = null;
            let rawOwnerUid: string | null | undefined = null;
            let teamStats: any = null;
            const seasonHistory = historyData[String(season.id)];
            const theme = season.type === 'LEAGUE' ? 'BLUE' : 'GOLD';

            // ==========================================
            // CASE 1: 순수 리그 (LEAGUE)
            // 리그는 DB(history_records)의 순위가 100% 정확하므로 DB를 믿습니다.
            // ==========================================
            if (season.type === 'LEAGUE') {
                if (!seasonHistory || !seasonHistory.teams || seasonHistory.teams.length === 0) return;

                const sortedTeams = [...seasonHistory.teams].sort((a, b) => {
                    const ptsA = a.points !== undefined ? a.points : (a.pts || 0);
                    const ptsB = b.points !== undefined ? b.points : (b.pts || 0);
                    if (ptsB !== ptsA) return ptsB - ptsA;
                    if (b.gd !== a.gd) return (b.gd || 0) - (a.gd || 0);
                    return (b.gf || 0) - (a.gf || 0);
                });

                const topTeam = sortedTeams[0];
                winnerTeamName = topTeam.name;

                if (seasonHistory.owners && seasonHistory.owners.length > 0) {
                    const sortedOwners = [...seasonHistory.owners].sort((a, b) => {
                        const pA = a.points !== undefined ? a.points : (a.pts || 0);
                        const pB = b.points !== undefined ? b.points : (b.pts || 0);
                        return pB - pA;
                    });
                    rawOwnerName = sortedOwners[0].name || sortedOwners[0].owner || sortedOwners[0].legacyName;
                    rawOwnerUid = sortedOwners[0].ownerUid || sortedOwners[0].ownerId;
                } else {
                    rawOwnerName = topTeam.ownerName || topTeam.owner || topTeam.legacyName;
                    rawOwnerUid = topTeam.ownerUid || topTeam.ownerId;
                }

                teamStats = {
                    win: topTeam.win || 0,
                    draw: topTeam.draw || 0,
                    loss: topTeam.loss || 0,
                    points: topTeam.points !== undefined ? topTeam.points : (topTeam.pts !== undefined ? topTeam.pts : ((topTeam.win || 0) * 3 + (topTeam.draw || 0)))
                };
            } 
            // ==========================================
            // CASE 2: 토너먼트, PO, 컵
            // DB 백엔드 버그(마지막 1경기만 저장됨) 우회를 위해 프론트에서 실제 승무패를 카운트합니다.
            // ==========================================
            else {
                if (!season.rounds || season.rounds.length === 0) return;
                const allMatches = season.rounds.flatMap((r: any) => r.matches || []);
                if (allMatches.length === 0) return;

                const explicitFinalMatches = allMatches.filter((m: any) => {
                    const s = (m.stage || '').toUpperCase();
                    const l = (m.matchLabel || '').toUpperCase();
                    const isFinalText = s.includes('FINAL') || s.includes('결승') || l.includes('FINAL') || l.includes('결승');
                    const isNotSemi = !(s.includes('SEMI') || s.includes('4강') || l.includes('SEMI') || l.includes('4강') || s.includes('34') || l.includes('34'));
                    return isFinalText && isNotSemi;
                });

                let finalMatch = explicitFinalMatches.length > 0 ? explicitFinalMatches[explicitFinalMatches.length - 1] : null;

                if (!finalMatch) {
                    const lastRound = season.rounds[season.rounds.length - 1];
                    if (lastRound && lastRound.matches && lastRound.matches.length > 0) {
                        finalMatch = lastRound.matches[lastRound.matches.length - 1];
                    }
                }

                if (!finalMatch || finalMatch.status !== 'COMPLETED') return;

                if (finalMatch.aggWinner && finalMatch.aggWinner !== 'TBD') {
                    winnerTeamName = finalMatch.aggWinner;
                } else {
                    const hs = Number(finalMatch.homeScore || 0);
                    const as = Number(finalMatch.awayScore || 0);
                    if (hs > as) winnerTeamName = finalMatch.home;
                    else if (as > hs) winnerTeamName = finalMatch.away;
                }

                if (!winnerTeamName || winnerTeamName === 'TBD') return;

                rawOwnerName = winnerTeamName === finalMatch.home ? finalMatch.homeOwner : finalMatch.awayOwner;
                rawOwnerUid = winnerTeamName === finalMatch.home ? finalMatch.homeOwnerUid : finalMatch.awayOwnerUid;

                // 🔥 [강력 픽스] DB에 의존하지 않고 해당 우승팀의 실제 경기 기록을 스케줄에서 직접 셉니다 (속도 지연 없음)
                let w = 0, d = 0, l = 0;
                season.rounds.forEach((r: any) => {
                    (r.matches || []).forEach((m: any) => {
                        if (m.status === 'COMPLETED' && m.home !== 'BYE' && m.away !== 'BYE') {
                            if (m.home === winnerTeamName) {
                                const hs = Number(m.homeScore || 0);
                                const as = Number(m.awayScore || 0);
                                if (hs > as) w++;
                                else if (hs === as) d++;
                                else l++;
                            } else if (m.away === winnerTeamName) {
                                const hs = Number(m.homeScore || 0);
                                const as = Number(m.awayScore || 0);
                                if (as > hs) w++;
                                else if (as === hs) d++;
                                else l++;
                            }
                        }
                    });
                });

                teamStats = {
                    win: w,
                    draw: d,
                    loss: l,
                    points: (w * 3) + d
                };
            }

            if (!winnerTeamName) return;
            const master = masterTeams.find(m => m.name === winnerTeamName);

            if (!rawOwnerName || String(rawOwnerName) === 'undefined') {
                rawOwnerName = master?.ownerName || 'Unknown';
            }

            const ownerInfo = resolveOwnerInfo(rawOwnerName, rawOwnerUid, master);
            const pureSeasonName = season.name.replace(/^(🏆|🏳️|⚔️|⚽|🗓️|⭐)\s*/, '');

            champs.push({
                seasonId: season.id,
                seasonName: pureSeasonName,
                teamName: winnerTeamName,
                teamLogo: master?.logo || FALLBACK_IMG,
                ownerName: ownerInfo.nickname,
                ownerPhoto: ownerInfo.photo,
                stats: teamStats,
                theme: theme
            });
        });

        return champs;
    }, [seasons, owners, masterTeams, historyData]);

    if (champions.length === 0) return null;

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-sm font-black text-white italic tracking-widest uppercase flex items-center gap-2">
                    <Trophy size={16} className="text-yellow-500" /> HALL OF CHAMPIONS
                </h3>
            </div>

            <div className="flex overflow-x-auto gap-3 no-scrollbar pb-4 snap-x snap-mandatory px-1">
                {champions.map((champ, idx) => {
                    const isGold = champ.theme === 'GOLD';

                    const wrapperClass = isGold 
                        ? "from-yellow-400/60 via-yellow-600/30 shadow-[0_10px_20px_-10px_rgba(234,179,8,0.3)]" 
                        : "from-blue-400/60 via-blue-600/30 shadow-[0_10px_20px_-10px_rgba(59,130,246,0.3)]";
                    const bgWatermarkClass = isGold ? "from-yellow-600/10" : "from-blue-600/10";
                    const textThemeClass = isGold ? "text-yellow-500" : "text-blue-400";
                    const topIcon = isGold ? "👑" : "🚩";
                    const profileRingClass = isGold 
                        ? "from-yellow-200 via-yellow-500 to-yellow-800" 
                        : "from-blue-200 via-blue-500 to-blue-800";
                    const logoRingClass = isGold ? "border-yellow-500" : "border-blue-400";

                    return (
                        <div 
                            key={`${champ.seasonId}-${idx}`} 
                            className={`min-w-[140px] max-w-[150px] shrink-0 snap-center rounded-2xl p-[2px] bg-gradient-to-b ${wrapperClass} to-slate-800 transition-transform hover:-translate-y-1 relative group`}
                        >
                            <div className="bg-[#0a0f1a] rounded-[14px] h-full p-4 relative overflow-hidden flex flex-col items-center min-h-[170px]">
                                
                                {/* ✨ 엠블럼 워터마크 배경 */}
                                <div className={`absolute inset-0 bg-gradient-to-b ${bgWatermarkClass} to-transparent z-0 pointer-events-none`}></div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 w-24 h-24 z-0 pointer-events-none filter blur-[2px]" style={{ backgroundImage: `url(${champ.teamLogo})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}></div>

                                {/* 🏆 박스를 없앤 심플한 시즌 이름 */}
                                <div className="relative z-10 w-full flex justify-center mb-3">
                                    <span className={`text-[10px] font-black tracking-widest uppercase italic text-center line-clamp-1 w-full drop-shadow-md ${textThemeClass}`}>
                                        {champ.seasonName}
                                    </span>
                                </div>

                                {/* 👑 프사 + 팀 엠블럼 */}
                                <div className="relative z-10 flex flex-col items-center mb-3 mt-1">
                                    <div className={`absolute -top-4 -left-3 text-2xl filter drop-shadow-md z-20 ${!isGold && 'opacity-90'}`} style={{ transform: 'rotate(-15deg)' }}>{topIcon}</div>
                                    
                                    <div className={`w-16 h-16 rounded-full p-[2px] bg-gradient-to-b ${profileRingClass} shadow-md`}>
                                        <div className="w-full h-full rounded-full overflow-hidden border border-slate-900 bg-slate-800">
                                            <img src={champ.ownerPhoto} className="w-full h-full object-cover" alt="owner" onError={(e:any) => { e.target.src = DEFAULT_AVATAR; }} />
                                        </div>
                                    </div>
                                    
                                    <div className={`absolute -bottom-1 -right-2 w-7 h-7 bg-white rounded-full p-1 shadow-lg border ${logoRingClass} z-30 flex items-center justify-center`}>
                                        <img src={champ.teamLogo} className="w-full h-full object-contain" alt="" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} />
                                    </div>
                                </div>

                                {/* 👤 닉네임 */}
                                <h3 className="relative z-10 text-sm font-black text-white italic truncate w-full text-center pr-1 mb-2 drop-shadow-sm">
                                    {champ.ownerName}
                                </h3>

                                {/* 🔥 전적(승무패) + 승점 (P) 복구: 박스 없이 심플하게 나란히 배치 */}
                                <div className="relative z-10 w-full mt-auto flex items-center justify-center gap-2.5 pt-1">
                                    {champ.stats ? (
                                        <>
                                            <span className="text-[10px] font-bold tracking-tighter text-slate-200 drop-shadow-sm">
                                                {champ.stats.win}W <span className="text-slate-500">{champ.stats.draw}D</span> <span className="text-red-400/90">{champ.stats.loss}L</span>
                                            </span>
                                            <span className="w-px h-3 bg-slate-700"></span>
                                            <span className={`text-[12px] font-black italic drop-shadow-sm ${textThemeClass}`}>
                                                {champ.stats.points} P
                                            </span>
                                        </>
                                    ) : (
                                        <span className={`text-[9px] font-black tracking-widest uppercase px-3 py-1 rounded-full bg-[#05080f]/80 border border-slate-700/50 shadow-inner ${textThemeClass}`}>
                                            {isGold ? 'Tournament' : 'Champion'}
                                        </span>
                                    )}
                                </div>

                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};