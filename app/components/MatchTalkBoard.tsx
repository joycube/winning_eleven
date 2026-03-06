"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase'; 
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { ArrowLeft, Send, Trash2, Trophy } from 'lucide-react';
import { FALLBACK_IMG } from '../types';

import { MatchCard } from './MatchCard'; 

const COMMON_DEFAULT_PROFILE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2364748b'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

const getBestProfileImage = (userObj?: any | null, ownersList?: any[] | null, savedPhoto?: string | null, authorName?: string | null) => {
    const targetName = authorName || (userObj ? userObj.mappedOwnerId : null);
    if (targetName && ownersList && Array.isArray(ownersList)) {
        const ownerData = ownersList.find(o => o.nickname === targetName);
        if (ownerData && ownerData.photo && ownerData.photo.trim() !== '') return ownerData.photo;
    }
    if (userObj) {
        if (userObj.photoURL && userObj.photoURL.trim() !== '') return userObj.photoURL;
        if (userObj.photoUrl && userObj.photoUrl.trim() !== '') return userObj.photoUrl;
    }
    if (savedPhoto && typeof savedPhoto === 'string' && savedPhoto.trim() !== '') return savedPhoto;
    return COMMON_DEFAULT_PROFILE;
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

const StatusBadge = ({ status }: { status?: string }) => {
    if (!status) return null;
    const s = status.toUpperCase();
    if (s === 'COMPLETED') return <span className="bg-slate-800 text-slate-400 border-slate-700 text-[8px] sm:text-[9px] font-black px-1 py-0.5 rounded border whitespace-nowrap w-full text-center">COMPLETED</span>;
    if (s === 'LIVE') return <span className="bg-red-900/40 text-red-400 border-red-500/50 text-[8px] sm:text-[9px] font-black px-1 py-0.5 rounded border whitespace-nowrap w-full text-center animate-pulse">LIVE</span>;
    return <span className="bg-emerald-900/40 text-emerald-400 border-emerald-500/50 text-[8px] sm:text-[9px] font-black px-1 py-0.5 rounded border whitespace-nowrap w-full text-center">UPCOMING</span>;
};

interface MatchTalkBoardProps {
    user: any;
    seasons: any[];
    masterTeams: any[];
    owners: any[];
    activeRankingData?: any; 
    selectedMatchId: string | null;
    onSelectMatch: (matchId: string) => void;
    onClose: () => void;
}

const MatchTalkBoard = ({ user, seasons, masterTeams, owners, activeRankingData, selectedMatchId, onSelectMatch, onClose }: MatchTalkBoardProps) => {
    const [allMatchComments, setAllMatchComments] = useState<any[]>([]);
    const [commentText, setCommentText] = useState('');
    const [visibleCount, setVisibleCount] = useState(10);
    const [selectedSeasonFilter, setSelectedSeasonFilter] = useState<string>('ALL');
    const commentInputRef = useRef<HTMLInputElement>(null);

    const isMaster = useMemo(() => {
        if (!user) return false;
        return owners.some(o => (o.nickname === user.mappedOwnerId || String(o.id) === user.uid) && (o as any).role === 'ADMIN');
    }, [user, owners]);

    useEffect(() => {
        const q = query(collection(db, 'match_comments'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllMatchComments(fetched);
        });
        return () => unsubscribe();
    }, []);

    const matchTalkPosts = useMemo(() => {
        const items: any[] = [];
        seasons?.forEach((s: any) => {
            s.rounds?.forEach((r: any) => {
                r.matches?.forEach((m: any) => {
                    if (m.home !== 'BYE' && m.away !== 'BYE' && !m.home?.includes('부전승')) {
                        
                        const homeNorm = (m.home || '').toLowerCase().trim();
                        const awayNorm = (m.away || '').toLowerCase().trim();
                        
                        const hTeam = masterTeams?.find((t:any) => (t.name || t.teamName || '').toLowerCase().trim() === homeNorm);
                        const aTeam = masterTeams?.find((t:any) => (t.name || t.teamName || '').toLowerCase().trim() === awayNorm);
                        
                        const hStat = activeRankingData?.teams?.find((t:any) => (t.name || t.teamName || '').toLowerCase().trim() === homeNorm);
                        const aStat = activeRankingData?.teams?.find((t:any) => (t.name || t.teamName || '').toLowerCase().trim() === awayNorm);

                        const matchComments = allMatchComments.filter(c => c.matchId === m.id).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

                        let hPR = m.homePredictRate;
                        let aPR = m.awayPredictRate;
                        if (hPR === undefined || aPR === undefined) {
                            const weights: any = { S: 4, A: 3, B: 2, C: 1 };
                            const hw = weights[m.homeTier || hTeam?.tier || hStat?.tier] || 1;
                            const aw = weights[m.awayTier || aTeam?.tier || aStat?.tier] || 1;
                            hPR = Math.round((hw / (hw + aw)) * 100);
                            aPR = 100 - hPR;
                        }

                        // 매치카드에 넘겨줄 필수 데이터 병합
                        const finalMatchData = { 
                            ...m, 
                            seasonId: s.id, 
                            homeLogo: m.homeLogo || hTeam?.logo || hStat?.logo, 
                            awayLogo: m.awayLogo || aTeam?.logo || aStat?.logo, 
                            homeOwner: m.homeOwner || hTeam?.ownerName || hStat?.ownerName, 
                            awayOwner: m.awayOwner || aTeam?.ownerName || aStat?.ownerName,
                            homePredictRate: hPR,
                            awayPredictRate: aPR,
                            roundName: m.matchLabel || r.name, 
                            seasonName: s.name,
                        };

                        items.push({
                            id: `match_${m.id}`, 
                            realMatchId: m.id, 
                            isMatchTalk: true,
                            subTitle: `${s.name} | ${m.matchLabel || r.name}`, 
                            title: `${m.home} VS ${m.away}`,
                            cat: '매치톡', 
                            matchData: finalMatchData, 
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
    }, [seasons, masterTeams, allMatchComments, activeRankingData]); 
    
    const filteredMatchTalkPosts = useMemo(() => {
        if (selectedSeasonFilter === 'ALL') return matchTalkPosts;
        return matchTalkPosts.filter(p => String(p.matchData.seasonId) === selectedSeasonFilter);
    }, [matchTalkPosts, selectedSeasonFilter]);

    const activePost = useMemo(() => matchTalkPosts.find(p => p.id === selectedMatchId), [selectedMatchId, matchTalkPosts]);
    const visiblePostsList = filteredMatchTalkPosts.slice(0, visibleCount);
    const hasMore = visiblePostsList.length < filteredMatchTalkPosts.length;

    const handleMatchClick = (post: any) => {
        onSelectMatch(post.id);
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
    };

    const handleAddComment = async () => {
        if (!user) return alert("🚨 로그인이 필요합니다.");
        if (!commentText.trim()) return alert("댓글 내용을 입력해주세요.");
        if (!activePost) return;

        const currentAuthorPhoto = getBestProfileImage(user, owners);
        const currentAuthorName = user.mappedOwnerId || '미배정 오너';

        try {
            await addDoc(collection(db, 'match_comments'), {
                matchId: activePost.realMatchId, authorId: user.uid, authorName: currentAuthorName,
                authorPhoto: currentAuthorPhoto, text: commentText.trim(), createdAt: Date.now(),
            });
            setCommentText('');
        } catch (e) { alert("댓글 처리 실패"); }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!window.confirm("댓글을 삭제하시겠습니까?")) return;
        try {
            await deleteDoc(doc(db, 'match_comments', commentId));
        } catch (e) { console.error(e); }
    };

    if (activePost) {
        return (
            <div className="animate-in slide-in-from-bottom-4 space-y-4">
                <div className="mb-2">
                    <button onClick={onClose} className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors font-bold text-[11px] sm:text-[12px] bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 shadow-inner w-max">
                        <ArrowLeft size={14} /> <span>목록으로 뒤로 가기</span>
                    </button>
                </div>

                <div className="bg-[#0f172a] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
                    <div className="p-4 sm:p-7 border-b border-slate-800">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-blue-400/10 text-blue-400 border-blue-500/30 font-black text-[10px] tracking-widest uppercase px-2.5 py-0.5 rounded border flex items-center gap-1">
                                <Trophy size={12}/> 매치톡
                            </span>
                            <span className="text-[11px] sm:text-xs text-slate-400 font-bold">{activePost.subTitle}</span>
                        </div>
                        <h2 className="text-xl sm:text-3xl font-black text-white italic leading-tight truncate mb-2">{activePost.title}</h2>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium mb-6">
                            <span>{formatDate(activePost.createdAt, true)}</span>
                        </div>
                        
                        <div className="mb-2 pointer-events-none"> 
                            {/* 🔥 [핵심 해결 포인트] MatchCard에게 팀 정보(masterTeams)와 순위 정보(activeRankingData)를 전달합니다! */}
                            <MatchCard 
                                match={activePost.matchData} 
                                onClick={() => {}} 
                                masterTeams={masterTeams}
                                activeRankingData={activeRankingData}
                            />
                        </div>
                        
                    </div>

                    <div className="p-4 sm:p-6 bg-slate-950/30">
                        <h4 className="text-[12px] sm:text-[13px] font-black text-white uppercase mb-4 flex items-center gap-2 tracking-widest italic">
                            💬 Match Talk <span className="text-emerald-500 ml-1">{(activePost.comments || []).length}</span>
                        </h4>
                        
                        <div className="mb-6 border-t border-slate-800/50">
                            {(!(activePost.comments) || activePost.comments.length === 0) && (
                                <p className="text-[11px] text-slate-500 italic py-5 font-bold">가장 먼저 의견을 남겨보세요!</p>
                            )}
                            {activePost.comments?.map((comment: any) => {
                                const cName = comment.authorName || '알 수 없음';
                                const cPhoto = comment.authorPhoto;
                                const authorProfileImg = getBestProfileImage(null, owners, cPhoto, cName);

                                return (
                                    <div key={comment.id} className="border-b border-slate-800/60 py-5 last:border-0">
                                        <div className="flex gap-3.5">
                                            <img src={authorProfileImg} alt="profile" className="w-9 h-9 rounded-full object-cover shrink-0 bg-slate-800 border border-slate-700" onError={(e:any) => e.target.src = COMMON_DEFAULT_PROFILE} />
                                            <div className="flex-1 min-w-0 pr-6 overflow-visible">
                                                <div className="flex items-baseline gap-2 mb-1.5">
                                                    <span className="font-bold text-emerald-400 text-sm italic whitespace-nowrap">{cName}</span>
                                                    <span className="text-slate-500 text-[10px] whitespace-nowrap">{formatDate(comment.createdAt, true)}</span>
                                                </div>
                                                <p className="text-[14px] sm:text-[15px] text-slate-200 leading-snug whitespace-pre-wrap mb-2.5 font-medium tracking-tight">{comment.text}</p>
                                                
                                                {(user?.uid === comment.authorId || isMaster) && (
                                                    <div className="flex items-center gap-3 mt-1 text-[11px]">
                                                        <button onClick={() => handleDeleteComment(comment.id)} className="text-slate-500 hover:text-red-400 font-bold transition-colors">삭제</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {user ? (
                            <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/50 mt-4">
                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest pl-1 mb-0.5">새로운 의견 남기기</div>
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
                                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); handleAddComment(); } }}
                                            placeholder="매치톡 내용을 입력하세요..."
                                            className="flex-1 bg-slate-900 px-4 py-2.5 sm:py-3 rounded-xl border border-slate-700 text-white text-[12px] sm:text-[13px] placeholder-slate-600 focus:border-emerald-500 transition-colors shadow-inner font-medium"
                                        />
                                        <button onClick={handleAddComment} className="px-5 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] rounded-xl transition-all shadow-lg shrink-0 active:scale-95 flex items-center">
                                            등록 <Send size={14} className="ml-1.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-900/50 border border-slate-800/80 text-slate-500 text-[11px] font-bold p-4 rounded-xl text-center shadow-inner">
                                로그인 후 참여할 수 있습니다.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#0f172a] rounded-2xl border border-slate-800 shadow-xl overflow-hidden divide-y divide-slate-800/50">
             <div className="p-3 sm:p-4 bg-slate-900 border-b border-slate-800 flex justify-end">
                <select 
                    value={selectedSeasonFilter} 
                    onChange={(e) => setSelectedSeasonFilter(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-slate-300 text-[11px] sm:text-xs font-bold rounded-lg px-3 py-1.5 outline-none focus:border-emerald-500 transition-colors"
                >
                    <option value="ALL">모든 시즌 보기</option>
                    {seasons?.map(s => (
                        <option key={s.id} value={String(s.id)}>{s.name}</option>
                    ))}
                </select>
            </div>

            {visiblePostsList.length === 0 ? (
                <div className="p-16 text-center text-slate-400 font-black text-[14px] sm:text-[16px] italic bg-slate-900/30 leading-relaxed shadow-inner border-t border-slate-800/50">
                    &quot;해당 조건의 매치톡이 없습니다.&quot;
                </div>
            ) : visiblePostsList.map((post) => (
                <div key={post.id} onClick={() => handleMatchClick(post)} className={`flex items-center p-3 sm:p-4 hover:bg-slate-800/40 transition-colors cursor-pointer group`}>
                    <div className="flex flex-col items-center justify-center shrink-0 mr-3 sm:mr-4 w-[60px] sm:w-[68px]">
                         <StatusBadge status={post.matchData.status} />
                    </div>
                    <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 pr-6">
                        <span className="bg-blue-900/30 text-blue-400 border-blue-500/30 group-hover:border-blue-500/60 text-[9px] sm:text-[10px] font-black px-2 py-[2px] rounded uppercase shrink-0 border transition-colors hidden sm:block">
                            {post.cat}
                        </span>
                        <div className="flex flex-col min-w-0 flex-1 overflow-visible pr-2">
                            <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold truncate">{post.subTitle}</span>
                            <h3 className="text-white font-black text-[13px] sm:text-[15px] truncate group-hover:text-blue-400 transition-colors leading-tight italic mt-0.5">
                                {post.title}
                            </h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 ml-1">
                        <div className={`flex flex-col items-center justify-center rounded-[10px] w-[40px] h-[44px] shrink-0 shadow-inner transition-colors ${post.comments?.length > 0 ? 'bg-blue-950/50 border border-blue-500/30' : 'bg-[#0f172a] border border-slate-800'}`}>
                            <span className={`text-[12px] sm:text-[14px] font-black leading-none mb-0.5 ${post.comments?.length > 0 ? 'text-blue-400' : 'text-slate-400'}`}>{post.comments?.length || 0}</span>
                            <span className={`text-[8px] font-bold leading-none ${post.comments?.length > 0 ? 'text-blue-500' : 'text-slate-500'}`}>매치톡</span>
                        </div>
                    </div>
                </div>
            ))}
            {hasMore && (
                <div className="p-3 border-t border-slate-800/50 flex justify-center bg-slate-900/30">
                    <button onClick={() => setVisibleCount(v => v + 10)} className="text-slate-400 text-[11px] font-bold px-5 py-2.5 bg-slate-800 rounded-full hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-1.5 active:scale-95 shadow-lg">
                        더 보기 ▼
                    </button>
                </div>
            )}
        </div>
    );
};

export default MatchTalkBoard;