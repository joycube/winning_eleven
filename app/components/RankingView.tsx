"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { Owner } from '../types'; 

// 🔥 분리해둔 4개의 탭 컴포넌트를 불러옵니다
import R_StandingsTab from './R_StandingsTab';
import R_OwnersTab from './R_OwnersTab';
import R_PlayersTab from './R_PlayersTab';
import R_HighlightsTab from './R_HighlightsTab';

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

const getTodayFormatted = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}.${month}.${day}`;
};

interface RankingViewProps {
  seasons: any[];
  viewSeasonId: number;
  setViewSeasonId: (id: number) => void;
  activeRankingData: any;
  owners?: Owner[];
  knockoutStages?: any; 
}

export const RankingView = ({ seasons, viewSeasonId, setViewSeasonId, activeRankingData, owners = [], knockoutStages }: RankingViewProps) => {
  const [rankingTab, setRankingTab] = useState<'STANDINGS' | 'OWNERS' | 'PLAYERS' | 'HIGHLIGHTS'>('STANDINGS');
  const [masterTeams, setMasterTeams] = useState<any[]>([]);

  // 마스터 팀 정보 한 번만 로드
  useEffect(() => {
    const fetchMasterTeams = async () => {
      try {
        const q = query(collection(db, 'master_teams'));
        const snap = await getDocs(q);
        const teams = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMasterTeams(teams);
      } catch (err) { console.error(err); }
    };
    fetchMasterTeams();
  }, []);

  // 시즌 및 공통 메타 데이터 계산
  const currentSeason = seasons.find(s => s.id === viewSeasonId);
  const seasonName = currentSeason?.name || 'Unknown Season';
  const todayDate = getTodayFormatted();
  const footerText = `시즌 '${seasonName}' / ${todayDate}`;
  const prizeRule = currentSeason?.prizes || { champion: 0, first: 0, second: 0, third: 0, scorer: 0, assist: 0, poScorer: 0, poAssist: 0 };
  const isHybridSeason = currentSeason?.type === 'CUP' || currentSeason?.type === 'LEAGUE_PLAYOFF';

  // 👑 오너 탭에 전달할 그랜드 파이널 챔피언 및 랭킹 팀 연산
  const getRankedTeams = (teams: any[]) => {
    const sorted = [...(teams || [])].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return (b.gf || 0) - (a.gf || 0);
    });
    
    const ranked: any[] = [];
    sorted.forEach((t, i) => {
      let rank = i + 1;
      if (i > 0) {
        const p = ranked[i - 1];
        if (t.points === p.points && t.gd === p.gd && (t.gf || 0) === (p.gf || 0)) rank = p.rank;
      }
      ranked.push({ ...t, rank });
    });
    return ranked;
  };

  const sortedTeams = useMemo(() => getRankedTeams(activeRankingData?.teams || []), [activeRankingData?.teams]);

  const normalize = (str: string) => str ? str.toString().trim().toLowerCase().replace(/\s+/g, '') : "";

  const resolveOwnerNickname = (ownerName: any, ownerUid?: string) => {
    try {
        if (!ownerName) return '-';
        const strName = String(ownerName).trim();
        if (['-', 'CPU', 'SYSTEM', 'TBD', 'BYE', 'GUEST'].includes(strName.toUpperCase())) return strName;
        const foundByUid = owners.find(o => (ownerUid && (o.uid === ownerUid || o.docId === ownerUid)) || (o.uid === strName || o.docId === strName));
        if (foundByUid) return foundByUid.nickname;
        const foundByName = owners.find(o => o.nickname === strName || o.legacyName === strName);
        return foundByName ? foundByName.nickname : strName;
    } catch (e) { return String(ownerName || '-'); }
  };

  const getTeamExtendedInfo = (teamIdentifier: string) => {
    const tbdTeam = { id: 0, name: teamIdentifier || 'TBD', logo: SAFE_TBD_LOGO, ownerName: '-', ownerUid: undefined as string | undefined, region: '', tier: 'C', realRankScore: 0, realFormScore: 0, condition: 'C', real_rank: null };
    if (!teamIdentifier || teamIdentifier === 'TBD') return tbdTeam;
    if (teamIdentifier === 'BYE') return { ...tbdTeam, name: 'BYE', ownerName: 'SYSTEM' };
    
    const normId = normalize(teamIdentifier);
    let stats = activeRankingData?.teams?.find((t: any) => normalize(t.name) === normId);
    let master = masterTeams.find((m: any) => m.name === teamIdentifier || normalize(m.name) === normId || normalize(m.teamName) === normId || m.id === teamIdentifier);
    
    const rawOwnerName = stats?.ownerName || (master as any)?.ownerName || 'CPU';
    const rawOwnerUid = stats?.ownerUid || (master as any)?.ownerUid;

    return { 
        id: stats?.id || master?.id || 0, 
        name: stats?.name || master?.name || teamIdentifier, 
        logo: stats?.logo || master?.logo || SAFE_TBD_LOGO, 
        ownerName: resolveOwnerNickname(rawOwnerName, rawOwnerUid), 
        ownerUid: rawOwnerUid, 
        region: master?.region || '', tier: master?.tier || 'C', realRankScore: master?.realRankScore, 
        realFormScore: master?.realFormScore, condition: master?.condition || 'C', real_rank: master?.real_rank 
    };
  };

  const grandFinalMatch = useMemo(() => {
      if (!currentSeason?.rounds) return null;
      return currentSeason.rounds.flatMap((r: any) => r.matches).find((m: any) => m.stage?.toUpperCase().includes('FINAL') && !m.stage?.toUpperCase().includes('SEMI') && !m.stage?.toUpperCase().includes('QUARTER'));
  }, [currentSeason]);

  const grandChampionInfo = useMemo(() => {
      if (!grandFinalMatch || grandFinalMatch.status !== 'COMPLETED') return null;
      const hScore = Number(grandFinalMatch.homeScore);
      const aScore = Number(grandFinalMatch.awayScore);
      let winnerName = null;
      if (hScore > aScore) winnerName = grandFinalMatch.home;
      if (aScore > hScore) winnerName = grandFinalMatch.away;
      if (!winnerName || winnerName === 'TBD') return null;
      return getTeamExtendedInfo(winnerName);
  }, [grandFinalMatch, activeRankingData, masterTeams]);

  const SubTabs = ['STANDINGS', 'OWNERS', 'PLAYERS', 'HIGHLIGHTS'] as const;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* 글로벌 스타일 적용 */}
      <style dangerouslySetInnerHTML={{ __html: `
        .crown-icon { animation: bounce 2s infinite; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .champion-glow { box-shadow: 0 0 50px rgba(234, 179, 8, 0.4); }
        .bracket-tree { display: inline-flex; align-items: center; justify-content: flex-start; gap: 40px; padding: 10px 0 20px 4px; min-width: max-content; }
        .bracket-column { display: flex; flex-direction: column; justify-content: center; gap: 20px; position: relative; }
      `}} />

      {/* 상단 시즌 선택 및 탭 컨트롤 */}
      <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col gap-4">
        <div className="relative">
          <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="w-full bg-slate-950 text-white text-base font-bold py-4 px-5 rounded-xl border border-slate-700 shadow-xl appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer italic">
            {seasons.map(s => {
                const pureName = s.name.replace(/^(🏆|🏳️|⚔️|⚽|🗓️|⭐)\s*/, '');
                let icon = '🏳️'; if (s.type === 'CUP') icon = '🏆'; if (s.type === 'TOURNAMENT') icon = '⚔️'; if (s.type === 'LEAGUE_PLAYOFF') icon = '⭐';
                return <option key={s.id} value={s.id} className="text-white text-base bg-slate-900 py-2">{icon} {pureName}</option>
            })}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {SubTabs.map(sub => (
            <button key={sub} onClick={() => setRankingTab(sub as any)} className={`px-4 py-2 rounded-lg text-xs font-black italic transition-all whitespace-nowrap ${rankingTab === sub ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}>{sub}</button>
          ))}
        </div>
      </div>

      {/* 모듈화된 하위 탭 렌더링 */}
      {rankingTab === 'STANDINGS' && (
        <R_StandingsTab 
            currentSeason={currentSeason}
            activeRankingData={activeRankingData}
            masterTeams={masterTeams}
            owners={owners}
            knockoutStages={knockoutStages}
        />
      )}

      {rankingTab === 'OWNERS' && (
        <R_OwnersTab 
            currentSeason={currentSeason}
            activeRankingData={activeRankingData}
            owners={owners}
            sortedTeams={sortedTeams}
            grandChampionInfo={grandChampionInfo}
            prizeRule={prizeRule}
            footerText={footerText}
        />
      )}

      {rankingTab === 'PLAYERS' && (
        <R_PlayersTab 
            activeRankingData={activeRankingData}
            isHybridSeason={isHybridSeason}
            owners={owners}
        />
      )}

      {rankingTab === 'HIGHLIGHTS' && (
        <R_HighlightsTab 
            currentSeason={currentSeason}
            activeRankingData={activeRankingData}
        />
      )}
    </div>
  );
};

export default RankingView;