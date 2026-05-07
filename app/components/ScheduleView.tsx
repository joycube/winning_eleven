"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore'; 
import { db } from '../firebase'; 
import { MatchCard } from './MatchCard'; 
import { CupSchedule } from './CupSchedule'; 
import { Season, Match, MasterTeam, Owner } from '../types'; 
import { MessageSquare } from 'lucide-react';
import { LiveFeed } from './LiveFeed';

import AdminMatching_TournamentBracketView from './AdminMatching_TournamentBracketView';
import { AdminMatching_LeaguePOBracketView } from './AdminMatching_LeaguePOBracketView';

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";
const FALLBACK_IMG = "https://via.placeholder.com/64?text=FC";

const getTodayFormatted = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}.${month}.${day}`;
};

const resolveOwnerInfo = (owners: Owner[], ownerName: string, ownerUid?: string) => {
    if (!ownerName || ['-', 'CPU', 'SYSTEM', 'TBD', 'BYE'].includes(ownerName.trim().toUpperCase())) {
        return { nickname: ownerName, photo: FALLBACK_IMG };
    }
    
    const search = ownerName.trim();
    
    const foundUser = owners.find(o => 
        (ownerUid && (o.uid === ownerUid || o.docId === ownerUid)) || 
        (o.uid === search || o.docId === search) ||
        (o.nickname === search || o.legacyName === search || (o as any).mappedOwnerId === search || (o as any).displayName === search)
    );

    if (foundUser) {
        const actualName = foundUser.nickname || (foundUser as any).mappedOwnerId || (foundUser as any).displayName || ownerName;
        const actualPhoto = foundUser.photo || (foundUser as any).photoURL || FALLBACK_IMG;
        
        return { nickname: actualName, photo: actualPhoto };
    }

    return { nickname: ownerName, photo: FALLBACK_IMG };
};

const MatchCommentSnippet = ({ matchId, onClick, owners }: { matchId: string, onClick: () => void, owners: Owner[] }) => {
    const [latestComment, setLatestComment] = useState<any>(null);
    const [commentCount, setCommentCount] = useState(0);

    useEffect(() => {
        if (!matchId) return;
        const q = query(collection(db, 'match_comments'), where('matchId', '==', matchId));
        const unsubscribe = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(d => d.data());
            setCommentCount(docs.length);
            if (docs.length > 0) {
                docs.sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));
                setLatestComment(docs[docs.length - 1]);
            } else {
                setLatestComment(null);
            }
        });
        return () => unsubscribe();
    }, [matchId]);

    if (commentCount === 0) return null;

    const authorInfo = latestComment ? resolveOwnerInfo(owners, (latestComment.authorName || latestComment.ownerName) || '', latestComment.authorUid || latestComment.ownerUid) : null;

    return (
        <div onClick={onClick} className="bg-slate-800/60 px-4 py-3 rounded-b-xl border-t border-slate-700/50 flex items-center gap-2 cursor-pointer hover:bg-slate-700/80 transition-colors z-0 -mt-2">
            {authorInfo ? (
                <img src={authorInfo.photo} className="w-4 h-4 rounded-full object-cover border border-slate-600 shrink-0 shadow-sm" alt="profile" />
            ) : (
                <MessageSquare size={13} className="text-emerald-500 shrink-0 mr-1" />
            )}
            
            <div className="text-[11px] font-black text-emerald-400 shrink-0 max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap pr-1.5">
                {authorInfo ? authorInfo.nickname : ''}
            </div>
            <div className="text-[12px] text-slate-300 flex-1 font-medium line-clamp-1 break-all">
                {latestComment?.text}
            </div>
            <div className="bg-slate-900 px-2 py-0.5 rounded-md text-[9px] font-black text-emerald-500 border border-slate-700 shrink-0 shadow-inner flex items-center leading-none ml-1">
                +{commentCount}
            </div>
        </div>
    );
};

interface ScheduleViewProps {
  seasons: Season[];
  viewSeasonId: number;
  setViewSeasonId: (id: number) => void;
  onMatchClick: (m: Match) => void;
  activeRankingData: any;
  historyData: any;
  knockoutStages?: any;
}

export const ScheduleView = ({ 
  seasons, viewSeasonId, setViewSeasonId, onMatchClick,
  activeRankingData, historyData, knockoutStages
}: ScheduleViewProps) => {
  const [viewMode, setViewMode] = useState<'LEAGUE' | 'CUP' | 'LEAGUE_PLAYOFF' | 'TOURNAMENT'>('LEAGUE');
  const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const matchRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const currentSeason = seasons.find(s => s.id === viewSeasonId);

  useEffect(() => {
    if (currentSeason?.type === 'CUP') setViewMode('CUP');
    else if (currentSeason?.type === 'LEAGUE_PLAYOFF') setViewMode('LEAGUE_PLAYOFF');
    else if (currentSeason?.type === 'TOURNAMENT') setViewMode('TOURNAMENT');
    else setViewMode('LEAGUE');
  }, [viewSeasonId, seasons, currentSeason]); 

  useEffect(() => {
    const fetchData = async () => {
      try {
        const teamQ = query(collection(db, 'master_teams'));
        const teamSnapshot = await getDocs(teamQ);
        const teams = teamSnapshot.docs.map(doc => ({ id: doc.data().id, ...doc.data() })) as MasterTeam[];
        setMasterTeams(teams);

        const userQ = query(collection(db, 'users'));
        const userSnapshot = await getDocs(userQ);
        const userList = userSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })) as Owner[];
        setOwners(userList);
      } catch (error) { console.error(error); }
    };
    fetchData();
  }, []);

  const getActiveOwner = (matchOwner: string, matchOwnerUid: string | undefined, teamName: string) => {
      const isMatchInvalid = !matchOwner || ['-', 'TBD', 'CPU', 'SYSTEM', 'BYE'].includes(matchOwner.trim().toUpperCase());
      if (!isMatchInvalid) return { name: matchOwner, uid: matchOwnerUid };

      const cleanName = (teamName || '').replace(/\s+/g, '').toLowerCase();
      const master = masterTeams.find(t => (t.name || (t as any).teamName || '').replace(/\s+/g, '').toLowerCase() === cleanName);
      
      const isMasterInvalid = !master?.ownerName || ['-', 'TBD', 'CPU', 'SYSTEM', 'BYE'].includes(master.ownerName.trim().toUpperCase());
      if (!isMasterInvalid && master) {
          return { name: master.ownerName, uid: master.ownerUid };
      }
      
      return { name: matchOwner, uid: matchOwnerUid };
  };

  // 🔥 [핵심 픽스] 스케줄 탭 전용 완벽한 스마트 파서 (단판, 부전승 완벽 처리)
  const internalKnockoutStages = useMemo(() => {
      if (!['CUP', 'TOURNAMENT'].includes(currentSeason?.type || '') || !currentSeason?.rounds) return knockoutStages;
      
      const createPlaceholder = (vId: string, stageName: string): Match => ({ 
          id: vId, home: 'TBD', away: 'TBD', homeScore: '', awayScore: '', status: 'UPCOMING',
          seasonId: currentSeason.id, homeLogo: SAFE_TBD_LOGO, awayLogo: SAFE_TBD_LOGO, homeOwner: '-', awayOwner: '-',
          homePredictRate: 0, awayPredictRate: 0, stage: stageName, matchLabel: 'TBD', youtubeUrl: '',
          homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [] 
      } as Match);

      const slots = {
          roundOf8: Array.from({ length: 4 }, (_, i) => createPlaceholder(`v-r8-${i}`, 'ROUND_OF_8')),
          roundOf4: Array.from({ length: 2 }, (_, i) => createPlaceholder(`v-r4-${i}`, 'SEMI_FINAL')),
          thirdPlace: [createPlaceholder('v-3rd', '3RD_PLACE')],
          final: [createPlaceholder('v-final', 'FINAL')]
      };

      let hasActualRoundOf8 = false;
      let hasActualRoundOf4 = false;
      const groupSet = new Set<string>();

      currentSeason.rounds.forEach((round: any) => {
          if (!round.matches) return;
          const totalMatchesInRound = round.matches.length;

          round.matches.forEach((m: any, localIdx: number) => {
              const stage = m.stage?.toUpperCase() || "";
              const label = m.matchLabel?.toUpperCase() || "";
              
              if (stage.includes("GROUP") || stage.includes("조별")) {
                  if (m.group) groupSet.add(m.group);
                  return;
              }

              const idMatch = m.id?.match ? m.id.match(/_M?(\d+)$/) : null;
              const idx = idMatch ? parseInt(idMatch[1], 10) : localIdx;
              const mSafe = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };

              const isThird = stage.includes("3RD") || stage.includes("34") || stage.includes("THIRD") || stage.includes("3·4위") || label.includes("3·4위");
              const isFinal = stage.includes("FINAL") || stage.includes("결승") || label.includes("결승");
              const isSemi = stage.includes("SEMI") || stage.includes("ROUND_OF_4") || stage.includes("4강") || stage.includes("준결승") || label.includes("4강");
              const isQuarter = stage.includes("ROUND_OF_8") || stage.includes("QUARTER") || stage.includes("8강") || label.includes("8강");

              let fallbackFinal = false;
              let fallbackSemi = false;
              let fallbackQuarter = false;

              if (stage === "TOURNAMENT" || stage === "토너먼트") {
                   if (totalMatchesInRound === 1) fallbackFinal = true;
                   else if (totalMatchesInRound === 2) fallbackSemi = true; 
                   else if (totalMatchesInRound === 3) {
                       if (localIdx === 2) fallbackFinal = true;
                       else fallbackSemi = true;
                   }
                   else if (totalMatchesInRound === 4) fallbackQuarter = true;
                   else if (totalMatchesInRound === 7) {
                       if (localIdx === 6) fallbackFinal = true;
                       else if (localIdx >= 4) fallbackSemi = true;
                       else fallbackQuarter = true;
                   }
              }

              if (isThird) {
                  slots.thirdPlace[0] = mSafe;
              } else if (isFinal || fallbackFinal) {
                  slots.final[0] = mSafe;
              } else if (isSemi || fallbackSemi) {
                  let targetIdx = idx < 2 ? idx : localIdx;
                  if (totalMatchesInRound === 3) targetIdx = localIdx;
                  else if (totalMatchesInRound === 7) targetIdx = localIdx - 4;
                  
                  if (targetIdx < slots.roundOf4.length) {
                      slots.roundOf4[targetIdx] = mSafe;
                      hasActualRoundOf4 = true;
                  }
              } else if (isQuarter || fallbackQuarter) {
                  let targetIdx = idx < 4 ? idx : localIdx;
                  if (targetIdx < slots.roundOf8.length) {
                      slots.roundOf8[targetIdx] = mSafe;
                      hasActualRoundOf8 = true; 
                  }
              }
          });
      });

      const getWinnerName = (match: Match | null): string => {
          if (!match) return 'TBD';
          const home = match.home?.trim();
          const away = match.away?.trim();
          // BYE(부전승) 로직 완벽 처리!
          if (home === 'BYE' && away !== 'BYE' && away !== 'TBD') return away;
          if (away === 'BYE' && home !== 'BYE' && home !== 'TBD') return home;
          if (home === 'BYE' || away === 'BYE' || home === 'TBD' || away === 'TBD') return 'TBD';
          if (match.status !== 'COMPLETED') return 'TBD';
          const h = Number(match.homeScore || 0);
          const a = Number(match.awayScore || 0);
          if (h > a) return home;
          if (a > h) return away;
          return 'TBD';
      };

      const getTeamMasterInfo = (teamName: string) => {
          if (!masterTeams || masterTeams.length === 0) return undefined;
          const cleanTarget = teamName.replace(/\s+/g, '').toLowerCase();
          return masterTeams.find((t: any) => (t.name || (t as any).teamName || '').replace(/\s+/g, '').toLowerCase() === cleanTarget);
      };

      const syncWinner = (target: any, side: 'home' | 'away', source: Match | null) => {
          if (!target || !source) return;
          const winner = getWinnerName(source);
          if (winner !== 'TBD' && winner !== 'BYE' && (target[side] === 'TBD' || !target[side] || target[side] === 'BYE')) {
              target[side] = winner;
              const master = getTeamMasterInfo(winner);
              target[`${side}Logo`] = master?.logo || FALLBACK_IMG;
              const owner = owners?.find((o:any) => o.nickname === master?.ownerName || o.legacyName === master?.ownerName || (o as any).mappedOwnerId === master?.ownerName);
              target[`${side}Owner`] = owner?.nickname || (owner as any)?.mappedOwnerId || master?.ownerName || '-';
              target[`${side}OwnerUid`] = owner?.uid || master?.ownerUid || '';
          }
      };

      const syncLoser = (target: any, side: 'home' | 'away', source: Match | null) => {
          if (!target || !source) return;
          const winner = getWinnerName(source);
          if (winner !== 'TBD' && winner !== 'BYE') {
              const loser = winner === source.home ? source.away : source.home;
              if (loser !== 'TBD' && loser !== 'BYE' && (target[side] === 'TBD' || !target[side] || target[side] === 'BYE')) {
                  target[side] = loser;
                  const master = getTeamMasterInfo(loser);
                  target[`${side}Logo`] = master?.logo || FALLBACK_IMG;
                  const owner = owners?.find((o:any) => o.nickname === master?.ownerName || o.legacyName === master?.ownerName || (o as any).mappedOwnerId === master?.ownerName);
                  target[`${side}Owner`] = owner?.nickname || (owner as any)?.mappedOwnerId || master?.ownerName || '-';
                  target[`${side}OwnerUid`] = owner?.uid || master?.ownerUid || '';
              }
          }
      };

      if (hasActualRoundOf8) {
          syncWinner(slots.roundOf4[0], 'home', slots.roundOf8[0]);
          syncWinner(slots.roundOf4[0], 'away', slots.roundOf8[1]);
          syncWinner(slots.roundOf4[1], 'home', slots.roundOf8[2]);
          syncWinner(slots.roundOf4[1], 'away', slots.roundOf8[3]);
      }
      syncWinner(slots.final[0], 'home', slots.roundOf4[0]);
      syncWinner(slots.final[0], 'away', slots.roundOf4[1]);
      syncLoser(slots.thirdPlace[0], 'home', slots.roundOf4[0]);
      syncLoser(slots.thirdPlace[0], 'away', slots.roundOf4[1]);

      const teamCount = currentSeason.teams?.length || 0;
      const needsRoundOf8 = hasActualRoundOf8 || groupSet.size >= 3 || teamCount >= 8;
      const needsRoundOf4 = hasActualRoundOf4 || groupSet.size > 0 || teamCount >= 3;

      return { 
          ...slots, 
          roundOf8: needsRoundOf8 ? slots.roundOf8 : null,
          roundOf4: needsRoundOf4 ? slots.roundOf4 : null
      };
  }, [currentSeason, knockoutStages, masterTeams, owners]);

  const displayRounds = useMemo(() => {
      if (!currentSeason || !currentSeason.rounds) return [];
      
      const clonedRounds = JSON.parse(JSON.stringify(currentSeason.rounds));

      const getTeamMasterInfo = (teamName: string) => {
          if (!masterTeams || masterTeams.length === 0) return undefined;
          const cleanTarget = teamName.replace(/\s+/g, '').toLowerCase();
          return masterTeams.find((t: any) => (t.name || (t as any).teamName || '').replace(/\s+/g, '').toLowerCase() === cleanTarget);
      };

      const fillTeamData = (match: any, side: 'home' | 'away', teamName: string) => {
          if (match[side] !== 'TBD' && match[side] !== 'BYE' && match[side] !== '') return;

          match[side] = teamName;
          const master = getTeamMasterInfo(teamName);
          match[`${side}Logo`] = master?.logo || FALLBACK_IMG;
          const owner = owners?.find((o:any) => o.nickname === master?.ownerName || o.legacyName === master?.ownerName || (o as any).mappedOwnerId === master?.ownerName);
          match[`${side}Owner`] = owner?.nickname || (owner as any)?.mappedOwnerId || master?.ownerName || '-';
          match[`${side}OwnerUid`] = owner?.uid || master?.ownerUid || '';
      };

      if (currentSeason.type === 'LEAGUE_PLAYOFF') {
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

          const po4Rounds = clonedRounds.filter((r: any) => r.name === 'ROUND_OF_4').flatMap((r: any) => r.matches);
          const poFinalRounds = clonedRounds.filter((r: any) => r.name === 'SEMI_FINAL').flatMap((r: any) => r.matches);
          const grandFinalRounds = clonedRounds.filter((r: any) => r.name === 'FINAL').flatMap((r: any) => r.matches);

          const poSemi1_leg1 = po4Rounds.find((m: any) => m.matchLabel?.includes('5위') && m.matchLabel?.includes('1차전'));
          const poSemi1_leg2 = po4Rounds.find((m: any) => m.matchLabel?.includes('2위') && m.matchLabel?.includes('2차전'));
          const poSemi2_leg1 = po4Rounds.find((m: any) => m.matchLabel?.includes('4위') && m.matchLabel?.includes('1차전'));
          const poSemi2_leg2 = po4Rounds.find((m: any) => m.matchLabel?.includes('3위') && m.matchLabel?.includes('2차전'));

          const compSemi1 = calcAgg(poSemi1_leg1, poSemi1_leg2);
          const compSemi2 = calcAgg(poSemi2_leg1, poSemi2_leg2);

          if (compSemi1?.aggWinner && compSemi1.aggWinner !== 'TBD') {
              poFinalRounds.forEach((m: any) => fillTeamData(m, 'home', compSemi1.aggWinner));
          }
          if (compSemi2?.aggWinner && compSemi2.aggWinner !== 'TBD') {
              poFinalRounds.forEach((m: any) => fillTeamData(m, 'away', compSemi2.aggWinner));
          }

          const poFinal_leg1 = poFinalRounds.find((m: any) => m.matchLabel?.includes('1차전'));
          const poFinal_leg2 = poFinalRounds.find((m: any) => m.matchLabel?.includes('2차전'));
          const compPoFinal = calcAgg(poFinal_leg1, poFinal_leg2);

          if (compPoFinal?.aggWinner && compPoFinal.aggWinner !== 'TBD') {
              grandFinalRounds.forEach((m: any) => fillTeamData(m, 'away', compPoFinal.aggWinner));
          }
      }
      return clonedRounds;
  }, [currentSeason, masterTeams, owners]);

  useEffect(() => {
      if (!currentSeason?.rounds) return;

      const params = new URLSearchParams(window.location.search);
      const urlMatchId = params.get('matchId');

      let targetMatchId: string | null = null;
      let urlTargetMatch: Match | null = null;

      let isAllFinished = currentSeason.status === 'COMPLETED'; 
      
      if (!isAllFinished) {
          let totalMatches = 0;
          let finishedMatches = 0;

          currentSeason.rounds.forEach(r => {
              r.matches.forEach(m => {
                  if (m.home !== 'BYE' && m.away !== 'BYE') {
                      totalMatches++;
                      if (m.status === 'COMPLETED' || (m.homeScore !== '' && m.awayScore !== '')) {
                          finishedMatches++;
                      }
                  }
              });
          });
          if (totalMatches > 0 && totalMatches === finishedMatches) isAllFinished = true;
      }

      if (urlMatchId) {
          targetMatchId = urlMatchId;
          for (const round of currentSeason.rounds) {
              const found = round.matches.find(m => m.id === urlMatchId);
              if (found) { urlTargetMatch = found; break; }
          }
      } else if (!isAllFinished) {
          for (const round of currentSeason.rounds) {
              const upcomingMatch = round.matches.find(m => m.status !== 'COMPLETED' && m.homeScore === '' && m.awayScore === '');
              if (upcomingMatch) {
                  targetMatchId = upcomingMatch.id;
                  break;
              }
          }
      } else {
          targetMatchId = null;
      }

      if (targetMatchId && matchRefs.current[targetMatchId]) {
        const finalId = targetMatchId; 
        setTimeout(() => {
            matchRefs.current[finalId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            if (urlTargetMatch) {
                const homeActive = getActiveOwner(urlTargetMatch.homeOwner, (urlTargetMatch as any).homeOwnerUid, urlTargetMatch.home);
                const awayActive = getActiveOwner(urlTargetMatch.awayOwner, (urlTargetMatch as any).awayOwnerUid, urlTargetMatch.away);

                const translatedHomeOwner = resolveOwnerInfo(owners, homeActive.name || '', homeActive.uid).nickname;
                const translatedAwayOwner = resolveOwnerInfo(owners, awayActive.name || '', awayActive.uid).nickname;
                
                onMatchClick({ ...urlTargetMatch, homeOwner: translatedHomeOwner, awayOwner: translatedAwayOwner });
                
                params.delete('matchId');
                window.history.replaceState(null, '', `?${params.toString()}`);
            }
        }, 300);
    }
  }, [currentSeason, viewMode, owners, masterTeams, onMatchClick]);

  const getKoreanStageName = (stage: string, matchCount: number, seasonType: string = 'LEAGUE') => {
    const s = stage.toUpperCase();
    if (seasonType === 'LEAGUE' || seasonType === 'LEAGUE_PLAYOFF') {
        if (s.includes('ROUND_OF_4')) return '🔥 플레이오프 (4강)';
        if (s.includes('SEMI_FINAL')) return '🔥 플레이오프 (결승)';
        if (s.includes('FINAL')) return '🏆 대망의 최종 결승전';
        if (s.includes('ROUND') && /\d/.test(s)) return s.replace(/ROUND\s/i, '라운드 ').replace(/GAME/i, '경기');
    }
    if (s.includes('34') || s.includes('3RD')) return '🥉 3·4위전';
    if (s === 'FINAL') return '🏆 결승전';
    if (s.includes('SEMI')) return '4강 (준결승)';
    if (matchCount === 16) return '32강';
    if (matchCount === 8) return '16강';
    if (matchCount === 4) return '8강';
    if (matchCount === 2) return '4강 (준결승)';
    if (matchCount === 1) return '🏆 결승전';
    return stage;
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-lg">
             <div className="flex items-center gap-3">
                <span className="text-slate-400 text-sm font-bold whitespace-nowrap hidden md:block">SELECT SEASON:</span>
                <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="w-full bg-slate-950 text-white text-sm font-bold p-3 rounded-xl border border-slate-700 focus:border-emerald-500 outline-none cursor-pointer transition-colors hover:border-slate-500">
                    {seasons.map(s => (
                        <option key={s.id} value={s.id}>
                            {(() => {
                                const pureName = s.name.replace(/^(🏆|🏳️|⚔️|⚽|🗓️|⭐)\s*/, '');
                                let icon = '🏳️'; if (s.type === 'CUP') icon = '🏆'; if (s.type === 'TOURNAMENT') icon = '⚔️'; if (s.type === 'LEAGUE_PLAYOFF') icon = '⭐';
                                return `${icon} ${pureName}`;
                            })()}
                        </option>
                    ))}
                </select>
             </div>
        </div>

        <LiveFeed 
            mode="schedule" 
            seasons={seasons}
            selectedSeasonId={viewSeasonId} 
            owners={owners} 
            onNavigateToMatch={onMatchClick}
        />

        {viewMode === 'CUP' ? (
            <CupSchedule seasons={seasons} viewSeasonId={viewSeasonId} onMatchClick={onMatchClick} masterTeams={masterTeams} activeRankingData={activeRankingData} historyData={historyData} owners={owners} knockoutStages={knockoutStages} />
        ) : viewMode === 'LEAGUE_PLAYOFF' ? (
            <div className="space-y-12">
                {currentSeason && (
                    <div className="overflow-x-auto pb-4 no-scrollbar border-b border-slate-800/50 mb-8">
                        <div className="min-w-max md:min-w-[760px] px-2">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-1.5 h-6 bg-yellow-500 rounded-full shadow-[0_0_10px_#eab308]"></div>
                                <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">PLAYOFF BRACKET</h3>
                            </div>
                            <AdminMatching_LeaguePOBracketView 
                                currentSeason={currentSeason} 
                                owners={owners} 
                                masterTeams={masterTeams} 
                                activeRankingData={activeRankingData}
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-4"><div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"></div><h3 className="text-xl font-black italic text-white uppercase tracking-tighter">MATCH SCHEDULE</h3></div>
                    {displayRounds.map((r: any, rIdx: number) => {
                        const uniqueStages = Array.from(new Set(r.matches.map((m: any) => m.stage)));
                        const totalMatchesInRound = r.matches.length;
                        return (
                            <div key={`hybrid-r-${rIdx}`} className="space-y-6">
                                {uniqueStages.map((stageName: any) => {
                                    const displayStageName = getKoreanStageName(stageName, totalMatchesInRound, 'LEAGUE_PLAYOFF');
                                    return (
                                        <div key={stageName} className="space-y-2">
                                            <h3 className="text-xs font-bold text-slate-500 pl-2 border-l-2 border-emerald-500 uppercase">{displayStageName}</h3>
                                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {r.matches.filter((m: any) => m.stage === stageName).map((m: any, mIdx: number) => {
                                                    
                                                    const homeActive = getActiveOwner(m.homeOwner, (m as any).homeOwnerUid, m.home);
                                                    const awayActive = getActiveOwner(m.awayOwner, (m as any).awayOwnerUid, m.away);

                                                    const translatedHomeOwner = resolveOwnerInfo(owners, homeActive.name || '', homeActive.uid).nickname;
                                                    const translatedAwayOwner = resolveOwnerInfo(owners, awayActive.name || '', awayActive.uid).nickname;

                                                    let customMatchLabel = `${displayStageName} / ${mIdx + 1}경기`;
                                                    if (m.matchLabel && m.matchLabel.includes('PO')) customMatchLabel = m.matchLabel; else if (m.matchLabel && m.matchLabel.includes('결승전')) customMatchLabel = m.matchLabel;
                                                    
                                                    const pureSeasonName = currentSeason?.name?.replace(/^(🏆|🏳️|⚔️|⚽|🗓️|⭐)\s*/, '') || '';
                                                    const safeHomeLogo = (m.home === 'TBD' || m.home === 'BYE' || m.homeLogo?.includes('uefa.com')) ? SAFE_TBD_LOGO : m.homeLogo;
                                                    const safeAwayLogo = (m.away === 'TBD' || m.away === 'BYE' || m.awayLogo?.includes('uefa.com')) ? SAFE_TBD_LOGO : m.awayLogo;
                                                    
                                                    const safeMatch = { 
                                                        ...m, 
                                                        matchLabel: customMatchLabel, 
                                                        homeLogo: safeHomeLogo, 
                                                        awayLogo: safeAwayLogo, 
                                                        homeOwner: translatedHomeOwner, 
                                                        awayOwner: translatedAwayOwner 
                                                    };

                                                    return (
                                                        <div key={m.id} ref={(el) => matchRefs.current[m.id] = el} className="flex flex-col mb-2">
                                                            <div className="relative rounded-xl overflow-hidden bg-[#0f172a] shadow-lg border border-transparent transition-colors hover:border-slate-600 z-10">
                                                                <MatchCard match={safeMatch} onClick={() => onMatchClick(safeMatch)} activeRankingData={activeRankingData} historyData={historyData} masterTeams={masterTeams} />
                                                                <div className="absolute bottom-2 right-3 text-[8px] text-slate-500/80 font-bold italic pointer-events-none z-10">{`시즌 '${pureSeasonName}' / ${getTodayFormatted()}`}</div>
                                                            </div>
                                                            <MatchCommentSnippet matchId={safeMatch.id} onClick={() => onMatchClick(safeMatch)} owners={owners} />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        ) : (
            <>
                {viewMode === 'TOURNAMENT' && (
                    <div className="overflow-x-auto pb-4 no-scrollbar border-b border-slate-800/50 mb-8">
                        <div className="min-w-max md:min-w-[760px] px-2">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"></div>
                                <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">TOURNAMENT BRACKET</h3>
                            </div>
                            {/* 🔥 [핵심 픽스] 스케줄 탭에서도 똑똑한 internalKnockoutStages를 전달! */}
                            <AdminMatching_TournamentBracketView knockoutStages={internalKnockoutStages || knockoutStages} isUserView={true} />
                        </div>
                    </div>
                )}

                {displayRounds?.map((r: any, rIdx: number) => {
                    const uniqueStages = Array.from(new Set(r.matches.map((m: any) => m.stage)));
                    const totalMatchesInRound = r.matches.length;
                    const seasonType = currentSeason?.type || 'LEAGUE';
                    return (
                        <div key={rIdx} className="space-y-6 mb-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"></div>
                                <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">MATCH SCHEDULE</h3>
                            </div>
                            {uniqueStages.map((stageName: any) => {
                                const displayStageName = getKoreanStageName(stageName, totalMatchesInRound, seasonType);
                                return (
                                    <div key={stageName} className="space-y-2">
                                        <h3 className="text-xs font-bold text-slate-500 pl-2 border-l-2 border-emerald-500 uppercase">{displayStageName}</h3>
                                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {r.matches.filter((m: any) => m.stage === stageName).map((m: any, mIdx: number) => {
                                                
                                                const homeActive = getActiveOwner(m.homeOwner, (m as any).homeOwnerUid, m.home);
                                                const awayActive = getActiveOwner(m.awayOwner, (m as any).awayOwnerUid, m.away);

                                                const translatedHomeOwner = resolveOwnerInfo(owners, homeActive.name || '', homeActive.uid).nickname;
                                                const translatedAwayOwner = resolveOwnerInfo(owners, awayActive.name || '', awayActive.uid).nickname;

                                                const customMatchLabel = `${displayStageName} / ${mIdx + 1}경기`;
                                                const pureSeasonName = currentSeason?.name?.replace(/^(🏆|🏳️|⚔️|⚽|🗓️|⭐)\s*/, '') || '';
                                                const safeHomeLogo = (m.home === 'TBD' || m.home === 'BYE' || m.homeLogo?.includes('uefa.com') || m.homeLogo?.includes('club-generic-badge')) ? SAFE_TBD_LOGO : m.homeLogo;
                                                const safeAwayLogo = (m.away === 'TBD' || m.away === 'BYE' || m.awayLogo?.includes('uefa.com') || m.awayLogo?.includes('club-generic-badge')) ? SAFE_TBD_LOGO : m.awayLogo;
                                                
                                                const safeMatch = { 
                                                    ...m, 
                                                    matchLabel: customMatchLabel, 
                                                    homeLogo: safeHomeLogo, 
                                                    awayLogo: safeAwayLogo, 
                                                    homeOwner: translatedHomeOwner, 
                                                    awayOwner: translatedAwayOwner 
                                                };

                                                return (
                                                    <div key={m.id} ref={(el) => matchRefs.current[m.id] = el} className="flex flex-col mb-2">
                                                        <div className="relative rounded-xl overflow-hidden bg-[#0f172a] shadow-lg border border-transparent transition-colors hover:border-slate-600 z-10">
                                                            <MatchCard match={safeMatch} onClick={() => onMatchClick(safeMatch)} activeRankingData={activeRankingData} historyData={historyData} masterTeams={masterTeams} />
                                                            <div className="absolute bottom-2 right-3 text-[8px] text-slate-500/80 font-bold italic pointer-events-none z-10">{`시즌 '${pureSeasonName}' / ${getTodayFormatted()}`}</div>
                                                        </div>
                                                        <MatchCommentSnippet matchId={safeMatch.id} onClick={() => onMatchClick(safeMatch)} owners={owners} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
                {(!displayRounds || displayRounds.length === 0) && (
                    <div className="text-center py-10 text-slate-500">등록된 스케줄이 없습니다.</div>
                )}
            </>
        )}
    </div>
  );
};

export default ScheduleView;