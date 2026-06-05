// app/hooks/usePerfectHistoryData.ts
//
// 🛠️ [Day 2 분할] page.tsx 에서 분리
//   - history_records 컬렉션의 raw 도큐먼트들을 통합해 명예의 전당용 합산 데이터를 만듦
//   - 파이어베이스의 숫자 키(0, 1, 2) 구조를 정확히 파싱 (기존 핵심 픽스 보존)
//   - 닉네임 변경 이력까지 owners 명부와 대조해 최신 닉네임으로 덮어씌움

import { useMemo } from 'react';
import type { Owner } from '../types';

interface PerfectHistoryData {
  teams: any[];
  owners: any[];
  players: any[];
}

export const usePerfectHistoryData = (
  historyRecords: any[] | undefined | null,
  owners: Owner[] | undefined | null
): PerfectHistoryData => {
  return useMemo(() => {
    if (!historyRecords || historyRecords.length === 0) {
      return { teams: [], owners: [], players: [] };
    }

    const ownerMap = new Map();
    const teamMap = new Map();
    const playerMap = new Map();

    historyRecords.forEach((data: any) => {
      // 🚨 파이어베이스 구조에 맞게 숫자 키(0, 1, 2)만 정확하게 추출
      const teamKeys = Object.keys(data)
        .filter(k => !isNaN(Number(k)))
        .sort((a, b) => Number(a) - Number(b));

      teamKeys.forEach((key, index) => {
        const t = data[key];
        if (!t || !t.name || t.name === 'BYE' || t.name === 'TBD') return;

        // 1. 팀 합산
        const tName = t.name.trim();
        if (!teamMap.has(tName)) {
          teamMap.set(tName, {
            name: tName,
            win: 0, draw: 0, loss: 0,
            gf: 0, ga: 0, gd: 0, pts: 0,
            logo: t.logo,
          });
        }
        const teamStats = teamMap.get(tName);
        teamStats.win += Number(t.win || 0);
        teamStats.draw += Number(t.draw || 0);
        teamStats.loss += Number(t.loss || 0);
        teamStats.gf += Number(t.gf || 0);
        teamStats.ga += Number(t.ga || 0);
        teamStats.gd += Number(t.gd || 0);
        teamStats.pts += Number(t.pts || 0);

        // 2. 구단주 합산 (UID 기준 무결점 합산)
        const oId = t.ownerId || t.owner || t.legacyName;
        if (oId && oId !== '-' && oId !== 'CPU') {
          if (!ownerMap.has(oId)) {
            ownerMap.set(oId, {
              id: oId,
              name: t.owner || t.legacyName,
              win: 0, draw: 0, loss: 0, pts: 0,
              golds: 0, silvers: 0, bronzes: 0, prize: 0,
            });
          }
          const ownerStats = ownerMap.get(oId);
          if (t.owner && t.owner !== '-') ownerStats.name = t.owner;

          ownerStats.win += Number(t.win || 0);
          ownerStats.draw += Number(t.draw || 0);
          ownerStats.loss += Number(t.loss || 0);
          ownerStats.pts += Number(t.pts || 0);

          // 🏆 인덱스에 따른 트로피 부여 (0=우승, 1=준우승, 2=3위)
          if (index === 0) { ownerStats.golds += 1; ownerStats.prize += 50000; }
          else if (index === 1) { ownerStats.silvers += 1; ownerStats.prize += 30000; }
          else if (index === 2) { ownerStats.bronzes += 1; ownerStats.prize += 10000; }
        }
      });

      // 3. 플레이어 합산
      if (data.players && Array.isArray(data.players)) {
        data.players.forEach((p: any) => {
          const pName = p.name?.trim();
          if (!pName) return;
          if (!playerMap.has(pName)) {
            playerMap.set(pName, {
              name: pName,
              goals: 0, assists: 0,
              team: p.team, owner: p.owner,
            });
          }
          const pStats = playerMap.get(pName);
          pStats.goals += Number(p.goals || 0);
          pStats.assists += Number(p.assists || 0);
          pStats.team = p.team;
          pStats.owner = p.owner;
        });
      }
    });

    // 🔥 닉네임이 바뀌었어도 owners 맵과 대조하여 최신 닉네임으로 덮어씌움
    const sortedOwners = Array.from(ownerMap.values())
      .map(o => {
        const latestOwner = owners?.find(u =>
          u.uid === o.id ||
          String(u.id) === o.id ||
          u.docId === o.id ||
          u.nickname === o.id
        );
        return { ...o, name: latestOwner ? latestOwner.nickname : o.name };
      })
      .sort((a, b) => b.pts - a.pts || b.golds - a.golds || b.win - a.win);

    const sortedTeams = Array.from(teamMap.values())
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

    const sortedPlayers = Array.from(playerMap.values());

    return {
      owners: sortedOwners,
      teams: sortedTeams,
      players: sortedPlayers,
    };
  }, [historyRecords, owners]);
};
