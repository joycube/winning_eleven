// app/utils/handleSaveMatchResult.ts
//
// 🛠️ [Day 2 분할] page.tsx 에서 분리
//   - 매치 점수/스코어러/유튜브 URL 저장
//   - 가상 매치(v-3rd, v-final) TBD 자동 추론 (TBD 패치 v1)
//   - LEAGUE_PLAYOFF 자동 진출 채우기 (TBD 패치)
//   - CUP nextMatchId 진출 로직 보존
//   - TOURNAMENT 분기 원본 보존
//   - 하이라이트 / 푸시 알림 / state 정리까지 일관 처리

import { collection, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Match, MasterTeam, Season } from '../types';
import { calculateMatchSnapshot } from './predictor';
import { processTournamentAdvancement } from './scheduler';
import { sendAutoPush } from './pushUtil';
import { getEffectiveMatch, applyLeaguePlayoffProgression, resolveVirtualMatchTeams } from './playoffProgression';

// 🛠️ [옵션A-2] owner 자동 채움 안전망
//   - 매치 저장 직전 homeOwner/awayOwner 가 비어있거나 TBD 면
//     masterTeams[teamName].ownerName/ownerUid 로 자동 채워서 DB에 영구 저장
//   - 신규 매치 데이터는 항상 정상 owner 보장 → 모든 통계 consumer 자동 정상화
const isInvalidOwner = (v: any) =>
  !v || ['-', 'TBD', 'CPU', 'SYSTEM', 'BYE'].includes(String(v).trim().toUpperCase());

const fillOwnerFromMasterTeams = (m: any, masterTeams: MasterTeam[]): any => {
  if (!m) return m;
  const clean = (s: any) => String(s || '').replace(/\s+/g, '').toLowerCase();
  const findMaster = (teamName: string) => {
    if (!teamName) return undefined;
    const t = clean(teamName);
    return (masterTeams as any[])?.find((mt: any) =>
      clean(mt?.name) === t || clean(mt?.teamName) === t
    );
  };

  let patch: any = {};
  if (isInvalidOwner(m.homeOwner) && m.home && !['TBD', 'BYE'].includes(String(m.home).toUpperCase())) {
    const master: any = findMaster(m.home);
    if (master?.ownerName && !isInvalidOwner(master.ownerName)) {
      patch.homeOwner = master.ownerName;
      if (master.ownerUid) patch.homeOwnerUid = master.ownerUid;
    }
  }
  if (isInvalidOwner(m.awayOwner) && m.away && !['TBD', 'BYE'].includes(String(m.away).toUpperCase())) {
    const master: any = findMaster(m.away);
    if (master?.ownerName && !isInvalidOwner(master.ownerName)) {
      patch.awayOwner = master.ownerName;
      if (master.ownerUid) patch.awayOwnerUid = master.ownerUid;
    }
  }
  return Object.keys(patch).length > 0 ? { ...m, ...patch } : m;
};

const fillOwnersInRounds = (rounds: any[], masterTeams: MasterTeam[]): any[] => {
  if (!rounds) return rounds;
  return rounds.map((r: any) => ({
    ...r,
    matches: (r?.matches || []).map((m: any) => fillOwnerFromMasterTeams(m, masterTeams)),
  }));
};

interface SaveMatchResultDeps {
  editingMatch: Match | null;
  seasons: Season[];
  viewSeasonId: number;
  activeRankingData: any;
  combinedHistoryData: any;
  masterTeams: MasterTeam[];
  getOwnerUidByName: (name: string) => string | undefined;
  setEditingMatch: (m: Match | null) => void;
}

// 팩토리: 의존성을 받아 핸들러 함수를 만든다. page.tsx 에서 한 번 만들고 MatchEditModal 의 onSave 로 넘김.
//   - 시그니처: MatchEditModal 의 기존 호출과 호환되는 positional 형태
export const createHandleSaveMatchResult = (deps: SaveMatchResultDeps) => {
  return async (
    matchId: string,
    hScore: string,
    aScore: string,
    yt: string,
    records: any,
    manualWinner: 'HOME' | 'AWAY' | null
  ) => {
    const { editingMatch, seasons, viewSeasonId, activeRankingData, combinedHistoryData, masterTeams, getOwnerUidByName, setEditingMatch } = deps;

    if (!editingMatch) return;
    const s = seasons.find(se => se.id === editingMatch.seasonId);
    if (!s || !s.rounds) return;

    // 🛠️ [TBD 패치] 가상 매치 실제 팀 추론 (TOURNAMENT 외 타입)
    const { effective: effectiveMatch, needsAlert: needsTeamResolutionAlert } =
      s.type === 'TOURNAMENT'
        ? { effective: editingMatch, needsAlert: false }
        : getEffectiveMatch(editingMatch, matchId, s.rounds);

    if (needsTeamResolutionAlert) {
      setEditingMatch(null);
      return alert('⚠️ 이전 라운드(SEMI_FINAL)의 모든 매치가 확정되지 않았습니다.\n진출 팀이 결정된 후 다시 시도해주세요.');
    }

    const injectUidToPlayers = (players: any[], teamOwnerName: string) => {
      const ownerUid = getOwnerUidByName(teamOwnerName);
      return players.map((p: any) => ({ ...p, ownerUid: ownerUid }));
    };

    // safeRecords 는 effectiveMatch 의 오너 이름 기준 (가상 매치라면 실제 오너로 추론된 값)
    const safeRecords = {
      homeScorers: injectUidToPlayers(records?.homeScorers || [], effectiveMatch.homeOwner),
      awayScorers: injectUidToPlayers(records?.awayScorers || [], effectiveMatch.awayOwner),
      homeAssists: injectUidToPlayers(records?.homeAssists || [], effectiveMatch.homeOwner),
      awayAssists: injectUidToPlayers(records?.awayAssists || [], effectiveMatch.awayOwner),
    };

    // ──────────────────────────────────────────────────────────────────
    // TOURNAMENT 타입 — 원본 로직 그대로
    // ──────────────────────────────────────────────────────────────────
    if (s.type === 'TOURNAMENT') {
      let newRounds = JSON.parse(JSON.stringify(s.rounds));

      const matchIndex = newRounds[0].matches.findIndex((m: any) => m.id === matchId);
      if (matchIndex === -1) return;

      newRounds[0].matches[matchIndex] = {
        ...newRounds[0].matches[matchIndex],
        homeScore: hScore, awayScore: aScore, youtubeUrl: yt, status: 'COMPLETED',
        ...safeRecords,
      };

      const h = Number(hScore); const a = Number(aScore);
      let isDraw = false;

      if (editingMatch.away === 'BYE' || editingMatch.away === 'BYE (부전승)' || editingMatch.home === 'BYE' || editingMatch.home === 'BYE (부전승)') {
        // BYE 처리
      } else if (manualWinner) {
        // 수동 승자 결정
      } else if (h === a) {
        isDraw = true;
      }

      if (isDraw) {
        alert("⚠️ 무승부입니다! 연장/승부차기 진행 후, 점수를 다시 입력하거나 [강제 진출 지정] 버튼으로 승자를 선택해주세요.");
      } else {
        let effectiveHScore = h;
        let effectiveAScore = a;
        if (manualWinner === 'HOME') { effectiveHScore = 1; effectiveAScore = 0; }
        if (manualWinner === 'AWAY') { effectiveHScore = 0; effectiveAScore = 1; }

        const advancedMatches = processTournamentAdvancement(
          newRounds[0].matches,
          matchId,
          effectiveHScore,
          effectiveAScore
        );
        newRounds[0].matches = advancedMatches;
      }

      await updateDoc(doc(db, "seasons", String(s.id)), { rounds: newRounds });

      if (yt && yt.trim() !== '') {
        const highlightRef = doc(collection(db, "highlights"), matchId);
        await setDoc(highlightRef, {
          id: matchId,
          matchId: matchId,
          seasonId: s.id,
          seasonName: s.name,
          youtubeUrl: yt,
          homeTeam: editingMatch.home,
          awayTeam: editingMatch.away,
          homeLogo: editingMatch.homeLogo,
          awayLogo: editingMatch.awayLogo,
          homeScore: hScore,
          awayScore: aScore,
          matchLabel: editingMatch.matchLabel || editingMatch.stage,
          createdAt: Date.now(),
        }, { merge: true });

        const snap = await getDocs(query(collection(db, "highlights"), where("id", "==", matchId)));
        if (snap.empty) {
          await updateDoc(highlightRef, { views: 0, likes: [], commentCount: 0 });
        }
      }

      try {
        const pushTitle = "🏆 경기 결과 확정";
        const pushBody = `[${editingMatch.home}] ${hScore} : ${aScore} [${editingMatch.away}] - 결과를 확인하세요!`;
        sendAutoPush(pushTitle, pushBody);
      } catch (error) {
        console.error("푸시 발송 에러:", error);
      }

      setEditingMatch(null);
      return;
    }

    // ──────────────────────────────────────────────────────────────────
    // LEAGUE / LEAGUE_PLAYOFF / CUP 공통 처리
    // ──────────────────────────────────────────────────────────────────
    let newRounds = [...s.rounds];
    let currentRoundIndex = -1;

    const isVirtual = matchId.startsWith('v-');
    let vTargetRIdx = -1;
    let vTargetMIdx = 0;

    if (isVirtual) {
      if (matchId === 'v-final') vTargetRIdx = 2;
      else if (matchId.includes('r4')) { vTargetRIdx = 1; vTargetMIdx = parseInt(matchId.split('-')[2]) || 0; }
      else if (matchId.includes('r8')) { vTargetRIdx = 0; vTargetMIdx = parseInt(matchId.split('-')[2]) || 0; }
      else if (matchId === 'v-3rd') {
        // 3·4위전 — Final 라운드와 같은 위치(마지막)
        vTargetRIdx = newRounds.length;
      }

      while (newRounds.length <= vTargetRIdx) {
        const nextRnd = newRounds.length + 1;
        newRounds.push({
          round: nextRnd,
          name: nextRnd === 3 ? 'Final' : nextRnd === 2 ? 'Semi-Final' : 'Quarter-Final',
          seasonId: viewSeasonId,
          matches: [],
        });
      }
    }

    // 예측률 스냅샷 — effectiveMatch 기반 (가상 매치라면 실제 팀명)
    const predictionSnapshot = calculateMatchSnapshot(
      effectiveMatch.home,
      effectiveMatch.away,
      activeRankingData,
      combinedHistoryData || { allTimeStats: [] },
      masterTeams
    );

    newRounds = newRounds.map((r, rIdx) => {
      let matches = [...r.matches];
      let found = false;

      matches = matches.map((m) => {
        if (m.id === matchId) {
          found = true;
          currentRoundIndex = rIdx;
          let aggUpdate = {};
          if (s.type === 'LEAGUE_PLAYOFF' && manualWinner) {
            aggUpdate = { aggWinner: manualWinner === 'HOME' ? effectiveMatch.home : effectiveMatch.away };
          }

          // 🛠️ [핵심 픽스] 진짜 placeholder ID(ko_3rd_0 등)로 저장 시 home/away/owner 가 TBD 면
          //    effectiveMatch (CupSchedule 의 syncLoser 가 채워준 화면용 값) 로 교체.
          //    배경: 3·4위전 슬롯은 AdminCupSetup 에서 placeholder 로 미리 생성되고
          //          nextMatchId 가 null 이라 winner propagation 으로도 채워지지 않음.
          //          저장 시점에 ...m (DB의 TBD) 만 펼쳐서 score 만 덮어쓰면 home/owner 가 평생 TBD 유지.
          const isInvalidTeam = (v: any) =>
            !v || ['', '-', 'TBD', 'BYE'].includes(String(v).trim().toUpperCase());
          const homeNeedsFix = isInvalidTeam(m.home) && !isInvalidTeam(effectiveMatch.home);
          const awayNeedsFix = isInvalidTeam(m.away) && !isInvalidTeam(effectiveMatch.away);
          const teamFix = {
            ...(homeNeedsFix ? {
              home: effectiveMatch.home,
              homeLogo: effectiveMatch.homeLogo,
              homeOwner: effectiveMatch.homeOwner,
              homeOwnerUid: effectiveMatch.homeOwnerUid,
            } : {}),
            ...(awayNeedsFix ? {
              away: effectiveMatch.away,
              awayLogo: effectiveMatch.awayLogo,
              awayOwner: effectiveMatch.awayOwner,
              awayOwnerUid: effectiveMatch.awayOwnerUid,
            } : {}),
          };

          return {
            ...m,
            ...teamFix,
            homeScore: hScore, awayScore: aScore, youtubeUrl: yt, status: 'COMPLETED',
            ...safeRecords,
            homePredictRate: predictionSnapshot.homePredictRate,
            awayPredictRate: predictionSnapshot.awayPredictRate,
            ...aggUpdate,
          };
        }
        return m;
      });

      if (!found && isVirtual && rIdx === vTargetRIdx) {
        currentRoundIndex = rIdx;
        // 🛠️ [TBD 패치] effectiveMatch 의 home/away (TBD 가 아닌 실제 팀명) 으로 새 매치 저장
        const newMatchData: Match = {
          ...effectiveMatch,
          id: `m-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          homeScore: hScore, awayScore: aScore, youtubeUrl: yt, status: 'COMPLETED',
          ...safeRecords,
          homePredictRate: predictionSnapshot.homePredictRate,
          awayPredictRate: predictionSnapshot.awayPredictRate,
        };
        if (matches[vTargetMIdx]) matches[vTargetMIdx] = { ...matches[vTargetMIdx], ...newMatchData, id: matches[vTargetMIdx].id };
        else matches[vTargetMIdx] = newMatchData;
      }
      return { ...r, matches };
    });

    // ──────────────────────────────────────────────────────────────────
    // CUP — nextMatchId 진출 로직 (원본 그대로, effectiveMatch 기반)
    // ──────────────────────────────────────────────────────────────────
    if (s.type === 'CUP' && currentRoundIndex !== -1) {
      type WinTeamType = { name: string; logo: string; owner: string; ownerUid?: string };
      const hTeam: WinTeamType = {
        name: effectiveMatch.home,
        logo: effectiveMatch.homeLogo,
        owner: effectiveMatch.homeOwner,
        ownerUid: effectiveMatch.homeOwnerUid || getOwnerUidByName(effectiveMatch.homeOwner),
      };
      const aTeam: WinTeamType = {
        name: effectiveMatch.away,
        logo: effectiveMatch.awayLogo,
        owner: effectiveMatch.awayOwner,
        ownerUid: effectiveMatch.awayOwnerUid || getOwnerUidByName(effectiveMatch.awayOwner),
      };

      let winningTeam: WinTeamType | null = null;
      const h = Number(hScore); const a = Number(aScore);
      const isGroupStage = effectiveMatch.matchLabel?.toUpperCase().includes('GROUP') || effectiveMatch.stage?.toUpperCase().includes('GROUP');

      if (effectiveMatch.away === 'BYE' || effectiveMatch.away === 'BYE (부전승)') winningTeam = hTeam;
      else if (manualWinner === 'HOME') winningTeam = hTeam;
      else if (manualWinner === 'AWAY') winningTeam = aTeam;
      else if (h > a) winningTeam = hTeam;
      else if (a > h) winningTeam = aTeam;
      else if (!isGroupStage) return alert("⚠️ 무승부입니다! 승자를 선택해주세요.");

      const mAny = effectiveMatch as any;
      if (winningTeam && !isGroupStage && mAny.nextMatchId) {
        newRounds = newRounds.map(round => ({
          ...round,
          matches: round.matches.map(m => {
            if (m.id === mAny.nextMatchId) {
              const update = mAny.nextMatchSide === 'HOME'
                ? { home: winningTeam!.name, homeLogo: winningTeam!.logo, homeOwner: winningTeam!.owner, homeOwnerUid: winningTeam!.ownerUid }
                : { away: winningTeam!.name, awayLogo: winningTeam!.logo, awayOwner: winningTeam!.owner, awayOwnerUid: winningTeam!.ownerUid };

              return {
                ...m,
                ...update,
                homeScore: '',
                awayScore: '',
                status: 'UPCOMING',
              };
            }
            return m;
          }),
        }));
      }

      // 🛠️ [옵션A-1] CUP — 3·4위전 패자 자동 채움 (인라인)
      //   semi-final 두 매치가 모두 COMPLETED 되었을 때 동작.
      //   resolveVirtualMatchTeams('v-3rd', ...) 가 semi 패자 추론을 담당.
      //   home/away 가 TBD 면 status 무관하게 보정 (score 만 박힌 broken 데이터도 복구).
      //   score/status 등 다른 필드는 절대 건드리지 않음 — home/away/owner 만 보정.
      try {
        const r3 = resolveVirtualMatchTeams('v-3rd', newRounds);
        if (r3) {
          const is3rd = (mm: any) => {
            if (!mm) return false;
            if (mm.id === 'v-3rd' || String(mm.id || '').toLowerCase().includes('3rd')) return true;
            const st = String(mm.stage || '').toUpperCase();
            return st.includes('3RD') || st.includes('THIRD') || st.includes('34');
          };
          const isTbd = (v: any) => !v || ['', '-', 'TBD', 'BYE'].includes(String(v).trim().toUpperCase());
          newRounds = newRounds.map((rr: any) => ({
            ...rr,
            matches: (rr.matches || []).map((mm: any) => {
              if (!is3rd(mm)) return mm;
              const needH = isTbd(mm.home);
              const needA = isTbd(mm.away);
              if (!needH && !needA) return mm; // 이미 정상 → 보존
              return {
                ...mm,
                ...(needH ? { home: r3.home.name, homeLogo: r3.home.logo, homeOwner: r3.home.owner, homeOwnerUid: r3.home.ownerUid } : {}),
                ...(needA ? { away: r3.away.name, awayLogo: r3.away.logo, awayOwner: r3.away.owner, awayOwnerUid: r3.away.ownerUid } : {}),
              };
            }),
          }));
        }
      } catch (error) {
        console.error('🚨 3·4위전 자동 채우기 에러:', error);
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // 🛠️ [TBD 패치] LEAGUE_PLAYOFF 자동 진출 채우기
    //   - ROUND_OF_4 양 다리 완성 → SEMI_FINAL TBD 채우기
    //   - SEMI_FINAL 양 다리 완성 → GRAND FINAL TBD 채우기
    //   - 헬퍼 내부에서 목적지 COMPLETED 시 갱신 스킵 보장
    // ──────────────────────────────────────────────────────────────────
    if (s.type === 'LEAGUE_PLAYOFF' && currentRoundIndex !== -1) {
      try {
        newRounds = applyLeaguePlayoffProgression(newRounds, matchId, s.id);
      } catch (error) {
        // 진출 로직 실패해도 점수 저장은 진행 (방어적)
        console.error('🚨 LEAGUE_PLAYOFF 진출 자동 채우기 에러:', error);
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // 🛠️ [옵션A-2] owner 자동 채움 안전망 — DB 저장 직전 일괄 적용
    //   - 모든 라운드의 모든 매치 순회 → owner 비어있거나 TBD 면 masterTeams 로 보정
    //   - 신규 매치 생성/진출 propagation 누락분까지 통합 커버
    //   - 통계 consumer 가 매번 폴백 코드 가질 필요 없게 만드는 핵심 안전망
    // ──────────────────────────────────────────────────────────────────
    try {
      newRounds = fillOwnersInRounds(newRounds, masterTeams);
    } catch (error) {
      console.error('🚨 owner 자동 채움 에러:', error);
    }

    await updateDoc(doc(db, "seasons", String(s.id)), { rounds: newRounds });

    // 하이라이트 저장 — effectiveMatch 기반 (TBD 가 아닌 실제 팀명 사용)
    if (yt && yt.trim() !== '') {
      const highlightRef = doc(collection(db, "highlights"), matchId);
      await setDoc(highlightRef, {
        id: matchId,
        matchId: matchId,
        seasonId: s.id,
        seasonName: s.name,
        youtubeUrl: yt,
        homeTeam: effectiveMatch.home,
        awayTeam: effectiveMatch.away,
        homeLogo: effectiveMatch.homeLogo,
        awayLogo: effectiveMatch.awayLogo,
        homeScore: hScore,
        awayScore: aScore,
        matchLabel: effectiveMatch.matchLabel || effectiveMatch.stage,
        createdAt: Date.now(),
      }, { merge: true });

      const snap = await getDocs(query(collection(db, "highlights"), where("id", "==", matchId)));
      if (snap.empty) {
        await updateDoc(highlightRef, { views: 0, likes: [], commentCount: 0 });
      }
    }

    // 푸시 알림 — effectiveMatch 기반
    try {
      const pushTitle = "🏆 경기 결과 확정";
      const pushBody = `[${effectiveMatch.home}] ${hScore} : ${aScore} [${effectiveMatch.away}] - 결과를 확인하세요!`;
      sendAutoPush(pushTitle, pushBody);
    } catch (error) {
      console.error("푸시 발송 에러:", error);
    }

    setEditingMatch(null);
  };
};
