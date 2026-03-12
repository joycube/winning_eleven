"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase'; 
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { ArrowLeft, Send, Trash2, MessageSquare } from 'lucide-react';
import { FALLBACK_IMG, Owner } from '../types'; 

import { MatchCard } from './MatchCard'; 
import StickerSelector from './StickerSelector'; 

const COMMON_DEFAULT_PROFILE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2364748b'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

const formatDate = (ts: any) => {
    if (!ts) return '';
    let d: Date;
    if (typeof ts === 'number') d = new Date(ts);
    else if (typeof ts.toDate === 'function') d = ts.toDate();
    else if (typeof ts === 'string') d = new Date(ts);
    else return '';
    const ampm = d.getHours() < 12 ? '오전' : '오후';
    const h = d.getHours() % 12 || 12;
    return `${ampm} ${h}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const resolveOwnerInfo = (owners: Owner[], ownerName: string, ownerUid?: string) => {
    if (!ownerName || ['-', 'CPU', 'SYSTEM', 'GUEST'].includes(ownerName.trim().toUpperCase())) return { nickname: ownerName, photo: FALLBACK_IMG };
    const search = ownerName.trim();
    const foundByUid = owners.find(o => (ownerUid && (o.uid === ownerUid || o.docId === ownerUid)) || (o.uid === search || o.docId === search));
    if (foundByUid) return { nickname: foundByUid.nickname, photo: foundByUid.photo || FALLBACK_IMG };
    const foundByName = owners.find(o => o.nickname === search || o.legacyName === search);
    return foundByName ? { nickname: foundByName.nickname, photo: foundByName.photo || FALLBACK_IMG } : { nickname: ownerName, photo: FALLBACK_IMG };
};

const StatusBadge = ({ status }: { status?: string }) => {
    if (!status) return null;
    const s = status.toUpperCase();
    if (s === 'COMPLETED') return <span className="bg-emerald-900/40 text-emerald-400 border-emerald-500/50 text-[8px] sm:text-[9px] font-black px-1 py-0.5 rounded border whitespace-nowrap w-full text-center">COMPLETED</span>;
    if (s === 'LIVE') return <span className="bg-red-900/40 text-red-400 border-red-500/50 text-[8px] sm:text-[9px] font-black px-1 py-0.5 rounded border whitespace-nowrap w-full text-center animate-pulse">LIVE</span>;
    return <span className="bg-slate-800 text-slate-400 border-slate-700 text-[8px] sm:text-[9px] font-black px-1 py-0.5 rounded border whitespace-nowrap w-full text-center">UPCOMING</span>;
};

interface MatchTalkBoardProps {
    user: any;
    seasons: any[];
    masterTeams: any[];
    owners: Owner[]; 
    activeRankingData?: any; 
    selectedMatchId: string | null;
    onSelectMatch: (matchId: string) => void;
    onClose: () => void;
}

const MatchTalkBoard = ({ user, seasons, masterTeams, owners, activeRankingData, selectedMatchId, onSelectMatch, onClose }: MatchTalkBoardProps) => {
    const [allMatchComments, setAllMatchComments] = useState<any[]>([]);
    const [commentText, setCommentText] = useState('');
    const [isSending, setIsSending] = useState(false); 
    const [visibleCount, setVisibleCount] = useState(10);
    const [selectedSeasonFilter, setSelectedSeasonFilter] = useState<string>('ALL');
    
    const commentsEndRef = useRef<HTMLDivElement>(null);
    const commentInputRef = useRef<HTMLInputElement>(null);

    const isMaster = useMemo(() => {
        if (!user) return false;
        return owners.some(o => (o.nickname === user.mappedOwnerId || String(o.id) === user.uid) && (o as any).role === 'ADMIN');
    }, [user, owners]);

    // 🔥 [수술 포인트] 모달과 완벽히 동일한 block: 'end' 스크롤 적용 (화면 점프 방지)
    const scrollToBottom = () => {
        if (commentsEndRef.current) {
            commentsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    };

    useEffect(() => {
        const q = query(collection(db, 'match_comments'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllMatchComments(fetched);
            setTimeout(scrollToBottom, 100);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (selectedMatchId) {
            setTimeout(scrollToBottom, 150);
        }
    }, [selectedMatchId, allMatchComments]); 

    const matchTalkPosts = useMemo(() => {
        let allItems: any[] = [];

        seasons?.forEach((s: any) => {
            let allCompleted = true;
            const seasonMatches: any[] = [];

            s.rounds?.forEach((r: any, rIdx: number) => {
                r.matches?.forEach((m: any, mIdx: number) => {
                    if (m.status !== 'COMPLETED') allCompleted = false;

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

                        seasonMatches.push({
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
                            authorPhoto: COMMON_DEFAULT_PROFILE,
                            _roundIndex: rIdx,
                            _matchIndex: mIdx,
                            _status: m.status?.toUpperCase() || 'UPCOMING'
                        });
                    }
                });
            });

            if (allCompleted) {
                seasonMatches.sort((a, b) => {
                    if (a._roundIndex !== b._roundIndex) return a._roundIndex - b._roundIndex;
                    return a._matchIndex - b._matchIndex;
                });
            } else {
                seasonMatches.sort((a, b) => {
                    const getStatusWeight = (status: string) => {
                        if (status === 'LIVE') return 0;
                        if (status === 'UPCOMING') return 1;
                        return 2; 
                    };

                    const weightA = getStatusWeight(a._status);
                    const weightB = getStatusWeight(b._status);

                    if (weightA !== weightB) return weightA - weightB;

                    if (a._roundIndex !== b._roundIndex) return a._roundIndex - b._roundIndex;
                    return a._matchIndex - b._matchIndex;
                });
            }

            allItems = [...allItems, ...seasonMatches];
        });

        return allItems;
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

    const handleSendSticker = async (stickerUrl: string) => {
        if (!user || isSending || !activePost) return; 
        setIsSending(true);
        try {
            await addDoc(collection(db, 'match_comments'), {
                matchId: activePost.realMatchId,
                authorId: user.uid,
                authorUid: user.uid, 
                authorName: user.mappedOwnerId || 'GUEST',
                text: `[STICKER]${stickerUrl}`, 
                createdAt: Date.now() 
            });
        } catch (e) {
            console.error("스티커 전송 실패:", e);
        } finally {
            setIsSending(false);
        }
    };

    const handleAddComment = async () => {
        if (!user) return alert("🚨 로그인이 필요합니다.");
        if (!commentText.trim() || isSending) return;
        if (!activePost) return;

        setIsSending(true);
        try {
            await addDoc(collection(db, 'match_comments'), {
                matchId: activePost.realMatchId, 
                authorId: user.uid, 
                authorUid: user.uid, 
                authorName: user.mappedOwnerId || 'GUEST',
                text: commentText.trim(), 
                createdAt: Date.now(),
            });
            setCommentText('');
        } catch (e) { 
            alert("댓글 처리 실패"); 
        } finally {
            setIsSending(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!window.confirm("댓글을 삭제하시겠습니까?")) return;
        try {
            await deleteDoc(doc(db, 'match_comments', commentId));
        } catch (e) { console.error(e); }
    };

    if (activePost) {
        return (
            <div className="animate-in slide-in-from-bottom-4 flex flex-col h-full overflow-hidden">
                {/* 상단 뒤로가기 버튼 */}
                <div className="mb-4 shrink-0 px-1">
                    <button onClick={onClose} className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors font-bold text-[11px] sm:text-[12px] bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 shadow-inner w-max">
                        <ArrowLeft size={14} /> <span>목록으로 뒤로 가기</span>
                    </button>
                </div>

                {/* 매치톡 전용 모달 레이아웃 시작 (팝업이 잘리지 않도록 overflow-hidden 제거) */}
                <div className="flex flex-col bg-[#0f172a] rounded-t-[24px] rounded-b-xl shadow-2xl border border-slate-800 flex-1 min-h-[500px]">
                    
                    {/* 상단 경기 정보 전광판 */}
                    <div className="bg-[#0B1120] p-4 sm:p-6 pb-2 shrink-0 border-b border-slate-800 z-20 shadow-md rounded-t-[24px]">
                        <div className="pointer-events-none mb-1"> 
                            <MatchCard 
                                match={activePost.matchData} 
                                onClick={() => {}} 
                                masterTeams={masterTeams}
                                activeRankingData={activeRankingData}
                            />
                        </div>
                        <div className="flex justify-between items-center px-2 py-2">
                            <h4 className="text-[12px] font-black text-white uppercase flex items-center gap-2 tracking-widest italic">
                                💬 Match Talk <span className="text-emerald-500 ml-1 font-bold">{(activePost.comments || []).length}</span>
                            </h4>
                        </div>
                    </div>

                    {/* 🔥 탭 1: 매치 톡 (채팅방) 영역 */}
                    <div className="flex-1 min-h-0 bg-[#0B1423] flex flex-col relative z-10 w-full rounded-b-xl overflow-hidden">
                        
                        <div className="flex-1 overflow-y-auto px-3 sm:px-5 pt-6 pb-4 space-y-5 min-h-0 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                            {!(activePost.comments) || activePost.comments.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
                                    <MessageSquare size={28} className="mb-2" />
                                    <p className="text-[12px] sm:text-[13px] font-bold">이 경기의 첫 번째 관전평을 남겨보세요!</p>
                                </div>
                            ) : (
                                activePost.comments.map((c: any) => {
                                    const isMe = c.authorId === user?.uid || c.authorUid === user?.uid;
                                    const authorInfo = resolveOwnerInfo(owners, c.authorName, c.authorUid || c.authorId);
                                    
                                    const isSticker = c.text.startsWith('[STICKER]');
                                    const stickerUrl = isSticker ? c.text.replace('[STICKER]', '') : '';

                                    return (
                                        <div key={c.id} className={`flex gap-2.5 w-full mb-1 relative ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                            <div className="shrink-0 flex flex-col items-center">
                                                <img src={authorInfo.photo} className="w-10 h-10 sm:w-11 sm:h-11 rounded-[14px] sm:rounded-2xl object-cover shadow-sm border border-slate-700 bg-slate-800" alt="profile" />
                                            </div>
                                            
                                            <div className={`flex flex-col max-w-[78%] ${isMe ? 'items-end' : 'items-start'}`}>
                                                <div className={`flex items-baseline gap-1.5 mb-1.5 mx-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                                    <span className="text-[11px] sm:text-[12px] font-bold text-slate-300">{authorInfo.nickname}</span>
                                                    <span className="text-[9px] sm:text-[10px] text-slate-500 font-medium whitespace-nowrap">{formatDate(c.createdAt)}</span>
                                                </div>
                                                
                                                {isSticker ? (
                                                    <div className={`relative group ${isMe ? 'mr-1' : 'ml-1'}`}>
                                                        <img src={stickerUrl} className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-md transform hover:scale-105 transition-transform" alt="sticker" onError={(e:any) => { e.target.style.display = 'none'; }} />
                                                        {(isMe || isMaster) && (
                                                            <button onClick={() => handleDeleteComment(c.id)} className="absolute -top-2 -right-2 bg-slate-800 text-red-400 p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity border border-slate-700 z-10">
                                                                <Trash2 size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className={`relative group px-3.5 py-2.5 rounded-2xl shadow-sm ${isMe ? 'bg-[#fae100] text-slate-900 rounded-tr-sm' : 'bg-slate-800 text-white rounded-tl-sm'}`}>
                                                        <p className="text-[13px] sm:text-[14px] font-medium tracking-tight leading-snug whitespace-pre-wrap">{c.text}</p>
                                                        {(isMe || isMaster) && (
                                                            <button onClick={() => handleDeleteComment(c.id)} className={`absolute top-1/2 -translate-y-1/2 p-1.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10 ${isMe ? '-left-8 bg-slate-800 text-red-400' : '-right-8 bg-slate-800 text-red-400'}`}>
                                                                <Trash2 size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            {/* 🔥 앵커 박스 유지 */}
                            <div ref={commentsEndRef} className="h-4" />
                        </div>

                        {/* 🔥 댓글 입력 폼 */}
                        <div className="shrink-0 pt-2 pb-6 px-3 sm:px-4 sm:pb-8 border-t border-slate-800 bg-[#0B1120] relative z-30 shadow-[0_-10px_20px_rgba(0,0,0,0.3)] rounded-b-xl">
                            
                            {!user ? (
                                <div className="text-center text-slate-500 text-[11px] py-3 bg-slate-900 rounded-xl border border-slate-800 font-bold tracking-tight mx-2 mb-2">
                                    로그인 후 매치톡을 이용할 수 있습니다.
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 sm:gap-2.5 w-full relative">
                                    {/* 🔥 스티커 컴포넌트 이식 완료! */}
                                    <div className="shrink-0 relative z-[100]">
                                        <StickerSelector onSelect={handleSendSticker} />
                                    </div>

                                    <input 
                                        ref={commentInputRef}
                                        value={commentText} 
                                        onChange={e => setCommentText(e.target.value)} 
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !isSending) handleAddComment(); }}
                                        placeholder={isSending ? "전송 중..." : "메시지를 입력하세요."} 
                                        disabled={isSending}
                                        className="flex-1 min-w-0 bg-[#1e293b] border border-slate-700 text-white text-[13px] sm:text-[15px] px-5 py-3 rounded-full outline-none focus:border-slate-500 shadow-inner placeholder:font-medium placeholder:text-slate-500 disabled:opacity-60" 
                                    />

                                    <button 
                                        onClick={handleAddComment} 
                                        disabled={isSending || !commentText.trim()}
                                        className="bg-[#fae100] hover:bg-yellow-400 text-black w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 disabled:bg-slate-800 disabled:text-slate-600 disabled:scale-100"
                                    >
                                        {isSending ? <div className="w-4 h-4 border-2 border-slate-600 border-t-slate-900 rounded-full animate-spin"></div> : <Send size={18} className="ml-0.5" />}
                                    </button>
                                </div>
                            )}
                        </div>
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
                        <div className="flex flex-col min-w-0 flex-1 overflow-visible pr-2">
                            <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold truncate">{post.subTitle}</span>
                            
                            <div className="flex items-center gap-2 mt-0.5">
                                <h3 className="text-white font-black text-[13px] sm:text-[15px] truncate group-hover:text-blue-400 transition-colors leading-tight italic">
                                    {post.title}
                                </h3>
                                
                                {post.matchData.status?.toUpperCase() === 'COMPLETED' ? (
                                    <span className="shrink-0 px-2 py-[2px] rounded text-[11px] sm:text-[12px] font-black border tracking-widest not-italic bg-emerald-900/40 text-emerald-400 border-emerald-500/40 shadow-inner">
                                        {post.matchData.homeScore ?? '-'} : {post.matchData.awayScore ?? '-'}
                                    </span>
                                ) : post.matchData.status?.toUpperCase() === 'LIVE' ? (
                                    <span className="shrink-0 px-2 py-[2px] rounded text-[11px] sm:text-[12px] font-black border tracking-widest not-italic bg-red-900/40 text-red-400 border-red-500/40 shadow-inner animate-pulse">
                                        {post.matchData.homeScore ?? '-'} : {post.matchData.awayScore ?? '-'}
                                    </span>
                                ) : (
                                    <span className="shrink-0 px-2 py-[2px] rounded text-[11px] sm:text-[12px] font-black border tracking-widest not-italic bg-slate-800 text-slate-500 border-slate-700 shadow-inner">
                                        - : -
                                    </span>
                                )}
                            </div>

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