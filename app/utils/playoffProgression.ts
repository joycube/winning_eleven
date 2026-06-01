// app/utils/playoffProgression.ts
// 🛠️ [TBD 패치] 가상 매치 실제 팀 추론 + LEAGUE_PLAYOFF 자동 진출 채우기 헬퍼
//
// 사용 위치: page.tsx::handleSaveMatchResult
//
// 안전 원칙:
//  1. 기존 마감된 시즌의 데이터는 절대 자동 변경하지 않음 (호출 시점에만 작동)
//  2. 목적지 매치가 이미 COMPLETED 이면 진출 갱신 스킵 (기존 데이터 보존)
//  3. 합산 무승부면 갱신 스킵 (수동 승자 결정 필요)
//  4. 가상 매치(v-3rd, v-final) 추론 실패 시 null 반환 → 호출자가 사용자에게 안내
//  5. 어떤 경우에도 예외(throw) 던지지 않고 정상 흐름 유지

import type { Match } from '../types';

// --------------------------------------------------------------------
// 타입
// --------------------------------------------------------------------
export type TeamSlot = {
  name: string;
  logo: string;
  owner: string;
  ownerUid: string;
};

export type ResolvedMatchTeams = {
  home: TeamSlot;
  away: TeamSlot;
};

// --------------------------------------------------------------------
// 기본 헬퍼
// --------------------------------------------------------------------
const getTeamSlot = (m: any, side: 'home' | 'away'): TeamSlot => {
  if (side === 'home') {
    return {
      name: m?.home ?? '',
      logo: m?.homeLogo ?? '',
      owner: m?.homeOwner ?? '',
      ownerUid: m?.homeOwnerUid ?? '',
    };
  }
  return {
    name: m?.away ?? '',
    logo: m?.awayLogo ?? '',
    owner: m?.awayOwner ?? '',
    ownerUid: m?.awayOwnerUid ?? '',
  };
};

const isTbdName = (name: string | undefined | null): boolean => {
  if (!name) return true;
  const s = String(name).trim().toUpperCase();
  return s === '' || s === 'TBD' || s === '-';
};

const applyTeamToMatch = (m: any, side: 'home' | 'away', team: TeamSlot): any => {
  if (side === 'home') {
    return {
      ...m,
      home: team.name,
      homeLogo: team.logo,
      homeOwner: team.owner,
      homeOwnerUid: team.ownerUid,
    };
  }
  return {
    ...m,
    away: team.name,
    awayLogo: team.logo,
    awayOwner: team.owner,
    awayOwnerUid: team.ownerUid,
  };
};

// --------------------------------------------------------------------
// 단판(1차전 only) 매치의 승자/패자
// --------------------------------------------------------------------
export const getSingleMatchWinnerLoser = (
  m: any
): { winner: TeamSlot; loser: TeamSlot } | null => {
  if (!m || m.status !== 'COMPLETED') return null;

  // BYE 처리 — 부전승 상대팀이 자동 승자
  if (String(m.away || '').toUpperCase().includes('BYE')) {
    return { winner: getTeamSlot(m, 'home'), loser: getTeamSlot(m, 'away') };
  }
  if (String(m.home || '').toUpperCase().includes('BYE')) {
    return { winner: getTeamSlot(m, 'away'), loser: getTeamSlot(m, 'home') };
  }

  // 수동 승자 우선 (PK 승 등)
  const aggW = (m as any).aggWinner;
  if (aggW && aggW !== 'TBD') {
    if (aggW === m.home) return { winner: getTeamSlot(m, 'home'), loser: getTeamSlot(m, 'away') };
    if (aggW === m.away) return { winner: getTeamSlot(m, 'away'), loser: getTeamSlot(m, 'home') };
  }

  const h = Number(m.homeScore || 0);
  const a = Number(m.awayScore || 0);
  if (h > a) return { winner: getTeamSlot(m, 'home'), loser: getTeamSlot(m, 'away') };
  if (a > h) return { winner: getTeamSlot(m, 'away'), loser: getTeamSlot(m, 'home') };
  return null; // 무승부 — 수동 승자 결정 필요
};

// --------------------------------------------------------------------
// 가상 매치(v-3rd, v-final) 실제 팀 추론 (CUP 타입 전용)
// --------------------------------------------------------------------
//   SEMI_FINAL 두 매치의 승자/패자로 v-final, v-3rd 의 home/away 추론
//   준비 안 됨(SEMI 미완료)이면 null 반환
export const resolveVirtualMatchTeams = (
  vMatchId: string,
  rounds: any[] | undefined
): ResolvedMatchTeams | null => {
  if (!rounds || !vMatchId) return null;
  if (!vMatchId.startsWith('v-')) return null;

  // 모든 라운드의 매치 평탄화
  const allMatches: any[] = rounds.flatMap((r: any) => r?.matches || []);

  // SEMI_FINAL stage 인 완료된 매치만
  const semis = allMatches.filter(
    (m: any) =>
      String(m?.stage || '').toUpperCase() === 'SEMI_FINAL' && m?.status === 'COMPLETED'
  );

  if (semis.length < 2) return null; // 진출 결정 불가

  const [s1, s2] = semis.slice(0, 2);
  const wl1 = getSingleMatchWinnerLoser(s1);
  const wl2 = getSingleMatchWinnerLoser(s2);
  if (!wl1 || !wl2) return null;

  // 3·4위전 — SEMI 패자들
  if (vMatchId === 'v-3rd' || vMatchId.toLowerCase().includes('3rd')) {
    return { home: wl1.loser, away: wl2.loser };
  }
  // 결승전 — SEMI 승자들
  if (vMatchId === 'v-final' || vMatchId.toLowerCase().includes('final')) {
    return { home: wl1.winner, away: wl2.winner };
  }
  // v-r4-N, v-r8-N 등은 일단 미지원 (기존 nextMatchId 로직이 처리)
  return null;
};

// --------------------------------------------------------------------
// LEAGUE_PLAYOFF — 2차전 합산 승자 계산
//   leg1: home A vs away B (1차전)
//   leg2: home B vs away A (2차전, 홈/원정 바뀜)
//   합산: A_total = leg1.home + leg2.away,  B_total = leg1.away + leg2.home
// --------------------------------------------------------------------
export const computeLeaguePOTieWinner = (
  leg1: any,
  leg2: any
): TeamSlot | null => {
  if (!leg1 || !leg2) return null;
  if (leg1.status !== 'COMPLETED' || leg2.status !== 'COMPLETED') return null;

  // 수동 승자 우선 (어느 leg 에 있든)
  const aggW = (leg2 as any).aggWinner || (leg1 as any).aggWinner;
  if (aggW && aggW !== 'TBD') {
    if (aggW === leg1.home) return getTeamSlot(leg1, 'home');
    if (aggW === leg1.away) return getTeamSlot(leg1, 'away');
  }

  const A = Number(leg1.homeScore || 0) + Number(leg2.awayScore || 0);
  const B = Number(leg1.awayScore || 0) + Number(leg2.homeScore || 0);

  if (A > B) return getTeamSlot(leg1, 'home');
  if (B > A) return getTeamSlot(leg1, 'away');
  return null; // 합산 무승부 — 수동 승자 결정 필요
};

// --------------------------------------------------------------------
// LEAGUE_PLAYOFF 진출 자동 채우기
//   호출 시점: 점수 입력 후 newRounds 가 갱신된 직후
//   매칭 ID 패턴:
//     ROUND_OF_4: po_{seasonId}_4_{tieNum}_{legNum}  (tieNum: 1 또는 2, legNum: 1 또는 2)
//     SEMI_FINAL: po_{seasonId}_fin_{legNum}
//     FINAL:      po_{seasonId}_grand_fin_1
//
//   안전 원칙: 목적지 매치가 이미 COMPLETED 면 갱신 스킵 (기존 결과 보존)
// --------------------------------------------------------------------
export const applyLeaguePlayoffProgression = (
  newRounds: any[],
  scoredMatchId: string,
  seasonId: number | string
): any[] => {
  if (!newRounds || !scoredMatchId) return newRounds;

  const sId = String(seasonId);

  // ─── 1) ROUND_OF_4 점수 완료 → SEMI_FINAL TBD 채우기 ──────────────
  const r4Pattern = new RegExp(`^po_${sId}_4_(\\d)_(\\d)$`);
  const r4m = scoredMatchId.match(r4Pattern);
  if (r4m) {
    const tieNum = r4m[1]; // '1' 또는 '2'

    const r4Round = newRounds.find((r: any) => r?.name === 'ROUND_OF_4');
    if (!r4Round) return newRounds;

    const tieMatches = (r4Round.matches || []).filter((m: any) =>
      new RegExp(`^po_${sId}_4_${tieNum}_\\d$`).test(m.id || '')
    );

    if (tieMatches.length !== 2) return newRounds;
    if (!tieMatches.every((l: any) => l?.status === 'COMPLETED')) return newRounds;

    const leg1 = tieMatches.find((l: any) => String(l.id).endsWith('_1'));
    const leg2 = tieMatches.find((l: any) => String(l.id).endsWith('_2'));
    if (!leg1 || !leg2) return newRounds;

    const winner = computeLeaguePOTieWinner(leg1, leg2);
    if (!winner) return newRounds; // 합산 무승부 → 수동 승자 결정 후 재시도

    // SEMI_FINAL 의 두 매치 갱신
    // tie 1 winner → fin_1: home, fin_2: away
    // tie 2 winner → fin_1: away, fin_2: home
    return newRounds.map((round: any) => {
      if (round?.name !== 'SEMI_FINAL') return round;
      return {
        ...round,
        matches: (round.matches || []).map((m: any) => {
          if (m?.status === 'COMPLETED') return m; // 안전: 이미 결과 있으면 보존

          if (m?.id === `po_${sId}_fin_1`) {
            const side = tieNum === '1' ? 'home' : 'away';
            return applyTeamToMatch(m, side, winner);
          }
          if (m?.id === `po_${sId}_fin_2`) {
            const side = tieNum === '1' ? 'away' : 'home';
            return applyTeamToMatch(m, side, winner);
          }
          return m;
        }),
      };
    });
  }

  // ─── 2) SEMI_FINAL 점수 완료 → GRAND FINAL TBD(away) 채우기 ──────
  const sfPattern = new RegExp(`^po_${sId}_fin_\\d$`);
  if (sfPattern.test(scoredMatchId)) {
    const sfRound = newRounds.find((r: any) => r?.name === 'SEMI_FINAL');
    if (!sfRound) return newRounds;

    const sfLegs = (sfRound.matches || []).filter((m: any) => sfPattern.test(m?.id || ''));
    if (sfLegs.length !== 2) return newRounds;
    if (!sfLegs.every((l: any) => l?.status === 'COMPLETED')) return newRounds;

    const leg1 = sfLegs.find((l: any) => String(l.id).endsWith('_1'));
    const leg2 = sfLegs.find((l: any) => String(l.id).endsWith('_2'));
    if (!leg1 || !leg2) return newRounds;

    const winner = computeLeaguePOTieWinner(leg1, leg2);
    if (!winner) return newRounds;

    return newRounds.map((round: any) => {
      if (round?.name !== 'FINAL') return round;
      return {
        ...round,
        matches: (round.matches || []).map((m: any) => {
          if (m?.id === `po_${sId}_grand_fin_1`) {
            if (m?.status === 'COMPLETED') return m; // 안전: 이미 결과 있으면 보존
            return applyTeamToMatch(m, 'away', winner);
          }
          return m;
        }),
      };
    });
  }

  return newRounds;
};

// --------------------------------------------------------------------
// editingMatch 에 TBD가 박혀있으면 추론된 팀으로 교체한 effectiveMatch 반환
// 이외에는 editingMatch 그대로
// --------------------------------------------------------------------
export const getEffectiveMatch = (
  editingMatch: any,
  matchId: string,
  rounds: any[] | undefined
): { effective: any; needsAlert: boolean } => {
  if (!editingMatch) return { effective: editingMatch, needsAlert: false };

  // 가상 매치 아닌 경우 또는 home/away가 이미 정상이면 그대로
  if (!matchId.startsWith('v-')) {
    return { effective: editingMatch, needsAlert: false };
  }
  if (!isTbdName(editingMatch.home) && !isTbdName(editingMatch.away)) {
    return { effective: editingMatch, needsAlert: false };
  }

  const resolved = resolveVirtualMatchTeams(matchId, rounds);
  if (!resolved) {
    // 추론 실패 — 사용자에게 알림 필요
    return { effective: editingMatch, needsAlert: true };
  }

  return {
    effective: {
      ...editingMatch,
      home: resolved.home.name,
      homeLogo: resolved.home.logo,
      homeOwner: resolved.home.owner,
      homeOwnerUid: resolved.home.ownerUid,
      away: resolved.away.name,
      awayLogo: resolved.away.logo,
      awayOwner: resolved.away.owner,
      awayOwnerUid: resolved.away.ownerUid,
    },
    needsAlert: false,
  };
};