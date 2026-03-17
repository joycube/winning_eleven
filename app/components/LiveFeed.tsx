"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { FALLBACK_IMG } from '../types';

// 🔥 [핵심 디벨롭] 구글 기본 프로필 스타일의 내장 SVG 이미지 (절대 깨지지 않음)
const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

const getTimestamp = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
};

export const LiveFeed = ({ 
    mode = 'dashboard', 
    posts = [], 
    owners, 
    seasons, 
    selectedSeasonId, 
    onNavigateToPost, 
    onNavigateToMatch 
}: any) => {
    const [matchCommentsData, setMatchCommentsData] = useState<any[]>([]);
    const [isFetching, setIsFetching] = useState(true);

    // 1. 매치톡 실시간 데이터 수신
    useEffect(() => {
        setIsFetching(true);
        const q = query(collection(db, 'match_comments'), orderBy('createdAt', 'desc'), limit(200));

        const unsubscribe = onSnapshot(q, (snap) => {
            const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            setMatchCommentsData(docs);
            setIsFetching(false);
        });

        return () => unsubscribe();
    }, []);

    // 🔥 [디벨롭] 프로필이 없으면 무조건 내장 DEFAULT_AVATAR 반환
    const getOwnerProfile = (idOrName: string, fallbackName?: string) => {
        const search1 = idOrName?.toString().trim();
        const search2 = fallbackName?.toString().trim();
        const found = owners?.find((o:any) => 
            o.docId === search1 || String(o.id) === search1 || o.uid === search1 || o.nickname === search1 ||
            (search2 && o.nickname === search2)
        );
        
        const photo = found?.photo || found?.profileImage || found?.photoUrl;
        return (photo && photo.trim() !== '') ? photo : DEFAULT_AVATAR;
    };

    // 2. 커뮤니티 데이터 가공
    const communityComments = useMemo(() => {
        if (mode !== 'dashboard') return [];

        let allComments: any[] = [];
        posts.forEach((p: any) => {
            if (p.comments && Array.isArray(p.comments)) {
                allComments.push(...p.comments.map((c: any) => ({ ...c, type: 'COMMUNITY', targetId: p.id })));
            }
            if (p.replies && Array.isArray(p.replies)) {
                allComments.push(...p.replies.map((c: any) => ({ ...c, type: 'COMMUNITY', targetId: p.id })));
            }
        });
        
        allComments.sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
        
        const recent = allComments.slice(0, 10).map((c: any) => ({
            id: c.id || Math.random().toString(),
            name: c.authorName || c.ownerName || '익명',
            uid: c.authorUid || c.ownerUid || c.authorName || c.ownerName,
            text: c.text,
            type: c.type,
            targetId: c.targetId
        }));

        if (recent.length === 0) {
            return owners?.slice(0, 3).map((o:any) => ({ id: Math.random(), name: o.nickname, uid: o.uid, text: "오늘도 활기찬 리그! 🔥", type: 'COMMUNITY', targetId: '' })) || [];
        }
        return recent;
    }, [posts, owners, mode]);

    // 3. 매치톡 데이터 가공
    const matchComments = useMemo(() => {
        const validMatchIds = new Set();
        if (mode === 'schedule' && selectedSeasonId && seasons) {
            const currentSeason = seasons.find((s: any) => String(s.id) === String(selectedSeasonId));
            currentSeason?.rounds?.forEach((r: any) => {
                r.matches?.forEach((m: any) => validMatchIds.add(m.id));
            });
        }

        let sortedMatchComments = [...matchCommentsData].sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
        
        if (mode === 'schedule' && selectedSeasonId) {
            sortedMatchComments = sortedMatchComments.filter(c => {
                const isMatchingSeasonId = c.seasonId && String(c.seasonId) === String(selectedSeasonId);
                const isMatchingRoundId = validMatchIds.has(c.matchId);
                return isMatchingSeasonId || isMatchingRoundId;
            });
        }

        const recent = sortedMatchComments.slice(0, 10).map((c: any) => ({
            id: c.id,
            name: c.authorName || c.ownerName || '익명',
            uid: c.authorUid || c.ownerUid || c.authorName || c.ownerName,
            text: c.text,
            type: 'MATCH',
            targetId: c.matchId,
            seasonId: c.seasonId
        }));

        if (recent.length === 0 && !isFetching) {
            if (mode === 'schedule') {
                return [{ id: 'empty', name: 'SYSTEM', uid: 'system', text: "아직 등록된 매치톡이 없습니다. 첫 코멘트의 주인공이 되어보세요! 🔥", type: 'EMPTY' }];
            }
            return owners?.slice(0, 3).map((o:any) => ({ id: Math.random(), name: o.nickname, uid: o.uid, text: "경기 기대됩니다! ⚽", type: 'MATCH', targetId: '' })) || [];
        }
        return recent;
    }, [matchCommentsData, owners, isFetching, mode, selectedSeasonId, seasons]);

    // 4. 클릭 라우팅 핸들러
    const handleItemClick = (msg: any) => {
        if (msg.type === 'EMPTY' || !msg.targetId) return;

        if (msg.type === 'COMMUNITY' && onNavigateToPost) {
            onNavigateToPost({ id: msg.targetId });
        } else if (msg.type === 'MATCH' && onNavigateToMatch) {
            let sId = msg.seasonId;
            if (!sId) {
                for (const s of seasons) {
                    for (const r of s.rounds || []) {
                        if (r.matches?.find((m:any) => m.id === msg.targetId)) {
                            sId = s.id; break;
                        }
                    }
                    if (sId) break;
                }
            }
            onNavigateToMatch({ id: msg.targetId, seasonId: sId || selectedSeasonId });
        }
    };

    const renderTickerMessage = (msg: any) => {
        const isSticker = msg.text?.startsWith('[STICKER]');
        const isEmpty = msg.type === 'EMPTY';

        return (
            <div key={msg.id + Math.random()} onClick={() => handleItemClick(msg)} className={`flex items-center shrink-0 mx-1.5 ${isEmpty ? '' : 'cursor-pointer hover:bg-slate-800/80'} px-3 py-1 rounded-xl transition-all group/item`}>
                <div className="flex items-center gap-1.5 mr-1.5 shrink-0">
                    {isEmpty ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-900/50 border border-emerald-500/50 flex items-center justify-center shrink-0 shadow-sm"><MessageSquare size={10} className="text-emerald-400"/></div>
                    ) : (
                        // 🔥 [디벨롭] 이미지 에러 발생 시에도 DEFAULT_AVATAR를 강제 주입
                        <img 
                            src={getOwnerProfile(msg.uid, msg.name) || DEFAULT_AVATAR} 
                            className="w-5 h-5 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0 shadow-sm" 
                            alt="" 
                            onError={(e:any) => { e.target.src = DEFAULT_AVATAR; }} 
                        />
                    )}
                    <span className={`text-[11px] font-black whitespace-nowrap shrink-0 transition-colors ${isEmpty ? 'text-emerald-400' : 'text-blue-400 group-hover/item:text-blue-300'}`}>{msg.name}:</span>
                </div>
                {isSticker ? (
                    <img src={msg.text.replace('[STICKER]', '')} className="h-6 w-auto object-contain drop-shadow-sm ml-0.5" alt="sticker" />
                ) : (
                    <span className={`text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors ${isEmpty ? 'text-emerald-300' : 'text-slate-300 group-hover/item:text-white'}`}>{msg.text}</span>
                )}
            </div>
        );
    };

    return (
        <div className={`bg-gradient-to-r from-[#0B1120] to-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col relative overflow-hidden shadow-lg mb-6 transition-all ${mode === 'dashboard' ? 'gap-2 min-h-[96px]' : 'gap-1 h-[68px] justify-center'}`}>
            <style jsx>{`
                @keyframes ticker-rtl { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
                .ticker-track-1 { display: flex; width: max-content; animation: ticker-rtl 15s linear infinite; }
                .ticker-track-1:hover { animation-play-state: paused; }
                .ticker-track-2 { display: flex; width: max-content; animation: ticker-rtl 12s linear infinite; animation-delay: -6s; }
                .ticker-track-2:hover { animation-play-state: paused; }
            `}</style>
            
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 z-20"></div>
            
            <div className={`flex items-center z-20 ${mode === 'dashboard' ? 'pl-2 mb-1 gap-2' : 'absolute left-3 top-1/2 -translate-y-1/2 gap-1.5 bg-[#0B1120] py-2 pr-4 pl-1 rounded-r-3xl'}`}>
                <div className="bg-blue-900/30 p-1.5 rounded-lg shrink-0">
                    <MessageSquare size={mode === 'dashboard' ? 14 : 12} className="text-blue-400" />
                </div>
                <span className={`font-black text-white italic uppercase tracking-widest ${mode === 'dashboard' ? 'text-xs' : 'text-[10px]'}`}>LIVE FEED</span>
                {mode === 'dashboard' && <span className="text-[9px] text-emerald-400 font-bold px-2 py-0.5 bg-emerald-950/30 rounded-full border border-emerald-900/50 animate-pulse ml-2">REAL-TIME</span>}
            </div>

            {isFetching ? (
                <div className={`flex flex-col animate-pulse ${mode === 'dashboard' ? 'gap-2 mt-1 px-4' : 'gap-1 ml-28'}`}>
                    <div className={`bg-slate-800/80 rounded ${mode === 'dashboard' ? 'h-4 w-3/4' : 'h-3 w-1/2'}`}></div>
                    {mode === 'dashboard' && <div className="h-4 w-1/2 bg-slate-800/80 rounded"></div>}
                </div>
            ) : (
                <>
                    <div className={`absolute left-0 h-full bg-gradient-to-r from-[#0B1120] to-transparent z-10 pointer-events-none ${mode === 'dashboard' ? 'w-12' : 'w-28'}`}></div>
                    <div className="absolute right-0 w-12 h-full bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none"></div>

                    <div className={`flex flex-col overflow-hidden relative z-0 ${mode === 'dashboard' ? 'gap-1 py-1' : ''}`}>
                        <div className="ticker-track-1">
                            {mode === 'dashboard' 
                                ? [...communityComments, ...communityComments].map(renderTickerMessage)
                                : [...matchComments, ...matchComments].map(renderTickerMessage)
                            }
                        </div>
                        
                        {mode === 'dashboard' && (
                            <div className="ticker-track-2">
                                {[...matchComments, ...matchComments].map(renderTickerMessage)}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};