import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore'; 
import { db } from '../firebase'; 
import { MatchCard } from './MatchCard'; 
import { CupSchedule } from './CupSchedule'; 
import { Season, Match, MasterTeam, Owner } from '../types'; 
import { MessageSquare } from 'lucide-react';
import { LiveFeed } from './LiveFeed';

// 🔥 신규 공통 뷰어 컴포넌트 임포트
import { AdminMatching_TournamentBracketView } from './AdminMatching_TournamentBracketView';
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
    if (!ownerName || ['-', 'CPU', 'SYSTEM', 'TBD', 'BYE'].includes(ownerName.trim().toUpperCase())) return { nickname: ownerName, photo: FALLBACK_IMG };
    const search = ownerName.trim();
    const foundByUid = owners.find(o => (ownerUid && (o.uid === ownerUid || o.docId === ownerUid)) || (o.uid === search || o.docId === search));
    if (foundByUid) return { nickname: foundByUid.nickname, photo: foundByUid.photo || FALLBACK_IMG };
    const foundByName = owners.find(o => o.nickname === search || o.legacyName === search);
    return foundByName ? { nickname: foundByName.nickname, photo: foundByName.photo || FALLBACK_IMG } : { nickname: ownerName, photo: FALLBACK_IMG };
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

    const authorInfo = latestComment ? resolveOwnerInfo(owners, latestComment.authorName || latestComment.ownerName, latestComment.authorUid || latestComment.ownerUid) : null;

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

  // 🔥 [핵심 수술 파트] 스케줄 리스트에도 실시간 TBD 뚫어주기 (계산 로직 추가)
  const displayRounds = useMemo(() => {
      if (!currentSeason || !currentSeason.rounds) return [];
      
      const clonedRounds = JSON.parse(JSON.stringify(currentSeason.rounds));

      const getTeamMasterInfo = (teamName: string) => {
          if (!masterTeams || masterTeams.length === 0) return undefined;
          const cleanTarget = teamName.replace(/\s+/g, '').toLowerCase();
          return masterTeams.find((t: any) => (t.name || t.teamName || '').replace(/\s+/g, '').toLowerCase() === cleanTarget);
      };

      const fillTeamData = (match: any, side: 'home' | 'away', teamName: string) => {
          match[side] = teamName;
          const master = getTeamMasterInfo(teamName);
          match[`${side}Logo`] = master?.logo || FALLBACK_IMG;
          const owner = owners?.find((o:any) => o.nickname === master?.ownerName || o.legacyName === master?.ownerName);
          match[`${side}Owner`] = owner?.nickname || master?.ownerName || '-';
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
                const translatedHomeOwner = resolveOwnerInfo(owners, urlTargetMatch.homeOwner, (urlTargetMatch as any).homeOwnerUid).nickname;
                const translatedAwayOwner = resolveOwnerInfo(owners, urlTargetMatch.awayOwner, (urlTargetMatch as any).awayOwnerUid).nickname;
                onMatchClick({ ...urlTargetMatch, homeOwner: translatedHomeOwner, awayOwner: translatedAwayOwner });
                
                params.delete('matchId');
                window.history.replaceState(null, '', `?${params.toString()}`);
            }
        }, 300);
    }
  }, [currentSeason, viewMode, owners, onMatchClick]);

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
                                                    let customMatchLabel = `${displayStageName} / ${mIdx + 1}경기`;
                                                    if (m.matchLabel && m.matchLabel.includes('PO')) customMatchLabel = m.matchLabel; else if (m.matchLabel && m.matchLabel.includes('결승전')) customMatchLabel = m.matchLabel;
                                                    const pureSeasonName = currentSeason?.name?.replace(/^(🏆|🏳️|⚔️|⚽|🗓️|⭐)\s*/, '') || '';
                                                    const safeHomeLogo = (m.home === 'TBD' || m.home === 'BYE' || m.homeLogo?.includes('uefa.com')) ? SAFE_TBD_LOGO : m.homeLogo;
                                                    const safeAwayLogo = (m.away === 'TBD' || m.away === 'BYE' || m.awayLogo?.includes('uefa.com')) ? SAFE_TBD_LOGO : m.awayLogo;
                                                    const translatedHomeOwner = resolveOwnerInfo(owners, m.homeOwner, (m as any).homeOwnerUid).nickname;
                                                    const translatedAwayOwner = resolveOwnerInfo(owners, m.awayOwner, (m as any).awayOwnerUid).nickname;
                                                    const safeMatch = { ...m, matchLabel: customMatchLabel, homeLogo: safeHomeLogo, awayLogo: safeAwayLogo, homeOwner: translatedHomeOwner, awayOwner: translatedAwayOwner };
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
                            <AdminMatching_TournamentBracketView matches={currentSeason?.rounds?.[0]?.matches || []} />
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
                                                const customMatchLabel = `${displayStageName} / ${mIdx + 1}경기`;
                                                const pureSeasonName = currentSeason?.name?.replace(/^(🏆|🏳️|⚔️|⚽|🗓️|⭐)\s*/, '') || '';
                                                const safeHomeLogo = (m.home === 'TBD' || m.home === 'BYE' || m.homeLogo?.includes('uefa.com') || m.homeLogo?.includes('club-generic-badge')) ? SAFE_TBD_LOGO : m.homeLogo;
                                                const safeAwayLogo = (m.away === 'TBD' || m.away === 'BYE' || m.awayLogo?.includes('uefa.com') || m.awayLogo?.includes('club-generic-badge')) ? SAFE_TBD_LOGO : m.awayLogo;
                                                const translatedHomeOwner = resolveOwnerInfo(owners, m.homeOwner, (m as any).homeOwnerUid).nickname;
                                                const translatedAwayOwner = resolveOwnerInfo(owners, m.awayOwner, (m as any).awayOwnerUid).nickname;
                                                const safeMatch = { ...m, matchLabel: customMatchLabel, homeLogo: safeHomeLogo, awayLogo: safeAwayLogo, homeOwner: translatedHomeOwner, awayOwner: translatedAwayOwner };
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