"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Flame, ChevronRight, PlayCircle, Heart } from 'lucide-react'; 
import { FALLBACK_IMG } from '../types';
import { collection, query, onSnapshot, doc, updateDoc, increment, orderBy, limit, arrayRemove, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { LiveFeed } from './LiveFeed';
import { MatchTalkCarousel } from './MatchTalkCarousel';
import { ChampionsCarousel } from './ChampionsCarousel';
import { useAuth } from '../hooks/useAuth';
import HighlightViewerModal from './HighlightViewerModal';
import L_MatchCenter from './L_MatchCenter';

// 🚨 픽스: Vercel 빌드 에러의 원인인 누락된 상수를 복구했습니다.
const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

const getYoutubeId = (url: string) => {
    if (!url) return null;
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regExp);
    return match ? match[1] : null;
};

export default function L_LockerRoomDashboard({ 
    user, notices, seasons, masterTeams, owners, activeSeason, 
    posts, highlights, uidDict, setViewMode, setCategory, setSelectedPostId, 
    activeRankingData, historyData, viewSeasonId, setViewSeasonId 
}: any) {
  const { authUser } = useAuth();
  // 🚨 픽스: 기본 선택 탭을 'HOT'에서 'FREE'(최신글)로 변경했습니다.
  const [communityTab, setCommunityTab] = useState<'HOT' | 'FREE'>('FREE');
  const [matchCommentsData, setMatchCommentsData] = useState<any[]>([]);
  const [activeVideo, setActiveVideo] = useState<any>(null); 

  const isDataLoading = !owners || owners.length === 0 || !posts;

  const activeOrLatestSeason = useMemo(() => {
      if (!seasons || seasons.length === 0) return null;
      const active = seasons.find((s: any) => s.status === 'ACTIVE');
      return active || [...seasons].sort((a: any, b: any) => b.id - a.id)[0];
  }, [seasons]);

  useEffect(() => {
      const q = query(collection(db, 'match_comments'), orderBy('createdAt', 'desc'), limit(100));
      const unsubscribe = onSnapshot(q, (snap) => {
          setMatchCommentsData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsubscribe();
  }, []);

  // 🚨 픽스: 썸네일 탭 동기화를 위해 전체 HOT 배열을 저장합니다.
  const allHotPosts = useMemo(() => {
      return [...(posts || [])].sort((a: any, b: any) => (b.views || 0) + ((b.comments?.length || 0) * 2) - ((a.views || 0) + ((a.comments?.length || 0) * 2)));
  }, [posts]);

  const hotPosts = allHotPosts.slice(0, 5);

  // 🚨 픽스: 상단 썸네일용 데이터를 추출합니다. (유튜브 링크 포함 & 탭 상태 반영)
  const thumbPosts = useMemo(() => {
      const sourcePosts = communityTab === 'HOT' ? allHotPosts : (posts || []);
      return sourcePosts
          .filter((p: any) => !!p.imageUrl || !!p.youtubeId || !!getYoutubeId(p.youtubeUrl))
          .slice(0, 5);
  }, [communityTab, allHotPosts, posts]);

  const handlePostClick = async (post: any) => {
      if (post && post.id) {
          try {
              const postRef = doc(db, 'posts', post.id);
              await updateDoc(postRef, { views: increment(1) });
          } catch (error) { console.error("조회수 증가 실패:", error); }
      }
      setSelectedPostId(post.id); setViewMode('LIST');
      const params = new URLSearchParams(window.location.search);
      params.set('view', 'LOCKERROOM'); params.set('postId', post.id);
      window.history.pushState(null, '', `/?${params.toString()}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMatchTalkClick = (m: any) => {
      const targetSeasonId = m.seasonId || viewSeasonId || (seasons && seasons.length > 0 ? seasons[0].id : 0);
      window.location.href = `/?view=SCHEDULE&season=${targetSeasonId}&matchId=${m.id}`;
  };

  const handleLikeVideo = async (e: React.MouseEvent, video: any) => {
      e.stopPropagation();
      if (!authUser) return alert("로그인 후 이용 가능합니다.");
      try {
          const docRef = doc(db, 'highlights', video.id);
          const isLiked = video.likedBy?.includes(authUser.uid) || video.likes?.includes(authUser.uid);
          if (isLiked) await updateDoc(docRef, { likes: increment(-1), likedBy: arrayRemove(authUser.uid) });
          else await updateDoc(docRef, { likes: increment(1), likedBy: arrayUnion(authUser.uid) });
      } catch (error) { console.error("비디오 좋아요 중 오류:", error); }
  };

  return (
      <div className="animate-in fade-in pb-10 mt-2 text-left relative">
          <style jsx>{`
              .no-scrollbar::-webkit-scrollbar { display: none; }
              .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
              .carousel-pad-fix [class*="overflow-x-auto"] {
                  padding-top: 24px !important;
                  padding-bottom: 24px !important;
                  margin-top: -12px !important;
              }
          `}</style>

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

          <div className="carousel-pad-fix"><ChampionsCarousel seasons={seasons} owners={owners} masterTeams={masterTeams}/></div>

          <LiveFeed posts={posts || []} owners={owners} seasons={seasons} selectedSeasonId={viewSeasonId} onNavigateToPost={handlePostClick} onNavigateToMatch={handleMatchTalkClick} />

          <div className="mb-6">
              <div className="flex items-center justify-between mb-4 px-1">
                  <h3 className="text-sm font-black text-white italic tracking-widest uppercase flex items-center gap-2"><Flame size={16} className="text-orange-500" /> LEAGUE COMMUNITY</h3>
                  <span onClick={() => { 
                      setCategory('전체'); setViewMode('LIST'); 
                      const params = new URLSearchParams(window.location.search);
                      params.set('view', 'LOCKERROOM'); params.delete('postId');
                      window.history.pushState(null, '', `/?${params.toString()}`); window.scrollTo({ top: 0, behavior: 'smooth' }); 
                  }} className="text-[10px] text-slate-500 font-bold uppercase tracking-wider cursor-pointer hover:text-white transition-colors">더보기 &gt;</span>
              </div>
              
              <div className="bg-[#050b14] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="flex border-b border-slate-800 h-[45px] bg-slate-950/50">
                      <button onClick={() => setCommunityTab('HOT')} className={`flex-1 h-full flex justify-center items-center text-[11px] font-black tracking-widest transition-all ${communityTab === 'HOT' ? 'bg-slate-900 text-orange-400 border-b-2 border-orange-400' : 'text-slate-500 hover:text-slate-300'}`}>🔥 HOT</button>
                      <button onClick={() => setCommunityTab('FREE')} className={`flex-1 h-full flex justify-center items-center text-[11px] font-black tracking-widest transition-all ${communityTab === 'FREE' ? 'bg-slate-900 text-white border-b-2 border-white' : 'text-slate-500 hover:text-slate-300'}`}>📝 최신글</button>
                  </div>
                  <div className="p-4">
                      {isDataLoading ? (
                         <div className="flex flex-col gap-4 items-center justify-center py-10 opacity-50"><span className="text-xs font-bold text-slate-500">데이터 로딩 중...</span></div>
                      ) : (
                          <>
                              {/* 🚨 픽스: 썸네일 노출 로직이 이제 HOT/최신글 탭을 따라가고, 유튜브 썸네일도 정상적으로 추출합니다. */}
                              {thumbPosts.length > 0 && (
                                  <div className="flex overflow-x-auto gap-3 no-scrollbar pb-4 border-b border-slate-800/60 mb-2">
                                      {thumbPosts.map((post:any, i:number) => {
                                          const ytId = post.youtubeId || getYoutubeId(post.youtubeUrl);
                                          const thumbSrc = post.imageUrl || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null);

                                          return (
                                              <div key={i} onClick={() => handlePostClick(post)} className="min-w-[130px] w-[130px] shrink-0 flex flex-col gap-2 cursor-pointer group">
                                                  <div className="w-full h-[100px] bg-slate-800 rounded-xl overflow-hidden relative border border-slate-700/50 group-hover:border-slate-500 transition-colors flex items-center justify-center">
                                                      {thumbSrc ? (
                                                          <img src={thumbSrc} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="thumbnail" />
                                                      ) : (
                                                          <PlayCircle size={24} className="text-slate-600"/>
                                                      )}
                                                  </div>
                                                  <span className="text-[11px] font-bold text-slate-300 truncate leading-tight group-hover:text-white transition-colors pr-1">{post.title}</span>
                                              </div>
                                          );
                                      })}
                                  </div>
                              )}
                              <div className="flex flex-col divide-y divide-slate-800/50">
                                  {(communityTab === 'HOT' ? hotPosts : posts.slice(0, 5)).map((post:any, idx:number) => {
                                      const ytId = post.youtubeId || getYoutubeId(post.youtubeUrl);
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
                                                          <span>{post.authorName}</span><span className="w-0.5 h-0.5 bg-slate-600 rounded-full"></span><span>조회 {post.views || 0}</span>
                                                      </div>
                                                  </div>
                                              </div>
                                              <div className="flex items-center gap-3 shrink-0 ml-2">
                                                  {thumbSrc && <img src={thumbSrc} className="w-11 h-11 rounded-lg object-cover border border-slate-700 block shrink-0" onError={(e: any) => { e.target.style.display = 'none'; }} />}
                                                  <div className={`flex flex-col items-center justify-center rounded-xl w-11 h-11 border shrink-0 transition-colors ${commentCount > 0 ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-500'}`}>
                                                      <span className="text-[14px] font-black leading-none">{commentCount}</span><span className="text-[9px] font-bold mt-0.5">댓글</span>
                                                  </div>
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          </>
                      )}
                  </div>
              </div>
          </div>

          <div className="mb-8">
              <div className="flex items-center justify-between px-2 mb-4">
                  <div className="flex items-center gap-2">
                      <div className="w-1.5 h-5 bg-red-500 rounded-full shadow-[0_0_10px_#ef4444]"></div>
                      <h3 className="text-[16px] font-black italic text-white uppercase tracking-widest flex items-center gap-2">🎬 E-Football <span className="text-red-500">Highlights</span></h3>
                  </div>
                  <button onClick={() => { setViewMode('HIGHLIGHTS'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors flex items-center">
                      더보기 <ChevronRight size={14} />
                  </button>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4 px-2 snap-x pt-2">
                  {highlights && highlights.length > 0 ? (
                      highlights.slice(0, 8).map((video: any) => {
                          const ytId = video.youtubeId || getYoutubeId(video.youtubeUrl);
                          const thumbUrl = ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : FALLBACK_IMG;
                          return (
                              <div key={video.id} className="snap-start shrink-0 w-[160px] sm:w-[200px] flex flex-col gap-2 cursor-pointer group" onClick={() => setActiveVideo(video)}>
                                  <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-800 shadow-md">
                                      <img src={thumbUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" alt="thumbnail" onError={(e:any) => e.target.src = FALLBACK_IMG} />
                                      <div className="absolute top-1.5 left-1.5 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-black text-emerald-400 uppercase border border-slate-700/50">{video.seasonName || 'HIGHLIGHT'}</div>
                                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20"><PlayCircle size={32} className="text-white/80 drop-shadow-lg" strokeWidth={1.5} /></div>
                                  </div>
                                  <div className="flex items-start gap-1.5 px-1">
                                      <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 shrink-0 overflow-hidden shadow-sm mt-0.5">
                                          <img src={video.homeLogo || SAFE_TBD_LOGO} className="w-full h-full object-contain p-0.5" alt="" onError={(e:any) => e.target.src = FALLBACK_IMG} />
                                      </div>
                                      <div className="flex flex-col min-w-0 flex-1">
                                          <h4 className="text-[11px] sm:text-[12px] font-black text-slate-100 line-clamp-2 leading-tight group-hover:text-emerald-400 transition-colors">{video.homeTeam} vs {video.awayTeam} <span className="text-emerald-500">({video.homeScore}:{video.awayScore})</span></h4>
                                          <div className="flex items-center justify-between w-full text-[9px] sm:text-[10px] text-slate-500 font-bold mt-1">
                                              <span>조회 {video.views || 0}</span>
                                              <div className="flex items-center gap-1 text-slate-400">
                                                  <button onClick={(e) => handleLikeVideo(e, video)} className={`flex items-center gap-1 transition-colors hover:text-white`}><Heart size={9} className={video.likes?.includes(authUser?.uid) ? 'fill-red-400 text-red-400' : ''}/> {video.likes?.length || 0}</button>
                                                  <span className="text-slate-600">•</span><span>댓글 {(video.comments || []).length}</span>
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          );
                      })
                  ) : (<div className="w-full text-center py-10 text-slate-500 text-xs italic font-bold">등록된 하이라이트 영상이 없습니다.</div>)}
              </div>
          </div>

          <div className="carousel-pad-fix"><MatchTalkCarousel seasons={seasons} matchCommentsData={matchCommentsData} owners={owners} masterTeams={masterTeams} onNavigateToMatch={handleMatchTalkClick}/></div>

          <L_MatchCenter 
              seasons={seasons} masterTeams={masterTeams} owners={owners} 
              isDataLoading={isDataLoading} onNavigateToMatch={handleMatchTalkClick}
              activeOrLatestSeason={activeOrLatestSeason}
              activeRankingData={activeRankingData} 
              historyData={historyData} 
              viewSeasonId={viewSeasonId} 
              setViewSeasonId={setViewSeasonId} 
          />

          {activeVideo && <HighlightViewerModal activeVideo={activeVideo} onClose={() => setActiveVideo(null)} authUser={authUser} owners={owners} seasons={seasons} />}
      </div>
  );
}