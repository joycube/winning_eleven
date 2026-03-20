"use client";

import React, { useMemo } from 'react';
import { Match, FALLBACK_IMG } from '../types';

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

interface Props {
    matches?: Match[];
    knockoutStages?: any; // 🔥 부모가 넘겨주는 핵심 데이터
}

export const AdminMatching_TournamentBracketView = ({ matches = [], knockoutStages }: Props) => {
    
    // 🧠 데이터를 감지하여 라운드별로 구성
    const roundsData = useMemo(() => {
        const groupedRounds = [];

        // 1. knockoutStages 객체가 존재하고 내부 데이터가 있는지 우선 확인
        if (knockoutStages && (knockoutStages.roundOf8 || knockoutStages.roundOf4 || knockoutStages.final)) {
            if (knockoutStages.roundOf8 && knockoutStages.roundOf8.length > 0) {
                groupedRounds.push({ name: "⚔️ 8강전 (QUARTER-FINAL)", matches: knockoutStages.roundOf8 });
            }
            if (knockoutStages.roundOf4 && knockoutStages.roundOf4.length > 0) {
                groupedRounds.push({ name: "🔥 4강전 (SEMI-FINAL)", matches: knockoutStages.roundOf4 });
            }
            if (knockoutStages.final && knockoutStages.final.length > 0) {
                groupedRounds.push({ name: "👑 GRAND FINAL", matches: knockoutStages.final });
            }
            if (groupedRounds.length > 0) return groupedRounds;
        }

        // 2. knockoutStages가 없을 경우 원본 matches 배열에서 분류 (예비 로직)
        if (matches && matches.length > 0) {
            const r8 = matches.filter(m => m.stage?.toUpperCase().includes('ROUND_OF_8') || m.stage?.toUpperCase().includes('QUARTER'));
            const r4 = matches.filter(m => m.stage?.toUpperCase().includes('ROUND_OF_4') || m.stage?.toUpperCase().includes('SEMI'));
            const final = matches.filter(m => (m.stage?.toUpperCase().includes('FINAL') || m.matchLabel?.includes('결승')) && !m.stage?.toUpperCase().includes('SEMI') && !m.stage?.toUpperCase().includes('QUARTER'));

            if (r8.length > 0) groupedRounds.push({ name: "⚔️ 8강전 (QUARTER-FINAL)", matches: r8 });
            if (r4.length > 0) groupedRounds.push({ name: "🔥 4강전 (SEMI-FINAL)", matches: r4 });
            if (final.length > 0) groupedRounds.push({ name: "👑 GRAND FINAL", matches: final });
        }

        return groupedRounds;
    }, [matches, knockoutStages]);

    // 🎨 매치 박스 렌더링 (디자인 유지)
    const BracketMatchBox = ({ match, title, highlight = false }: any) => {
        if (!match) return null;
        const hScore = match.homeScore !== '' ? Number(match.homeScore) : null;
        const aScore = match.awayScore !== '' ? Number(match.awayScore) : null;
        const isTbdHome = !match.home || match.home === 'TBD';
        const isTbdAway = !match.away || match.away === 'TBD';
        
        return (
            <div className="flex flex-col w-[200px] sm:w-[220px]">
                {title && <div className="text-[9px] font-bold text-slate-500 uppercase mb-1.5 pl-1 tracking-widest opacity-60">{title}</div>}
                <div className={`flex flex-col bg-[#0f141e]/90 backdrop-blur-md border rounded-xl overflow-hidden shadow-xl relative z-10 ${highlight ? 'border-yellow-500/50 shadow-yellow-500/20' : 'border-slate-800/50'}`}>
                    {/* Home Team */}
                    <div className={`flex items-center justify-between px-3 py-2.5 h-[50px] ${isTbdHome ? 'opacity-30' : ''}`}>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${isTbdHome ? 'bg-slate-700' : 'bg-white'}`}>
                                <img src={isTbdHome ? SAFE_TBD_LOGO : (match.homeLogo || FALLBACK_IMG)} className="w-[70%] h-[70%] object-contain" alt="" />
                            </div>
                            <span className="text-[11px] font-black text-white uppercase truncate">{match.home || 'TBD'}</span>
                        </div>
                        <div className="text-lg font-black text-slate-400">{match.homeScore || '-'}</div>
                    </div>
                    <div className="h-[1px] bg-slate-800/40 w-full"></div>
                    {/* Away Team */}
                    <div className={`flex items-center justify-between px-3 py-2.5 h-[50px] ${isTbdAway ? 'opacity-30' : ''}`}>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${isTbdAway ? 'bg-slate-700' : 'bg-white'}`}>
                                <img src={isTbdAway ? SAFE_TBD_LOGO : (match.awayLogo || FALLBACK_IMG)} className="w-[70%] h-[70%] object-contain" alt="" />
                            </div>
                            <span className="text-[11px] font-black text-white uppercase truncate">{match.away || 'TBD'}</span>
                        </div>
                        <div className="text-lg font-black text-slate-400">{match.awayScore || '-'}</div>
                    </div>
                </div>
            </div>
        );
    };

    // 데이터가 아예 없을 때만 메시지 노출
    if (roundsData.length === 0) {
        return <div className="text-center py-20 text-slate-600 font-bold italic tracking-widest">브래킷 데이터를 로드하는 중입니다...</div>;
    }

    return (
        <div className="overflow-x-auto pb-6 no-scrollbar w-full">
            <style dangerouslySetInnerHTML={{ __html: `
                .bracket-tree { display: inline-flex; align-items: stretch; justify-content: flex-start; gap: 40px; padding: 10px 20px 20px 4px; min-width: max-content; }
                .bracket-column { display: flex; flex-direction: column; justify-content: space-around; gap: 30px; position: relative; }
            `}} />
            <div className="bracket-tree no-scrollbar">
                {roundsData.map((round, rIdx) => (
                    <div key={rIdx} className="bracket-column">
                        {round.matches.map((m: any, mIdx: number) => (
                            <div key={m.id || `m-${rIdx}-${mIdx}`} className={rIdx === roundsData.length - 1 ? 'relative scale-110 ml-4' : ''}>
                                {rIdx === roundsData.length - 1 && <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-2xl animate-bounce">👑</div>}
                                <BracketMatchBox match={m} title={rIdx === roundsData.length - 1 ? round.name : `${round.name} - ${mIdx + 1}`} highlight={rIdx === roundsData.length - 1} />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};