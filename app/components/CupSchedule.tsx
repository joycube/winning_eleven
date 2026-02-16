/* eslint-disable @next/next/no-img-element */
import React, { useMemo } from 'react';
import { Season, Match, MasterTeam, FALLBACK_IMG } from '../types';
import { MatchCard } from './MatchCard';

// 🔥 TBD 전용 플레이스홀더 이미지
const TBD_LOGO = "https://img.uefa.com/imgml/uefacom/club-generic-badge-new.svg";

interface CupScheduleProps {
  seasons: Season[];
  viewSeasonId: number;
  onMatchClick: (m: Match) => void;
  masterTeams: MasterTeam[];
  activeRankingData: any;
  historyData: any;
  owners: any[];
}

export const CupSchedule = ({ 
  seasons, viewSeasonId, onMatchClick, masterTeams, activeRankingData, historyData, owners 
}: CupScheduleProps) => {

  const currentSeason = seasons.find(s => s.id === viewSeasonId);

  // ─────────────────────────────────────────────────────────────
  // 1. 데이터 가공 및 승자 판별 헬퍼
  // ─────────────────────────────────────────────────────────────
  const normalize = (str: string) => str ? str.toString().trim().toLowerCase() : "";

  const getWinnerName = (match: Match | null): string => {
      if (!match || match.status !== 'COMPLETED') return 'TBD';
      const h = Number(match.homeScore);
      const a = Number(match.awayScore);
      if (h > a) return match.home;
      if (a > h) return match.away;
      return 'TBD';
  };

  const getTeamExtendedInfo = (teamName: string) => {
      const tbdTeam = {
          id: 0, name: teamName || 'TBD', logo: TBD_LOGO, ownerName: '-',
          region: '', tier: '', realRankScore: 0, realFormScore: 0, condition: '', real_rank: null
      };
      if (!teamName || teamName === 'TBD') return tbdTeam;

      const stats = activeRankingData?.teams?.find((t:any) => normalize(t.name) === normalize(teamName));
      const master = (masterTeams as any[])?.find((m:any) => normalize(m.name) === normalize(teamName) || normalize(m.teamName) === normalize(teamName));
      
      if (!stats && !master) return { ...tbdTeam, name: teamName };

      return {
          id: stats?.id || master?.id || 0,
          name: teamName,
          logo: stats?.logo || master?.logo || TBD_LOGO,
          ownerName: stats?.ownerName || master?.ownerName || 'CPU',
          region: master?.region || '',
          tier: master?.tier || 'C',
          realRankScore: master?.realRankScore,
          realFormScore: master?.realFormScore,
          condition: master?.condition || 'C',
          real_rank: master?.real_rank
      };
  };

  // 🔥 [리얼순위] 메탈릭 배지 정의
  const getRealRankBadge = (rank: number | undefined | null) => {
    if (!rank) return <div className="bg-slate-800 text-slate-500 text-[9px] font-bold px-1.5 py-[1px] rounded-[3px] border border-slate-700/50 leading-none">R.-</div>;
    let bgClass = "bg-slate-800 text-slate-400 border-slate-700"; 
    if (rank === 1) bgClass = "bg-yellow-500 text-black border-yellow-600";
    else if (rank === 2) bgClass = "bg-slate-300 text-black border-slate-400";
    else if (rank === 3) bgClass = "bg-orange-400 text-black border-orange-500";
    return (
        <div className={`${bgClass} border text-[9px] font-black px-1.5 py-[1px] rounded-[3px] italic shadow-sm shrink-0 leading-none`}>R.{rank}</div>
    );
  };

  // 🔥 [팀 등급] 엠블럼 우측 하단 오버레이 배지
  const getTierBadge = (tier?: string) => {
    const t = (tier || 'C').toUpperCase();
    let colors = 'bg-slate-800 text-slate-400 border-slate-600';
    if (t === 'S') colors = 'bg-yellow-500 text-black border-yellow-200';
    else if (t === 'A') colors = 'bg-slate-300 text-black border-white';
    else if (t === 'B') colors = 'bg-amber-600 text-white border-amber-400';
    return (
      <div className={`absolute -bottom-1 -right-1 flex items-center justify-center w-3.5 h-3.5 rounded-full border border-slate-950 font-black text-[7px] z-20 shadow-sm ${colors}`}>
        {t}
      </div>
    );
  };

  // 🔥 [폼 화살표] 배지 정의
  const getConditionBadge = (condition?: string) => {
    if (!condition) return null;
    const config: any = {
      'A': { icon: '↑', color: 'text-emerald-400' },
      'B': { icon: '↗', color: 'text-teal-400' },
      'C': { icon: '→', color: 'text-slate-400' },
      'D': { icon: '↘', color: 'text-orange-400' },
      'E': { icon: '⬇', color: 'text-red-500' },
    };
    const c = config[condition.toUpperCase()] || config['C'];
    return (
      <div className="px-1 py-[1px] rounded bg-slate-900 border border-slate-800 flex items-center h-3.5 shadow-inner">
        <span className={`text-[10px] font-black ${c.color}`}>{c.icon}</span>
      </div>
    );
  };

  const renderLogoWithTier = (logo: string, tier: string, isTbd: boolean = false) => {
    return (
        <div className="relative w-9 h-9 flex-shrink-0">
            <div className={`w-9 h-9 rounded-full p-[1.5px] shadow-sm flex items-center justify-center overflow-hidden ${isTbd ? 'bg-slate-700' : 'bg-white'}`}>
                <img src={logo || TBD_LOGO} className="w-full h-full object-contain" alt="" onError={(e)=>{e.currentTarget.src=TBD_LOGO}}/>
            </div>
            {!isTbd && getTierBadge(tier)}
        </div>
    );
  };

  // 🔥 [핵심 업데이트] 승자 팀 메타데이터(Logo, Owner) 강제 동기화
  const knockoutStages = useMemo(() => {
    if (currentSeason?.type !== 'CUP' || !currentSeason?.rounds) return null;
    
    const allMatches: Match[] = currentSeason.rounds.flatMap((r: any) => r.matches || [])
            .filter((m: any) => m && m.stage && !m.stage.toUpperCase().includes('GROUP'));

    const slots = {
        roundOf8: Array(4).fill(null),
        roundOf4: Array(2).fill(null),
        final: Array(1).fill(null)
    };

    allMatches.forEach((m: any) => {
        const label = m.matchLabel || '';
        const stage = m.stage || '';
        const matchNumMatch = label.match(/(\d+)경기/) || label.match(/Match (\d+)/);
        const matchNum = matchNumMatch ? parseInt(matchNumMatch[1]) : 0; 

        const matchClone = JSON.parse(JSON.stringify(m));

        if (stage === 'ROUND_OF_8' || label.includes('8강') || label.includes('토너먼트')) {
            if (matchNum >= 1 && matchNum <= 4) slots.roundOf8[matchNum - 1] = matchClone;
        } else if (stage === 'ROUND_OF_4' || label.includes('4강') || label.toUpperCase().includes('SEMI')) {
            if (matchNum >= 1 && matchNum <= 2) slots.roundOf4[matchNum - 1] = matchClone;
        } else if (stage === 'FINAL' || label.includes('결승')) {
            slots.final[0] = matchClone;
        }
    });

    const syncWinnerInfo = (targetMatch: any, side: 'home' | 'away', winnerName: string) => {
        if (!targetMatch) return;
        const info = getTeamExtendedInfo(winnerName);
        targetMatch[side] = info.name;
        targetMatch[`${side}Logo`] = info.logo;
        targetMatch[`${side}Owner`] = info.ownerName;
    };

    if (slots.roundOf4[0]) {
        syncWinnerInfo(slots.roundOf4[0], 'home', getWinnerName(slots.roundOf8[0]));
        syncWinnerInfo(slots.roundOf4[0], 'away', getWinnerName(slots.roundOf8[1]));
    }
    if (slots.roundOf4[1]) {
        syncWinnerInfo(slots.roundOf4[1], 'home', getWinnerName(slots.roundOf8[2]));
        syncWinnerInfo(slots.roundOf4[1], 'away', getWinnerName(slots.roundOf8[3]));
    }
    if (slots.final[0]) {
        syncWinnerInfo(slots.final[0], 'home', getWinnerName(slots.roundOf4[0]));
        syncWinnerInfo(slots.final[0], 'away', getWinnerName(slots.roundOf4[1]));
    }

    return slots;
  }, [currentSeason, activeRankingData]);

  // ─────────────────────────────────────────────────────────────
  // 2. [UI 컴포넌트] Tournament 팀 정보 셀 (Broadcast 스타일)
  // ─────────────────────────────────────────────────────────────
  const TournamentTeamRow = ({ team, score, isWinner }: { team: any, score: number | null, isWinner: boolean }) => {
      const info = getTeamExtendedInfo(team.name);
      const isTbd = team.name === 'TBD';

      return (
          <div className={`flex items-center justify-between px-3 py-2.5 h-[50px] ${isWinner ? 'bg-gradient-to-r from-emerald-900/40 to-transparent' : ''} ${isTbd ? 'opacity-30' : ''}`}>
              <div className="flex items-center gap-3 min-w-0">
                  {/* 1. 엠블럼 + 등급 오버레이 */}
                  {renderLogoWithTier(team.logo, info.tier, isTbd)}
                  
                  {/* 2. 팀 정보 텍스트 영역 */}
                  <div className="flex flex-col justify-center min-w-0">
                      <span className={`text-[13px] font-black leading-tight truncate uppercase tracking-tight ${isWinner ? 'text-white' : isTbd ? 'text-slate-500' : 'text-slate-400'}`}>
                          {team.name}
                      </span>
                      {!isTbd && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                              {getRealRankBadge(info.real_rank)}
                              {getConditionBadge(info.condition)}
                              <span className="text-[9px] text-slate-500 font-bold italic truncate ml-0.5">
                                  {info.ownerName}
                              </span>
                          </div>
                      )}
                  </div>
              </div>
              {/* 3. 스코어 */}
              <div className={`text-xl font-black italic tracking-tighter w-8 text-right ${isWinner ? 'text-emerald-400 drop-shadow-md' : 'text-slate-600'}`}>
                  {score ?? '-'}
              </div>
          </div>
      );
  };

  const TournamentMatchBox = ({ match, title, highlight = false }: { match: any, title?: string, highlight?: boolean }) => {
      const safeMatch = match || { home: 'TBD', away: 'TBD', homeScore: '', awayScore: '' };
      const home = getTeamExtendedInfo(safeMatch.home);
      const away = getTeamExtendedInfo(safeMatch.away);
      const homeScore = safeMatch.homeScore !== '' ? Number(safeMatch.homeScore) : null;
      const awayScore = safeMatch.awayScore !== '' ? Number(safeMatch.awayScore) : null;
      const isHomeWin = homeScore !== null && awayScore !== null && homeScore > awayScore;
      const isAwayWin = homeScore !== null && awayScore !== null && awayScore > homeScore;

      return (
          <div className="flex flex-col w-full cursor-pointer hover:scale-[1.02] transition-all" onClick={() => match && onMatchClick(match)}>
              {title && <div className="text-[9px] font-bold text-slate-500 uppercase mb-1.5 pl-1 tracking-widest opacity-60">{title}</div>}
              <div className={`flex flex-col w-[220px] bg-[#0f141e]/90 backdrop-blur-md border rounded-xl overflow-hidden shadow-xl relative z-10 ${highlight ? 'border-yellow-500/50 shadow-yellow-500/20' : 'border-slate-800/50'}`}>
                  <TournamentTeamRow team={home} score={homeScore} isWinner={isHomeWin} />
                  <div className="h-[1px] bg-slate-800/40 w-full relative"></div>
                  <TournamentTeamRow team={away} score={awayScore} isWinner={isAwayWin} />
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-10">
        <style jsx>{`
            .bracket-tree { display: flex; align-items: center; justify-content: flex-start; gap: 40px; padding: 10px 0 20px 4px; overflow-x: auto; }
            .bracket-column { display: flex; flex-direction: column; justify-content: center; gap: 20px; position: relative; }
            .no-scrollbar::-webkit-scrollbar { display: none; }
        `}</style>

        {/* 🏆 토너먼트 대진표 섹션 (Broadcast Style 적용) */}
        {knockoutStages && (
            <div className="overflow-x-auto pb-4 no-scrollbar border-b border-slate-800/50 mb-8">
                <div className="min-w-[760px] px-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-1 h-5 bg-yellow-500 rounded-full shadow-[0_0_10px_#eab308]"></div>
                        <h3 className="text-lg font-black italic text-white uppercase tracking-tighter">Tournament Bracket</h3>
                    </div>
                    <div className="bracket-tree no-scrollbar">
                        {knockoutStages.roundOf8.some(m => m !== null) && (
                            <div className="bracket-column">
                                {knockoutStages.roundOf8.map((m: any, i: number) => <TournamentMatchBox key={i} title={`Match ${i+1}`} match={m} />)}
                            </div>
                        )}
                        <div className="bracket-column">
                            {knockoutStages.roundOf4.map((m: any, i: number) => <TournamentMatchBox key={i} title={`Semi ${i+1}`} match={m} />)}
                        </div>
                        <div className="bracket-column">
                            <div className="relative scale-110 ml-4">
                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-2xl animate-bounce">👑</div>
                                <TournamentMatchBox title="Final" match={knockoutStages.final[0]} highlight />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* 🗓️ 매치 리스트 섹션 (레이아웃 최적화) */}
        <div className="space-y-8 max-w-[1500px] mx-auto overflow-hidden px-1">
            {currentSeason?.rounds?.map((r, rIdx) => {
                const uniqueStages = Array.from(new Set(r.matches.map(m => m.stage)));
                return (
                    <div key={rIdx} className="space-y-8">
                         {uniqueStages.map((stageName) => {
                            let displayTitle = stageName.includes('GROUP') ? 'Group Stage' : stageName;
                            if (stageName === 'ROUND_OF_8') displayTitle = 'Quarter-Finals (8강)';
                            else if (stageName === 'ROUND_OF_4') displayTitle = 'Semi-Finals (4강)';
                            else if (stageName === 'FINAL') displayTitle = '🏆 Grand Final (결승전)';

                            return (
                                <div key={stageName} className="space-y-6">
                                    <div className="flex items-center gap-2 pl-2 border-l-4 border-emerald-500">
                                        <h3 className="text-lg font-black italic text-white uppercase tracking-tight">{displayTitle}</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 items-start">
                                        {r.matches.filter(m => m.stage === stageName).map((m, mIdx) => {
                                            let detailLabel = m.group ? `[${m.group}조] ${mIdx + 1}경기` : `${mIdx + 1}경기`;
                                            return (
                                                <div key={m.id} className="w-full min-w-0">
                                                    <MatchCard 
                                                        match={{ ...m, matchLabel: `${displayTitle} / ${detailLabel}` }} 
                                                        onClick={onMatchClick}
                                                        activeRankingData={activeRankingData}
                                                        historyData={historyData}
                                                        masterTeams={masterTeams} 
                                                    />
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
  );
};

export default CupSchedule;