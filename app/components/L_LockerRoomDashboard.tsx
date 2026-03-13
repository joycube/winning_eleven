"use client";

import React, { useState, useMemo } from 'react';
import { CalendarDays, MessageSquare, Flame, ChevronRight, Image as ImageIcon, Clock } from 'lucide-react';
import { FALLBACK_IMG } from '../types';

export default function L_LockerRoomDashboard({ user, notices, seasons, masterTeams, owners, activeSeason, posts, uidDict, setViewMode, setCategory, setSelectedPostId }: any) {
  const [communityTab, setCommunityTab] = useState<'HOT' | 'FREE'>('HOT');
  const [matchTab, setMatchTab] = useState<'UPCOMING' | 'RECENT'>('UPCOMING');

  // --- 유틸 함수 ---
  const getRealLogoLocal = (teamName: string, fallback: string) => {
      if (!teamName) return fallback || FALLBACK_IMG;
      const matched = masterTeams?.find((m: any) => (m.name || '').toLowerCase() === teamName.toLowerCase() || (m.teamName || '').toLowerCase() === teamName.toLowerCase());
      return matched?.logo || fallback || FALLBACK_IMG;
  };

  const getTeamMasterInfo = (teamName: string) => {
      if (!masterTeams || masterTeams.length === 0) return undefined;
      const cleanTarget = teamName.replace(/\s+/g, '').toLowerCase();
      return (masterTeams as any[]).find(t => (t.name || t.teamName || '').replace(/\s+/g, '').toLowerCase() === cleanTarget);
  };

  const getOwnerProfile = (idOrName: string) => {
      const search = idOrName?.toString().trim();
      const found = owners?.find((o:any) => o.docId === search || String(o.id) === search || o.uid === search || o.nickname === search);
      return found?.photo || FALLBACK_IMG;
  };

  const formatDate = (ts: any) => {
      if (!ts) return '방금 전';
      let d = typeof ts === 'number' ? new Date(ts) : new Date(ts.toDate?.() || ts);
      if (isNaN(d.getTime())) return '방금 전';
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // --- 데이터 추출 ---
  const upcomingMatchesList = useMemo(() => {
      const matches: any[] = [];
      const latestSeason = seasons && seasons.length > 0 ? [...seasons].sort((a: any, b: any) => b.id - a.id)[0] : null;
      const currentSeason = activeSeason || latestSeason;
      
      if (currentSeason && currentSeason.rounds) {
          currentSeason.rounds.forEach((r: any) => {
              r.matches?.forEach((m: any) => {
                  const isNotPlayed = m.status === 'SCHEDULED' || m.status === 'PENDING' || (!m.homeScore && !m.awayScore && m.status !== 'COMPLETED');
                  if (isNotPlayed && m.home !== 'BYE' && m.away !== 'BYE') {
                      matches.push({ ...m, matchLabel: r.name }); 
                  }
              });
          });
      }
      return matches.slice(0, 5); 
  }, [activeSeason, seasons]);

  const recentMatchesList = useMemo(() => {
      const matches: any[] = [];
      const latestSeason = seasons && seasons.length > 0 ? [...seasons].sort((a: any, b: any) => b.id - a.id)[0] : null;
      const currentSeason = activeSeason || latestSeason;
      
      if (currentSeason && currentSeason.rounds) {
          currentSeason.rounds.forEach((r: any) => {
              r.matches?.forEach((m: any) => {
                  if (m.status === 'COMPLETED' && m.home !== 'BYE' && m.away !== 'BYE') {
                      matches.push({ ...m, matchLabel: r.name }); 
                  }
              });
          });
      }
      return matches.reverse().slice(0, 5); 
  }, [activeSeason, seasons]);

  const liveTickerData = useMemo(() => {
      let allComments: any[] = [];
      posts.forEach((p: any) => {
          if (p.comments && Array.isArray(p.comments)) {
              allComments = [...allComments, ...p.comments];
          }
      });
      allComments.sort((a, b) => b.createdAt - a.createdAt);
      
      const recent = allComments.slice(0, 10).map(c => ({
          name: c.authorName || c.ownerName || '익명',
          uid: c.authorUid || c.ownerUid || c.authorName || c.ownerName,
          text: c.text?.startsWith('[STICKER]') ? '(스티커를 보냈습니다 ✨)' : c.text,
      }));

      if (recent.length === 0) {
          return owners?.slice(0, 3).map((o:any) => ({ name: o.nickname, uid: o.uid, text: "오늘 경기 화이팅입니다! 🔥" })) || [];
      }
      return recent;
  }, [posts, owners]);

  const hotPosts = [...posts].sort((a, b) => (b.views || 0) + ((b.comments?.length || 0) * 2) - ((a.views || 0) + ((a.comments?.length || 0) * 2))).slice(0, 5);

  // --- 🔥 네비게이션 핸들러 (에러 박멸) ---
  const handlePostClick = (post: any) => {
      setSelectedPostId(post.id);
      setViewMode('LIST');
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'LOCKERROOM'); params.set('postId', post.id);
      window.history.pushState(null, '', `?${params.toString()}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScheduleClick = () => {
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'SCHEDULE');
      // 루트('/')를 붙이지 않아 메인 메뉴로 튕기는 버그를 원천 차단
      window.history.pushState(null, '', `?${params.toString()}`);
      window.dispatchEvent(new Event('popstate'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMatchTalkClick = (m: any) => {
      const matchId = m.id || m.matchId || `match_${m.home}_${m.away}`;
      // 상태 즉각 업데이트 (화면 깜빡임 제로)
      setSelectedPostId(matchId);
      setViewMode('LIST');
      
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'LOCKERROOM'); params.set('postId', matchId);
      window.history.pushState(null, '', `?${params.toString()}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- 컴포넌트 렌더러 ---
  const renderTierBadge = (tier?: string) => {
      const t = (tier || 'C').toUpperCase();
      const colors = t === 'S' ? 'bg-yellow-500 text-black shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 
                     t === 'A' ? 'bg-slate-300 text-black' : 
                     t === 'B' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300';
      return <span className={`px-1 py-[1px] rounded-[3px] text-[8px] font-black leading-none ${colors}`}>{t}</span>;
  };

  const renderRankCondition = (rank?: number, condition?: string) => {
      const rColors = rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-orange-400' : 'text-slate-400';
      const cConfig: any = { 'A': '↑', 'B': '↗', 'C': '→', 'D': '↘', 'E': '⬇' };
      const cColor: any = { 'A': 'text-emerald-400', 'B': 'text-teal-400', 'C': 'text-slate-400', 'D': 'text-orange-400', 'E': 'text-red-500' };
      const cond = condition?.toUpperCase() || 'C';
      
      return (
          <div className="flex items-center gap-1 text-[9px] font-black bg-slate-950 px-1.5 py-[2px] rounded border border-slate-700/50 shadow-inner shrink-0">
              {rank && rank > 0 ? <span className={rColors}>R.{rank}</span> : <span className="text-slate-600">R.-</span>}
              <span className={cColor[cond]}>{cConfig[cond]}</span>
          </div>
      );
  };

  const renderMatchRow = (m: any, isRecent: boolean) => {
      const homeMaster = getTeamMasterInfo(m.home);
      const awayMaster = getTeamMasterInfo(m.away);
      const hRate = Number(m.homePredictRate) > 0 ? Number(m.homePredictRate) : 50;
      const aRate = Number(m.awayPredictRate) > 0 ? Number(m.awayPredictRate) : 50;

      return (
          <div className="flex flex-col bg-slate-900/40 relative hover:bg-slate-800/40 transition-colors group cursor-pointer">
              {/* 🔥 매치 본체 영역 (누르면 스케줄 탭으로 이동) */}
              <div onClick={handleScheduleClick} className="flex justify-between items-center px-2 py-5 sm:px-6 sm:py-6">
                  {/* HOME (우측 정렬) */}
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 justify-end min-w-0">
                      <div className="flex flex-col items-end gap-1 min-w-0">
                          <span className="text-[13px] sm:text-[15px] font-black text-white truncate max-w-[85px] sm:max-w-[140px] leading-none">{m.home}</span>
                          <div className="flex items-center gap-1 mt-1">
                              {renderTierBadge(homeMaster?.tier)}
                              {renderRankCondition(homeMaster?.real_rank, homeMaster?.condition)}
                          </div>
                      </div>
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full p-1.5 shadow-md shrink-0">
                          <img src={getRealLogoLocal(m.home, m.homeLogo)} className="w-full h-full object-contain" alt="" onError={(e:any)=>{e.target.src=FALLBACK_IMG}} />
                      </div>
                  </div>
                  
                  {/* CENTER (VS / 스코어 / 개별 스케줄 버튼) */}
                  <div className="w-[80px] sm:w-[100px] shrink-0 flex flex-col items-center justify-center px-1">
                      <span className="text-[9px] text-slate-500 font-bold mb-1.5 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 uppercase tracking-widest text-center line-clamp-1">{m.matchLabel || 'MATCH'}</span>
                      {isRecent ? (
                          <div className="flex items-center gap-1.5 text-[20px] sm:text-[24px] font-black italic tracking-tighter leading-none">
                              <span className={Number(m.homeScore) > Number(m.awayScore) ? 'text-emerald-400' : 'text-slate-200'}>{m.homeScore}</span>
                              <span className="text-slate-600 text-sm">:</span>
                              <span className={Number(m.awayScore) > Number(m.homeScore) ? 'text-emerald-400' : 'text-slate-200'}>{m.awayScore}</span>
                          </div>
                      ) : (
                          <span className="text-[12px] sm:text-[14px] font-black text-slate-600 italic">VS</span>
                      )}
                      
                      <button className="mt-2.5 flex items-center justify-center gap-1 text-[9px] sm:text-[10px] font-bold text-slate-400 group-hover:text-white bg-slate-800 px-2 py-1 rounded-md transition-colors border border-slate-700 shadow-sm w-max whitespace-nowrap">
                          <CalendarDays size={10} className="text-blue-400" /> 스케줄 이동
                      </button>
                  </div>

                  {/* AWAY (좌측 정렬) */}
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 justify-start min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full p-1.5 shadow-md shrink-0">
                          <img src={getRealLogoLocal(m.away, m.awayLogo)} className="w-full h-full object-contain" alt="" onError={(e:any)=>{e.target.src=FALLBACK_IMG}} />
                      </div>
                      <div className="flex flex-col items-start gap-1 min-w-0">
                          <span className="text-[13px] sm:text-[15px] font-black text-white truncate max-w-[85px] sm:max-w-[140px] leading-none">{m.away}</span>
                          <div className="flex items-center gap-1 mt-1">
                              {renderRankCondition(awayMaster?.real_rank, awayMaster?.condition)}
                              {renderTierBadge(awayMaster?.tier)}
                          </div>
                      </div>
                  </div>
              </div>

              {/* 예상승률 얇은 바 (UPCOMING일 때만) */}
              {!isRecent && (
                  <div className="px-8 sm:px-12 pb-4 flex flex-col gap-1 w-full max-w-[320px] mx-auto opacity-80 pointer-events-none">
                      <div className="flex justify-between text-[8px] font-black px-1">
                          <span className="text-emerald-500">{hRate}%</span>
                          <span className="text-slate-600 tracking-widest uppercase scale-90">WIN PROBABILITY</span>
                          <span className="text-blue-500">{aRate}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full flex overflow-hidden">
                          <div style={{ width: `${hRate}%` }} className="h-full bg-emerald-500" />
                          <div style={{ width: `${aRate}%` }} className="h-full bg-blue-500" />
                      </div>
                  </div>
              )}

              {/* 🔥 RECENT 탭 전용: 실제 매치톡 데이터 부착형 UI (누르면 매치톡으로 이동) */}
              {isRecent && (() => {
                  const matchPostId = m.id ? `match_${m.id}` : `match_${m.home}_${m.away}`;
                  const targetPost = posts.find((p:any) => p.id === matchPostId);
                  const targetComments = targetPost?.comments || targetPost?.replies || [];
                  const latestComment = targetComments.length > 0 ? [...targetComments].sort((a,b) => b.createdAt - a.createdAt)[0] : null;

                  return (
                      <div onClick={(e) => { e.stopPropagation(); handleMatchTalkClick(m); }} className="bg-[#080d1a] border-t border-slate-800/80 py-3 px-4 sm:px-6 cursor-pointer hover:bg-slate-800/80 transition-colors flex items-center justify-between group/talk">
                          {latestComment ? (
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <img src={getOwnerProfile(latestComment.ownerUid || latestComment.authorUid, latestComment.ownerName || latestComment.authorName)} className="w-5 h-5 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0" alt="" onError={(e:any)=>{e.target.src=FALLBACK_IMG}} />
                                  <div className="flex items-baseline gap-1.5 min-w-0">
                                      <span className="text-[10px] font-black text-blue-400 shrink-0">{latestComment.ownerName || latestComment.authorName}</span>
                                      <span className="text-[11px] text-slate-300 font-medium truncate">
                                          {latestComment.text?.startsWith('[STICKER]') ? '(스티커를 보냈습니다 ✨)' : latestComment.text}
                                      </span>
                                  </div>
                              </div>
                          ) : (
                              <div className="flex items-center gap-2 min-w-0 flex-1 opacity-70 group-hover/talk:opacity-100 transition-opacity">
                                  <MessageSquare size={12} className="text-slate-500 shrink-0" />
                                  <span className="text-[10px] font-bold text-slate-400 truncate">가장 먼저 매치톡을 남겨보세요!</span>
                              </div>
                          )}
                          <div className="flex items-center text-[9px] font-black text-slate-500 group-hover/talk:text-blue-400 transition-colors shrink-0 pl-3">
                              매치톡 입장 <ChevronRight size={12} className="ml-0.5" />
                          </div>
                      </div>
                  );
              })()}
          </div>
      );
  };

  return (
      <div className="animate-in fade-in pb-10 mt-2 text-left overflow-x-hidden">
          <style jsx>{`
              .no-scrollbar::-webkit-scrollbar { display: none; }
              .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
              @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
              .ticker-track { display: flex; width: max-content; animation: ticker 35s linear infinite; }
              .ticker-track:hover { animation-play-state: paused; }
          `}</style>

          {/* 1. 공지사항 */}
          {notices && notices.length > 0 && (
              <div className="bg-[#0f172a] rounded-2xl border border-slate-800 shadow-xl overflow-hidden divide-y divide-slate-800/50 mb-6">
                  {notices.slice(0, 3).map((notice: any) => (
                      <div key={notice.id} onClick={() => handlePostClick(notice)} className="flex items-center p-3 sm:p-4 hover:bg-slate-800/40 transition-colors cursor-pointer group">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className="bg-slate-800/80 border border-slate-700/80 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded shrink-0 shadow-inner">공지</span>
                              <span className="text-slate-100 font-bold text-[13px] sm:text-[14px] truncate group-hover:text-emerald-400 transition-colors pr-1">{notice.title}</span>
                          </div>
                      </div>
                  ))}
              </div>
          )}

          {/* 2. 리그 커뮤니티 */}
          <div className="mb-6">
              <div className="flex items-center justify-between mb-4 px-1">
                  <h3 className="text-sm font-black text-white italic tracking-widest uppercase flex items-center gap-2">
                      <Flame size={16} className="text-orange-500" /> LEAGUE COMMUNITY
                  </h3>
                  <span onClick={() => { setCategory('전체'); setViewMode('LIST'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-[10px] text-slate-500 font-bold uppercase tracking-wider cursor-pointer hover:text-white transition-colors">더보기 &gt;</span>
              </div>
              
              <div className="bg-[#050b14] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="flex border-b border-slate-800 h-[45px] bg-slate-950/50">
                      <button onClick={() => setCommunityTab('HOT')} className={`flex-1 h-full flex justify-center items-center text-[11px] font-black tracking-widest transition-all ${communityTab === 'HOT' ? 'bg-slate-900 text-orange-400 border-b-2 border-orange-400' : 'text-slate-500 hover:text-slate-300'}`}>🔥 HOT</button>
                      <button onClick={() => setCommunityTab('FREE')} className={`flex-1 h-full flex justify-center items-center text-[11px] font-black tracking-widest transition-all ${communityTab === 'FREE' ? 'bg-slate-900 text-white border-b-2 border-white' : 'text-slate-500 hover:text-slate-300'}`}>📝 최신글</button>
                  </div>

                  <div className="p-4">
                      {posts && posts.filter((p:any) => !!p.imageUrl).length > 0 && (
                          <div className="flex overflow-x-auto gap-3 no-scrollbar pb-4 border-b border-slate-800/60 mb-2">
                              {posts.filter((p:any) => !!p.imageUrl).slice(0, 5).map((post:any, i:number) => (
                                  <div key={i} onClick={() => handlePostClick(post)} className="min-w-[130px] w-[130px] shrink-0 flex flex-col gap-2 cursor-pointer group">
                                      <div className="w-full h-[100px] bg-slate-800 rounded-xl overflow-hidden relative border border-slate-700/50 group-hover:border-slate-500 transition-colors">
                                          <img src={post.imageUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="thumbnail" />
                                          <div className="absolute top-1.5 right-1.5 bg-black/60 p-1 rounded text-white"><ImageIcon size={10}/></div>
                                      </div>
                                      <span className="text-[11px] font-bold text-slate-300 truncate leading-tight group-hover:text-white transition-colors pr-1">{post.title}</span>
                                  </div>
                              ))}
                          </div>
                      )}

                      <div className="flex flex-col divide-y divide-slate-800/50">
                          {(communityTab === 'HOT' ? hotPosts : posts.slice(0, 5)).map((post:any, idx:number) => {
                              const ytMatch = post.youtubeUrl?.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([a-zA-Z0-9_-]{11})/);
                              const ytId = post.youtubeId || (ytMatch ? ytMatch[1] : null);
                              const thumbSrc = post.imageUrl || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null);
                              const commentCount = post.comments?.length || 0;
                              const displayNum = communityTab === 'HOT' ? idx + 1 : posts.length - idx;

                              return (
                                  <div key={post.id} onClick={() => handlePostClick(post)} className="flex items-center justify-between py-3 hover:bg-slate-800/40 transition-colors cursor-pointer group px-2">
                                      <div className="flex items-center gap-3 min-w-0 flex-1">
                                          <span className="text-slate-500 font-bold italic text-[14px] w-5 text-center shrink-0">{displayNum}</span>
                                          <div className="flex flex-col min-w-0 flex-1 gap-1">
                                              <div className="flex items-center gap-2 min-w-0">
                                                  <span className="bg-slate-800 border border-slate-700/80 text-slate-300 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">{post.cat}</span>
                                                  <span className="text-slate-200 font-medium text-[14px] truncate pr-1">{post.title}</span>
                                              </div>
                                              <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 ml-[44px]">
                                                  <span>{post.authorName}</span>
                                                  <span className="w-0.5 h-0.5 bg-slate-600 rounded-full"></span>
                                                  <span>조회 {post.views || 0}</span>
                                              </div>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-3 shrink-0 ml-2">
                                          {thumbSrc && <img src={thumbSrc} className="w-11 h-11 rounded-lg object-cover border border-slate-700 block shrink-0" onError={(e: any) => { e.target.style.display = 'none'; }} />}
                                          <div className={`flex flex-col items-center justify-center rounded-xl w-11 h-11 border shrink-0 transition-colors ${commentCount > 0 ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-500'}`}>
                                              <span className="text-[14px] font-black leading-none">{commentCount}</span>
                                              <span className="text-[9px] font-bold mt-0.5">댓글</span>
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              </div>
          </div>

          {/* 3. 매치톡 전광판 */}
          <div onClick={() => { setCategory('매치톡'); setViewMode('LIST'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-gradient-to-r from-[#0B1120] to-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3 cursor-pointer hover:border-slate-600 hover:shadow-lg transition-all mb-8 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 group-hover:bg-blue-400 transition-colors z-20"></div>
              <div className="bg-blue-900/30 p-2 rounded-xl shrink-0 group-hover:scale-110 transition-transform duration-300 z-20 relative">
                  <MessageSquare size={16} className="text-blue-400" />
              </div>
              
              <div className="absolute left-10 w-8 h-full bg-gradient-to-r from-[#0B1120] to-transparent z-10 pointer-events-none"></div>
              <div className="absolute right-12 w-12 h-full bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none"></div>

              <div className="flex-1 overflow-hidden relative flex items-center h-full">
                  <div className="ticker-track">
                      {[...liveTickerData, ...liveTickerData].map((msg, i) => (
                          <div key={i} className="flex items-center shrink-0 mx-4">
                              <div className="flex items-center gap-1.5 mr-2 shrink-0">
                                  <img src={getOwnerProfile(msg.uid, msg.name)} className="w-5 h-5 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0" alt="" onError={(e:any)=>{e.target.src=FALLBACK_IMG}} />
                                  <span className="text-[11px] text-blue-400 font-black whitespace-nowrap shrink-0">{msg.name}:</span>
                              </div>
                              <span className="text-slate-300 text-[12px] font-medium whitespace-nowrap shrink-0">{msg.text}</span>
                              <span className="ml-6 text-slate-700 text-[10px] shrink-0">♦</span>
                          </div>
                      ))}
                  </div>
              </div>
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest shrink-0 bg-slate-800/80 px-2 py-1 rounded z-20 relative">입장</span>
          </div>

          {/* 4. 경기 정보 (UPCOMING / RECENT) */}
          <div className="mb-8">
              <div className="bg-[#050b14] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="flex border-b border-slate-800 h-[45px] bg-slate-950/50">
                      <button onClick={() => setMatchTab('UPCOMING')} className={`flex-1 h-full flex justify-center items-center gap-1.5 text-[11px] font-black tracking-widest transition-all ${matchTab === 'UPCOMING' ? 'bg-slate-900 text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
                          <CalendarDays size={14}/> UPCOMING
                      </button>
                      <button onClick={() => setMatchTab('RECENT')} className={`flex-1 h-full flex justify-center items-center gap-1.5 text-[11px] font-black tracking-widest transition-all ${matchTab === 'RECENT' ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
                          <Clock size={14}/> RECENT
                      </button>
                  </div>

                  <div className="flex flex-col bg-[#050b14]">
                      {(matchTab === 'UPCOMING' ? upcomingMatchesList : recentMatchesList).length > 0 ? (
                          <div className="flex flex-col divide-y divide-slate-800/80">
                              {(matchTab === 'UPCOMING' ? upcomingMatchesList : recentMatchesList).map((match, idx) => (
                                  <React.Fragment key={idx}>
                                      {renderMatchRow(match, matchTab === 'RECENT')}
                                  </React.Fragment>
                              ))}
                          </div>
                      ) : (
                          <div className="bg-slate-900/30 p-8 flex flex-col items-center justify-center text-center">
                              <CalendarDays size={32} className="text-slate-600 mb-2" />
                              <span className="text-xs font-bold text-slate-400">해당하는 매치 기록이 없습니다.</span>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </div>
  );
}