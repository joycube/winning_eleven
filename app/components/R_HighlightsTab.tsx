"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment, arrayRemove, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

// 🔥 공용 컴포넌트 임포트
import HighlightCard from './HighlightCard';
import HighlightViewerModal from './HighlightViewerModal';

const cleanSeasonName = (name: string) => (name || '').replace(/^(🏆|🏳️|⚔️|⚽|🗓️|⭐)\s*/, '').trim();

export default function R_HighlightsTab({ currentSeason, sortedTeams, owners }: any) {
    const { authUser } = useAuth();
    const [highlights, setHighlights] = useState<any[]>([]);
    const [sortBy, setSortBy] = useState<'LATEST' | 'POPULAR'>('LATEST');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSeason, setSelectedSeason] = useState<string>('ALL');
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'highlights'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snap) => {
            setHighlights(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
    }, []);

    const currentSeasonMatchName = useMemo(() => {
        return cleanSeasonName(currentSeason?.seasonName || currentSeason?.name || '');
    }, [currentSeason]);

    const availableSeasons = useMemo<string[]>(() => {
        const seasonNames = (highlights || []).map((h: any) => String(h.seasonName || '')).filter(Boolean);
        return ['ALL', ...Array.from(new Set<string>(seasonNames))];
    }, [highlights]);

    const filteredAndSortedHighlights = useMemo(() => {
        if (!currentSeasonMatchName) return [];

        let result = highlights.filter(h => cleanSeasonName(h.seasonName || '') === currentSeasonMatchName);

        if (selectedSeason !== 'ALL') {
            result = result.filter(h => h.seasonName === selectedSeason);
        }

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
    }, [highlights, currentSeasonMatchName, selectedSeason, sortBy, searchQuery]);

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

    const hasHighlightsInSeason = highlights.some(h => cleanSeasonName(h.seasonName || '') === currentSeasonMatchName);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {hasHighlightsInSeason && (
                <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-3 sm:p-4 shadow-lg flex flex-col xl:flex-row gap-3">
                    {/* 검색 영역 */}
                    <div className="flex flex-1 gap-2">
                        <div className="relative w-full flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search size={15} className="text-slate-500" />
                            </div>
                            <input 
                                type="text" placeholder="팀명, 라운드 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-full min-h-[40px] bg-slate-950 border border-slate-700 text-white text-[13px] font-bold rounded-lg pl-9 pr-8 focus:border-emerald-500 transition-all outline-none placeholder:text-slate-600 shadow-inner"
                            />
                            {searchQuery && (<button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white transition-colors"><X size={15} /></button>)}
                        </div>
                        <button className="h-full min-h-[40px] bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-black px-4 sm:px-6 rounded-lg transition-colors shadow-md whitespace-nowrap">검색</button>
                    </div>

                    {/* 필터 및 정렬 영역 */}
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
            )}

            {!hasHighlightsInSeason ? (
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
                        <HighlightCard 
                            key={post.id} 
                            post={post} 
                            authUser={authUser} 
                            onClick={() => setActiveVideoId(post.id!)} 
                            onLike={handleLikeVideo} 
                        />
                    ))}
                </div>
            )}

            {/* 🎬 공용 뷰 모달 */}
            {currentActiveVideo && (
                <HighlightViewerModal 
                    activeVideo={currentActiveVideo} 
                    onClose={() => setActiveVideoId(null)} 
                    authUser={authUser} 
                    owners={owners} 
                    seasons={[currentSeason]} // 랭킹뷰에서는 현재 시즌(단건) 배열로 전달
                />
            )}
        </div>
    );
}