"use client";

import React, { useState, useMemo } from 'react';
import { Megaphone, CalendarDays, MessageSquare, Flame, ChevronRight, Image as ImageIcon, Clock } from 'lucide-react';
import { FALLBACK_IMG } from '../types';
import { MatchCard } from './MatchCard';

export default function L_LockerRoomDashboard({ user, notices, seasons, masterTeams, owners, historyData, activeSeason, posts, uidDict, setViewMode, setCategory, setSelectedPostId, activeRankingData }: any) {
  const [communityTab, setCommunityTab] = useState<'HOT' | 'FREE'>('HOT');
  const [matchTab, setMatchTab] = useState<'UPCOMING' | 'RECENT'>('UPCOMING');

  const getOwnerProfile = (idOrName: string) => {
      const search = idOrName?.toString().trim();
      const found = owners?.find((o:any) => o.docId === search || String(o.id) === search || o.uid === search || o.nickname === search);
      return found?.photo || FALLBACK_IMG;
  };

  // 최신 시즌 기준 업커밍(예정) 매치 5개 추출
  const upcomingMatchesList = useMemo(() => {
      const matches: any[] = [];
      const latestSeason = seasons && seasons.length > 0 ? [...seasons].sort((a: any, b: any) => b.id - a.id)[0] : null;
      const currentSeason = activeSeason || latestSeason;
      
      if (currentSeason && currentSeason.rounds) {
          currentSeason.rounds.forEach((r: any) => {
              r.matches?.forEach((m: any) => {
                  const isNotPlayed = m.status === 'SCHEDULED' || m.status === 'PENDING' || (!m.homeScore && !m.awayScore && m.status !== 'COMPLETED');
                  if (isNotPlayed && m.home !== 'BYE' && m.away !== 'BYE') {
                      matches.push({ ...m, matchLabel: r.name, roundId: r.id }); 
                  }
              });
          });
      }
      return matches.slice(0, 5); 
  }, [activeSeason, seasons]);

  // 최신 시즌 기준 최근 종료된 매치 5개 추출
  const recentMatchesList = useMemo(() => {
      const matches: any[] = [];
      const latestSeason = seasons && seasons.length > 0 ? [...seasons].sort((a: any, b: any) => b.id - a.id)[0] : null;
      const currentSeason = activeSeason || latestSeason;
      
      if (currentSeason && currentSeason.rounds) {
          currentSeason.rounds.forEach((r: any) => {
              r.matches?.forEach((m: any) => {
                  if (m.status === 'COMPLETED' && m.home !== 'BYE' && m.away !== 'BYE') {
                      matches.push({ ...m, matchLabel: r.name, roundId: r.id }); 
                  }
              });
          });
      }
      return matches.reverse().slice(0, 5); 
  }, [activeSeason, seasons]);

  // 매치톡 전광판(Ticker) 실제 데이터 10개 추출
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
          uid: c.authorUid || c.ownerUid,
          text: c.text?.startsWith('[STICKER]') ? '(스티커를 보냈습니다 ✨)' : c.text,
          photo: c.authorPhoto || c.ownerPhoto
      }));

      if (recent.length === 0) {
          return owners?.slice(0, 3).map((o:any) => ({
              name: o.nickname,
              uid: o.uid,
              text: "오늘 경기 화이팅입니다! 🔥",
              photo: o.photo
          })) || [];
      }
      return recent;
  }, [posts, owners]);

  const hotPosts = [...posts].sort((a, b) => (b.views || 0) + ((b.comments?.length || 0) * 2) - ((a.views || 0) + ((a.comments?.length || 0) * 2))).slice(0, 5);

  const handlePostClick = (post: any) => {
      setSelectedPostId(post.id);
      setViewMode('LIST');
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'LOCKERROOM'); params.set('postId', post.id);
      window.history.pushState(null, '', `/?${params.toString()}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 🔥 [픽스 완료] 매치카드 본체 클릭 시 스케줄 탭으로 확실하게 강제 이동
  const handleMatchCardClick = (m: any) => {
      window.location.href = '/?view=SCHEDULE';
  };

  // 🔥 [픽스 완료] 리센트 하단 매치톡 탭 클릭 시 락커룸 내 매치톡 방으로 상태 즉각 변경
  const handleMatchTalkClick = (m: any) => {
      const matchId = m.id || m.matchId || `match_${m.home}_${m.away}`;
      
      // 1. 상태 즉시 변경 (빈 화면 방지)
      setSelectedPostId(matchId);
      setViewMode('LIST');
      
      // 2. URL 조용히 업데이트
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'LOCKERROOM');
      params.set('postId', matchId);
      window.history.pushState(null, '', `/?${params.toString()}`);
      
      // 3. 최상단 스크롤
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
      <div className="animate-in fade-in pb-10 mt-2 text-left overflow-x-hidden">
          <style jsx>{`
              .no-scrollbar::-webkit-scrollbar { display: none; }
              .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
              
              @keyframes ticker {
                  0% { transform: translateX(0); }
                  100% { transform: translateX(-50%); }
              }
              .ticker-track {
                  display: flex;
                  width: max-content;
                  animation: ticker 35s linear infinite;
              }
              .ticker-track:hover {
                  animation-play-state: paused;
              }
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

          {/* 2. 리그 커뮤니티 (공지사항 바로 밑으로 순서 변경 완료) */}
          <div className="mb-8">
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
          <div onClick={() => { 
              setCategory('매치톡'); 
              setViewMode('LIST'); 
              const params = new URLSearchParams(window.location.search);
              params.set('view', 'LOCKERROOM');
              window.history.pushState(null, '', `/?${params.toString()}`);
              window.scrollTo({ top: 0, behavior: 'smooth' }); 
          }} className="bg-gradient-to-r from-[#0B1120] to-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3 cursor-pointer hover:border-slate-600 hover:shadow-lg transition-all mb-8 relative overflow-hidden group">
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
                                  <img src={getOwnerProfile(msg.uid)} className="w-5 h-5 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0" alt="" onError={(e:any)=>{e.target.src=FALLBACK_IMG}} />
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

                  <div className="p-4 flex flex-col gap-5 bg-[#0B1120]">
                      {(matchTab === 'UPCOMING' ? upcomingMatchesList : recentMatchesList).length > 0 ? (
                          (matchTab === 'UPCOMING' ? upcomingMatchesList : recentMatchesList).map((match, idx) => (
                              <div key={idx} className="flex flex-col relative">
                                  {/* 매치카드 본체 (클릭 시 무조건 스케줄로 이동) */}
                                  <div className="relative z-10">
                                      <MatchCard 
                                          match={match} 
                                          onClick={(m) => handleMatchCardClick(m)}
                                          activeRankingData={activeRankingData}
                                          historyData={historyData}
                                          masterTeams={masterTeams}
                                          owners={owners}
                                      />
                                  </div>
                                  
                                  {/* 🔥 RECENT 탭 전용 하단 매치톡 이동 부착 탭 (클릭 시 해당 매치톡으로 락커룸 내 즉시 이동) */}
                                  {matchTab === 'RECENT' && (
                                      <div 
                                          onClick={() => handleMatchTalkClick(match)}
                                          className="bg-slate-900 border border-slate-800 border-t-0 rounded-b-2xl mx-3 -mt-3 pt-5 pb-2.5 px-4 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors z-0 relative shadow-inner group"
                                      >
                                          <div className="flex items-center gap-2">
                                              <MessageSquare size={13} className="text-blue-400 group-hover:scale-110 transition-transform" />
                                              <span className="text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors">이 경기의 매치톡 보기</span>
                                          </div>
                                          <div className="flex items-center text-[10px] font-black text-slate-500 group-hover:text-blue-400 transition-colors">
                                              입장 <ChevronRight size={12} className="ml-0.5" />
                                          </div>
                                      </div>
                                  )}
                              </div>
                          ))
                      ) : (
                          <div className="bg-slate-900/30 border border-slate-800/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-inner">
                              <CalendarDays size={32} className="text-slate-600 mb-2" />
                              <span className="text-xs font-bold text-slate-400">해당하는 매치 기록이 없습니다.</span>
                          </div>
                      )}
                  </div>
              </div>
          </div>
          
          {/* 명예의 전당은 완전히 삭제되었습니다. */}

      </div>
  );
}