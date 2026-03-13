"use client";

/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { FALLBACK_IMG, Owner } from '../types';

interface ROwnersTabProps {
  currentSeason: any;
  activeRankingData: any;
  owners: Owner[];
  sortedTeams: any[];
  grandChampionInfo: any;
  prizeRule: any;
  footerText: string;
}

export default function R_OwnersTab({
  currentSeason,
  activeRankingData,
  owners,
  sortedTeams,
  grandChampionInfo,
  prizeRule,
  footerText
}: ROwnersTabProps) {

  const resolveOwnerNickname = (ownerName: any, ownerUid?: string) => {
    try {
        if (!ownerName) return '-';
        const strName = String(ownerName).trim();
        if (['-', 'CPU', 'SYSTEM', 'TBD', 'BYE', 'GUEST'].includes(strName.toUpperCase())) return strName;
        
        const foundByUid = owners.find(o => (ownerUid && (o.uid === ownerUid || o.docId === ownerUid)) || (o.uid === strName || o.docId === strName));
        if (foundByUid) return foundByUid.nickname;
        
        const foundByName = owners.find(o => o.nickname === strName || o.legacyName === strName);
        return foundByName ? foundByName.nickname : strName;
    } catch (e) {
        return String(ownerName || '-');
    }
  };

  const getOwnerPrize = (ownerName: string) => {
    let totalPrize = 0;
    const resolvedInput = resolveOwnerNickname(ownerName);
    
    const checkMatch = (idx: number) => {
        const teamOwner = sortedTeams[idx]?.ownerName;
        return teamOwner && resolveOwnerNickname(teamOwner) === resolvedInput;
    };
    
    if (checkMatch(0)) totalPrize += (prizeRule.first || 0);
    if (checkMatch(1)) totalPrize += (prizeRule.second || 0);
    if (checkMatch(2)) totalPrize += (prizeRule.third || 0);
    
    if (grandChampionInfo && resolveOwnerNickname(grandChampionInfo.ownerName) === resolvedInput) {
        totalPrize += (prizeRule.champion || 0);
    }
    
    return totalPrize;
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* 🏆 그랜드 파이널 챔피언 (CUP / PLAYOFF 전용) */}
      {(currentSeason?.type === 'CUP' || currentSeason?.type === 'LEAGUE_PLAYOFF') && grandChampionInfo && (() => {
          const resolvedNick = resolveOwnerNickname(grandChampionInfo.ownerName, grandChampionInfo.ownerUid);
          const champOwnerInfo = owners.find(o => o.nickname === resolvedNick);
          const displayPhoto = champOwnerInfo?.photo || FALLBACK_IMG;
          const team = sortedTeams.find((t: any) => t.name === grandChampionInfo.name) || grandChampionInfo;
          const teamPlayers = (activeRankingData?.players || []).filter((p: any) => p.team === team.name && p.goals > 0);
          const topScorer = teamPlayers.length > 0 ? teamPlayers.sort((a: any, b: any) => b.goals - a.goals)[0] : null;

          return (
            <div className="mb-8">
                <div className="relative w-full rounded-xl overflow-hidden border-2 border-yellow-400/50 champion-glow transform transition-all duration-500 group bg-[#020617]">
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/40 via-yellow-900/60 to-black z-0"></div>
                    <div className="absolute top-1/2 right-10 -translate-y-1/2 opacity-20 group-hover:opacity-40 transition-opacity duration-700 pointer-events-none">
                        <div className="w-[160px] h-[160px] filter drop-shadow-[0_0_30px_rgba(234,179,8,0.8)]" style={{ backgroundImage: `url(${team.logo})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}></div>
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center p-8 gap-8 backdrop-blur-sm pb-12">
                        <div className="relative pt-3 shrink-0">
                            <div className="absolute -top-10 -left-6 text-7xl filter drop-shadow-2xl z-20 crown-bounce origin-bottom-left" style={{ transform: 'rotate(-15deg)' }}>👑</div>
                            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full p-[4px] bg-gradient-to-tr from-yellow-200 via-yellow-500 to-yellow-100 shadow-[0_0_30px_rgba(234,179,8,0.6)] relative z-10">
                                <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-950 bg-slate-900">
                                    <img src={displayPhoto} className="w-full h-full object-cover" alt="owner" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} />
                                </div>
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-14 h-14 bg-white rounded-full p-2 shadow-2xl border-2 border-yellow-400 z-30 overflow-hidden flex items-center justify-center">
                                <img src={team.logo || FALLBACK_IMG} className="w-[70%] h-[70%] object-contain" alt="" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} />
                            </div>
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <div className="inline-flex items-center gap-2 bg-yellow-500 text-black px-4 py-1 rounded-full font-black text-xs tracking-widest mb-4 shadow-lg uppercase">
                                <span>👑</span> GRAND FINAL CHAMPION
                            </div>
                            <h2 className="text-4xl md:text-6xl font-black text-white mb-2 tracking-tighter italic drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">{resolvedNick}</h2>
                            <p className="text-yellow-400 font-bold tracking-widest text-sm md:text-base opacity-80 uppercase italic mb-6">With {team.name}</p>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                <div className="bg-slate-900/80 rounded-xl px-4 py-2.5 border border-yellow-500/30 min-w-[100px]">
                                    <span className="text-[10px] text-yellow-500/80 block font-black mb-0.5 uppercase">OVERALL RECORD</span>
                                    <span className="text-lg font-bold text-white tracking-tight">{team.win || 0}W <span className="text-slate-400">{team.draw || 0}D</span> <span className="text-red-400">{team.loss || 0}L</span></span>
                                </div>
                                <div className="bg-slate-900/80 rounded-xl px-4 py-2.5 border border-yellow-500/30 min-w-[100px]">
                                    <span className="text-[10px] text-yellow-500/80 block font-black mb-0.5 uppercase">OVERALL GOAL DIFF</span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-xl font-black text-yellow-400">{(team.gd || 0) > 0 ? `+${team.gd}` : team.gd || 0}</span>
                                        <span className="text-[10px] text-slate-400 font-medium">({team.gf || 0}득 / {team.ga || 0}실)</span>
                                    </div>
                                </div>
                                {topScorer && (
                                    <div className="bg-gradient-to-r from-yellow-600/20 to-yellow-900/20 rounded-xl px-5 py-2.5 border border-yellow-400/50">
                                        <span className="text-[10px] text-yellow-500 block font-black mb-0.5 uppercase">TEAM MVP (TOP SCORER)</span>
                                        <span className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5 uppercase">⚽ {topScorer.name} <span className="text-sm text-yellow-400 ml-1">({topScorer.goals} Goals)</span></span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="absolute bottom-3 right-4 text-[9px] text-slate-500/60 font-bold italic tracking-wider z-20">{footerText}</div>
                </div>
            </div>
          );
      })()}

      {/* 🚩 리그 1위 전용 카드 (경기가 한 번이라도 진행되었을 때 노출) */}
      {sortedTeams && sortedTeams.length > 0 && (sortedTeams[0].win > 0 || sortedTeams[0].draw > 0 || sortedTeams[0].loss > 0) && (() => {
          const team = sortedTeams[0];
          const resolvedNick = resolveOwnerNickname(team.ownerName, team.ownerUid);
          const ownerInfo = owners.find(o => o.nickname === resolvedNick);
          const displayPhoto = ownerInfo?.photo || FALLBACK_IMG;
          
          let title = "🚩 CURRENT LEAGUE 1ST";
          if (currentSeason?.type === 'LEAGUE_PLAYOFF') title = "🚩 REGULAR LEAGUE 1ST";
          else if (currentSeason?.status === 'COMPLETED') title = "🏆 LEAGUE CHAMPION";

          return (
            <div className="mb-6">
                <div className="relative w-full rounded-xl overflow-hidden border border-blue-500/40 shadow-[0_0_30px_rgba(59,130,246,0.15)] transform transition-transform duration-300 bg-[#020617]">
                    <div className="absolute inset-0 z-0 bg-gradient-to-tr from-blue-900/30 via-transparent to-transparent"></div>
                    <div className="absolute top-1/2 right-10 -translate-y-1/2 opacity-20 pointer-events-none">
                        <div className="w-[140px] h-[140px] filter drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]" style={{ backgroundImage: `url(${team.logo})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}></div>
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center p-5 gap-4 bg-slate-900/60 backdrop-blur-sm pb-10">
                        <div className="relative pt-3 shrink-0 pl-2">
                            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full p-[3px] bg-gradient-to-tr from-blue-300 via-blue-500 to-blue-200 shadow-xl relative z-10">
                                <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-900 bg-slate-800">
                                    <img src={displayPhoto} className="w-full h-full object-cover" alt="owner" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} />
                                </div>
                            </div>
                            <div className="absolute -bottom-2 -right-1 w-12 h-12 bg-white rounded-full p-1.5 shadow-2xl border-2 border-blue-400 z-30 overflow-hidden flex items-center justify-center">
                                <img src={team.logo || FALLBACK_IMG} className="w-[80%] h-[80%] object-contain" alt="" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} />
                            </div>
                        </div>
                        <div className="flex-1 text-center md:text-left pt-3 md:pt-0 pl-2 md:pl-4">
                            <div className="inline-flex items-center gap-1.5 bg-blue-900/50 border border-blue-500/50 text-blue-400 px-3 py-1 rounded-full font-black text-[10px] tracking-widest mb-3 shadow-lg uppercase">
                                {title}
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black text-white mb-1 drop-shadow-md tracking-tight italic">{resolvedNick}</h2>
                            <p className="text-blue-400 font-bold tracking-widest text-xs md:text-sm opacity-80 uppercase italic mb-4">With {team.name}</p>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                <div className="bg-slate-950/80 rounded-xl px-4 py-2.5 border border-slate-800 min-w-[80px]">
                                    <span className="text-[10px] text-slate-400 block font-bold mb-0.5 uppercase">PTS</span>
                                    <span className="text-xl font-black text-blue-400">{team.points}</span>
                                </div>
                                <div className="bg-slate-950/80 rounded-xl px-4 py-2.5 border border-slate-800 min-w-[100px]">
                                    <span className="text-[10px] text-slate-400 block font-bold mb-0.5 uppercase">RECORD</span>
                                    <span className="text-lg font-bold text-white tracking-tight">{team.win}W <span className="text-slate-500">{team.draw}D</span> <span className="text-red-400">{team.loss}L</span></span>
                                </div>
                                <div className="bg-blue-900/20 rounded-xl px-5 py-2.5 border border-blue-500/20">
                                    <span className="text-[10px] text-blue-400 block font-black mb-0.5 uppercase">GOAL DIFF</span>
                                    <span className="text-xl font-black text-blue-400">{(team.gd || 0) > 0 ? `+${team.gd}` : team.gd || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="absolute bottom-2 right-4 text-[9px] text-slate-500/60 font-bold italic tracking-wider z-20">{footerText}</div>
                </div>
            </div>
          );
      })()}

      {/* 🌟 1위 오너 포인트 정보 */}
      {(!activeRankingData?.owners || activeRankingData.owners.length === 0) ? (
          <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-10 text-center text-slate-500 font-bold italic shadow-2xl">등록된 오너 포인트가 없습니다.</div>
      ) : (() => {
        const firstOwner = activeRankingData.owners[0];
        const resolvedNick = resolveOwnerNickname(firstOwner.name, firstOwner.ownerUid);
        const matchedOwner = owners.find(owner => owner.nickname === resolvedNick);
        const displayPhoto = matchedOwner?.photo || FALLBACK_IMG;
        const displayPrize = getOwnerPrize(firstOwner.name);
        return (
          <div className="mb-6">
              <div className="relative w-full rounded-xl overflow-hidden border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)] transform transition-transform duration-300 bg-[#020617]">
                  <div className="absolute inset-0 z-0 bg-gradient-to-tr from-emerald-900/40 via-transparent to-transparent"></div>
                  <div className="relative z-10 flex flex-col md:flex-row items-center p-5 gap-4 bg-slate-900/60 backdrop-blur-sm pb-10">
                      <div className="relative pt-3">
                          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full p-[3px] bg-gradient-to-tr from-emerald-300 via-emerald-500 to-emerald-200 shadow-2xl relative z-10">
                              <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-900 bg-slate-800">
                                  <img src={displayPhoto} className="w-full h-full object-cover" alt="owner" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} />
                              </div>
                          </div>
                          <div className="absolute -bottom-3 inset-x-0 flex justify-center z-30">
                              <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full border-2 border-slate-900 shadow-lg tracking-wider uppercase">TOP POINTS</span>
                          </div>
                      </div>
                      <div className="flex-1 text-center md:text-left pt-3 md:pt-0">
                          <h3 className="text-xs md:text-sm text-emerald-400 font-bold tracking-[0.2em] mb-0.5 uppercase">Overall Top Points</h3>
                          <h2 className="text-3xl md:text-4xl font-black text-white mb-3 drop-shadow-md tracking-tight">{resolvedNick}</h2>
                          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                              <div className="bg-slate-950/80 rounded-xl px-4 py-2.5 border border-slate-800 min-w-[80px]">
                                  <span className="text-[10px] text-slate-400 block font-bold mb-0.5 uppercase">POINTS</span>
                                  <span className="text-xl font-black text-emerald-400">{firstOwner.points}</span>
                              </div>
                              <div className="bg-slate-950/80 rounded-xl px-4 py-2.5 border border-slate-800 min-w-[100px]">
                                  <span className="text-[10px] text-slate-400 block font-bold mb-0.5 uppercase">RECORD</span>
                                  <span className="text-lg font-bold text-white tracking-tight">{firstOwner.win}W <span className="text-slate-500">{firstOwner.draw}D</span> <span className="text-red-400">{firstOwner.loss}L</span></span>
                              </div>
                              <div className="bg-emerald-900/20 rounded-xl px-5 py-2.5 border border-emerald-500/20">
                                  <span className="text-[10px] text-emerald-500 block font-black mb-0.5 uppercase">TOTAL PRIZE MONEY</span>
                                  <span className="text-xl font-black text-emerald-400">₩ {displayPrize.toLocaleString()}</span>
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="absolute bottom-2 right-4 text-[9px] text-slate-500/60 font-bold italic tracking-wider z-20">{footerText}</div>
              </div>
          </div>
        );
      })()}

      {/* 📊 2위 이하 오너 포인트 순위표 */}
      {activeRankingData?.owners && activeRankingData.owners.length > 1 && (
          <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
            <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase">
                    <tr>
                        <th className="py-4 pl-4 pr-1 w-10 text-center">R.</th>
                        <th className="py-4 pl-1 pr-4">Owner</th>
                        <th className="p-4 text-center">Record</th>
                        <th className="p-4 text-center text-emerald-400">Pts</th>
                        <th className="p-4 text-right">Prize</th>
                    </tr>
                </thead>
                <tbody>
                    {(activeRankingData?.owners || []).slice(1).map((o: any, i: number) => {
                        if(!o) return null;
                        const actualRank = i + 2;
                        const resolvedNick = resolveOwnerNickname(o.name, o.ownerUid);
                        const matchedOwner = owners.find(owner => owner.nickname === resolvedNick);
                        
                        return (
                            <tr key={i} className={`border-b border-slate-800/50 ${actualRank <= 3 ? 'bg-slate-800/30' : ''}`}>
                                <td className={`py-4 pl-4 pr-1 text-center font-bold ${actualRank === 2 ? 'text-slate-300' : actualRank === 3 ? 'text-orange-400' : 'text-slate-600'}`}>
                                    {actualRank}
                                </td>
                                <td className="py-4 pl-1 pr-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full bg-slate-800 border overflow-hidden flex-shrink-0 shadow-lg ${actualRank === 2 ? 'border-slate-400' : actualRank === 3 ? 'border-orange-500' : 'border-slate-700'}`}>
                                            <img src={matchedOwner?.photo || FALLBACK_IMG} className="w-full h-full object-cover" alt="" onError={(e:any) => { e.target.src = FALLBACK_IMG; }} />
                                        </div>
                                        <span className="font-bold text-sm whitespace-nowrap">{resolvedNick}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-center text-slate-400 font-medium">
                                    <span className="text-white">{o.win}</span>W <span className="text-slate-500">{o.draw}D</span> <span className="text-red-400">{o.loss}L</span>
                                </td>
                                <td className="p-4 text-center text-emerald-400 font-black text-sm">{o.points}</td>
                                <td className={`p-4 text-right font-bold ${getOwnerPrize(o.name) > 0 ? 'text-yellow-400' : 'text-slate-600'}`}>
                                    ₩ {getOwnerPrize(o.name).toLocaleString()}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
          </div>
      )}
    </div>
  );
}