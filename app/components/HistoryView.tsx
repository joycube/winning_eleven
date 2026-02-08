/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import { FALLBACK_IMG, Owner } from '../types';

interface HistoryViewProps {
  historyData: any;
  owners?: Owner[]; // 🔥 [확인] owners 데이터를 선택적으로 받음
}

export const HistoryView = ({ historyData, owners = [] }: HistoryViewProps) => {
  const [historyTab, setHistoryTab] = useState<'TEAMS' | 'OWNERS' | 'PLAYERS'>('OWNERS');
  const [histPlayerMode, setHistPlayerMode] = useState<'GOAL' | 'ASSIST'>('GOAL');

  return (
    <div className="space-y-6 animate-in fade-in">
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

        {/* 1. Teams History */}
        {historyTab === 'TEAMS' && (
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs uppercase">
                    <thead className="bg-slate-900 text-slate-500"><tr><th className="p-4 w-8">#</th><th className="p-4">Team</th><th className="p-4 text-center">W/D/L</th><th className="p-4 text-right">Pts</th></tr></thead>
                    <tbody>
                        {historyData.teams.slice(0, 20).map((t:any, i:number) => (
                            <tr key={i} className="border-b border-slate-800/50">
                                <td className="p-4 text-center text-slate-600">{i+1}</td>
                                <td className="p-4 font-bold text-white flex items-center gap-2">
                                    <img src={t.logo} className="w-6 h-6 object-contain bg-white rounded-full p-0.5" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG}/>{t.name} <span className="text-[9px] text-slate-500">({t.owner})</span>
                                </td>
                                <td className="p-4 text-center text-slate-400">{t.win}W {t.draw}D {t.loss}L</td>
                                <td className="p-4 text-right text-emerald-400 font-bold">{t.points}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {/* 2. Owners History (수정됨) */}
        {historyTab === 'OWNERS' && (
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs uppercase">
                    <thead className="bg-slate-900 text-slate-500">
                        <tr>
                            {/* 🔥 [수정] 패딩을 p-3 -> px-2 py-3 로 조절하여 가로 공간 확보 */}
                            <th className="px-2 py-3 w-8 text-center">#</th>
                            <th className="px-2 py-3">Owner</th>
                            <th className="px-2 py-3 text-center">Rec</th>
                            <th className="px-2 py-3 text-center text-emerald-400">Pts</th>
                            <th className="px-2 py-3 text-center">Awards</th>
                            <th className="px-2 py-3 text-right">Prize</th>
                        </tr>
                    </thead>
                    <tbody>
                        {historyData.owners.map((o:any, i:number) => {
                            // 🔥 [이미지 매칭 로직]
                            const matchedOwner = (owners && owners.length > 0) 
                                ? owners.find(owner => owner.nickname === o.name) 
                                : null;
                            const displayPhoto = matchedOwner?.photo || FALLBACK_IMG;

                            return (
                                <tr key={i} className="border-b border-slate-800/50">
                                    <td className={`px-2 py-3 text-center font-bold ${i<3?'text-yellow-400':'text-slate-600'}`}>{i+1}</td>
                                    
                                    {/* 🔥 [수정] 오너 프로필 + 이름 (작게) */}
                                    <td className="px-2 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0">
                                                <img src={displayPhoto} className="w-full h-full object-cover" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                                            </div>
                                            <span className="font-bold text-white text-xs whitespace-nowrap">{o.name}</span>
                                        </div>
                                    </td>

                                    {/* 🔥 [수정] 레코드 영역: div.flex 제거, 폰트 크기 축소, 줄바꿈 방지 */}
                                    <td className="px-2 py-3 text-center text-slate-400 text-[11px] font-medium whitespace-nowrap">
                                        <span className="text-white">{o.win}</span>W <span className="mx-0.5"></span>
                                        <span className="text-slate-500">{o.draw}D</span> <span className="mx-0.5"></span>
                                        <span className="text-red-400">{o.loss}L</span>
                                    </td>

                                    {/* 🔥 [추가] 누적 승점 */}
                                    <td className="px-2 py-3 text-center text-emerald-400 font-black text-sm">
                                        {o.points}
                                    </td>

                                    <td className="px-2 py-3 text-center text-[10px]">
                                        <div className="flex justify-center gap-1">
                                            {o.golds>0 && <span>🥇{o.golds}</span>}
                                            {o.silvers>0 && <span>🥈{o.silvers}</span>}
                                            {o.bronzes>0 && <span>🥉{o.bronzes}</span>}
                                            {o.golds+o.silvers+o.bronzes===0 && <span className="text-slate-700">-</span>}
                                        </div>
                                    </td>
                                    <td className="px-2 py-3 text-right text-slate-300 font-bold text-xs whitespace-nowrap">₩ {o.prize.toLocaleString()}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        )}

        {/* 3. Players History */}
        {historyTab === 'PLAYERS' && (
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
                <div className="flex bg-slate-950 border-b border-slate-800">
                    <button onClick={()=>setHistPlayerMode('GOAL')} className={`flex-1 py-3 text-xs font-bold ${histPlayerMode==='GOAL'?'text-yellow-400 bg-slate-900':'text-slate-500'}`}>⚽ TOP SCORERS</button>
                    <button onClick={()=>setHistPlayerMode('ASSIST')} className={`flex-1 py-3 text-xs font-bold ${histPlayerMode==='ASSIST'?'text-blue-400 bg-slate-900':'text-slate-500'}`}>🅰️ TOP ASSISTS</button>
                </div>
                <table className="w-full text-left text-xs uppercase">
                    <thead className="bg-slate-900 text-slate-500"><tr><th className="p-3 w-8">#</th><th className="p-3">Player</th><th className="p-3">Team</th><th className="p-3 text-right">{histPlayerMode}</th></tr></thead>
                    <tbody>
                        {historyData.players
                            .filter((p:any) => histPlayerMode === 'GOAL' ? p.goals > 0 : p.assists > 0)
                            .sort((a:any,b:any) => histPlayerMode === 'GOAL' ? b.goals - a.goals : b.assists - a.assists)
                            .slice(0, 20).map((p:any, i:number) => (
                            <tr key={i} className="border-b border-slate-800/50">
                                <td className="p-3 text-center text-slate-600">{i+1}</td>
                                <td className="p-3 font-bold text-white">{p.name} <span className="text-[9px] text-slate-500 font-normal ml-1">({p.owner})</span></td>
                                <td className="p-3 text-slate-400 flex items-center gap-2">
                                    <img src={p.teamLogo} className="w-5 h-5 object-contain rounded-full bg-white p-0.5" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /><span>{p.team}</span>
                                </td>
                                <td className={`p-3 text-right font-bold ${histPlayerMode==='GOAL'?'text-yellow-400':'text-blue-400'}`}>{histPlayerMode==='GOAL'?p.goals:p.assists}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>
  );
};