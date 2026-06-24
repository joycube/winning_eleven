"use client";

import React, { useMemo, useState } from 'react';
import { Season, Owner, MasterTeam, FALLBACK_IMG } from '../types';
import { useHistoryRecords } from '../hooks/useHistoryRecords';

interface Props {
  seasons: Season[];
  owners: Owner[];
  masterTeams: MasterTeam[];
  viewSeasonId: number;
}

const findOwnerProfile = (owners: Owner[], key?: string, name?: string) => {
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

/**
 * 🛠️ [L2] 팀 랭킹 — 시즌/누적 토글
 *  - 시즌: 현재 시즌의 팀별 점수 집계
 *  - 누적: history_records.teams
 *  - 각 행: 팀 로고 + 팀명 + 오너 프로필 + 오너이름 + 수평바 + 점수
 */
export const L2_TeamRanking = ({ seasons, owners, masterTeams, viewSeasonId }: Props) => {
  const [mode, setMode] = useState<'SEASON' | 'ALL'>('SEASON');
  const { historyData } = useHistoryRecords(owners, seasons, masterTeams);

  const teams = useMemo(() => {
    if (mode === 'SEASON') {
      const current = (seasons || []).find((s: any) => s.id === viewSeasonId)
        || [...(seasons || [])].sort((a: any, b: any) => b.id - a.id)[0];
      if (!current) return [];
      const stats: Record<string, any> = {};
      (current.rounds || []).forEach((r: any) => {
        (r.matches || []).forEach((m: any) => {
          if (m.status !== 'COMPLETED') return;
          if (m.home === 'BYE' || m.away === 'BYE' || m.home === 'TBD' || m.away === 'TBD') return;
          const hs = Number(m.homeScore || 0);
          const as = Number(m.awayScore || 0);
          if (!stats[m.home]) stats[m.home] = { name: m.home, logo: m.homeLogo, ownerName: m.homeOwner, ownerUid: m.homeOwnerUid, pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
          if (!stats[m.away]) stats[m.away] = { name: m.away, logo: m.awayLogo, ownerName: m.awayOwner, ownerUid: m.awayOwnerUid, pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
          stats[m.home].gf += hs; stats[m.home].ga += as;
          stats[m.away].gf += as; stats[m.away].ga += hs;
          if (hs > as) { stats[m.home].pts += 3; stats[m.home].w++; stats[m.away].l++; }
          else if (hs < as) { stats[m.away].pts += 3; stats[m.away].w++; stats[m.home].l++; }
          else { stats[m.home].pts += 1; stats[m.away].pts += 1; stats[m.home].d++; stats[m.away].d++; }
        });
      });
      return Object.values(stats).sort((a: any, b: any) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga)).slice(0, 8);
    } else {
      return (historyData?.teams || []).slice(0, 8).map((t: any) => ({
        name: t.name,
        logo: t.logo,
        ownerName: t.owner || t.ownerName,
        ownerUid: t.ownerId,
        pts: t.pts,
        w: t.win, d: t.draw, l: t.loss,
        gf: t.gf, ga: t.ga,
      }));
    }
  }, [mode, seasons, viewSeasonId, historyData]);

  const maxPts = teams.length > 0 ? Math.max(...teams.map((t: any) => t.pts || 0)) : 1;

  const rankColors = ['text-yellow-400', 'text-slate-300', 'text-orange-400'];

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 sm:p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-[3px] h-[14px] rounded bg-blue-500" />
          <span className="text-[13px] font-black italic text-white tracking-wide">TEAM RANKING</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setMode('SEASON')}
            className={`text-[10px] px-2.5 py-1 rounded-md font-bold transition ${
              mode === 'SEASON' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >시즌</button>
          <button
            onClick={() => setMode('ALL')}
            className={`text-[10px] px-2.5 py-1 rounded-md font-bold transition ${
              mode === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >누적</button>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="text-center text-[11px] text-slate-500 py-6">집계할 데이터가 없습니다</div>
      ) : (
        <div className="flex flex-col gap-2">
          {teams.map((t: any, idx: number) => {
            const rankColor = idx < 3 ? rankColors[idx] : 'text-slate-500';
            const ownerInfo = findOwnerProfile(owners, t.ownerUid, t.ownerName);
            return (
              <div key={`${t.name}_${idx}`} className="flex items-center gap-2 sm:gap-3 p-2 bg-slate-800/50 rounded-lg">
                <span className={`text-[13px] font-black italic w-4 text-center ${rankColor}`}>{idx + 1}</span>
                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center overflow-hidden ring-1 ring-slate-700 shrink-0">
                  <img src={t.logo || FALLBACK_IMG} alt="" className="w-[78%] h-[78%] object-contain" onError={(e: any) => { e.target.src = FALLBACK_IMG; }} />
                </div>
                <div className="min-w-0 hidden sm:block">
                  <div className="text-[11px] font-black italic text-white truncate">{t.name}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <img src={ownerInfo.photo} alt="" className="w-3.5 h-3.5 rounded-full object-cover bg-slate-700 border border-slate-800" onError={(e: any) => { e.target.src = FALLBACK_IMG; }} />
                    <span className="text-[9px] text-slate-400 truncate">{ownerInfo.nickname}</span>
                  </div>
                </div>
                <div className="sm:hidden flex flex-col min-w-0">
                  <span className="text-[10px] font-black italic text-white truncate">{t.name}</span>
                  <span className="text-[8px] text-slate-400 truncate">{ownerInfo.nickname}</span>
                </div>
                <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      idx === 0 ? 'bg-yellow-400' :
                      idx === 1 ? 'bg-slate-300' :
                      idx === 2 ? 'bg-orange-400' : 'bg-slate-600'
                    }`}
                    style={{ width: `${Math.max(5, (t.pts / Math.max(maxPts, 1)) * 100)}%` }}
                  />
                </div>
                <span className={`text-[12px] font-black italic w-8 text-right tabular-nums ${rankColor}`}>{t.pts}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
