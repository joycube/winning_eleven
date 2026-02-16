/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from 'react';
import { Match, MasterTeam, FALLBACK_IMG } from '../types';
import { getPrediction } from '../utils/predictor'; 
import { getMatchCommentary } from '../utils/commentary'; 

interface MatchCardProps {
  match: Match;
  onClick: (m: Match) => void;
  activeRankingData?: any; 
  historyData?: any;
  masterTeams?: MasterTeam[];
}

export const MatchCard = ({ match, onClick, activeRankingData, historyData, masterTeams = [] }: MatchCardProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  const isBye = match.status === 'BYE' || match.home === 'BYE' || match.away === 'BYE';
  const isTbd = match.home === 'TBD' || match.away === 'TBD';
  const isCompleted = match.status === 'COMPLETED'; 

  let prediction = { hRate: 50, aRate: 50 };
  if (!isBye && !isTbd) {
      const savedHome = Number(match.homePredictRate);
      const savedAway = Number(match.awayPredictRate);
      if (!isNaN(savedHome) && !isNaN(savedAway) && (savedHome > 0 || savedAway > 0)) {
          prediction = { hRate: savedHome, aRate: savedAway };
      } else {
          prediction = getPrediction(match.home, match.away, activeRankingData, historyData, masterTeams);
      }
  }
  const showGraph = !isBye && !isTbd;

  const getTeamMasterInfo = (teamName: string) => {
    if (!masterTeams || masterTeams.length === 0) return undefined;
    const cleanTarget = teamName.replace(/\s+/g, '').toLowerCase();
    return masterTeams.find(t => t.name.replace(/\s+/g, '').toLowerCase() === cleanTarget);
  };

  const homeMaster = getTeamMasterInfo(match.home);
  const awayMaster = getTeamMasterInfo(match.away);

  const getRankBadge = (rank?: number) => {
    if (!rank || rank <= 0) return null;
    const colors = rank === 1 ? 'bg-yellow-500 text-black border-yellow-200' : 
                   rank === 2 ? 'bg-slate-300 text-black border-white' : 
                   rank === 3 ? 'bg-amber-600 text-white border-amber-400' : 
                   'bg-slate-800 text-slate-400 border-slate-600';
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black border shadow-sm ${colors}`}>
        R.{rank}
      </span>
    );
  };

  const getConditionArrow = (condition?: string) => {
    if (!condition) return null;
    const config: any = {
      'A': { icon: '↑', color: 'text-emerald-400', glow: 'shadow-[0_0_8px_rgba(52,211,153,0.5)]' },
      'B': { icon: '↗', color: 'text-teal-400', glow: '' },
      'C': { icon: '→', color: 'text-slate-400', glow: '' },
      'D': { icon: '↘', color: 'text-orange-400', glow: '' },
      'E': { icon: '⬇', color: 'text-red-500', glow: 'shadow-[0_0_8px_rgba(239,68,68,0.5)]' },
    };
    const c = config[condition.toUpperCase()] || config['C'];
    return (
      <div className={`w-6 h-6 flex items-center justify-center bg-slate-900 rounded-full border border-slate-700 ${c.glow}`}>
        <span className={`text-[12px] font-bold ${c.color}`}>{c.icon}</span>
      </div>
    );
  };

  return (
    <div 
      onClick={() => onClick(match)} 
      className={`group relative bg-slate-950 p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl cursor-pointer ${
        isCompleted ? 'border-slate-800' : 'border-slate-700 hover:border-emerald-500/50'
      }`}
    >
        <div className="flex justify-center mb-6">
            <span className="px-4 py-1.5 bg-slate-900 border border-slate-800 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-emerald-400 transition-colors">
                {match.matchLabel || 'Match Fixture'}
            </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-4">
            {/* HOME TEAM */}
            <div className="flex flex-col items-center text-center space-y-3 min-w-0">
                <div className="relative">
                  {/* 🔥 로고 사이즈 업 (w-20) */}
                  <div className="w-20 h-20 rounded-full bg-white p-2.5 shadow-xl ring-4 ring-slate-900 group-hover:ring-emerald-500/20 transition-all overflow-hidden flex items-center justify-center">
                      <img src={match.homeLogo} className="w-full h-full object-contain" alt="" onError={(e)=>e.currentTarget.src=FALLBACK_IMG} />
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex items-center">
                      {getConditionArrow(homeMaster?.condition)}
                  </div>
                </div>
                <div className="space-y-1 w-full px-1">
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      {/* 🔥 팀명 사이즈 업 (text-base) 및 가로폭 최적화 */}
                      <span className="text-base font-black text-white uppercase tracking-tighter truncate max-w-[140px] leading-tight">{match.home}</span>
                      {getRankBadge(homeMaster?.real_rank)}
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 italic truncate">{match.homeOwner}</p>
                </div>
            </div>

            {/* VS / SCORE */}
            <div className="flex flex-col items-center px-2 md:px-4">
                {isCompleted ? (
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-3 text-4xl font-black italic tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                          <span className={Number(match.homeScore) > Number(match.awayScore) ? 'text-emerald-400' : 'text-white'}>{match.homeScore}</span>
                          <span className="text-slate-800">:</span>
                          <span className={Number(match.awayScore) > Number(match.homeScore) ? 'text-emerald-400' : 'text-white'}>{match.awayScore}</span>
                      </div>
                    </div>
                ) : (
                    <div className="relative flex items-center justify-center">
                        <div className="absolute w-12 h-12 bg-emerald-500/10 blur-xl rounded-full"></div>
                        <div className="relative px-5 py-2 bg-slate-900 border border-slate-800 rounded-lg shadow-inner">
                            <span className="text-sm font-black italic text-slate-400">VS</span>
                        </div>
                    </div>
                )}
            </div>

            {/* AWAY TEAM */}
            <div className="flex flex-col items-center text-center space-y-3 min-w-0">
                <div className="relative">
                  {/* 🔥 로고 사이즈 업 (w-20) */}
                  <div className="w-20 h-20 rounded-full bg-white p-2.5 shadow-xl ring-4 ring-slate-900 group-hover:ring-emerald-500/20 transition-all overflow-hidden flex items-center justify-center">
                      <img src={match.awayLogo} className="w-full h-full object-contain" alt="" onError={(e)=>e.currentTarget.src=FALLBACK_IMG} />
                  </div>
                  <div className="absolute -bottom-1 -left-1 flex items-center">
                      {getConditionArrow(awayMaster?.condition)}
                  </div>
                </div>
                <div className="space-y-1 w-full px-1">
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      {getRankBadge(awayMaster?.real_rank)}
                      {/* 🔥 팀명 사이즈 업 (text-base) 및 가로폭 최적화 */}
                      <span className="text-base font-black text-white uppercase tracking-tighter truncate max-w-[140px] leading-tight">{match.away}</span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 italic truncate">{match.awayOwner}</p>
                </div>
            </div>
        </div>

        {isCompleted && (match.homeScorers?.length > 0 || match.awayScorers?.length > 0 || match.youtubeUrl) && (
            <div className="mt-6 pt-5 border-t border-slate-900/50">
                <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
                    <div className="space-y-1 text-right">
                        {match.homeScorers.map((s, idx)=><div key={`h-${idx}`} className="text-[10px] text-slate-400 font-medium">{s.name} ⚽ <span className="text-slate-600 ml-1">{s.count > 1 && `x${s.count}`}</span></div>)}
                    </div>
                    
                    <div className="flex flex-col items-center px-2">
                      {match.youtubeUrl ? (
                          <div 
                              className="bg-red-950/30 border border-red-900/40 p-2 rounded-full cursor-pointer hover:bg-red-900/40 transition-colors group/yt shadow-lg"
                              onClick={(e) => { e.stopPropagation(); window.open(match.youtubeUrl, '_blank'); }}
                              title="Watch Highlight"
                          >
                              <img src="https://img.icons8.com/ios-filled/50/ff0000/youtube-play.png" className="w-4 h-4 group-hover/yt:scale-110 transition-transform" alt="YT"/>
                          </div>
                      ) : <div className="w-[1px] h-4 bg-slate-900"></div>}
                    </div>

                    <div className="space-y-1 text-left">
                        {match.awayScorers.map((s, idx)=><div key={`a-${idx}`} className="text-[10px] text-slate-400 font-medium">⚽ {s.name} <span className="text-slate-600 ml-1">{s.count > 1 && `x${s.count}`}</span></div>)}
                    </div>
                </div>
            </div>
        )}

        {showGraph && (
            <div className="mt-8 space-y-2">
                <div className="flex justify-between items-end px-1">
                  <span className="text-[11px] font-black text-emerald-400">{prediction.hRate}%</span>
                  <span className="text-[9px] font-bold text-slate-600 tracking-tighter uppercase italic">Win Probability</span>
                  <span className="text-[11px] font-black text-blue-400">{prediction.aRate}%</span>
                </div>
                <div className="relative h-4 bg-slate-900 rounded-lg overflow-hidden flex border border-slate-800/50 shadow-inner">
                    <div 
                      style={{ width: isLoaded ? `${prediction.hRate}%` : '0%' }} 
                      className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000 ease-out"
                    />
                    
                    <div 
                      className="absolute top-0 bottom-0 z-20 flex items-center justify-center transition-all duration-1000 ease-out"
                      style={{ 
                        left: isLoaded ? `${prediction.hRate}%` : '50%',
                        transform: 'translateX(-50%)' 
                      }}
                    >
                        <div className="w-0.5 h-full bg-white/40 shadow-[0_0_8px_white] relative flex items-center justify-center">
                            <div className="absolute w-6 h-6 bg-slate-950 border border-slate-700 rounded-full flex items-center justify-center shadow-lg">
                                <span className="text-[10px] text-yellow-400 font-bold animate-pulse">⚡</span>
                            </div>
                        </div>
                    </div>

                    <div 
                      style={{ width: isLoaded ? `${prediction.aRate}%` : '0%' }} 
                      className="h-full bg-gradient-to-l from-blue-600 to-blue-400 transition-all duration-1000 ease-out ml-auto"
                    />
                </div>
            </div>
        )}

        {isCompleted && (
            <div className="mt-5 p-3.5 bg-slate-900/30 rounded-2xl border border-slate-800/50">
                <p className="text-[11px] text-emerald-400/80 italic text-center leading-relaxed font-bold">
                    &quot;{isBye ? "부전승으로 경기가 마무리되었습니다." : getMatchCommentary(match)}&quot;
                </p>
            </div>
        )}

        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
        </div>
    </div>
  );
};