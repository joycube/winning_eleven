"use client";

import React from 'react';
import { Match, FALLBACK_IMG } from '../types';

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

interface Props {
    knockoutStages: {
        roundOf8?: Match[] | null;
        roundOf4?: Match[];
        final?: Match[];
    };
}

export const AdminMatching_TournamentBracketView = ({ knockoutStages }: Props) => {
    if (!knockoutStages) return null;

    // 🎨 공통 매치 박스 디자인
    const MatchBox = ({ match, title, isFinal = false }: { match: any, title: string, isFinal?: boolean }) => (
        <div className={`flex flex-col w-[180px] sm:w-[200px] ${isFinal ? 'scale-110 ml-6' : ''}`}>
            <div className="text-[10px] font-black text-slate-500 uppercase mb-2 ml-1 italic opacity-70">{title}</div>
            <div className={`bg-[#0f141e]/90 border rounded-xl overflow-hidden shadow-2xl ${isFinal ? 'border-yellow-500/50 shadow-yellow-500/20' : 'border-slate-800'}`}>
                {[
                    { name: match?.home, logo: match?.homeLogo, score: match?.homeScore },
                    { name: match?.away, logo: match?.awayLogo, score: match?.awayScore }
                ].map((team, idx) => (
                    <div key={idx} className={`flex items-center justify-between px-3 py-2 h-[45px] ${idx === 0 ? 'border-b border-slate-800/50' : ''} ${(!team.name || team.name === 'TBD') ? 'opacity-30' : ''}`}>
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                <img src={(!team.name || team.name === 'TBD') ? SAFE_TBD_LOGO : (team.logo || FALLBACK_IMG)} className="w-[70%] h-[70%] object-contain" alt="" />
                            </div>
                            <span className="text-[11px] font-black text-white truncate uppercase">{team.name || 'TBD'}</span>
                        </div>
                        <div className="text-sm font-black text-emerald-400">{team.score || '-'}</div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="overflow-x-auto pb-8 no-scrollbar">
            <div className="flex items-stretch gap-12 p-4 min-w-max">
                
                {/* 1열: 8강 (roundOf8이 null이 아닐 때만) */}
                {knockoutStages.roundOf8 && (
                    <div className="flex flex-col justify-around gap-6">
                        {knockoutStages.roundOf8.map((m, i) => (
                            <MatchBox key={i} title={`Quarter ${i + 1}`} match={m} />
                        ))}
                    </div>
                )}

                {/* 2열: 4강 */}
                <div className="flex flex-col justify-around gap-12">
                    {knockoutStages.roundOf4?.map((m, i) => (
                        <MatchBox key={i} title={`Semi ${i + 1}`} match={m} />
                    ))}
                </div>

                {/* 3열: 결승 */}
                <div className="flex flex-col justify-center relative">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl animate-bounce">👑</div>
                    <MatchBox title="Grand Final" match={knockoutStages.final?.[0]} isFinal />
                </div>

            </div>
        </div>
    );
};