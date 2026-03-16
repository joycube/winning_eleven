"use client";

import React, { useMemo } from 'react';
import { Match, FALLBACK_IMG } from '../types';

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

interface Props {
    matches: Match[];
}

export const AdminMatching_TournamentBracketView = ({ matches }: Props) => {
    // 🧠 1. 일렬로 된 matches 배열을 라운드별로 예쁘게 묶어주는 로직
    const roundsData = useMemo(() => {
        if (!matches || matches.length === 0) return [];

        const totalMatches = matches.length;
        const totalRounds = Math.log2(totalMatches + 1);
        const groupedRounds = [];

        let startIndex = 0;
        for (let r = 0; r < totalRounds; r++) {
            const matchesInRound = Math.pow(2, totalRounds - r - 1);
            groupedRounds.push({
                level: r + 1,
                matches: matches.slice(startIndex, startIndex + matchesInRound)
            });
            startIndex += matchesInRound;
        }

        return groupedRounds;
    }, [matches]);

    // 🏆 라운드 이름 변환기
    const getRoundName = (level: number, totalRounds: number) => {
        if (level === totalRounds) return "🏆 GRAND FINAL (단판)";
        if (level === totalRounds - 1) return "🔥 4강전 (SEMI-FINAL)";
        if (level === totalRounds - 2) return "⚔️ 8강전 (QUARTER-FINAL)";
        if (level === totalRounds - 3) return "🛡️ 16강전 (ROUND OF 16)";
        return `ROUND ${level}`;
    };

    // 🎨 UI: 미니멀 매치 카드 (리그+PO와 동일한 디자인)
    const BracketMatchBox = ({ match, title, highlight = false }: any) => {
        if (!match) return null;
        const isCompleted = match.status === 'COMPLETED';
        const hScore = match.homeScore !== '' ? Number(match.homeScore) : null;
        const aScore = match.awayScore !== '' ? Number(match.awayScore) : null;
        
        let winner = 'TBD'; 
        if (isCompleted && hScore !== null && aScore !== null) {
            if (hScore > aScore) winner = match.home;
            else if (aScore > hScore) winner = match.away;
        } else if (match.home === 'BYE') {
            winner = match.away;
        } else if (match.away === 'BYE') {
            winner = match.home;
        }

        const isHomeWin = winner !== 'TBD' && winner === match.home;
        const isAwayWin = winner !== 'TBD' && winner === match.away;

        const renderRow = (teamName: string, score: number | null, isWinner: boolean, owner: string, logo: string) => {
            const isTbd = teamName === 'TBD' || !teamName;
            const isBye = teamName === 'BYE';
            const displayLogo = (isTbd || isBye || logo?.includes('uefa.com')) ? SAFE_TBD_LOGO : (logo || FALLBACK_IMG);

            return (
                <div className={`flex items-center justify-between px-3 py-2.5 h-[50px] ${isWinner ? 'bg-gradient-to-r from-emerald-900/40 to-transparent' : ''} ${(isTbd || isBye) ? 'opacity-30' : ''}`}>
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0 ${isTbd || isBye ? 'bg-slate-700' : 'bg-white'}`}>
                            <img src={displayLogo} className={`${isTbd || isBye ? 'w-full h-full' : 'w-[70%] h-[70%]'} object-contain`} alt="" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} />
                        </div>
                        <div className="flex flex-col justify-center min-w-0">
                            <span className={`text-[11px] font-black leading-tight truncate uppercase tracking-tight ${isWinner ? 'text-white' : isTbd || isBye ? 'text-slate-500' : 'text-slate-400'}`}>
                                {teamName || 'TBD'}
                            </span>
                            {!isTbd && !isBye && (
                                <span className="text-[9px] text-slate-500 font-bold italic truncate mt-0.5">{owner || '-'}</span>
                            )}
                            {isBye && <span className="text-[9px] text-slate-600 font-bold italic">Unassigned</span>}
                        </div>
                    </div>
                    <div className={`text-lg font-black italic tracking-tighter w-8 text-right ${isWinner ? 'text-emerald-400' : 'text-slate-600'}`}>
                        {isBye ? '0' : (score ?? '-')}
                    </div>
                </div>
            );
        };

        return (
            <div className="flex flex-col w-[200px] sm:w-[220px]">
                {title && <div className="text-[9px] font-bold text-slate-500 uppercase mb-1.5 pl-1 tracking-widest opacity-60">{title}</div>}
                <div className={`flex flex-col bg-[#0f141e]/90 backdrop-blur-md border rounded-xl overflow-hidden shadow-xl relative z-10 ${highlight ? 'border-yellow-500/50 shadow-yellow-500/20' : 'border-slate-800/50'}`}>
                    {renderRow(match.home, hScore, isHomeWin, match.homeOwner, match.homeLogo)}
                    <div className="h-[1px] bg-slate-800/40 w-full relative"></div>
                    {renderRow(match.away, aScore, isAwayWin, match.awayOwner, match.awayLogo)}
                </div>
            </div>
        );
    };

    if (!matches || matches.length === 0) {
        return <div className="text-center py-10 text-slate-500 italic">대진표 데이터가 없습니다.</div>;
    }

    return (
        <div className="overflow-x-auto pb-6 no-scrollbar w-full">
            <style dangerouslySetInnerHTML={{ __html: `
                .bracket-tree { display: inline-flex; align-items: stretch; justify-content: flex-start; gap: 40px; padding: 10px 20px 20px 4px; min-width: max-content; height: 100%; }
                .bracket-column { display: flex; flex-direction: column; justify-content: space-around; gap: 20px; position: relative; }
                .b-node { position: relative; z-index: 10; }
            `}} />
            <div className="min-w-max px-2">
                <div className="bracket-tree no-scrollbar">
                    {roundsData.map((roundInfo, rIdx) => {
                        const isFinal = rIdx === roundsData.length - 1;
                        const roundTitle = getRoundName(roundInfo.level, roundsData.length);

                        return (
                            <div key={rIdx} className={`bracket-column ${isFinal ? 'pl-4' : ''}`}>
                                {roundInfo.matches.map((match, mIdx) => (
                                    <div key={match.id} className={`b-node ${isFinal ? 'relative scale-110 ml-4' : ''}`}>
                                        {isFinal && <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-2xl animate-bounce z-20">👑</div>}
                                        <BracketMatchBox 
                                            match={match} 
                                            title={isFinal ? roundTitle : `${roundTitle} - ${mIdx + 1}경기`} 
                                            highlight={isFinal} 
                                        />
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};