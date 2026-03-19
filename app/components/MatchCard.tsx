"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from 'react';
import { Match, MasterTeam, Owner, FALLBACK_IMG } from '../types'; 
import { getPrediction } from '../utils/predictor'; 

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

const resolveOwnerNickname = (ownersList: Owner[], ownerName: string, ownerUid?: string) => {
    if (!ownerName || ['-', 'CPU', 'SYSTEM', 'TBD', 'BYE'].includes(ownerName.trim().toUpperCase())) return ownerName;
    if (!ownersList || ownersList.length === 0) return ownerName;
    
    const search = ownerName.trim();
    const foundByUid = ownersList.find(o => (ownerUid && (o.uid === ownerUid || o.docId === ownerUid)) || (o.uid === search || o.docId === search));
    if (foundByUid) return foundByUid.nickname;
    const foundByName = ownersList.find(o => o.nickname === search || o.legacyName === search);
    return foundByName ? foundByName.nickname : ownerName;
};

interface MatchCardProps {
  match: Match;
  onClick: (m: Match) => void;
  activeRankingData?: any; 
  historyData?: any;
  masterTeams?: MasterTeam[];
  owners?: Owner[]; 
}

export const MatchCard = ({ match, onClick, activeRankingData, historyData, masterTeams = [], owners = [] }: MatchCardProps) => {
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
    return (masterTeams as any[]).find(t => (t.name || t.teamName || '').replace(/\s+/g, '').toLowerCase() === cleanTarget);
  };

  const homeMaster = getTeamMasterInfo(match.home);
  const awayMaster = getTeamMasterInfo(match.away);

  const getRankBadge = (rank?: number) => {
    if (!rank || rank <= 0) return (
      <span className="px-1.5 py-[1px] rounded text-[9px] font-black border border-slate-700 bg-slate-800 text-slate-500 leading-none">R.-</span>
    );
    const colors = rank === 1 ? 'bg-yellow-500 text-black border-yellow-200' : 
                   rank === 2 ? 'bg-slate-300 text-black border-white' : 
                   rank === 3 ? 'bg-orange-400 text-black border-orange-500' : 
                   'bg-slate-800 text-slate-400 border-slate-700';
    return (
      <span className={`px-1.5 py-[1px] rounded text-[9px] font-black border shadow-sm shrink-0 leading-none italic ${colors}`}>
        R.{rank}
      </span>
    );
  };

  const getTierBadge = (tier?: string) => {
    const t = (tier || 'C').toUpperCase();
    let colors = 'bg-slate-800 text-slate-400 border-slate-600';
    if (t === 'S') colors = 'bg-yellow-500 text-black border-yellow-200 shadow-[0_0_10px_rgba(234,179,8,0.5)]';
    else if (t === 'A') colors = 'bg-slate-300 text-black border-white';
    else if (t === 'B') colors = 'bg-amber-600 text-white border-amber-400';
    
    return (
      <div className={`absolute -bottom-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-0.5 rounded-full border-2 border-slate-950 font-black text-[9px] shadow-lg z-20 ${colors}`}>
        {t}
      </div>
    );
  };

  const getConditionBadge = (condition?: string) => {
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
      <div className={`px-1 py-[1px] rounded bg-slate-900 border border-slate-700 flex items-center shadow-sm h-3.5 ${c.glow}`}>
        <span className={`text-[9px] font-bold ${c.color}`}>{c.icon}</span>
      </div>
    );
  };

  // 🔥 [핵심 픽스] 옛날 3분할 렌더러 버리고 웅장한 2분할 사각 박스 형태로 리뉴얼
  const renderTeamBox = (side: 'home' | 'away') => {
    const name = side === 'home' ? match.home : match.away;
    const rawLogo = side === 'home' ? match.homeLogo : match.awayLogo;
    
    const rawOwner = side === 'home' ? match.homeOwner : match.awayOwner;
    const rawOwnerUid = side === 'home' ? match.homeOwnerUid : match.awayOwnerUid;
    const owner = resolveOwnerNickname(owners, rawOwner, rawOwnerUid);
    
    const master = side === 'home' ? homeMaster : awayMaster;
    const isTbdOrBye = name === 'TBD' || name === 'BYE' || rawLogo?.includes('uefa.com');
    const displayLogo = isTbdOrBye ? SAFE_TBD_LOGO : (rawLogo || FALLBACK_IMG);

    const score = side === 'home' ? match.homeScore : match.awayScore;
    const oppScore = side === 'home' ? match.awayScore : match.homeScore;
    const isWinner = isCompleted && Number(score) > Number(oppScore);

    return (
      <div className={`relative min-h-[110px] rounded-xl border flex flex-col items-center justify-center p-3 transition-all overflow-hidden ${isTbdOrBye ? 'bg-black/40 border-slate-800/50 opacity-60' : 'bg-slate-900/40 border-slate-700/50 group-hover:border-slate-500/50'} ${isWinner ? 'shadow-[inset_0_0_20px_rgba(16,185,129,0.1)] border-emerald-500/30 bg-emerald-900/10' : ''}`}>
          
          <div className="relative mb-3">
            <div className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center overflow-hidden ring-2 ring-slate-900 ${isTbdOrBye ? 'bg-slate-800/50' : 'bg-white'}`}>
              <img src={displayLogo} className={`${isTbdOrBye ? 'w-full h-full' : 'w-[75%] h-[75%]'} object-contain`} alt={name} onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} />
            </div>
            {!isTbdOrBye && getTierBadge(master?.tier)}
          </div>

          <div className="text-center w-full min-w-0 flex flex-col items-center">
             <span className={`text-[11px] font-black uppercase tracking-tighter w-full truncate leading-tight mb-1 ${isWinner ? 'text-emerald-400' : 'text-white'}`}>
                {name}
             </span>
             
             {!isTbdOrBye && (
                 <div className="flex items-center justify-center gap-1.5 scale-[0.9]">
                     {getRankBadge(master?.real_rank)}
                     {getConditionBadge(master?.condition)}
                 </div>
             )}
             
             <span className={`text-[9px] font-bold italic tracking-wide w-full truncate mt-1 ${isWinner ? 'text-emerald-500' : 'text-slate-500'}`}>
                 {!isTbdOrBye ? (owner || '-') : (name === 'BYE' ? 'Unassigned Slot' : '-')}
             </span>
          </div>
      </div>
    );
  };

  return (
    <div onClick={() => onClick(match)} className="group relative bg-[#0B1120] p-4 sm:p-5 rounded-3xl border border-slate-800 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:border-slate-600 cursor-pointer flex flex-col">
        
        {/* 상단 라운드 라벨 */}
        <div className="text-center mb-4 border-b border-slate-800/50 pb-2">
            <span className="text-[10px] text-slate-500 font-black italic tracking-widest uppercase group-hover:text-emerald-400 transition-colors">
                {match.matchLabel || 'Match Fixture'}
            </span>
        </div>

        {/* 중앙 2분할 매치 카드 영역 */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 relative items-stretch mb-4">
            
            {/* 중앙 VS / 스코어 배지 */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center pointer-events-none">
                {isCompleted ? (
                    <div className="bg-[#0B1120] px-3 py-1.5 rounded-lg border border-slate-700 shadow-xl flex items-center gap-2">
                        <span className={`text-sm font-black italic tracking-tighter ${Number(match.homeScore) > Number(match.awayScore) ? 'text-emerald-400' : 'text-white'}`}>{match.homeScore}</span>
                        <span className="text-[10px] text-slate-600 font-black mb-0.5">:</span>
                        <span className={`text-sm font-black italic tracking-tighter ${Number(match.awayScore) > Number(match.homeScore) ? 'text-emerald-400' : 'text-white'}`}>{match.awayScore}</span>
                    </div>
                ) : (
                    <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-slate-700 text-[9px] font-black text-slate-500 italic shadow-lg">VS</div>
                )}
            </div>

            {renderTeamBox('home')}
            {renderTeamBox('away')}
        </div>

        {/* 득점자 정보 표기 영역 */}
        {isCompleted && (match.homeScorers?.length > 0 || match.awayScorers?.length > 0 || match.youtubeUrl) && (
            <div className="mb-4 pt-3 border-t border-slate-800/50">
                <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                    <div className="flex flex-col text-right w-full min-w-0 pr-2">
                        {(match.homeScorers || []).map((s:any, idx:number)=>(
                            <div key={`h-${idx}`} className="text-[10px] text-slate-400 font-medium truncate w-full">
                                {s.name} ⚽ <span className="text-slate-600 ml-0.5">{s.count > 1 && `x${s.count}`}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col items-center px-1 pt-1">
                      {match.youtubeUrl ? (
                          <div className="bg-red-950/30 border border-red-900/40 p-1.5 rounded-full cursor-pointer hover:bg-red-900/40 transition-colors shadow-lg pointer-events-auto" onClick={(e) => { e.stopPropagation(); window.open(match.youtubeUrl, '_blank'); }} title="Watch Highlight">
                              <img src="https://img.icons8.com/ios-filled/50/ff0000/youtube-play.png" className="w-3 h-3 hover:scale-110 transition-transform" alt="YT" />
                          </div>
                      ) : <div className="w-[1px] h-3 bg-slate-800"></div>}
                    </div>
                    <div className="flex flex-col text-left w-full min-w-0 pl-2">
                        {(match.awayScorers || []).map((s:any, idx:number)=>(
                            <div key={`a-${idx}`} className="text-[10px] text-slate-400 font-medium truncate w-full">
                                ⚽ {s.name} <span className="text-slate-600 ml-0.5">{s.count > 1 && `x${s.count}`}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* 하단 예상 승률 그래프 영역 */}
        {showGraph && (
            <div className="mt-auto space-y-1.5 border-t border-slate-800/50 pt-3">
                <div className="flex justify-between items-end px-1">
                  <span className="text-[9px] font-black text-emerald-400">{prediction.hRate}%</span>
                  <span className="text-[8px] font-bold text-slate-600 tracking-tighter uppercase italic">예상승률(%)</span>
                  <span className="text-[9px] font-black text-blue-400">{prediction.aRate}%</span>
                </div>
                <div className="relative h-2 bg-slate-900 rounded-full overflow-hidden flex border border-slate-800/50 shadow-inner">
                    <div style={{ width: isLoaded ? `${prediction.hRate}%` : '0%' }} className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000 ease-out" />
                    <div className="absolute top-0 bottom-0 z-20 flex items-center justify-center transition-all duration-1000 ease-out" style={{ left: isLoaded ? `${prediction.hRate}%` : '50%', transform: 'translateX(-50%)' }} >
                        <div className="w-0.5 h-full bg-white/40 shadow-[0_0_8px_white] relative flex items-center justify-center">
                            <div className="absolute w-3 h-3 bg-slate-950 border border-slate-700 rounded-full flex items-center justify-center shadow-lg">
                                <span className="text-[6px] text-yellow-400 font-bold">⚡</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ width: isLoaded ? `${prediction.aRate}%` : '0%' }} className="h-full bg-gradient-to-l from-blue-600 to-blue-400 transition-all duration-1000 ease-out ml-auto" />
                </div>
            </div>
        )}
    </div>
  );
};