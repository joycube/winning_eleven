"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, orderBy, doc, updateDoc, increment, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { HighlightPost, FALLBACK_IMG, Owner } from '../types';
import { Heart, MessageSquare, Eye, X, Send, ThumbsUp, Search } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import StickerSelector from './StickerSelector';

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";
const COMMON_DEFAULT_PROFILE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2364748b'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

interface ExtendedHighlight extends HighlightPost {
    comments?: any[];
}

const getYoutubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

const getYouTubeThumbnail = (url: string) => {
    const id = getYoutubeId(url);
    return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : FALLBACK_IMG;
};

const normalizeName = (str?: string | null): string => (str || '').replace(/[\s\.\-\_]/g, '').toLowerCase();
const isBadImage = (url?: string | null): boolean => !url || url.trim() === '' || url.includes('line-scdn.net') || url === FALLBACK_IMG;

// 🔥 [만능 오너 추적기] nickname, legacyName, mappedOwnerId 모두 검사
const findOwnerByUidOrName = (ownersList: any[], uid?: string | null, name?: string | null) => {
    if (!ownersList || ownersList.length === 0) return null;

    if (uid) {
        const byUid = ownersList.find((o: any) => o.uid === uid || String(o.id) === String(uid) || o.docId === uid);
        if (byUid) return byUid;
    }

    if (name) {
        const normName = normalizeName(name);
        const byName = ownersList.find((o: any) => {
            if (normalizeName(o.nickname) === normName) return true;
            if (normalizeName(o.mappedOwnerId) === normName) return true;
            if (normalizeName(o.legacyName) === normName) return true;
            if (Array.isArray(o.legacyNames) && o.legacyNames.some((ln: string) => normalizeName(ln) === normName)) return true;
            return false;
        });
        if (byName) return byName;
    }
    return null;
};

const formatDate = (ts: any, includeTime = false) => {
    if (!ts) return '방금 전';
    let d = typeof ts === 'number' ? new Date(ts) : typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return '방금 전';
    const datePart = `${String(d.getFullYear()).slice(-2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    const timePart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return includeTime ? `${datePart} ${timePart}` : datePart;
};

const MatchResultEmblem = ({ post, size = 'sm' }: { post: ExtendedHighlight, size?: 'sm' | 'lg' }) => {
    const hs = Number(post.homeScore || 0);
    const as = Number(post.awayScore || 0);
    const isDraw = hs === as;
    const winnerLogo = hs > as ? post.homeLogo : (as > hs ? post.awayLogo : post.homeLogo);
    
    const wClass = size === 'sm' ? 'w-9 h-9 p-1' : 'w-10 h-10 p-1';
    const subClass = size === 'sm' ? 'w-7 h-7 p-0.5 -ml-3' : 'w-8 h-8 p-1 -ml-3.5';

    if (isDraw) {
        return (
            <div className="flex items-center shrink-0">
                <div className={`${wClass} rounded-full bg-white border border-slate-300 relative z-10 shadow-md flex items-center justify-center`}>
                    <img src={post.homeLogo || SAFE_TBD_LOGO} className="w-full h-full object-contain" alt="home" onError={(e:any)=>e.target.src=SAFE_TBD_LOGO} />
                </div>
                <div className={`${subClass} rounded-full bg-slate-200 border border-slate-400 relative z-0 opacity-90 flex items-center justify-center`}>
                    <img src={post.awayLogo || SAFE_TBD_LOGO} className="w-full h-full object-contain" alt="away" onError={(e:any)=>e.target.src=SAFE_TBD_LOGO} />
                </div>
            </div>
        );
    }
    return (
        <div className={`${wClass} rounded-full bg-white border border-slate-300 shrink-0 shadow-md flex items-center justify-center`}>
            <img src={winnerLogo || SAFE_TBD_LOGO} className="w-full h-full object-contain" alt="winner" onError={(e:any)=>e.target.src=SAFE_TBD_LOGO} />
        </div>
    );
};

const TeamStatCard = ({ teamName, teamLogo, rankingData, owners }: any) => {
    const list = Array.isArray(rankingData) ? rankingData : (rankingData?.rankings || rankingData?.teams || []);
    const stat = list.find((item: any) => normalizeName(item.teamName || item.team || item.name) === normalizeName(teamName));
    
    let ownerName = stat?.ownerName || '알 수 없음';
    let ownerPhoto = COMMON_DEFAULT_PROFILE;

    // 🔥 만능 추적기로 매칭 시도
    const matchedOwner = findOwnerByUidOrName(owners, stat?.ownerId, ownerName);

    if (matchedOwner) {
        // 🔥 최신 닉네임으로 완벽하게 덮어쓰기
        ownerName = matchedOwner.nickname || matchedOwner.mappedOwnerId || matchedOwner.displayName || ownerName;
        if (!isBadImage(matchedOwner.photo)) ownerPhoto = matchedOwner.photo;
        else if (!isBadImage(matchedOwner.photoURL)) ownerPhoto = matchedOwner.photoURL;
    }

    const win = Number(stat?.win || 0);
    const draw = Number(stat?.draw || 0);
    const lose = Number(stat?.lose || 0);
    const total = win + draw + lose;
    const winRate = total > 0 ? ((win / total) * 100).toFixed(1) : '0.0';

    return (
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-2 rounded-lg border border-slate-800 w-full shadow-inner">
            <img src={ownerPhoto} className="w-7 h-7 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0" alt="owner" onError={(e:any)=>e.target.src=COMMON_DEFAULT_PROFILE} />
            <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] font-black text-emerald-400 truncate leading-tight">{ownerName}</span>
                <div className="flex items-center gap-1 mt-0.5">
                    <div className="w-3 h-3 rounded-full bg-white flex items-center justify-center p-[1px] shadow-sm shrink-0">
                        <img src={teamLogo || SAFE_TBD_LOGO} className="w-full h-full object-contain" alt=""/>
                    </div>
                    <span className="text-[9px] text-slate-300 font-bold truncate leading-tight">{teamName}</span>
                </div>
            </div>
            {total > 0 && (
                <div className="flex flex-col items-end shrink-0 pl-1.5 border-l border-slate-700/50">
                    <span className="text-[8px] text-slate-300 font-bold tracking-tight leading-tight">{win}승 {draw}무 {lose}패</span>
                    <span className="text-[10px] font-black text-white mt-0.5 leading-tight">
                        <span className={Number(winRate) >= 50 ? 'text-emerald-400' : 'text-red-400'}>{winRate}%</span>
                    </span>
                    <span className="text-[6.5px] text-slate-500 font-bold mt-1 tracking-tighter leading-tight text-right whitespace-nowrap">
                        *이번 시즌 {teamName} 기준
                    </span>
                </div>
            )}
        </div>
    );
};

const renderCommentContent = (text: string) => {
    if (!text) return null;
    if (text.startsWith('[STICKER]')) {
        const stickerUrl = text.replace('[STICKER]', '');
        return <img src={stickerUrl} className="w-20 h-20 sm:w-24 sm:h-24 object-contain my-2 drop-shadow-md" alt="sticker" />;
    }
    return <p className="text-[12px] sm:text-[13px] text-slate-200 leading-relaxed break-words">{text}</p>;
};

const CommentItem = ({ comment, onReply, onLike, isReply = false, authUser, owners }: { comment: any, onReply: (name: string, id: string) => void, onLike: (id: string) => void, isReply?: boolean, authUser: any, owners: Owner[] }) => {
    const isAuthor = authUser?.uid === comment.authorId || authUser?.uid === comment.authorUid;
    const isLiked = comment.likes?.includes(authUser?.uid);

    // 🔥 댓글 작성자 이름과 사진도 만능 추적기로 소급 적용 (과거 닉네임으로 쓴 댓글도 현재 닉네임과 사진으로 노출)
    const matchedOwner = findOwnerByUidOrName(owners, comment.authorUid || comment.authorId, comment.authorName);
    const displayAuthorName = matchedOwner?.nickname || matchedOwner?.mappedOwnerId || matchedOwner?.displayName || comment.authorName;
    let profileImg = comment.authorPhoto;

    if (matchedOwner) {
        if (!isBadImage(matchedOwner.photo)) profileImg = matchedOwner.photo;
        else if (!isBadImage(matchedOwner.photoURL)) profileImg = matchedOwner.photoURL;
    }
    if (isBadImage(profileImg)) profileImg = COMMON_DEFAULT_PROFILE;

    return (
        <div className={`flex gap-2 sm:gap-3 py-3 sm:py-4 ${!isReply ? 'border-b border-slate-800/50' : 'ml-10 sm:ml-12 mt-2 border-l-2 border-slate-800 pl-3 sm:pl-4'}`}>
            <img src={profileImg} className={`${isReply ? 'w-7 h-7 sm:w-8 sm:h-8' : 'w-9 h-9 sm:w-10 sm:h-10'} rounded-full object-cover shrink-0 bg-slate-800 border border-slate-700`} alt="" onError={(e:any)=>{e.target.src=COMMON_DEFAULT_PROFILE}} />
            <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs sm:text-[13px] font-black text-emerald-400 italic">{displayAuthorName}</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold">{comment.displayTime || formatDate(comment.createdAt, true)}</span>
                </div>
                
                {renderCommentContent(comment.text)}
                
                <div className="flex items-center gap-3 sm:gap-4 mt-2 sm:mt-3">
                    <button onClick={() => onLike(comment.id)} className={`flex items-center gap-1.5 transition-colors ${isLiked ? 'text-emerald-400' : 'text-slate-500 hover:text-white'}`}>
                        <ThumbsUp size={12} className={isLiked ? 'fill-emerald-400' : ''} />
                        <span className="text-[10px] sm:text-[11px] font-bold">좋아요 {comment.likes?.length || 0}</span>
                    </button>
                    {!isReply && (
                        <button onClick={() => onReply(displayAuthorName, comment.id)} className="flex items-center gap-1.5 text-slate-500 hover:text-emerald-400 transition-colors">
                            <MessageSquare size={12} />
                            <span className="text-[10px] sm:text-[11px] font-bold">답글</span>
                        </button>
                    )}
                    {isAuthor && (
                        <div className="flex gap-3 ml-auto">
                            <button className="text-[10px] sm:text-[11px] text-slate-600 hover:text-white font-bold">수정</button>
                            <button className="text-[10px] sm:text-[11px] text-slate-600 hover:text-red-400 font-bold">삭제</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface RHighlightsTabProps {
  currentSeason?: any;
  activeRankingData?: any;
  owners: Owner[];
}

export default function R_HighlightsTab({ currentSeason, activeRankingData, owners }: RHighlightsTabProps) {
    const { authUser } = useAuth();
    const [highlights, setHighlights] = useState<ExtendedHighlight[]>([]);
    const [sortBy, setSortBy] = useState<'LATEST' | 'POPULAR'>('LATEST');
    const [searchQuery, setSearchQuery] = useState('');
    const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

    const [commentText, setCommentText] = useState('');
    const [replyText, setReplyText] = useState('');
    const [editCommentText, setEditCommentText] = useState('');
    const [replyingTo, setReplyingTo] = useState<{ parentId: string, targetId: string, authorName: string } | null>(null);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false); 
    const commentInputRef = useRef<HTMLInputElement>(null);
    const viewedPostRef = useRef<string | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'highlights'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snap) => {
            setHighlights(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtendedHighlight)));
        });
    }, []);

    const activeVideo = highlights.find(h => h.id === playingVideoId);

    useEffect(() => {
        if (activeVideo && activeVideo.id && viewedPostRef.current !== activeVideo.id) {
            viewedPostRef.current = activeVideo.id;
            const incrementViewCount = async () => {
                try { await updateDoc(doc(db, 'highlights', activeVideo.id), { views: increment(1) }); } 
                catch (error) { console.error(error); }
            };
            incrementViewCount();
        }
    }, [activeVideo?.id]);

    const filteredAndSortedHighlights = useMemo(() => {
        const targetSeasonName = currentSeason?.seasonName || currentSeason?.name;
        if (!targetSeasonName) return [];

        let result = highlights.filter(h => h.seasonName === targetSeasonName);

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(h => 
                (h.homeTeam && h.homeTeam.toLowerCase().includes(q)) ||
                (h.awayTeam && h.awayTeam.toLowerCase().includes(q)) ||
                (h.matchLabel && h.matchLabel.toLowerCase().includes(q))
            );
        }

        if (sortBy === 'LATEST') result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        else if (sortBy === 'POPULAR') result.sort((a, b) => (b.views || 0) - (a.views || 0));

        return result;
    }, [highlights, currentSeason, sortBy, searchQuery]);

    const submitComment = async (isReply: boolean, stickerUrl?: string) => {
        if (!authUser) return alert("로그인 후 이용해주세요.");
        if (isSending || !activeVideo) return; 
        const textToSubmit = stickerUrl ? `[STICKER]${stickerUrl}` : (isReply ? replyText.trim() : commentText.trim());
        if (!textToSubmit) return alert("내용을 입력해주세요.");
        
        setIsSending(true);
        try {
            const matchedOwner = findOwnerByUidOrName(owners, authUser.uid, authUser.displayName);
            const authorName = matchedOwner?.nickname || authUser.displayName || '익명 구단주';
            
            let authorPhoto = COMMON_DEFAULT_PROFILE;
            if (matchedOwner) {
                if (!isBadImage(matchedOwner.photo)) authorPhoto = matchedOwner.photo;
                else if (!isBadImage(matchedOwner.photoURL)) authorPhoto = matchedOwner.photoURL;
            } else if (!isBadImage(authUser.photoURL)) {
                authorPhoto = authUser.photoURL;
            }
            
            let updatedComments = [...(activeVideo.comments || [])];
            
            updatedComments.push({ 
                id: `cmt_${Date.now()}`, 
                authorId: authUser.uid, 
                authorUid: authUser.uid, 
                authorName: authorName, 
                authorPhoto: authorPhoto, 
                text: textToSubmit, 
                createdAt: Date.now(), 
                parentId: isReply ? replyingTo!.parentId : null, 
                likes: [], 
                isEdited: false 
            });

            await updateDoc(doc(db, 'highlights', activeVideo.id!), { comments: updatedComments });
            isReply ? setReplyText('') : setCommentText('');
            if (isReply) setReplyingTo(null);
        } catch(e) {
            alert("댓글 작성 중 오류가 발생했습니다.");
        } finally { setIsSending(false); }
    };

    const handleSaveEdit = async () => {
        if (!authUser || !editCommentText.trim() || !editingCommentId || !activeVideo) return;
        try {
            let updatedComments = [...(activeVideo.comments || [])];
            updatedComments = updatedComments.map((c:any) => c.id === editingCommentId ? { ...c, text: editCommentText.trim(), isEdited: true } : c);
            await updateDoc(doc(db, 'highlights', activeVideo.id!), { comments: updatedComments });
            setEditCommentText(''); setEditingCommentId(null);
        } catch (e) {}
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!window.confirm("댓글을 삭제하시겠습니까?")) return;
        if (!activeVideo) return;
        let updatedComments = [...(activeVideo.comments || [])].filter((c: any) => c.id !== commentId && c.parentId !== commentId);
        await updateDoc(doc(db, 'highlights', activeVideo.id!), { comments: updatedComments });
    };

    const handleCommentReaction = async (commentId: string) => {
        if (!authUser || !activeVideo) return;
        try {
            let updatedComments = [...(activeVideo.comments || [])];
            updatedComments = updatedComments.map((c:any) => c.id === commentId ? { ...c, likes: c.likes?.includes(authUser.uid) ? c.likes.filter((id: string) => id !== authUser.uid) : [...(c.likes||[]), authUser.uid] } : c);
            await updateDoc(doc(db, 'highlights', activeVideo.id!), { comments: updatedComments });
        } catch (e) {}
    };

    const handleTogglePostLike = async (e: React.MouseEvent, post: ExtendedHighlight) => {
        e.stopPropagation();
        if (!authUser) return alert("로그인이 필요한 기능입니다.");
        const isLiked = post.likes?.includes(authUser.uid);
        await updateDoc(doc(db, 'highlights', post.id!), { likes: isLiked ? arrayRemove(authUser.uid) : arrayUnion(authUser.uid) });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {activeVideo && <style>{`button[class*="fixed bottom-"], .scroll-to-top { display: none !important; }`}</style>}

            {(highlights.filter(h => h.seasonName === (currentSeason?.seasonName || currentSeason?.name)).length > 0) && (
                <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-3 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
                    <div className="relative w-full md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={14} className="text-slate-500" />
                        </div>
                        <input 
                            type="text" 
                            placeholder="팀명, 라운드 검색..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white text-xs font-bold rounded-lg pl-9 pr-8 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white transition-colors">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center bg-slate-950 rounded-lg p-1 border border-slate-800 shrink-0 w-full md:w-auto justify-end">
                        <button onClick={() => setSortBy('LATEST')} className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${sortBy === 'LATEST' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>최신순</button>
                        <button onClick={() => setSortBy('POPULAR')} className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${sortBy === 'POPULAR' ? 'bg-slate-800 text-red-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>인기순</button>
                    </div>
                </div>
            )}

            {highlights.filter(h => h.seasonName === (currentSeason?.seasonName || currentSeason?.name)).length === 0 ? (
                <div className="py-20 text-center text-slate-500 font-bold italic bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed shadow-inner">
                    아직 등록 된 하이라이트가 없습니다.
                </div>
            ) : filteredAndSortedHighlights.length === 0 ? (
                <div className="py-20 text-center text-slate-500 font-bold italic bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed shadow-inner">
                    검색 결과와 일치하는 영상이 없습니다. 🥲
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
                    {filteredAndSortedHighlights.map((post) => (
                        <div key={post.id} onClick={() => setPlayingVideoId(post.id!)} className="group flex flex-col gap-3 cursor-pointer">
                            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800/50 shadow-md">
                                <img src={getYouTubeThumbnail(post.youtubeUrl)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
                                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] font-black text-slate-200 uppercase">{post.matchLabel || 'HIGHLIGHT'}</div>
                                <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-md flex items-center gap-2 border border-slate-700/50 shadow-lg">
                                    <img src={post.homeLogo || SAFE_TBD_LOGO} className="w-3.5 h-3.5 object-contain" alt="" />
                                    <span className="text-[13px] font-black text-white tracking-tighter">{post.homeScore}:{post.awayScore}</span>
                                    <img src={post.awayLogo || SAFE_TBD_LOGO} className="w-3.5 h-3.5 object-contain" alt="" />
                                </div>
                            </div>
                            <div className="flex items-start gap-3 px-1">
                                <MatchResultEmblem post={post} size="sm" />
                                <div className="flex flex-col min-w-0">
                                    <h3 className="text-[14px] font-black text-white line-clamp-2 uppercase leading-tight group-hover:text-blue-400 transition-colors">
                                        <span className="text-slate-500 mr-1.5">[{post.seasonName}]</span>
                                        {post.homeTeam} VS {post.awayTeam} <span className={`${Number(post.homeScore) === Number(post.awayScore) ? 'text-slate-400' : 'text-emerald-400'} ml-0.5`}>({post.homeScore}:{post.awayScore})</span>
                                    </h3>
                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1.5 font-bold italic">
                                        <span>조회수 {post.views || 0}회</span>
                                        <span className="text-slate-700">•</span>
                                        <span>좋아요 {post.likes?.length || 0}개</span>
                                        <span className="text-slate-700">•</span>
                                        <span>댓글 {post.comments?.length || 0}개</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 🎬 뷰 모달 */}
            {activeVideo && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-0 sm:p-6 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => { setPlayingVideoId(null); viewedPostRef.current = null; }}></div>
                    <div className="relative w-full max-w-6xl bg-[#0b0e14] sm:rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col md:flex-row h-full sm:h-[85vh]">
                        
                        <div className="flex-1 flex flex-col bg-black md:bg-transparent h-full md:overflow-y-auto custom-scrollbar">
                            <div className="aspect-video w-full bg-black shrink-0 relative">
                                <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${getYoutubeId(activeVideo.youtubeUrl)}?autoplay=1`} frameBorder="0" allowFullScreen></iframe>
                            </div>
                            
                            <div className="p-3 sm:p-5 space-y-3 shrink-0 bg-[#0b0e14]">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-blue-400 text-[10px] font-black italic tracking-widest uppercase">{activeVideo.seasonName}</span>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <MatchResultEmblem post={activeVideo} size="lg" />
                                        <h2 className="text-base sm:text-xl font-black text-white leading-tight uppercase italic tracking-tighter">
                                            {activeVideo.homeTeam} VS {activeVideo.awayTeam} <span className={`${Number(activeVideo.homeScore) === Number(activeVideo.awayScore) ? 'text-slate-400' : 'text-emerald-400'} ml-0.5`}>({activeVideo.homeScore}:{activeVideo.awayScore})</span>
                                        </h2>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <button onClick={(e) => handleTogglePostLike(e, activeVideo)} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-black transition-all ${activeVideo.likes?.includes(authUser?.uid!) ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'}`}>
                                            <Heart size={12} fill={activeVideo.likes?.includes(authUser?.uid!) ? "currentColor" : "none"} />
                                            {activeVideo.likes?.length || 0}
                                        </button>
                                        <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 px-2 py-1 rounded text-[10px] font-black text-slate-400 shadow-inner">
                                            <Eye size={12}/> {activeVideo.views || 0}
                                        </div>
                                        <div className="text-[9px] text-slate-500 font-bold ml-auto uppercase">
                                            {activeVideo.matchLabel}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-3 mt-2 border-t border-slate-800/50">
                                    <TeamStatCard teamName={activeVideo.homeTeam} teamLogo={activeVideo.homeLogo} rankingData={activeRankingData} owners={owners} />
                                    <TeamStatCard teamName={activeVideo.awayTeam} teamLogo={activeVideo.awayLogo} rankingData={activeRankingData} owners={owners} />
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:w-[420px] bg-[#0f141e] border-l border-slate-800 flex flex-col h-[400px] md:h-auto shrink-0 flex-1">
                            <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 shrink-0">
                                <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase italic tracking-tighter">
                                    <MessageSquare size={14} className="text-emerald-400" /> COMMENTS 
                                    <span className="text-emerald-500">{(activeVideo.comments || []).length}</span>
                                </h3>
                                <button onClick={() => { setPlayingVideoId(null); viewedPostRef.current = null; }} className="md:hidden text-slate-500 hover:text-white"><X size={20}/></button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4">
                                {(!activeVideo.comments || activeVideo.comments.length === 0) ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3 italic">
                                        <MessageSquare size={32} opacity={0.3} />
                                        <span className="text-xs font-bold">첫 댓글을 남겨보세요!</span>
                                    </div>
                                ) : (
                                    (activeVideo.comments || []).filter((c:any) => !c.parentId).map((comment: any) => {
                                        const replies = (activeVideo.comments||[]).filter((c: any) => c.parentId === comment.id);
                                        const isLiked = comment.likes?.includes(authUser?.uid);
                                        const isSticker = comment.text?.startsWith('[STICKER]');
                                        const isCommentAuthor = authUser?.uid === comment.authorUid || authUser?.uid === comment.authorId;

                                        return (
                                            <div key={comment.id} className="border-b border-slate-800/60 py-3 sm:py-4 last:border-0">
                                                {/* 🔥 댓글 내용 매핑 로직 */}
                                                <CommentItem comment={comment} authUser={authUser} owners={owners} onReply={(name, id) => setReplyingTo({ parentId: id, targetId: id, authorName: name })} onLike={(id) => handleCommentReaction(id)} />

                                                {replies.length > 0 && (
                                                    <div className="mt-3 space-y-3 pl-8 sm:pl-10 border-l-2 border-slate-800/50 ml-3">
                                                        {replies.map((reply: any) => (
                                                            <CommentItem key={reply.id} comment={reply} isReply authUser={authUser} owners={owners} onReply={(name, id) => setReplyingTo({ parentId: comment.id, targetId: id, authorName: name })} onLike={(id) => handleCommentReaction(id)} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="p-3 sm:p-4 bg-slate-900/80 border-t border-slate-800 shrink-0">
                                {replyingTo && (
                                    <div className="flex justify-between items-center bg-slate-800/50 px-3 py-1.5 rounded-t-lg border-x border-t border-slate-700/50 text-[10px] text-emerald-400 font-black italic">
                                        <span>@{replyingTo.authorName} 님에게 답글 중...</span>
                                        <button onClick={() => setReplyingTo(null)} className="text-slate-500 hover:text-white"><X size={12}/></button>
                                    </div>
                                )}
                                <div className={`flex items-center gap-2 bg-slate-800 p-1.5 sm:p-2 ${replyingTo ? 'rounded-b-lg' : 'rounded-lg'} border border-slate-700 shadow-inner focus-within:border-emerald-500/50 transition-all`}>
                                    <div className="shrink-0 relative z-[100] flex items-center justify-center pl-1">
                                        <StickerSelector onSelect={(url: string) => submitComment(!!replyingTo, url)} />
                                    </div>
                                    <input 
                                        ref={commentInputRef}
                                        value={replyingTo ? replyText : commentText} 
                                        onChange={(e) => replyingTo ? setReplyText(e.target.value) : setCommentText(e.target.value)} 
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) { e.preventDefault(); submitComment(!!replyingTo); } }} 
                                        placeholder={replyingTo ? "답글을 입력하세요..." : "내용을 입력하세요..."} 
                                        disabled={isSending}
                                        className="bg-transparent border-none focus:ring-0 text-[11px] sm:text-[13px] text-slate-200 flex-1 font-bold placeholder:text-slate-600 disabled:opacity-50" 
                                    />
                                    <button 
                                        onClick={() => submitComment(!!replyingTo)} 
                                        disabled={isSending || (replyingTo ? !replyText.trim() : !commentText.trim())}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-md flex items-center gap-1 sm:gap-1.5 transition-all disabled:opacity-50 disabled:bg-slate-700"
                                    >
                                        <span className="text-[10px] sm:text-[11px] font-black">등록</span>
                                        <Send size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => { setPlayingVideoId(null); viewedPostRef.current = null; }} className="absolute top-4 right-4 hidden md:flex bg-black/50 hover:bg-black text-white p-2 rounded-full border border-white/10 shadow-xl z-20 transition-all"><X size={20}/></button>
                    </div>
                </div>
            )}
        </div>
    );
}