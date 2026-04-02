"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
import { ArrowLeft, MessageSquare, ThumbsUp, Send, BarChart2, Users, CheckCircle2 } from 'lucide-react';
import { FALLBACK_IMG } from '../types';
import StickerSelector from './StickerSelector';

const normalizeName = (str?: string | null): string => (str || '').replace(/[\s\.\-\_]/g, '').toLowerCase();
const isBadImage = (url?: string | null): boolean => !url || url.trim() === '' || url.includes('line-scdn.net') || url === FALLBACK_IMG;
const COMMON_DEFAULT_PROFILE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2364748b'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

const getBestProfileImage = (userObj: any, ownersList: any[], savedPhoto: string, authorName: string) => {
    const targetName = authorName || userObj?.mappedOwnerId || userObj?.displayName;
    if (ownersList && ownersList.length > 0) {
        const matchedOwner = ownersList.find((o: any) => 
            (userObj?.uid && (o.uid === userObj.uid || String(o.id) === String(userObj.uid) || o.docId === userObj.uid)) ||
            normalizeName(o.nickname) === normalizeName(targetName)
        );
        if (matchedOwner && !isBadImage(matchedOwner.photo)) return String(matchedOwner.photo);
    }
    if (userObj?.photoURL && !isBadImage(userObj.photoURL)) return String(userObj.photoURL);
    return savedPhoto && !isBadImage(savedPhoto) ? savedPhoto : COMMON_DEFAULT_PROFILE;
};

const formatDate = (ts: any, includeTime = false) => {
    if (!ts) return '방금 전';
    let d = typeof ts === 'number' ? new Date(ts) : typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return '방금 전';
    const datePart = `${String(d.getFullYear()).slice(-2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    const timePart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return includeTime ? `${datePart} ${timePart}` : datePart;
};

const renderTextWithLinks = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const imageRegex = /\.(jpeg|jpg|gif|png|webp|svg|bmp)(?=[\?&#]|$)/i;

    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
        if (part.match(urlRegex)) {
            if (part.match(imageRegex) || part.includes('_next/image')) {
                return (
                    // 🚨 픽스: 본문 변환 이미지의 라운딩(rounded-xl), 보더(border), 그림자(shadow-md) 삭제
                    <img 
                        key={i} 
                        src={part} 
                        alt="첨부이미지" 
                        className="w-full h-auto my-4 block object-contain max-h-[600px]" 
                        loading="lazy" 
                        onError={(e: any) => { e.target.style.display = 'none'; }} 
                    />
                );
            }
            return (
                <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2 break-all">
                    {part}
                </a>
            );
        }
        return part;
    });
};

const LiteYouTubeEmbed = ({ videoId }: { videoId: string }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    return (
        // 🚨 픽스: 유튜브 플레이어의 라운딩(rounded-xl), 테두리(border) 삭제
        <div className="relative aspect-video w-full overflow-hidden bg-black cursor-pointer group" onClick={() => setIsPlaying(true)}>
            {!isPlaying ? (
                <>
                    <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="YouTube" loading="lazy" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-12 bg-red-600/90 rounded-2xl flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.5)] group-hover:bg-red-500 transition-all group-hover:scale-110">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-7 h-7 ml-1"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                    </div>
                </>
            ) : (
                <iframe src={`https://www.youtube.com/embed/${videoId}?autoplay=1`} className="w-full h-full border-none" allowFullScreen></iframe>
            )}
        </div>
    );
};

export default function L_PostDetail({ user, owners, notices, posts, selectedPostId, isMaster, setViewMode, setSelectedPostId, setEditingPostId }: any) {
    const [commentText, setCommentText] = useState('');
    const [replyText, setReplyText] = useState('');
    const [editCommentText, setEditCommentText] = useState('');
    const [replyingTo, setReplyingTo] = useState<{ parentId: string, targetId: string, authorName: string } | null>(null);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false); 
    const [showVoters, setShowVoters] = useState(false); 
    const commentInputRef = useRef<HTMLInputElement>(null);

    const viewedPostRef = useRef<string | null>(null);

    const activePost = posts?.find((p:any) => p.id === selectedPostId) || notices?.find((n:any) => n.id === selectedPostId);
    const isNotice = !!notices?.find((n:any) => n.id === activePost?.id);

    useEffect(() => {
        if (activePost && activePost.id && viewedPostRef.current !== activePost.id) {
            viewedPostRef.current = activePost.id; 
            const incrementViewCount = async () => {
                try {
                    const postRef = doc(db, isNotice ? 'notices' : 'posts', activePost.id);
                    await updateDoc(postRef, { views: increment(1) });
                } catch (error) {}
            };
            incrementViewCount();
        }
    }, [activePost?.id, isNotice]); 

    if (!activePost) return null;

    const isPostAuthor = user?.uid === (activePost.authorUid || activePost.ownerUid || activePost.authorId || activePost.ownerId) || 
                         normalizeName(user?.mappedOwnerId) === normalizeName(activePost.authorName || activePost.ownerName) || 
                         isMaster;

    const getNoticeAuthorData = () => {
        const rawName = activePost.authorName || activePost.ownerName;
        const rawId = activePost.authorUid || activePost.ownerUid || activePost.authorId || activePost.ownerId; 
        const rawPhoto = activePost.authorPhoto || activePost.ownerPhoto;
        let matchedOwner = owners?.find((o:any) => o.uid === rawId || String(o.id) === String(rawId) || o.docId === rawId);
        if (!matchedOwner && rawName) matchedOwner = owners?.find((o:any) => normalizeName(o.nickname) === normalizeName(rawName));
        if (!matchedOwner && (!rawName || rawName === '운영진')) matchedOwner = owners?.find((o: any) => o.role === 'ADMIN');
        const finalName = matchedOwner?.nickname || rawName || '운영진';
        return { name: finalName, photo: getBestProfileImage(user, owners, rawPhoto, finalName) };
    };

    const authorData = getNoticeAuthorData();

    const poll = activePost.poll;
    const myVoteId = user && poll?.votes ? poll.votes[user.uid] : null;
    
    const validOptionIds = poll?.options?.map((o: any) => o.id) || [];
    const validVotes = Object.entries(poll?.votes || {}).filter(([_, vId]) => validOptionIds.includes(vId as string));
    const totalVotes = validVotes.length; 
    
    const canViewVoters = poll && (!poll.isAnonymous || isMaster); 

    const handleVote = async (optionId: string) => {
        if (!user) return alert("🚨 로그인 후 투표 가능합니다.");
        try {
            const updatedVotes = { ...poll.votes, [user.uid]: optionId };
            await updateDoc(doc(db, isNotice ? 'notices' : 'posts', activePost.id), { 'poll.votes': updatedVotes });
        } catch (e) { alert("투표 처리 중 에러 발생!"); }
    };

    const handleCancelVote = async () => {
        if (!window.confirm("투표를 취소하시겠습니까?")) return;
        try {
            const updatedVotes = { ...poll.votes };
            delete updatedVotes[user.uid];
            await updateDoc(doc(db, isNotice ? 'notices' : 'posts', activePost.id), { 'poll.votes': updatedVotes });
        } catch (e) {}
    };

    const getOwnerNameByUid = (uid: string) => {
        const o = owners?.find((o:any) => o.uid === uid || String(o.id) === uid);
        return o ? o.nickname : `미등록 유저 (${uid.substring(0, 4)})`;
    };

    const handleCloseView = () => { setSelectedPostId(null); setViewMode('LIST'); const params = new URLSearchParams(window.location.search); params.delete('postId'); window.history.pushState(null, '', `?${params.toString()}`); };
    const handleDeletePost = async () => { if (!window.confirm("정말 이 게시글을 삭제하시겠습니까?")) return; try { await deleteDoc(doc(db, isNotice ? 'notices' : 'posts', activePost.id)); alert("🗑️ 삭제되었습니다."); handleCloseView(); } catch (e: any) { alert("삭제 실패: " + e.message); } };
    const handleReaction = async (type: 'LIKE' | 'DISLIKE') => {
        if (!user) return alert("🚨 로그인이 필요합니다.");
        try {
            const postRef = doc(db, isNotice ? 'notices' : 'posts', activePost.id);
            let likes = (isNotice ? activePost.likedBy : activePost.likes) || []; let dislikes = (isNotice ? activePost.dislikedBy : activePost.dislikes) || [];
            if (type === 'LIKE') { if (likes.includes(user.uid)) likes = likes.filter((uid: string) => uid !== user.uid); else { likes.push(user.uid); dislikes = dislikes.filter((uid: string) => uid !== user.uid); } } 
            else { if (dislikes.includes(user.uid)) dislikes = dislikes.filter((uid: string) => uid !== user.uid); else { dislikes.push(user.uid); likes = likes.filter((uid: string) => uid !== user.uid); } }
            if (isNotice) await updateDoc(postRef, { likedBy: likes, dislikedBy: dislikes, updatedAt: new Date().toISOString() }); else await updateDoc(postRef, { likes, dislikes });
        } catch (e) {}
    };
    const submitComment = async (isReply: boolean, stickerUrl?: string) => {
        if (!user || isSending) return; 
        const textToSubmit = stickerUrl ? `[STICKER]${stickerUrl}` : (isReply ? replyText.trim() : commentText.trim());
        if (!textToSubmit) return alert("내용을 입력해주세요.");
        setIsSending(true);
        try {
            const matchedOwner = owners?.find((o: any) => o.uid === user?.uid || String(o.id) === String(user?.uid));
            const authorName = matchedOwner?.nickname || user?.mappedOwnerId || user?.displayName || '익명 구단주';
            const authorPhoto = getBestProfileImage(user, owners, user?.photoURL || '', authorName);
            if (isNotice) {
                let updatedComments = [...(activePost.comments || activePost.replies || [])];
                const newComment = { id: `reply_${Date.now()}`, ownerId: user.uid, ownerUid: user.uid, ownerName: authorName, ownerPhoto: authorPhoto, text: textToSubmit, createdAt: new Date().toISOString(), likedBy: [], isEdited: false };
                if (isReply) updatedComments = updatedComments.map((c:any) => c.id === replyingTo!.parentId ? { ...c, replies: [...(c.replies || []), newComment] } : c);
                else updatedComments.push(newComment);
                await updateDoc(doc(db, 'notices', activePost.id), { comments: updatedComments, updatedAt: new Date().toISOString() });
            } else {
                let updatedComments = [...(activePost.comments || [])];
                updatedComments.push({ id: `cmt_${Date.now()}`, authorId: user.uid, authorUid: user.uid, authorName: authorName, authorPhoto: authorPhoto, text: textToSubmit, createdAt: Date.now(), parentId: isReply ? replyingTo!.parentId : null, likes: [], isEdited: false });
                await updateDoc(doc(db, 'posts', activePost.id), { comments: updatedComments });
            }
            isReply ? setReplyText('') : setCommentText(''); if (isReply) setReplyingTo(null);
        } finally { setIsSending(false); }
    };
    const handleSaveEdit = async () => {
        if (!user || !editCommentText.trim() || !editingCommentId) return;
        try {
            if (isNotice) {
                let updatedComments = [...(activePost.comments || activePost.replies || [])];
                updatedComments = updatedComments.map((c:any) => {
                    if (c.id === editingCommentId) return { ...c, text: editCommentText.trim(), isEdited: true };
                    if (c.replies) c.replies = c.replies.map((r:any) => r.id === editingCommentId ? { ...r, text: editCommentText.trim(), isEdited: true } : r); return c;
                });
                await updateDoc(doc(db, 'notices', activePost.id), { comments: updatedComments, updatedAt: new Date().toISOString() });
            } else {
                let updatedComments = [...(activePost.comments || [])];
                updatedComments = updatedComments.map((c:any) => c.id === editingCommentId ? { ...c, text: editCommentText.trim(), isEdited: true } : c);
                await updateDoc(doc(db, 'posts', activePost.id), { comments: updatedComments });
            }
            setEditCommentText(''); setEditingCommentId(null);
        } catch (e) {}
    };
    const handleCommentReaction = async (commentId: string, parentId?: string) => {
        if (!user) return;
        try {
            if (isNotice) {
                let rootArray = [...(activePost.comments || activePost.replies || [])];
                const toggleLike = (arr: string[]) => arr.includes(user.uid) ? arr.filter(id => id !== user.uid) : [...arr, user.uid];
                if (parentId) rootArray = rootArray.map((c:any) => c.id === parentId ? { ...c, replies: (c.replies||[]).map((r:any) => r.id === commentId ? { ...r, likedBy: toggleLike(r.likedBy||[]) } : r) } : c);
                else rootArray = rootArray.map((c:any) => c.id === commentId ? { ...c, likedBy: toggleLike(c.likedBy||[]) } : c);
                await updateDoc(doc(db, 'notices', activePost.id), { comments: rootArray, updatedAt: new Date().toISOString() });
            } else {
                let updatedComments = [...(activePost.comments || [])];
                updatedComments = updatedComments.map((c:any) => c.id === commentId ? { ...c, likes: c.likes?.includes(user.uid) ? c.likes.filter((id: string) => id !== user.uid) : [...(c.likes||[]), user.uid] } : c);
                await updateDoc(doc(db, 'posts', activePost.id), { comments: updatedComments });
            }
        } catch (e) {}
    };
    const handleDeleteComment = async (commentId: string, parentId?: string) => {
        if (!window.confirm("댓글을 삭제하시겠습니까?")) return;
        if (isNotice) {
            let rootArray = [...(activePost.comments || activePost.replies || [])];
            if (parentId) rootArray = rootArray.map((c:any) => c.id === parentId ? { ...c, replies: (c.replies||[]).filter((r:any) => r.id !== commentId) } : c);
            else rootArray = rootArray.filter((c:any) => c.id !== commentId);
            await updateDoc(doc(db, 'notices', activePost.id), { comments: rootArray, updatedAt: new Date().toISOString() });
        } else {
            let updatedComments = [...(activePost.comments || [])].filter((c: any) => c.id !== commentId && c.parentId !== commentId);
            await updateDoc(doc(db, 'posts', activePost.id), { comments: updatedComments });
        }
    };

    return (
        <div className="animate-in slide-in-from-bottom-4 w-full flex flex-col pb-10">
            <div className="mb-4 flex items-center justify-between px-2">
                <button onClick={handleCloseView} className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors font-bold text-[11px] sm:text-[12px] bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 shadow-inner w-max">
                    <ArrowLeft size={14} /> <span>목록으로 뒤로 가기</span>
                </button>
            </div>

            <div className="w-full">
                <div className="px-2 py-5 border-b border-slate-800/60 w-full">
                    <div className="flex justify-between items-start mb-4">
                        <span className="bg-emerald-400/10 text-emerald-400 border-emerald-500/30 font-black text-[10px] tracking-widest uppercase px-2.5 py-0.5 rounded border flex items-center gap-1 shadow-sm">
                            {activePost.cat || '전체공지'}
                        </span>
                        
                        {isPostAuthor && (
                            <div className="flex gap-2 text-[10px] font-bold">
                                {!isNotice && (
                                    <button onClick={() => { setEditingPostId(activePost.id); setViewMode('EDIT'); }} className="text-slate-400 hover:text-blue-400 transition-colors">
                                        수정
                                    </button>
                                )}
                                <span className="text-slate-700">|</span>
                                <button onClick={handleDeletePost} className="text-slate-400 hover:text-red-400 transition-colors">
                                    삭제
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex flex-col mb-5 overflow-visible">
                        <h2 className="text-[20px] sm:text-[24px] font-bold text-white leading-tight break-keep">{activePost.title}</h2>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-3">
                            <img src={authorData.photo} onError={(e: any) => { e.target.src = COMMON_DEFAULT_PROFILE; }} alt="profile" className="w-9 h-9 rounded-full object-cover border border-slate-700 bg-slate-800 shadow-sm" />
                            <div className="flex flex-col">
                                <span className="text-[13px] font-bold text-emerald-400 leading-tight">{authorData.name}</span>
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mt-0.5">
                                    <span>{formatDate(activePost.createdAt, true)}</span>
                                    <span className="w-0.5 h-0.5 bg-slate-600 rounded-full"></span>
                                    <span>조회 {activePost.views || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="py-8 space-y-6 w-full">
                    {(() => {
                        const ytMatch = activePost.youtubeUrl?.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([a-zA-Z0-9_-]{11})/);
                        const ytId = activePost.youtubeId || (ytMatch ? ytMatch[1] : null);
                        if (!ytId) return null;
                        return <LiteYouTubeEmbed videoId={ytId} />;
                    })()}
                    
                    {/* 🚨 픽스: 대표 이미지(imageUrl)의 라운딩(rounded-xl), 테두리(border), 그림자 제거 */}
                    {activePost.imageUrl && (
                        <div className="w-full flex justify-center">
                            <img src={activePost.imageUrl} alt="첨부이미지" className="w-full h-auto object-contain mx-auto max-h-[600px]" referrerPolicy="no-referrer" onError={(e: any) => { e.target.style.display = 'none'; }} />
                        </div>
                    )}
                    
                    {/* 본문 텍스트 내 자동 변환 영역 */}
                    <div className="px-2 text-slate-300 text-[15px] sm:text-[16px] leading-relaxed whitespace-pre-wrap break-words break-all font-medium not-italic">
                        {renderTextWithLinks(activePost.content)}
                    </div>
                </div>

                {poll && (
                    <div className="mt-4 mb-8 mx-2 bg-slate-900/40 rounded-2xl border border-slate-800/60 p-5">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-[14px] font-black text-white flex items-center gap-2">
                                <BarChart2 className="text-blue-400" size={18} /> 투표 진행 중
                            </h3>
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2.5 py-1 rounded-md font-bold border border-slate-700 shadow-sm">
                                {poll.isAnonymous ? '👻 무기명' : '👁️ 기명(공개)'} • 총 {totalVotes}명 참여
                            </span>
                        </div>

                        <div className="space-y-3">
                            {poll.options.map((opt: any) => {
                                const count = validVotes.filter(([_, vId]) => vId === opt.id).length;
                                const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                                const isMyChoice = myVoteId === opt.id;

                                return (
                                    <div key={opt.id} className="relative group">
                                        {myVoteId ? (
                                            <div className={`relative h-12 w-full rounded-xl border overflow-hidden flex items-center px-4 z-10 transition-colors ${isMyChoice ? 'border-blue-500 bg-blue-900/20' : 'border-slate-700/80 bg-slate-800/80'}`}>
                                                <div className={`absolute top-0 left-0 h-full transition-all duration-500 z-0 ${isMyChoice ? 'bg-blue-600/30' : 'bg-slate-700/40'}`} style={{ width: `${percent}%` }}></div>
                                                <div className="relative z-10 flex justify-between w-full text-[13px] font-bold">
                                                    <span className={`flex items-center gap-2 ${isMyChoice ? 'text-blue-400' : 'text-slate-300'}`}>
                                                        {isMyChoice && <CheckCircle2 size={16} className="text-blue-400" />} {opt.text}
                                                    </span>
                                                    <span className={isMyChoice ? 'text-blue-400' : 'text-slate-400'}>{percent}% ({count}명)</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <button onClick={() => handleVote(opt.id)} className="w-full h-12 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-blue-500 rounded-xl text-left px-4 text-[13px] font-bold text-slate-300 hover:text-white transition-all shadow-sm">
                                                {opt.text}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-5 pt-4 border-t border-slate-800/60 flex justify-between items-center">
                            {myVoteId ? (
                                <button onClick={handleCancelVote} className="text-[11px] text-slate-400 hover:text-red-400 font-bold underline underline-offset-4 transition-colors">투표 다시하기 (취소)</button>
                            ) : (
                                <span className="text-[11px] text-slate-500 font-bold">한 항목만 선택할 수 있습니다.</span>
                            )}

                            {canViewVoters && totalVotes > 0 && (
                                <button onClick={() => setShowVoters(!showVoters)} className="text-[11px] font-bold bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 shadow-sm">
                                    <Users size={14} /> {showVoters ? '참여자 숨기기' : '참여자 보기'}
                                </button>
                            )}
                        </div>

                        {showVoters && canViewVoters && (
                            <div className="mt-4 p-4 bg-slate-900/40 rounded-xl border border-slate-800/60 space-y-4">
                                {poll.isAnonymous && isMaster && (
                                    <div className="text-[10px] text-red-400 font-bold mb-2 flex items-center gap-1 bg-red-900/20 px-2 py-1.5 rounded border border-red-500/30">
                                        🚨 본 투표는 무기명이지만, 관리자 권한으로 열람 중입니다.
                                    </div>
                                )}
                                {poll.options.map((opt: any) => {
                                    const voters = validVotes.filter(([_, vId]) => vId === opt.id).map(([uid, _]) => getOwnerNameByUid(uid));
                                    if (voters.length === 0) return null;
                                    return (
                                        <div key={opt.id} className="text-[12px] leading-relaxed">
                                            <span className="font-black text-slate-400 mb-1 block">[{opt.text}] 선택자 <span className="text-blue-400 ml-1">({voters.length}명)</span></span>
                                            <span className="text-emerald-400 font-medium break-keep">{voters.join(', ')}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                <div className="py-8 flex justify-center gap-4 border-b border-slate-800/60 w-full">
                    <button onClick={() => handleReaction('LIKE')} className={`flex items-center gap-2 px-6 py-3 rounded-full font-black text-[13px] border transition-all shadow-md ${((isNotice ? activePost.likedBy : activePost.likes) || [])?.includes(user?.uid) ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        👍 좋아요 {((isNotice ? activePost.likedBy : activePost.likes) || [])?.length || 0}
                    </button>
                    <button onClick={() => handleReaction('DISLIKE')} className={`flex items-center gap-2 px-6 py-3 rounded-full font-black text-[13px] border transition-all shadow-md ${((isNotice ? activePost.dislikedBy : activePost.dislikes) || [])?.includes(user?.uid) ? 'bg-red-600/20 border-red-500 text-red-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        👎 싫어요 {((isNotice ? activePost.dislikedBy : activePost.dislikes) || [])?.length || 0}
                    </button>
                </div>
                
                <div className="py-6 px-2 w-full">
                    <h4 className="text-[13px] sm:text-[14px] font-black text-white uppercase mb-6 flex items-center gap-2 tracking-widest italic">
                        💬 Comments <span className="text-emerald-500 ml-1">{(activePost.comments || activePost.replies || []).length}</span>
                    </h4>
                    
                    <div className="mb-8 border-t border-slate-800/60">
                        {(!(activePost.comments || activePost.replies) || (activePost.comments || activePost.replies).length === 0) && (
                            <p className="text-[12px] text-slate-500 italic py-8 text-center font-bold">가장 먼저 의견을 남겨보세요!</p>
                        )}
                        
                        {(activePost.comments || activePost.replies || []).filter((c:any) => !c.parentId).map((comment: any) => {
                            const replies = isNotice ? (comment.replies || []) : (activePost.comments||[]).filter((c: any) => c.parentId === comment.id);
                            const cName = comment.authorName || comment.ownerName || '알 수 없음';
                            const authorProfileImg = getBestProfileImage(user, owners, comment.authorPhoto || comment.ownerPhoto, cName);
                            const isLiked = isNotice ? comment.likedBy?.includes(user?.uid) : comment.likes?.includes(user?.uid);
                            const isSticker = comment.text?.startsWith('[STICKER]');
                            
                            const isCommentAuthor = user?.uid === (comment.authorUid || comment.ownerUid) || 
                                                    normalizeName(user?.mappedOwnerId) === normalizeName(cName) || 
                                                    isMaster;

                            return (
                                <div key={comment.id} className="border-b border-slate-800/60 py-5 w-full last:border-0">
                                    <div className="flex gap-3 sm:gap-4 w-full">
                                        <img src={authorProfileImg} alt="profile" className="w-10 h-10 rounded-full object-cover shrink-0 bg-slate-800 shadow-sm border border-slate-700" onError={(e:any)=>{e.target.src=COMMON_DEFAULT_PROFILE}} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline gap-2 mb-2">
                                                <span className="font-bold text-emerald-400 text-[13px] sm:text-[14px] whitespace-nowrap">{cName}</span>
                                                <span className="text-slate-500 text-[10px] sm:text-[11px]">
                                                    {formatDate(comment.createdAt, true)}
                                                    {comment.isEdited && <span className="ml-1 text-slate-600">(수정됨)</span>}
                                                </span>
                                            </div>
                                            
                                            {editingCommentId === comment.id ? (
                                                <div className="mt-2 mb-3 flex flex-col gap-2">
                                                    <textarea value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl text-[13px] outline-none focus:border-emerald-500 resize-none shadow-inner" rows={2} />
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => { setEditingCommentId(null); setEditCommentText(''); }} className="px-4 py-1.5 bg-slate-800 border border-slate-700 text-slate-400 rounded-lg text-xs font-bold hover:text-white transition-colors">취소</button>
                                                        <button onClick={handleSaveEdit} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm">저장</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                isSticker ? (
                                                    <img src={comment.text.replace('[STICKER]', '')} className="w-24 h-24 object-contain drop-shadow-md mb-3" alt="sticker" />
                                                ) : (
                                                    <div className="text-[14px] sm:text-[15px] text-slate-200 mb-3 font-medium whitespace-pre-wrap break-all break-words leading-relaxed">
                                                        {renderTextWithLinks(comment.text)}
                                                    </div>
                                                )
                                            )}

                                            <div className="flex items-center gap-4 text-[12px] text-slate-400 font-bold mt-1">
                                                <button onClick={() => handleCommentReaction(comment.id)} className={`flex items-center gap-1.5 hover:text-emerald-400 transition-colors ${isLiked ? 'text-emerald-400' : ''}`}>
                                                    <ThumbsUp size={14} className={isLiked ? 'fill-emerald-400' : ''}/> 좋아요 {(isNotice ? comment.likedBy : comment.likes)?.length || 0}
                                                </button>
                                                <button onClick={() => { setReplyingTo({ parentId: comment.id, targetId: comment.id, authorName: cName }); setTimeout(()=>commentInputRef.current?.focus(), 100) }} className="flex items-center gap-1.5 hover:text-white transition-colors">
                                                    <MessageSquare size={14}/> 답글
                                                </button>
                                                
                                                {isCommentAuthor && !editingCommentId && (
                                                    <div className="ml-auto flex items-center gap-3 text-[11px]">
                                                        {!isSticker && <button onClick={() => { setEditingCommentId(comment.id); setEditCommentText(comment.text); }} className="hover:text-blue-400 transition-colors">수정</button>}
                                                        <button onClick={() => handleDeleteComment(comment.id)} className="hover:text-red-400 transition-colors">삭제</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {replies.length > 0 && (
                                        <div className="mt-5 space-y-5 pl-12 sm:pl-14 border-l-2 border-slate-800/60 ml-4 w-full">
                                            {replies.map((reply: any) => {
                                                const rName = reply.authorName || reply.ownerName || '알 수 없음';
                                                const rProfileImg = getBestProfileImage(user, owners, reply.authorPhoto || reply.ownerPhoto, rName);
                                                const isRLiked = isNotice ? reply.likedBy?.includes(user?.uid) : reply.likes?.includes(user?.uid);
                                                const isRSticker = reply.text?.startsWith('[STICKER]');
                                                const isReplyAuthor = user?.uid === (reply.authorUid || reply.ownerUid) || normalizeName(user?.mappedOwnerId) === normalizeName(rName) || isMaster;

                                                return (
                                                    <div key={reply.id} className="flex gap-3 w-full">
                                                        <img src={rProfileImg} alt="profile" className="w-8 h-8 rounded-full object-cover shrink-0 bg-slate-800 shadow-sm border border-slate-700" onError={(e:any)=>{e.target.src=COMMON_DEFAULT_PROFILE}} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-baseline gap-2 mb-1.5">
                                                                <span className="font-bold text-slate-300 text-[12px] sm:text-[13px] whitespace-nowrap">{rName}</span>
                                                                <span className="text-slate-500 text-[9px] sm:text-[10px]">{formatDate(reply.createdAt, true)}{reply.isEdited && ' (수정됨)'}</span>
                                                            </div>

                                                            {editingCommentId === reply.id ? (
                                                                <div className="mt-2 mb-3 flex flex-col gap-2">
                                                                    <textarea value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl text-[12px] outline-none focus:border-emerald-500 resize-none shadow-inner" rows={2} />
                                                                    <div className="flex justify-end gap-2">
                                                                        <button onClick={() => { setEditingCommentId(null); setEditCommentText(''); }} className="px-4 py-1.5 bg-slate-800 border border-slate-700 text-slate-400 rounded-lg text-xs font-bold hover:text-white transition-colors">취소</button>
                                                                        <button onClick={handleSaveEdit} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm">저장</button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                isRSticker ? (
                                                                    <img src={reply.text.replace('[STICKER]', '')} className="w-20 h-20 object-contain drop-shadow-md mb-2" alt="sticker" />
                                                                ) : (
                                                                    <div className="text-[13px] sm:text-[14px] text-slate-300 mb-2 font-medium whitespace-pre-wrap break-all break-words leading-relaxed">
                                                                        {renderTextWithLinks(reply.text)}
                                                                    </div>
                                                                )
                                                            )}

                                                            <div className="flex items-center gap-4 text-[11px] text-slate-400 font-bold mt-1.5">
                                                                <button onClick={() => handleCommentReaction(reply.id, comment.id)} className={`flex items-center gap-1.5 hover:text-emerald-400 transition-colors ${isRLiked ? 'text-emerald-400' : ''}`}>
                                                                    <ThumbsUp size={13} className={isRLiked ? 'fill-emerald-400' : ''}/> 좋아요 {(isNotice ? reply.likedBy : reply.likes)?.length || 0}
                                                                </button>
                                                                <button onClick={() => { setReplyingTo({ parentId: comment.id, targetId: reply.id, authorName: rName }); setTimeout(()=>commentInputRef.current?.focus(), 100) }} className="flex items-center gap-1.5 hover:text-white transition-colors">
                                                                    <MessageSquare size={13}/> 답글
                                                                </button>

                                                                {isReplyAuthor && !editingCommentId && (
                                                                    <div className="ml-auto flex items-center gap-3 text-[10px]">
                                                                        {!isRSticker && <button onClick={() => { setEditingCommentId(reply.id); setEditCommentText(reply.text); }} className="hover:text-blue-400 transition-colors">수정</button>}
                                                                        <button onClick={() => handleDeleteComment(reply.id, comment.id)} className="hover:text-red-400 transition-colors">삭제</button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    
                    {user ? (
                        <div className="flex flex-col gap-2 pt-4 w-full">
                            {replyingTo && (
                                <div className="flex justify-between items-center bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700 mb-1 shadow-sm">
                                    <span className="text-[12px] font-bold text-emerald-400">@{replyingTo.authorName} 님에게 답글 작성 중...</span>
                                    <button onClick={() => setReplyingTo(null)} className="text-[11px] text-slate-400 hover:text-white font-bold px-3 py-1.5 bg-slate-700 rounded-lg transition-colors">✕ 취소</button>
                                </div>
                            )}
                            <div className="flex items-stretch gap-2 sm:gap-3 relative w-full">
                                <div className="shrink-0 relative z-[100] flex items-center justify-center">
                                    <StickerSelector onSelect={(url: string) => submitComment(!!replyingTo, url)} />
                                </div>
                                <input 
                                    ref={commentInputRef}
                                    value={replyingTo ? replyText : commentText} 
                                    onChange={(e) => replyingTo ? setReplyText(e.target.value) : setCommentText(e.target.value)} 
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) { e.preventDefault(); submitComment(!!replyingTo); } }} 
                                    placeholder={replyingTo ? "답글을 입력하세요..." : "따뜻한 댓글을 남겨주세요."} 
                                    disabled={isSending} 
                                    className="flex-1 bg-slate-900 px-4 py-3 sm:py-3.5 rounded-2xl border border-slate-700 text-white text-[13px] sm:text-[14px] focus:border-emerald-500 shadow-inner disabled:opacity-60" 
                                />
                                <button 
                                    onClick={() => submitComment(!!replyingTo)} 
                                    disabled={isSending || (replyingTo ? !replyText.trim() : !commentText.trim())} 
                                    className="px-6 py-3 sm:py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[12px] sm:text-[13px] rounded-2xl shadow-lg shrink-0 flex items-center justify-center disabled:bg-slate-800 disabled:text-slate-500 transition-colors"
                                >
                                    등록 <Send size={16} className="ml-1.5" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-6 bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-500 font-bold text-[12px] sm:text-[13px]">
                            로그인 후 댓글을 작성할 수 있습니다.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}