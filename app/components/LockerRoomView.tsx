"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase'; 
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc, serverTimestamp, addDoc, deleteDoc } from 'firebase/firestore';
import { MessageSquare, ThumbsUp, Edit3, Image as ImageIcon, Youtube, ArrowLeft, Send, Trash2 } from 'lucide-react';
import { FALLBACK_IMG } from '../types';
import MatchTalkBoard from './MatchTalkBoard';

interface UserData {
  uid: string;
  mappedOwnerId: string;
  role?: 'ADMIN' | 'USER';
  photoUrl?: string;
  photoURL?: string; 
  photo?: string;
}

const COMMON_DEFAULT_PROFILE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2364748b'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

// 💡 [클린 코드] 반복되는 띄어쓰기/특수기호 무시 로직 유틸 함수
const normalizeName = (str?: string | null): string => {
    return (str || '').replace(/[\s\.\-\_]/g, '').toLowerCase();
};

// 💡 [클린 코드] 불량 이미지(라인 스티커 등) 판독기
const isBadImage = (url?: string | null): boolean => {
    return !url || url.trim() === '' || url.includes('line-scdn.net') || url === FALLBACK_IMG;
};

// 💡 [TS 에러 픽스] 무조건 문자열(string)을 반환하도록 타입 명시하여 ts(2322) 차단
const getBestProfileImage = (
    userObj?: any | null, 
    ownersList?: any[] | null, 
    savedPhoto?: string | null, 
    authorName?: string | null
): string => {
    const targetName = authorName || userObj?.mappedOwnerId;

    if (userObj && targetName === userObj.mappedOwnerId && !isBadImage(userObj.photo)) {
        return String(userObj.photo);
    }

    if (targetName && ownersList && ownersList.length > 0) {
        const targetFuzzy = normalizeName(targetName);
        const matchedOwner = ownersList.find(o => normalizeName(o.nickname) === targetFuzzy);
        if (matchedOwner && !isBadImage(matchedOwner.photo)) {
            return String(matchedOwner.photo);
        }
    }

    if (userObj && targetName === userObj.mappedOwnerId) {
        if (!isBadImage(userObj.photoURL)) return String(userObj.photoURL);
        if (!isBadImage(userObj.photoUrl)) return String(userObj.photoUrl);
    }

    if (!isBadImage(savedPhoto)) {
        return String(savedPhoto);
    }

    return COMMON_DEFAULT_PROFILE;
};

// 💡 [TS 에러 픽스] null 반환을 제거하고 빈 문자열('')을 반환하도록 강제
const getValidYoutubeId = (url?: string, id?: string): string => {
    let finalId = id || '';
    if (!finalId || finalId === 'undefined' || finalId === 'null') {
        const match = url?.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([a-zA-Z0-9_-]{11})/);
        finalId = match ? match[1] : '';
    }
    return (finalId && finalId !== 'undefined' && finalId !== 'null' && finalId.trim() !== '') ? finalId : '';
};

const formatDate = (ts: any, includeTime = false): string => {
    if (!ts) return '방금 전';
    let d = typeof ts === 'number' ? new Date(ts) : typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return '방금 전';
    
    const datePart = `${String(d.getFullYear()).slice(-2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    const timePart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return includeTime ? `${datePart} ${timePart}` : datePart;
};

const LockerRoomView = ({ user, notices = [], seasons = [], masterTeams = [], owners = [] }: { user: UserData | null, notices: any[], seasons?: any[], masterTeams?: any[], owners?: any[] }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [category, setCategory] = useState('전체');
  const [viewMode, setViewMode] = useState<'LIST' | 'WRITE' | 'EDIT'>('LIST');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const [postForm, setPostForm] = useState({ title: '', content: '', cat: '자유', imageUrl: '', youtubeUrl: '' });
  
  const [commentText, setCommentText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [editCommentText, setEditCommentText] = useState('');
  
  const [replyingTo, setReplyingTo] = useState<{ parentId: string, targetId: string, authorName: string } | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const isMaster = useMemo(() => {
      if (!user) return false;
      if (user.role === 'ADMIN') return true; 
      
      const targetFuzzy = normalizeName(user.mappedOwnerId);
      return owners.some(o => {
          const isNameMatch = normalizeName(o.nickname) === targetFuzzy;
          const isIdMatch = String(o.id) === user.uid || String((o as any).docId) === user.uid;
          return (isNameMatch || isIdMatch) && (o as any).role === 'ADMIN';
      });
  }, [user, owners]);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedPosts.sort((a: any, b: any) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));
      setPosts(fetchedPosts);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const syncState = () => {
        const params = new URLSearchParams(window.location.search);
        const pId = params.get('postId');
        const currentView = params.get('view');
        if (currentView === 'LOCKERROOM' && !pId) { setSelectedPostId(null); setViewMode('LIST'); } 
        else if (pId && pId !== selectedPostId) { setSelectedPostId(pId); setViewMode('LIST'); } 
        else if (!pId && selectedPostId) { setSelectedPostId(null); setViewMode('LIST'); }
    };
    syncState();
    window.addEventListener('popstate', syncState);
    return () => window.removeEventListener('popstate', syncState);
  }, [selectedPostId]);

  const handlePostClick = async (post: any) => {
    setSelectedPostId(post.id);
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        params.set('view', 'LOCKERROOM'); params.set('postId', post.id);
        window.history.pushState(null, '', `?${params.toString()}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (post.id && posts.find(p => p.id === post.id)) {
        try {
            const postRef = doc(db, 'posts', post.id);
            const postSnap = await getDoc(postRef);
            if (postSnap.exists()) await updateDoc(postRef, { views: (postSnap.data().views || 0) + 1 });
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

  const handleShareLink = () => { navigator.clipboard.writeText(window.location.href).then(() => alert('🔗 게시글 링크가 복사되었습니다!')); };

  const handleReaction = async (post: any, type: 'LIKE' | 'DISLIKE') => {
      if (!user || !post.id) return alert("🚨 로그인이 필요합니다.");
      try {
          const isNotice = !!notices.find(n => n.id === post.id);
          const postRef = doc(db, isNotice ? 'notices' : 'posts', post.id);
          const postSnap = await getDoc(postRef);
          if (!postSnap.exists()) return;
          
          const postData = postSnap.data();
          let likes = (isNotice ? postData.likedBy : postData.likes) || [];
          let dislikes = (isNotice ? postData.dislikedBy : postData.dislikes) || [];

          if (type === 'LIKE') {
              if (likes.includes(user.uid)) likes = likes.filter((uid: string) => uid !== user.uid);
              else { likes.push(user.uid); dislikes = dislikes.filter((uid: string) => uid !== user.uid); }
          } else {
              if (dislikes.includes(user.uid)) dislikes = dislikes.filter((uid: string) => uid !== user.uid);
              else { dislikes.push(user.uid); likes = likes.filter((uid: string) => uid !== user.uid); }
          }

          await updateDoc(postRef, isNotice ? { likedBy: likes, dislikedBy: dislikes } : { likes, dislikes });
      } catch (error) { console.error(error); }
  };

  const handleWritePost = async () => {
    if (!user) return alert("🚨 로그인이 필요합니다!");
    if (!postForm.title.trim() || !postForm.content.trim()) return alert("🚨 제목과 내용을 모두 입력해주세요!");

    try {
      if (viewMode === 'WRITE') {
          const docRef = await addDoc(collection(db, 'posts'), {
            title: postForm.title, content: postForm.content, cat: postForm.cat,
            imageUrl: postForm.imageUrl ? postForm.imageUrl.trim() : '', 
            youtubeId: getValidYoutubeId(postForm.youtubeUrl, ''), 
            authorId: user.uid, authorName: user.mappedOwnerId || '미배정 오너', 
            authorPhoto: getBestProfileImage(user, owners, user.photoURL, user.mappedOwnerId), 
            createdAt: serverTimestamp(), isPinned: false, isEdited: false, views: 0, likes: [], dislikes: [], comments: []
          });
          alert("✅ 게시글이 등록되었습니다!");
          setViewMode('LIST'); setPostForm({ title: '', content: '', cat: '자유', imageUrl: '', youtubeUrl: '' });
          setSelectedPostId(docRef.id);
          const url = new URL(window.location.href); url.searchParams.set('postId', docRef.id); window.history.pushState(null, '', url.toString());
          window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (viewMode === 'EDIT' && editingPostId) {
          await updateDoc(doc(db, 'posts', editingPostId), {
            title: postForm.title, content: postForm.content, cat: postForm.cat,
            imageUrl: postForm.imageUrl ? postForm.imageUrl.trim() : '', 
            youtubeId: getValidYoutubeId(postForm.youtubeUrl, ''), isEdited: true
          });
          alert("✅ 게시글이 수정되었습니다!");
          setViewMode('LIST'); setEditingPostId(null); setPostForm({ title: '', content: '', cat: '자유', imageUrl: '', youtubeUrl: '' });
      }
    } catch (e: any) { alert("🚨 오류 발생: " + e.message); }
  };

  const handleOpenEdit = (post: any) => {
      setPostForm({ title: post.title, content: post.content, cat: post.cat, imageUrl: post.imageUrl || '', youtubeUrl: post.youtubeId ? `https://youtube.com/watch?v=${post.youtubeId}` : '' });
      setEditingPostId(post.id); setViewMode('EDIT'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePost = async (postId: string) => {
      if (!window.confirm("정말 이 게시글을 삭제하시겠습니까?")) return;
      try {
          const isNotice = !!notices.find(n => n.id === postId);
          await deleteDoc(doc(db, isNotice ? 'notices' : 'posts', postId));
          alert("🗑️ 삭제되었습니다."); 
          if (selectedPostId === postId) handleCloseView(); 
      } catch (e) { alert("삭제 실패"); }
  };

  const submitComment = async (postId: string, isReply: boolean) => {
      if (!user) return alert("🚨 로그인이 필요합니다.");
      const textToSubmit = isReply ? replyText.trim() : commentText.trim();
      if (!textToSubmit) return alert("내용을 입력해주세요.");
      if (isReply && !replyingTo) return;

      const isNotice = !!notices.find(n => n.id === postId);
      const post = posts.find(p => p.id === postId) || notices.find(n => n.id === postId);
      if (!post) return;

      const authorName = user.mappedOwnerId || '미배정 오너';
      const authorPhoto = getBestProfileImage(user, owners, user.photoURL, authorName);

      try {
          if (isNotice) {
              let updatedComments = [...(post.replies || post.comments || [])];
              const newComment = {
                  id: `reply_${Date.now()}`, ownerId: user.uid, ownerName: authorName, ownerPhoto: authorPhoto, 
                  text: textToSubmit, createdAt: new Date().toISOString(), likedBy: [], isEdited: false
              };
              if (isReply) {
                  updatedComments = updatedComments.map((c:any) => c.id === replyingTo!.parentId ? { ...c, replies: [...(c.replies || []), newComment] } : c);
              } else {
                  updatedComments.push(newComment);
              }
              await updateDoc(doc(db, 'notices', postId), { replies: updatedComments, comments: updatedComments });
          } else {
              let updatedComments = [...(post.comments || [])];
              updatedComments.push({
                  id: `cmt_${Date.now()}`, authorId: user.uid, authorName: authorName, authorPhoto: authorPhoto, 
                  text: textToSubmit, createdAt: Date.now(), parentId: isReply ? replyingTo!.parentId : null, likes: [], isEdited: false
              });
              await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
          }
          isReply ? setReplyText('') : setCommentText('');
          if (isReply) setReplyingTo(null);
      } catch (e) { alert("처리 실패"); }
  };

  const handleSaveEdit = async (postId: string) => {
      if (!user || !editCommentText.trim() || !editingCommentId) return;
      const isNotice = !!notices.find(n => n.id === postId);
      const post = posts.find(p => p.id === postId) || notices.find(n => n.id === postId);
      if (!post) return;

      try {
          if (isNotice) {
              let updatedComments = [...(post.replies || post.comments || [])];
              updatedComments = updatedComments.map((c:any) => {
                  if (c.id === editingCommentId) return { ...c, text: editCommentText.trim(), isEdited: true };
                  if (c.replies) c.replies = c.replies.map((r:any) => r.id === editingCommentId ? { ...r, text: editCommentText.trim(), isEdited: true } : r);
                  return c;
              });
              await updateDoc(doc(db, 'notices', postId), { replies: updatedComments, comments: updatedComments });
          } else {
              let updatedComments = [...(post.comments || [])];
              updatedComments = updatedComments.map((c:any) => c.id === editingCommentId ? { ...c, text: editCommentText.trim(), isEdited: true } : c);
              await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
          }
          setEditCommentText(''); setEditingCommentId(null);
      } catch (e) { alert("수정 처리 실패"); }
  };

  const handleCommentReaction = async (postId: string, commentId: string, parentId?: string) => {
      if (!user) return alert("🚨 로그인이 필요합니다.");
      const isNotice = !!notices.find(n => n.id === postId);
      const post = posts.find(p => p.id === postId) || notices.find(n => n.id === postId);
      if (!post) return;

      try {
          if (isNotice) {
              let rootArray = [...(post.replies || post.comments || [])];
              const toggleLike = (arr: string[]) => arr.includes(user.uid) ? arr.filter(id => id !== user.uid) : [...arr, user.uid];
              if (parentId) {
                  rootArray = rootArray.map((c:any) => c.id === parentId ? { ...c, replies: (c.replies||[]).map((r:any) => r.id === commentId ? { ...r, likedBy: toggleLike(r.likedBy||[]) } : r) } : c);
              } else {
                  rootArray = rootArray.map((c:any) => c.id === commentId ? { ...c, likedBy: toggleLike(c.likedBy||[]) } : c);
              }
              await updateDoc(doc(db, 'notices', postId), { replies: rootArray, comments: rootArray });
          } else {
              let updatedComments = [...(post.comments || [])];
              updatedComments = updatedComments.map((c:any) => c.id === commentId ? { ...c, likes: c.likes?.includes(user.uid) ? c.likes.filter((id: string) => id !== user.uid) : [...(c.likes||[]), user.uid] } : c);
              await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
          }
      } catch (e) { console.error(e); }
  };

  const handleDeleteComment = async (postId: string, commentId: string, parentId?: string) => {
      if (!window.confirm("댓글을 삭제하시겠습니까? (답글이 있다면 함께 삭제됩니다)")) return;
      const isNotice = !!notices.find(n => n.id === postId);
      
      if (isNotice) {
          const post = notices.find(n => n.id === postId);
          let rootArray = [...(post?.replies || post?.comments || [])];
          if (parentId) rootArray = rootArray.map((c:any) => c.id === parentId ? { ...c, replies: (c.replies||[]).filter((r:any) => r.id !== commentId) } : c);
          else rootArray = rootArray.filter((c:any) => c.id !== commentId);
          await updateDoc(doc(db, 'notices', postId), { replies: rootArray, comments: rootArray });
      } else {
          const post = posts.find(p => p.id === postId);
          let updatedComments = [...(post?.comments || [])].filter((c: any) => c.id !== commentId && c.parentId !== commentId);
          await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
      }
  };

  const handleEditCommentSetup = (comment: any) => { setEditingCommentId(comment.id); setReplyingTo(null); setEditCommentText(comment.text); };
  const handleReplySetup = (parentId: string, targetId: string, authorName: string) => { setReplyingTo({ parentId, targetId, authorName }); setEditingCommentId(null); setReplyText(''); setTimeout(() => commentInputRef.current?.focus(), 100); };
  const handleCancelAction = () => { setReplyingTo(null); setEditingCommentId(null); setReplyText(''); setEditCommentText(''); };

  const activePost = useMemo(() => {
      if (!selectedPostId || selectedPostId.startsWith('match_')) return null;
      return posts.find(p => p.id === selectedPostId) || notices.find(n => n.id === selectedPostId);
  }, [selectedPostId, posts, notices]);

  const filteredPosts = posts.filter(p => category === '전체' || p.cat === category);
  const visiblePostsList = filteredPosts.slice(0, visibleCount);
  const hasMore = visiblePostsList.length < filteredPosts.length;

  // 🔥 [완벽 픽스] 공지사항 작성자가 '운영진'이거나 없을 경우, 최고 관리자(ADMIN)의 프로필을 강제로 연결
  const getNoticeAuthorData = (post: any): { name: string; photo: string } => {
      if (!post) return { name: '운영진', photo: COMMON_DEFAULT_PROFILE };
      
      const rawName = post.authorName || post.ownerName;
      const rawId = post.authorId || post.ownerId;
      const rawPhoto = post.authorPhoto || post.ownerPhoto;

      let matchedOwner = null;

      // 1. 작성자 이름이나 ID가 있으면 명부에서 매칭 시도
      if (rawName || rawId) {
          const targetFuzzy = normalizeName(rawName);
          matchedOwner = owners.find(o => 
              normalizeName(o.nickname) === targetFuzzy || 
              String(o.id) === String(rawId)
          );
      }

      // 2. 작성자가 없거나 '운영진'인 경우 무조건 최고 관리자(ADMIN) 계정을 찾아서 덮어씌움
      if (!matchedOwner && (!rawName || rawName === '운영진')) {
          matchedOwner = owners.find((o: any) => o.role === 'ADMIN');
      }

      // 3. 최종 이름과 사진 추출 (불타는 베컴 프사 적용)
      const finalName = matchedOwner?.nickname || rawName || '운영진';
      const finalPhoto = getBestProfileImage(user, owners, rawPhoto, finalName);

      return { name: finalName, photo: finalPhoto };
  };

  const renderComments = (rawComments: any[], postId: string) => {
      const isNotice = !!notices.find(n => n.id === postId);
      const commentsList = rawComments || [];
      const topLevel = isNotice ? commentsList : commentsList.filter((c: any) => !c.parentId);
      
      return topLevel.map((comment: any) => {
          const replies = isNotice ? (comment.replies || []) : commentsList.filter((c: any) => c.parentId === comment.id);
          const isLiked = isNotice ? comment.likedBy?.includes(user?.uid) : comment.likes?.includes(user?.uid);
          const cName = comment.authorName || comment.ownerName || '알 수 없음';
          const authorProfileImg = getBestProfileImage(user, owners, comment.authorPhoto || comment.ownerPhoto, cName);
          const isMyComment = user?.uid === comment.authorId || user?.uid === comment.ownerId;

          return (
              <div key={comment.id} className="border-b border-slate-800/60 py-5 last:border-0">
                  <div className="flex gap-3.5">
                      <img src={authorProfileImg} alt="profile" className="w-9 h-9 rounded-full object-cover shrink-0 bg-slate-800 border border-slate-700" onError={(e: any) => { e.target.src = COMMON_DEFAULT_PROFILE; }} />
                      <div className="flex-1 min-w-0 pr-6 overflow-visible">
                          <div className="flex items-baseline gap-2 mb-1.5">
                              <span className="font-bold text-emerald-400 text-sm italic whitespace-nowrap">{cName}</span>
                              <span className="text-slate-500 text-[10px] whitespace-nowrap">{formatDate(comment.createdAt, true)}</span>
                              {comment.isEdited && <span className="text-slate-600 text-[10px] italic">(수정됨)</span>}
                          </div>
                          
                          {editingCommentId === comment.id ? (
                              <div className="mt-1 flex flex-col gap-2">
                                  <input value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); handleSaveEdit(postId); } }} className="w-full bg-slate-900/80 p-3 rounded-lg border border-emerald-500/50 text-white text-[14px] sm:text-[15px] focus:outline-none focus:border-emerald-500" />
                                  <div className="flex justify-end gap-2">
                                      <button onClick={handleCancelAction} className="px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-white bg-slate-800 rounded transition-colors">취소</button>
                                      <button onClick={() => handleSaveEdit(postId)} className="px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors shadow-lg">저장</button>
                                  </div>
                              </div>
                          ) : (
                              <p className="text-[14px] sm:text-[15px] text-slate-200 leading-snug whitespace-pre-wrap mb-2.5 font-medium tracking-tight">{comment.text}</p>
                          )}

                          {!editingCommentId && (
                              <div className="flex items-center gap-4 text-[12px] text-slate-400 font-bold mt-1">
                                  <button onClick={() => handleCommentReaction(postId, comment.id)} className={`flex items-center gap-1 hover:text-emerald-400 transition-colors ${isLiked ? 'text-emerald-400' : ''}`}><ThumbsUp size={13} className={isLiked ? 'fill-emerald-400' : ''}/> 좋아요 {(isNotice ? comment.likedBy : comment.likes)?.length || 0}</button>
                                  <button onClick={() => handleReplySetup(comment.id, comment.id, cName)} className="flex items-center gap-1 hover:text-white transition-colors"><MessageSquare size={13}/> 답글 {replies.length > 0 ? replies.length : ''}</button>
                                  {(isMyComment || isMaster) && (
                                      <div className="flex items-center gap-3 ml-auto text-[11px]">
                                          {isMyComment && <button onClick={() => handleEditCommentSetup(comment)} className="hover:text-blue-400">수정</button>}
                                          <button onClick={() => handleDeleteComment(postId, comment.id)} className="hover:text-red-400">삭제</button>
                                      </div>
                                  )}
                              </div>
                          )}

                          {replyingTo?.targetId === comment.id && !editingCommentId && (
                              <div className="mt-3 flex items-stretch gap-2 animate-in fade-in slide-in-from-top-1">
                                  <input ref={commentInputRef} value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submitComment(postId, true); } }} placeholder={`${replyingTo?.authorName || '작성자'}님에게 답글 작성 중...`} className="flex-1 bg-slate-900 px-3 py-2 rounded-lg border border-slate-700 text-white text-[12px] placeholder-slate-600 focus:border-emerald-500 transition-colors shadow-inner" />
                                  <button onClick={() => submitComment(postId, true)} className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg transition-all shadow-lg shrink-0">등록</button>
                                  <button onClick={handleCancelAction} className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-[11px] rounded-lg transition-all shrink-0">취소</button>
                              </div>
                          )}
                      </div>
                  </div>

                  {replies.length > 0 && (
                      <div className="mt-4 space-y-4 pl-4 sm:pl-12 border-l-2 border-slate-800/50">
                          {replies.map((reply: any) => {
                              const isReplyLiked = isNotice ? reply.likedBy?.includes(user?.uid) : reply.likes?.includes(user?.uid);
                              const rName = reply.authorName || reply.ownerName || '알 수 없음';
                              const replyAuthorProfileImg = getBestProfileImage(user, owners, reply.authorPhoto || reply.ownerPhoto, rName);
                              const isMyReply = user?.uid === reply.authorId || user?.uid === reply.ownerId;

                              return (
                                  <div key={reply.id} className="flex gap-3">
                                      <img src={replyAuthorProfileImg} alt="profile" className="w-8 h-8 rounded-full object-cover shrink-0 bg-slate-800 border border-slate-700" onError={(e: any) => { e.target.src = COMMON_DEFAULT_PROFILE; }} />
                                      <div className="flex-1 min-w-0 pr-6 overflow-visible">
                                          <div className="flex items-baseline gap-2 mb-1.5">
                                              <span className="font-bold text-emerald-400 text-sm italic whitespace-nowrap">{rName}</span>
                                              <span className="text-slate-500 text-[10px] whitespace-nowrap">{formatDate(reply.createdAt, true)}</span>
                                              {reply.isEdited && <span className="text-slate-600 text-[10px] italic">(수정됨)</span>}
                                          </div>
                                          
                                          {editingCommentId === reply.id ? (
                                              <div className="mt-1 flex flex-col gap-2">
                                                  <input value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); handleSaveEdit(postId); } }} className="w-full bg-slate-900/80 p-3 rounded-lg border border-emerald-500/50 text-white text-[14px] sm:text-[15px] focus:outline-none focus:border-emerald-500" />
                                                  <div className="flex justify-end gap-2">
                                                      <button onClick={handleCancelAction} className="px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-white bg-slate-800 rounded transition-colors">취소</button>
                                                      <button onClick={() => handleSaveEdit(postId)} className="px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors shadow-lg">저장</button>
                                                  </div>
                                              </div>
                                          ) : (
                                              <p className="text-[14px] sm:text-[15px] text-slate-300 leading-snug whitespace-pre-wrap mb-2.5 font-medium">{reply.text}</p>
                                          )}

                                          {!editingCommentId && (
                                              <div className="flex items-center gap-4 text-[11px] text-slate-400 font-bold mt-1">
                                                  <button onClick={() => handleCommentReaction(postId, reply.id, comment.id)} className={`flex items-center gap-1 hover:text-emerald-400 transition-colors ${isReplyLiked ? 'text-emerald-400' : ''}`}><ThumbsUp size={12} className={isReplyLiked ? 'fill-emerald-400' : ''}/> 좋아요 {(isNotice ? reply.likedBy : reply.likes)?.length || 0}</button>
                                                  <button onClick={() => handleReplySetup(comment.id, reply.id, rName)} className="flex items-center gap-1 hover:text-white transition-colors"><MessageSquare size={12}/> 답글</button>
                                                  {(isMyReply || isMaster) && (
                                                      <div className="flex items-center gap-3 ml-auto">
                                                          {isMyReply && <button onClick={() => handleEditCommentSetup(reply)} className="hover:text-blue-400">수정</button>}
                                                          <button onClick={() => handleDeleteComment(postId, reply.id, comment.id)} className="hover:text-red-400">삭제</button>
                                                      </div>
                                                  )}
                                              </div>
                                          )}

                                          {replyingTo?.targetId === reply.id && !editingCommentId && (
                                              <div className="mt-3 flex items-stretch gap-2 animate-in fade-in slide-in-from-top-1">
                                                  <input ref={commentInputRef} value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submitComment(postId, true); } }} placeholder={`${replyingTo?.authorName || '작성자'}님에게 답글 작성 중...`} className="flex-1 bg-slate-900 px-3 py-2 rounded-lg border border-slate-700 text-white text-[12px] placeholder-slate-600 focus:border-emerald-500 transition-colors shadow-inner" />
                                                  <button onClick={() => submitComment(postId, true)} className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg transition-all shadow-lg shrink-0">등록</button>
                                                  <button onClick={handleCancelAction} className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-[11px] rounded-lg transition-all shrink-0">취소</button>
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

      {viewMode === 'LIST' && (
        <>
          {selectedPostId ? (
              selectedPostId.startsWith('match_') ? (
                  <MatchTalkBoard 
                      user={user} seasons={seasons} masterTeams={masterTeams} owners={owners} 
                      selectedMatchId={selectedPostId} 
                      onSelectMatch={(id) => {
                          setSelectedPostId(id);
                          const params = new URLSearchParams(window.location.search);
                          params.set('view', 'LOCKERROOM'); params.set('postId', id);
                          window.history.pushState(null, '', `?${params.toString()}`);
                      }} 
                      onClose={handleCloseView} 
                  />
              ) : activePost ? (
                  <div className="animate-in slide-in-from-bottom-4 space-y-4">
                      <div className="mb-2">
                          <button onClick={handleCloseView} className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors font-bold text-[11px] sm:text-[12px] bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 shadow-inner w-max">
                              <ArrowLeft size={14} /> <span>목록으로 뒤로 가기</span>
                          </button>
                      </div>

                      <div className="bg-[#0f172a] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
                          <div className="p-5 sm:p-7 border-b border-slate-800">
                              <div className="flex justify-between items-start mb-3">
                                  <span className="bg-emerald-400/10 text-emerald-400 border-emerald-500/30 font-black text-[10px] tracking-widest uppercase px-2.5 py-0.5 rounded border flex items-center gap-1">
                                      {activePost.cat || '전체공지'}
                                  </span>
                                  {(user?.uid === (activePost.authorId || activePost.ownerId) || isMaster) && (
                                      <div className="flex gap-2 text-[10px] font-bold">
                                          <button onClick={() => handleDeletePost(activePost.id)} className="bg-slate-900 border border-slate-700 text-slate-400 px-3 py-1.5 rounded-lg hover:text-red-400 transition-all shadow-sm">🗑️ 삭제</button>
                                      </div>
                                  )}
                              </div>
                              
                              <div className="flex flex-col mb-3 pr-6 overflow-visible">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                                      <h2 className="text-[18px] sm:text-[20px] font-bold text-white leading-tight break-keep">{activePost.title}</h2>
                                  </div>
                              </div>
                              
                              <div className="flex items-center justify-between mt-4">
                                  <div className="flex items-center gap-2.5">
                                      <img src={getNoticeAuthorData(activePost).photo} onError={(e: any) => { e.target.src = COMMON_DEFAULT_PROFILE; }} alt="profile" className="w-8 h-8 rounded-full object-cover border border-slate-700 bg-slate-800" />
                                      <div className="flex flex-col">
                                          <span className="text-[12px] sm:text-[13px] font-bold text-emerald-400 leading-tight">
                                              {getNoticeAuthorData(activePost).name}
                                          </span>
                                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                                              <span>{formatDate(activePost.createdAt, true)}</span>
                                              {activePost.views !== undefined && <span>• 조회 {activePost.views}</span>}
                                          </div>
                                      </div>
                                  </div>

                                  <button onClick={handleShareLink} className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition-colors border border-slate-700 shadow-sm shrink-0">
                                      🔗 공유하기
                                  </button>
                              </div>
                              
                              <div className="h-px w-full bg-slate-800/60 my-5"></div>
                              
                              <div className="space-y-5 mb-6">
                                  {getValidYoutubeId(activePost.youtubeUrl, activePost.youtubeId) && (
                                      <div className="aspect-video w-full rounded-xl overflow-hidden border border-slate-800 shadow-lg bg-black">
                                          <iframe src={`https://www.youtube.com/embed/${getValidYoutubeId(activePost.youtubeUrl, activePost.youtubeId)}`} className="w-full h-full" allowFullScreen></iframe>
                                      </div>
                                  )}
                                  
                                  {activePost.imageUrl && (
                                      <div className="w-full rounded-xl overflow-hidden border border-slate-800 shadow-lg bg-black/20">
                                          <img src={activePost.imageUrl} alt="첨부이미지" className="w-full h-auto object-contain mx-auto max-h-[500px]" />
                                      </div>
                                  )}
                                  <div className="text-slate-300 text-[14px] sm:text-[15px] leading-relaxed whitespace-pre-wrap font-medium not-italic">
                                      {activePost.content}
                                  </div>
                              </div>
                          </div>

                          <div className="bg-slate-900/50 p-4 sm:p-5 flex justify-center gap-3 border-b border-slate-800">
                              <button onClick={() => handleReaction(activePost, 'LIKE')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-black text-[12px] border transition-all shadow-sm ${(activePost.likes || activePost.likedBy)?.includes(user?.uid) ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                                  👍 좋아요 {(activePost.likes || activePost.likedBy)?.length || 0}
                              </button>
                              <button onClick={() => handleReaction(activePost, 'DISLIKE')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-black text-[12px] border transition-all shadow-sm ${(activePost.dislikes || activePost.dislikedBy)?.includes(user?.uid) ? 'bg-red-600/20 border-red-500 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                                  👎 싫어요 {(activePost.dislikes || activePost.dislikedBy)?.length || 0}
                              </button>
                          </div>

                          <div className="p-4 sm:p-6 bg-slate-950/30">
                              <h4 className="text-[12px] sm:text-[13px] font-black text-white uppercase mb-4 flex items-center gap-2 tracking-widest italic">
                                  💬 Comments <span className="text-emerald-500 ml-1">{(activePost.comments || activePost.replies || []).length}</span>
                              </h4>
                              
                              <div className="mb-6 border-t border-slate-800/50">
                                  {(!(activePost.comments || activePost.replies) || (activePost.comments || activePost.replies).length === 0) && (
                                      <p className="text-[11px] text-slate-500 italic py-5 font-bold">가장 먼저 의견을 남겨보세요!</p>
                                  )}
                                  {(activePost.comments || activePost.replies) && (activePost.comments || activePost.replies).length > 0 && renderComments(activePost.comments || activePost.replies, activePost.id)}
                              </div>

                              {user ? (
                                  !replyingTo && (
                                      <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/50 mt-4">
                                          <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest pl-1 mb-0.5">새로운 의견 남기기</div>
                                          <div className="flex flex-col sm:flex-row items-stretch gap-2">
                                              <div className="flex items-center gap-2 bg-slate-900 p-1.5 px-2.5 rounded-xl border border-slate-700 shrink-0 shadow-inner">
                                                  <img src={getBestProfileImage(user, owners, user?.photoURL, user?.mappedOwnerId)} onError={(e: any) => { e.target.src = COMMON_DEFAULT_PROFILE; }} className="w-6 h-6 rounded-full object-cover border border-slate-800 bg-slate-800 shrink-0" alt="" />
                                                  <span className="bg-transparent border-none text-white text-[10px] font-bold outline-none pr-2 truncate">
                                                      {user?.mappedOwnerId}
                                                  </span>
                                              </div>

                                              <div className="flex flex-1 items-stretch gap-2">
                                                  <input 
                                                      value={commentText} 
                                                      onChange={(e) => setCommentText(e.target.value)} 
                                                      onKeyDown={(e) => { 
                                                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submitComment(activePost.id, false); }
                                                      }}
                                                      placeholder="내용을 입력하세요..."
                                                      className="flex-1 bg-slate-900 px-4 py-2.5 sm:py-3 rounded-xl border border-slate-700 text-white text-[12px] sm:text-[13px] placeholder-slate-600 focus:border-emerald-500 transition-colors shadow-inner font-medium"
                                                  />
                                                  <button onClick={() => submitComment(activePost.id, false)} className="px-5 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] rounded-xl transition-all shadow-lg shrink-0 active:scale-95 flex items-center">
                                                      등록 <Send size={14} className="ml-1.5" />
                                                  </button>
                                              </div>
                                          </div>
                                      </div>
                                  )
                              ) : (
                                  <div className="bg-slate-900/50 border border-slate-800/80 text-slate-500 text-[11px] font-bold p-4 rounded-xl text-center shadow-inner">
                                      로그인 후 참여할 수 있습니다.
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              ) : null
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

                  {category === '매치톡' ? (
                      <MatchTalkBoard 
                          user={user} seasons={seasons} masterTeams={masterTeams} owners={owners} 
                          selectedMatchId={null} 
                          onSelectMatch={(id) => {
                              setSelectedPostId(id);
                              const params = new URLSearchParams(window.location.search);
                              params.set('view', 'LOCKERROOM'); params.set('postId', id);
                              window.history.pushState(null, '', `?${params.toString()}`);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                          }} 
                          onClose={handleCloseView} 
                      />
                  ) : (
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
                                          <span className="flex items-center gap-1"><span className="opacity-70 text-[11px] sm:text-[13px]">💬</span> {(notice.comments || notice.replies)?.length || 0}</span>
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
                              const boardNumber = filteredPosts.length - index; 
                              const ytId = getValidYoutubeId(post.youtubeUrl, post.youtubeId);
                              const hasImg = !!post.imageUrl;
                              const thumbSrc = post.imageUrl || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null);
                              const commentCount = post.comments?.length || 0;

                              return (
                              <div key={post.id} onClick={() => handlePostClick(post)} className={`flex items-center p-3 sm:p-4 hover:bg-slate-800/40 transition-colors cursor-pointer group ${selectedPostId === post.id ? 'bg-slate-800/30' : ''}`}>
                                  <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 pl-1 pr-8">
                                      <span className={`text-slate-500 font-black italic text-[11px] sm:text-xs w-6 text-center shrink-0`}>
                                          {boardNumber}
                                      </span>
                                      <span className={`text-[9px] sm:text-[10px] font-black px-2 py-[2px] rounded uppercase shrink-0 border transition-colors bg-slate-800 text-slate-400 border-slate-700 shadow-inner group-hover:border-emerald-500/50 group-hover:text-emerald-400`}>
                                          {post.cat}
                                      </span>
                                      
                                      <h3 className="text-slate-100 font-bold text-[13px] sm:text-[14px] truncate group-hover:text-emerald-400 transition-colors leading-normal pr-6 overflow-visible">
                                          {post.title}
                                          {(ytId || hasImg) && (
                                              <span className="text-emerald-500 text-[9px] ml-1.5 font-black uppercase tracking-tighter shrink-0 align-middle">
                                                  {ytId ? 'Y' : 'I'}
                                              </span>
                                          )}
                                      </h3>
                                  </div>
                                  
                                  <div className="flex items-center gap-2.5 shrink-0 ml-2">
                                      {thumbSrc && (
                                          <img src={thumbSrc} alt="thumb" className="w-[36px] h-[40px] rounded-lg object-cover border border-slate-700 block shrink-0" />
                                      )}
                                      <div className={`flex flex-col items-center justify-center rounded-[10px] w-[40px] h-[44px] shrink-0 shadow-inner transition-colors ${commentCount > 0 ? 'bg-emerald-950/50 border border-emerald-500/30' : 'bg-[#0f172a] border border-slate-800'}`}>
                                          <span className={`text-[12px] sm:text-[14px] font-black leading-none mb-0.5 ${commentCount > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>{commentCount}</span>
                                          <span className={`text-[8px] font-bold leading-none ${commentCount > 0 ? 'text-emerald-500' : 'text-slate-500'}`}>댓글</span>
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
                  )}

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