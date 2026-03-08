/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from 'react';
import { Match, MasterTeam, Owner, FALLBACK_IMG } from '../types'; // 🔥 Owner 타입 추가
import { getPrediction } from '../utils/predictor'; 
import { getMatchCommentary } from '../utils/commentary'; 

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

// 🔥 [FM 헬퍼] 카드 렌더링 시 UID를 타고 최신 닉네임을 가져옵니다.
const resolveOwnerNickname = (ownersList: Owner[], ownerName: string, ownerUid?: string) => {
    if (!ownerName || ['-', 'CPU', 'SYSTEM', 'TBD', 'BYE'].includes(ownerName.trim().toUpperCase())) return ownerName;
    if (!ownersList || ownersList.length === 0) return ownerName;
    
    const search = ownerName.trim();
    // 1. UID 우선 매칭
    const foundByUid = ownersList.find(o => (ownerUid && (o.uid === ownerUid || o.docId === ownerUid)) || (o.uid === search || o.docId === search));
    if (foundByUid) return foundByUid.nickname;
    // 2. 닉네임/레거시네임 매칭 (호환성)
    const foundByName = ownersList.find(o => o.nickname === search || o.legacyName === search);
    return foundByName ? foundByName.nickname : ownerName;
};

interface MatchCardProps {
  match: Match;
  onClick: (m: Match) => void;
  activeRankingData?: any; 
  historyData?: any;
  masterTeams?: MasterTeam[];
  owners?: Owner[]; // 🔥 [UID 뼈대] 실시간 조회를 위한 명부 추가
}

export const MatchCard = ({ match, onClick, activeRankingData, historyData, masterTeams = [], owners = [] }: MatchCardProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  const dynamicCommentary = getMatchCommentary(match);
  const displayCommentary = match.commentary || dynamicCommentary;

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
      <span className="px-1 py-[1px] rounded text-[9px] font-black border border-slate-700 bg-slate-800 text-slate-500">R.-</span>
    );
    const colors = rank === 1 ? 'bg-yellow-500 text-black border-yellow-200' : 
                   rank === 2 ? 'bg-slate-300 text-black border-white' : 
                   rank === 3 ? 'bg-orange-400 text-black border-orange-500' : 
                   'bg-slate-800 text-slate-400 border-slate-700';
    return (
      <span className={`px-1 py-[1px] rounded text-[9px] font-black border shadow-sm ${colors}`}>
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
      <div className={`px-1 py-[1px] rounded bg-slate-900 border border-slate-700 flex items-center shadow-sm ${c.glow}`}>
        <span className={`text-[9px] font-bold ${c.color}`}>{c.icon}</span>
      </div>
    );
  };

  const renderTeamContent = (side: 'home' | 'away') => {
    const name = side === 'home' ? match.home : match.away;
    const rawLogo = side === 'home' ? match.homeLogo : match.awayLogo;
    
    // 🔥 [FM 픽스] 실시간 닉네임 조회를 통과한 이름을 표시합니다.
    const rawOwner = side === 'home' ? match.homeOwner : match.awayOwner;
    const rawOwnerUid = side === 'home' ? match.homeOwnerUid : match.awayOwnerUid;
    const owner = resolveOwnerNickname(owners, rawOwner, rawOwnerUid);
    
    const master = side === 'home' ? homeMaster : awayMaster;

    const isTbdOrBye = name === 'TBD' || name === 'BYE' || rawLogo?.includes('uefa.com');
    const displayLogo = isTbdOrBye ? SAFE_TBD_LOGO : (rawLogo || FALLBACK_IMG);

    return (
      <div className="flex flex-col items-center text-center space-y-2.5 w-full min-w-0">
        <div className="relative">
          <div className="w-14 h-14 rounded-full bg-white p-2 shadow-xl ring-2 ring-slate-900 group-hover:ring-emerald-500/20 transition-all flex items-center justify-center overflow-hidden">
            <img src={displayLogo} className="w-full h-full object-contain" alt={name} onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} />
          </div>
          {!(name === 'TBD' || name === 'BYE') && getTierBadge(master?.tier)}
        </div>

        <div className="flex flex-col items-center space-y-1.5 w-full min-w-0">
          <div className="text-xs font-black text-white uppercase tracking-tighter w-full max-w-[120px] line-clamp-1 break-all drop-shadow-md px-1">
            {name}
          </div>
          
          {!(name === 'TBD' || name === 'BYE') && (
            <div className="flex items-center gap-1">
              {getRankBadge(master?.real_rank)}
              {getConditionBadge(master?.condition)}
            </div>
          )}
          
          <div className="text-[10px] font-bold text-slate-500 italic tracking-wide w-full max-w-[120px] line-clamp-1 break-all px-1 mt-0.5">
            {owner || '-'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div onClick={() => onClick(match)} className={`group relative bg-slate-950 p-4 rounded-2xl border transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl cursor-pointer ${isCompleted ? 'border-slate-800' : 'border-slate-700 hover:border-emerald-500/50'}`}>
        <div className="flex justify-center mb-4">
            <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-emerald-400 transition-colors shadow-inner">
                {match.matchLabel || 'Match Fixture'}
            </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
            {renderTeamContent('home')}

            <div className="flex flex-col items-center px-1">
                {isCompleted ? (
                    <div className="flex items-center gap-2 text-3xl font-black italic tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                        <span className={Number(match.homeScore) > Number(match.awayScore) ? 'text-emerald-400' : 'text-white'}>{match.homeScore}</span>
                        <span className="text-slate-800">:</span>
                        <span className={Number(match.awayScore) > Number(match.homeScore) ? 'text-emerald-400' : 'text-white'}>{match.awayScore}</span>
                    </div>
                ) : (
                    <div className="relative flex items-center justify-center">
                        <div className="absolute w-8 h-8 bg-emerald-500/10 blur-xl rounded-full"></div>
                        <div className="relative px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg shadow-inner">
                            <span className="text-xs font-black italic text-slate-400">VS</span>
                        </div>
                    </div>
                )}
            </div>

            {renderTeamContent('away')}
        </div>

        {isCompleted && (match.homeScorers?.length > 0 || match.awayScorers?.length > 0 || match.youtubeUrl) && (
            <div className="mt-4 pt-3 border-t border-slate-900/50">
                <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
                    <div className="flex flex-col text-right w-full min-w-0">
                        {(match.homeScorers || []).map((s:any, idx:number)=>(
                            <div key={`h-${idx}`} className="text-[10px] text-slate-400 font-medium line-clamp-1 break-all w-full">
                                {s.name} ⚽ <span className="text-slate-600 ml-0.5">{s.count > 1 && `x${s.count}`}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col items-center px-1 pt-0.5">
                      {match.youtubeUrl ? (
                          <div className="bg-red-950/30 border border-red-900/40 p-1.5 rounded-full cursor-pointer hover:bg-red-900/40 transition-colors group/yt shadow-lg" onClick={(e) => { e.stopPropagation(); window.open(match.youtubeUrl, '_blank'); }} title="Watch Highlight">
                              <img src="https://img.icons8.com/ios-filled/50/ff0000/youtube-play.png" className="w-3 h-3 group-hover/yt:scale-110 transition-transform" alt="YT" />
                          </div>
                      ) : <div className="w-[1px] h-3 bg-slate-900"></div>}
                    </div>
                    <div className="flex flex-col text-left w-full min-w-0">
                        {(match.awayScorers || []).map((s:any, idx:number)=>(
                            <div key={`a-${idx}`} className="text-[10px] text-slate-400 font-medium line-clamp-1 break-all w-full">
                                ⚽ {s.name} <span className="text-slate-600 ml-0.5">{s.count > 1 && `x${s.count}`}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {showGraph && (
            <div className="mt-5 space-y-1.5">
                <div className="flex justify-between items-end px-1">
                  <span className="text-[9px] font-black text-emerald-400">{prediction.hRate}%</span>
                  <span className="text-[8px] font-bold text-slate-600 tracking-tighter uppercase italic">예상승률(%)</span>
                  <span className="text-[9px] font-black text-blue-400">{prediction.aRate}%</span>
                </div>
                <div className="relative h-4 bg-slate-900 rounded-lg overflow-hidden flex border border-slate-800/50">
                    <div style={{ width: isLoaded ? `${prediction.hRate}%` : '0%' }} className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000 ease-out" />
                    <div className="absolute top-0 bottom-0 z-20 flex items-center justify-center transition-all duration-1000 ease-out" style={{ left: isLoaded ? `${prediction.hRate}%` : '50%', transform: 'translateX(-50%)' }} >
                        <div className="w-0.5 h-full bg-white/40 shadow-[0_0_8px_white] relative flex items-center justify-center">
                            <div className="absolute w-4 h-4 bg-slate-950 border border-slate-700 rounded-full flex items-center justify-center shadow-lg">
                                <span className="text-[8px] text-yellow-400 font-bold animate-pulse">⚡</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ width: isLoaded ? `${prediction.aRate}%` : '0%' }} className="h-full bg-gradient-to-l from-blue-600 to-blue-400 transition-all duration-1000 ease-out ml-auto" />
                </div>
            </div>
        )}

        {displayCommentary && (
            <div className="mt-5 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl shadow-inner">
                <div className="flex flex-col items-center text-center">
                    <span className="text-emerald-500 font-black text-[10px] uppercase tracking-[0.2em] not-italic mb-1.5 opacity-80">
                        경기결과
                    </span>
                    <p className="text-[13px] text-emerald-400 leading-relaxed italic font-bold">
                        &quot;{displayCommentary}&quot;
                    </p>
                </div>
            </div>
        )}
    </div>
  );
};