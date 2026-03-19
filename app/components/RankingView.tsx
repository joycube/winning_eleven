"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { Owner } from '../types'; 

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
  const isHybridSeason = currentSeason?.type === 'CUP' || currentSeason?.type === 'LEAGUE_PLAYOFF' || currentSeason?.type === 'TOURNAMENT';

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

  // 🔥 [디벨롭 1] 실명 전환(Resolve TBD) 로직 적용 (useLeagueStats와 동일하게)
  const processedRounds = useMemo(() => {
      if (!currentSeason?.rounds) return [];
      const roundsCopy = JSON.parse(JSON.stringify(currentSeason.rounds));

      const calcAggWinner = (leg1: any, leg2: any) => {
          if (!leg1) return 'TBD';
          if (leg2?.aggWinner && leg2.aggWinner !== 'TBD') return leg2.aggWinner;
          if (leg1?.aggWinner && leg1.aggWinner !== 'TBD') return leg1.aggWinner;
          let s1 = 0, s2 = 0;
          if (leg1.status === 'COMPLETED') { s1 += Number(leg1.homeScore); s2 += Number(leg1.awayScore); }
          if (leg2?.status === 'COMPLETED') {
              if (leg2.home === leg1.away) { s2 += Number(leg2.homeScore); s1 += Number(leg2.awayScore); }
              else { s1 += Number(leg2.homeScore); s2 += Number(leg2.awayScore); }
          }
          if (s1 > s2) return leg1.home;
          if (s2 > s1) return leg1.away;
          return 'TBD';
      };

      if (currentSeason.type === 'LEAGUE_PLAYOFF') {
          const po4Rounds = roundsCopy.filter((r: any) => r.name === 'ROUND_OF_4').flatMap((r: any) => r.matches);
          const poFinalRounds = roundsCopy.filter((r: any) => r.name === 'SEMI_FINAL').flatMap((r: any) => r.matches);
          const grandFinalRounds = roundsCopy.filter((r: any) => r.name === 'FINAL').flatMap((r: any) => r.matches);

          const poSemi1_leg1 = po4Rounds.find((m: any) => m.matchLabel?.includes('5위') && m.matchLabel?.includes('1차전'));
          const poSemi1_leg2 = po4Rounds.find((m: any) => m.matchLabel?.includes('2위') && m.matchLabel?.includes('2차전'));
          const poSemi2_leg1 = po4Rounds.find((m: any) => m.matchLabel?.includes('4위') && m.matchLabel?.includes('1차전'));
          const poSemi2_leg2 = po4Rounds.find((m: any) => m.matchLabel?.includes('3위') && m.matchLabel?.includes('2차전'));

          const wSemi1 = calcAggWinner(poSemi1_leg1, poSemi1_leg2);
          const wSemi2 = calcAggWinner(poSemi2_leg1, poSemi2_leg2);

          poFinalRounds.forEach((m: any) => {
              if (m.home === 'TBD') m.home = wSemi1;
              if (m.away === 'TBD') m.away = wSemi2;
          });

          const poFinal_leg1 = poFinalRounds.find((m: any) => m.matchLabel?.includes('1차전'));
          const poFinal_leg2 = poFinalRounds.find((m: any) => m.matchLabel?.includes('2차전'));
          const wPoFinal = calcAggWinner(poFinal_leg1, poFinal_leg2);

          grandFinalRounds.forEach((m: any) => {
              if (m.away === 'TBD') m.away = wPoFinal;
          });
      }
      else if (currentSeason.type === 'TOURNAMENT' || currentSeason.type === 'CUP') {
          const getWinnerSingle = (m: any) => {
              if (!m || m.status !== 'COMPLETED') return 'TBD';
              if (m.aggWinner && m.aggWinner !== 'TBD') return m.aggWinner;
              const h = Number(m.homeScore || 0), a = Number(m.awayScore || 0);
              return h > a ? m.home : (a > h ? m.away : 'TBD');
          };
          const allMatches = roundsCopy.flatMap((r:any) => r.matches || []);
          const orderedStages = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'];
          for (let i = 0; i < orderedStages.length - 1; i++) {
              const currStageMatches = allMatches.filter((m:any) => m.stage === orderedStages[i]).sort((a:any,b:any)=>a.id.localeCompare(b.id));
              const nextStageMatches = allMatches.filter((m:any) => m.stage === orderedStages[i+1]).sort((a:any,b:any)=>a.id.localeCompare(b.id));
              
              if (currStageMatches.length > 0 && nextStageMatches.length > 0) {
                  nextStageMatches.forEach((nextM: any, idx: number) => {
                      if (nextM.home === 'TBD' || nextM.home === 'BYE') {
                          const m1 = currStageMatches[idx * 2];
                          if (m1) nextM.home = getWinnerSingle(m1);
                      }
                      if (nextM.away === 'TBD' || nextM.away === 'BYE') {
                          const m2 = currStageMatches[idx * 2 + 1];
                          if (m2) nextM.away = getWinnerSingle(m2);
                      }
                  });
              }
          }
      }
      return roundsCopy;
  }, [currentSeason]);

  const grandFinalMatch = useMemo(() => {
      if (processedRounds.length === 0) return null;

      const allMatches = processedRounds.flatMap((r: any) => r.matches || []);
      if (allMatches.length === 0) return null;

      const explicitFinalMatches = allMatches.filter((m: any) => {
          const s = (m.stage || '').toUpperCase();
          const l = (m.matchLabel || '').toUpperCase();
          const isFinalText = s.includes('FINAL') || s.includes('결승') || l.includes('FINAL') || l.includes('결승');
          const isNotSemi = !(s.includes('SEMI') || s.includes('4강') || l.includes('SEMI') || l.includes('4강') || s.includes('34') || l.includes('34'));
          return isFinalText && isNotSemi;
      });

      if (explicitFinalMatches.length > 0) return explicitFinalMatches[explicitFinalMatches.length - 1];

      if (currentSeason?.type === 'TOURNAMENT' || currentSeason?.type === 'CUP' || currentSeason?.type === 'LEAGUE_PLAYOFF') {
          const lastRound = processedRounds[processedRounds.length - 1];
          if (lastRound && lastRound.matches && lastRound.matches.length > 0) {
              return lastRound.matches[lastRound.matches.length - 1];
          }
      }
      return null;
  }, [processedRounds, currentSeason?.type]);

  const grandChampionInfo = useMemo(() => {
      if (!grandFinalMatch) return null;
      if (grandFinalMatch.status !== 'COMPLETED') return null;

      let winnerName = null;
      if ((grandFinalMatch as any).aggWinner && (grandFinalMatch as any).aggWinner !== 'TBD') {
          winnerName = (grandFinalMatch as any).aggWinner;
      } else {
          const hScore = Number(grandFinalMatch.homeScore || 0);
          const aScore = Number(grandFinalMatch.awayScore || 0);
          if (hScore > aScore) winnerName = grandFinalMatch.home;
          else if (aScore > hScore) winnerName = grandFinalMatch.away;
      }

      if (!winnerName || winnerName === 'TBD') return null;
      return getTeamExtendedInfo(winnerName);
  }, [grandFinalMatch, activeRankingData, masterTeams]);

  // 🔥 [디벨롭 2] 1위, 2위, 3위를 완벽하게 추적하여 R_OwnersTab에 넘겨줄 Props 생성!
  const poTournamentResult = useMemo(() => {
      if (!currentSeason || !isHybridSeason) return undefined;
      const allMatches = processedRounds.flatMap((r: any) => r.matches || []);
      
      let champion = 'TBD'; let runnerUp = 'TBD'; let thirdPlace = 'TBD';

      const getResult = (stageMatches: any[]) => {
          if (!stageMatches || stageMatches.length === 0) return { w: 'TBD', l: 'TBD' };
          const m = stageMatches[stageMatches.length - 1]; 
          if (m.status !== 'COMPLETED') return { w: 'TBD', l: 'TBD' };
          
          if (m.aggWinner && m.aggWinner !== 'TBD') {
              return { w: m.aggWinner, l: m.aggWinner === m.home ? m.away : m.home };
          }
          const h = Number(m.homeScore || 0); const a = Number(m.awayScore || 0);
          if (h > a) return { w: m.home, l: m.away };
          if (a > h) return { w: m.away, l: m.home };
          return { w: 'TBD', l: 'TBD' }; 
      };

      if (currentSeason.type === 'LEAGUE_PLAYOFF') {
          const gfMatches = allMatches.filter((m:any) => m.stage === 'FINAL');
          const sfMatches = allMatches.filter((m:any) => m.stage === 'SEMI_FINAL');
          
          const gfRes = getResult(gfMatches);
          champion = gfRes.w; runnerUp = gfRes.l;
          
          const sfRes = getResult(sfMatches);
          thirdPlace = sfRes.l; 
      } 
      else if (currentSeason.type === 'CUP' || currentSeason.type === 'TOURNAMENT') {
          const gfMatches = allMatches.filter((m:any) => m.stage === 'FINAL');
          const tMatches = allMatches.filter((m:any) => m.stage === '34' || m.matchLabel?.includes('3위'));
          
          const gfRes = getResult(gfMatches);
          champion = gfRes.w; runnerUp = gfRes.l;
          
          const tRes = getResult(tMatches);
          thirdPlace = tRes.w; 
      }

      // 최종 우승자는 grandChampionInfo로 한 번 더 검증 (확실한 보장)
      if (grandChampionInfo?.name) champion = grandChampionInfo.name;

      return { champion, runnerUp, thirdPlace };
  }, [processedRounds, currentSeason, isHybridSeason, grandChampionInfo]);

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
            // 🔥 [수술 핵심 3] 추적된 1/2/3위 팀 결과를 드디어 전달!
            poTournamentResult={poTournamentResult} 
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