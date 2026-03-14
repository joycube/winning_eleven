"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { FALLBACK_IMG } from '../types';

const getTimestamp = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
};

export const LiveFeed = ({ posts, owners, seasons, selectedSeasonId, onNavigateToPost, onNavigateToMatch }: any) => {
    const [matchCommentsData, setMatchCommentsData] = useState<any[]>([]);
    // 🔥 데이터 로딩 상태 추가
    const [isFetching, setIsFetching] = useState(true);

    // 1. 매치톡 실시간 데이터 수신
    useEffect(() => {
        const q = query(collection(db, 'match_comments'), orderBy('createdAt', 'desc'), limit(15));
        const unsubscribe = onSnapshot(q, (snap) => {
            const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            setMatchCommentsData(docs);
            setIsFetching(false); // 데이터 도착 완료!
        });
        return () => unsubscribe();
    }, []);

    const getOwnerProfile = (idOrName: string, fallbackName?: string) => {
        const search1 = idOrName?.toString().trim();
        const search2 = fallbackName?.toString().trim();
        const found = owners?.find((o:any) => 
            o.docId === search1 || String(o.id) === search1 || o.uid === search1 || o.nickname === search1 ||
            (search2 && o.nickname === search2)
        );
        return found?.photo || FALLBACK_IMG;
    };

    // 2. 커뮤니티 데이터 가공
    const communityComments = useMemo(() => {
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
    }, [posts, owners]);

    // 3. 매치톡 데이터 가공
    const matchComments = useMemo(() => {
        const sortedMatchComments = [...matchCommentsData].sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
        
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
            return owners?.slice(0, 3).map((o:any) => ({ id: Math.random(), name: o.nickname, uid: o.uid, text: "경기 기대됩니다! ⚽", type: 'MATCH', targetId: '' })) || [];
        }
        return recent;
    }, [matchCommentsData, owners, isFetching]);

    // 4. 클릭 라우팅 핸들러
    const handleItemClick = (msg: any) => {
        if (!msg.targetId) return;
        if (msg.type === 'COMMUNITY') {
            onNavigateToPost({ id: msg.targetId });
        } else if (msg.type === 'MATCH') {
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
        return (
            <div key={msg.id + Math.random()} onClick={() => handleItemClick(msg)} className="flex items-center shrink-0 mx-1.5 cursor-pointer hover:bg-slate-800/80 px-3 py-1 rounded-xl transition-all group/item">
                <div className="flex items-center gap-1.5 mr-1.5 shrink-0">
                    <img src={getOwnerProfile(msg.uid, msg.name)} className="w-5 h-5 rounded-full object-cover border border-slate-700 bg-slate-800 shrink-0 shadow-sm" alt="" onError={(e:any)=>{e.target.src=FALLBACK_IMG}} />
                    <span className="text-[11px] text-blue-400 font-black whitespace-nowrap shrink-0 group-hover/item:text-blue-300 transition-colors">{msg.name}:</span>
                </div>
                {isSticker ? (
                    <img src={msg.text.replace('[STICKER]', '')} className="h-6 w-auto object-contain drop-shadow-sm ml-0.5" alt="sticker" />
                ) : (
                    <span className="text-slate-300 text-[12px] font-medium whitespace-nowrap shrink-0 group-hover/item:text-white transition-colors">{msg.text}</span>
                )}
            </div>
        );
    };

    return (
        <div className="bg-gradient-to-r from-[#0B1120] to-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-2 relative overflow-hidden shadow-lg mb-6 min-h-[96px]">
            <style jsx>{`
                @keyframes ticker-ltr { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
                .ticker-track-1 { display: flex; width: max-content; animation: ticker-ltr 45s linear infinite; }
                .ticker-track-1:hover { animation-play-state: paused; }
                .ticker-track-2 { display: flex; width: max-content; animation: ticker-ltr 32s linear infinite; animation-delay: -16s; }
                .ticker-track-2:hover { animation-play-state: paused; }
            `}</style>
            
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 z-20"></div>
            
            <div className="flex items-center gap-2 pl-2 mb-1 z-20">
                <div className="bg-blue-900/30 p-1.5 rounded-lg shrink-0">
                    <MessageSquare size={14} className="text-blue-400" />
                </div>
                <span className="text-xs font-black text-white italic uppercase tracking-widest">LIVE FEED</span>
                <span className="text-[9px] text-emerald-400 font-bold px-2 py-0.5 bg-emerald-950/30 rounded-full border border-emerald-900/50 animate-pulse ml-2">REAL-TIME</span>
            </div>

            {/* 🔥 데이터를 가져오는 중일 때는 깔끔한 스켈레톤 로딩을 보여줍니다. */}
            {isFetching ? (
                <div className="flex flex-col gap-2 mt-1 px-4 animate-pulse">
                    <div className="h-4 w-3/4 bg-slate-800/80 rounded"></div>
                    <div className="h-4 w-1/2 bg-slate-800/80 rounded"></div>
                </div>
            ) : (
                <>
                    <div className="absolute left-0 w-12 h-full bg-gradient-to-r from-[#0B1120] to-transparent z-10 pointer-events-none"></div>
                    <div className="absolute right-0 w-12 h-full bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none"></div>

                    <div className="flex flex-col gap-1 overflow-hidden relative z-0 py-1">
                        <div className="ticker-track-1">
                            {[...communityComments, ...communityComments].map(renderTickerMessage)}
                        </div>
                        <div className="ticker-track-2">
                            {[...matchComments, ...matchComments].map(renderTickerMessage)}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};