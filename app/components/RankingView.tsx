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

  const currentSeason = seasons.find(s => s.id === viewSeasonId);
  const seasonName = currentSeason?.name || 'Unknown Season';
  const todayDate = getTodayFormatted();
  const footerText = `시즌 '${seasonName}' / ${todayDate}`;
  const prizeRule = currentSeason?.prizes || { champion: 0, first: 0, second: 0, third: 0, scorer: 0, assist: 0, poScorer: 0, poAssist: 0 };
  const isHybridSeason = currentSeason?.type === 'CUP' || currentSeason?.type === 'LEAGUE_PLAYOFF';

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

  // 🔥 [핵심 수술 포인트] 스케줄 뷰와 완벽하게 동일한 실시간 대진표 계산(TBD 치환) 로직 이식!
  const processedRounds = useMemo(() => {
      if (!currentSeason?.rounds) return [];
      const roundsCopy = JSON.parse(JSON.stringify(currentSeason.rounds));

      if (currentSeason.type === 'LEAGUE_PLAYOFF') {
          const po4Rounds = roundsCopy.filter((r: any) => r.name === 'ROUND_OF_4').flatMap((r: any) => r.matches);
          const poFinalRounds = roundsCopy.filter((r: any) => r.name === 'SEMI_FINAL').flatMap((r: any) => r.matches);
          const grandFinalRounds = roundsCopy.filter((r: any) => r.name === 'FINAL').flatMap((r: any) => r.matches);

          const calcAgg = (leg1: any, leg2: any) => {
              if (!leg1) return null;
              let s1 = 0, s2 = 0;
              let isLeg1Done = leg1.status === 'COMPLETED';
              let isLeg2Done = leg2 && leg2.status === 'COMPLETED';
              const t1 = leg1.home; const t2 = leg1.away;
              if (isLeg1Done) { s1 += Number(leg1.homeScore); s2 += Number(leg1.awayScore); }
              if (isLeg2Done && leg2) { 
                  if (leg2.home === t2) { s2 += Number(leg2.homeScore); s1 += Number(leg2.awayScore); } 
                  else { s1 += Number(leg2.homeScore); s2 += Number(leg2.awayScore); }
              }
              let aggWinner = 'TBD';
              if (leg2 && leg2.aggWinner && leg2.aggWinner !== 'TBD') aggWinner = leg2.aggWinner;
              else if (leg1 && leg1.aggWinner && leg1.aggWinner !== 'TBD') aggWinner = leg1.aggWinner;
              else if (isLeg1Done && (!leg2 || isLeg2Done)) {
                  if (s1 > s2) aggWinner = t1;
                  else if (s2 > s1) aggWinner = t2;
              }
              return { ...leg1, aggWinner };
          };

          const poSemi1_leg1 = po4Rounds.find((m: any) => m.matchLabel?.includes('5위') && m.matchLabel?.includes('1차전'));
          const poSemi1_leg2 = po4Rounds.find((m: any) => m.matchLabel?.includes('2위') && m.matchLabel?.includes('2차전'));
          const poSemi2_leg1 = po4Rounds.find((m: any) => m.matchLabel?.includes('4위') && m.matchLabel?.includes('1차전'));
          const poSemi2_leg2 = po4Rounds.find((m: any) => m.matchLabel?.includes('3위') && m.matchLabel?.includes('2차전'));

          const compSemi1 = calcAgg(poSemi1_leg1, poSemi1_leg2);
          const compSemi2 = calcAgg(poSemi2_leg1, poSemi2_leg2);

          if (compSemi1?.aggWinner && compSemi1.aggWinner !== 'TBD') {
              poFinalRounds.forEach((m: any) => { m.home = compSemi1.aggWinner; });
          }
          if (compSemi2?.aggWinner && compSemi2.aggWinner !== 'TBD') {
              poFinalRounds.forEach((m: any) => { m.away = compSemi2.aggWinner; });
          }

          const poFinal_leg1 = poFinalRounds.find((m: any) => m.matchLabel?.includes('1차전'));
          const poFinal_leg2 = poFinalRounds.find((m: any) => m.matchLabel?.includes('2차전'));
          const compPoFinal = calcAgg(poFinal_leg1, poFinal_leg2);

          if (compPoFinal?.aggWinner && compPoFinal.aggWinner !== 'TBD') {
              grandFinalRounds.forEach((m: any) => { m.away = compPoFinal.aggWinner; });
          }
      }
      return roundsCopy;
  }, [currentSeason]);

  // DB 데이터가 아니라, 실시간으로 계산된 processedRounds 에서 결승전을 가져옵니다.
  const grandFinalMatch = useMemo(() => {
      if (processedRounds.length === 0) return null;
      
      const allMatches = processedRounds.flatMap((r: any) => r.matches || []);
      return allMatches.find((m: any) => {
          const s = (m.stage || '').toUpperCase();
          const l = (m.matchLabel || '').toUpperCase();
          const isFinalText = s.includes('FINAL') || s.includes('결승') || l.includes('FINAL') || l.includes('결승');
          const isNotSemi = !(s.includes('SEMI') || s.includes('4강') || l.includes('SEMI') || l.includes('4강') || s.includes('34') || l.includes('34'));
          return isFinalText && isNotSemi;
      });
  }, [processedRounds]);

  const grandChampionInfo = useMemo(() => {
      if (!grandFinalMatch) return null;
      
      const hScoreText = grandFinalMatch.homeScore;
      const aScoreText = grandFinalMatch.awayScore;
      
      // 결승전 자리에 팀이 없거나, 점수가 안 들어갔으면 아직 우승자가 없는 것
      if (grandFinalMatch.home === 'TBD' || grandFinalMatch.away === 'TBD') return null;
      if (grandFinalMatch.status !== 'COMPLETED') return null;

      let winnerName = null;

      if ((grandFinalMatch as any).aggWinner && (grandFinalMatch as any).aggWinner !== 'TBD') {
          winnerName = (grandFinalMatch as any).aggWinner;
      } else {
          const hScore = Number(hScoreText || 0);
          const aScore = Number(aScoreText || 0);
          if (hScore > aScore) winnerName = grandFinalMatch.home;
          else if (aScore > hScore) winnerName = grandFinalMatch.away;
      }

      if (!winnerName || winnerName === 'TBD') return null;
      return getTeamExtendedInfo(winnerName);
  }, [grandFinalMatch, activeRankingData, masterTeams]);

  const SubTabs = ['STANDINGS', 'PLAYERS', 'OWNERS', 'HIGHLIGHTS'] as const;

  return (
    <div className="space-y-6 animate-in fade-in">
      <style dangerouslySetInnerHTML={{ __html: `
        .crown-icon { animation: bounce 2s infinite; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .champion-glow { box-shadow: 0 0 50px rgba(234, 179, 8, 0.4); }
        .bracket-tree { display: inline-flex; align-items: center; justify-content: flex-start; gap: 40px; padding: 10px 0 20px 4px; min-width: max-content; }
        .bracket-column { display: flex; flex-direction: column; justify-content: center; gap: 20px; position: relative; }
      `}} />

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

      {rankingTab === 'STANDINGS' && (
        <R_StandingsTab 
            currentSeason={currentSeason}
            activeRankingData={activeRankingData}
            masterTeams={masterTeams}
            owners={owners}
            knockoutStages={knockoutStages}
        />
      )}

      {rankingTab === 'PLAYERS' && (
        <R_PlayersTab 
            currentSeason={currentSeason} 
            activeRankingData={activeRankingData}
            isHybridSeason={isHybridSeason}
            owners={owners}
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