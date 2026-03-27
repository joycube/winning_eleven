"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, orderBy, doc, updateDoc, increment, arrayUnion, arrayRemove, onSnapshot, where, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { HighlightPost, FALLBACK_IMG, Owner } from '../types';
import { Heart, MessageSquare, Eye, Calendar, Flame, X, Trophy, Send, ThumbsUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
// 🔥 [수술 포인트] 기존 게시판에서 사용하는 스티커 셀렉터 임포트
import StickerSelector from './StickerSelector';

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";
const COMMON_DEFAULT_PROFILE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2364748b'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

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

// 🔥 [수술 포인트] 기존 게시판과 동일한 이미지 로직
const normalizeName = (str?: string | null): string => (str || '').replace(/[\s\.\-\_]/g, '').toLowerCase();
const isBadImage = (url?: string | null): boolean => !url || url.trim() === '' || url.includes('line-scdn.net') || url === FALLBACK_IMG;

const getBestProfileImage = (authUser: any, ownersList: any[], savedPhoto: string, authorName: string) => {
    const targetName = authorName;
    if (authUser && targetName === authUser.nickname && !isBadImage(authUser.photo)) return String(authUser.photo);
    if (targetName && ownersList && ownersList.length > 0) {
        const matchedOwner = ownersList.find(o => normalizeName(o.nickname) === normalizeName(targetName));
        if (matchedOwner && !isBadImage(matchedOwner.photo)) return String(matchedOwner.photo);
    }
    return savedPhoto && !isBadImage(savedPhoto) ? savedPhoto : COMMON_DEFAULT_PROFILE;
};

// 🔥 [수술 포인트] 스티커 렌더링 헬퍼 (기존 게시판 [STICKER] prefix 방식 적용)
const renderCommentContent = (text: string) => {
    if (text?.startsWith('[STICKER]')) {
        const stickerUrl = text.replace('[STICKER]', '');
        return <img src={stickerUrl} className="w-24 h-24 object-contain my-2 drop-shadow-md" alt="sticker" />;
    }
    return <p className="text-[14px] text-slate-200 font-medium whitespace-pre-wrap leading-relaxed">{text}</p>;
};

const CommentItem = ({ comment, onReply, isReply = false, authUser, owners }: { comment: any, onReply: (name: string, id: string) => void, isReply?: boolean, authUser: any, owners: any[] }) => {
    const isAuthor = authUser?.uid === comment.authorId;
    const profileImg = getBestProfileImage(authUser, owners, comment.authorPhoto, comment.authorName);

    return (
        <div className={`flex gap-3 py-4 ${!isReply ? 'border-b border-slate-800/50' : 'ml-12 mt-2 border-l-2 border-slate-800 pl-4'}`}>
            <img src={profileImg} className={`${isReply ? 'w-8 h-8' : 'w-10 h-10'} rounded-full object-cover shrink-0 bg-slate-800`} alt="" onError={(e:any)=>e.target.src=COMMON_DEFAULT_PROFILE} />
            <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-black text-emerald-400 italic">{comment.authorName}</span>
                    <span className="text-[10px] text-slate-500 font-bold">{comment.displayTime}</span>
                </div>
                <div className="text-[13px] text-slate-200 leading-relaxed break-words">
                    {renderCommentContent(comment.text)}
                </div>
                <div className="flex items-center gap-4 mt-3">
                    <button className="flex items-center gap-1.5 text-slate-500 hover:text-white transition-colors">
                        <ThumbsUp size={12} />
                        <span className="text-[11px] font-bold">좋아요 0</span>
                    </button>
                    {!isReply && (
                        <button onClick={() => onReply(comment.authorName, comment.id)} className="flex items-center gap-1.5 text-slate-500 hover:text-emerald-400 transition-colors">
                            <MessageSquare size={12} />
                            <span className="text-[11px] font-bold">답글</span>
                        </button>
                    )}
                    {isAuthor && (
                        <div className="flex gap-3 ml-auto">
                            <button className="text-[11px] text-slate-600 hover:text-white font-bold">수정</button>
                            <button className="text-[11px] text-slate-600 hover:text-red-400 font-bold">삭제</button>
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
    const [highlights, setHighlights] = useState<HighlightPost[]>([]);
    const [selectedSeason, setSelectedSeason] = useState<string>('ALL');
    const [sortBy, setSortBy] = useState<'LATEST' | 'POPULAR'>('LATEST');
    const [playingVideo, setPlayingVideo] = useState<HighlightPost | null>(null);

    const [comments, setComments] = useState<any[]>([]);
    const [commentInput, setCommentInput] = useState('');
    const [replyTo, setReplyTo] = useState<{ name: string, id: string } | null>(null);
    const [isSending, setIsSending] = useState(false);
    const commentInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const q = query(collection(db, 'highlights'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snap) => {
            setHighlights(snap.docs.map(doc => ({ ...doc.data() } as HighlightPost)));
        });
    }, []);

    useEffect(() => {
        if (!playingVideo) return;
        const q = query(collection(db, 'highlight_comments'), where('highlightId', '==', playingVideo.id), orderBy('createdAt', 'asc'));
        return onSnapshot(q, (snap) => {
            setComments(snap.docs.map(doc => {
                const data = doc.data();
                const date = new Date(data.createdAt);
                const displayTime = `${date.getMonth()+1}.${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2,'0')}`;
                return { id: doc.id, ...data, displayTime };
            }));
        });
    }, [playingVideo]);

    const filteredAndSortedHighlights = useMemo(() => {
        let result = [...highlights];
        if (selectedSeason !== 'ALL') result = result.filter(h => h.seasonName === selectedSeason);
        if (sortBy === 'LATEST') result.sort((a, b) => b.createdAt - a.createdAt);
        else if (sortBy === 'POPULAR') result.sort((a, b) => (b.views || 0) - (a.views || 0));
        return result;
    }, [highlights, selectedSeason, sortBy]);

    const availableSeasons = useMemo(() => Array.from(new Set(highlights.map(h => h.seasonName))), [highlights]);

    const handlePlayVideo = async (post: HighlightPost) => {
        setPlayingVideo(post);
        await updateDoc(doc(db, 'highlights', post.id), { views: increment(1) });
    };

    // 🔥 [수술 포인트] 스티커 및 댓글 통합 저장 로직 (L_PostDetail.tsx 방식)
    const handleAddComment = async (stickerUrl?: string) => {
        if (!authUser) return alert("로그인 후 이용 가능합니다.");
        if (isSending) return;
        
        const textToSubmit = stickerUrl ? `[STICKER]${stickerUrl}` : commentInput.trim();
        if (!textToSubmit && !stickerUrl) return;

        setIsSending(true);
        try {
            const authorName = authUser.nickname || '익명 구단주';
            const authorPhoto = getBestProfileImage(authUser, owners, authUser.photo || authUser.photoURL, authorName);

            const newComment = {
                highlightId: playingVideo!.id,
                authorId: authUser.uid,
                authorName: authorName,
                authorPhoto: authorPhoto,
                text: replyTo ? `@${replyTo.name} ${textToSubmit}` : textToSubmit,
                parentId: replyTo?.id || null,
                createdAt: Date.now()
            };
            
            await addDoc(collection(db, 'highlight_comments'), newComment);
            await updateDoc(doc(db, 'highlights', playingVideo!.id), { commentCount: increment(1) });
            
            setCommentInput('');
            setReplyTo(null);
        } catch (err) {
            console.error(err);
            alert("댓글 저장 중 오류가 발생했습니다.");
        } finally {
            setIsSending(false);
        }
    };

    const getWinnerLogo = (post: HighlightPost) => {
        const hs = Number(post.homeScore || 0); const as = Number(post.awayScore || 0);
        return (hs > as ? post.homeLogo : as > hs ? post.awayLogo : post.homeLogo) || SAFE_TBD_LOGO;
    };

    return (
        <div className="space-y-6">
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
                    <button onClick={() => setSelectedSeason('ALL')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${selectedSeason === 'ALL' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-900 text-slate-500 hover:text-white'}`}>ALL SEASONS</button>
                    {availableSeasons.map(s => <button key={s} onClick={() => setSelectedSeason(s)} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${selectedSeason === s ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-900 text-slate-500 hover:text-white'}`}>{s}</button>)}
                </div>
                <div className="flex items-center bg-slate-950 rounded-lg p-1 border border-slate-800">
                    <button onClick={() => setSortBy('LATEST')} className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${sortBy === 'LATEST' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500'}`}>최신순</button>
                    <button onClick={() => setSortBy('POPULAR')} className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${sortBy === 'POPULAR' ? 'bg-slate-800 text-red-400 shadow-sm' : 'text-slate-500'}`}>인기순</button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
                {filteredAndSortedHighlights.map((post) => (
                    <div key={post.id} onClick={() => handlePlayVideo(post)} className="group flex flex-col gap-3 cursor-pointer">
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800/50 shadow-md">
                            <img src={getYouTubeThumbnail(post.youtubeUrl)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
                            <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] font-black text-slate-200 uppercase">{post.matchLabel || 'HIGHLIGHT'}</div>
                            <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-md flex items-center gap-2 border border-slate-700/50 shadow-lg">
                                <img src={post.homeLogo || SAFE_TBD_LOGO} className="w-3.5 h-3.5 object-contain" alt="" />
                                <span className="text-[13px] font-black text-white">{post.homeScore}:{post.awayScore}</span>
                                <img src={post.awayLogo || SAFE_TBD_LOGO} className="w-3.5 h-3.5 object-contain" alt="" />
                            </div>
                        </div>
                        <div className="flex items-start gap-3 px-1">
                            <img src={getWinnerLogo(post)} className="w-9 h-9 rounded-full bg-white p-1 border border-slate-800" alt="" onError={(e:any)=>e.target.src=SAFE_TBD_LOGO} />
                            <div className="flex flex-col min-w-0">
                                <h3 className="text-[14px] font-black text-white line-clamp-2 uppercase leading-tight group-hover:text-blue-400 transition-colors">
                                    <span className="text-slate-500 mr-1.5">[{post.seasonName}]</span>
                                    {post.homeTeam} VS {post.awayTeam} ({post.homeScore}:{post.awayScore})
                                </h3>
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1.5 font-bold italic">
                                    <span>조회수 {post.views || 0}회</span>
                                    <span className="text-slate-700">•</span>
                                    <span>좋아요 {post.likes?.length || 0}개</span>
                                    <span className="text-slate-700">•</span>
                                    <span>댓글 {post.commentCount || 0}개</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {playingVideo && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setPlayingVideo(null)}></div>
                    <div className="relative w-full max-w-6xl bg-[#0b0e14] sm:rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col md:flex-row h-full sm:h-[85vh]">
                        
                        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-black md:bg-transparent">
                            <div className="aspect-video w-full bg-black shrink-0 relative">
                                <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${getYoutubeId(playingVideo.youtubeUrl)}?autoplay=1`} frameBorder="0" allowFullScreen></iframe>
                            </div>
                            <div className="p-5 sm:p-6 space-y-4">
                                <span className="text-blue-400 text-xs font-black italic tracking-widest uppercase">{playingVideo.seasonName}</span>
                                <h2 className="text-lg sm:text-2xl font-black text-white leading-tight uppercase italic tracking-tighter">{playingVideo.homeTeam} VS {playingVideo.awayTeam} <span className="text-emerald-400">({playingVideo.homeScore}:{playingVideo.awayScore})</span></h2>
                                
                                <div className="flex items-center justify-between py-4 border-t border-slate-800/50">
                                    <div className="flex items-center gap-3">
                                        <img src={getWinnerLogo(playingVideo)} className="w-11 h-11 rounded-full bg-white p-1 shadow-md border border-slate-800" alt="" />
                                        <div className="flex flex-col">
                                            <span className="text-[14px] font-black text-white italic uppercase tracking-tight">{playingVideo.homeTeam} VS {playingVideo.awayTeam}</span>
                                            <span className="text-[11px] text-slate-500 font-bold">{playingVideo.matchLabel} • 하이라이트 공식 미디어</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-slate-700 bg-slate-800 text-xs font-black text-slate-300 hover:text-white transition-all"><Heart size={16} />좋아요 {playingVideo.likes?.length || 0}</button>
                                        <div className="bg-slate-800 border border-slate-700 px-4 py-2.5 rounded-full text-xs font-black text-slate-400 shadow-inner flex items-center gap-2"><Eye size={14}/> {playingVideo.views}회</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:w-[450px] bg-[#0f141e] border-l border-slate-800 flex flex-col h-[450px] md:h-auto shrink-0">
                            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                                <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase italic tracking-tighter"><MessageSquare size={16} className="text-emerald-400" /> COMMENTS <span className="text-emerald-500">{comments.length}</span></h3>
                                <button onClick={() => setPlayingVideo(null)} className="md:hidden text-slate-500"><X size={20}/></button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1">
                                {comments.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3 italic">
                                        <MessageSquare size={32} opacity={0.3} />
                                        <span className="text-xs font-bold">첫 댓글을 남겨보세요!</span>
                                    </div>
                                ) : (
                                    comments.filter(c => !c.parentId).map(c => (
                                        <React.Fragment key={c.id}>
                                            <CommentItem comment={c} authUser={authUser} owners={owners} onReply={(name, id) => setReplyTo({name, id})} />
                                            {comments.filter(r => r.parentId === c.id).map(r => <CommentItem key={r.id} comment={r} isReply authUser={authUser} owners={owners} onReply={()=>{}} />)}
                                        </React.Fragment>
                                    ))
                                )}
                            </div>

                            <div className="p-4 bg-slate-900/80 border-t border-slate-800">
                                {replyTo && (
                                    <div className="flex items-center justify-between bg-slate-800 px-3 py-1.5 rounded-t-lg border-x border-t border-slate-700 text-[10px] text-emerald-400 font-black italic">
                                        <span>@{replyTo.name} 님에게 답글 중...</span>
                                        <button onClick={() => setReplyTo(null)} className="text-slate-500 hover:text-white"><X size={12}/></button>
                                    </div>
                                )}
                                <div className={`flex items-center gap-2 bg-slate-800 p-2 ${replyTo ? 'rounded-b-lg' : 'rounded-lg'} border border-slate-700 shadow-inner focus-within:border-emerald-500/50 transition-all`}>
                                    {/* 🔥 [수술 포인트] 기존 게시판 스티커 선택기 연동 */}
                                    <div className="shrink-0 relative z-[100]">
                                        <StickerSelector onSelect={(url) => handleAddComment(url)} />
                                    </div>
                                    <input 
                                        ref={commentInputRef}
                                        value={commentInput} 
                                        onChange={(e) => setCommentInput(e.target.value)} 
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) { e.preventDefault(); handleAddComment(); } }} 
                                        placeholder="내용을 입력하세요..." 
                                        className="bg-transparent border-none focus:ring-0 text-[13px] text-slate-200 flex-1 font-bold placeholder:text-slate-600" 
                                    />
                                    <button 
                                        onClick={() => handleAddComment()} 
                                        disabled={isSending || !commentInput.trim()}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all disabled:opacity-50"
                                    >
                                        <span className="text-[11px] font-black">등록</span>
                                        <Send size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setPlayingVideo(null)} className="absolute top-4 right-4 hidden md:flex bg-black/50 hover:bg-black text-white p-2 rounded-full border border-white/10 shadow-xl z-20 transition-all"><X size={20}/></button>
                    </div>
                </div>
            )}
        </div>
    );
}