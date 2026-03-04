"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase'; 
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc, serverTimestamp, addDoc, deleteDoc, where } from 'firebase/firestore';
import { MessageSquare, ThumbsUp, ThumbsDown, Edit3, Image as ImageIcon, Youtube, Share2, ArrowLeft, Send, Trash2, CornerDownRight, Trophy } from 'lucide-react';
import { FALLBACK_IMG } from '../types';

interface UserData {
  uid: string;
  mappedOwnerId: string;
  role: 'ADMIN' | 'USER';
  photoUrl?: string;
  photoURL?: string; 
  photo?: string;
}

const COMMON_DEFAULT_PROFILE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2364748b'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

// 🔥 1순위: 오너 커스텀 프사, 2순위: 구글 프사, 3순위: 디폴트 프사
const getBestProfileImage = (userObj: any | null, ownersList: any[] | undefined, savedPhoto?: string, authorName?: string) => {
    const targetName = authorName || (userObj ? userObj.mappedOwnerId : null);
    if (targetName && ownersList) {
        const ownerData = ownersList.find(o => o.nickname === targetName);
        if (ownerData && ownerData.photo && ownerData.photo.trim() !== '') {
            return ownerData.photo;
        }
    }

    if (userObj) {
        if (userObj.photoURL && userObj.photoURL.trim() !== '') return userObj.photoURL;
        if (userObj.photoUrl && userObj.photoUrl.trim() !== '') return userObj.photoUrl;
    }

    if (savedPhoto && savedPhoto.trim() !== '') {
        return savedPhoto;
    }

    return COMMON_DEFAULT_PROFILE;
};

const LockerRoomView = ({ user, notices = [], seasons = [], masterTeams = [], owners = [] }: { user: UserData | null, notices: any[], seasons?: any[], masterTeams?: any[], owners?: any[] }) => {
  const [posts, setPosts] = useState<any[]>([]);
  
  // 🔥 [수정] 락커룸 진입 시 기본 선택 탭을 '매치톡'에서 '전체'로 변경 (초기 렌더링 부하 감소)
  const [category, setCategory] = useState('전체');
  
  const [viewMode, setViewMode] = useState<'LIST' | 'WRITE' | 'EDIT'>('LIST');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  
  const [postForm, setPostForm] = useState({ title: '', content: '', cat: '자유', imageUrl: '', youtubeUrl: '' });
  
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string, authorName: string } | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  
  const commentInputRef = useRef<HTMLInputElement>(null);

  const [allMatchComments, setAllMatchComments] = useState<any[]>([]);

  useEffect(() => {
      const q = query(collection(db, 'match_comments'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setAllMatchComments(fetched);
      });
      return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedPosts.sort((a: any, b: any) => {
          if (a.isPinned === b.isPinned) return 0;
          return a.isPinned ? -1 : 1;
      });
      setPosts(fetchedPosts);
    });
    return () => unsubscribe();
  }, []);

  const matchTalkPosts = useMemo(() => {
    const items: any[] = [];
    seasons?.forEach((s: any) => {
        s.rounds?.forEach((r: any) => {
            r.matches?.forEach((m: any) => {
                if (m.home !== 'BYE' && m.away !== 'BYE' && !m.home?.includes('부전승')) {
                    const hTeam = masterTeams?.find((t:any) => t.name === m.home);
                    const aTeam = masterTeams?.find((t:any) => t.name === m.away);
                    
                    const matchComments = allMatchComments.filter(c => c.matchId === m.id)
                        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

                    items.push({
                        id: `match_${m.id}`,
                        realMatchId: m.id, 
                        isMatchTalk: true,
                        subTitle: `${s.name} | ${m.matchLabel || r.name}`, 
                        title: `${m.home} VS ${m.away}`,
                        cat: '매치톡',
                        matchData: { ...m, seasonId: s.id, homeLogo: hTeam?.logo, awayLogo: aTeam?.logo, homeTier: hTeam?.tier, awayTier: aTeam?.tier },
                        createdAt: m.timestamp || s.id || Date.now(),
                        comments: matchComments, 
                        views: m.talkViews || 0,
                        authorName: 'SYSTEM',
                        authorPhoto: COMMON_DEFAULT_PROFILE
                    });
                }
            });
        });
    });
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }, [seasons, masterTeams, allMatchComments]); 

  const getTierBadgeColor = (tier?: string) => {
      const t = (tier || 'C').toUpperCase();
      return t === 'S' ? 'bg-purple-600 text-white border-purple-400' 
           : t === 'A' ? 'bg-emerald-600 text-white border-emerald-400' 
           : t === 'B' ? 'bg-blue-600 text-white border-blue-400' 
           : t === 'C' ? 'bg-slate-600 text-white border-slate-400'
           : 'bg-slate-800 text-slate-400 border-slate-700';
  };

  const getMatchSummary = (h: any, a: any) => {
      const hs = Number(h); const as = Number(a);
      if (isNaN(hs) || isNaN(as)) return "아직 경기가 시작되지 않았습니다. 승자를 예측해보세요!";
      const diff = Math.abs(hs - as); const total = hs + as;
      if (hs === as) {
          if (total === 0) return "양 팀 모두 득점 없이 팽팽한 접전 끝에 무승부를 기록했습니다!";
          return `치열한 공방전 끝에 ${hs}:${as} 무승부로 경기가 종료되었습니다!`;
      }
      if (diff >= 4) return "🎬 하이라이트 영상만 10분이 넘겠는데요? 대단합니다!";
      if (diff >= 2) return "완벽한 전술의 승리! 깔끔하게 상대를 제압했습니다.";
      if (total >= 5) return "골 잔치가 벌어졌습니다! 팬들의 눈을 즐겁게 한 명승부!";
      return "손에 땀을 쥐게 하는 명승부! 한 끗 차이로 승부가 갈렸습니다.";
  };

  useEffect(() => {
    const syncState = () => {
        const params = new URLSearchParams(window.location.search);
        const pId = params.get('postId');
        const currentView = params.get('view');
        
        if (currentView === 'LOCKERROOM' && !pId) {
            setSelectedPostId(null);
            setViewMode('LIST');
        } else if (pId && pId !== selectedPostId) {
            setSelectedPostId(pId);
            setViewMode('LIST');
        } else if (!pId && selectedPostId) {
            setSelectedPostId(null);
            setViewMode('LIST');
        }
    };

    syncState();
    window.addEventListener('popstate', syncState);
    window.addEventListener('forceNoticeCheck', syncState);

    return () => {
        window.removeEventListener('popstate', syncState);
        window.removeEventListener('forceNoticeCheck', syncState);
    };
  }, [selectedPostId]);

  useEffect(() => {
    return () => {
        const url = new URL(window.location.href);
        if (url.searchParams.has('postId')) {
            url.searchParams.delete('postId');
            window.history.replaceState(null, '', url.toString());
        }
    };
  }, []);

  const extractYoutubeId = (url: string) => {
    if (!url) return '';
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : '';
  };

  const formatDate = (ts: any, includeTime = false) => {
    if (!ts) return '방금 전';
    let d: Date;
    if (typeof ts === 'number') d = new Date(ts);
    else if (typeof ts.toDate === 'function') d = ts.toDate();
    else if (typeof ts === 'string') d = new Date(ts);
    else return '방금 전';

    const datePart = `${String(d.getFullYear()).slice(-2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    const timePart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return includeTime ? `${datePart} ${timePart}` : datePart;
  };

  const handlePostClick = async (post: any) => {
    setSelectedPostId(post.id);
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        params.set('view', 'LOCKERROOM');
        params.set('postId', post.id);
        window.history.pushState(null, '', `?${params.toString()}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (post.isMatchTalk) {
        const season = seasons?.find((s:any) => s.id === post.matchData.seasonId);
        if (season) {
            const newRounds = JSON.parse(JSON.stringify(season.rounds));
            let found = false;
            for (let rIdx = 0; rIdx < newRounds.length; rIdx++) {
                for (let mIdx = 0; mIdx < (newRounds[rIdx].matches || []).length; mIdx++) {
                    if (newRounds[rIdx].matches[mIdx].id === post.matchData.id) {
                        newRounds[rIdx].matches[mIdx].talkViews = (newRounds[rIdx].matches[mIdx].talkViews || 0) + 1;
                        found = true; break;
                    }
                }
                if (found) break;
            }
            if (found) updateDoc(doc(db, 'seasons', String(season.id)), { rounds: newRounds }).catch(e => console.error(e));
        }
    } else if (post.id && posts.find(p => p.id === post.id)) {
        try {
            const postRef = doc(db, 'posts', post.id);
            const postSnap = await getDoc(postRef);
            if (postSnap.exists()) {
                await updateDoc(postRef, { views: (postSnap.data().views || 0) + 1 });
            }
        } catch (e) { console.error(e); }
    }
  };

  const handleCloseView = () => {
    setSelectedPostId(null);
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        params.delete('postId');
        window.history.pushState(null, '', `?${params.toString()}`);
    }
  };

  const handleShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        alert('🔗 게시글 링크가 복사되었습니다!');
    });
  };

  const handleReaction = async (post: any, type: 'LIKE' | 'DISLIKE') => {
      if (!user || !post.id) return alert("🚨 로그인이 필요합니다.");
      try {
          const postRef = doc(db, 'posts', post.id);
          const postSnap = await getDoc(postRef);
          if (!postSnap.exists()) return;
          
          const postData = postSnap.data();
          let likes = postData.likes || [];
          let dislikes = postData.dislikes || [];

          if (type === 'LIKE') {
              if (likes.includes(user.uid)) likes = likes.filter((uid: string) => uid !== user.uid);
              else { likes.push(user.uid); dislikes = dislikes.filter((uid: string) => uid !== user.uid); }
          } else {
              if (dislikes.includes(user.uid)) dislikes = dislikes.filter((uid: string) => uid !== user.uid);
              else { dislikes.push(user.uid); likes = likes.filter((uid: string) => uid !== user.uid); }
          }
          await updateDoc(postRef, { likes, dislikes });
      } catch (error) { console.error(error); }
  };

  const handleWritePost = async () => {
    if (!user) return alert("🚨 로그인이 필요합니다!");
    if (!postForm.title.trim()) return alert("🚨 제목을 입력해주세요!");
    if (!postForm.content.trim()) return alert("🚨 내용을 입력해주세요!");

    try {
      if (viewMode === 'WRITE') {
          const docRef = await addDoc(collection(db, 'posts'), {
            title: postForm.title,
            content: postForm.content,
            cat: postForm.cat,
            imageUrl: postForm.imageUrl ? postForm.imageUrl.trim() : '', 
            youtubeId: extractYoutubeId(postForm.youtubeUrl), 
            authorId: user.uid,
            authorName: user.mappedOwnerId || '미배정 오너',
            authorPhoto: getBestProfileImage(user, owners), 
            createdAt: serverTimestamp(),
            isPinned: false,
            isEdited: false,
            views: 0,
            likes: [],
            dislikes: [],
            comments: []
          });
          alert("✅ 게시글이 등록되었습니다!");
          setViewMode('LIST');
          setPostForm({ title: '', content: '', cat: '자유', imageUrl: '', youtubeUrl: '' });
          
          setSelectedPostId(docRef.id);
          const url = new URL(window.location.href);
          url.searchParams.set('postId', docRef.id);
          window.history.pushState(null, '', url.toString());
          window.scrollTo({ top: 0, behavior: 'smooth' });

      } else if (viewMode === 'EDIT' && editingPostId) {
          await updateDoc(doc(db, 'posts', editingPostId), {
            title: postForm.title,
            content: postForm.content,
            cat: postForm.cat,
            imageUrl: postForm.imageUrl ? postForm.imageUrl.trim() : '', 
            youtubeId: extractYoutubeId(postForm.youtubeUrl), 
            isEdited: true
          });
          alert("✅ 게시글이 수정되었습니다!");
          setViewMode('LIST');
          setEditingPostId(null);
          setPostForm({ title: '', content: '', cat: '자유', imageUrl: '', youtubeUrl: '' });
      }
    } catch (e: any) { 
      console.error("Error adding post: ", e);
      alert("🚨 처리 중 오류가 발생했습니다: " + e.message);
    }
  };

  const handleOpenEdit = (post: any) => {
      setPostForm({
          title: post.title,
          content: post.content,
          cat: post.cat,
          imageUrl: post.imageUrl || '',
          youtubeUrl: post.youtubeId ? `https://youtube.com/watch?v=${post.youtubeId}` : ''
      });
      setEditingPostId(post.id);
      setViewMode('EDIT');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePost = async (postId: string) => {
      if (!window.confirm("정말 이 게시글을 삭제하시겠습니까?")) return;
      try {
          await deleteDoc(doc(db, 'posts', postId));
          alert("🗑️ 삭제되었습니다.");
          if (selectedPostId === postId) handleCloseView();
      } catch (e) { alert("삭제 실패"); }
  };

  const handleAddComment = async (postId: string) => {
      if (!user) return alert("🚨 로그인이 필요합니다.");
      if (!commentText.trim()) return alert("댓글 내용을 입력해주세요.");

      const post = posts.find(p => p.id === postId) || matchTalkPosts.find(m => m.id === postId);
      if (!post) return;

      const currentAuthorPhoto = getBestProfileImage(user, owners);

      try {
          if (post.isMatchTalk) {
              await addDoc(collection(db, 'match_comments'), {
                  matchId: post.realMatchId,
                  authorId: user.uid,
                  authorName: user.mappedOwnerId || '미배정 오너',
                  authorPhoto: currentAuthorPhoto, 
                  text: commentText.trim(),
                  createdAt: Date.now(),
              });
              setCommentText('');
              return;
          }

          let updatedComments = [...(post.comments || [])];
          
          if (editingCommentId) {
              updatedComments = updatedComments.map(c => 
                  c.id === editingCommentId ? { ...c, text: commentText.trim(), isEdited: true } : c
              );
          } else {
              updatedComments.push({
                  id: `cmt_${Date.now()}`,
                  authorId: user.uid,
                  authorName: user.mappedOwnerId || '미배정 오너',
                  authorPhoto: currentAuthorPhoto, 
                  text: commentText.trim(),
                  createdAt: Date.now(),
                  parentId: replyingTo ? replyingTo.id : null,
                  likes: [],
                  isEdited: false
              });
          }

          await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
          setCommentText('');
          setReplyingTo(null);
          setEditingCommentId(null);
      } catch (e) { alert("댓글 처리 실패"); }
  };

  const handleCommentReaction = async (postId: string, commentId: string) => {
      if (!user) return alert("🚨 로그인이 필요합니다.");
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      const updatedComments = post.comments.map((c: any) => {
          if (c.id !== commentId) return c;
          let likes = c.likes || [];
          if (likes.includes(user.uid)) likes = likes.filter((uid: string) => uid !== user.uid);
          else likes.push(user.uid);
          return { ...c, likes };
      });
      await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
      if (!window.confirm("댓글을 삭제하시겠습니까? (답글이 있다면 함께 삭제됩니다)")) return;
      
      const post = posts.find(p => p.id === postId) || matchTalkPosts.find(m => m.id === postId);
      if (!post) return;

      if (post.isMatchTalk) {
          await deleteDoc(doc(db, 'match_comments', commentId));
          return;
      }

      const updatedComments = (post.comments || []).filter((c: any) => c.id !== commentId && c.parentId !== commentId);
      await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
  };

  const handleEditCommentSetup = (comment: any) => {
      setEditingCommentId(comment.id);
      setReplyingTo(null);
      setCommentText(comment.text);
      setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const handleReplySetup = (comment: any) => {
      setReplyingTo({ id: comment.id, authorName: comment.authorName });
      setEditingCommentId(null);
      setCommentText('');
      setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const handleCancelCommentAction = () => {
      setReplyingTo(null);
      setEditingCommentId(null);
      setCommentText('');
  };

  const activePost = useMemo(() => {
      if (!selectedPostId) return null;
      return posts.find(p => p.id === selectedPostId) || notices.find(n => n.id === selectedPostId) || matchTalkPosts.find(m => m.id === selectedPostId);
  }, [selectedPostId, posts, notices, matchTalkPosts]);

  const filteredPosts = posts.filter(p => category === '전체' || p.cat === category);
  const displayPosts = category === '매치톡' ? matchTalkPosts : filteredPosts;
  const visiblePostsList = displayPosts.slice(0, visibleCount);
  const hasMore = visiblePostsList.length < displayPosts.length;

  const renderComments = (comments: any[], postId: string, isMatchTalk: boolean = false) => {
      const topLevel = comments.filter(c => !c.parentId);
      
      return topLevel.map(comment => {
          const replies = comments.filter(c => c.parentId === comment.id);
          const isLiked = comment.likes?.includes(user?.uid);

          const authorProfileImg = getBestProfileImage(null, owners, comment.authorPhoto, comment.authorName);

          return (
              <div key={comment.id} className="border-b border-slate-800/60 py-5 last:border-0">
                  <div className="flex gap-3.5">
                      <img src={authorProfileImg} alt="profile" className="w-9 h-9 rounded-full object-cover shrink-0 bg-slate-800 border border-slate-700" />
                      <div className="flex-1 min-w-0 pr-6 overflow-visible">
                          <div className="flex items-baseline gap-2 mb-1.5">
                              <span className="font-bold text-emerald-400 text-sm italic whitespace-nowrap">{comment.authorName}</span>
                              <span className="text-slate-500 text-[10px] whitespace-nowrap">{formatDate(comment.createdAt, true)}</span>
                              {comment.isEdited && <span className="text-slate-600 text-[10px] italic">(수정됨)</span>}
                          </div>
                          
                          {editingCommentId === comment.id && !isMatchTalk ? (
                              <div className="mt-1 flex flex-col gap-2">
                                  <input value={commentText} onChange={(e) => setCommentText(e.target.value)} className="w-full bg-slate-900/80 p-3 rounded-lg border border-emerald-500/50 text-white text-[14px] sm:text-[15px] focus:outline-none focus:border-emerald-500" />
                                  <div className="flex justify-end gap-2">
                                      <button onClick={handleCancelCommentAction} className="px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-white bg-slate-800 rounded transition-colors">취소</button>
                                      <button onClick={() => handleAddComment(postId)} className="px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors shadow-lg">저장</button>
                                  </div>
                              </div>
                          ) : (
                              <p className="text-[14px] sm:text-[15px] text-slate-200 leading-snug whitespace-pre-wrap mb-2.5 font-medium tracking-tight">{comment.text}</p>
                          )}

                          {!editingCommentId && (
                              <div className="flex items-center gap-4 text-[12px] text-slate-400 font-bold mt-1">
                                  {!isMatchTalk && (
                                      <>
                                          <button onClick={() => handleCommentReaction(postId, comment.id)} className={`flex items-center gap-1 hover:text-emerald-400 transition-colors ${isLiked ? 'text-emerald-400' : ''}`}>
                                              <ThumbsUp size={13} className={isLiked ? 'fill-emerald-400' : ''}/> 좋아요 {comment.likes?.length || ''}
                                          </button>
                                          <button onClick={() => handleReplySetup(comment)} className="flex items-center gap-1 hover:text-white transition-colors">
                                              <MessageSquare size={13}/> 답글
                                          </button>
                                      </>
                                  )}
                                  {user?.uid === comment.authorId && (
                                      <div className="flex items-center gap-3 ml-auto text-[11px]">
                                          {!isMatchTalk && <button onClick={() => handleEditCommentSetup(comment)} className="hover:text-blue-400">수정</button>}
                                          <button onClick={() => handleDeleteComment(postId, comment.id)} className="hover:text-red-400">삭제</button>
                                      </div>
                                  )}
                              </div>
                          )}
                      </div>
                  </div>

                  {/* 대댓글 영역 */}
                  {!isMatchTalk && replies.length > 0 && (
                      <div className="mt-4 space-y-4 pl-4 sm:pl-12 border-l-2 border-slate-800/50">
                          {replies.map(reply => {
                              const isReplyLiked = reply.likes?.includes(user?.uid);
                              const replyAuthorProfileImg = getBestProfileImage(null, owners, reply.authorPhoto, reply.authorName);

                              return (
                                  <div key={reply.id} className="flex gap-3">
                                      <img src={replyAuthorProfileImg} alt="profile" className="w-8 h-8 rounded-full object-cover shrink-0 bg-slate-800 border border-slate-700" />
                                      <div className="flex-1 min-w-0 pr-6 overflow-visible">
                                          <div className="flex items-baseline gap-2 mb-1.5">
                                              <span className="font-bold text-emerald-400 text-sm italic whitespace-nowrap">{reply.authorName}</span>
                                              <span className="text-slate-500 text-[10px] whitespace-nowrap">{formatDate(reply.createdAt, true)}</span>
                                              {reply.isEdited && <span className="text-slate-600 text-[10px] italic">(수정됨)</span>}
                                          </div>
                                          
                                          {editingCommentId === reply.id ? (
                                              <div className="mt-1 flex flex-col gap-2">
                                                  <input value={commentText} onChange={(e) => setCommentText(e.target.value)} className="w-full bg-slate-900/80 p-3 rounded-lg border border-emerald-500/50 text-white text-[14px] sm:text-[15px] focus:outline-none focus:border-emerald-500" />
                                                  <div className="flex justify-end gap-2">
                                                      <button onClick={handleCancelCommentAction} className="px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-white bg-slate-800 rounded transition-colors">취소</button>
                                                      <button onClick={() => handleAddComment(postId)} className="px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors shadow-lg">저장</button>
                                                  </div>
                                              </div>
                                          ) : (
                                              <p className="text-[14px] sm:text-[15px] text-slate-300 leading-snug whitespace-pre-wrap mb-2.5 font-medium">{reply.text}</p>
                                          )}

                                          {!editingCommentId && (
                                              <div className="flex items-center gap-4 text-[11px] text-slate-400 font-bold mt-1">
                                                  <button onClick={() => handleCommentReaction(postId, reply.id)} className={`flex items-center gap-1 hover:text-emerald-400 transition-colors ${isReplyLiked ? 'text-emerald-400' : ''}`}>
                                                      <ThumbsUp size={12} className={isReplyLiked ? 'fill-emerald-400' : ''}/> 좋아요 {reply.likes?.length || ''}
                                                  </button>
                                                  {user?.uid === reply.authorId && (
                                                      <div className="flex items-center gap-3 ml-auto">
                                                          <button onClick={() => handleEditCommentSetup(reply)} className="hover:text-blue-400">수정</button>
                                                          <button onClick={() => handleDeleteComment(postId, reply.id)} className="hover:text-red-400">삭제</button>
                                                      </div>
                                                  )}
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  )}
              </div>
          );
      });
  };

  return (
    <div className="max-w-[700px] mx-auto p-0 sm:p-2 space-y-6 pb-20">
      
      {/* ==========================================
          [모드 1] 글쓰기 / 수정 모드
      ========================================== */}
      {(viewMode === 'WRITE' || viewMode === 'EDIT') && (
        <div className="bg-[#0f172a] rounded-3xl border border-slate-800 shadow-2xl p-6 sm:p-8 animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-5 border-b border-slate-800 pb-4">
                <h2 className="text-[16px] sm:text-[18px] font-black text-white tracking-tight">
                    {viewMode === 'WRITE' ? '새로운 게시글 작성 ✍️' : '게시글 수정 🛠️'}
                </h2>
                <button onClick={() => { setViewMode('LIST'); setPostForm({ title: '', content: '', cat: '자유', imageUrl: '', youtubeUrl: '' }); setEditingPostId(null); }} className="text-slate-400 hover:text-white text-[11px] font-bold bg-slate-800 px-3 py-1.5 rounded-lg transition-colors">✕ 취소</button>
            </div>
            
            <div className="space-y-3">
                <div className="flex gap-2">
                  <select value={postForm.cat} onChange={e => setPostForm({...postForm, cat: e.target.value})} className="bg-slate-900 text-emerald-400 px-3 py-2.5 rounded-xl border border-slate-700 text-[12px] font-black outline-none focus:border-emerald-500 cursor-pointer shrink-0 shadow-inner">
                    {['축구', '이풋볼', '자유', '기타'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input placeholder="제목을 입력하세요 (최대 50자)" className="flex-1 bg-slate-900 text-white px-4 py-2.5 rounded-xl border border-slate-700 text-[13px] sm:text-[14px] font-bold outline-none focus:border-emerald-500 placeholder:font-normal shadow-inner" value={postForm.title} onChange={e => setPostForm({...postForm, title: e.target.value})} />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2">
                   <div className="flex-1 flex items-center bg-slate-900 px-3 rounded-xl border border-slate-700 focus-within:border-emerald-500 transition-colors shadow-inner">
                       <ImageIcon size={14} className="text-slate-500 mr-2 shrink-0" />
                       <input placeholder="이미지 URL (선택)" className="w-full bg-transparent text-white py-2.5 text-[12px] sm:text-[13px] outline-none" value={postForm.imageUrl} onChange={e => setPostForm({...postForm, imageUrl: e.target.value})} />
                   </div>
                   <div className="flex-1 flex items-center bg-slate-900 px-3 rounded-xl border border-slate-700 focus-within:border-emerald-500 transition-colors shadow-inner">
                       <Youtube size={14} className="text-red-500/70 mr-2 shrink-0" />
                       <input placeholder="유튜브 링크 (선택)" className="w-full bg-transparent text-white py-2.5 text-[12px] sm:text-[13px] outline-none" value={postForm.youtubeUrl} onChange={e => setPostForm({...postForm, youtubeUrl: e.target.value})} />
                   </div>
                </div>
                
                <textarea placeholder="자유롭게 소통해 보세요! (욕설 및 비방은 제재 대상이 될 수 있습니다)" className="w-full h-64 bg-slate-900 text-slate-200 p-4 rounded-xl border border-slate-700 text-[13px] sm:text-[14px] outline-none focus:border-emerald-500 resize-none leading-relaxed shadow-inner" value={postForm.content} onChange={e => setPostForm({...postForm, content: e.target.value})}></textarea>
                
                <div className="pt-2 flex justify-end">
                  <button onClick={handleWritePost} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl text-[12px] sm:text-[13px] font-black transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] tracking-widest">
                      {viewMode === 'WRITE' ? '등록 완료' : '수정 완료'}
                  </button>
                </div>
            </div>
        </div>
      )}

      {/* ==========================================
          [모드 2] 리스트 & 뷰 페이지 모드
      ========================================== */}
      {viewMode === 'LIST' && (
        <>
          {/* 🔥 뷰 페이지 (게시글 상세) */}
          {activePost ? (
              <div className="animate-in slide-in-from-bottom-4 space-y-4">
                  <div className="mb-2">
                      <button onClick={handleCloseView} className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors font-bold text-[11px] sm:text-[12px] bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 shadow-inner w-max">
                          <ArrowLeft size={14} /> <span>목록으로 뒤로 가기</span>
                      </button>
                  </div>

                  <div className="bg-[#0f172a] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
                      <div className="p-5 sm:p-7 border-b border-slate-800">
                          <div className="flex justify-between items-start mb-3">
                              <span className={`font-black text-[10px] tracking-widest uppercase px-2.5 py-0.5 rounded border flex items-center gap-1 ${activePost.isMatchTalk ? 'bg-blue-400/10 text-blue-400 border-blue-500/30' : 'bg-emerald-400/10 text-emerald-400 border-emerald-500/30'}`}>
                                  {activePost.isMatchTalk ? <><Trophy size={12}/> 매치톡</> : (activePost.cat || '전체공지')}
                              </span>
                              {user?.uid === activePost.authorId && activePost.cat && !activePost.isMatchTalk && (
                                  <div className="flex gap-2 text-[10px] font-bold">
                                      <button onClick={() => handleDeletePost(activePost.id)} className="text-slate-500 hover:text-red-400">삭제</button>
                                  </div>
                              )}
                          </div>
                          
                          <div className="flex flex-col mb-3 pr-6 overflow-visible">
                              {activePost.isMatchTalk ? (
                                  <>
                                      <span className="text-[11px] sm:text-xs text-slate-400 font-bold mb-1">{activePost.subTitle}</span>
                                      <h2 className="text-xl sm:text-3xl font-black text-white italic leading-tight truncate">{activePost.title}</h2>
                                  </>
                              ) : (
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                                      <h2 className="text-[18px] sm:text-[20px] font-bold text-white leading-tight truncate">{activePost.title}</h2>
                                      <span className="text-[12px] sm:text-[13px] font-bold text-emerald-400 mt-1 sm:mt-0">{activePost.authorName || '운영진'}</span>
                                  </div>
                              )}
                          </div>
                          
                          <div className="flex items-center justify-between mt-2">
                              <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-[11px] text-slate-500 font-medium">
                                  <img src={getBestProfileImage(null, owners, activePost.authorPhoto, activePost.authorName)} alt="profile" className="w-4 h-4 rounded-full object-cover border border-slate-700 bg-slate-800" />
                                  <span>•</span>
                                  <span>{formatDate(activePost.createdAt, true)}</span>
                                  {activePost.views !== undefined && !activePost.isMatchTalk && (
                                      <><span>•</span><span>조회 {activePost.views}</span></>
                                  )}
                              </div>
                              {!activePost.isMatchTalk && (
                                  <button onClick={handleShareLink} className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition-colors border border-slate-700 shadow-sm shrink-0">
                                      🔗 공유하기
                                  </button>
                              )}
                          </div>
                          
                          <div className="h-px w-full bg-slate-800/60 my-5"></div>
                          
                          <div className="space-y-5 mb-6">
                              {activePost.isMatchTalk ? (
                                  <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-5 flex flex-col items-center gap-4 my-4 shadow-inner">
                                      <div className="bg-slate-800/80 px-4 py-1.5 rounded-full border border-slate-700 text-[10px] sm:text-xs font-black text-yellow-500 flex items-center gap-1.5 mb-2 shadow-sm">
                                          <Trophy size={12} /> {activePost.subTitle.split(' | ')[1]}
                                      </div>
                                      <div className="flex items-center justify-between w-full max-w-sm mx-auto">
                                          <div className="flex flex-col items-center gap-2 w-24">
                                              <div className="relative">
                                                  <img src={activePost.matchData.homeLogo || FALLBACK_IMG} className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-lg" alt="" />
                                                  <span className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 text-[8px] font-black rounded-full border-2 border-[#0B1120] ${getTierBadgeColor(activePost.matchData.homeTier)}`}>{activePost.matchData.homeTier || 'C'}</span>
                                              </div>
                                              <span className="text-sm sm:text-base font-black text-white italic truncate w-full text-center pr-2">{activePost.matchData.home}</span>
                                          </div>
                                          <div className="flex flex-col items-center px-2">
                                              <span className="text-4xl sm:text-5xl font-black italic tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                                                  <span className={Number(activePost.matchData.homeScore) > Number(activePost.matchData.awayScore) ? 'text-white' : 'text-slate-500'}>{activePost.matchData.homeScore ?? '-'}</span>
                                                  <span className="text-slate-600 mx-2">:</span>
                                                  <span className={Number(activePost.matchData.awayScore) > Number(activePost.matchData.homeScore) ? 'text-emerald-400' : 'text-slate-500'}>{activePost.matchData.awayScore ?? '-'}</span>
                                              </span>
                                              <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">{activePost.matchData.status}</span>
                                          </div>
                                          <div className="flex flex-col items-center gap-2 w-24">
                                              <div className="relative">
                                                  <img src={activePost.matchData.awayLogo || FALLBACK_IMG} className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-lg" alt="" />
                                                  <span className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 text-[8px] font-black rounded-full border-2 border-[#0B1120] ${getTierBadgeColor(activePost.matchData.awayTier)}`}>{activePost.matchData.awayTier || 'C'}</span>
                                              </div>
                                              <span className="text-sm sm:text-base font-black text-white italic truncate w-full text-center pr-2">{activePost.matchData.away}</span>
                                          </div>
                                      </div>

                                      {((activePost.matchData.homeScorers && activePost.matchData.homeScorers.length > 0) || (activePost.matchData.awayScorers && activePost.matchData.awayScorers.length > 0)) && (
                                          <div className="flex justify-between w-full max-w-sm mx-auto text-[10px] sm:text-xs font-bold text-slate-400 bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 mt-2">
                                              <div className="flex flex-col gap-1 items-end w-1/2 pr-4 border-r border-slate-800">
                                                  {activePost.matchData.homeScorers?.map((s:any, i:number) => <span key={i} className="truncate w-full text-right">{typeof s === 'string' ? s : s.name} ⚽</span>)}
                                              </div>
                                              <div className="flex flex-col gap-1 items-start w-1/2 pl-4">
                                                  {activePost.matchData.awayScorers?.map((s:any, i:number) => <span key={i} className="truncate w-full text-left">⚽ {typeof s === 'string' ? s : s.name}</span>)}
                                              </div>
                                          </div>
                                      )}

                                      {(activePost.matchData.homePredictRate > 0 || activePost.matchData.awayPredictRate > 0) && (
                                          <div className="w-full max-w-sm mt-2">
                                              <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-1.5">
                                                  <span className="text-emerald-400">{activePost.matchData.homePredictRate}%</span>
                                                  <span>예상승률(%)</span>
                                                  <span className="text-blue-400">{activePost.matchData.awayPredictRate}%</span>
                                              </div>
                                              <div className="h-2.5 w-full bg-slate-800 rounded-full flex overflow-hidden relative border border-slate-700">
                                                  <div className="h-full bg-emerald-500" style={{ width: `${activePost.matchData.homePredictRate}%` }}></div>
                                                  <div className="h-full bg-blue-500" style={{ width: `${activePost.matchData.awayPredictRate}%` }}></div>
                                              </div>
                                          </div>
                                      )}

                                      <div className="w-full max-w-sm bg-[#0B1120] border border-slate-800 rounded-xl p-3 mt-2 text-center shadow-inner">
                                          <span className="text-[9px] font-bold text-slate-500 block mb-1">경기 요약</span>
                                          <span className="text-[11px] sm:text-xs font-black italic text-emerald-400 break-keep">
                                              &quot;{getMatchSummary(activePost.matchData.homeScore, activePost.matchData.awayScore)}&quot;
                                          </span>
                                      </div>
                                  </div>
                              ) : (
                                  <>
                                      {activePost.youtubeId && (
                                          <div className="aspect-video w-full rounded-xl overflow-hidden border border-slate-800 shadow-lg bg-black">
                                              <iframe src={`https://www.youtube.com/embed/${activePost.youtubeId}`} className="w-full h-full" allowFullScreen></iframe>
                                          </div>
                                      )}
                                      {activePost.imageUrl && (
                                          <div className="w-full rounded-xl overflow-hidden border border-slate-800 shadow-lg bg-black/20">
                                              <img src={activePost.imageUrl} alt="첨부이미지" className="w-full h-auto object-contain mx-auto max-h-[500px]" />
                                          </div>
                                      )}
                                      <div className="text-slate-300 text-[13px] sm:text-[14px] leading-relaxed whitespace-pre-wrap font-medium not-italic pr-4">
                                          {activePost.content}
                                      </div>
                                  </>
                              )}
                          </div>
                      </div>

                      {activePost.cat && !activePost.isMatchTalk && (
                          <div className="bg-slate-900/50 p-4 sm:p-5 flex justify-center gap-3 border-b border-slate-800">
                              <button onClick={() => handleReaction(activePost, 'LIKE')} className={`flex items-center gap-2 px-5 py-2 rounded-full font-black text-[12px] border transition-all shadow-sm ${activePost.likes?.includes(user?.uid) ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                                  👍 좋아요 {activePost.likes?.length || 0}
                              </button>
                              <button onClick={() => handleReaction(activePost, 'DISLIKE')} className={`flex items-center gap-2 px-5 py-2 rounded-full font-black text-[12px] border transition-all shadow-sm ${activePost.dislikes?.includes(user?.uid) ? 'bg-red-600/20 border-red-500 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                                  👎 싫어요 {activePost.dislikes?.length || 0}
                              </button>
                          </div>
                      )}

                      <div className="p-4 sm:p-6 bg-slate-950/30">
                          <h4 className="text-[12px] sm:text-[13px] font-black text-white uppercase mb-4 flex items-center gap-2 tracking-widest italic">
                              💬 {activePost.isMatchTalk ? 'Match Talk' : 'Comments'} <span className="text-emerald-500 ml-1">{(activePost.comments || []).length}</span>
                          </h4>
                          
                          <div className="mb-6 border-t border-slate-800/50">
                              {(!activePost.comments || activePost.comments.length === 0) && (
                                  <p className="text-[11px] text-slate-500 italic py-5 font-bold">가장 먼저 의견을 남겨보세요!</p>
                              )}
                              {activePost.comments && activePost.comments.length > 0 && renderComments(activePost.comments, activePost.id, activePost.isMatchTalk)}
                          </div>

                          {user ? (
                              <div className="flex flex-col gap-2 pt-2">
                                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest pl-1 mb-0.5">의견 쓰기</div>
                                  <div className="flex flex-col sm:flex-row items-stretch gap-2">
                                      <div className="flex items-center gap-2 bg-slate-900 p-1.5 px-2.5 rounded-xl border border-slate-700 shrink-0 shadow-inner">
                                          <img src={getBestProfileImage(user, owners)} className="w-6 h-6 rounded-full object-cover border border-slate-800 bg-slate-800 shrink-0" alt="" />
                                          <span className="bg-transparent border-none text-white text-[10px] font-bold outline-none pr-2 truncate">
                                              {user?.mappedOwnerId}
                                          </span>
                                      </div>

                                      <div className="flex flex-1 items-stretch gap-2">
                                          <input 
                                              ref={commentInputRef}
                                              value={commentText} 
                                              onChange={(e) => setCommentText(e.target.value)} 
                                              onKeyDown={(e) => { 
                                                if (e.key === 'Enter') {
                                                  if (e.nativeEvent.isComposing) return;
                                                  e.preventDefault(); 
                                                  handleAddComment(activePost.id); 
                                                }
                                              }}
                                              placeholder={replyingTo ? `${replyingTo.authorName}님에게 답글 작성 중...` : "내용을 입력하세요..."}
                                              className="flex-1 bg-slate-900 px-4 py-2.5 sm:py-3 rounded-xl border border-slate-700 text-white text-[12px] sm:text-[13px] placeholder-slate-600 focus:border-emerald-500 transition-colors shadow-inner font-medium"
                                          />
                                          <button onClick={() => handleAddComment(activePost.id)} className="px-5 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] rounded-xl transition-all shadow-lg shrink-0 active:scale-95 flex items-center">
                                              등록
                                              <Send size={14} className="ml-1.5" />
                                          </button>
                                      </div>
                                  </div>
                                  {replyingTo && (
                                      <button onClick={handleCancelCommentAction} className="text-[10px] text-slate-500 hover:text-white self-start ml-1 font-bold">✕ 답글 취소</button>
                                  )}
                              </div>
                          ) : (
                              <div className="bg-slate-900/50 border border-slate-800/80 text-slate-500 text-[11px] font-bold p-4 rounded-xl text-center shadow-inner">
                                  로그인 후 참여할 수 있습니다.
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          ) : (
              <>
                  <div className="bg-slate-900/80 p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col gap-5 mb-4">
                      <div className="flex items-center gap-3">
                          <div className="w-2 h-6 sm:h-7 bg-emerald-500 rounded-sm"></div>
                          <div className="flex flex-col">
                              <h2 className="text-xl sm:text-2xl font-black italic text-white uppercase tracking-tighter leading-none">Locker Room</h2>
                              <span className="text-[10px] text-slate-500 font-bold mt-1">자유 소통 게시판</span>
                          </div>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                          {['🏆 매치톡', '전체', '축구', '이풋볼', '자유', '기타'].map(cat => {
                            const catValue = cat.replace('🏆 ', '');
                            const isSelected = category === catValue;
                            const isMatchTalk = catValue === '매치톡';
                            
                            let btnClass = "py-2.5 px-4 sm:px-5 rounded-xl text-[11px] sm:text-xs font-black transition-all shrink-0 whitespace-nowrap uppercase tracking-widest border";
                            
                            if (isSelected) {
                                btnClass += isMatchTalk 
                                    ? " bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/40" 
                                    : " bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/40";
                            } else {
                                btnClass += isMatchTalk 
                                    ? " bg-slate-800/80 text-blue-400 border-slate-700/50 hover:bg-slate-700 hover:text-blue-300" 
                                    : " bg-slate-800/80 text-slate-500 border-slate-700/50 hover:bg-slate-700 hover:text-slate-300";
                            }

                            return (
                            <button key={catValue} onClick={() => { setCategory(catValue); setVisibleCount(10); }} className={btnClass}>
                                {cat}
                            </button>
                            )
                          })}
                      </div>
                  </div>

                  <div className="bg-[#0f172a] rounded-2xl border border-slate-800 shadow-xl overflow-hidden divide-y divide-slate-800/50">
                      
                      {notices.map((notice) => {
                          return (
                          <div key={notice.id} onClick={() => handlePostClick(notice)} className={`flex items-center p-3 sm:p-4 hover:bg-slate-800/40 transition-colors cursor-pointer group`}>
                              <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 pl-1 pr-6">
                                  <span className="bg-transparent border border-yellow-600/80 text-yellow-500 text-[9px] sm:text-[10px] font-black px-2 py-[2px] rounded shrink-0">전체 공지</span>
                                  <span className="text-white font-bold text-[13px] sm:text-[14px] truncate group-hover:text-emerald-400 transition-colors leading-normal pr-6 overflow-visible">{notice.title}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 ml-3 hidden sm:flex">
                                  <div className="flex items-center gap-2.5 text-[11px] sm:text-[12px] text-slate-400 font-bold">
                                      <span className="flex items-center gap-1"><span className="opacity-70 text-[11px] sm:text-[13px]">👍</span> {notice.likedBy?.length || 0}</span>
                                      <span className="flex items-center gap-1"><span className="opacity-70 text-[11px] sm:text-[13px]">💬</span> {notice.comments?.length || 0}</span>
                                  </div>
                              </div>
                          </div>
                          )
                      })}

                      {visiblePostsList.length === 0 ? (
                          <div className="p-16 text-center text-slate-400 font-black text-[14px] sm:text-[16px] italic bg-slate-900/30 leading-relaxed shadow-inner border-t border-slate-800/50">
                              &quot;브로, 그대가 여기 첫번째 작성자가 될 수 있어 🏆&quot;
                          </div>
                      ) : visiblePostsList.map((post, index) => {
                          const boardNumber = displayPosts.length - index; 
                          return (
                          <div key={post.id} onClick={() => handlePostClick(post)} className={`flex items-center p-3 sm:p-4 hover:bg-slate-800/40 transition-colors cursor-pointer group ${selectedPostId === post.id ? 'bg-slate-800/30' : ''}`}>
                              <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 pl-1 pr-8">
                                  <span className={`text-slate-500 font-black italic text-[11px] sm:text-xs w-6 text-center shrink-0 ${post.isMatchTalk ? 'text-[14px]' : ''}`}>
                                      {post.isMatchTalk ? '🏆' : boardNumber}
                                  </span>
                                  <span className={`text-[9px] sm:text-[10px] font-black px-2 py-[2px] rounded uppercase shrink-0 border transition-colors ${post.isMatchTalk ? 'bg-blue-900/30 text-blue-400 border-blue-500/30 group-hover:border-blue-500/60' : 'bg-slate-800 text-slate-400 border-slate-700 shadow-inner group-hover:border-emerald-500/50 group-hover:text-emerald-400'}`}>
                                      {post.cat}
                                  </span>
                                  
                                  {post.isMatchTalk ? (
                                      <div className="flex flex-col min-w-0 flex-1 overflow-visible pr-6">
                                          <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold truncate pr-4">{post.subTitle}</span>
                                          <h3 className="text-white font-black text-[13px] sm:text-[15px] truncate group-hover:text-blue-400 transition-colors leading-tight italic pr-4 mt-0.5">
                                              {post.title}
                                          </h3>
                                      </div>
                                  ) : (
                                      <h3 className="text-slate-100 font-bold text-[13px] sm:text-[14px] truncate group-hover:text-emerald-400 transition-colors leading-normal pr-6 overflow-visible">
                                          {post.title}
                                          {(!post.isMatchTalk && (post.imageUrl || post.youtubeId)) && <span className="text-emerald-500 text-[9px] ml-1.5 font-black uppercase tracking-tighter shrink-0 align-middle">{post.youtubeId ? 'Y' : 'I'}</span>}
                                      </h3>
                                  )}
                              </div>
                              
                              <div className="flex items-center gap-2.5 shrink-0 ml-2">
                                  {(!post.isMatchTalk && (post.imageUrl || post.youtubeId)) && (
                                      <img src={post.imageUrl || `https://img.youtube.com/vi/${post.youtubeId}/mqdefault.jpg`} alt="thumb" className="w-[36px] h-[40px] rounded-lg object-cover border border-slate-700 block shrink-0" />
                                  )}
                                  <div className={`flex flex-col items-center justify-center rounded-[10px] w-[40px] h-[44px] shrink-0 shadow-inner transition-colors ${post.comments?.length > 0 ? (post.isMatchTalk ? 'bg-blue-950/50 border border-blue-500/30' : 'bg-emerald-950/50 border border-emerald-500/30') : 'bg-[#0f172a] border border-slate-800'}`}>
                                      <span className={`text-[12px] sm:text-[14px] font-black leading-none mb-0.5 ${post.comments?.length > 0 ? (post.isMatchTalk ? 'text-blue-400' : 'text-emerald-400') : 'text-slate-400'}`}>{post.comments?.length || 0}</span>
                                      <span className={`text-[8px] font-bold leading-none ${post.comments?.length > 0 ? (post.isMatchTalk ? 'text-blue-500' : 'text-emerald-500') : 'text-slate-500'}`}>
                                          {post.isMatchTalk ? '매치톡' : '댓글'}
                                      </span>
                                  </div>
                              </div>
                          </div>
                          )
                      })}
                      
                      {hasMore && (
                          <div className="p-3 border-t border-slate-800/50 flex justify-center bg-slate-900/30">
                              <button onClick={() => setVisibleCount(v => v + 10)} className="text-slate-400 text-[11px] font-bold px-5 py-2.5 bg-slate-800 rounded-full hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-1.5 active:scale-95 shadow-lg">
                                  더 보기 ▼
                              </button>
                          </div>
                      )}
                  </div>

                  {user && category !== '매치톡' && (
                      <div className="flex justify-end pt-5 pb-8">
                        <button 
                            onClick={() => { setViewMode('WRITE'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl text-[12px] sm:text-[13px] font-black transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 tracking-widest uppercase"
                        >
                            <Edit3 size={16} />
                            <span>글쓰기</span>
                        </button>
                      </div>
                  )}
              </>
          )}
        </>
      )}
    </div>
  );
};

export default LockerRoomView;