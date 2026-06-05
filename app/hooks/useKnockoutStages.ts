// app/hooks/useKnockoutStages.ts
//
// 🛠️ [Day 2 분할] page.tsx 에서 분리
//   - CUP/TOURNAMENT 시즌의 토너먼트 진출 자동 추적
//   - SEMI 승자 → FINAL, SEMI 패자 → 3·4위전 자동 채움
//   - RANKING/SCHEDULE 뷰에서만 동작 (다른 뷰에선 null)

"use client";

import { useState, useEffect } from 'react';
import type { Match, Season, MasterTeam } from '../types';

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

export const useKnockoutStages = (
  seasons: Season[],
  viewSeasonId: number,
  activeRankingData: any,
  masterTeams: MasterTeam[] | undefined | null,
  currentView: string,
  isLoaded: boolean,
  getOwnerUidByName: (name: string) => string | undefined
) => {
  const [knockoutStages, setKnockoutStages] = useState<any>(null);

  useEffect(() => {
    if (!isLoaded || (currentView !== 'RANKING' && currentView !== 'SCHEDULE')) return;

    const timer = setTimeout(() => {
      const currentSeason = seasons.find(s => s.id === viewSeasonId);
      if (
        !currentSeason ||
        (currentSeason.type !== 'CUP' && currentSeason.type !== 'TOURNAMENT') ||
        !currentSeason.rounds
      ) {
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
        if (h > a) return match.home;
        if (a > h) return match.away;
        return 'TBD';
      };

      const getTeamMeta = (name: string) => {
        if (!name || name === 'TBD') return { logo: SAFE_TBD_LOGO, owner: '-', ownerUid: undefined };
        if (name === 'BYE') return { logo: SAFE_TBD_LOGO, owner: 'SYSTEM', ownerUid: undefined };
        const normName = name.toLowerCase().trim();
        const stats = activeRankingData?.teams?.find((t: any) => t.name.toLowerCase().trim() === normName);
        const master = masterTeams?.find((m: any) => (m.name || (m as any).teamName || '').toLowerCase().trim() === normName);

        const ownerName = stats?.ownerName || (master as any)?.ownerName || 'CPU';
        return {
          logo: stats?.logo || (master as any)?.logo || SAFE_TBD_LOGO,
          owner: ownerName,
          ownerUid: getOwnerUidByName(ownerName),
        };
      };

      const createPlaceholder = (vId: string, stageName: string): Match => ({
        id: vId, home: 'TBD', away: 'TBD', homeScore: '', awayScore: '', status: 'UPCOMING',
        seasonId: viewSeasonId, homeLogo: SAFE_TBD_LOGO, awayLogo: SAFE_TBD_LOGO, homeOwner: '-', awayOwner: '-',
        homeOwnerUid: undefined, awayOwnerUid: undefined,
        homePredictRate: 0, awayPredictRate: 0, stage: stageName, matchLabel: 'TBD', youtubeUrl: '',
        homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [],
      } as Match);

      const slots = {
        roundOf8: Array.from({ length: 4 }, (_, i) => createPlaceholder(`v-r8-${i}`, 'ROUND_OF_8')),
        roundOf4: Array.from({ length: 2 }, (_, i) => createPlaceholder(`v-r4-${i}`, 'ROUND_OF_4')),
        thirdPlace: [createPlaceholder('v-3rd', '3RD_PLACE')],
        final: [createPlaceholder('v-final', 'FINAL')],
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

          if (stage.includes("3RD_PLACE") || stage.includes("34") || stage.includes("THIRD")) {
            slots.thirdPlace[0] = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };
          } else if (stage.includes("FINAL") && !stage.includes("SEMI") && !stage.includes("QUARTER")) {
            slots.final[0] = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };
          } else if (stage.includes("SEMI") || stage.includes("ROUND_OF_4")) {
            if (idx < 2) slots.roundOf4[idx] = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };
          } else if (stage.includes("ROUND_OF_8") || stage.includes("QUARTER")) {
            if (idx < 4) slots.roundOf8[idx] = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };
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
          target[`${side}Score`] = '';
        }
      };

      const syncLoser = (target: any, side: 'home' | 'away', source: Match | null) => {
        if (!target || !source) return;
        const winner = getWinnerName(source);
        if (winner !== 'TBD' && winner !== 'BYE') {
          const loser = winner === source.home ? source.away : source.home;
          if (loser !== 'TBD' && loser !== 'BYE' && (target[side] === 'TBD' || !target[side] || target[side] === 'BYE')) {
            target[side] = loser;
            const meta = getTeamMeta(loser);
            target[`${side}Logo`] = meta.logo;
            target[`${side}Owner`] = meta.owner;
            target[`${side}OwnerUid`] = meta.ownerUid;
            target[`${side}Score`] = '';
          }
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

      syncLoser(slots.thirdPlace[0], 'home', slots.roundOf4[0]);
      syncLoser(slots.thirdPlace[0], 'away', slots.roundOf4[1]);

      setKnockoutStages({
        ...slots,
        roundOf8: needsRoundOf8 ? slots.roundOf8 : null,
        thirdPlace: slots.thirdPlace,
      });
    }, 10);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasons, viewSeasonId, activeRankingData, masterTeams, currentView, isLoaded]);

  return knockoutStages;
};
