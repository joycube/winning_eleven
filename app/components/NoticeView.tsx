"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, arrayUnion, query, orderBy, getDoc } from 'firebase/firestore';
import { Notice, NoticeComment, Owner, FALLBACK_IMG } from '../types';

interface NoticeViewProps {
    owners: Owner[];
}

export const NoticeView = ({ owners }: NoticeViewProps) => {
    const [notices, setNotices] = useState<Notice[]>([]);
    const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [activeOwnerId, setActiveOwnerId] = useState<string>('');
    const [commentText, setCommentText] = useState('');

    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editCommentText, setEditCommentText] = useState<string>('');

    const fetchNotices = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            setNotices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notice)));
        } catch (error) {
            console.error("🚨 Error fetching notices:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchNotices();
        if (owners.length > 0 && !activeOwnerId) {
            setActiveOwnerId(String(owners[0].id));
        }
    }, [owners]);

    // 🔥 [수술 포인트] 공유 링크로 접속 시 초기 로딩 완벽 대응 (삭제 버그 원천 차단)
    useEffect(() => {
        if (notices.length > 0 && !selectedNotice) {
            const params = new URLSearchParams(window.location.search);
            const noticeId = params.get('noticeId');
            if (noticeId) {
                const target = notices.find(n => n.id === noticeId);
                if (target) {
                    setSelectedNotice(target);
                }
            }
        }
    }, [notices]);

    // 목록으로 돌아가기
    const handleBackToList = () => {
        setSelectedNotice(null);
        setEditingCommentId(null); 
        fetchNotices(); 
        
        // 뒤로 갈 때 명시적으로 URL 초기화
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            params.delete('noticeId');
            window.history.replaceState(null, '', `?${params.toString()}`);
        }
    };

    // 리스트에서 글 클릭하기
    const handleNoticeClick = (notice: Notice) => {
        setSelectedNotice(notice);
        
        // 글을 열 때 명시적으로 URL 업데이트
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            params.set('view', 'NOTICE');
            params.set('noticeId', notice.id);
            window.history.replaceState(null, '', `?${params.toString()}`);
        }
    };

    // 공유하기 (절대 주소 생성 방식으로 강화)
    const handleShareLink = () => {
        const params = new URLSearchParams(window.location.search);
        params.set('view', 'NOTICE');
        if (selectedNotice) params.set('noticeId', selectedNotice.id);
        const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
        
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('🔗 게시글 링크가 클립보드에 복사되었습니다!\n단톡방에 붙여넣기 해보세요.');
        }).catch(() => {
            alert('🚨 링크 복사에 실패했습니다.');
        });
    };

    const extractYouTubeId = (url: string) => {
        if (!url) return null;
        if (url.length === 11 && !url.includes('http')) return url;
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        if (match && match[7].length === 11) {
            return match[7];
        }
        try {
            const urlObj = new URL(url);
            if (urlObj.pathname.includes('/shorts/')) {
                return urlObj.pathname.split('/shorts/')[1].substring(0, 11);
            }
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

    const handleReaction = async (type: 'LIKE' | 'DISLIKE') => {
        if (!activeOwnerId || !selectedNotice) return alert("프로필을 먼저 선택해주세요.");
        
        try {
            const noticeRef = doc(db, 'notices', selectedNotice.id);
            const noticeSnap = await getDoc(noticeRef);
            const noticeData = noticeSnap.data() as Notice;

            let likes = noticeData.likedBy || [];
            let dislikes = noticeData.dislikedBy || [];

            if (type === 'LIKE') {
                if (likes.includes(activeOwnerId)) {
                    likes = likes.filter(id => id !== activeOwnerId); 
                } else {
                    likes.push(activeOwnerId);
                    dislikes = dislikes.filter(id => id !== activeOwnerId); 
                }
            } else {
                if (dislikes.includes(activeOwnerId)) {
                    dislikes = dislikes.filter(id => id !== activeOwnerId); 
                } else {
                    dislikes.push(activeOwnerId);
                    likes = likes.filter(id => id !== activeOwnerId); 
                }
            }

            await updateDoc(noticeRef, { likedBy: likes, dislikedBy: dislikes });
            setSelectedNotice({ ...selectedNotice, likedBy: likes, dislikedBy: dislikes });
        } catch (error) {
            console.error("🚨 Error updating reaction:", error);
        }
    };

    const handleAddComment = async () => {
        if (!activeOwnerId) return alert("댓글을 작성할 프로필을 확인해주세요.");
        if (!commentText.trim()) return alert("댓글 내용을 입력해주세요.");
        if (!selectedNotice) return;

        const owner = owners.find(o => String(o.id) === activeOwnerId);
        if (!owner) return;

        const newComment: NoticeComment = {
            id: `cmt_${Date.now()}`,
            ownerId: String(owner.id),
            ownerName: owner.nickname,
            ownerPhoto: owner.photo || FALLBACK_IMG,
            text: commentText,
            createdAt: new Date().toISOString()
        };

        try {
            const noticeRef = doc(db, 'notices', selectedNotice.id);
            await updateDoc(noticeRef, {
                comments: arrayUnion(newComment)
            });
            setSelectedNotice({ ...selectedNotice, comments: [...(selectedNotice.comments || []), newComment] });
            setCommentText('');
        } catch (error) {
            console.error("🚨 Error adding comment:", error);
            alert("댓글 등록에 실패했습니다.");
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!confirm("정말 이 댓글을 삭제하시겠습니까?")) return;
        if (!selectedNotice) return;

        const updatedComments = (selectedNotice.comments || []).filter(c => c.id !== commentId);

        try {
            await updateDoc(doc(db, 'notices', selectedNotice.id), {
                comments: updatedComments
            });
            setSelectedNotice({ ...selectedNotice, comments: updatedComments });
        } catch (error) {
            console.error("🚨 Error deleting comment:", error);
            alert("댓글 삭제에 실패했습니다.");
        }
    };

    const startEditingComment = (cmt: NoticeComment) => {
        setEditingCommentId(cmt.id);
        setEditCommentText(cmt.text);
    };

    const handleSaveEditComment = async (commentId: string) => {
        if (!editCommentText.trim()) return alert("댓글 내용을 입력해주세요.");
        if (!selectedNotice) return;

        const updatedComments = (selectedNotice.comments || []).map(c => 
            c.id === commentId ? { ...c, text: editCommentText } : c
        );

        try {
            await updateDoc(doc(db, 'notices', selectedNotice.id), {
                comments: updatedComments
            });
            setSelectedNotice({ ...selectedNotice, comments: updatedComments });
            setEditingCommentId(null);
            setEditCommentText('');
        } catch (error) {
            console.error("🚨 Error updating comment:", error);
            alert("댓글 수정에 실패했습니다.");
        }
    };

    if (isLoading && !selectedNotice) {
        return (
            <div className="flex flex-col items-center justify-center py-32 animate-pulse">
                <span className="text-5xl mb-4">📢</span>
                <p className="text-emerald-500 font-bold italic tracking-widest uppercase text-sm">Loading Board...</p>
            </div>
        );
    }

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
                            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight mb-4">{selectedNotice.title}</h2>
                            
                            <div className="flex items-center justify-between">
                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                                    {selectedNotice.isPopup && <span className="bg-yellow-500/20 text-yellow-400 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest border border-yellow-500/30">전체 공지</span>}
                                    <span>{formatDate(selectedNotice.createdAt, true)}</span>
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

                        <div className="bg-slate-900/50 p-6 flex justify-center gap-4 border-b border-slate-800">
                            <button onClick={() => handleReaction('LIKE')} className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-sm border transition-all shadow-md ${selectedNotice.likedBy?.includes(activeOwnerId) ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                                👍 좋아요 {(selectedNotice.likedBy || []).length}
                            </button>
                            <button onClick={() => handleReaction('DISLIKE')} className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-sm border transition-all shadow-md ${selectedNotice.dislikedBy?.includes(activeOwnerId) ? 'bg-red-600/20 border-red-500 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                                👎 싫어요 {(selectedNotice.dislikedBy || []).length}
                            </button>
                        </div>

                        <div className="p-6 sm:p-8 bg-slate-950/30">
                            <h4 className="text-sm font-black text-white uppercase mb-4 flex items-center gap-2">
                                💬 Comments <span className="text-emerald-500">{(selectedNotice.comments || []).length}</span>
                            </h4>
                            
                            <div className="space-y-4 mb-6">
                                {(selectedNotice.comments || []).length === 0 && (
                                    <p className="text-xs text-slate-500 italic">가장 먼저 댓글을 남겨보세요!</p>
                                )}
                                {(selectedNotice.comments || []).map(cmt => {
                                    const isMyComment = cmt.ownerId === activeOwnerId;
                                    const isEditing = cmt.id === editingCommentId;

                                    return (
                                        <div key={cmt.id} className="flex gap-3 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80 shadow-sm group">
                                            <img src={cmt.ownerPhoto} alt="" className="w-8 h-8 rounded-full border border-slate-700 object-cover shrink-0" />
                                            <div className="flex flex-col min-w-0 flex-1">
                                                
                                                <div className="flex items-baseline justify-between mb-1">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-xs font-black text-emerald-400">{cmt.ownerName}</span>
                                                        <span className="text-[9px] text-slate-500">{formatDate(cmt.createdAt, true)}</span>
                                                    </div>
                                                    
                                                    {isMyComment && !isEditing && (
                                                        <div className="hidden group-hover:flex items-center gap-3">
                                                            <button onClick={() => startEditingComment(cmt)} className="text-[10px] font-bold text-slate-500 hover:text-yellow-400 transition-colors">수정</button>
                                                            <button onClick={() => handleDeleteComment(cmt.id)} className="text-[10px] font-bold text-slate-500 hover:text-red-400 transition-colors">삭제</button>
                                                        </div>
                                                    )}
                                                </div>

                                                {isEditing ? (
                                                    <div className="mt-2 flex flex-col gap-2">
                                                        <textarea 
                                                            value={editCommentText}
                                                            onChange={(e) => setEditCommentText(e.target.value)}
                                                            className="w-full bg-slate-950 p-3 rounded-xl border border-emerald-500/50 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none"
                                                            rows={2}
                                                        />
                                                        <div className="flex justify-end gap-2 mt-1">
                                                            <button onClick={() => setEditingCommentId(null)} className="px-4 py-1.5 text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors">취소</button>
                                                            <button onClick={() => handleSaveEditComment(cmt.id)} className="px-4 py-1.5 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-lg">저장</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-300 leading-snug whitespace-pre-wrap">{cmt.text}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex flex-col gap-3 border-t border-slate-800/50 pt-6">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pl-1 mb-1">댓글 쓰기</div>
                                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                                    <div className="flex items-center gap-2 bg-slate-900 p-2 sm:p-3 rounded-xl border border-slate-700 shrink-0">
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
                                            className="flex-1 bg-slate-900 px-4 py-3 rounded-xl border border-slate-700 text-white text-sm placeholder-slate-600 focus:border-emerald-500 transition-colors shadow-inner"
                                        />
                                        <button onClick={handleAddComment} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition-all shadow-lg shrink-0">
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