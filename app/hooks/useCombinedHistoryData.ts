// app/hooks/useCombinedHistoryData.ts
//
// 🛠️ [Day 2 분할] page.tsx 에서 분리
//   - history_records + 진행 중인 ACTIVE 시즌의 매치들을 모두 합산
//   - UID 룩업 테이블 구축 → 닉네임 변경 이력 추적
//   - allTimeStats 까지 포함한 combinedHistoryData 객체 반환

"use client";

import { useState, useEffect } from 'react';
import type { Owner, Season } from '../types';

export const useCombinedHistoryData = (
  historyData: any,
  seasons: Season[] | undefined | null,
  owners: Owner[] | undefined | null,
  historyRecords: any[] | undefined | null,
  isLoaded: boolean
) => {
  const [combinedHistoryData, setCombinedHistoryData] = useState<any>(null);

  useEffect(() => {
    if (!isLoaded || !owners || !seasons) return;

    const timer = setTimeout(() => {
      const mergedOwnersMap = new Map();
      const mergedTeamsMap = new Map();
      const mergedPlayersMap = new Map();

      const uidLookup = new Map<string, string>();

      historyRecords?.forEach((hr: any) => {
        hr.teams?.forEach((t: any) => {
          if (t.owner && t.ownerId) uidLookup.set(t.owner, t.ownerId);
          if (t.legacyName && t.ownerId) uidLookup.set(t.legacyName, t.ownerId);
        });
        hr.players?.forEach((p: any) => {
          if (p.owner && p.ownerId) uidLookup.set(p.owner, p.ownerId);
          if (p.legacyName && p.ownerId) uidLookup.set(p.legacyName, p.ownerId);
        });
      });

      owners?.forEach((o: any) => {
        if (o.nickname && o.uid) uidLookup.set(o.nickname, o.uid);
        if (o.legacyName && o.uid) uidLookup.set(o.legacyName, o.uid);
        if (o.legacyNames && Array.isArray(o.legacyNames)) {
          o.legacyNames.forEach((ln: string) => uidLookup.set(ln, o.uid));
        }
      });

      historyData?.owners?.forEach((o: any) => {
        const uid = o.ownerId || o.uid || uidLookup.get(o.name) || o.name;

        if (!mergedOwnersMap.has(uid)) {
          mergedOwnersMap.set(uid, { ...o, uid });
        } else {
          const ex = mergedOwnersMap.get(uid);
          ex.win += o.win || 0; ex.draw += o.draw || 0; ex.loss += o.loss || 0;
          ex.points += o.points || 0; ex.prize += o.prize || 0;
          ex.golds += o.golds || 0; ex.silvers += o.silvers || 0; ex.bronzes += o.bronzes || 0;
        }
      });

      historyData?.teams?.forEach((t: any) => {
        const uid = t.ownerId || t.ownerUid || uidLookup.get(t.owner) || t.owner;
        mergedTeamsMap.set(t.name, { ...t, ownerUid: uid });
      });

      historyData?.players?.forEach((p: any) => {
        const uid = p.ownerId || p.ownerUid || uidLookup.get(p.owner) || p.owner;
        const pk = `${p.name}_${p.team}`;
        mergedPlayersMap.set(pk, { ...p, ownerUid: uid });
      });

      const activeSeasons = seasons?.filter(s => s.status === 'ACTIVE') || [];

      activeSeasons.forEach((s: any) => {
        s.rounds?.forEach((r: any) => {
          r.matches?.forEach((m: any) => {
            if (
              m.status === 'COMPLETED' &&
              m.home !== 'BYE' && m.away !== 'BYE' &&
              !m.home?.includes('부전승')
            ) {
              const hUid = m.homeOwnerUid || uidLookup.get(m.homeOwner) || m.homeOwner || "";
              const aUid = m.awayOwnerUid || uidLookup.get(m.awayOwner) || m.awayOwner || "";

              if (!mergedTeamsMap.has(m.home)) mergedTeamsMap.set(m.home, { name: m.home, win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0, logo: m.homeLogo, ownerUid: hUid });
              if (!mergedTeamsMap.has(m.away)) mergedTeamsMap.set(m.away, { name: m.away, win:0, draw:0, loss:0, points:0, gf:0, ga:0, gd:0, logo: m.awayLogo, ownerUid: aUid });

              const hTeam = mergedTeamsMap.get(m.home);
              const aTeam = mergedTeamsMap.get(m.away);

              if (!mergedOwnersMap.has(hUid)) mergedOwnersMap.set(hUid, { uid: hUid, win:0, draw:0, loss:0, points:0, prize:0, golds:0, silvers:0, bronzes:0 });
              if (!mergedOwnersMap.has(aUid)) mergedOwnersMap.set(aUid, { uid: aUid, win:0, draw:0, loss:0, points:0, prize:0, golds:0, silvers:0, bronzes:0 });

              const hOwner = mergedOwnersMap.get(hUid);
              const aOwner = mergedOwnersMap.get(aUid);

              const hScore = Number(m.homeScore || 0);
              const aScore = Number(m.awayScore || 0);

              hTeam.gf += hScore; hTeam.ga += aScore; hTeam.gd += (hScore - aScore);
              aTeam.gf += aScore; aTeam.ga += hScore; aTeam.gd += (aScore - hScore);

              if (hScore > aScore) {
                hTeam.win += 1; hTeam.points += 3; aTeam.loss += 1;
                hOwner.win += 1; hOwner.points += 3; aOwner.loss += 1;
              } else if (aScore > hScore) {
                aTeam.win += 1; aTeam.points += 3; hTeam.loss += 1;
                aOwner.win += 1; aOwner.points += 3; hOwner.loss += 1;
              } else {
                hTeam.draw += 1; hTeam.points += 1; aTeam.draw += 1; aTeam.points += 1;
                hOwner.draw += 1; hOwner.points += 1; aOwner.draw += 1; aOwner.points += 1;
              }

              const processPlayers = (playersList: any[], teamName: string, teamLogo: string, ownerUid: string, isGoal: boolean) => {
                playersList?.forEach((p: any) => {
                  const pName = p.name?.trim();
                  if (!pName) return;
                  const pk = `${pName}_${teamName}`;

                  if (!mergedPlayersMap.has(pk)) {
                    mergedPlayersMap.set(pk, { name: pName, team: teamName, goals: 0, assists: 0, teamLogo, ownerUid });
                  }
                  const pRec = mergedPlayersMap.get(pk);

                  if (isGoal) pRec.goals += Number(p.count || 1);
                  else pRec.assists += Number(p.count || 1);

                  pRec.teamLogo = teamLogo;
                  pRec.ownerUid = ownerUid;
                });
              };

              processPlayers(m.homeScorers, m.home, m.homeLogo, hUid, true);
              processPlayers(m.awayScorers, m.away, m.awayLogo, aUid, true);
              processPlayers(m.homeAssists, m.home, m.homeLogo, hUid, false);
              processPlayers(m.awayAssists, m.away, m.awayLogo, aUid, false);
            }
          });
        });
      });

      const finalOwners = Array.from(mergedOwnersMap.values()).map(o => {
        const latestOwner = owners.find(u => u.uid === o.uid || String(u.id) === o.uid || u.docId === o.uid);
        return {
          ...o,
          name: latestOwner ? latestOwner.nickname : (o.name || o.uid),
        };
      });

      const finalTeams = Array.from(mergedTeamsMap.values()).map(t => {
        const latestOwner = owners.find(u => u.uid === t.ownerUid || String(u.id) === t.ownerUid || u.docId === t.ownerUid);
        return {
          ...t,
          owner: latestOwner ? latestOwner.nickname : (t.owner || t.ownerUid),
        };
      });

      const finalPlayers = Array.from(mergedPlayersMap.values()).map(p => {
        const latestOwner = owners.find(u => u.uid === p.ownerUid || String(u.id) === p.ownerUid || u.docId === p.ownerUid);
        return {
          ...p,
          owner: latestOwner ? latestOwner.nickname : (p.owner || p.ownerUid),
        };
      });

      setCombinedHistoryData({
        teams: finalTeams,
        owners: finalOwners.sort((a, b) => b.points - a.points || b.win - a.win),
        players: finalPlayers,
        allTimeStats: (historyData as any)?.allTimeStats || [],
      });
    }, 10);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyData, seasons, owners, historyRecords, isLoaded]);

  return combinedHistoryData;
};
