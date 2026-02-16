/* eslint-disable @next/next/no-img-element */
import React, { useMemo } from 'react';
import { Season, Match, MasterTeam, FALLBACK_IMG } from '../types';
import { MatchCard } from './MatchCard';

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

  // 🔥 승자 이름 추출 헬퍼 (status와 score 기반)
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
          id: 0, name: teamName || 'TBD', logo: FALLBACK_IMG, ownerName: '-',
          region: '', tier: '', realRankScore: 0, realFormScore: 0, condition: '', real_rank: null
      };
      if (!teamName || teamName === 'TBD') return tbdTeam;

      const stats = activeRankingData?.teams?.find((t:any) => normalize(t.name) === normalize(teamName));
      const master = (masterTeams as any[])?.find((m:any) => normalize(m.name) === normalize(teamName) || normalize(m.teamName) === normalize(teamName));
      
      if (!stats && !master) return { ...tbdTeam, name: teamName };

      return {
          id: stats?.id || master?.id || 0,
          name: teamName,
          logo: stats?.logo || master?.logo || FALLBACK_IMG,
          ownerName: stats?.ownerName || master?.ownerName || 'CPU',
          region: master?.region || '',
          tier: master?.tier || '',
          realRankScore: master?.realRankScore,
          realFormScore: master?.realFormScore,
          condition: master?.condition,
          real_rank: master?.real_rank
      };
  };

  const getRealRankBadge = (rank: number | undefined | null) => {
    if (!rank) return <div className="bg-slate-800 text-slate-500 text-[9px] font-bold px-1.5 py-[1px] rounded-[3px] border border-slate-700/50 leading-none">-</div>;
    let bgClass = "bg-slate-800 text-slate-400 border-slate-700"; 
    if (rank === 1) bgClass = "bg-yellow-500 text-black border-yellow-600";
    else if (rank === 2) bgClass = "bg-slate-300 text-black border-slate-400";
    else if (rank === 3) bgClass = "bg-orange-400 text-black border-orange-500";
    return (
        <div className={`${bgClass} border text-[9px] font-black px-1.5 py-[1px] rounded-[3px] italic shadow-sm shrink-0 leading-none`}>R.{rank}</div>
    );
  };

  const renderLogoWithForm = (logo: string, condition: string, isTbd: boolean = false) => {
    const c = (condition || '').toUpperCase();
    const circleBase = "absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[#0f172a] border border-slate-600 flex items-center justify-center shadow-md z-10";
    let formIcon = null;
    if (!isTbd) {
        switch (c) {
            case 'A': formIcon = <div className={`${circleBase} border-emerald-500/50`}><span className="text-[7px] font-black leading-none text-emerald-400">↑</span></div>; break;
            case 'B': formIcon = <div className={`${circleBase} border-lime-500/50`}><span className="text-[7px] font-black leading-none text-lime-400">↗</span></div>; break;
            case 'C': formIcon = <div className={`${circleBase} border-yellow-500/50`}><span className="text-[7px] font-black leading-none text-yellow-400">→</span></div>; break;
            case 'D': formIcon = <div className={`${circleBase} border-orange-500/50`}><span className="text-[7px] font-black leading-none text-orange-400">↘</span></div>; break;
            case 'E': formIcon = <div className={`${circleBase} border-red-500/50`}><span className="text-[7px] font-black leading-none text-red-500">↓</span></div>; break;
            default: formIcon = null;
        }
    }
    return (
        <div className="relative w-7 h-7 flex-shrink-0">
            <div className={`w-7 h-7 rounded-full p-[1.5px] shadow-sm flex items-center justify-center overflow-hidden ${isTbd ? 'bg-slate-700' : 'bg-white'}`}>
                <img src={logo} className="w-full h-full object-contain" alt="" onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}/>
            </div>
            {formIcon}
        </div>
    );
  };

  // 🔥 [핵심 업데이트] 승자 진출 및 슬롯 강제 매핑 로직
  const knockoutStages = useMemo(() => {
    if (currentSeason?.type !== 'CUP' || !currentSeason?.rounds) return null;
    
    // 그룹 스테이지 제외
    const allMatches: Match[] = currentSeason.rounds.flatMap((r: any) => r.matches || [])
            .filter((m: any) => m && m.stage && !m.stage.toUpperCase().includes('GROUP'));

    const slots = {
        roundOf8: Array(4).fill(null),
        roundOf4: Array(2).fill(null),
        final: Array(1).fill(null)
    };

    // 1차: DB 데이터 배치 (참조 오염 방지를 위해 클론 생성)
    allMatches.forEach((m: any) => {
        const label = m.matchLabel || '';
        const stage = m.stage || '';
        const matchNumMatch = label.match(/(\d+)경기/) || label.match(/Match (\d+)/);
        const matchNum = matchNumMatch ? parseInt(matchNumMatch[1]) : 0; 

        const mClone = { ...m };

        if (stage === 'ROUND_OF_8' || label.includes('8강') || label.includes('토너먼트')) {
            if (matchNum >= 1 && matchNum <= 4) slots.roundOf8[matchNum - 1] = mClone;
        } else if (stage === 'ROUND_OF_4' || label.includes('4강') || label.toUpperCase().includes('SEMI')) {
            if (matchNum >= 1 && matchNum <= 2) slots.roundOf4[matchNum - 1] = mClone;
        } else if (stage === 'FINAL' || label.includes('결승')) {
            slots.final[0] = mClone;
        }
    });

    // 2차 🔥 [승자 진출 로직] TBD 자리를 실시간 스코어 기반 승자로 덮어쓰기
    // 8강 승자 -> 4강 진입
    if (slots.roundOf4[0]) {
        if (slots.roundOf4[0].home === 'TBD') slots.roundOf4[0].home = getWinnerName(slots.roundOf8[0]);
        if (slots.roundOf4[0].away === 'TBD') slots.roundOf4[0].away = getWinnerName(slots.roundOf8[1]);
    }
    if (slots.roundOf4[1]) {
        if (slots.roundOf4[1].home === 'TBD') slots.roundOf4[1].home = getWinnerName(slots.roundOf8[2]);
        if (slots.roundOf4[1].away === 'TBD') slots.roundOf4[1].away = getWinnerName(slots.roundOf8[3]);
    }
    // 4강 승자 -> 결승 진입
    if (slots.final[0]) {
        if (slots.final[0].home === 'TBD') slots.final[0].home = getWinnerName(slots.roundOf4[0]);
        if (slots.final[0].away === 'TBD') slots.final[0].away = getWinnerName(slots.roundOf4[1]);
    }

    return slots;
  }, [currentSeason, activeRankingData]);

  const TournamentTeamRow = ({ team, score, isWinner }: { team: any, score: number | null, isWinner: boolean }) => (
      <div className={`flex items-center justify-between px-3 py-2.5 h-[44px] ${isWinner ? 'bg-gradient-to-r from-emerald-900/40 to-transparent' : ''} ${team.name === 'TBD' ? 'opacity-30' : ''}`}>
          <div className="flex items-center gap-3 min-w-0">
              {renderLogoWithForm(team.logo, team.condition, team.name === 'TBD')}
              <div className="flex flex-col justify-center">
                  <span className={`text-[12px] font-bold leading-none truncate uppercase tracking-tight ${isWinner ? 'text-white' : team.name === 'TBD' ? 'text-slate-500' : 'text-slate-400'}`}>
                      {team.name}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                      {team.name !== 'TBD' && getRealRankBadge(team.real_rank)}
                      <span className="text-[10px] text-slate-500 font-bold truncate">{team.ownerName}</span>
                  </div>
              </div>
          </div>
          <div className={`text-xl font-black italic tracking-tighter w-8 text-right ${isWinner ? 'text-emerald-400 drop-shadow-md' : 'text-slate-600'}`}>
              {score ?? '-'}
          </div>
      </div>
  );

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
              {title && <div className="text-[9px] font-bold text-slate-500 uppercase mb-1 pl-1 tracking-widest opacity-60">{title}</div>}
              <div className={`flex flex-col w-[210px] bg-[#0f141e]/90 backdrop-blur-md border rounded-xl overflow-hidden shadow-xl relative z-10 ${highlight ? 'border-yellow-500/50 shadow-yellow-500/20' : 'border-slate-800/50'}`}>
                  <TournamentTeamRow team={home} score={homeScore} isWinner={isHomeWin} />
                  <div className="h-[1px] bg-slate-800/40 w-full"></div>
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

        {/* 🏆 토너먼트 대진표 섹션 */}
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
                                    {/* 🔥 [Fix] 레이아웃 최적화: 3개 이상일 때 찌그러짐 방지 그리드 */}
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