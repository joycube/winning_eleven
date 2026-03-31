"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Heart, Eye, MessageSquare, Send, ThumbsUp } from 'lucide-react';
import { doc, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { FALLBACK_IMG, Owner } from '../types';
import StickerSelector from './StickerSelector';

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";
const COMMON_DEFAULT_PROFILE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2364748b'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

const getYoutubeId = (url: string) => {
    if (!url) return null;
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regExp);
    return match ? match[1] : null;
};
const getValidVideoUrl = (post: any) => post?.url || post?.videoUrl || post?.youtubeUrl || '';
const normalizeName = (str?: string | null): string => (str || '').replace(/[\s\.\-\_]/g, '').toLowerCase();
const cleanSeasonName = (name: string) => (name || '').replace(/^(🏆|🏳️|⚔️|⚽|🗓️|⭐)\s*/, '').trim();
const isBadImage = (url?: string | null): boolean => !url || url.trim() === '' || url.includes('line-scdn.net') || url === FALLBACK_IMG;

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

const MatchResultEmblem = ({ post, size = 'sm' }: { post: any, size?: 'sm' | 'lg' }) => {
    const hs = Number(post.homeScore || 0);
    const as = Number(post.awayScore || 0);
    const isDraw = hs === as;
    const winnerLogo = hs > as ? post.homeLogo : (as > hs ? post.awayLogo : post.homeLogo);
    const wClass = size === 'sm' ? 'w-9 h-9 p-1' : 'w-10 h-10 p-1';
    const subClass = size === 'sm' ? 'w-7 h-7 p-0.5 -ml-3' : 'w-8 h-8 p-1 -ml-3.5';

    if (isDraw) {
        return (
            <div className="flex items-center shrink-0 mt-0.5">
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
        <div className={`${wClass} rounded-full bg-white border border-slate-300 shrink-0 shadow-md flex items-center justify-center mt-0.5`}>
            <img src={winnerLogo || SAFE_TBD_LOGO} className="w-full h-full object-contain" alt="winner" onError={(e:any)=>e.target.src=SAFE_TBD_LOGO} />
        </div>
    );
};

const TeamStatCard = ({ teamName, teamLogo, historicalTeamsData, owners, fallbackOwnerName, fallbackOwnerUid }: any) => {
    const targetTeamName = normalizeName(teamName);
    const stat = (historicalTeamsData || []).find((item: any) => {
        const itemName = normalizeName(item.teamName || item.team || item.name);
        return itemName === targetTeamName || itemName.includes(targetTeamName) || targetTeamName.includes(itemName);
    }) || { win: 0, draw: 0, loss: 0, lose: 0, ownerName: fallbackOwnerName || '-', ownerId: fallbackOwnerUid || null };
    
    let ownerName = stat.ownerName !== '-' ? stat.ownerName : (fallbackOwnerName || '알 수 없음');
    let ownerPhoto = COMMON_DEFAULT_PROFILE;
    const matchedOwner = findOwnerByUidOrName(owners, stat.ownerId || fallbackOwnerUid, ownerName);

    if (matchedOwner) {
        ownerName = matchedOwner.nickname || matchedOwner.mappedOwnerId || matchedOwner.displayName || ownerName;
        if (!isBadImage(matchedOwner.photo)) ownerPhoto = matchedOwner.photo;
        else if (!isBadImage(matchedOwner.photoURL)) ownerPhoto = matchedOwner.photoURL;
    }

    const win = Number(stat.win || 0);
    const draw = Number(stat.draw || 0);
    const lose = Number(stat.loss || stat.lose || 0);
    const total = win + draw + lose;
    const winRate = total > 0 ? ((win / total) * 100).toFixed(1) : '0.0';

    return (
        <div className="flex items-center gap-2 bg-slate-900/80 p-3 rounded-lg border border-slate-800 w-full shadow-inner h-full">
            <img src={ownerPhoto} className="w-10 h-10 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0" alt="owner" onError={(e:any)=>e.target.src=COMMON_DEFAULT_PROFILE} />
            <div className="flex flex-col min-w-0 flex-1 justify-center">
                <span className="text-xs font-black text-emerald-400 truncate leading-tight mb-1">{ownerName}</span>
                <div className="flex items-center gap-1.5">
                    <img src={teamLogo || SAFE_TBD_LOGO} className="w-4 h-4 object-contain shrink-0" alt=""/>
                    <span className="text-[11px] text-slate-300 font-bold truncate leading-tight">{teamName}</span>
                </div>
            </div>
            <div className="flex flex-col items-end shrink-0 pl-4 border-l border-slate-700/50 justify-center h-full">
                <span className="text-xs text-slate-300 font-black tracking-tight leading-tight mb-1">{win}승 {draw}무 {lose}패</span>
                <span className="text-base font-black text-white leading-tight">
                    <span className={Number(winRate) >= 50 ? 'text-rose-400' : 'text-slate-400'}>{winRate}%</span>
                </span>
            </div>
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

const CommentItem = ({ comment, onReply, onLike, isReply = false, authUser, owners, setEditingCommentId, setEditCommentText, handleDeleteComment }: any) => {
    const isAuthor = authUser?.uid === comment.authorId || authUser?.uid === comment.authorUid;
    const isLiked = comment.likes?.includes(authUser?.uid);
    const matchedOwner = findOwnerByUidOrName(owners, comment.authorUid || comment.authorId, comment.authorName);
    const displayAuthorName = matchedOwner?.nickname || matchedOwner?.mappedOwnerId || matchedOwner?.displayName || comment.authorName;
    let profileImg = comment.authorPhoto;

    if (matchedOwner) {
        if (!isBadImage(matchedOwner.photo)) profileImg = matchedOwner.photo;
        else if (!isBadImage(matchedOwner.photoURL)) profileImg = matchedOwner.photoURL;
    }
    if (isBadImage(profileImg)) profileImg = COMMON_DEFAULT_PROFILE;
    const isSticker = comment.text?.startsWith('[STICKER]');

    return (
        <div className={`flex gap-2 sm:gap-3 py-3 sm:py-4 ${!isReply ? 'border-b border-slate-800/50' : 'ml-10 sm:ml-12 mt-2 border-l-2 border-slate-800 pl-3 sm:pl-4'}`}>
            <img src={profileImg} className={`${isReply ? 'w-7 h-7 sm:w-8 sm:h-8' : 'w-9 h-9 sm:w-10 sm:h-10'} rounded-full object-cover shrink-0 bg-slate-800 border border-slate-700`} alt="" onError={(e:any)=>{e.target.src=COMMON_DEFAULT_PROFILE}} />
            <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs sm:text-[13px] font-black text-emerald-400 italic">{displayAuthorName}</span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold">{comment.displayTime || formatDate(comment.createdAt, true)} {comment.isEdited && '(수정됨)'}</span>
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
                            {!isSticker && <button onClick={() => { setEditingCommentId(comment.id); setEditCommentText(comment.text); }} className="text-[10px] sm:text-[11px] text-slate-600 hover:text-blue-400 font-bold">수정</button>}
                            <button onClick={() => handleDeleteComment(comment.id)} className="text-[10px] sm:text-[11px] text-slate-600 hover:text-red-400 font-bold">삭제</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function HighlightViewerModal({ activeVideo, onClose, authUser, owners, seasons }: any) {
    const [commentText, setCommentText] = useState('');
    const [replyText, setReplyText] = useState('');
    const [editCommentText, setEditCommentText] = useState('');
    const [replyingTo, setReplyingTo] = useState<{ parentId: string, targetId: string, authorName: string } | null>(null);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false); 
    const commentInputRef = useRef<HTMLInputElement>(null);
    const viewedPostRef = useRef<string | null>(null);

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

    const historicalTeamsData = useMemo(() => {
        if (!activeVideo || !seasons || seasons.length === 0) return [];
        const targetSeason = seasons.find((s: any) => {
            if (activeVideo.seasonId && String(s.id) === String(activeVideo.seasonId)) return true;
            return cleanSeasonName(s.name || '') === cleanSeasonName(activeVideo.seasonName || '');
        });
        if (!targetSeason) return [];

        const teamStats: Record<string, any> = {};
        let baseTeams: any[] = [];
        
        if (Array.isArray(targetSeason.teams)) baseTeams = targetSeason.teams;
        else if (targetSeason.rankings) baseTeams = targetSeason.rankings;
        else if (targetSeason.groups) {
            Object.values(targetSeason.groups).forEach((groupData: any) => {
                if (Array.isArray(groupData)) baseTeams = [...baseTeams, ...groupData];
                else if (groupData.teams) baseTeams = [...baseTeams, ...groupData.teams];
            });
        }

        baseTeams.forEach((t: any) => {
            const normName = normalizeName(t.teamName || t.team || t.name);
            teamStats[normName] = { 
                ...t, win: 0, draw: 0, loss: 0, 
                name: t.teamName || t.team || t.name, ownerName: t.ownerName || '-', ownerId: t.ownerId || t.ownerUid || null
            };
        });

        if (!targetSeason.rounds) return Object.values(teamStats);

        const playoffKeywords = ['ROUND_OF', 'QUARTER', 'SEMI', 'FINAL', '결승', '4강', '8강', '16강', 'PO', '플레이오프', '토너먼트', '34', 'KNOCKOUT'];
        targetSeason.rounds.forEach((r: any) => {
            const isPlayoffRound = playoffKeywords.some(kw => (r.name || '').toUpperCase().includes(kw));
            r.matches?.forEach((m: any) => {
                if (m.status !== 'COMPLETED' || m.home === 'BYE' || m.away === 'BYE' || m.home === 'TBD' || m.away === 'TBD') return;
                const matchStr = `${m.stage || ''} ${m.matchLabel || ''}`.toUpperCase();
                const isPlayoffMatch = isPlayoffRound || playoffKeywords.some(kw => matchStr.includes(kw));
                if ((targetSeason.type === 'CUP' || targetSeason.type === 'LEAGUE_PLAYOFF') && isPlayoffMatch) return; 

                const hTeamNorm = normalizeName(m.home);
                const aTeamNorm = normalizeName(m.away);
                const hScore = Number(m.homeScore);
                const aScore = Number(m.awayScore);

                if (!teamStats[hTeamNorm]) teamStats[hTeamNorm] = { name: m.home, win: 0, draw: 0, loss: 0, ownerName: m.homeOwner || '-', ownerId: m.homeOwnerUid || null };
                if (!teamStats[aTeamNorm]) teamStats[aTeamNorm] = { name: m.away, win: 0, draw: 0, loss: 0, ownerName: m.awayOwner || '-', ownerId: m.awayOwnerUid || null };

                if (hScore > aScore) { teamStats[hTeamNorm].win += 1; teamStats[aTeamNorm].loss += 1; } 
                else if (hScore < aScore) { teamStats[aTeamNorm].win += 1; teamStats[hTeamNorm].loss += 1; } 
                else { teamStats[hTeamNorm].draw += 1; teamStats[aTeamNorm].draw += 1; }
            });
        });
        return Object.values(teamStats);
    }, [activeVideo, seasons]);

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
            } else if (!isBadImage(authUser.photoURL)) { authorPhoto = authUser.photoURL; }
            
            let updatedComments = [...(activeVideo.comments || [])];
            updatedComments.push({ 
                id: `cmt_${Date.now()}`, authorId: authUser.uid, authorUid: authUser.uid, 
                authorName, authorPhoto, text: textToSubmit, createdAt: Date.now(), 
                parentId: isReply ? replyingTo!.parentId : null, likes: [], isEdited: false 
            });

            await updateDoc(doc(db, 'highlights', activeVideo.id), { comments: updatedComments });
            isReply ? setReplyText('') : setCommentText('');
            if (isReply) setReplyingTo(null);
        } catch(e) { alert("댓글 작성 중 오류가 발생했습니다."); } finally { setIsSending(false); }
    };

    const handleSaveEdit = async () => {
        if (!authUser || !editCommentText.trim() || !editingCommentId || !activeVideo) return;
        try {
            let updatedComments = [...(activeVideo.comments || [])];
            updatedComments = updatedComments.map((c:any) => c.id === editingCommentId ? { ...c, text: editCommentText.trim(), isEdited: true } : c);
            await updateDoc(doc(db, 'highlights', activeVideo.id), { comments: updatedComments });
            setEditCommentText(''); setEditingCommentId(null);
        } catch (e) { alert("수정 중 오류가 발생했습니다."); }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!window.confirm("댓글을 삭제하시겠습니까?")) return;
        if (!activeVideo) return;
        try {
            const updatedComments = (activeVideo.comments || []).filter(
                (c: any) => c.id !== commentId && c.parentId !== commentId
            );
            await updateDoc(doc(db, 'highlights', activeVideo.id), { comments: updatedComments });
        } catch (e) { alert("댓글 삭제 중 오류가 발생했습니다."); }
    };

    const handleLikeComment = async (commentId: string) => {
        if (!authUser) return alert("로그인 후 이용해주세요.");
        if (!activeVideo) return;
        try {
            const comments = [...(activeVideo.comments || [])];
            const targetIndex = comments.findIndex(c => c.id === commentId);
            if (targetIndex === -1) return;

            const target = comments[targetIndex];
            const likes = target.likes || [];
            if (likes.includes(authUser.uid)) target.likes = likes.filter((uid: string) => uid !== authUser.uid);
            else target.likes = [...likes, authUser.uid];

            await updateDoc(doc(db, 'highlights', activeVideo.id), { comments });
        } catch (e) { console.error("댓글 좋아요 중 오류:", e); }
    };

    const handleLikeVideo = async () => {
        if (!authUser) return alert("로그인 후 이용 가능합니다.");
        try {
            const docRef = doc(db, 'highlights', activeVideo.id);
            const isLiked = activeVideo.likedBy?.includes(authUser.uid) || activeVideo.likes?.includes(authUser.uid);
            if (isLiked) await updateDoc(docRef, { likes: increment(-1), likedBy: arrayRemove(authUser.uid) });
            else await updateDoc(docRef, { likes: increment(1), likedBy: arrayUnion(authUser.uid) });
        } catch (error) { console.error("비디오 좋아요 중 오류:", error); }
    };

    if (!activeVideo) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-0 sm:p-6 animate-in fade-in duration-200">
            <style>{`button[class*="fixed bottom-"], .scroll-to-top { display: none !important; }`}</style>
            <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => { onClose(); viewedPostRef.current = null; }}></div>
            <div className="relative w-full max-w-6xl bg-[#0b0e14] sm:rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col md:flex-row h-full sm:h-[85vh]">
                
                <div className="flex-1 flex flex-col bg-black md:bg-transparent h-full md:overflow-y-auto custom-scrollbar">
                    <div className="aspect-video w-full bg-black shrink-0 relative">
                        {getYoutubeId(getValidVideoUrl(activeVideo)) ? (
                            <iframe 
                                className="w-full h-full" 
                                src={`https://www.youtube.com/embed/${getYoutubeId(getValidVideoUrl(activeVideo))}?autoplay=1`} 
                                frameBorder="0" 
                                allowFullScreen
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            ></iframe>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500">유효하지 않은 영상 링크입니다.</div>
                        )}
                    </div>
                    
                    <div className="p-3 sm:p-5 space-y-3 shrink-0 bg-[#0b0e14]">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-blue-400 text-[10px] font-black italic tracking-widest uppercase">{activeVideo.seasonName}</span>
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="bg-emerald-900/30 px-2 py-0.5 rounded text-[10px] font-black text-emerald-400 border border-emerald-800/50">
                                    {activeVideo.matchLabel || 'HIGHLIGHT'}
                                </div>
                                <h2 className="text-lg sm:text-2xl font-black text-white leading-tight uppercase tracking-tighter">
                                    {activeVideo.title || `${activeVideo.homeTeam} VS ${activeVideo.awayTeam}`} <span className={`${Number(activeVideo.homeScore) === Number(activeVideo.awayScore) ? 'text-slate-400' : 'text-emerald-400'} ml-0.5`}>({activeVideo.homeScore}:{activeVideo.awayScore})</span>
                                </h2>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <button onClick={handleLikeVideo} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-black transition-all ${activeVideo.likedBy?.includes(authUser?.uid) || activeVideo.likes?.includes(authUser?.uid) ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'}`}>
                                    <Heart size={12} fill={activeVideo.likedBy?.includes(authUser?.uid) || activeVideo.likes?.includes(authUser?.uid) ? "currentColor" : "none"} />
                                    {Array.isArray(activeVideo.likes) ? activeVideo.likes.length : (typeof activeVideo.likes === 'number' ? activeVideo.likes : (activeVideo.likedBy?.length || 0))}
                                </button>
                                <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-md text-[11px] font-black text-slate-400 shadow-inner">
                                    <Eye size={12}/> {activeVideo.views || 0}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 pt-4 mt-3 border-t border-slate-800/50">
                            <div className="grid grid-cols-2 gap-3 h-[70px]">
                                <TeamStatCard teamName={activeVideo.homeTeam} teamLogo={activeVideo.homeLogo} historicalTeamsData={historicalTeamsData} owners={owners} fallbackOwnerUid={activeVideo.homeOwnerUid || activeVideo.homeOwnerId} fallbackOwnerName={activeVideo.homeOwner} />
                                <TeamStatCard teamName={activeVideo.awayTeam} teamLogo={activeVideo.awayLogo} historicalTeamsData={historicalTeamsData} owners={owners} fallbackOwnerUid={activeVideo.awayOwnerUid || activeVideo.awayOwnerId} fallbackOwnerName={activeVideo.awayOwner} />
                            </div>
                            <div className="text-[10px] text-slate-500 font-bold tracking-tighter text-right mt-1">
                                *해당 영상 시즌의 정규 전적 기준
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full md:w-[420px] bg-[#0f141e] border-l border-slate-800 flex flex-col h-[400px] md:h-auto shrink-0 flex-1">
                    <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 shrink-0">
                        <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase italic tracking-tighter">
                            <MessageSquare size={14} className="text-emerald-400" /> COMMENTS 
                            <span className="text-emerald-500">{(activeVideo.comments || []).length}</span>
                        </h3>
                        <button onClick={() => { onClose(); viewedPostRef.current = null; }} className="md:hidden text-slate-500 hover:text-white"><X size={20}/></button>
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
                                return (
                                    <div key={comment.id} className="border-b border-slate-800/60 py-3 sm:py-4 last:border-0">
                                        {editingCommentId === comment.id ? (
                                            <div className="flex gap-2 items-center mb-2 bg-slate-800/50 p-2 rounded-lg">
                                                <input type="text" value={editCommentText} onChange={e => setEditCommentText(e.target.value)} className="flex-1 bg-slate-950 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" autoFocus />
                                                <button onClick={handleSaveEdit} className="px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded">저장</button>
                                                <button onClick={() => setEditingCommentId(null)} className="px-3 py-2 bg-slate-700 text-white text-xs font-bold rounded">취소</button>
                                            </div>
                                        ) : (
                                            <CommentItem comment={comment} authUser={authUser} owners={owners} onReply={(name:string, id:string) => setReplyingTo({ parentId: id, targetId: id, authorName: name })} onLike={handleLikeComment} setEditingCommentId={setEditingCommentId} setEditCommentText={setEditCommentText} handleDeleteComment={handleDeleteComment} />
                                        )}

                                        {replies.length > 0 && (
                                            <div className="mt-3 space-y-3 pl-8 sm:pl-10 border-l-2 border-slate-800/50 ml-3">
                                                {replies.map((reply: any) => (
                                                    <div key={reply.id}>
                                                        {editingCommentId === reply.id ? (
                                                            <div className="flex gap-2 items-center mb-2 bg-slate-800/50 p-2 rounded-lg">
                                                                <input type="text" value={editCommentText} onChange={e => setEditCommentText(e.target.value)} className="flex-1 bg-slate-950 text-white text-sm px-3 py-2 rounded border border-slate-700 outline-none" autoFocus />
                                                                <button onClick={handleSaveEdit} className="px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded">저장</button>
                                                                <button onClick={() => setEditingCommentId(null)} className="px-3 py-2 bg-slate-700 text-white text-xs font-bold rounded">취소</button>
                                                            </div>
                                                        ) : (
                                                            <CommentItem comment={reply} isReply authUser={authUser} owners={owners} onReply={(name:string, id:string) => setReplyingTo({ parentId: comment.id, targetId: id, authorName: name })} onLike={handleLikeComment} setEditingCommentId={setEditingCommentId} setEditCommentText={setEditCommentText} handleDeleteComment={handleDeleteComment} />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="p-3 sm:p-4 bg-slate-900/80 border-t border-slate-800 shrink-0 relative">
                        {replyingTo && (
                            <div className="flex justify-between items-center bg-slate-800/50 px-3 py-1.5 rounded-t-lg border-x border-t border-slate-700/50 text-[10px] text-emerald-400 font-black italic">
                                <span>@{replyingTo.authorName} 님에게 답글 중...</span>
                                <button onClick={() => { setReplyingTo(null); setReplyText(''); }} className="text-slate-500 hover:text-white"><X size={12}/></button>
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
                                className="bg-transparent border-none outline-none focus:ring-0 text-[11px] sm:text-[13px] text-slate-200 flex-1 font-bold placeholder:text-slate-600 disabled:opacity-50" 
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
                <button onClick={() => { onClose(); viewedPostRef.current = null; }} className="absolute top-4 right-4 hidden md:flex bg-black/50 hover:bg-black text-white p-2 rounded-full border border-white/10 shadow-xl z-20 transition-all"><X size={20}/></button>
            </div>
        </div>
    );
}