"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { Season, Owner, MasterTeam, FALLBACK_IMG } from '../types';

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

interface ChampionsCarouselProps {
    seasons: Season[];
    owners: Owner[];
    masterTeams: MasterTeam[];
}

export const ChampionsCarousel = ({ seasons, owners, masterTeams }: ChampionsCarouselProps) => {

    // 🔥 역대 챔피언 추출 로직 (결승전 탐지 및 승자 계산)
    const champions = useMemo(() => {
        if (!seasons || seasons.length === 0) return [];

        const champs: any[] = [];

        // 최신 시즌부터 역순으로 탐색
        const sortedSeasons = [...seasons].sort((a, b) => b.id - a.id);

        sortedSeasons.forEach(season => {
            if (season.status !== 'COMPLETED' && season.type !== 'CUP' && season.type !== 'TOURNAMENT' && season.type !== 'LEAGUE_PLAYOFF') return;
            if (!season.rounds || season.rounds.length === 0) return;

            // 1. 모든 매치 플래트닝
            const allMatches = season.rounds.flatMap((r: any) => r.matches || []);
            if (allMatches.length === 0) return;

            // 2. 결승전 탐지
            const explicitFinalMatches = allMatches.filter((m: any) => {
                const s = (m.stage || '').toUpperCase();
                const l = (m.matchLabel || '').toUpperCase();
                const isFinalText = s.includes('FINAL') || s.includes('결승') || l.includes('FINAL') || l.includes('결승');
                const isNotSemi = !(s.includes('SEMI') || s.includes('4강') || l.includes('SEMI') || l.includes('4강') || s.includes('34') || l.includes('34'));
                return isFinalText && isNotSemi;
            });

            let finalMatch = explicitFinalMatches.length > 0 ? explicitFinalMatches[explicitFinalMatches.length - 1] : null;

            if (!finalMatch && (season.type === 'TOURNAMENT' || season.type === 'CUP' || season.type === 'LEAGUE_PLAYOFF')) {
                const lastRound = season.rounds[season.rounds.length - 1];
                if (lastRound && lastRound.matches && lastRound.matches.length > 0) {
                    finalMatch = lastRound.matches[lastRound.matches.length - 1];
                }
            }

            if (!finalMatch || finalMatch.status !== 'COMPLETED') return;

            // 3. 승자 계산
            let winnerTeamName = null;
            if (finalMatch.aggWinner && finalMatch.aggWinner !== 'TBD') {
                winnerTeamName = finalMatch.aggWinner;
            } else {
                const hs = Number(finalMatch.homeScore || 0);
                const as = Number(finalMatch.awayScore || 0);
                if (hs > as) winnerTeamName = finalMatch.home;
                else if (as > hs) winnerTeamName = finalMatch.away;
            }

            if (!winnerTeamName || winnerTeamName === 'TBD') return;

            // 4. 정보 매핑
            const master = masterTeams.find(m => m.name === winnerTeamName);
            const rawOwnerName = winnerTeamName === finalMatch.home ? finalMatch.homeOwner : finalMatch.awayOwner;
            
            // 오너 닉네임 & 프사 변환
            const strName = String(rawOwnerName).trim();
            const foundOwner = owners.find(o => o.uid === strName || o.docId === strName || o.nickname === strName || o.legacyName === strName);
            const nickname = foundOwner ? foundOwner.nickname : strName;
            const photo = foundOwner?.photo || (foundOwner as any)?.profileImage || DEFAULT_AVATAR;
            
            const pureSeasonName = season.name.replace(/^(🏆|🏳️|⚔️|⚽|🗓️|⭐)\s*/, '');

            champs.push({
                seasonId: season.id,
                seasonName: pureSeasonName,
                teamName: winnerTeamName,
                teamLogo: master?.logo || FALLBACK_IMG,
                ownerName: nickname,
                ownerPhoto: photo
            });
        });

        return champs;
    }, [seasons, owners, masterTeams]);

    if (champions.length === 0) return null;

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-sm font-black text-white italic tracking-widest uppercase flex items-center gap-2">
                    <Trophy size={16} className="text-yellow-500" /> HALL OF CHAMPIONS
                </h3>
            </div>

            <div className="flex overflow-x-auto gap-4 no-scrollbar pb-4 snap-x snap-mandatory px-1">
                {champions.map((champ, idx) => (
                    <div 
                        key={`${champ.seasonId}-${idx}`} 
                        className="min-w-[260px] max-w-[280px] shrink-0 snap-center rounded-2xl p-[2px] bg-gradient-to-br from-yellow-400/60 via-yellow-600/30 to-slate-800 shadow-[0_10px_20px_-10px_rgba(234,179,8,0.3)] transition-transform hover:-translate-y-1 relative group"
                    >
                        <div className="bg-[#0a0f1a] rounded-xl h-full p-4 relative overflow-hidden flex flex-col justify-between min-h-[110px]">
                            {/* ✨ 배경 골드 그라데이션 및 엠블럼 워터마크 */}
                            <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/10 to-transparent z-0"></div>
                            <div className="absolute -right-4 -bottom-4 opacity-10 w-24 h-24 z-0 pointer-events-none filter blur-[2px]" style={{ backgroundImage: `url(${champ.teamLogo})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}></div>

                            {/* 👑 타이틀 */}
                            <div className="relative z-10 flex justify-between items-start mb-2">
                                <span className="text-[9px] font-black text-yellow-500/90 tracking-widest uppercase italic bg-yellow-950/40 px-2 py-0.5 rounded-md border border-yellow-700/50 pr-1">
                                    {champ.seasonName}
                                </span>
                            </div>

                            {/* 👤 우승자 정보 */}
                            <div className="relative z-10 flex items-center gap-3">
                                <div className="relative shrink-0">
                                    <div className="absolute -top-3 -left-2 text-xl filter drop-shadow-md z-20" style={{ transform: 'rotate(-15deg)' }}>👑</div>
                                    <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-yellow-200 via-yellow-500 to-yellow-100 shadow-md">
                                        <div className="w-full h-full rounded-full overflow-hidden border border-slate-900 bg-slate-800">
                                            <img src={champ.ownerPhoto} className="w-full h-full object-cover" alt="owner" onError={(e:any) => { e.target.src = DEFAULT_AVATAR; }} />
                                        </div>
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full p-0.5 shadow-lg border border-yellow-400 z-30 flex items-center justify-center">
                                        <img src={champ.teamLogo} className="w-full h-full object-contain" alt="" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} />
                                    </div>
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <h3 className="text-base font-black text-white italic truncate pr-1 tracking-tight drop-shadow-sm">{champ.ownerName}</h3>
                                    <p className="text-[10px] font-bold text-yellow-500/80 italic uppercase truncate pr-1">WITH {champ.teamName}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};