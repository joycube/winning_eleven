"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo } from 'react';
import { Match, MasterTeam, Owner, FALLBACK_IMG } from '../types';
import { getPrediction, deriveThreeWayFromLegacy } from '../utils/predictor';

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

const resolveOwnerNickname = (ownersList: Owner[], ownerName: string, ownerUid?: string) => {
    if (!ownerName || ['-', 'CPU', 'SYSTEM', 'TBD', 'BYE'].includes(ownerName.trim().toUpperCase())) return ownerName;
    if (!ownersList || ownersList.length === 0) return ownerName;
    
    const search = ownerName.trim();
    const foundByUid = ownersList.find(o => (ownerUid && (o.uid === ownerUid || o.docId === ownerUid)) || (o.uid === search || o.docId === search));
    
    if (foundByUid) {
        return foundByUid.nickname || (foundByUid as any).mappedOwnerId || (foundByUid as any).displayName || ownerName;
    }
    
    const foundByName = ownersList.find(o => o.nickname === search || o.legacyName === search || (((o as any).legacyNames || []) as any[]).includes(search) || (o as any).mappedOwnerId === search || (o as any).displayName === search);
    return foundByName ? (foundByName.nickname || (foundByName as any).mappedOwnerId || (foundByName as any).displayName || ownerName) : ownerName;
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

  // 🛠️ [v3 알고리즘 + 캐시] 3-way 예측 (hRate / dRate / aRate)
  //   - 신규 매치: drawPredictRate 저장됨 → 그대로 사용
  //   - 레거시 매치: 2-way만 저장 → deriveThreeWayFromLegacy 로 무승부 복원
  //   - 저장 없음: live getPrediction
  //   - useMemo: 동일 match/historyData/masterTeams 면 재계산 안 함 (다득점 카드 60개 환경 부담 ↓)
  const prediction = useMemo<{ hRate: number; dRate: number; aRate: number }>(() => {
      if (isBye || isTbd) return { hRate: 50, dRate: 0, aRate: 50 };
      const savedHome = Number(match.homePredictRate);
      const savedDraw = Number(match.drawPredictRate);
      const savedAway = Number(match.awayPredictRate);
      const hasLegacy = !isNaN(savedHome) && !isNaN(savedAway) && (savedHome > 0 || savedAway > 0);
      if (hasLegacy && !isNaN(savedDraw) && savedDraw > 0) {
          return { hRate: savedHome, dRate: savedDraw, aRate: savedAway };
      }
      if (hasLegacy) {
          return deriveThreeWayFromLegacy(savedHome, savedAway);
      }
      return getPrediction(match.home, match.away, activeRankingData, historyData, masterTeams);
  }, [
      isBye, isTbd,
      match.home, match.away,
      match.homePredictRate, match.drawPredictRate, match.awayPredictRate,
      activeRankingData, historyData, masterTeams,
  ]);
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
      <div className={`absolute -bottom-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-0.5 rounded-full border-2 border-emerald-900 font-black text-[9px] shadow-lg z-20 ${colors}`}>
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

  const renderTeamBox = (side: 'home' | 'away') => {
    const name = side === 'home' ? match.home : match.away;
    const master = side === 'home' ? homeMaster : awayMaster;
    
    // 🚨 [로고 픽스]: 매치 데이터에 박힌 과거 로고보다 최신 masterTeam의 로고를 1순위로 가져옵니다!
    const staticLogo = side === 'home' ? match.homeLogo : match.awayLogo;
    const rawLogo = master?.logo || staticLogo;
    
    const rawOwner = side === 'home' ? match.homeOwner : match.awayOwner;
    const rawOwnerUid = side === 'home' ? match.homeOwnerUid : match.awayOwnerUid;
    const owner = resolveOwnerNickname(owners, rawOwner, rawOwnerUid);
    
    const isTbdOrBye = name === 'TBD' || name === 'BYE' || rawLogo?.includes('uefa.com');
    const displayLogo = isTbdOrBye ? SAFE_TBD_LOGO : (rawLogo || FALLBACK_IMG);

    const score = side === 'home' ? match.homeScore : match.awayScore;
    const oppScore = side === 'home' ? match.awayScore : match.homeScore;
    const isWinner = isCompleted && Number(score) > Number(oppScore);

    return (
      <div className={`relative min-h-[90px] rounded-xl flex flex-col items-center justify-center p-2 transition-all overflow-hidden ${isTbdOrBye ? 'opacity-50' : ''} ${isWinner ? 'bg-black/15' : ''}`}>

          <div className="relative mb-2">
            <div className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center overflow-hidden ${isTbdOrBye ? 'bg-slate-800/50' : 'bg-white p-1.5'}`}>
              <img src={displayLogo} className="w-full h-full object-contain" alt={name} onError={(e) => { e.currentTarget.src = FALLBACK_IMG; }} />
            </div>
            {!isTbdOrBye && getTierBadge(master?.tier)}
          </div>

          <div className="text-center w-full min-w-0 flex flex-col items-center">
             <span className={`text-[11px] font-black uppercase tracking-tighter w-full truncate leading-tight mb-1 ${isWinner ? 'text-yellow-300' : 'text-white'}`}>
                {name}
             </span>
             
             {!isTbdOrBye && (
                 <div className="flex items-center justify-center gap-1.5 scale-[0.9]">
                     {getRankBadge(master?.real_rank)}
                     {getConditionBadge(master?.condition)}
                 </div>
             )}
             
             <span className={`text-[9px] font-bold italic tracking-wide w-full truncate mt-1 ${isWinner ? 'text-yellow-200' : 'text-emerald-100'}`}>
                 {!isTbdOrBye ? (owner || '-') : (name === 'BYE' ? 'Unassigned Slot' : '-')}
             </span>
          </div>
      </div>
    );
  };

  return (
    <div onClick={() => onClick(match)} className="group relative overflow-hidden p-3.5 sm:p-4 rounded-3xl border border-emerald-800/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:border-emerald-400/60 cursor-pointer flex flex-col" style={{ backgroundColor: '#064e3b' }}>

        {/* 투톤 — 큰 반원(형광 에메랄드) */}
        <div aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none" style={{ width: '280%', aspectRatio: '1', top: '40%', backgroundColor: '#0a8f63' }} />

        {/* 내용 (반원 위로) */}
        <div className="relative z-10 flex flex-col flex-1">

        {/* 상단 라운드 라벨 — 하이라이트 배지 */}
        <div className="text-center mb-3">
            <span className="inline-block bg-emerald-200 text-emerald-900 text-[10px] font-black italic tracking-wide uppercase px-3 py-1 rounded-full shadow">
                🏆 {match.matchLabel || 'Match Fixture'}
            </span>
        </div>

        {/* 중앙 2분할 매치 카드 영역 */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 relative items-stretch mb-3">
            
            {/* 🛠️ [C-3 정제] 중앙 스코어/VS — 박스 테두리 제거, 점수만 큼직하게 떠 있는 형태 */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center pointer-events-none">
                {isCompleted ? (
                    <div className="flex items-baseline gap-2 px-3.5 py-1.5 rounded-xl bg-black/55 backdrop-blur-sm ring-1 ring-white/10 shadow-lg">
                        <span className={`text-2xl font-black italic tracking-tighter ${Number(match.homeScore) > Number(match.awayScore) ? 'text-yellow-300' : 'text-white'}`}>{match.homeScore}</span>
                        <span className="text-xs text-emerald-200 font-black">:</span>
                        <span className={`text-2xl font-black italic tracking-tighter ${Number(match.awayScore) > Number(match.homeScore) ? 'text-yellow-300' : 'text-white'}`}>{match.awayScore}</span>
                    </div>
                ) : (
                    <div className="bg-black/45 backdrop-blur-sm px-2 py-1 rounded-md border border-white/20 text-[9px] font-black text-emerald-100 italic shadow-lg">VS</div>
                )}
            </div>

            {renderTeamBox('home')}
            {renderTeamBox('away')}
        </div>

        {/* 🛠️ [C-3 정제] 득점/어시스트 — 영역 박스라인 제거, 한 섹션으로 통합, 어시스트 행 추가 */}
        {isCompleted && (match.homeScorers?.length > 0 || match.awayScorers?.length > 0 || (match as any).homeAssists?.length > 0 || (match as any).awayAssists?.length > 0 || match.youtubeUrl) && (
            <div className="mb-3 pt-3 border-t border-white/20 space-y-1">
                {/* 득점자 행 */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                    <div className="flex flex-col text-right w-full min-w-0 pr-2">
                        {(match.homeScorers || []).map((s:any, idx:number)=>(
                            <div key={`h-${idx}`} className="text-[10px] text-emerald-50 font-medium truncate w-full">
                                {s.name} ⚽ <span className="text-emerald-200/70 ml-0.5">{s.count > 1 && `x${s.count}`}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col items-center px-1 pt-1">
                      {match.youtubeUrl ? (
                          <div className="bg-red-600 p-1.5 rounded-full cursor-pointer hover:bg-red-500 transition-colors shadow-[0_0_10px_rgba(220,38,38,0.4)] pointer-events-auto" onClick={(e) => { e.stopPropagation(); window.open(match.youtubeUrl, '_blank'); }} title="하이라이트 영상 보기">
                              <svg width="10" height="10" viewBox="0 0 12 12" className="fill-white"><polygon points="3,2 3,10 10,6" /></svg>
                          </div>
                      ) : <div className="w-px h-4 bg-white/20 rounded-full"></div>}
                    </div>
                    <div className="flex flex-col text-left w-full min-w-0 pl-2">
                        {(match.awayScorers || []).map((s:any, idx:number)=>(
                            <div key={`a-${idx}`} className="text-[10px] text-emerald-50 font-medium truncate w-full">
                                ⚽ {s.name} <span className="text-emerald-200/70 ml-0.5">{s.count > 1 && `x${s.count}`}</span>
                            </div>
                        ))}
                    </div>
                </div>
                {/* 어시스트 행 — 데이터 있을 때만 노출 */}
                {(((match as any).homeAssists?.length > 0) || ((match as any).awayAssists?.length > 0)) && (
                    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 mt-1">
                        <div className="flex flex-col text-right w-full min-w-0 pr-2">
                            {((match as any).homeAssists || []).map((s:any, idx:number)=>(
                                <div key={`ha-${idx}`} className="text-[9px] text-emerald-100/80 italic truncate w-full">
                                    {s.name} <span className="inline-block bg-red-600 text-white text-[8px] font-black px-1 rounded ml-0.5 not-italic">A</span> {s.count > 1 && <span className="text-emerald-200/70">x{s.count}</span>}
                                </div>
                            ))}
                        </div>
                        <div className="w-2"></div>
                        <div className="flex flex-col text-left w-full min-w-0 pl-2">
                            {((match as any).awayAssists || []).map((s:any, idx:number)=>(
                                <div key={`aa-${idx}`} className="text-[9px] text-emerald-100/80 italic truncate w-full">
                                    <span className="inline-block bg-red-600 text-white text-[8px] font-black px-1 rounded mr-0.5 not-italic">A</span> {s.name} {s.count > 1 && <span className="text-emerald-200/70">x{s.count}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* 🛠️ [C-3 정제] 3분할 예상승률 (승/무/패) */}
        {showGraph && (
            <div className="mt-auto space-y-1.5 pt-3">
                <div className="flex justify-between items-end px-1">
                  <span className="text-[10px] font-black text-amber-300">{prediction.hRate}%</span>
                  <span className="text-[9px] font-bold text-slate-200 tracking-tighter italic">무 {prediction.dRate}%</span>
                  <span className="text-[10px] font-black text-sky-300">{prediction.aRate}%</span>
                </div>
                <div className="relative h-3 bg-black/40 rounded-full overflow-hidden flex shadow-inner">
                    <div style={{ width: isLoaded ? `${prediction.hRate}%` : '0%' }} className="h-full bg-amber-400 transition-all duration-1000 ease-out" />
                    <div style={{ width: isLoaded ? `${prediction.dRate}%` : '0%' }} className="h-full bg-slate-400 transition-all duration-1000 ease-out" />
                    <div style={{ width: isLoaded ? `${prediction.aRate}%` : '0%' }} className="h-full bg-sky-500 transition-all duration-1000 ease-out" />
                </div>
            </div>
        )}
        </div>
    </div>
  );
};