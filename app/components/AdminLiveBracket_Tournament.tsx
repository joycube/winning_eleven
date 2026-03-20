"use client";

import React, { useEffect, useState } from 'react'; // 🔥 1. useEffect, useState 추가
import { Season, Match } from '../types';
import { TeamCard } from './TeamCard';
import { FALLBACK_IMG } from '../types';

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

interface Props {
    targetSeason: Season;
    tourneyTargetSize: number;
    // 필요한 데이터 프롭스들 (메인에서 내려받는다고 가정)
    isLoaded?: boolean;
    currentView?: string;
    seasons?: Season[];
    viewSeasonId?: number;
    activeRankingData?: any;
    masterTeams?: any[];
    getOwnerUidByName?: (name: string) => string | undefined;
}

export const AdminLiveBracket_Tournament = ({ 
    targetSeason, 
    tourneyTargetSize,
    isLoaded,
    currentView,
    seasons,
    viewSeasonId,
    activeRankingData,
    masterTeams,
    getOwnerUidByName
}: Props) => {
    // 🔥 내부 상태로 knockoutStages 관리
    const [knockoutStages, setKnockoutStages] = useState<any>(null);

    // 🔥 [수정된 부분] useEffect는 반드시 컴포넌트 함수 내부 이 위치에 있어야 합니다.
    useEffect(() => {
        if (!isLoaded || !seasons || viewSeasonId === undefined) return;

        const timer = setTimeout(() => {
            const currentSeason = seasons.find(s => s.id === viewSeasonId);
            if (!currentSeason || (currentSeason.type !== 'CUP' && currentSeason.type !== 'TOURNAMENT') || !currentSeason.rounds) {
                setKnockoutStages(null);
                return;
            }

            const getWinnerName = (match: Match | null): string => {
                if (!match) return 'TBD';
                const home = match.home?.trim();
                const away = match.away?.trim();
                if (home === 'BYE' && away !== 'BYE' && away !== 'TBD') return away;
                if (away === 'BYE' && home !== 'BYE' && home !== 'TBD') return home;
                if (match.status !== 'COMPLETED') return 'TBD';
                const h = Number(match.homeScore || 0);
                const a = Number(match.awayScore || 0);
                return h > a ? match.home : (a > h ? match.away : 'TBD');
            };

            const getTeamMeta = (name: string) => {
                if (!name || name === 'TBD') return { logo: SAFE_TBD_LOGO, owner: '-', ownerUid: undefined };
                if (name === 'BYE') return { logo: SAFE_TBD_LOGO, owner: 'SYSTEM', ownerUid: undefined };
                const normName = name.toLowerCase().trim();
                const stats = activeRankingData?.teams?.find((t: any) => t.name.toLowerCase().trim() === normName);
                const master = masterTeams?.find((m: any) => (m.name || m.teamName || '').toLowerCase().trim() === normName);
                const ownerName = stats?.ownerName || (master as any)?.ownerName || 'CPU';
                return {
                    logo: stats?.logo || (master as any)?.logo || SAFE_TBD_LOGO,
                    owner: ownerName,
                    ownerUid: getOwnerUidByName ? getOwnerUidByName(ownerName) : undefined
                };
            };

            const createPlaceholder = (vId: string, stageName: string): Match => ({ 
                id: vId, home: 'TBD', away: 'TBD', homeScore: '', awayScore: '', status: 'UPCOMING',
                seasonId: viewSeasonId, homeLogo: SAFE_TBD_LOGO, awayLogo: SAFE_TBD_LOGO, homeOwner: '-', awayOwner: '-',
                homeOwnerUid: undefined, awayOwnerUid: undefined,
                homePredictRate: 0, awayPredictRate: 0, stage: stageName, matchLabel: 'TBD', youtubeUrl: '',
                homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: []
            } as Match);

            const slots = {
                roundOf8: Array.from({ length: 4 }, (_, i) => createPlaceholder(`v-r8-${i}`, 'ROUND_OF_8')),
                roundOf4: Array.from({ length: 2 }, (_, i) => createPlaceholder(`v-r4-${i}`, 'ROUND_OF_4')),
                final: [createPlaceholder('v-final', 'FINAL')]
            };

            let hasActualRoundOf8 = false;
            const groupSet = new Set<string>();

            currentSeason.rounds.forEach((round) => {
                round.matches?.forEach((m) => {
                    const stage = m.stage?.toUpperCase() || "";
                    if (stage.includes("GROUP")) {
                        if (m.group) groupSet.add(m.group);
                        return;
                    }
                    const idMatch = m.id.match(/_(\d+)$/);
                    const idx = idMatch ? parseInt(idMatch[1], 10) : 0;

                    if (stage.includes("FINAL") && !stage.includes("SEMI") && !stage.includes("QUARTER")) {
                        slots.final[0] = { ...m };
                    } else if (stage.includes("SEMI") || stage.includes("ROUND_OF_4")) {
                        if (idx < 2) slots.roundOf4[idx] = { ...m };
                    } else if (stage.includes("ROUND_OF_8") || stage.includes("QUARTER")) {
                        if (idx < 4) slots.roundOf8[idx] = { ...m };
                        hasActualRoundOf8 = true;
                    }
                });
            });

            const needsRoundOf8 = hasActualRoundOf8 || groupSet.size >= 3;

            const sync = (target: any, side: 'home' | 'away', source: Match | null) => {
                if (!target || !source) return;
                const winner = getWinnerName(source);
                if (winner !== 'TBD' && winner !== 'BYE' && (target[side] === 'TBD' || !target[side] || target[side] === 'BYE')) {
                    target[side] = winner;
                    const meta = getTeamMeta(winner);
                    target[`${side}Logo`] = meta.logo;
                    target[`${side}Owner`] = meta.owner;
                    target[`${side}OwnerUid`] = meta.ownerUid; 
                }
            };

            if (needsRoundOf8) {
                sync(slots.roundOf4[0], 'home', slots.roundOf8[0]);
                sync(slots.roundOf4[0], 'away', slots.roundOf8[1]);
                sync(slots.roundOf4[1], 'home', slots.roundOf8[2]);
                sync(slots.roundOf4[1], 'away', slots.roundOf8[3]);
            }
            sync(slots.final[0], 'home', slots.roundOf4[0]);
            sync(slots.final[0], 'away', slots.roundOf4[1]);

            setKnockoutStages({
                ...slots,
                roundOf8: needsRoundOf8 ? slots.roundOf8 : null
            });
        }, 10);

        return () => clearTimeout(timer);
    }, [seasons, viewSeasonId, activeRankingData, masterTeams, currentView, isLoaded]);

    // ... 기존 렌더링 로직 (totalRounds 계산 등) ...

    return (
        <div className="w-full flex flex-col items-center gap-10">
            {/* 렌더링 코드 구현 */}
            <p className="text-white text-xs">브래킷 데이터 로드됨</p>
        </div>
    );
};