/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Match, FALLBACK_IMG } from '../types';
import { RecordInput } from './RecordInput'; 
import { db } from '../firebase'; 
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { Lock, MessageSquare, Edit3, Send, Youtube, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

interface MatchEditModalProps {
  match: Match;
  onClose: () => void;
  onSave: (matchId: string, hScore: string, aScore: string, yt: string, records: any, manualWinner: 'HOME'|'AWAY'|null) => void;
  isTournament: boolean;
  teamPlayers: (team: string) => string[];
}

export const MatchEditModal = ({ match, onClose, onSave, isTournament, teamPlayers }: MatchEditModalProps) => {
  const { authUser: user } = useAuth();

  const [activeTab, setActiveTab] = useState<'TALK' | 'RECORD'>('TALK');

  const [inputs, setInputs] = useState({ homeScore: match.homeScore || '0', awayScore: match.awayScore || '0', youtube: match.youtubeUrl || '' });
  const [records, setRecords] = useState({
      homeScorers: match.homeScorers || [], awayScorers: match.awayScorers || [],
      homeAssists: match.homeAssists || [], awayAssists: match.awayAssists || []
  });
  const [recordInput, setRecordInput] = useState({ homeScorer:{name:'',count:'1'}, awayScorer:{name:'',count:'1'}, homeAssist:{name:'',count:'1'}, awayAssist:{name:'',count:'1'} });
  const [manualWinner, setManualWinner] = useState<'HOME' | 'AWAY' | null>(null);

  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState(false); 

  const labelUpper = (match.matchLabel || '').toUpperCase();
  const stageUpper = (match.stage || '').toUpperCase();
  const isGroupStage = labelUpper.includes('GROUP') || stageUpper.includes('GROUP');
  const effectiveIsTournament = isTournament && !isGroupStage;

  const isHomeBye = match.home === 'BYE';
  const isAwayBye = match.away === 'BYE';
  const isByeMatch = isHomeBye || isAwayBye;

  const hasRecordPermission = useMemo(() => {
      if (!user) return false;
      if (user.role === 'ADMIN') return true;
      return match.homeOwner === user.mappedOwnerId || match.awayOwner === user.mappedOwnerId;
  }, [user, match]);

  let rawHomeRate = match.homePredictRate !== undefined ? Number(match.homePredictRate) : 50;
  let rawAwayRate = match.awayPredictRate !== undefined ? Number(match.awayPredictRate) : 50;
  if (rawHomeRate <= 1 && (rawHomeRate > 0 || rawAwayRate > 0)) { rawHomeRate *= 100; rawAwayRate *= 100; }
  const homeRate = Math.round(rawHomeRate);
  const awayRate = Math.round(rawAwayRate);

  useEffect(() => {
      if (isAwayBye) setManualWinner('HOME');
      if (isHomeBye) setManualWinner('AWAY');
  }, [isAwayBye, isHomeBye]);

  useEffect(() => {
      if (!match.id) return;
      const q = query(collection(db, 'match_comments'), where('matchId', '==', match.id));
      
      const unsubscribe = onSnapshot(q, (snap) => {
          const dbComments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          dbComments.sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));
          setComments(dbComments);
          setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });
      return () => unsubscribe();
  }, [match.id]);

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

  const handleSendComment = async () => {
      const txt = newComment.trim();
      if (!txt || !user || isSending) return; 
      
      setIsSending(true);

      try {
          await addDoc(collection(db, 'match_comments'), {
              matchId: match.id,
              authorId: user.uid,
              authorName: user.mappedOwnerId,
              text: txt,
              createdAt: Date.now() 
          });
          setNewComment('');
      } catch (e) {
          console.error("댓글 등록 실패:", e);
      } finally {
          setIsSending(false);
      }
  };

  const formatTime = (ts: any) => {
      if (!ts) return '';
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const latestComment = comments.length > 0 ? comments[comments.length - 1] : null;

  let winnerName = '';
  if (Number(inputs.homeScore) > Number(inputs.awayScore)) winnerName = match.home;
  else if (Number(inputs.awayScore) > Number(inputs.homeScore)) winnerName = match.away;
  else winnerName = manualWinner === 'HOME' ? match.home : manualWinner === 'AWAY' ? match.away : '무승부';

  let commentary = '';
  if (winnerName === '무승부') commentary = "팽팽한 접전 끝에 무승부로 경기가 종료되었습니다.";
  else commentary = `"✨ 오늘 경기의 주인공은 단연 ${winnerName}입니다."`;

  return (
    <div className="fixed inset-0 h-full w-full bg-black/95 flex flex-col justify-end sm:justify-center items-center z-[9999] p-0 sm:p-4 backdrop-blur-sm overflow-hidden">
       
       <div className="bg-[#0f172a] w-full sm:max-w-2xl flex flex-col rounded-t-[20px] sm:rounded-[24px] shadow-2xl overflow-hidden h-[92dvh] sm:h-auto sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 relative">
          
          <button onClick={onClose} className="absolute top-3 right-3 sm:top-4 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full text-lg transition-colors z-50">✕</button>
          
          {/* 팝업 상단 전광판 영역 */}
          <div className="bg-[#0B1120] p-3 sm:p-5 pt-5 sm:pt-6 relative shrink-0 border-b border-slate-800">
              <div className="text-center mb-3 sm:mb-5">
                  <h3 className="text-[14px] sm:text-[18px] font-black text-white italic tracking-tighter drop-shadow-md">{match.matchLabel}</h3>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{match.stage}</p>
              </div>

              <div className="flex items-center justify-center gap-3 sm:gap-8 w-full max-w-lg mx-auto relative">
                  {/* Home */}
                  <div className={`flex flex-col items-center flex-1 w-0 ${isHomeBye ? 'opacity-30' : ''}`}>
                      <div className="w-[50px] h-[50px] sm:w-[70px] sm:h-[70px] mb-1 sm:mb-2 rounded-full flex items-center justify-center p-1.5 sm:p-2 bg-white shadow-xl relative border border-slate-800/50">
                          <img src={getSafeLogo(match.home, match.homeLogo)} className="w-full h-full object-contain drop-shadow-sm" alt="" />
                          { effectiveIsTournament && <span className="absolute -bottom-1 -right-1 bg-orange-600 border border-[#0B1120] text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg">T</span>}
                      </div>
                      <span className="font-black text-white text-[12px] sm:text-[15px] text-center leading-tight italic uppercase tracking-tight break-keep">{match.home}</span>
                      <span className="text-[9px] text-emerald-500 font-bold mt-1.5 truncate max-w-full bg-emerald-950/50 border border-emerald-800/50 px-1.5 py-0.5 rounded">{match.homeOwner || '-'}</span>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pb-4 sm:pb-6">
                      <div className="w-11 h-12 sm:w-14 sm:h-16 bg-black rounded-lg sm:rounded-xl border border-slate-800 flex items-center justify-center shadow-inner">
                          <span className="text-2xl sm:text-3xl font-black text-white italic">{isByeMatch ? '0' : inputs.homeScore}</span>
                      </div>
                      <span className="text-slate-600 text-lg sm:text-xl font-black mb-1">:</span>
                      <div className="w-11 h-12 sm:w-14 sm:h-16 bg-black rounded-lg sm:rounded-xl border border-slate-800 flex items-center justify-center shadow-inner">
                          <span className="text-2xl sm:text-3xl font-black text-emerald-400 italic">{isByeMatch ? '0' : inputs.awayScore}</span>
                      </div>
                  </div>

                  {/* Away */}
                  <div className={`flex flex-col items-center flex-1 w-0 ${isAwayBye ? 'opacity-30' : ''}`}>
                      <div className="w-[50px] h-[50px] sm:w-[70px] sm:h-[70px] mb-1 sm:mb-2 rounded-full flex items-center justify-center p-1.5 sm:p-2 bg-white shadow-xl relative border border-slate-800/50">
                          <img src={getSafeLogo(match.away, match.awayLogo)} className="w-full h-full object-contain drop-shadow-sm" alt="" />
                          { effectiveIsTournament && <span className="absolute -bottom-1 -right-1 bg-orange-600 border border-[#0B1120] text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg">T</span>}
                      </div>
                      <span className="font-black text-white text-[12px] sm:text-[15px] text-center leading-tight italic uppercase tracking-tight break-keep">{match.away}</span>
                      <span className="text-[9px] text-blue-500 font-bold mt-1.5 truncate max-w-full bg-blue-950/50 border border-blue-800/50 px-1.5 py-0.5 rounded">{match.awayOwner || '-'}</span>
                  </div>
              </div>

              {/* Scorers List */}
              {(records.homeScorers.length > 0 || records.awayScorers.length > 0) && (
                  <div className="flex justify-center items-center gap-2.5 sm:gap-4 mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-slate-800/60 max-w-[280px] sm:max-w-md mx-auto">
                      <div className="flex flex-wrap justify-end gap-x-1 gap-y-0 flex-1 items-center">
                          {records.homeScorers.map((s:any, idx:number) => (
                              <span key={idx} className="text-[9px] sm:text-[11px] text-slate-300 font-medium italic break-keep text-right whitespace-nowrap leading-tight">
                                  {s.name}{s.count > 1 ? `(${s.count})` : ''} ⚽
                              </span>
                          ))}
                      </div>
                      <div className="w-px bg-slate-700 h-full min-h-[12px] sm:min-h-[16px]"></div>
                      <div className="flex flex-wrap gap-x-1 gap-y-0 flex-1 items-center">
                          {records.awayScorers.map((s:any, idx:number) => (
                              <span key={idx} className="text-[9px] sm:text-[11px] text-slate-300 font-medium italic break-keep text-left whitespace-nowrap leading-tight">
                                  ⚽ {s.name}{s.count > 1 ? `(${s.count})` : ''}
                              </span>
                          ))}
                      </div>
                  </div>
              )}

              {/* Win Rate Bar */}
              {!isByeMatch && (
                  <div className="mt-3.5 sm:mt-4 px-1 sm:px-8 w-full max-w-xl mx-auto">
                      <div className="flex justify-between items-center mb-1 font-black">
                          <span className="text-emerald-400 text-[9px] sm:text-[11px]">{homeRate}%</span>
                          <span className="text-slate-500 tracking-widest text-[8px] italic">예상승률(%)</span>
                          <span className="text-blue-400 text-[9px] sm:text-[11px]">{awayRate}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full flex overflow-hidden relative shadow-inner border border-slate-700/50">
                          <div style={{ width: `${homeRate}%` }} className="bg-emerald-500 h-full transition-all duration-1000"></div>
                          <div style={{ width: `${awayRate}%` }} className="bg-blue-600 h-full transition-all duration-1000"></div>
                          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[12px] h-[12px] bg-slate-900 rounded-full flex items-center justify-center border border-slate-800 z-10 leading-none pb-[1px]">
                              <Zap size={7} className="text-yellow-400 fill-yellow-400" />
                          </div>
                      </div>
                  </div>
              )}

              {/* Commentary */}
              {match.status === 'COMPLETED' && (
                  <div className="mt-3 sm:mt-4 px-2 sm:px-8 w-full max-w-xl mx-auto">
                      <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-md py-1.5 px-3 flex justify-center items-center gap-1.5 shadow-sm">
                          <span className="text-emerald-500 text-[8px] font-bold tracking-widest uppercase">Result</span>
                          <span className="text-slate-500 text-[8px]">|</span>
                          <p className="text-white font-bold text-[10px] sm:text-[11px] italic tracking-tight">
                              {commentary.split(winnerName).map((part, i, arr) => (
                                  <React.Fragment key={i}>
                                      {part}
                                      {i < arr.length - 1 && <span className="text-emerald-400">{winnerName}</span>}
                                  </React.Fragment>
                              ))}
                          </p>
                      </div>
                  </div>
              )}
          </div>

          {/* ==========================================
              2. 권한 탭 네비게이션
          ========================================== */}
          <div className="flex bg-[#0B1120] border-b border-slate-800 shrink-0 relative z-20">
              <button onClick={() => setActiveTab('TALK')} className={`flex-1 py-2 sm:py-2.5 text-[11px] sm:text-[12px] font-black flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'TALK' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-900/10' : 'text-slate-500 hover:text-slate-300'}`}>
                  <MessageSquare size={13} /> 매치 톡 <span className="bg-slate-800 text-white text-[8px] px-1.5 py-[1px] rounded-md">{comments.length}</span>
              </button>
              <button onClick={() => setActiveTab('RECORD')} className={`flex-1 py-2 sm:py-2.5 text-[11px] sm:text-[12px] font-black flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'RECORD' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-900/10' : 'text-slate-500 hover:text-slate-300'}`}>
                  {hasRecordPermission ? <Edit3 size={13} /> : <Lock size={13} />} 기록실
              </button>
          </div>

          {/* ==========================================
              3. 하단 컨텐츠 영역
          ========================================== */}
          <div className="flex-1 min-h-0 bg-slate-900 flex flex-col relative z-10 w-full overflow-hidden">
              
              {/* 🔥 탭 1: 매치 톡 (댓글) 영역 */}
              {activeTab === 'TALK' && (
                  <div className="flex flex-col h-full w-full overflow-hidden">
                      
                      {/* 🔥 [픽스] 모달 내부 최신 댓글 티커 공간 확보 */}
                      {latestComment && (
                          <div className="p-2 sm:p-3 border-b border-slate-800/50 shrink-0">
                              <div className="bg-[#0B1120] border border-slate-700/60 rounded-md px-2 py-1.5 flex items-center gap-1.5 w-full shadow-inner">
                                  <MessageSquare size={10} className="text-emerald-500 shrink-0" />
                                  <div className="text-[9px] font-black text-emerald-400 shrink-0 max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap pr-1">{latestComment.authorName}</div>
                                  <div className="text-[10px] text-slate-300 flex-1 font-medium line-clamp-1 break-all">{latestComment.text}</div>
                              </div>
                          </div>
                      )}

                      {/* 댓글 리스트 */}
                      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2 min-h-0 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                          {comments.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
                                  <MessageSquare size={20} className="mb-1.5" />
                                  <p className="text-[10px] font-bold">이 경기의 첫 번째 관전평을 남겨보세요!</p>
                              </div>
                          ) : (
                              comments.map(c => {
                                  const isMe = c.authorId === user?.uid;
                                  return (
                                      <div key={c.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                          <div className="flex items-center gap-1 mb-0.5 mx-1">
                                              <span className={`text-[8px] font-black ${c.authorId === 'guest' ? 'text-slate-400' : 'text-emerald-400'}`}>{c.authorName}</span>
                                              <span className="text-[7px] text-slate-500">{formatTime(c.createdAt)}</span>
                                          </div>
                                          <div className={`px-2.5 py-1.5 rounded-lg w-max max-w-[90%] border shadow-sm ${isMe ? 'bg-emerald-900/20 border-emerald-800/30 rounded-tr-none' : 'bg-slate-800/50 border-slate-700/50 rounded-tl-none'}`}>
                                              <p className="text-slate-200 text-[11px] sm:text-[12px] break-words font-medium tracking-tight">{c.text}</p>
                                          </div>
                                      </div>
                                  );
                              })
                          )}
                          <div ref={commentsEndRef} className="h-1" />
                      </div>

                      {/* 댓글 입력 폼 */}
                      <div className="shrink-0 p-2 sm:p-3 border-t border-slate-800 bg-[#0B1120] pb-safe">
                          {!user ? (
                              <div className="text-center text-slate-500 text-[10px] py-2 bg-slate-900 rounded-md border border-slate-800 font-bold tracking-tight">
                                  로그인 후 매치톡을 이용할 수 있습니다.
                              </div>
                          ) : (
                              <div className="flex flex-col gap-1.5 w-full">
                                  <div className="text-[8px] sm:text-[9px] text-emerald-500 font-bold px-1 italic">
                                      {user.mappedOwnerId} 님으로 작성 중...
                                  </div>
                                  <div className="flex gap-1.5 items-center w-full">
                                      <input 
                                          value={newComment} 
                                          onChange={e => setNewComment(e.target.value)} 
                                          onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) handleSendComment(); }}
                                          placeholder={isSending ? "전송 중..." : "응원과 채팅을 남겨주세요!"} 
                                          disabled={isSending}
                                          className="flex-1 min-w-0 bg-[#0f172a] border border-slate-700 text-white text-[12px] px-3 py-2 rounded-lg outline-none focus:border-emerald-500 shadow-inner placeholder:font-medium placeholder:text-slate-600 disabled:opacity-60" 
                                      />
                                      <button 
                                          onClick={handleSendComment} 
                                          disabled={isSending || !newComment.trim()}
                                          className="bg-emerald-600 hover:bg-emerald-500 text-white w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-all shadow-md active:scale-95 disabled:bg-slate-700 disabled:text-slate-500 disabled:scale-100"
                                      >
                                          {isSending ? <div className="w-3 h-3 border-2 border-slate-500 border-t-white rounded-full animate-spin"></div> : <Send size={14} />}
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {/* 🔥 탭 2: 기록실 영역 (변경 없음) */}
              {activeTab === 'RECORD' && (
                  <div className="flex flex-col h-full w-full overflow-hidden">
                      <div className="flex-1 overflow-y-auto p-3 sm:p-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                          {!hasRecordPermission ? (
                              <div className="flex flex-col items-center justify-center h-full text-slate-500 pt-8 pb-8">
                                  <div className="w-[40px] h-[40px] bg-slate-800 rounded-full flex items-center justify-center mb-3 shadow-inner border border-slate-700">
                                      <Lock size={20} className="text-slate-400" />
                                  </div>
                                  <h3 className="text-[13px] sm:text-[14px] font-black text-slate-300 mb-1">기록 열람 및 수정 불가</h3>
                                  <p className="text-[9px] sm:text-[10px] text-slate-500 text-center leading-relaxed max-w-[220px]">
                                      해당 경기의 출전 오너 <strong className="text-emerald-400">{match.homeOwner}</strong>님, <strong className="text-blue-400">{match.awayOwner}</strong>님<br/>
                                      또는 <strong className="text-white">마스터(ADMIN)</strong>만 이 곳에 접근할 수 있습니다.
                                  </p>
                              </div>
                          ) : (
                              <div className="space-y-4 animate-in fade-in pb-2">
                                  {isByeMatch ? (
                                      <div className="flex flex-col items-center gap-1.5 w-full bg-blue-900/20 p-3 rounded-lg border border-blue-500/50">
                                          <div className="text-center animate-pulse">
                                              <p className="text-[12px] text-blue-300 font-black mb-1 tracking-widest">🎉 부전승 (BYE) 매치</p>
                                              <p className="text-[9px] text-blue-200 font-medium leading-normal break-keep">
                                                  아래 저장 버튼을 누르면 <strong className="text-white bg-blue-600 px-1 py-0.5 rounded">{isAwayBye ? match.home : match.away}</strong> 팀이 진출합니다.
                                              </p>
                                          </div>
                                      </div>
                                  ) : (
                                      <>
                                          <div className="bg-[#0B1120] p-3 rounded-lg border border-slate-800 flex flex-col items-center shadow-inner">
                                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Final Score</span>
                                              <div className="flex items-center gap-3">
                                                  <div className="text-center">
                                                      <span className="text-[8px] text-emerald-400 font-bold block mb-0.5">HOME</span>
                                                      <input type="number" value={inputs.homeScore} onChange={e=>setInputs({...inputs, homeScore:e.target.value})} className="w-12 h-12 text-center text-2xl font-black bg-slate-950 rounded-md border border-slate-700 text-white focus:border-emerald-500 outline-none transition-colors" />
                                                  </div>
                                                  <span className="text-slate-600 text-lg font-black">:</span>
                                                  <div className="text-center">
                                                      <span className="text-[8px] text-blue-400 font-bold block mb-0.5">AWAY</span>
                                                      <input type="number" value={inputs.awayScore} onChange={e=>setInputs({...inputs, awayScore:e.target.value})} className="w-12 h-12 text-center text-2xl font-black bg-slate-950 rounded-md border border-slate-700 text-white focus:border-blue-500 outline-none transition-colors" />
                                                  </div>
                                              </div>
                                              
                                              {effectiveIsTournament && Number(inputs.homeScore) === Number(inputs.awayScore) && inputs.homeScore !== '' && (
                                                  <div className="bg-red-900/40 p-2 rounded-md border border-red-500/50 text-center animate-pulse w-full max-w-[200px] mt-3">
                                                      <p className="text-[8px] text-red-300 font-bold mb-1.5 tracking-widest leading-tight">⚠️ 승부차기 승리 팀 선택</p>
                                                      <div className="flex gap-1.5 justify-center">
                                                          <button onClick={()=>setManualWinner('HOME')} className={`flex-1 py-1 text-[9px] font-bold rounded border transition-all ${manualWinner==='HOME'?'bg-red-600 text-white border-red-400':'bg-black text-red-400 border-red-800'}`}>HOME 승</button>
                                                          <button onClick={()=>setManualWinner('AWAY')} className={`flex-1 py-1 text-[9px] font-bold rounded border transition-all ${manualWinner==='AWAY'?'bg-red-600 text-white border-red-400':'bg-black text-red-400 border-red-800'}`}>AWAY 승</button>
                                                      </div>
                                                  </div>
                                              )}
                                          </div>

                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                                              <div className="bg-slate-950 p-2.5 sm:p-3 rounded-lg border border-slate-800">
                                                  <h4 className="text-[10px] font-black text-white border-b border-slate-800 pb-1.5 mb-2.5 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> HOME 기록</h4>
                                                  <datalist id="homeTeamPlayers">{teamPlayers(match.home).map((name, i) => <option key={i} value={name} />)}</datalist>
                                                  <div className="space-y-3">
                                                      <RecordInput type="homeScorer" inputValue={recordInput.homeScorer} onInputChange={(t,f,v)=>setRecordInput(p=>({...p,[t]:{...(p as any)[t],[f]:v}}))} onAdd={()=>handleRecordAdd('homeScorer','homeScorers')} onRemove={(t,id)=>handleRecordRemove('homeScorers',id,true)} records={records.homeScorers} label="⚽ Scorers" colorClass="text-emerald-400" datalistId="homeTeamPlayers" />
                                                      <RecordInput type="homeAssist" inputValue={recordInput.homeAssist} onInputChange={(t,f,v)=>setRecordInput(p=>({...p,[t]:{...(p as any)[t],[f]:v}}))} onAdd={()=>handleRecordAdd('homeAssist','homeAssists')} onRemove={(t,id)=>handleRecordRemove('homeAssists',id,true)} records={records.homeAssists} label="🅰️ Assists" colorClass="text-emerald-400" datalistId="homeTeamPlayers" />
                                                  </div>
                                              </div>
                                              <div className="bg-slate-950 p-2.5 sm:p-3 rounded-lg border border-slate-800">
                                                  <h4 className="text-[10px] font-black text-white border-b border-slate-800 pb-1.5 mb-2.5 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> AWAY 기록</h4>
                                                  <datalist id="awayTeamPlayers">{teamPlayers(match.away).map((name, i) => <option key={i} value={name} />)}</datalist>
                                                  <div className="space-y-3">
                                                      <RecordInput type="awayScorer" inputValue={recordInput.awayScorer} onInputChange={(t,f,v)=>setRecordInput(p=>({...p,[t]:{...(p as any)[t],[f]:v}}))} onAdd={()=>handleRecordAdd('awayScorer','awayScorers')} onRemove={(t,id)=>handleRecordRemove('awayScorers',id,false)} records={records.awayScorers} label="⚽ Scorers" colorClass="text-blue-400" datalistId="awayTeamPlayers" />
                                                      <RecordInput type="awayAssist" inputValue={recordInput.awayAssist} onInputChange={(t,f,v)=>setRecordInput(p=>({...p,[t]:{...(p as any)[t],[f]:v}}))} onAdd={()=>handleRecordAdd('awayAssist','awayAssists')} onRemove={(t,id)=>handleRecordRemove('awayAssists',id,false)} records={records.awayAssists} label="🅰️ Assists" colorClass="text-blue-400" datalistId="awayTeamPlayers" />
                                                  </div>
                                              </div>
                                          </div>
                                      </>
                                  )}

                                  <div className="bg-slate-950 p-2.5 sm:p-3 rounded-lg border border-slate-800">
                                      <label className="text-[8px] text-slate-400 font-bold mb-1.5 block uppercase tracking-widest flex items-center gap-1"><Youtube size={10} className="text-red-500"/> YouTube</label>
                                      <input value={inputs.youtube} onChange={e=>setInputs({...inputs,youtube:e.target.value})} placeholder="URL..." className="w-full bg-[#0B1120] p-2 rounded-md text-[10px] border border-slate-700 text-white focus:border-emerald-500 outline-none transition-colors shadow-inner placeholder:font-medium placeholder:text-slate-600"/>
                                  </div>
                              </div>
                          )}
                      </div>

                      {hasRecordPermission && (
                          <div className="p-2 sm:p-3 bg-[#0B1120] border-t border-slate-800 shrink-0 z-10 pb-safe">
                              <button 
                                onClick={() => onSave(match.id, inputs.homeScore, inputs.awayScore, inputs.youtube, records, manualWinner)} 
                                className={`w-full py-2.5 rounded-lg font-black text-[12px] sm:text-[13px] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 ${isByeMatch ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30 text-white' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30 text-white tracking-widest'}`}
                              >
                                {isByeMatch ? '🚀 부전승 확정 및 다음 라운드 진출' : '저장 완료'}
                              </button>
                          </div>
                      )}
                  </div>
              )}
          </div>
       </div>
    </div>
  );
};