/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from 'react';
import { Match, FALLBACK_IMG } from '../types';
import { RecordInput } from './RecordInput'; 

// 🔥 [디벨롭] 외부 링크 차단(엑스박스)을 방지하는 절대 안 깨지는 내장 SVG 방패 로고
const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

interface MatchEditModalProps {
  match: Match;
  onClose: () => void;
  onSave: (matchId: string, hScore: string, aScore: string, yt: string, records: any, manualWinner: 'HOME'|'AWAY'|null) => void;
  isTournament: boolean;
  teamPlayers: (team: string) => string[];
}

export const MatchEditModal = ({ match, onClose, onSave, isTournament, teamPlayers }: MatchEditModalProps) => {
  const [inputs, setInputs] = useState({ homeScore: match.homeScore || '0', awayScore: match.awayScore || '0', youtube: match.youtubeUrl || '' });
  const [records, setRecords] = useState({
      homeScorers: match.homeScorers || [], awayScorers: match.awayScorers || [],
      homeAssists: match.homeAssists || [], awayAssists: match.awayAssists || []
  });
  const [recordInput, setRecordInput] = useState({ homeScorer:{name:'',count:'1'}, awayScorer:{name:'',count:'1'}, homeAssist:{name:'',count:'1'}, awayAssist:{name:'',count:'1'} });
  const [manualWinner, setManualWinner] = useState<'HOME' | 'AWAY' | null>(null);

  // 조별리그(GROUP) 판단 로직
  const labelUpper = (match.matchLabel || '').toUpperCase();
  const stageUpper = (match.stage || '').toUpperCase();
  const isGroupStage = labelUpper.includes('GROUP') || stageUpper.includes('GROUP');
  const effectiveIsTournament = isTournament && !isGroupStage;

  // 🔥 [디벨롭] 부전승(BYE) 여부 확인
  const isHomeBye = match.home === 'BYE';
  const isAwayBye = match.away === 'BYE';
  const isByeMatch = isHomeBye || isAwayBye;

  // 🔥 [디벨롭] 매치가 열리자마자 한쪽이 BYE면, 살아있는 팀을 무조건 승자(manualWinner)로 강제 고정!
  useEffect(() => {
      if (isAwayBye) setManualWinner('HOME');
      if (isHomeBye) setManualWinner('AWAY');
  }, [isAwayBye, isHomeBye]);

  // 🔥 [디벨롭] 엑스박스 방지 안전 로고 추출기
  const getSafeLogo = (teamName: string, originalLogo: string) => {
      if (teamName === 'TBD' || teamName === 'BYE' || originalLogo?.includes('uefa.com') || originalLogo?.includes('club-generic-badge-new')) {
          return SAFE_TBD_LOGO;
      }
      return originalLogo || FALLBACK_IMG;
  };

  const handleRecordAdd = (type: keyof typeof recordInput, targetListKey: keyof typeof records) => {
      const name = recordInput[type].name.trim();
      const count = Number(recordInput[type].count);
      if(!name) return alert("이름을 입력하세요");
      
      if(type==='homeScorer') setInputs(p=>({...p, homeScore:String(Number(p.homeScore)+count)}));
      if(type==='awayScorer') setInputs(p=>({...p, awayScore:String(Number(p.awayScore)+count)}));

      setRecords(p => ({...p, [targetListKey]: [...p[targetListKey], {id:Date.now(), name, count}]}));
      setRecordInput(p => ({...p, [type]: {...p[type], name:''}}));
  };

  const handleRecordRemove = (targetListKey: keyof typeof records, id: number, isHome: boolean) => {
      const item = records[targetListKey].find((r:any)=>r.id===id);
      if(item && targetListKey.includes('Scorer')) {
          if(isHome) setInputs(p=>({...p, homeScore:String(Math.max(0,Number(p.homeScore)-item.count))}));
          else setInputs(p=>({...p, awayScore:String(Math.max(0,Number(p.awayScore)-item.count))}));
      }
      setRecords(p => ({...p, [targetListKey]: p[targetListKey].filter((r:any)=>r.id!==id)}));
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999] p-4">
       <div className="bg-slate-900 p-6 rounded-3xl border border-slate-700 w-full max-w-5xl relative max-h-[90vh] overflow-y-auto">
          <button onClick={onClose} className="absolute top-4 right-4 text-white text-2xl hover:text-emerald-400 transition-colors">✕</button>
          
          <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-slate-300 italic">{match.matchLabel}</h3>
              <p className="text-sm text-slate-500">{match.stage}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
              {/* Home */}
              <div className={`bg-slate-950 p-4 rounded-2xl border ${isHomeBye ? 'border-slate-800 opacity-50' : 'border-slate-700'}`}>
                  <div className="flex flex-col items-center mb-4">
                      <div className={`w-20 h-20 mb-3 rounded-full flex items-center justify-center p-3 shadow-xl shrink-0 ${isHomeBye ? 'bg-slate-800' : 'bg-white'}`}>
                          <img src={getSafeLogo(match.home, match.homeLogo)} className="max-w-full max-h-full object-contain" alt="" />
                      </div>
                      <span className="font-bold text-white">{match.home}</span>
                  </div>
                  {!isHomeBye && (
                      <>
                          <datalist id="homeTeamPlayers">{teamPlayers(match.home).map((name, i) => <option key={i} value={name} />)}</datalist>
                          <div className="space-y-4">
                              <RecordInput type="homeScorer" inputValue={recordInput.homeScorer} onInputChange={(t,f,v)=>setRecordInput(p=>({...p,[t]:{...(p as any)[t],[f]:v}}))} onAdd={()=>handleRecordAdd('homeScorer','homeScorers')} onRemove={(t,id)=>handleRecordRemove('homeScorers',id,true)} records={records.homeScorers} label="⚽ Scorers" colorClass="text-emerald-400" datalistId="homeTeamPlayers" />
                              <RecordInput type="homeAssist" inputValue={recordInput.homeAssist} onInputChange={(t,f,v)=>setRecordInput(p=>({...p,[t]:{...(p as any)[t],[f]:v}}))} onAdd={()=>handleRecordAdd('homeAssist','homeAssists')} onRemove={(t,id)=>handleRecordRemove('homeAssists',id,true)} records={records.homeAssists} label="🅰️ Assists" colorClass="text-blue-400" datalistId="homeTeamPlayers" />
                          </div>
                      </>
                  )}
              </div>

              {/* Center */}
              <div className="flex flex-col items-center justify-center space-y-6">
                  
                  {/* 🔥 [디벨롭] BYE 매치일 경우 스코어 입력창 대신 부전승 패스 UI 노출 */}
                  {isByeMatch ? (
                      <div className="flex flex-col items-center gap-3 w-full">
                          <div className="bg-blue-900/40 p-4 rounded-xl border border-blue-500 text-center animate-pulse w-full shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                              <p className="text-sm text-blue-200 font-black mb-1">🎉 부전승 (BYE) 매치</p>
                              <p className="text-[11px] text-blue-300 break-keep">
                                  결과 저장 시 <strong className="text-white bg-blue-800 px-1.5 py-0.5 rounded">{isAwayBye ? match.home : match.away}</strong> 팀이 다음 라운드로 즉시 진출합니다.
                              </p>
                          </div>
                          <div className="flex items-center gap-4 opacity-30 pointer-events-none">
                              <input type="number" value={0} readOnly className="w-16 h-16 text-center text-3xl font-black bg-black rounded-2xl border border-slate-700 text-white" />
                              <span className="text-slate-600 text-2xl">:</span>
                              <input type="number" value={0} readOnly className="w-16 h-16 text-center text-3xl font-black bg-black rounded-2xl border border-slate-700 text-white" />
                          </div>
                      </div>
                  ) : (
                      <>
                          <div className="flex items-center gap-4">
                              <input type="number" value={inputs.homeScore} onChange={e=>setInputs({...inputs, homeScore:e.target.value})} className="w-20 h-20 text-center text-4xl font-black bg-black rounded-2xl border border-slate-700 text-white focus:border-emerald-500 outline-none transition-colors" />
                              <span className="text-slate-600 text-2xl">:</span>
                              <input type="number" value={inputs.awayScore} onChange={e=>setInputs({...inputs, awayScore:e.target.value})} className="w-20 h-20 text-center text-4xl font-black bg-black rounded-2xl border border-slate-700 text-white focus:border-emerald-500 outline-none transition-colors" />
                          </div>
                          
                          {effectiveIsTournament && Number(inputs.homeScore) === Number(inputs.awayScore) && inputs.homeScore !== '' && (
                              <div className="bg-red-900/40 p-3 rounded-xl border border-red-500 text-center animate-pulse w-full">
                                  <p className="text-[11px] text-red-200 font-bold mb-2 tracking-widest">⚠️ 동점: 다음 라운드 진출 팀 선택</p>
                                  <div className="flex gap-2 justify-center">
                                      <button onClick={()=>setManualWinner('HOME')} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${manualWinner==='HOME'?'bg-red-600 text-white border-red-400 shadow-[0_0_10px_rgba(220,38,38,0.5)]':'bg-black text-red-400 border-red-800 hover:bg-red-950'}`}>Home 승</button>
                                      <button onClick={()=>setManualWinner('AWAY')} className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${manualWinner==='AWAY'?'bg-red-600 text-white border-red-400 shadow-[0_0_10px_rgba(220,38,38,0.5)]':'bg-black text-red-400 border-red-800 hover:bg-red-950'}`}>Away 승</button>
                                  </div>
                              </div>
                          )}
                      </>
                  )}

                  <div className="w-full">
                      <label className="text-[10px] text-slate-500 font-bold mb-1.5 block text-center uppercase tracking-widest">YouTube Highlights URL</label>
                      <input value={inputs.youtube} onChange={e=>setInputs({...inputs,youtube:e.target.value})} placeholder="https://youtube.com/..." className="w-full bg-black p-3 rounded-xl text-center text-xs border border-slate-700 text-white focus:border-emerald-500 outline-none transition-colors"/>
                  </div>
                  
                  {/* 🔥 [디벨롭] BYE 매치일 때 저장 버튼 텍스트 변경 */}
                  <button 
                    onClick={() => onSave(match.id, inputs.homeScore, inputs.awayScore, inputs.youtube, records, manualWinner)} 
                    className={`w-full py-4 rounded-xl font-black text-lg shadow-lg transition-all active:scale-95 ${isByeMatch ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30 text-white' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20 text-white'}`}
                  >
                    {isByeMatch ? '🚀 부전승 확정 및 진출' : 'SAVE RESULT'}
                  </button>
              </div>

              {/* Away */}
              <div className={`bg-slate-950 p-4 rounded-2xl border ${isAwayBye ? 'border-slate-800 opacity-50' : 'border-slate-700'}`}>
                  <div className="flex flex-col items-center mb-4">
                      <div className={`w-20 h-20 mb-3 rounded-full flex items-center justify-center p-3 shadow-xl shrink-0 ${isAwayBye ? 'bg-slate-800' : 'bg-white'}`}>
                          <img src={getSafeLogo(match.away, match.awayLogo)} className="max-w-full max-h-full object-contain" alt="" />
                      </div>
                      <span className="font-bold text-white">{match.away}</span>
                  </div>
                  {!isAwayBye && (
                      <>
                          <datalist id="awayTeamPlayers">{teamPlayers(match.away).map((name, i) => <option key={i} value={name} />)}</datalist>
                          <div className="space-y-4">
                              <RecordInput type="awayScorer" inputValue={recordInput.awayScorer} onInputChange={(t,f,v)=>setRecordInput(p=>({...p,[t]:{...(p as any)[t],[f]:v}}))} onAdd={()=>handleRecordAdd('awayScorer','awayScorers')} onRemove={(t,id)=>handleRecordRemove('awayScorers',id,false)} records={records.awayScorers} label="⚽ Scorers" colorClass="text-emerald-400" datalistId="awayTeamPlayers" />
                              <RecordInput type="awayAssist" inputValue={recordInput.awayAssist} onInputChange={(t,f,v)=>setRecordInput(p=>({...p,[t]:{...(p as any)[t],[f]:v}}))} onAdd={()=>handleRecordAdd('awayAssist','awayAssists')} onRemove={(t,id)=>handleRecordRemove('awayAssists',id,false)} records={records.awayAssists} label="🅰️ Assists" colorClass="text-blue-400" datalistId="awayTeamPlayers" />
                          </div>
                      </>
                  )}
              </div>
          </div>
       </div>
    </div>
  );
};