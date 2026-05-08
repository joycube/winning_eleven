/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { FALLBACK_IMG, Owner } from '../types';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useHistoryRecords } from '../hooks/useHistoryRecords'; 

const getTodayFormatted = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}.${month}.${day}`;
};

interface HistoryViewProps {
  historyData: any; 
  owners?: Owner[]; 
}

export const HistoryView = ({ owners = [] }: HistoryViewProps) => {
  const { historyData, isHistoryLoading } = useHistoryRecords(owners);

  const [historyTab, setHistoryTab] = useState<'TEAMS' | 'OWNERS' | 'PLAYERS'>('OWNERS');
  const [histPlayerMode, setHistPlayerMode] = useState<'GOAL' | 'ASSIST'>('GOAL');

  const [masterTeams, setMasterTeams] = useState<any[]>([]);
  const [allSeasons, setAllSeasons] = useState<any[]>([]);
  const [isSeasonsLoading, setIsSeasonsLoading] = useState(true);

  useEffect(() => {
      const fetchLogos = async () => {
          try {
              const snap = await getDocs(collection(db, "master_teams"));
              setMasterTeams(snap.docs.map(d => d.data()));
          } catch (e) {
              console.error("마스터 팀 로고 에러:", e);
          }
      };
      fetchLogos();
  }, []);

  // 🔥 [추가] PO 데이터를 동적으로 합산하기 위해 seasons 원본을 가져옵니다.
  useEffect(() => {
      const fetchS = async () => {
          try {
              const snap = await getDocs(collection(db, 'seasons'));
              setAllSeasons(snap.docs.map(d => d.data()));
          } catch (e) {
              console.error("Seasons 로드 에러:", e);
          } finally {
              setIsSeasonsLoading(false);
          }
      };
      fetchS();
  }, []);

  const getRealLogo = (teamName: string, currentLogo: string) => {
      if (!teamName) return currentLogo || FALLBACK_IMG;
      const matched = masterTeams.find(m => 
          (m.name || '').toLowerCase() === teamName.toLowerCase() || 
          (m.teamName || '').toLowerCase() === teamName.toLowerCase()
      );
      if (matched && matched.logo) return matched.logo;
      return currentLogo || FALLBACK_IMG;
  };

  const resolveTrueOwnerId = (idOrName: any) => {
      const search = String(idOrName || '').trim();
      const found = owners.find(o => 
          (o as any).uid === search || 
          o.docId === search || 
          String(o.id) === search ||
          o.nickname === search || 
          o.legacyName === search ||
          (o as any).mappedOwnerId === search ||
          ((o as any).legacyNames && (o as any).legacyNames.includes(search))
      );
      if (found) return (found as any).uid || found.docId || String(found.id);
      return search;
  };

  const getSafeName = (idOrName: any) => {
    if (!idOrName || idOrName === '0' || idOrName === 0 || idOrName === '-') return '';
    const search = String(idOrName).trim();
    const found = owners.find(o => 
      (o as any).uid === search || 
      o.docId === search || 
      String(o.id) === search ||
      o.nickname === search || 
      o.legacyName === search ||
      (o as any).mappedOwnerId === search ||
      ((o as any).legacyNames && (o as any).legacyNames.includes(search))
    );
    if (found) return found.nickname || (found as any).mappedOwnerId || search;
    return search;
  };

  const getPoints = (item: any) => Number(item?.points ?? item?.pts ?? 0);

  // =========================================================================
  // 🔥 [핵심 픽스] 전체 시즌의 "리그 + PO" 데이터를 싹 다 긁어모아 100% 다시 계산합니다.
  // =========================================================================
  const dynamicStats = useMemo(() => {
      const teamMap = new Map();
      const ownerMap = new Map();
      const playerMap = new Map();

      allSeasons.forEach(s => {
          const processMatch = (m: any) => {
              if (!m || m.status !== 'COMPLETED') return;
              if (m.home === 'BYE' || m.away === 'BYE' || m.home?.includes('부전승') || m.away?.includes('부전승')) return;

              const hOwnerId = resolveTrueOwnerId(m.homeOwnerUid || m.homeOwner);
              const aOwnerId = resolveTrueOwnerId(m.awayOwnerUid || m.awayOwner);

              const hScore = Number(m.homeScore || 0);
              const aScore = Number(m.awayScore || 0);

              const updateTeam = (teamName: string, ownerId: string, ownerName: string, gf: number, ga: number, logo: string) => {
                  if (!teamName || teamName === 'TBD' || teamName === 'BYE') return;
                  const key = `${teamName}_${ownerId}`;
                  if (!teamMap.has(key)) teamMap.set(key, { name: teamName, ownerId, ownerName, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, gd: 0, pts: 0, logo });
                  const t = teamMap.get(key);
                  t.gf += gf; t.ga += ga; t.gd = t.gf - t.ga;
                  if (gf > ga) { t.win += 1; t.pts += 3; }
                  else if (gf < ga) { t.loss += 1; }
                  else { t.draw += 1; t.pts += 1; }
              };

              updateTeam(m.home, hOwnerId, m.homeOwner, hScore, aScore, m.homeLogo);
              updateTeam(m.away, aOwnerId, m.awayOwner, aScore, hScore, m.awayLogo);

              const updateOwner = (ownerId: string, gf: number, ga: number) => {
                  if(!ownerId || ownerId === '-' || ownerId === 'CPU') return;
                  if (!ownerMap.has(ownerId)) ownerMap.set(ownerId, { id: ownerId, win: 0, draw: 0, loss: 0, pts: 0 });
                  const o = ownerMap.get(ownerId);
                  if (gf > ga) { o.win += 1; o.pts += 3; }
                  else if (gf < ga) { o.loss += 1; }
                  else { o.draw += 1; o.pts += 1; }
              };

              updateOwner(hOwnerId, hScore, aScore);
              updateOwner(aOwnerId, aScore, hScore);

              const processPlayers = (scorers: any[], teamName: string, ownerId: string, logo: string, type: string) => {
                  if (!scorers || !Array.isArray(scorers)) return;
                  scorers.forEach(s => {
                      const pName = typeof s === 'string' ? s : s.name;
                      const count = typeof s === 'string' ? 1 : (Number(s.count) || 1);
                      if (!pName) return;
                      const key = `${pName}_${teamName}_${ownerId}`;
                      if (!playerMap.has(key)) playerMap.set(key, { name: pName, team: teamName, ownerId, teamLogo: logo, goals: 0, assists: 0 });
                      const p = playerMap.get(key);
                      if (type === 'GOAL') p.goals += count;
                      if (type === 'ASSIST') p.assists += count;
                  });
              }

              processPlayers(m.homeScorers, m.home, hOwnerId, m.homeLogo, 'GOAL');
              processPlayers(m.homeAssists, m.home, hOwnerId, m.homeLogo, 'ASSIST');
              processPlayers(m.awayScorers, m.away, aOwnerId, m.awayLogo, 'GOAL');
              processPlayers(m.awayAssists, m.away, aOwnerId, m.awayLogo, 'ASSIST');
          };

          s.rounds?.forEach((r: any) => r.matches?.forEach(processMatch));
          s.playoffs?.forEach((p: any) => { if (p.matches) p.matches.forEach(processMatch); else processMatch(p); });
          s.brackets?.forEach((b: any) => { if (b.matches) b.matches.forEach(processMatch); else processMatch(b); });
      });

      return {
          teams: Array.from(teamMap.values()),
          owners: Array.from(ownerMap.values()),
          players: Array.from(playerMap.values())
      };
  }, [allSeasons, owners]);

  // 🔥 [안전 병합] 최신 동적 기록 위에 DB의 상금/트로피 기록을 덮어씌웁니다. (유실 방지)
  const consolidatedOwners = useMemo(() => {
      const ownerMap = new Map();
      dynamicStats.owners.forEach(o => ownerMap.set(o.id, { ...o, golds: 0, silvers: 0, bronzes: 0, prize: 0 }));

      if (historyData?.owners) {
          historyData.owners.forEach((o: any) => {
              const trueId = resolveTrueOwnerId(o.id || o.uid);
              if (!ownerMap.has(trueId)) {
                  ownerMap.set(trueId, { ...o, id: trueId });
              } else {
                  const existing = ownerMap.get(trueId);
                  existing.golds = (existing.golds || 0) + (o.golds || 0);
                  existing.silvers = (existing.silvers || 0) + (o.silvers || 0);
                  existing.bronzes = (existing.bronzes || 0) + (o.bronzes || 0);
                  existing.prize = (existing.prize || 0) + (o.prize || 0);
                  if (o.name) existing.name = o.name;
              }
          });
      }
      return Array.from(ownerMap.values()).sort((a: any, b: any) => getPoints(b) - getPoints(a) || (b.golds||0) - (a.golds||0) || (b.win||0) - (a.win||0));
  }, [historyData?.owners, dynamicStats.owners]);

  const consolidatedTeams = useMemo(() => {
      const teamMap = new Map();
      dynamicStats.teams.forEach(t => teamMap.set(`${t.name}_${t.ownerId}`, { ...t }));

      if (historyData?.teams) {
          historyData.teams.forEach((t: any) => {
              const tName = t.name?.trim();
              if (!tName) return;
              const trueOwnerId = resolveTrueOwnerId(t.ownerId || t.ownerName || t.owner);
              const key = `${tName}_${trueOwnerId}`;
              if (!teamMap.has(key)) {
                  teamMap.set(key, { ...t, ownerId: trueOwnerId });
              }
          });
      }
      return Array.from(teamMap.values()).sort((a: any, b: any) => {
          const aPts = getPoints(a); const bPts = getPoints(b);
          if (bPts !== aPts) return bPts - aPts;      
          if ((b.gd || 0) !== (a.gd || 0)) return (b.gd || 0) - (a.gd || 0); 
          return (b.gf || 0) - (a.gf || 0);                           
      });
  }, [historyData?.teams, dynamicStats.teams]);

  const consolidatedPlayers = useMemo(() => {
      const playerMap = new Map();
      dynamicStats.players.forEach(p => playerMap.set(`${p.name}_${p.team}_${p.ownerId}`, { ...p }));

      if (historyData?.players) {
          historyData.players.forEach((p: any) => {
              const pName = p.name?.trim();
              if (!pName) return;
              const trueOwnerId = resolveTrueOwnerId(p.ownerId || p.ownerUid || p.owner);
              const pTeam = p.team?.trim();
              const key = `${pName}_${pTeam}_${trueOwnerId}`;
              if (!playerMap.has(key)) {
                  playerMap.set(key, { ...p, ownerId: trueOwnerId });
              }
          });
      }
      return Array.from(playerMap.values());
  }, [historyData?.players, dynamicStats.players]);

  const getPlayerRanking = (players: any[]) => {
    if (!players || players.length === 0) return [];
    const sortedPlayers = players
        .filter((p:any) => histPlayerMode === 'GOAL' ? (p.goals || 0) > 0 : (p.assists || 0) > 0)
        .sort((a:any,b:any) => histPlayerMode === 'GOAL' ? b.goals - a.goals : b.assists - a.assists);
    let currentRank = 1; let skip = 0;
    return sortedPlayers.map((player, index, array) => {
        if (index > 0) {
            const prevPlayer = array[index - 1];
            const prevScore = histPlayerMode === 'GOAL' ? prevPlayer.goals : prevPlayer.assists;
            const currScore = histPlayerMode === 'GOAL' ? player.goals : player.assists;
            if (prevScore === currScore) skip++;
            else { currentRank += 1 + skip; skip = 0; }
        }
        return { ...player, rank: currentRank };
    });
  };

  const rankedPlayers = getPlayerRanking(consolidatedPlayers);

  if (isHistoryLoading || isSeasonsLoading) {
      return (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 animate-pulse">
              <div className="text-4xl mb-4">🏆</div>
              <p className="text-sm font-bold tracking-widest uppercase">명예의 전당 데이터를 긁어모으는 중입니다...</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
        <style dangerouslySetInnerHTML={{ __html: `
            @keyframes verticalFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
            @keyframes green-light-sweep { 0% { transform: translateX(-100%) skewX(-25deg); opacity: 0; } 50% { opacity: 0.5; } 100% { transform: translateX(200%) skewX(-25deg); opacity: 0; } }
            @keyframes green-glow-pulse { 0%, 100% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.1); } 50% { box-shadow: 0 0 40px rgba(16, 185, 129, 0.3); } }
            .trophy-float-straight { animation: verticalFloat 4s infinite ease-in-out; }
            .silver-trophy { filter: grayscale(100%) drop-shadow(0 4px 8px rgba(0,0,0,0.6)); }
            .green-neon-bg { background: linear-gradient(135deg, rgba(6, 78, 59, 0.4), rgba(15, 23, 42, 0.9), rgba(6, 78, 59, 0.4)); animation: green-glow-pulse 4s infinite ease-in-out; }
            .green-sweep-beam { position: absolute; top: 0; left: 0; width: 50%; height: 100%; background: linear-gradient(to right, transparent, rgba(52, 211, 153, 0.2), transparent); filter: blur(10px); animation: green-light-sweep 4s infinite ease-in-out; pointer-events: none; }
        `}} />

        <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-blue-900/20" />
            <h2 className="text-2xl font-black italic text-white mb-1 relative z-10">👑 HALL OF FAME 👑</h2>
            <p className="text-xs text-slate-400 relative z-10">역대 모든 시즌의 통합 기록입니다.</p>
        </div>

        <div className="bg-slate-900/80 p-2 rounded-2xl border border-slate-800 flex justify-center gap-1">
            {['TEAMS', 'OWNERS', 'PLAYERS'].map(t => (
                <button key={t} onClick={() => setHistoryTab(t as any)} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${historyTab === t ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-950 text-slate-500'}`}>{t}</button>
            ))}
        </div>

        {historyTab === 'TEAMS' && (
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-500 uppercase"><tr><th className="p-4 w-8 text-center">#</th><th className="p-4">Team</th><th className="p-4 text-center">W/D/L</th><th className="p-4 text-right">Pts</th></tr></thead>
                    <tbody>
                        {consolidatedTeams.slice(0, 20).map((t:any, i:number) => {
                            const ownerDisplayName = getSafeName(t.ownerId || t.ownerName);

                            return (
                                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                    <td className={`p-4 text-center font-bold ${i < 3 ? 'text-emerald-400' : 'text-slate-600'}`}>{i+1}</td>
                                    <td className="p-4 font-bold text-white flex items-center gap-3">
                                        <img src={getRealLogo(t.name, t.logo)} className="w-7 h-7 object-contain bg-white rounded-full p-1 flex-shrink-0 shadow-sm" alt="" onError={(e:any)=>{e.target.onerror=null; e.target.src=FALLBACK_IMG;}}/>
                                        <div className="flex flex-col">
                                            <span className="text-[13px] leading-tight">{t.name}</span>
                                            {ownerDisplayName && (
                                                <span className="text-[10px] text-slate-500 font-bold mt-[1px]">({ownerDisplayName})</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center text-slate-400 uppercase tracking-wider font-medium">{t.win}W {t.draw}D {t.loss}L</td>
                                    <td className="p-4 text-right text-emerald-400 font-black text-[14px]">{getPoints(t)}</td>
                                </tr>
                            );
                        })}
                        {consolidatedTeams.length === 0 && (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-500 italic">기록된 팀 데이터가 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        )}

        {historyTab === 'OWNERS' && (
            <div className="space-y-4">
                {consolidatedOwners.length > 0 ? (() => {
                    const legend = consolidatedOwners[0];
                    const matchedOwner = owners.find(o => 
                        o.nickname === legend.name || 
                        o.docId === legend.id || 
                        String(o.id) === legend.id || 
                        (o as any).uid === legend.id
                    );
                    const displayPhoto = matchedOwner?.photo || FALLBACK_IMG;
                    const displayName = getSafeName(legend.id) || matchedOwner?.nickname || legend.name;

                    return (
                        <div className="mb-6 relative flex flex-col">
                            <div className="relative w-full rounded-2xl overflow-hidden border border-emerald-500/30 shadow-2xl bg-[#0f172a]">
                                <div className="absolute inset-0 green-neon-bg z-0"></div>
                                <div className="green-sweep-beam z-0"></div>
                                
                                <div className="relative z-10 flex flex-col md:flex-row items-center p-5 gap-6 bg-slate-950/40 backdrop-blur-sm pb-10">
                                    <div className="relative pt-4 pl-10">
                                        <div className="absolute -top-2 -left-6 text-6xl z-20 trophy-float-straight silver-trophy">🏆</div>
                                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full p-[3px] bg-gradient-to-br from-emerald-300 via-emerald-500 to-emerald-900 shadow-2xl relative z-10">
                                            <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-900 grayscale-[0.2]">
                                                <img src={displayPhoto} className="w-full h-full object-cover" alt="" onError={(e:any)=>{e.target.onerror=null; e.target.src=FALLBACK_IMG;}} />
                                            </div>
                                        </div>
                                        <div className="absolute -bottom-3 inset-x-0 flex justify-center z-30">
                                            <span className="bg-gradient-to-r from-slate-900 to-slate-800 text-emerald-400 text-[10px] font-black px-4 py-1 rounded-full border border-emerald-500/50 shadow-lg tracking-widest uppercase">All-Time Legend</span>
                                        </div>
                                    </div>

                                    <div className="flex-1 text-center md:text-left pt-3 md:pt-0 w-full">
                                        <h3 className="text-[10px] text-emerald-400 font-bold tracking-[0.3em] mb-1 uppercase">Hall of Fame No.1</h3>
                                        <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-300 mb-4 drop-shadow-sm tracking-tight">
                                            {displayName}
                                        </h2>
                                        
                                        <div className="flex flex-col gap-2 w-full">
                                            <div className="grid grid-cols-3 gap-2 w-full">
                                                <div className="bg-slate-900/80 rounded-lg py-2 border border-slate-700/50 flex flex-col items-center justify-center">
                                                    <span className="text-[9px] text-slate-500 block font-bold mb-0.5 uppercase">POINTS</span>
                                                    <span className="text-lg font-black text-emerald-400 leading-none">{getPoints(legend)}</span>
                                                </div>
                                                <div className="bg-slate-900/80 rounded-lg py-2 border border-slate-700/50 flex flex-col items-center justify-center">
                                                    <span className="text-[9px] text-slate-500 block font-bold mb-0.5 uppercase">RECORD</span>
                                                    <span className="text-sm font-bold text-slate-200 leading-none uppercase">{legend.win}W {legend.draw}D {legend.loss}L</span>
                                                </div>
                                                <div className="bg-slate-900/80 rounded-lg py-2 border border-slate-700/50 flex flex-col items-center justify-center">
                                                    <span className="text-[9px] text-slate-500 block font-bold mb-0.5 uppercase">TROPHIES</span>
                                                    <div className="flex gap-1 text-xs leading-none">
                                                        {legend.golds > 0 ? <span>🥇{legend.golds}</span> : <span className="text-slate-700">-</span>}
                                                        {legend.silvers > 0 && <span className="opacity-70">🥈{legend.silvers}</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 rounded-lg py-2 border border-emerald-500/30 flex flex-col items-center justify-center w-full">
                                                <span className="text-[9px] text-emerald-400 block font-black mb-0.5 uppercase">TOTAL PRIZE</span>
                                                <span className="text-base font-bold text-white leading-none">₩ {(legend.prize || 0).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute bottom-2 right-4 text-[8px] text-slate-500/80 font-bold italic tracking-wider z-20">
                                    {`HALL OF FAME / ${getTodayFormatted()}`}
                                </div>
                            </div>
                        </div>
                    );
                })() : (
                    <div className="text-center py-10 text-slate-500 italic bg-slate-900/40 rounded-xl border border-slate-800">기록된 오너 데이터가 없습니다.</div>
                )}

                {consolidatedOwners.length > 1 && (
                    <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-lg">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-950 text-slate-500 uppercase">
                                <tr>
                                    <th className="px-2 py-3 w-8 text-center">#</th>
                                    <th className="px-2 py-3">Owner</th>
                                    <th className="px-2 py-3 text-center">Rec</th>
                                    <th className="px-2 py-3 text-center text-emerald-400">Pts</th>
                                    <th className="px-2 py-3 text-center">Awards</th>
                                    <th className="px-2 py-3 text-right">Prize</th>
                                </tr>
                            </thead>
                            <tbody>
                                {consolidatedOwners.slice(1).map((o:any, i:number) => {
                                    const actualRank = i + 2; 
                                    const matchedOwner = owners.find(owner => 
                                        owner.nickname === o.name || 
                                        owner.docId === o.id || 
                                        String(owner.id) === o.id || 
                                        (owner as any).uid === o.id
                                    );
                                    const displayPhoto = matchedOwner?.photo || FALLBACK_IMG;
                                    const displayName = getSafeName(o.id) || matchedOwner?.nickname || o.name;

                                    return (
                                        <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                            <td className={`px-2 py-3 text-center font-bold ${actualRank===2?'text-slate-300':actualRank===3?'text-orange-400':'text-slate-600'}`}>{actualRank}</td>
                                            
                                            <td className="px-2 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-8 h-8 rounded-full bg-slate-800 border overflow-hidden flex-shrink-0 ${actualRank===2 ? 'border-slate-400' : actualRank===3 ? 'border-orange-600' : 'border-slate-700'}`}>
                                                        <img src={displayPhoto} className="w-full h-full object-cover" alt="" onError={(e:any)=>{e.target.onerror=null; e.target.src=FALLBACK_IMG;}} />
                                                    </div>
                                                    <span className={`font-bold text-xs whitespace-nowrap ${actualRank===2 ? 'text-slate-200' : actualRank===3 ? 'text-orange-200' : 'text-white'}`}>{displayName}</span>
                                                </div>
                                            </td>

                                            <td className="px-2 py-3 text-center text-slate-400 text-[11px] font-medium whitespace-nowrap uppercase">
                                                <span className="text-white">{o.win}</span>W <span className="mx-0.5"></span>
                                                <span className="text-slate-500">{o.draw}D</span> <span className="mx-0.5"></span>
                                                <span className="text-red-400">{o.loss}L</span>
                                            </td>

                                            <td className="px-2 py-3 text-center text-emerald-400 font-black text-sm">
                                                {getPoints(o)}
                                            </td>

                                            <td className="px-2 py-3 text-center text-[10px]">
                                                <div className="flex justify-center gap-1">
                                                    {o.golds>0 && <span>🥇{o.golds}</span>}
                                                    {o.silvers>0 && <span>🥈{o.silvers}</span>}
                                                    {o.bronzes>0 && <span>🥉{o.bronzes}</span>}
                                                    {(o.golds||0)+(o.silvers||0)+(o.bronzes||0)===0 && <span className="text-slate-700">-</span>}
                                                </div>
                                            </td>
                                            <td className="px-2 py-3 text-right text-slate-300 font-bold text-xs whitespace-nowrap uppercase">₩ {(o.prize||0).toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}

        {historyTab === 'PLAYERS' && (
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
                <div className="flex bg-slate-950 border-b border-slate-800 uppercase">
                    <button onClick={()=>setHistPlayerMode('GOAL')} className={`flex-1 py-3 text-xs font-bold ${histPlayerMode==='GOAL'?'text-yellow-400 bg-slate-900':'text-slate-500'}`}>⚽ TOP SCORERS</button>
                    <button onClick={()=>setHistPlayerMode('ASSIST')} className={`flex-1 py-3 text-xs font-bold ${histPlayerMode==='ASSIST'?'text-blue-400 bg-slate-900':'text-slate-500'}`}>🅰️ TOP ASSISTS</button>
                </div>
                <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-500 uppercase"><tr><th className="p-3 w-8 text-center">#</th><th className="p-3">Player</th><th className="p-3">Team</th><th className="p-3 text-right">{histPlayerMode}</th></tr></thead>
                    <tbody>
                        {rankedPlayers.slice(0, 20).map((p:any, i:number) => {
                            const ownerDisplayName = getSafeName(p.ownerId || p.ownerUid || p.owner);

                            return (
                                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                    <td className={`p-3 text-center ${p.rank<=3?'text-emerald-400 font-bold':'text-slate-600'}`}>{p.rank}</td>
                                    <td className="p-3 font-bold text-white flex flex-col justify-center">
                                        <span className="text-[13px]">{p.name}</span>
                                        {ownerDisplayName && (
                                            <span className="text-[10px] text-slate-500 font-normal">({ownerDisplayName})</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-slate-400">
                                        <div className="flex items-center gap-2">
                                            <img src={getRealLogo(p.team, p.teamLogo)} className="w-6 h-6 object-contain rounded-full bg-white p-0.5 shadow-sm" alt="" onError={(e:any)=>{e.target.onerror=null; e.target.src=FALLBACK_IMG;}} />
                                            <span className="text-[12px]">{p.team}</span>
                                        </div>
                                    </td>
                                    <td className={`p-3 text-right font-black text-[14px] ${histPlayerMode==='GOAL'?'text-yellow-400':'text-blue-400'}`}>{histPlayerMode==='GOAL'?p.goals:p.assists}</td>
                                </tr>
                            );
                        })}
                        {rankedPlayers.length === 0 && (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-500 italic">기록된 선수 데이터가 없습니다.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        )}
    </div>
  );
};

export default HistoryView;