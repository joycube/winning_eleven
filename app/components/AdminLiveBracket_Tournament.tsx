"use client";

import React, { useEffect, useState } from 'react';
import { Season, Match } from '../types';

// 컴포넌트 임포트 (Named, Default 모두 대응)
import AdminMatching_TournamentBracketViewDefault, { AdminMatching_TournamentBracketView as AdminMatching_TournamentBracketViewNamed } from './AdminMatching_TournamentBracketView';
const AdminMatching_TournamentBracketView = AdminMatching_TournamentBracketViewDefault || AdminMatching_TournamentBracketViewNamed;

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

// 🔥 [핵심 픽스] Vercel이 절대 에러를 뱉지 못하도록 고유한 이름의 Interface를 선언합니다.
interface AdminLiveBracketProps {
    targetSeason: Season;
    tourneyTargetSize: number;
}

// 🔥 Props에 명확하게 AdminLiveBracketProps 타입을 지정
export const AdminLiveBracket_Tournament = ({ targetSeason, tourneyTargetSize }: AdminLiveBracketProps) => {
    const [knockoutStages, setKnockoutStages] = useState<any>(null);

    useEffect(() => {
        if (!targetSeason || !targetSeason.rounds) return;

        const createPlaceholder = (vId: string, stageName: string): Match => ({ 
            id: vId, home: 'TBD', away: 'TBD', homeScore: '', awayScore: '', status: 'UPCOMING',
            seasonId: targetSeason.id, homeLogo: SAFE_TBD_LOGO, awayLogo: SAFE_TBD_LOGO, homeOwner: '-', awayOwner: '-',
            homePredictRate: 0, awayPredictRate: 0, stage: stageName, matchLabel: 'TBD', youtubeUrl: '',
            homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: []
        } as Match);

        const slots = {
            roundOf8: Array.from({ length: 4 }, (_, i) => createPlaceholder(`v-r8-${i}`, 'ROUND_OF_8')),
            roundOf4: Array.from({ length: 2 }, (_, i) => createPlaceholder(`v-r4-${i}`, 'SEMI_FINAL')),
            thirdPlace: [createPlaceholder('v-3rd', '3RD_PLACE')],
            final: [createPlaceholder('v-final', 'FINAL')]
        };

        let hasActualRoundOf8 = false;
        let hasActualRoundOf4 = false;
        const groupSet = new Set<string>();

        targetSeason.rounds.forEach((round) => {
            if (!round.matches) return;
            const totalMatchesInRound = round.matches.length;

            round.matches.forEach((m, localIdx) => {
                const stage = m.stage?.toUpperCase() || "";
                const label = m.matchLabel?.toUpperCase() || "";
                
                if (stage.includes("GROUP") || stage.includes("조별")) {
                    if (m.group) groupSet.add(m.group);
                    return;
                }

                const idMatch = m.id?.match ? m.id.match(/_M?(\d+)$/) : null;
                const idx = idMatch ? parseInt(idMatch[1], 10) : localIdx;
                const mSafe = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };

                const isThird = stage.includes("3RD") || stage.includes("34") || stage.includes("THIRD") || stage.includes("3·4위") || label.includes("3·4위");
                const isFinal = stage.includes("FINAL") || stage.includes("결승") || label.includes("결승");
                const isSemi = stage.includes("SEMI") || stage.includes("ROUND_OF_4") || stage.includes("4강") || stage.includes("준결승") || label.includes("4강");
                const isQuarter = stage.includes("ROUND_OF_8") || stage.includes("QUARTER") || stage.includes("8강") || label.includes("8강");

                let fallbackFinal = false;
                let fallbackSemi = false;
                let fallbackQuarter = false;

                if (stage === "TOURNAMENT" || stage === "토너먼트") {
                     if (totalMatchesInRound === 1) fallbackFinal = true;
                     else if (totalMatchesInRound === 2) fallbackSemi = true;
                     else if (totalMatchesInRound === 3) {
                         if (localIdx === 2) fallbackFinal = true;
                         else fallbackSemi = true;
                     }
                     else if (totalMatchesInRound === 4) fallbackQuarter = true;
                     else if (totalMatchesInRound === 7) {
                         if (localIdx === 6) fallbackFinal = true;
                         else if (localIdx >= 4) fallbackSemi = true;
                         else fallbackQuarter = true;
                     }
                }

                if (isThird) {
                    slots.thirdPlace[0] = mSafe;
                } else if (isFinal || fallbackFinal) {
                    slots.final[0] = mSafe;
                } else if (isSemi || fallbackSemi) {
                    let targetIdx = idx < 2 ? idx : localIdx;
                    if (totalMatchesInRound === 3) targetIdx = localIdx;
                    else if (totalMatchesInRound === 7) targetIdx = localIdx - 4;
                    
                    if (targetIdx < slots.roundOf4.length) {
                        slots.roundOf4[targetIdx] = mSafe;
                        hasActualRoundOf4 = true;
                    }
                } else if (isQuarter || fallbackQuarter) {
                    let targetIdx = idx < 4 ? idx : localIdx;
                    if (targetIdx < slots.roundOf8.length) {
                        slots.roundOf8[targetIdx] = mSafe;
                        hasActualRoundOf8 = true; 
                    }
                }
            });
        });

        const needsRoundOf8 = hasActualRoundOf8 || groupSet.size >= 3 || tourneyTargetSize >= 8;
        const needsRoundOf4 = hasActualRoundOf4 || groupSet.size > 0 || tourneyTargetSize >= 4;

        setKnockoutStages({ 
            ...slots, 
            roundOf8: needsRoundOf8 ? slots.roundOf8 : null,
            roundOf4: needsRoundOf4 ? slots.roundOf4 : null
        });

    }, [targetSeason, tourneyTargetSize]);

    if (!knockoutStages) return <div className="text-center text-slate-500 py-10 italic">대진표 데이터를 로딩 중입니다...</div>;

    return (
        <div className="w-full flex flex-col items-center gap-10">
            <AdminMatching_TournamentBracketView knockoutStages={knockoutStages} isUserView={false} />
        </div>
    );
};

// 🔥 부모 컴포넌트에서 import 방식이 꼬였을 경우를 대비한 보험 (Default Export 추가)
export default AdminLiveBracket_Tournament;