"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { Notice, NoticeComment, Owner, FALLBACK_IMG } from '../types';

interface NoticeViewProps {
    owners: Owner[];
    notices: Notice[]; 
}

export const NoticeView = ({ owners, notices }: NoticeViewProps) => {
    const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

    const [activeOwnerId, setActiveOwnerId] = useState<string>('');
    const [commentText, setCommentText] = useState('');

    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editCommentText, setEditCommentText] = useState<string>('');
    
    const [replyingToId, setReplyingToId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');

    useEffect(() => {
        if (owners.length > 0 && !activeOwnerId) {
            setActiveOwnerId(String(owners[0].id));
        }
    }, [owners]);

    // 🔥 [수정] 타입스크립트 에러(ts-2339) 해결! any로 우회하여 빌드 에러 원천 차단
    const currentOwner = owners.find(o => String(o.id) === activeOwnerId);
    const isAdmin = (currentOwner as any)?.role === 'ADMIN';

    useEffect(() => {
        const checkUrlAndSyncNotice = () => {
            const params = new URLSearchParams(window.location.search);
            const noticeId = params.get('noticeId');
            
            if (noticeId && notices.length > 0) {
                const target = notices.find(n => n.id === noticeId);
                if (target) setSelectedNotice(target);
            } else if (!noticeId) {
                setSelectedNotice(null);
            }
        };

        checkUrlAndSyncNotice(); 

        window.addEventListener('popstate', checkUrlAndSyncNotice);
        window.addEventListener('forceNoticeCheck', checkUrlAndSyncNotice);

        return () => {
            window.removeEventListener('popstate', checkUrlAndSyncNotice);
            window.removeEventListener('forceNoticeCheck', checkUrlAndSyncNotice);
        };
    }, [notices]);

    const handleBackToList = () => {
        setSelectedNotice(null);
        setEditingCommentId(null); 
        setReplyingToId(null);
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            params.delete('noticeId');
            window.history.replaceState(null, '', `?${params.toString()}`);
        }
    };

    const handleNoticeClick = (notice: Notice) => {
        setSelectedNotice(notice);
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            params.set('view', 'NOTICE');
            params.set('noticeId', notice.id);
            window.history.pushState(null, '', `?${params.toString()}`);
        }
    };

    // 🔥 어드민 전용 공지사항 본글 삭제 기능
    const handleDeleteNotice = async (noticeId: string) => {
        if (!window.confirm("🚨 이 공지사항을 완전히 삭제하시겠습니까?")) return;
        try {
            await deleteDoc(doc(db, 'notices', noticeId));
            alert("🗑️ 공지사항이 삭제되었습니다.");
            handleBackToList();
        } catch (error) {
            console.error("Notice delete error:", error);
            alert("삭제에 실패했습니다.");
        }
    };

    const handleShareLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            alert('🔗 게시글 링크가 클립보드에 복사되었습니다!\n단톡방에 공유해보세요.');
        }).catch(() => {
            alert('🚨 링크 복사에 실패했습니다.');
        });
    };

    const extractYouTubeId = (url: string) => {
        if (!url) return null;
        if (url.length === 11 && !url.includes('http')) return url;
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        if (match && match[7].length === 11) return match[7];
        try {
            const urlObj = new URL(url);
            if (urlObj.pathname.includes('/shorts/')) return urlObj.pathname.split('/shorts/')[1].substring(0, 11);
        } catch (e) { }
        return null;
    };

    const formatDate = (isoString: string, includeTime = false) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        const datePart = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
        const timePart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        return includeTime ? `${datePart} ${timePart}` : datePart;
    };

    const updateCommentsInDB = async (updatedComments: NoticeComment[]) => {
        if (!selectedNotice) return;
        const now = new Date().toISOString();
        try {
            await updateDoc(doc(db, 'notices', selectedNotice.id), {
                comments: updatedComments,
                updatedAt: now
            });
            setSelectedNotice({ ...selectedNotice, comments: updatedComments, updatedAt: now });
        } catch (error) {
            console.error(error);
        }
    };

    const handleReaction = async (type: 'LIKE' | 'DISLIKE') => {
        if (!activeOwnerId || !selectedNotice) return alert("프로필을 먼저 선택해주세요.");
        try {
            const noticeRef = doc(db, 'notices', selectedNotice.id);
            const noticeSnap = await getDoc(noticeRef);
            const noticeData = noticeSnap.data() as Notice;
            let likes = noticeData.likedBy || [];
            let dislikes = noticeData.dislikedBy || [];

            if (type === 'LIKE') {
                if (likes.includes(activeOwnerId)) likes = likes.filter(id => id !== activeOwnerId); 
                else { likes.push(activeOwnerId); dislikes = dislikes.filter(id => id !== activeOwnerId); }
            } else {
                if (dislikes.includes(activeOwnerId)) dislikes = dislikes.filter(id => id !== activeOwnerId); 
                else { dislikes.push(activeOwnerId); likes = likes.filter(id => id !== activeOwnerId); }
            }
            const now = new Date().toISOString();
            await updateDoc(noticeRef, { likedBy: likes, dislikedBy: dislikes, updatedAt: now });
            setSelectedNotice({ ...selectedNotice, likedBy: likes, dislikedBy: dislikes, updatedAt: now });
        } catch (error) { console.error(error); }
    };

    const handleAddComment = async () => {
        if (!activeOwnerId) return alert("프로필을 확인해주세요.");
        if (!commentText.trim()) return alert("내용을 입력해주세요.");
        if (!selectedNotice) return;
        const owner = owners.find(o => String(o.id) === activeOwnerId);
        if (!owner) return;

        const newComment: NoticeComment = {
            id: `cmt_${Date.now()}`, ownerId: String(owner.id), ownerName: owner.nickname, ownerPhoto: owner.photo || FALLBACK_IMG, text: commentText, createdAt: new Date().toISOString()
        };
        const updatedComments = [...(selectedNotice.comments || []), newComment];
        await updateCommentsInDB(updatedComments);
        setCommentText('');
    };

    const handleAddReply = async (parentId: string) => {
        if (!activeOwnerId) return alert("프로필을 확인해주세요.");
        if (!replyText.trim()) return alert("답글을 입력해주세요.");
        if (!selectedNotice) return;
        const owner = owners.find(o => String(o.id) === activeOwnerId);
        if (!owner) return;

        const newReply: NoticeComment = {
            id: `reply_${Date.now()}`, ownerId: String(owner.id), ownerName: owner.nickname, ownerPhoto: owner.photo || FALLBACK_IMG, text: replyText, createdAt: new Date().toISOString()
        };

        const updatedComments = [...(selectedNotice.comments || [])].map(c => 
            c.id === parentId ? { ...c, replies: [...(c.replies || []), newReply] } : c
        );
        await updateCommentsInDB(updatedComments);
        setReplyingToId(null);
        setReplyText('');
    };

    const handleCommentReaction = async (commentId: string, parentId?: string) => {
        if (!activeOwnerId || !selectedNotice) return alert("프로필을 먼저 선택해주세요.");
        const toggleLike = (likes: string[]) => likes.includes(activeOwnerId) ? likes.filter(id => id !== activeOwnerId) : [...likes, activeOwnerId];

        let updatedComments = [...(selectedNotice.comments || [])];
        if (parentId) {
            updatedComments = updatedComments.map(c => 
                c.id === parentId ? { ...c, replies: (c.replies||[]).map(r => r.id === commentId ? { ...r, likedBy: toggleLike(r.likedBy||[]) } : r) } : c
            );
        } else {
            updatedComments = updatedComments.map(c => 
                c.id === commentId ? { ...c, likedBy: toggleLike(c.likedBy||[]) } : c
            );
        }
        await updateCommentsInDB(updatedComments);
    };

    const handleDeleteComment = async (commentId: string, parentId?: string) => {
        if (!window.confirm("정말 삭제하시겠습니까?")) return;
        let updatedComments = [...(selectedNotice?.comments || [])];
        if (parentId) {
            updatedComments = updatedComments.map(c => c.id === parentId ? { ...c, replies: (c.replies||[]).filter(r => r.id !== commentId) } : c);
        } else {
            updatedComments = updatedComments.filter(c => c.id !== commentId);
        }
        await updateCommentsInDB(updatedComments);
    };

    const startEditingComment = (cmt: NoticeComment, parentId?: string) => {
        setEditingCommentId(cmt.id); setEditCommentText(cmt.text);
    };

    const handleSaveEditComment = async (commentId: string, parentId?: string) => {
        if (!editCommentText.trim()) return;
        let updatedComments = [...(selectedNotice?.comments || [])];
        if (parentId) {
            updatedComments = updatedComments.map(c => c.id === parentId ? { ...c, replies: (c.replies||[]).map(r => r.id === commentId ? { ...r, text: editCommentText } : r) } : c);
        } else {
            updatedComments = updatedComments.map(c => c.id === commentId ? { ...c, text: editCommentText } : c);
        }
        await updateCommentsInDB(updatedComments);
        setEditingCommentId(null);
    };

    const renderComment = (cmt: any, parentId?: string) => {
        const rawId = cmt.ownerId || cmt.authorId;
        const rawName = cmt.ownerName || cmt.authorName || '알 수 없음';
        const rawPhoto = cmt.ownerPhoto || cmt.authorPhoto;

        const matchedOwner = owners.find(o => String(o.id) === String(rawId) || o.docId === rawId || o.nickname === rawName);
        const displayName = matchedOwner ? matchedOwner.nickname : rawName;
        const displayPhoto = (matchedOwner && matchedOwner.photo && matchedOwner.photo.trim() !== '') ? matchedOwner.photo : (rawPhoto || FALLBACK_IMG);

        const isMyComment = String(rawId) === String(activeOwnerId);
        const canEdit = isMyComment;
        const canDelete = isMyComment || isAdmin; 
        
        const isEditing = cmt.id === editingCommentId;
        const isReply = !!parentId;

        return (
            <div key={cmt.id} className={`flex gap-3 py-3 sm:py-4 transition-colors ${isReply ? 'ml-8 sm:ml-12 pl-3 sm:pl-4 border-l-2 border-slate-700/60' : 'border-b border-slate-800/50 last:border-0'}`}>
                <img src={displayPhoto} alt="" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-700 object-cover shrink-0 mt-0.5 bg-slate-800" />
                
                <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-start justify-between leading-tight mb-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] sm:text-xs font-bold text-emerald-400">{displayName}</span>
                            <span className="text-[9px] sm:text-[10px] text-slate-500 font-medium">{formatDate(cmt.createdAt, true)}</span>
                            {cmt.isEdited && <span className="text-slate-600 text-[9px] italic">(수정됨)</span>}
                        </div>
                        {/* 🔥 모바일에서도 잘 보이게 상시 노출로 변경 */}
                        {(canEdit || canDelete) && !isEditing && (
                            <div className="flex items-center gap-2.5">
                                {canEdit && <button onClick={() => startEditingComment(cmt, parentId)} className="text-[10px] font-bold text-slate-500 hover:text-yellow-400 transition-colors">수정</button>}
                                {canDelete && <button onClick={() => handleDeleteComment(cmt.id, parentId)} className="text-[10px] font-bold text-slate-500 hover:text-red-400 transition-colors">삭제</button>}
                            </div>
                        )}
                    </div>

                    {isEditing ? (
                        <div className="mt-1 flex flex-col gap-2">
                            <textarea 
                                value={editCommentText}
                                onChange={(e) => setEditCommentText(e.target.value)}
                                className="w-full bg-slate-900/80 p-2.5 rounded-lg border border-emerald-500/50 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-500 resize-none"
                                rows={2}
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setEditingCommentId(null)} className="px-3 py-1 text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800 rounded transition-colors">취소</button>
                                <button onClick={() => handleSaveEditComment(cmt.id, parentId)} className="px-3 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors shadow-lg">저장</button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs sm:text-sm text-slate-300 leading-normal whitespace-pre-wrap mb-1.5">{cmt.text}</p>
                    )}
                    
                    {/* 🔥 좋아요/답글 버튼 */}
                    <div className="flex items-center gap-3 mt-1">
                        <button onClick={() => handleCommentReaction(cmt.id, parentId)} className={`flex items-center gap-1 text-[10px] font-bold transition-colors ${(cmt.likedBy || []).includes(activeOwnerId) ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
                            👍 {(cmt.likedBy || []).length > 0 ? (cmt.likedBy || []).length : '좋아요'}
                        </button>
                        {!isReply && (
                            <button onClick={() => { setReplyingToId(replyingToId === cmt.id ? null : cmt.id); setReplyText(''); }} className={`flex items-center gap-1 text-[10px] font-bold transition-colors ${replyingToId === cmt.id ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
                                💬 답글 {(cmt.replies || []).length > 0 ? (cmt.replies || []).length : ''}
                            </button>
                        )}
                    </div>

                    {replyingToId === cmt.id && !isReply && (
                        <div className="mt-2.5 flex gap-2 items-stretch">
                            <input 
                                value={replyText} 
                                onChange={(e) => setReplyText(e.target.value)} 
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddReply(cmt.id); }}
                                placeholder="답글을 입력하세요..." 
                                className="flex-1 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-800 text-white text-xs placeholder-slate-600 focus:border-emerald-500 transition-colors"
                            />
                            <button onClick={() => handleAddReply(cmt.id)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] rounded-lg transition-all shrink-0">
                                등록
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // 🔥 공지사항 본문 작성자(Author) 정보 동기화 로직
    const getNoticeAuthorData = () => {
        if (!selectedNotice) return { name: '운영진', photo: FALLBACK_IMG };
        const rawName = (selectedNotice as any).authorName || (selectedNotice as any).ownerName || '운영진';
        const rawPhoto = (selectedNotice as any).authorPhoto || (selectedNotice as any).ownerPhoto || FALLBACK_IMG;
        const rawId = (selectedNotice as any).authorId || (selectedNotice as any).ownerId;
        
        const matchedOwner = owners.find(o => o.nickname === rawName || String(o.id) === String(rawId));
        return {
            name: matchedOwner?.nickname || rawName,
            photo: (matchedOwner && matchedOwner.photo && matchedOwner.photo.trim() !== '') ? matchedOwner.photo : rawPhoto
        };
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-10 max-w-4xl mx-auto px-2 sm:px-4">
            {!selectedNotice ? (
                <>
                    <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 shadow-xl flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">📢</span>
                            <div className="flex flex-col">
                                <h2 className="text-xl font-black italic text-white uppercase tracking-tighter leading-tight">Notice Board</h2>
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">리그 공식 커뮤니티</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#0f172a] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
                        {notices.length === 0 ? (
                            <div className="p-10 text-center text-slate-500 font-bold text-sm">등록된 게시글이 없습니다.</div>
                        ) : (
                            <div className="divide-y divide-slate-800/50">
                                {notices.map((notice, index) => {
                                    const commentCount = notice.comments?.length || 0;
                                    const likeCount = notice.likedBy?.length || 0;
                                    const boardNumber = notices.length - index; 

                                    return (
                                        <div key={notice.id} onClick={() => handleNoticeClick(notice)} className="flex items-center justify-between p-4 sm:p-5 hover:bg-slate-800/40 transition-colors cursor-pointer group">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <span className="text-slate-600 font-black text-[11px] sm:text-xs w-5 text-center shrink-0">{boardNumber}</span>
                                                {notice.isPopup && <span className="bg-yellow-500/20 text-yellow-400 text-[9px] font-black px-2 py-[2px] rounded uppercase tracking-widest border border-yellow-500/30 shrink-0">전체 공지</span>}
                                                <span className="text-white font-bold text-sm sm:text-base truncate group-hover:text-emerald-400 transition-colors">{notice.title}</span>
                                            </div>
                                            <div className="flex items-center gap-4 shrink-0 ml-4">
                                                <div className="flex items-center gap-3 text-[11px] text-slate-400 font-bold">
                                                    <span className="flex items-center gap-1.5"><span className="opacity-70">👍</span> {likeCount}</span>
                                                    <span className="flex items-center gap-1.5"><span className="opacity-70">💬</span> {commentCount}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="animate-in slide-in-from-bottom-4 space-y-4">
                    <div className="mb-2">
                        <button onClick={handleBackToList} className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors font-bold text-sm">
                            ← <span>목록으로</span>
                        </button>
                    </div>

                    <div className="bg-[#0f172a] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
                        <div className="p-6 sm:p-8 border-b border-slate-800">
                            
                            <div className="flex justify-between items-start mb-4">
                                <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">{selectedNotice.title}</h2>
                                {/* 🔥 어드민 전용 게시글 삭제 버튼 노출 */}
                                {isAdmin && (
                                    <button onClick={() => handleDeleteNotice(selectedNotice.id)} className="bg-slate-900 border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/50 px-3 py-1.5 rounded-lg font-bold text-[10px] shrink-0 ml-4 transition-all">
                                        🗑️ 삭제
                                    </button>
                                )}
                            </div>

                            {/* 🔥 공지사항 본문 작성자 정보 깔끔하게 렌더링 */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <img src={getNoticeAuthorData().photo} alt="" className="w-9 h-9 rounded-full border border-slate-700 object-cover bg-slate-800" />
                                    <div className="flex flex-col">
                                        <span className="text-emerald-400 font-bold text-xs sm:text-sm">{getNoticeAuthorData().name}</span>
                                        <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5">
                                            <span>{formatDate(selectedNotice.createdAt, true)}</span>
                                            {selectedNotice.isPopup && <span className="bg-yellow-500/20 text-yellow-400 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest border border-yellow-500/30">전체 공지</span>}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={handleShareLink} className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-700 shadow-sm shrink-0">
                                    🔗 공유하기
                                </button>
                            </div>
                            
                            <div className="h-px w-full bg-slate-800/60 my-6"></div>
                            
                            <div className="space-y-6 mb-8">
                                {selectedNotice.youtubeUrl && extractYouTubeId(selectedNotice.youtubeUrl) && (
                                    <div className="aspect-video w-full rounded-xl overflow-hidden border border-slate-800 shadow-lg bg-black">
                                        <iframe 
                                            src={`https://www.youtube.com/embed/${extractYouTubeId(selectedNotice.youtubeUrl)}`} 
                                            className="w-full h-full" 
                                            allowFullScreen 
                                            title="YouTube video player"
                                            frameBorder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            referrerPolicy="strict-origin-when-cross-origin"
                                        ></iframe>
                                    </div>
                                )}
                                {selectedNotice.imageUrl && (
                                    <div className="w-full rounded-xl overflow-hidden border border-slate-800 shadow-lg bg-black/20">
                                        <img src={selectedNotice.imageUrl} alt="첨부이미지" className="w-full h-auto object-contain mx-auto max-h-[600px]" />
                                    </div>
                                )}
                            </div>

                            <div className="text-slate-300 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                                {selectedNotice.content}
                            </div>
                        </div>

                        {/* 🔥 게시글 본문 좋아요/싫어요 기능 */}
                        <div className="bg-slate-900/50 p-5 sm:p-6 flex justify-center gap-4 border-b border-slate-800">
                            <button onClick={() => handleReaction('LIKE')} className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-sm border transition-all shadow-md ${selectedNotice.likedBy?.includes(activeOwnerId) ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                                👍 좋아요 {(selectedNotice.likedBy || []).length}
                            </button>
                            <button onClick={() => handleReaction('DISLIKE')} className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-sm border transition-all shadow-md ${selectedNotice.dislikedBy?.includes(activeOwnerId) ? 'bg-red-600/20 border-red-500 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                                👎 싫어요 {(selectedNotice.dislikedBy || []).length}
                            </button>
                        </div>

                        <div className="p-5 sm:p-8 bg-slate-950/30">
                            <h4 className="text-sm font-black text-white uppercase mb-4 flex items-center gap-2">
                                💬 Comments <span className="text-emerald-500">{(selectedNotice.comments || []).length}</span>
                            </h4>
                            
                            <div className="mb-6 border-t border-slate-800/50">
                                {(selectedNotice.comments || []).length === 0 && (
                                    <p className="text-xs text-slate-500 italic py-4">가장 먼저 댓글을 남겨보세요!</p>
                                )}
                                {(selectedNotice.comments || []).map((cmt: any) => (
                                    <React.Fragment key={cmt.id}>
                                        {renderComment(cmt)}
                                        {(cmt.replies || []).map((reply: any) => renderComment(reply, cmt.id))}
                                    </React.Fragment>
                                ))}
                            </div>

                            <div className="flex flex-col gap-3 pt-2">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pl-1 mb-0.5">댓글 쓰기</div>
                                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                                    <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-700 shrink-0">
                                        <img src={owners.find(o => String(o.id) === activeOwnerId)?.photo || FALLBACK_IMG} className="w-6 h-6 rounded-full object-cover border border-slate-800" alt="" />
                                        <select 
                                            value={activeOwnerId} 
                                            onChange={(e) => setActiveOwnerId(e.target.value)}
                                            className="bg-transparent border-none text-white text-[11px] font-bold outline-none cursor-pointer pr-1"
                                        >
                                            {owners.map(o => (
                                                <option key={o.id} value={String(o.id)} className="bg-slate-900 text-sm">{o.nickname}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex flex-1 items-stretch gap-2">
                                        <input 
                                            value={commentText} 
                                            onChange={(e) => setCommentText(e.target.value)} 
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(); }}
                                            placeholder="댓글 내용을 입력하세요..." 
                                            className="flex-1 bg-slate-900 px-4 py-2.5 sm:py-3 rounded-xl border border-slate-700 text-white text-sm placeholder-slate-600 focus:border-emerald-500 transition-colors shadow-inner"
                                        />
                                        <button onClick={handleAddComment} className="px-5 sm:px-6 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition-all shadow-lg shrink-0">
                                            등록
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};