"use client";

import React, { useMemo } from 'react';
import { Season, Match, Owner, MasterTeam, FALLBACK_IMG } from '../types';

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

interface Props {
    currentSeason: Season;
    owners: Owner[];
    masterTeams: MasterTeam[];
    activeRankingData?: any;
}

export const AdminMatching_LeaguePOBracketView = ({ currentSeason, owners, masterTeams, activeRankingData }: Props) => {
    
    const resolveOwnerNickname = (ownerName: any, ownerUid?: string) => {
        try {
            if (!ownerName) return '-';
            const strName = String(ownerName).trim();
            if (['-', 'CPU', 'SYSTEM', 'TBD', 'BYE', 'GUEST'].includes(strName.toUpperCase())) return strName;
            
            const foundByUid = owners.find(o => (ownerUid && (o.uid === ownerUid || o.docId === ownerUid)) || (o.uid === strName || o.docId === strName));
            if (foundByUid) return foundByUid.nickname;
            
            const foundByName = owners.find(o => o.nickname === strName || o.legacyName === strName);
            return foundByName ? foundByName.nickname : strName;
        } catch (e) {
            return String(ownerName || '-');
        }
    };

    const getTeamExtendedInfo = (teamIdentifier: string) => {
        const tbdTeam = { name: teamIdentifier || 'TBD', logo: SAFE_TBD_LOGO, ownerName: '-', ownerUid: undefined as string | undefined };
        if (!teamIdentifier || teamIdentifier === 'TBD') return tbdTeam;
        
        const normId = teamIdentifier.toString().trim().toLowerCase().replace(/\s+/g, '');
        let stats = activeRankingData?.teams?.find((t: any) => t.name.trim().toLowerCase().replace(/\s+/g, '') === normId);
        let master = masterTeams.find((m: any) => m.name === teamIdentifier || m.name.trim().toLowerCase().replace(/\s+/g, '') === normId);
        
        const rawOwnerName = stats?.ownerName || (master as any)?.ownerName || 'CPU';
        const rawOwnerUid = stats?.ownerUid || (master as any)?.ownerUid;

        return { 
            name: stats?.name || master?.name || teamIdentifier, 
            logo: stats?.logo || master?.logo || SAFE_TBD_LOGO, 
            ownerName: resolveOwnerNickname(rawOwnerName, rawOwnerUid), 
            ownerUid: rawOwnerUid
        };
    };

    const hybridPlayoffData = useMemo(() => {
        if (currentSeason?.type !== 'LEAGUE_PLAYOFF' || !currentSeason?.rounds) return null;

        const calcAgg = (leg1: Match | undefined, leg2: Match | undefined, targetNextSlotTeam: string | undefined = undefined) => {
            if (!leg1) return null;
            let s1 = 0, s2 = 0;
            let isLeg1Done = leg1.status === 'COMPLETED';
            let isLeg2Done = leg2 && leg2.status === 'COMPLETED';
            const t1 = leg1.home; const t2 = leg1.away;
            
            if (isLeg1Done) { s1 += Number(leg1.homeScore); s2 += Number(leg1.awayScore); }
            if (isLeg2Done && leg2) { 
                if (leg2.home === t2) { s2 += Number(leg2.homeScore); s1 += Number(leg2.awayScore); }
                else { s1 += Number(leg2.homeScore); s2 += Number(leg2.awayScore); }
            }
            
            let aggWinner = 'TBD';
            
            // 🔥 [수술 핵심 1순위] DB에 저장된 명시적 승자(aggWinner)가 있는지 최우선 확인 (승부차기, 강제 지정)
            if (leg2 && (leg2 as any).aggWinner && (leg2 as any).aggWinner !== 'TBD') {
                aggWinner = (leg2 as any).aggWinner;
            } else if (leg1 && (leg1 as any).aggWinner && (leg1 as any).aggWinner !== 'TBD') {
                aggWinner = (leg1 as any).aggWinner;
            }
            // 🔥 2순위: 다음 라운드 슬롯에 이미 팀이 진출해 있는지 확인
            else if (targetNextSlotTeam && targetNextSlotTeam !== 'TBD' && targetNextSlotTeam !== 'BYE' && targetNextSlotTeam !== '') {
                aggWinner = targetNextSlotTeam;
            } 
            // 🔥 3순위: 일반적인 점수 합산으로 승자 계산
            else if (isLeg1Done && (!leg2 || isLeg2Done)) {
                if (s1 > s2) aggWinner = t1; else if (s2 > s1) aggWinner = t2;
            }
            
            return { 
                ...leg1, 
                homeScore: isLeg1Done || isLeg2Done ? String(s1) : '', 
                awayScore: isLeg1Done || isLeg2Done ? String(s2) : '', 
                status: (isLeg1Done && (!leg2 || isLeg2Done)) ? 'COMPLETED' : 'UPCOMING', 
                aggWinner 
            };
        };

        const playoffRounds = currentSeason.rounds.filter((r: any) => ['ROUND_OF_4', 'SEMI_FINAL', 'FINAL'].includes(r.name));
        const displayRounds = JSON.parse(JSON.stringify(playoffRounds)); 
        const po4Rounds = displayRounds.filter((r: any) => r.name === 'ROUND_OF_4').flatMap((r: any) => r.matches);
        const poFinalRounds = displayRounds.filter((r: any) => r.name === 'SEMI_FINAL').flatMap((r: any) => r.matches);
        const grandFinalRounds = displayRounds.filter((r: any) => r.name === 'FINAL').flatMap((r: any) => r.matches);

        const actualPoFinal_leg1 = poFinalRounds.find((m: any) => m.matchLabel?.includes('1차전'));
        const actualGrandFinal = grandFinalRounds.length > 0 ? grandFinalRounds[0] : null;

        const poSemi1_leg1 = po4Rounds.find((m: any) => m.matchLabel?.includes('5위') && m.matchLabel?.includes('1차전'));
        const poSemi1_leg2 = po4Rounds.find((m: any) => m.matchLabel?.includes('2위') && m.matchLabel?.includes('2차전'));
        const poSemi2_leg1 = po4Rounds.find((m: any) => m.matchLabel?.includes('4위') && m.matchLabel?.includes('1차전'));
        const poSemi2_leg2 = po4Rounds.find((m: any) => m.matchLabel?.includes('3위') && m.matchLabel?.includes('2차전'));

        const compSemi1 = calcAgg(poSemi1_leg1, poSemi1_leg2, actualPoFinal_leg1?.home);
        const compSemi2 = calcAgg(poSemi2_leg1, poSemi2_leg2, actualPoFinal_leg1?.away);

        if (compSemi1?.aggWinner && compSemi1.aggWinner !== 'TBD') {
            poFinalRounds.forEach((m: any) => { const info = getTeamExtendedInfo(compSemi1.aggWinner); m.home = info.name; m.homeLogo = info.logo; m.homeOwner = info.ownerName; m.homeOwnerUid = info.ownerUid; });
        }
        if (compSemi2?.aggWinner && compSemi2.aggWinner !== 'TBD') {
            poFinalRounds.forEach((m: any) => { const info = getTeamExtendedInfo(compSemi2.aggWinner); m.away = info.name; m.awayLogo = info.logo; m.awayOwner = info.ownerName; m.awayOwnerUid = info.ownerUid; });
        }

        const poFinal_leg1 = poFinalRounds.find((m: any) => m.matchLabel?.includes('1차전'));
        const poFinal_leg2 = poFinalRounds.find((m: any) => m.matchLabel?.includes('2차전'));
        
        const compPoFinal = calcAgg(poFinal_leg1, poFinal_leg2, actualGrandFinal?.away);

        if (compPoFinal?.aggWinner && compPoFinal.aggWinner !== 'TBD') {
            grandFinalRounds.forEach((m: any) => { const info = getTeamExtendedInfo(compPoFinal.aggWinner); m.away = info.name; m.awayLogo = info.logo; m.awayOwner = info.ownerName; m.awayOwnerUid = info.ownerUid; });
        }

        return { compSemi1, compSemi2, compPoFinal, displayGrandFinal: grandFinalRounds.length > 0 ? grandFinalRounds[0] : null };
    }, [currentSeason, activeRankingData, masterTeams, owners]);

    const BracketMatchBox = ({ match, title, highlight = false }: any) => {
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

        const renderRow = (teamName: string, score: number | null, isWinner: boolean, owner: string, ownerUid: string | undefined, logo: string) => {
            const isTbd = teamName === 'TBD' || !teamName;
            const displayLogo = (isTbd || logo?.includes('uefa.com')) ? SAFE_TBD_LOGO : (logo || FALLBACK_IMG);
            const dispOwner = resolveOwnerNickname(owner, ownerUid) || '-';

            return (
                <div className={`flex items-center justify-between px-3 py-2.5 h-[50px] ${isWinner ? 'bg-gradient-to-r from-emerald-900/40 to-transparent' : ''} ${isTbd ? 'opacity-30' : ''}`}>
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0 ${isTbd ? 'bg-slate-700' : 'bg-white'}`}>
                            <img src={displayLogo} className={`${isTbd ? 'w-full h-full' : 'w-[70%] h-[70%]'} object-contain`} alt="" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} />
                        </div>
                        <div className="flex flex-col justify-center min-w-0">
                            <span className={`text-[11px] font-black leading-tight truncate uppercase tracking-tight ${isWinner ? 'text-white' : 'text-slate-400'}`}>
                                {teamName || 'TBD'}
                            </span>
                            {!isTbd && (
                                <span className="text-[9px] text-slate-500 font-bold italic truncate mt-0.5">{dispOwner}</span>
                            )}
                        </div>
                    </div>
                    <div className={`text-lg font-black italic tracking-tighter w-8 text-right ${isWinner ? 'text-emerald-400' : 'text-slate-600'}`}>
                        {score ?? '-'}
                    </div>
                </div>
            );
        };

        return (
            <div className="flex flex-col w-[200px] sm:w-[220px]">
                {title && <div className="text-[9px] font-bold text-slate-500 uppercase mb-1.5 pl-1 tracking-widest opacity-60">{title}</div>}
                <div className={`flex flex-col bg-[#0f141e]/90 backdrop-blur-md border rounded-xl overflow-hidden shadow-xl relative z-10 ${highlight ? 'border-yellow-500/50 shadow-yellow-500/20' : 'border-slate-800/50'}`}>
                    {renderRow(match.home, hScore, isHomeWin, match.homeOwner, (match as any).homeOwnerUid, match.homeLogo)}
                    <div className="h-[1px] bg-slate-800/40 w-full relative"></div>
                    {renderRow(match.away, aScore, isAwayWin, match.awayOwner, (match as any).awayOwnerUid, match.awayLogo)}
                </div>
            </div>
        );
    };

    if (!hybridPlayoffData) return null;

    return (
        <div className="overflow-x-auto pb-4 no-scrollbar mb-8">
            <style dangerouslySetInnerHTML={{ __html: `
                .bracket-tree { display: inline-flex; align-items: center; justify-content: flex-start; gap: 40px; padding: 10px 0 20px 4px; min-width: max-content; }
                .bracket-column { display: flex; flex-direction: column; justify-content: center; gap: 40px; position: relative; }
            `}} />
            <div className="min-w-max md:min-w-[760px] px-2 pt-2">
                <div className="bracket-tree no-scrollbar">
                    {/* 1단계: PO 4강 */}
                    <div className="bracket-column">
                        <BracketMatchBox match={hybridPlayoffData.compSemi1} title="PO 4강 1경기 (합산)" />
                        <BracketMatchBox match={hybridPlayoffData.compSemi2} title="PO 4강 2경기 (합산)" />
                    </div>
                    {/* 2단계: PO 결승 */}
                    <div className="bracket-column">
                        <BracketMatchBox match={hybridPlayoffData.compPoFinal} title="PO 결승 (합산)" />
                    </div>
                    {/* 3단계: 대망의 결승전 (1위 직행팀 대기) */}
                    <div className="bracket-column">
                        <div className="relative scale-110 ml-4">
                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-2xl animate-bounce">👑</div>
                            <BracketMatchBox match={hybridPlayoffData.displayGrandFinal} title="🏆 Grand Final (단판)" highlight />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};