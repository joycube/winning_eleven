"use client";

import React, { useMemo, useState } from 'react';
import { Season, Owner, MasterTeam, FALLBACK_IMG } from '../types';

interface Props {
  seasons: Season[];
  owners: Owner[];
  masterTeams: MasterTeam[];
  viewSeasonId: number;
  // 🛠️ [v2.5 성능] 무거운 집계는 부모(대시보드)에서 1회 계산해 전달받음
  historyData?: any;       // 누적(ALL) — useHistoryRecords 결과
  seasonRanking?: any;     // 시즌 — useLeagueStats(activeRankingData) 결과
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
 * [L2] 팀 랭킹 — 시즌/누적 토글
 *  - 시즌: 공식 엔진(useLeagueStats)의 현재 시즌 순위표 사용
 *  - 누적: history_records.teams
 *  - 각 행: 팀 로고 + 팀명 + 오너 프로필 + 오너이름 + 수평바 + 점수
 */
export const L2_TeamRanking = ({ owners, historyData, seasonRanking }: Props) => {
  const [mode, setMode] = useState<'SEASON' | 'ALL'>('SEASON');

  const teams = useMemo(() => {
    if (mode === 'SEASON') {
      // 공식 엔진 결과(현재 시즌 순위표) — 이미 정렬·정규화·중복제거 완료 (부모에서 전달)
      return (seasonRanking?.teams || []).slice(0, 8).map((t: any) => ({
        name: t.name,
        logo: t.logo,
        ownerName: t.ownerName,
        ownerUid: t.ownerUid,
        pts: t.points,
        w: t.win, d: t.draw, l: t.loss,
        gf: t.gf, ga: t.ga,
      }));
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
  }, [mode, seasonRanking, historyData]);

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
