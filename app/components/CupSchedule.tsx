/* eslint-disable @next/next/no-img-element */
import React, { useMemo } from 'react';
import { Season, Match, MasterTeam, FALLBACK_IMG } from '../types';
import { MatchCard } from './MatchCard';

// 🔥 TBD 전용 안전한 다크그레이 방패 로고
const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

const getTodayFormatted = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}.${month}.${day}`;
};

interface CupScheduleProps {
  seasons: Season[];
  viewSeasonId: number;
  onMatchClick: (m: Match) => void;
  masterTeams: MasterTeam[];
  activeRankingData: any;
  historyData: any;
  owners: any[];
  knockoutStages?: any; 
}

export const CupSchedule = ({ 
  seasons, viewSeasonId, onMatchClick, masterTeams, activeRankingData, historyData, knockoutStages 
}: CupScheduleProps) => {

  const currentSeason = seasons.find(s => s.id === viewSeasonId);
  const pureSeasonName = currentSeason?.name?.replace(/^(🏆|🏳️|⚔️|⚽|🗓️)\s*/, '') || 'CUP';

  const normalize = (str: string) => str ? str.toString().trim().toLowerCase() : "";

  const getWinnerName = (match: Match | null): string => {
      if (!match) return 'TBD';
      
      const home = match.home?.trim();
      const away = match.away?.trim();

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

  const getTeamExtendedInfo = (teamName: string) => {
      const tbdTeam = {
          id: 0, name: teamName || 'TBD', logo: SAFE_TBD_LOGO, ownerName: '-',
          region: '', tier: 'C', realRankScore: 0, realFormScore: 0, condition: 'C', real_rank: null
      };
      if (!teamName || teamName === 'TBD' || teamName === 'BYE') return tbdTeam;

      const normTarget = normalize(teamName);
      const stats = activeRankingData?.teams?.find((t:any) => normalize(t.name) === normTarget);
      const master = (masterTeams as any[])?.find((m:any) => normalize(m.name) === normTarget || normalize(m.teamName || '') === normTarget);
      
      return {
          id: stats?.id || master?.id || 0,
          name: teamName,
          logo: stats?.logo || master?.logo || SAFE_TBD_LOGO,
          ownerName: stats?.ownerName || master?.ownerName || 'CPU',
          region: master?.region || '',
          tier: master?.tier || 'C',
          realRankScore: master?.realRankScore,
          realFormScore: master?.realFormScore,
          condition: master?.condition || 'C',
          real_rank: master?.real_rank
      };
  };

  const getRealRankBadge = (rank: number | undefined | null) => {
    if (!rank) return <div className="bg-slate-800 text-slate-500 text-[9px] font-bold px-1.5 py-[1px] rounded-[3px] border border-slate-700/50 leading-none">R.-</div>;
    let bgClass = rank === 1 ? "bg-yellow-500 text-black border-yellow-600" : rank === 2 ? "bg-slate-300 text-black border-slate-400" : rank === 3 ? "bg-orange-400 text-black border-orange-500" : "bg-slate-800 text-slate-400 border-slate-700";
    return <div className={`${bgClass} border text-[9px] font-black px-1.5 py-[1px] rounded-[3px] italic shadow-sm shrink-0 leading-none`}>R.{rank}</div>;
  };

  const getTierBadge = (tier?: string) => {
    const t = (tier || 'C').toUpperCase();
    let colors = t === 'S' ? 'bg-yellow-500 text-black border-yellow-200' : t === 'A' ? 'bg-slate-300 text-black border-white' : t === 'B' ? 'bg-amber-600 text-white border-amber-400' : 'bg-slate-800 text-slate-400 border-slate-700';
    return <div className={`absolute -bottom-1 -right-1 flex items-center justify-center w-3.5 h-3.5 rounded-full border border-slate-950 font-black text-[7px] z-20 shadow-sm ${colors}`}>{t}</div>;
  };

  const getConditionBadge = (condition?: string) => {
    if (!condition) return null;
    const config: any = { 'A': { icon: '↑', color: 'text-emerald-400' }, 'B': { icon: '↗', color: 'text-teal-400' }, 'C': { icon: '→', color: 'text-slate-400' }, 'D': { icon: '↘', color: 'text-orange-400' }, 'E': { icon: '⬇', color: 'text-red-500' } };
    const c = config[condition.toUpperCase()] || config['C'];
    return <div className="px-1 py-[1px] rounded bg-slate-900 border border-slate-800 flex items-center h-3.5 shadow-inner"><span className={`text-[10px] font-black ${c.color}`}>{c.icon}</span></div>;
  };

  const renderLogoWithTier = (logo: string, tier: string, isTbd: boolean = false) => {
      // 🔥 순정 태그 + 순정 이미지 처리
      const displayLogo = isTbd || logo?.includes('uefa.com') ? SAFE_TBD_LOGO : logo;
      
      return (
        <div className="relative w-9 h-9 flex-shrink-0">
            <div className={`w-9 h-9 rounded-full shadow-sm flex items-center justify-center overflow-hidden ${isTbd ? 'bg-slate-700' : 'bg-white'}`}>
                {/* 🔥 캡처 방어막 완전 제거 */}
                <img 
                  src={displayLogo} 
                  className={`${isTbd ? 'w-full h-full' : 'w-[70%] h-[70%]'} object-contain`} 
                  alt="" 
                  onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }}
                />
            </div>
            {!isTbd && getTierBadge(tier)}
        </div>
      );
  };

  const internalKnockoutStages = useMemo(() => {
    if (currentSeason?.type !== 'CUP' || !currentSeason?.rounds) return null;

    const createPlaceholder = (vId: string, stageName: string): Match => ({ 
        id: vId, home: 'TBD', away: 'TBD', homeScore: '', awayScore: '', status: 'UPCOMING',
        seasonId: viewSeasonId, homeLogo: SAFE_TBD_LOGO, awayLogo: SAFE_TBD_LOGO, homeOwner: '-', awayOwner: '-',
        homePredictRate: 0, awayPredictRate: 0, 
        stage: stageName, 
        matchLabel: 'TBD', youtubeUrl: '',
        homeScorers: [], awayScorers: [], homeAssists: [], awayAssists: [],
        commentary: '' 
    } as Match);

    const slots = {
        roundOf8: Array.from({ length: 4 }, (_, i) => createPlaceholder(`v-r8-${i}`, 'ROUND_OF_8')),
        roundOf4: Array.from({ length: 2 }, (_, i) => createPlaceholder(`v-r4-${i}`, 'SEMI_FINAL')),
        final: [createPlaceholder('v-final', 'FINAL')]
    };

    let hasActualRoundOf8 = false;
    currentSeason.rounds.forEach((round) => {
        if (!round.matches) return;
        round.matches.forEach((m) => {
            const stage = m.stage?.toUpperCase() || "";
            if (stage.includes("GROUP")) return;

            const idMatch = m.id.match(/_(\d+)$/);
            const idx = idMatch ? parseInt(idMatch[1], 10) : 0;

            if (stage.includes("FINAL") && !stage.includes("SEMI") && !stage.includes("QUARTER")) {
                slots.final[0] = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };
            } else if (stage.includes("SEMI") || stage.includes("ROUND_OF_4")) {
                if (idx < slots.roundOf4.length) slots.roundOf4[idx] = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };
            } else if (stage.includes("ROUND_OF_8")) {
                if (idx < slots.roundOf8.length) slots.roundOf8[idx] = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };
                hasActualRoundOf8 = true;
            }
        });
    });

    const syncWinner = (target: any, side: 'home' | 'away', source: Match | null) => {
        if (!target || !source) return;
        const winner = getWinnerName(source);
        if (winner !== 'TBD' && winner !== 'BYE' && (target[side] === 'TBD' || !target[side] || target[side] === 'BYE')) {
            target[side] = winner;
            const info = getTeamExtendedInfo(winner);
            target[`${side}Logo`] = info.logo;
            target[`${side}Owner`] = info.ownerName;
            target[`${side}Id`] = info.id; 
        }
    };

    syncWinner(slots.roundOf4[0], 'home', slots.roundOf8[0]);
    syncWinner(slots.roundOf4[0], 'away', slots.roundOf8[1]);
    syncWinner(slots.roundOf4[1], 'home', slots.roundOf8[2]);
    syncWinner(slots.roundOf4[1], 'away', slots.roundOf8[3]);
    syncWinner(slots.final[0], 'home', slots.roundOf4[0]);
    syncWinner(slots.final[0], 'away', slots.roundOf4[1]);

    return {
        ...slots,
        roundOf8: hasActualRoundOf8 ? slots.roundOf8 : null
    };
  }, [currentSeason, viewSeasonId, activeRankingData, masterTeams]);

  const displayStages = knockoutStages || internalKnockoutStages;

  const TournamentTeamRow = ({ teamName, score, isWinner }: { teamName: string, score: number | null, isWinner: boolean }) => {
      const info = getTeamExtendedInfo(teamName);
      const isTbd = teamName === 'TBD';
      const isBye = teamName === 'BYE';

      return (
          <div className={`flex items-center justify-between px-3 py-2.5 h-[50px] ${isWinner ? 'bg-gradient-to-r from-emerald-900/40 to-transparent' : ''} ${isTbd || isBye ? 'opacity-30' : ''}`}>
              <div className="flex items-center gap-3 min-w-0">
                  {renderLogoWithTier(info.logo, info.tier, isTbd || isBye)}
                  <div className="flex flex-col justify-center min-w-0">
                      <span className={`text-[13px] font-black leading-tight truncate uppercase tracking-tight ${isWinner ? 'text-white' : isTbd || isBye ? 'text-slate-500' : 'text-slate-400'}`}>
                          {teamName}
                      </span>
                      {!isTbd && !isBye && (
                          <div className="flex items-center gap-1.5 mt-0.5 scale-[0.9] origin-left">
                              {getRealRankBadge(info.real_rank)}
                              {getConditionBadge(info.condition)}
                              <span className="text-[9px] text-slate-500 font-bold italic truncate ml-0.5">{info.ownerName}</span>
                          </div>
                      )}
                      {isBye && <span className="text-[9px] text-slate-600 font-bold italic">Unassigned Slot</span>}
                  </div>
              </div>
              <div className={`text-xl font-black italic tracking-tighter w-8 text-right ${isWinner ? 'text-emerald-400' : 'text-slate-600'}`}>
                  {isBye ? '0' : (score ?? '-')}
              </div>
          </div>
      );
  };

  const TournamentMatchBox = ({ match, title, highlight = false }: { match: any, title?: string, highlight?: boolean }) => {
      const hScore = match.homeScore !== '' ? Number(match.homeScore) : (match.home === 'BYE' ? 0 : null);
      const aScore = match.awayScore !== '' ? Number(match.awayScore) : (match.away === 'BYE' ? 0 : null);
      
      const winner = getWinnerName(match);
      const isHomeWin = winner !== 'TBD' && winner === match.home;
      const isAwayWin = winner !== 'TBD' && winner === match.away;

      return (
          <div className="flex flex-col w-full"> 
              {title && <div className="text-[9px] font-bold text-slate-500 uppercase mb-1.5 pl-1 tracking-widest opacity-60">{title}</div>}
              <div className={`flex flex-col w-[220px] bg-[#0f141e]/90 backdrop-blur-md border rounded-xl overflow-hidden shadow-xl relative z-10 ${highlight ? 'border-yellow-500/50 shadow-yellow-500/20' : 'border-slate-800/50'}`}>
                  <TournamentTeamRow teamName={match.home} score={hScore} isWinner={isHomeWin} />
                  <div className="h-[1px] bg-slate-800/40 w-full relative"></div>
                  <TournamentTeamRow teamName={match.away} score={aScore} isWinner={isAwayWin} />
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-10">
        <style dangerouslySetInnerHTML={{ __html: `
            .bracket-tree { display: inline-flex; align-items: center; justify-content: flex-start; gap: 40px; padding: 10px 0 20px 4px; min-width: max-content; }
            .bracket-column { display: flex; flex-direction: column; justify-content: center; gap: 20px; position: relative; }
            .no-scrollbar::-webkit-scrollbar { display: none; }
        `}} />

        {displayStages && (
            <div className="overflow-x-auto pb-4 no-scrollbar border-b border-slate-800/50 mb-8">
                <div className="min-w-max md:min-w-[760px] px-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-1 h-5 bg-yellow-500 rounded-full shadow-[0_0_10px_#eab308]"></div>
                        <h3 className="text-lg font-black italic text-white uppercase tracking-tighter">Tournament Bracket</h3>
                    </div>
                    <div className="bracket-tree no-scrollbar">
                        {displayStages.roundOf8 && (
                            <div className="bracket-column">
                                {displayStages.roundOf8.map((m: any, i: number) => <TournamentMatchBox key={`r8-${i}`} title={`Match ${i+1}`} match={m} />)}
                            </div>
                        )}
                        <div className="bracket-column">
                            {displayStages.roundOf4.map((m: any, i: number) => <TournamentMatchBox key={`r4-${i}`} title={`Semi ${i+1}`} match={m} />)}
                        </div>
                        <div className="bracket-column">
                            <div className="relative scale-110 ml-4">
                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-2xl animate-bounce">👑</div>
                                <TournamentMatchBox title="Final" match={displayStages.final[0]} highlight />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div className="space-y-12 max-w-[1500px] mx-auto overflow-hidden px-1">
            {displayStages ? (
                <>
                    {/* 조별리그 */}
                    {currentSeason?.rounds?.map((r, rIdx) => {
                        const groupMatches = r.matches.filter(m => m.stage.toUpperCase().includes('GROUP'));
                        if (groupMatches.length === 0) return null;
                        const uniqueGroups = Array.from(new Set(groupMatches.map(m => m.group))).sort();

                        return uniqueGroups.map(gName => (
                            <div key={`group-${rIdx}-${gName}`} className="space-y-6">
                                <div className="flex items-center gap-2 pl-2 border-l-4 border-emerald-500">
                                    <h3 className="text-lg font-black italic text-white uppercase tracking-tight">GROUP {gName}</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 items-start">
                                    {groupMatches.filter(m => m.group === gName).map((m, mIdx) => {
                                        const safeMatch = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };
                                        return (
                                            <div key={m.id} className="relative flex flex-col gap-1 mb-2">
                                                {/* 🔥 캡처 버튼 제거 완료 */}
                                                <div className="relative rounded-xl overflow-hidden bg-[#0f172a] shadow-lg">
                                                    <MatchCard 
                                                      match={{...safeMatch, matchLabel: `[${m.group}조] ${mIdx + 1}경기` }} 
                                                      onClick={onMatchClick} 
                                                      activeRankingData={activeRankingData} 
                                                      historyData={historyData} 
                                                      masterTeams={masterTeams} 
                                                    />
                                                    {m.commentary && (
                                                        <div className="mx-4 mb-4 p-3 bg-slate-900/50 border border-slate-800 rounded-xl">
                                                            <p className="text-[11px] text-slate-400 leading-relaxed italic">
                                                                <span className="text-emerald-500 font-bold mr-1">ANALYSIS:</span>
                                                                {m.commentary}
                                                            </p>
                                                        </div>
                                                    )}
                                                    <div className="absolute bottom-2 right-3 text-[8px] text-slate-500/80 font-bold italic pointer-events-none z-10">
                                                        {`시즌 '${pureSeasonName}' / ${getTodayFormatted()}`}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ));
                    })}

                    {/* 토너먼트 리스트 */}
                    {[
                        { title: 'Quarter-Finals (8강)', matches: displayStages.roundOf8, id: 'qf' },
                        { title: 'Semi-Finals (4강)', matches: displayStages.roundOf4, id: 'sf' },
                        { title: '🏆 Grand Final (결승전)', matches: displayStages.final, id: 'fn' }
                    ].map((section) => (
                        section.matches && (
                            <div key={section.id} className="space-y-6">
                                <div className="flex items-center gap-2 pl-2 border-l-4 border-emerald-500">
                                    <h3 className="text-lg font-black italic text-white uppercase tracking-tight">{section.title}</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 items-start">
                                    {section.matches.map((m: any, mIdx: number) => {
                                        const safeMatch = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };
                                        return (
                                            <div key={m.id || `${section.id}-${mIdx}`} className="relative flex flex-col gap-1 mb-2">
                                                {/* 🔥 캡처 버튼 제거 완료 */}
                                                <div className="relative rounded-xl overflow-hidden bg-[#0f172a] shadow-lg">
                                                    <MatchCard 
                                                        match={{ ...safeMatch, matchLabel: `${section.title} / ${mIdx + 1}경기` }} 
                                                        onClick={onMatchClick} 
                                                        activeRankingData={activeRankingData} 
                                                        historyData={historyData} 
                                                        masterTeams={masterTeams} 
                                                    />
                                                    {m.commentary && (
                                                        <div className="mx-4 mb-4 p-3 bg-slate-900/50 border border-slate-800 rounded-xl">
                                                            <p className="text-[11px] text-slate-400 leading-relaxed italic">
                                                                <span className="text-emerald-500 font-bold mr-1">COMMENTARY:</span>
                                                                {m.commentary}
                                                            </p>
                                                        </div>
                                                    )}
                                                    <div className="absolute bottom-2 right-3 text-[8px] text-slate-500/80 font-bold italic pointer-events-none z-10">
                                                        {`시즌 '${pureSeasonName}' / ${getTodayFormatted()}`}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    ))}
                </>
            ) : (
                currentSeason?.rounds?.map((r, rIdx) => (
                    <div key={rIdx} className="space-y-8">
                         {Array.from(new Set(r.matches.map(m => m.stage))).map((stageName) => (
                            <div key={stageName} className="space-y-6">
                                <div className="flex items-center gap-2 pl-2 border-l-4 border-emerald-500">
                                    <h3 className="text-lg font-black italic text-white uppercase tracking-tight">{stageName}</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 items-start">
                                    {r.matches.filter(m => m.stage === stageName).map((m, mIdx) => {
                                        const safeMatch = { ...m, homeLogo: m.homeLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.homeLogo, awayLogo: m.awayLogo?.includes('uefa.com') ? SAFE_TBD_LOGO : m.awayLogo };
                                        return (
                                            <div key={m.id} className="relative flex flex-col gap-1 mb-2">
                                                {/* 🔥 캡처 버튼 제거 완료 */}
                                                <div className="relative rounded-xl overflow-hidden bg-[#0f172a] shadow-lg">
                                                    <MatchCard 
                                                        match={{ ...safeMatch, matchLabel: m.group ? `[${m.group}조] ${mIdx + 1}경기` : `${mIdx + 1}경기` }} 
                                                        onClick={onMatchClick} 
                                                        activeRankingData={activeRankingData} 
                                                        historyData={historyData} 
                                                        masterTeams={masterTeams} 
                                                    />
                                                    {m.commentary && (
                                                        <div className="mx-4 mb-4 p-3 bg-slate-900/50 border border-slate-800 rounded-xl">
                                                            <p className="text-[11px] text-slate-400 leading-relaxed italic">
                                                                {m.commentary}
                                                            </p>
                                                        </div>
                                                    )}
                                                    <div className="absolute bottom-2 right-3 text-[8px] text-slate-500/80 font-bold italic pointer-events-none z-10">
                                                        {`시즌 '${pureSeasonName}' / ${getTodayFormatted()}`}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ))
            )}
        </div>
    </div>
  );
};

export default CupSchedule;