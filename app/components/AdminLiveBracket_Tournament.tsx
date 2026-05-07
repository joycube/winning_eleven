"use client";

import React from 'react';
import { Match, FALLBACK_IMG } from '../types';

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

interface Props {
    knockoutStages: {
        roundOf8?: Match[] | null;
        roundOf4?: Match[] | null;
        thirdPlace?: Match[] | null;
        final?: Match[] | null;
    };
    isUserView?: boolean; 
}

export const AdminMatching_TournamentBracketView = ({ knockoutStages, isUserView = false }: Props) => {
    if (!knockoutStages) return null;

    const hasRealData = (matches?: Match[] | null) => {
        if (!matches) return false;
        return matches.some(m => 
            (m.id && !m.id.startsWith('v-')) || 
            (m.home && m.home !== 'TBD' && m.home !== 'BYE') || 
            (m.away && m.away !== 'TBD' && m.away !== 'BYE')
        );
    };

    const has8 = hasRealData(knockoutStages.roundOf8);
    const has4 = hasRealData(knockoutStages.roundOf4);

    const show8 = isUserView ? has8 : true;
    const show4 = isUserView ? (has8 || has4) : true; 
    const show3rd = isUserView ? hasRealData(knockoutStages.thirdPlace) : true;

    // 🔥 [핵심 이식] 리그 플레이오프 오리지널 BracketMatchBox를 그대로 이식
    const BracketMatchBox = ({ match, title, highlight = false, isFinal = false }: any) => {
        if (!match) return null;
        const hScore = match.homeScore !== '' ? Number(match.homeScore) : null;
        const aScore = match.awayScore !== '' ? Number(match.awayScore) : null;
        
        let winner = match.aggWinner || 'TBD'; 
        if (winner === 'TBD' && match.status === 'COMPLETED') {
            if (hScore !== null && aScore !== null) {
                if (hScore > aScore) winner = match.home;
                else if (aScore > hScore) winner = match.away;
            }
        }

        const isHomeWin = winner !== 'TBD' && winner === match.home;
        const isAwayWin = winner !== 'TBD' && winner === match.away;

        const renderRow = (teamName: string, score: number | null, isWinner: boolean, owner: string, logo: string) => {
            const isTbd = teamName === 'TBD' || teamName === 'BYE' || !teamName;
            const displayLogo = (isTbd || logo?.includes('uefa.com')) ? SAFE_TBD_LOGO : (logo || FALLBACK_IMG);
            const dispName = isTbd ? (teamName === 'BYE' ? 'BYE' : 'TBD') : teamName;
            const dispOwner = isTbd ? 'Unassigned Slot' : (owner && owner !== '-' ? owner : 'CPU');

            return (
                <div className={`flex items-center justify-between px-3 py-2.5 h-[50px] transition-colors ${isWinner ? 'bg-gradient-to-r from-emerald-900/40 to-transparent' : ''} ${isTbd ? 'opacity-30' : ''}`}>
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0 ${isTbd ? 'bg-slate-700' : 'bg-white'}`}>
                            <img src={displayLogo} className={`${isTbd ? 'w-full h-full opacity-60' : 'w-[70%] h-[70%]'} object-contain`} alt="" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} />
                        </div>
                        <div className="flex flex-col justify-center min-w-0">
                            <span className={`text-[11px] font-black leading-tight truncate uppercase tracking-tight ${isWinner ? 'text-white' : 'text-slate-400'}`}>
                                {dispName}
                            </span>
                            <span className="text-[9px] text-slate-500 font-bold italic truncate mt-0.5">{dispOwner}</span>
                        </div>
                    </div>
                    <div className={`text-lg font-black italic tracking-tighter w-8 text-right ${isWinner ? 'text-emerald-400' : 'text-slate-600'}`}>
                        {score ?? '-'}
                    </div>
                </div>
            );
        };

        return (
            <div className={`flex flex-col w-[200px] sm:w-[220px] ${isFinal ? 'scale-110 ml-4' : ''}`}>
                {title && <div className="text-[9px] font-bold text-slate-500 uppercase mb-1.5 pl-1 tracking-widest opacity-60">{title}</div>}
                <div className={`flex flex-col bg-[#0f141e]/90 backdrop-blur-md border rounded-xl overflow-hidden shadow-xl relative z-10 ${highlight ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]' : 'border-slate-800/50'}`}>
                    {renderRow(match.home, hScore, isHomeWin, match.homeOwner, match.homeLogo)}
                    <div className="h-[1px] bg-slate-800/40 w-full relative"></div>
                    {renderRow(match.away, aScore, isAwayWin, match.awayOwner, match.awayLogo)}
                </div>
            </div>
        );
    };

    return (
        <div className="overflow-x-auto pb-8 no-scrollbar">
            <style dangerouslySetInnerHTML={{ __html: `
                .bracket-tree { display: inline-flex; align-items: center; justify-content: flex-start; gap: 40px; padding: 10px 0 20px 4px; min-width: max-content; }
                .bracket-column { display: flex; flex-direction: column; justify-content: center; gap: 40px; position: relative; }
                .bracket-column-wide { display: flex; flex-direction: column; justify-content: space-around; gap: 80px; position: relative; }
            `}} />
            <div className="bracket-tree no-scrollbar">
                
                {/* 1열: 8강 */}
                {show8 && knockoutStages.roundOf8 && (
                    <div className="bracket-column">
                        {knockoutStages.roundOf8.map((m, i) => <BracketMatchBox key={i} title={`Quarter ${i + 1}`} match={m} />)}
                    </div>
                )}
                
                {/* 2열: 4강 */}
                {show4 && knockoutStages.roundOf4 && (
                    <div className={show8 ? "bracket-column-wide" : "bracket-column"}>
                        {knockoutStages.roundOf4.map((m, i) => <BracketMatchBox key={i} title={`Semi ${i + 1}`} match={m} />)}
                    </div>
                )}
                
                {/* 3열: 결승 및 3·4위전 */}
                <div className="bracket-column relative">
                    <div className="relative">
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-2xl animate-bounce ml-4 z-20">👑</div>
                        <BracketMatchBox title="Grand Final" match={knockoutStages.final?.[0]} highlight isFinal />
                    </div>
                    
                    {show3rd && knockoutStages.thirdPlace && knockoutStages.thirdPlace[0] && (
                        <div className="relative mt-8 opacity-90 scale-95 origin-left ml-6">
                            <BracketMatchBox title="3rd Place Match" match={knockoutStages.thirdPlace[0]} />
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default AdminMatching_TournamentBracketView;