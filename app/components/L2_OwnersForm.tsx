"use client";

import React, { useMemo } from 'react';
import { Season, Owner, MasterTeam, FALLBACK_IMG } from '../types';

interface Props {
  seasons: Season[];
  owners: Owner[];
  masterTeams: MasterTeam[];
}

type FormResult = 'W' | 'D' | 'L';

interface OwnerFormStat {
  uid: string;
  nickname: string;
  photo: string;
  recentForm: FormResult[]; // 최근 5경기
  bestStreak: number;
}

const matchOwnerToMaster = (uid: string, name: string, ownerObj: Owner) => {
  return (
    ((ownerObj as any).uid && (ownerObj as any).uid === uid) ||
    ((ownerObj as any).docId && (ownerObj as any).docId === uid) ||
    ((ownerObj as any).nickname === name) ||
    ((ownerObj as any).legacyName === name) ||
    (Array.isArray((ownerObj as any).legacyNames) && (ownerObj as any).legacyNames.includes(name)) ||
    ((ownerObj as any).mappedOwnerId === name)
  );
};

/**
 * 🛠️ [L2] 오너 폼 — 최근 5경기 W/D/L + 최고 연승
 *  - 모든 owner 의 모든 시즌 매치 순회
 *  - 최근 순 5경기
 *  - 최고 연승: 모든 매치 순회하면서 W 연속 최대치
 */
export const L2_OwnersForm = ({ seasons, owners }: Props) => {
  const ownerStats = useMemo<OwnerFormStat[]>(() => {
    if (!owners || owners.length === 0) return [];

    // 모든 완료 매치 수집 (timestamp 역순)
    const allMatches: any[] = [];
    (seasons || []).forEach((s: any) => {
      (s.rounds || []).forEach((r: any, rIdx: number) => {
        (r.matches || []).forEach((m: any, mIdx: number) => {
          if (m.status !== 'COMPLETED') return;
          if (m.home === 'BYE' || m.away === 'BYE') return;
          allMatches.push({
            ...m,
            _ts: Number(m.timestamp || 0),
            _seasonId: s.id,
            _rIdx: rIdx, _mIdx: mIdx,
          });
        });
      });
    });
    // 🛠️ [v2.4] 정렬 기준을 스케쥴 위치(시즌 → 라운드 → 매치)로 통일.
    //   (timestamp 1순위는 일부 매치에만 timestamp 가 있어 순서가 뒤섞였음)
    // 정렬: 최신순 (recentForm 계산용) — 스케쥴 내림차순
    const sortedRecent = [...allMatches].sort((a, b) => {
      if (a._seasonId !== b._seasonId) return b._seasonId - a._seasonId;
      if (a._rIdx !== b._rIdx) return b._rIdx - a._rIdx;
      return b._mIdx - a._mIdx;
    });
    // 정렬: 오래된 것부터 (bestStreak 계산용) — 스케쥴 오름차순
    const sortedOld = [...allMatches].sort((a, b) => {
      if (a._seasonId !== b._seasonId) return a._seasonId - b._seasonId;
      if (a._rIdx !== b._rIdx) return a._rIdx - b._rIdx;
      return a._mIdx - b._mIdx;
    });

    return owners.map((owner: any) => {
      const matchOwner = (m: any) => {
        const homeMatch = matchOwnerToMaster(m.homeOwnerUid, m.homeOwner, owner);
        const awayMatch = matchOwnerToMaster(m.awayOwnerUid, m.awayOwner, owner);
        return { homeMatch, awayMatch };
      };

      // 최근 5경기
      const recentForm: FormResult[] = [];
      for (const m of sortedRecent) {
        const { homeMatch, awayMatch } = matchOwner(m);
        if (!homeMatch && !awayMatch) continue;
        const hs = Number(m.homeScore || 0);
        const as = Number(m.awayScore || 0);
        let result: FormResult;
        if (hs === as) result = 'D';
        else if ((homeMatch && hs > as) || (awayMatch && as > hs)) result = 'W';
        else result = 'L';
        recentForm.push(result);
        if (recentForm.length >= 5) break;
      }

      // 최고 연승
      let currentStreak = 0;
      let bestStreak = 0;
      for (const m of sortedOld) {
        const { homeMatch, awayMatch } = matchOwner(m);
        if (!homeMatch && !awayMatch) continue;
        const hs = Number(m.homeScore || 0);
        const as = Number(m.awayScore || 0);
        let isWin = false;
        if (hs !== as) {
          isWin = (homeMatch && hs > as) || (awayMatch && as > hs);
        }
        if (isWin) {
          currentStreak += 1;
          if (currentStreak > bestStreak) bestStreak = currentStreak;
        } else {
          currentStreak = 0;
        }
      }

      return {
        uid: (owner as any).uid || (owner as any).docId || String((owner as any).id || ''),
        nickname: owner.nickname || (owner as any).mappedOwnerId || '-',
        photo: (owner as any).photo || FALLBACK_IMG,
        recentForm,
        bestStreak,
      };
    }).filter(o => o.recentForm.length > 0)
      .sort((a, b) => b.bestStreak - a.bestStreak);
  }, [seasons, owners]);

  if (ownerStats.length === 0) return null;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 sm:p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-[3px] h-[14px] rounded bg-purple-500" />
          <span className="text-[13px] font-black italic text-white tracking-wide">OWNERS FORM</span>
        </div>
        <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold">최근 5경기 · 최고 연승</span>
      </div>

      {/* 🛠️ [v2 픽스] 프로필 사진 크게 (좌측), 오너명 잘리지 않게 충분한 공간 확보 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {ownerStats.map((o) => (
          <div key={o.uid} className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3">
            {/* 좌측: 큰 프로필 사진 (40px) */}
            <img
              src={o.photo}
              alt=""
              className="w-10 h-10 rounded-full object-cover bg-slate-700 ring-2 ring-purple-500/40 shrink-0"
              onError={(e: any) => { e.target.src = FALLBACK_IMG; }}
            />
            {/* 우측: 이름 + 폼 + 연승 */}
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black italic text-white mb-1.5 leading-tight break-keep">{o.nickname}</div>
              {/* 🛠️ [v2.4] 최신 경기를 맨 뒤(오른쪽)에 — 빈 칸은 왼쪽, 그다음 오래된→최신 순 */}
              <div className="flex gap-1 mb-1.5">
                {Array.from({ length: Math.max(0, 5 - o.recentForm.length) }).map((_, i) => (
                  <span key={`empty_${i}`} className="w-4 h-4 rounded-sm bg-slate-700" />
                ))}
                {[...o.recentForm].reverse().map((r, i) => {
                  const bg = r === 'W' ? 'bg-emerald-500' : r === 'D' ? 'bg-yellow-400 text-slate-900' : 'bg-red-500';
                  const color = r === 'D' ? 'text-slate-900' : 'text-white';
                  return (
                    <span key={i} className={`w-4 h-4 rounded-sm ${bg} ${color} text-[8px] font-black flex items-center justify-center`}>
                      {r}
                    </span>
                  );
                })}
              </div>
              <div className="text-[9px] text-slate-400">
                🔥 최고 연승: <span className="text-yellow-400 font-bold">{o.bestStreak}승</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
