"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Heart, MessageSquare, PlayCircle } from 'lucide-react'; 
import { useAuth } from '../hooks/useAuth';
import { doc, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { FALLBACK_IMG } from '../types';

import HighlightViewerModal from './HighlightViewerModal';

const HighlightCard = ({ post, authUser, onClick, onLike }: any) => {
    if (!post) return null;

    const getYoutubeId = (url: string) => {
        if (!url) return null;
        const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = url.match(regExp);
        return match ? match[1] : null;
    };

    const ytId = post.youtubeId || getYoutubeId(post.youtubeUrl);
    const thumbUrl = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : FALLBACK_IMG;
    const isLiked = post.likedBy?.includes(authUser?.uid) || post.likes?.includes(authUser?.uid);

    // 🚨 승무패 판별 로직
    const hScore = Number(post.homeScore || 0);
    const aScore = Number(post.awayScore || 0);
    const isHomeWin = hScore > aScore;
    const isAwayWin = aScore > hScore;
    const isDraw = hScore === aScore;

    return (
        <div className="flex flex-col gap-3 cursor-pointer group w-full bg-transparent" onClick={onClick}>
            
            {/* 1. 썸네일 영역 */}
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-900 shadow-md">
                <img
                    src={thumbUrl}
                    alt="thumbnail"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                    onError={(e: any) => e.target.src = FALLBACK_IMG}
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                    <PlayCircle size={40} className="text-white drop-shadow-2xl" />
                </div>
                
                {post.matchLabel && (
                    <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-black text-emerald-400 border border-white/10 uppercase tracking-widest">
                        {post.matchLabel}
                    </div>
                )}
                
                {/* 🚨 [픽스] 스코어 팀 엠블럼 노출 (하얀 원형에 균형감 있게 배치) */}
                {(post.homeScore !== undefined) && (
                    <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-2.5 py-1.5 rounded-md flex items-center gap-1.5 shadow-md border border-white/10">
                        <div className="w-4 h-4 rounded-full bg-white p-0.5 flex items-center justify-center shrink-0">
                            <img src={post.homeLogo || FALLBACK_IMG} className="w-full h-full object-contain" alt="" />
                        </div>
                        <span className="text-[12px] font-black text-white tracking-tighter">{post.homeScore} : {post.awayScore}</span>
                        <div className="w-4 h-4 rounded-full bg-white p-0.5 flex items-center justify-center shrink-0">
                            <img src={post.awayLogo || FALLBACK_IMG} className="w-full h-full object-contain" alt="" />
                        </div>
                    </div>
                )}
            </div>

            {/* 2. 하단 정보 영역 */}
            <div className="flex items-start gap-3 px-1 w-full">
                
                {/* 🚨 [픽스] 승무패에 따른 엠블럼 노출 공식 적용 */}
                <div className="relative shrink-0 w-10 h-10 mt-0.5 flex items-center justify-center">
                    {isDraw ? (
                        // 무승부: 홈(위) / 어웨이(아래) 듀얼 노출
                        <>
                            <div className="absolute left-0 top-0 w-7 h-7 rounded-full bg-white p-0.5 shadow-md z-10 border border-slate-800">
                                <img src={post.homeLogo || FALLBACK_IMG} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                            </div>
                            <div className="absolute right-0 bottom-0 w-7 h-7 rounded-full bg-white p-0.5 shadow-md z-0 border border-slate-800">
                                <img src={post.awayLogo || FALLBACK_IMG} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                            </div>
                        </>
                    ) : (
                        // 승리팀 존재: 승리팀 단독 노출 (하얀 원형 안 균형 배치)
                        <div className="w-9 h-9 rounded-full bg-white p-1 shadow-md border border-slate-800 flex items-center justify-center overflow-hidden">
                            <img 
                                src={(isHomeWin ? post.homeLogo : post.awayLogo) || FALLBACK_IMG} 
                                className="w-full h-full object-contain" 
                                alt="winner" 
                                onError={(e:any)=>e.target.src=FALLBACK_IMG} 
                            />
                        </div>
                    )}
                </div>
                
                <div className="flex flex-col min-w-0 flex-1">
                    <h3 className="text-[14px] sm:text-[15px] font-bold text-slate-100 line-clamp-2 leading-tight group-hover:text-emerald-400 transition-colors break-all">
                        <span className="text-emerald-500 mr-1.5">[{post.seasonName || 'LIVE'}]</span>
                        {post.title || `${post.homeTeam} VS ${post.awayTeam}`}
                    </h3>
                    
                    <div className="flex items-center text-[11px] text-slate-500 font-bold mt-1.5 gap-2">
                        <span>조회 {post.views || 0}회</span>
                        <span className="w-0.5 h-0.5 bg-slate-700 rounded-full"></span>
                        <button
                            onClick={(e) => { e.stopPropagation(); onLike(post); }}
                            className={`flex items-center gap-1 hover:text-white transition-colors ${isLiked ? 'text-emerald-400' : ''}`}
                        >
                            <Heart size={12} className={isLiked ? 'fill-emerald-400 text-emerald-400' : ''} /> {post.likes?.length || 0}
                        </button>
                        <span className="w-0.5 h-0.5 bg-slate-700 rounded-full"></span>
                        <span className="flex items-center gap-1">
                            <MessageSquare size={12} /> {(post.comments || []).length}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function L_HighlightsBoard({ highlights, owners, seasons, setViewMode }: any) {
    const { authUser } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSeason, setSelectedSeason] = useState<string>('ALL');
    const [sortBy, setSortBy] = useState<'LATEST' | 'POPULAR'>('LATEST');
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const availableSeasons = useMemo<string[]>(() => {
        const seasonNames = (highlights || []).map((h: any) => String(h.seasonName || '')).filter(Boolean);
        return ['ALL', ...Array.from(new Set<string>(seasonNames))];
    }, [highlights]);

    const filteredHighlights = useMemo(() => {
        let result = [...(highlights || [])];
        if (selectedSeason !== 'ALL') result = result.filter(h => h.seasonName === selectedSeason);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(h => 
                (h.homeTeam && h.homeTeam.toLowerCase().includes(q)) ||
                (h.awayTeam && h.awayTeam.toLowerCase().includes(q)) ||
                (h.matchLabel && h.matchLabel.toLowerCase().includes(q)) ||
                (h.title && h.title.toLowerCase().includes(q))
            );
        }
        if (sortBy === 'LATEST') result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        else if (sortBy === 'POPULAR') result.sort((a, b) => (b.views || 0) - (a.views || 0));
        return result;
    }, [highlights, selectedSeason, searchQuery, sortBy]);

    const currentActiveVideo = useMemo(() => {
        return highlights?.find((h:any) => h.id === activeVideoId) || null;
    }, [highlights, activeVideoId]);

    const handleLikeVideo = async (video: any) => {
        if (!authUser) return alert("로그인 후 이용 가능합니다.");
        try {
            const docRef = doc(db, 'highlights', video.id);
            const isLiked = video.likedBy?.includes(authUser.uid) || video.likes?.includes(authUser.uid);
            if (isLiked) await updateDoc(docRef, { likes: increment(-1), likedBy: arrayRemove(authUser.uid) });
            else await updateDoc(docRef, { likes: increment(1), likedBy: arrayUnion(authUser.uid) });
        } catch (error) { console.error(error); }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 w-full mb-10">
            <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-4 sm:p-6 shadow-lg mt-2 mx-2 sm:mx-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-2.5 h-12 bg-emerald-500 rounded-full mt-1 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                        <div className="flex flex-col">
                            <h1 className="text-3xl sm:text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
                                MATCH <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">HIGHLIGHTS</span>
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-400 font-bold mt-1.5 ml-0.5">eFootball 명경기 하이라이트 게시판</p>
                        </div>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800/50 flex flex-col xl:flex-row gap-3">
                    <div className="flex flex-1 gap-2">
                        <div className="relative w-full flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search size={15} className="text-slate-500" />
                            </div>
                            <input 
                                type="text" placeholder="팀명, 매치 라운드 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-full min-h-[40px] bg-slate-950 border border-slate-700 text-white text-[13px] font-bold rounded-lg pl-9 pr-8 focus:border-emerald-500 transition-all outline-none placeholder:text-slate-600 shadow-inner"
                            />
                            {searchQuery && (<button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white transition-colors"><X size={15} /></button>)}
                        </div>
                        <button className="h-full min-h-[40px] bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-black px-4 sm:px-6 rounded-lg transition-colors shadow-md whitespace-nowrap">검색</button>
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                        <select value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)} className="h-full min-h-[40px] bg-slate-950 border border-slate-700 text-white text-[13px] font-bold rounded-lg px-3 outline-none focus:border-emerald-500 shadow-inner cursor-pointer">
                            {availableSeasons.map((s: string) => (<option key={s} value={s}>{s === 'ALL' ? '전체 시즌' : s}</option>))}
                        </select>

                        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700 shadow-inner h-full min-h-[40px] items-center">
                            <button onClick={() => setSortBy('LATEST')} className={`px-4 py-1.5 rounded-md text-[12px] font-black transition-all h-full ${sortBy === 'LATEST' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>최신순</button>
                            <button onClick={() => setSortBy('POPULAR')} className={`px-4 py-1.5 rounded-md text-[12px] font-black transition-all h-full ${sortBy === 'POPULAR' ? 'bg-slate-700 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>인기순</button>
                        </div>
                    </div>
                </div>
            </div>

            {filteredHighlights.length === 0 ? (
                <div className="py-20 mx-2 sm:mx-0 text-center text-slate-500 font-bold italic bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed shadow-inner">
                    등록된 하이라이트 영상이 없거나 검색 결과가 없습니다.
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 sm:gap-x-5 gap-y-10 pt-4 px-2 sm:px-0 w-full">
                    {filteredHighlights.map((post) => (
                        <HighlightCard 
                            key={post.id} 
                            post={post} 
                            authUser={authUser} 
                            onClick={() => setActiveVideoId(post.id)} 
                            onLike={handleLikeVideo} 
                        />
                    ))}
                </div>
            )}

            {currentActiveVideo && (
                <HighlightViewerModal 
                    activeVideo={currentActiveVideo} 
                    onClose={() => setActiveVideoId(null)} 
                    authUser={authUser} 
                    owners={owners} 
                    seasons={seasons} 
                />
            )}
        </div>
    );
}