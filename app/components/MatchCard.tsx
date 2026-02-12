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

  // 1. 상태 체크
  const isBye = match.status === 'BYE' || match.home === 'BYE' || match.away === 'BYE';
  const isTbd = match.home === 'TBD' || match.away === 'TBD';
  const isCompleted = match.status === 'COMPLETED'; 

  // 2. 승률 예측 로직
  let prediction = { hRate: 0, aRate: 0 };

  if (!isBye && !isTbd) {
      const savedHome = Number(match.homePredictRate);
      const savedAway = Number(match.awayPredictRate);

      if (!isNaN(savedHome) && !isNaN(savedAway) && (savedHome > 0 || savedAway > 0)) {
          prediction = { hRate: savedHome, aRate: savedAway };
      } else {
          prediction = getPrediction(match.home, match.away, activeRankingData, historyData, masterTeams);
      }
  }

  const showGraph = !isBye && !isTbd && (prediction.hRate > 0 || prediction.aRate > 0);

  // 4. 팀 정보 찾기
  const getTeamMasterInfo = (teamName: string) => {
    if (!masterTeams || masterTeams.length === 0) return undefined;
    let found = masterTeams.find(t => t.name === teamName);
    if (!found) {
        const cleanTarget = teamName.replace(/\s+/g, '').toLowerCase();
        found = masterTeams.find(t => t.name.replace(/\s+/g, '').toLowerCase() === cleanTarget);
    }
    return found;
  };

  const homeMaster = getTeamMasterInfo(match.home);
  const awayMaster = getTeamMasterInfo(match.away);

  // 5. 랭킹 뱃지
  const getRankBadge = (rank?: number) => {
    if (!rank || rank <= 0) return null;
    let colorClass = 'bg-slate-800 text-slate-400 border-slate-600';
    if (rank === 1) colorClass = 'bg-yellow-500 text-black border-yellow-300 font-bold';
    else if (rank === 2) colorClass = 'bg-slate-300 text-black border-white font-bold';
    else if (rank === 3) colorClass = 'bg-amber-600 text-white border-amber-400 font-bold';
    return (
      <span className={`ml-1 px-1.5 py-[1px] rounded-[4px] border text-[8px] shadow-sm leading-none ${colorClass}`}>
        R.{rank}
      </span>
    );
  };

  // 6. 컨디션 화살표
  const getConditionArrow = (condition?: string) => {
    if (!condition) return null;
    let arrow = '';
    let colorClass = '';
    switch (condition) {
      case 'A': arrow = '↑'; colorClass = 'text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,1)]'; break; 
      case 'B': arrow = '↗'; colorClass = 'text-teal-400'; break;    
      case 'C': arrow = '→'; colorClass = 'text-slate-400'; break;   
      case 'D': arrow = '↘'; colorClass = 'text-orange-400'; break;  
      case 'E': arrow = '↓'; colorClass = 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,1)]'; break;    
      default: return null;
    }
    return (
      <span className={`w-4 h-4 flex items-center justify-center bg-slate-900 rounded-full border border-slate-700 shadow-sm ml-1`}>
        <span className={`text-[10px] font-black ${colorClass}`}>{arrow}</span>
      </span>
    );
  };

  return (
    <div 
      onClick={() => {
          // 🔥 [수정 1] 무승부 허용을 위한 'LEAGUE' 위장술
          // Admin 모달이 'GROUP'을 토너먼트로 오해해서 무승부를 막는 것 같음.
          // 그래서 클릭할 때만 잠시 stage를 'LEAGUE'로 바꿔서 보내면 무승부가 풀릴 것임.
          const label = (match.matchLabel || '').toUpperCase();
          const isGroupMatch = label.includes('GROUP') || match.stage === 'GROUP';
          
          // 여기서 'LEAGUE'로 보내야 어드민이 "아, 리그구나 무승부 OK" 함
          onClick(isGroupMatch ? { ...match, stage: 'LEAGUE' } : match);
      }} 
      className={`relative bg-slate-950 p-3 rounded-xl border ${isCompleted ? 'border-slate-800' : 'border-slate-700'} hover:border-emerald-500 cursor-pointer shadow-md group`}
    >
        <div className="flex justify-center items-center mb-2">
            <span className="text-[9px] font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded uppercase">{match.matchLabel || 'Match'}</span>
        </div>

        <div className="flex justify-between items-center">
            {/* HOME TEAM */}
            <div className="flex flex-col items-center w-1/3 gap-1">
                {/* 🔥 [수정 2] 흰색 원형 확실하게 만들기 */}
                {/* w-full h-full 대신 w-[85%]를 써서 강제로 여백(흰색 테두리)을 만듦 */}
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-md overflow-hidden relative z-10">
                    <img 
                        src={match.homeLogo} 
                        className="w-[85%] h-[85%] object-contain" 
                        alt="" 
                        onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}
                    />
                </div>
                <div className="flex items-center justify-center h-3 gap-0.5">
                    {getRankBadge(homeMaster?.real_rank)}
                    {getConditionArrow(homeMaster?.condition)}
                </div>
                <span className="text-[10px] font-bold text-white leading-tight truncate w-full text-center">{match.home}</span>
                <span className="text-[9px] text-slate-500">{match.homeOwner}</span>
            </div>

            <div className="flex flex-col items-center justify-center">
                {isCompleted ? (
                    <div className="flex items-center gap-2 text-3xl font-black italic text-white tracking-tighter">
                        <span className={Number(match.homeScore)>Number(match.awayScore)?'text-emerald-400':''}>{match.homeScore}</span>
                        <span className="text-slate-700 text-xl">:</span>
                        <span className={Number(match.awayScore)>Number(match.homeScore)?'text-emerald-400':''}>{match.awayScore}</span>
                    </div>
                ) : (
                    <div className="bg-slate-900 px-3 py-1 rounded text-xs font-bold text-slate-500">
                        {isBye ? 'BYE' : 'VS'}
                    </div>
                )}
            </div>

            {/* AWAY TEAM */}
            <div className="flex flex-col items-center w-1/3 gap-1">
                {/* 🔥 [수정 2] 흰색 원형 확실하게 만들기 */}
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-md overflow-hidden relative z-10">
                    <img 
                        src={match.awayLogo} 
                        className="w-[85%] h-[85%] object-contain" 
                        alt="" 
                        onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}}
                    />
                </div>
                <div className="flex items-center justify-center h-3 gap-0.5">
                    {getRankBadge(awayMaster?.real_rank)}
                    {getConditionArrow(awayMaster?.condition)}
                </div>
                <span className="text-[10px] font-bold text-white leading-tight truncate w-full text-center">{match.away}</span>
                <span className="text-[9px] text-slate-500">{match.awayOwner}</span>
            </div>
        </div>

        {/* 완료된 경기 스탯 */}
        {isCompleted && (
            <div className="border-t border-slate-800 pt-2 mt-2 grid grid-cols-[1fr_auto_1fr] gap-2 text-[9px] items-center">
                <div className="text-right space-y-0.5">
                    {match.homeScorers.map((s, idx)=><div key={`hg-${idx}`} className="text-slate-300">⚽ {s.name} {s.count>1 && `(${s.count})`}</div>)}
                    {match.homeAssists.map((s, idx)=><div key={`ha-${idx}`} className="text-slate-500">🅰️ {s.name} {s.count>1 && `(${s.count})`}</div>)}
                </div>
                <div className="flex justify-center">
                    {match.youtubeUrl ? (
                        <div 
                            className="bg-red-900/20 border border-red-900/50 p-1.5 rounded-full cursor-pointer hover:bg-red-900/40 transition-colors group/yt"
                            onClick={(e) => { e.stopPropagation(); window.open(match.youtubeUrl, '_blank'); }}
                            title="Watch Highlight"
                        >
                            <img src="https://img.icons8.com/ios-filled/50/ff0000/youtube-play.png" className="w-4 h-4 group-hover/yt:scale-110 transition-transform" alt="YT"/>
                        </div>
                    ) : <div className="w-1 h-8 border-l border-slate-800"></div>}
                </div>
                <div className="text-left space-y-0.5">
                    {match.awayScorers.map((s, idx)=><div key={`ag-${idx}`} className="text-slate-300">⚽ {s.name} {s.count>1 && `(${s.count})`}</div>)}
                    {match.awayAssists.map((s, idx)=><div key={`aa-${idx}`} className="text-slate-500">🅰️ {s.name} {s.count>1 && `(${s.count})`}</div>)}
                </div>
            </div>
        )}

        {/* 그래프 노출 */}
        {showGraph && (
            <div className="w-full mt-3 mb-2 px-1">
                <div className="text-center text-[8px] text-slate-500 font-bold mb-1 tracking-widest uppercase">WIN RATE PREDICTION</div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-emerald-400 w-8 text-right">{prediction.hRate}%</span>
                    <div className="relative flex-1 h-4 bg-slate-800 flex items-center justify-center overflow-hidden rounded-md border border-slate-700 shadow-inner">
                        <div style={{ width: isLoaded ? `${prediction.hRate}%` : '0%' }} className="h-full bg-gradient-to-r from-emerald-900 to-emerald-400 transition-all duration-1000 ease-out absolute left-0 top-0 skew-x-[-12deg] origin-bottom-left -ml-2 w-[calc(100%+8px)]" />
                        <div style={{ width: isLoaded ? `${prediction.aRate}%` : '0%' }} className="h-full bg-gradient-to-l from-blue-900 to-blue-400 transition-all duration-1000 ease-out absolute right-0 top-0 skew-x-[-12deg] origin-top-right -mr-2 w-[calc(100%+8px)]" />
                        
                        <div 
                            style={{ left: isLoaded ? `${prediction.hRate}%` : '50%' }}
                            className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center transition-all duration-1000 ease-out"
                        >
                            <div className="w-5 h-5 bg-slate-900 border-2 border-slate-600 rounded-full flex items-center justify-center shadow-lg">
                                <span className="text-[9px] text-yellow-400 font-bold animate-pulse">⚡</span>
                            </div>
                        </div>
                    </div>
                    <span className="text-[10px] font-black text-blue-400 w-8 text-left">{prediction.aRate}%</span>
                </div>
            </div>
        )}

        {/* 부전승일 경우 전용 멘트 노출 */}
        {isCompleted && (
            <div className="bg-slate-900/50 p-2 mt-2 rounded text-center border border-slate-800/50">
                <p className="text-[10px] text-emerald-300 italic">
                    &quot; {isBye ? "부전승 게임입니다." : getMatchCommentary(match)} &quot;
                </p>
            </div>
        )}
    </div>
  );
};