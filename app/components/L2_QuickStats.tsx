"use client";

import React, { useMemo } from 'react';
import { Season, Owner, MasterTeam, FALLBACK_IMG } from '../types';
import { useHistoryRecords } from '../hooks/useHistoryRecords';

interface Props {
  seasons: Season[];
  owners: Owner[];
  masterTeams: MasterTeam[];
  viewSeasonId: number;
}

const colorMap: Record<string, { ring: string; label: string; sub: string }> = {
  yellow: { ring: 'from-yellow-400 to-amber-500', label: 'text-yellow-400', sub: 'text-yellow-400' },
  purple: { ring: 'from-purple-400 to-violet-600', label: 'text-purple-400', sub: 'text-purple-400' },
  emerald: { ring: 'from-emerald-400 to-teal-600', label: 'text-emerald-400', sub: 'text-emerald-400' },
  rose: { ring: 'from-rose-400 to-pink-600', label: 'text-rose-400', sub: 'text-rose-400' },
};

/**
 * 🛠️ [L2] Quick Stats — 4종
 *  1. 시즌 1위 (오너) — 프로필 사진
 *  2. 누적 1위 (오너) — 프로필 사진
 *  3. 시즌 득점왕 (선수) — 팀 엠블럼
 *  4. 누적 득점왕 (선수) — 팀 엠블럼
 */
export const L2_QuickStats = ({ seasons, owners, masterTeams, viewSeasonId }: Props) => {
  const { historyData } = useHistoryRecords(owners, seasons, masterTeams);

  const stats = useMemo(() => {
    const current = (seasons || []).find((s: any) => s.id === viewSeasonId)
      || [...(seasons || [])].sort((a: any, b: any) => b.id - a.id)[0];

    // --- 시즌 1위 (오너) ---
    const seasonOwnerStats: Record<string, { name: string; pts: number; uid?: string }> = {};
    if (current) {
      (current.rounds || []).forEach((r: any) => {
        (r.matches || []).forEach((m: any) => {
          if (m.status !== 'COMPLETED') return;
          if (m.home === 'BYE' || m.away === 'BYE' || m.home === 'TBD' || m.away === 'TBD') return;
          const hs = Number(m.homeScore || 0);
          const as = Number(m.awayScore || 0);
          const homeKey = String(m.homeOwnerUid || m.homeOwner || '');
          const awayKey = String(m.awayOwnerUid || m.awayOwner || '');
          if (homeKey && !['', '-', 'TBD', 'CPU', 'SYSTEM', 'BYE'].includes(homeKey)) {
            if (!seasonOwnerStats[homeKey]) seasonOwnerStats[homeKey] = { name: m.homeOwner, pts: 0, uid: m.homeOwnerUid };
            if (hs > as) seasonOwnerStats[homeKey].pts += 3;
            else if (hs === as) seasonOwnerStats[homeKey].pts += 1;
          }
          if (awayKey && !['', '-', 'TBD', 'CPU', 'SYSTEM', 'BYE'].includes(awayKey)) {
            if (!seasonOwnerStats[awayKey]) seasonOwnerStats[awayKey] = { name: m.awayOwner, pts: 0, uid: m.awayOwnerUid };
            if (as > hs) seasonOwnerStats[awayKey].pts += 3;
            else if (hs === as) seasonOwnerStats[awayKey].pts += 1;
          }
        });
      });
    }
    const seasonTop = Object.values(seasonOwnerStats).sort((a, b) => b.pts - a.pts)[0];

    // --- 누적 1위 (오너) ---
    const allOwners = (historyData?.owners || []).slice().sort((a: any, b: any) => (b.pts || 0) - (a.pts || 0));
    const totalTop = allOwners[0];

    // owner 객체 매핑 (프로필 사진 가져오기)
    const findOwnerProfile = (key?: string, name?: string) => {
      if (!owners || owners.length === 0) return { nickname: name || '-', photo: FALLBACK_IMG };
      const found = owners.find((o: any) =>
        (key && (o.uid === key || o.docId === key || String(o.id) === key)) ||
        (name && (o.nickname === name || o.legacyName === name || (Array.isArray(o.legacyNames) && o.legacyNames.includes(name))))
      );
      return {
        nickname: (found as any)?.nickname || name || '-',
        photo: (found as any)?.photo || FALLBACK_IMG,
      };
    };

    const seasonTopProfile = seasonTop ? findOwnerProfile(seasonTop.uid, seasonTop.name) : null;
    const totalTopProfile = totalTop ? findOwnerProfile(totalTop.id, totalTop.name) : null;

    // --- 시즌 득점왕 (선수) ---
    //   🛠️ ownerName/ownerUid 도 함께 추적 → 오너 표시
    const seasonPlayerStats: Record<string, { name: string; goals: number; team: string; teamLogo?: string; ownerName?: string; ownerUid?: string }> = {};
    if (current) {
      (current.rounds || []).forEach((r: any) => {
        (r.matches || []).forEach((m: any) => {
          if (m.status !== 'COMPLETED') return;
          (m.homeScorers || []).forEach((s: any) => {
            const pName = typeof s === 'string' ? s : s.name;
            const count = typeof s === 'string' ? 1 : (s.count || 1);
            if (!pName) return;
            const key = `${pName}_${m.home}`;
            if (!seasonPlayerStats[key]) seasonPlayerStats[key] = { name: pName, goals: 0, team: m.home, teamLogo: m.homeLogo, ownerName: m.homeOwner, ownerUid: m.homeOwnerUid };
            seasonPlayerStats[key].goals += count;
          });
          (m.awayScorers || []).forEach((s: any) => {
            const pName = typeof s === 'string' ? s : s.name;
            const count = typeof s === 'string' ? 1 : (s.count || 1);
            if (!pName) return;
            const key = `${pName}_${m.away}`;
            if (!seasonPlayerStats[key]) seasonPlayerStats[key] = { name: pName, goals: 0, team: m.away, teamLogo: m.awayLogo, ownerName: m.awayOwner, ownerUid: m.awayOwnerUid };
            seasonPlayerStats[key].goals += count;
          });
        });
      });
    }
    const seasonTopScorer = Object.values(seasonPlayerStats).sort((a, b) => b.goals - a.goals)[0];
    const seasonTopScorerOwner = seasonTopScorer ? findOwnerProfile(seasonTopScorer.ownerUid, seasonTopScorer.ownerName) : null;

    // --- 누적 득점왕 ---
    const totalTopScorer = (historyData?.players || []).slice().sort((a: any, b: any) => (b.goals || 0) - (a.goals || 0))[0];
    const totalTopScorerOwner = totalTopScorer ? findOwnerProfile(totalTopScorer.ownerId, totalTopScorer.owner) : null;

    // 팀 로고 조회
    const getTeamLogo = (teamName?: string, fallback?: string) => {
      if (!teamName) return fallback || FALLBACK_IMG;
      const clean = (teamName || '').replace(/\s+/g, '').toLowerCase();
      const master: any = (masterTeams || []).find((t: any) =>
        ((t.name || t.teamName || '').replace(/\s+/g, '').toLowerCase()) === clean
      );
      return master?.logo || fallback || FALLBACK_IMG;
    };

    return [
      seasonTop ? {
        type: 'OWNER',
        emoji: '🥇',
        label: '시즌 1위',
        color: 'yellow',
        name: seasonTopProfile?.nickname || seasonTop.name,
        subInfo: `${seasonTop.pts} pts`,
        imageUrl: seasonTopProfile?.photo,
      } : null,
      totalTop ? {
        type: 'OWNER',
        emoji: '👑',
        label: '누적 1위',
        color: 'purple',
        name: totalTopProfile?.nickname || totalTop.name,
        subInfo: `${totalTop.pts || 0} pts`,
        imageUrl: totalTopProfile?.photo,
      } : null,
      seasonTopScorer ? {
        type: 'PLAYER',
        emoji: '⚽',
        label: '시즌 득점왕',
        color: 'emerald',
        name: seasonTopScorer.name,
        // 🛠️ 오너명 추가 노출
        subInfo: `${seasonTopScorer.goals} 골 · ${seasonTopScorer.team}`,
        ownerName: seasonTopScorerOwner?.nickname || seasonTopScorer.ownerName || '-',
        ownerPhoto: seasonTopScorerOwner?.photo,
        teamLogo: getTeamLogo(seasonTopScorer.team, seasonTopScorer.teamLogo),
      } : null,
      totalTopScorer ? {
        type: 'PLAYER',
        emoji: '🎯',
        label: '누적 득점왕',
        color: 'rose',
        name: totalTopScorer.name,
        subInfo: `${totalTopScorer.goals || 0} 골 · ${totalTopScorer.team || '-'}`,
        ownerName: totalTopScorerOwner?.nickname || totalTopScorer.owner || '-',
        ownerPhoto: totalTopScorerOwner?.photo,
        teamLogo: getTeamLogo(totalTopScorer.team, totalTopScorer.teamLogo),
      } : null,
    ].filter(Boolean) as any[];
  }, [seasons, viewSeasonId, historyData, owners, masterTeams]);

  if (stats.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
      {stats.map((s, idx) => {
        const c = colorMap[s.color] || colorMap.emerald;
        return (
          <div key={idx} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center gap-2 hover:border-slate-600 transition">
            <div className="shrink-0">
              {s.type === 'OWNER' ? (
                <div className={`w-9 h-9 rounded-full p-[2px] bg-gradient-to-br ${c.ring}`}>
                  <img
                    src={s.imageUrl || FALLBACK_IMG}
                    alt=""
                    className="w-full h-full rounded-full object-cover bg-slate-700"
                    onError={(e: any) => { e.target.src = FALLBACK_IMG; }}
                  />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center overflow-hidden ring-2 ring-slate-800">
                  <img
                    src={s.teamLogo || FALLBACK_IMG}
                    alt=""
                    className="w-[78%] h-[78%] object-contain"
                    onError={(e: any) => { e.target.src = FALLBACK_IMG; }}
                  />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className={`text-[9px] sm:text-[10px] font-bold tracking-widest uppercase block ${c.label}`}>
                <span className="hidden sm:inline">{s.emoji} </span>{s.label}
              </span>
              <div className="text-[11px] font-black text-white mt-0.5 truncate italic">{s.name}</div>
              <div className={`text-[9px] font-bold ${c.sub} truncate`}>{s.subInfo}</div>
              {/* 🛠️ [v2 픽스] 득점왕 오너명 표시 */}
              {s.type === 'PLAYER' && s.ownerName && (
                <div className="flex items-center gap-1 mt-0.5">
                  <img src={s.ownerPhoto || FALLBACK_IMG} alt="" className="w-3 h-3 rounded-full object-cover bg-slate-700" onError={(e: any) => { e.target.src = FALLBACK_IMG; }} />
                  <span className="text-[8px] text-slate-400 truncate">{s.ownerName}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
