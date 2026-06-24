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

const findTeamMaster = (masterTeams: MasterTeam[], teamName: string) => {
  if (!teamName) return null;
  const clean = teamName.replace(/\s+/g, '').toLowerCase();
  return (masterTeams || []).find((t: any) =>
    ((t.name || t.teamName || '').replace(/\s+/g, '').toLowerCase()) === clean
  ) || null;
};

/**
 * 🛠️ [L2] 득점왕 랭킹 — 시즌/누적 토글
 *  - 시즌: 현재 시즌 매치의 scorer 집계
 *  - 누적: history_records.players
 *  - 각 행: 선수명 + 팀 엠블럼 + 팀명 + 오너 프로필 + 오너이름 + 수평바 + 골수
 */
export const L2_TopScorers = ({ seasons, owners, masterTeams, viewSeasonId }: Props) => {
  const [mode, setMode] = useState<'SEASON' | 'ALL'>('SEASON');
  const { historyData } = useHistoryRecords(owners, seasons, masterTeams);

  const players = useMemo(() => {
    if (mode === 'SEASON') {
      const current = (seasons || []).find((s: any) => s.id === viewSeasonId)
        || [...(seasons || [])].sort((a: any, b: any) => b.id - a.id)[0];
      if (!current) return [];
      const stats: Record<string, any> = {};
      (current.rounds || []).forEach((r: any) => {
        (r.matches || []).forEach((m: any) => {
          if (m.status !== 'COMPLETED') return;
          const processScorer = (list: any[], teamName: string, teamLogo: string, ownerName: string, ownerUid: string) => {
            (list || []).forEach((s: any) => {
              const pName = typeof s === 'string' ? s : s.name;
              const count = typeof s === 'string' ? 1 : (s.count || 1);
              if (!pName) return;
              const key = `${pName}_${teamName}`;
              if (!stats[key]) stats[key] = { name: pName, team: teamName, teamLogo, ownerName, ownerUid, goals: 0 };
              stats[key].goals += count;
            });
          };
          processScorer(m.homeScorers, m.home, m.homeLogo, m.homeOwner, m.homeOwnerUid);
          processScorer(m.awayScorers, m.away, m.awayLogo, m.awayOwner, m.awayOwnerUid);
        });
      });
      return Object.values(stats).sort((a: any, b: any) => b.goals - a.goals).slice(0, 8);
    } else {
      // 🛠️ [v2 픽스] 누적 데이터도 명시적 정렬 (historyData.players 가 항상 정렬돼있다고 가정 불가)
      return (historyData?.players || [])
        .slice()
        .sort((a: any, b: any) => (Number(b.goals) || 0) - (Number(a.goals) || 0))
        .slice(0, 8)
        .map((p: any) => ({
          name: p.name,
          team: p.team,
          teamLogo: p.teamLogo,
          ownerName: p.owner,
          ownerUid: p.ownerId,
          goals: p.goals,
        }));
    }
  }, [mode, seasons, viewSeasonId, historyData]);

  const maxGoals = players.length > 0 ? Math.max(...players.map((p: any) => p.goals || 0)) : 1;

  const rankColors = ['text-yellow-400', 'text-slate-300', 'text-orange-400'];

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 sm:p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-[3px] h-[14px] rounded bg-emerald-500" />
          <span className="text-[13px] font-black italic text-white tracking-wide">TOP SCORERS</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setMode('SEASON')}
            className={`text-[10px] px-2.5 py-1 rounded-md font-bold transition ${
              mode === 'SEASON' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >시즌</button>
          <button
            onClick={() => setMode('ALL')}
            className={`text-[10px] px-2.5 py-1 rounded-md font-bold transition ${
              mode === 'ALL' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >누적</button>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="text-center text-[11px] text-slate-500 py-6">집계할 데이터가 없습니다</div>
      ) : (
        <div className="flex flex-col gap-2">
          {players.map((p: any, idx: number) => {
            const rankColor = idx < 3 ? rankColors[idx] : 'text-slate-500';
            const ownerInfo = findOwnerProfile(owners, p.ownerUid, p.ownerName);
            const master = findTeamMaster(masterTeams, p.team);
            const teamLogo = master?.logo || p.teamLogo || FALLBACK_IMG;
            return (
              <div key={`${p.name}_${p.team}_${idx}`} className="flex items-center gap-2 sm:gap-3 p-2 bg-slate-800/50 rounded-lg">
                <span className={`text-[13px] font-black italic w-4 text-center ${rankColor}`}>{idx + 1}</span>
                {/* 선수 + 팀 */}
                <div className="flex items-center gap-2 min-w-0" style={{ flex: '0 0 auto', maxWidth: '40%' }}>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-black italic text-white truncate">{p.name}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0">
                        <img src={teamLogo} alt="" className="w-[78%] h-[78%] object-contain" onError={(e: any) => { e.target.src = FALLBACK_IMG; }} />
                      </div>
                      <span className="text-[8px] text-slate-400 truncate">{p.team || '-'}</span>
                    </div>
                  </div>
                </div>
                {/* 바 */}
                <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      idx === 0 ? 'bg-yellow-400' :
                      idx === 1 ? 'bg-slate-300' :
                      idx === 2 ? 'bg-orange-400' : 'bg-emerald-500/60'
                    }`}
                    style={{ width: `${Math.max(5, (p.goals / Math.max(maxGoals, 1)) * 100)}%` }}
                  />
                </div>
                {/* 🛠️ [v2 픽스] 오너 — 모바일에서도 노출 (사진 + 이름) */}
                <div className="flex items-center gap-1 shrink-0">
                  <img src={ownerInfo.photo} alt="" className="w-3.5 h-3.5 rounded-full object-cover bg-slate-700 border border-slate-800" onError={(e: any) => { e.target.src = FALLBACK_IMG; }} />
                  <span className="text-[8px] sm:text-[9px] text-slate-400 whitespace-nowrap max-w-[60px] sm:max-w-none truncate">{ownerInfo.nickname}</span>
                </div>
                <span className={`text-[12px] font-black italic w-8 text-right tabular-nums ${rankColor}`}>
                  {p.goals}<span className="text-[8px] opacity-60 ml-0.5">⚽</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
