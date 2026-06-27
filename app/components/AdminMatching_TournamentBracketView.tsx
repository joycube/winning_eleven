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

    // 🔥 [버그 픽스] 유저뷰 토너먼트 브래킷 표시 조건 수정
    //   - 기존 문제: hasRealData() 가 가상 ID('v-r8-0' 등)나 TBD 팀을 false로 판정해서,
    //     8강 진출팀이 결정되기 전까지 브래킷에 결승만 덩그러니 표시되던 버그
    //   - 수정: 라운드 슬롯이 존재(배열로 정의)하면 TBD 상태라도 브래킷 빈 슬롯으로 표시
    //     → 그룹 스테이지 진행 중에도 토너먼트 구조 전체를 미리 볼 수 있음
    //   - 매치카드 영역(하단)과 브래킷(상단) 표시 일관성 회복
    const show8 = Array.isArray(knockoutStages.roundOf8) && knockoutStages.roundOf8.length > 0;
    const show4 = Array.isArray(knockoutStages.roundOf4) && knockoutStages.roundOf4.length > 0;
    const show3rd = Array.isArray(knockoutStages.thirdPlace) && knockoutStages.thirdPlace.length > 0;

    // 🔥 [핵심 이식] 1번 스크린샷과 동일한 그라데이션 및 CSS가 적용된 컴포넌트
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
                        <div className={`w-8 h-8 rounded-full shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0 ${isTbd ? 'bg-slate-700' : 'bg-white p-[5px]'}`}>
                            <img src={displayLogo} className={`w-full h-full object-contain ${isTbd ? 'opacity-60' : ''}`} alt="" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} />
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

    // 🛠️ [UI 픽스 v2] 이중 overflow-x-auto 제거 — 부모 컨테이너가 단일 스크롤 핸들링
    return (
        <div className="pb-8">
            <style dangerouslySetInnerHTML={{ __html: `
                .bracket-tree { display: inline-flex; align-items: center; justify-content: flex-start; gap: 40px; padding: 10px 0 20px 4px; min-width: max-content; }
                .bracket-column { display: flex; flex-direction: column; justify-content: center; gap: 40px; position: relative; }
                .bracket-column-wide { display: flex; flex-direction: column; justify-content: space-around; gap: 80px; position: relative; }
                /* 🛠️ [UI 픽스 v2] BRACKET 부드러운 가로 스크롤 (iOS 모멘텀 + scroll-behavior smooth) */
                .bracket-scroll-smooth {
                    -webkit-overflow-scrolling: touch;
                    scroll-behavior: smooth;
                    overscroll-behavior-x: contain;
                }
            `}} />
            <div className="bracket-tree">

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
