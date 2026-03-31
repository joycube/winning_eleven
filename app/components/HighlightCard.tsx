"use client";

/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { PlayCircle, Heart } from 'lucide-react';
import { FALLBACK_IMG } from '../types';

const SAFE_TBD_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23475569'%3E%3Cpath d='M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z'/%3E%3C/svg%3E";

const getYoutubeId = (url: string) => {
    if (!url) return null;
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regExp);
    return match ? match[1] : null;
};

const getValidVideoUrl = (post: any) => post?.url || post?.videoUrl || post?.youtubeUrl || '';

const getYouTubeThumbnail = (url: string) => {
    const id = getYoutubeId(url);
    return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : FALLBACK_IMG;
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

export default function HighlightCard({ post, authUser, onClick, onLike }: any) {
    const videoUrl = getValidVideoUrl(post);
    const isLiked = post.likedBy?.includes(authUser?.uid) || post.likes?.includes(authUser?.uid);
    const likesCount = Array.isArray(post.likes) ? post.likes.length : (typeof post.likes === 'number' ? post.likes : (post.likedBy?.length || 0));

    return (
        <div onClick={onClick} className="group flex flex-col gap-3 cursor-pointer bg-slate-900/40 p-2 sm:p-2.5 rounded-2xl border border-slate-800/80 hover:border-emerald-500/50 transition-all">
            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 shadow-md">
                <img src={getYouTubeThumbnail(videoUrl)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" alt="" />
                
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <PlayCircle className="w-12 h-12 text-white/80 group-hover:text-emerald-400 group-hover:scale-110 transition-all opacity-0 group-hover:opacity-100 drop-shadow-lg" />
                </div>
                
                <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-black text-emerald-400 uppercase tracking-tighter border border-slate-700/50 shadow-sm">
                    {post.matchLabel || 'HIGHLIGHT'}
                </div>
                
                <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-2.5 py-1.5 rounded-md flex items-center gap-1.5 border border-slate-700/50 shadow-lg">
                    <img src={post.homeLogo || SAFE_TBD_LOGO} className="w-4 h-4 object-contain" alt="" />
                    <span className="text-[13px] font-black text-white tracking-tighter">{post.homeScore}:{post.awayScore}</span>
                    <img src={post.awayLogo || SAFE_TBD_LOGO} className="w-4 h-4 object-contain" alt="" />
                </div>
            </div>
            
            <div className="flex items-start gap-3 px-1.5 pb-1">
                <MatchResultEmblem post={post} size="sm" />
                <div className="flex flex-col min-w-0 flex-1 pt-1">
                    <h3 className="text-[13px] sm:text-[14px] font-black text-white line-clamp-2 uppercase leading-tight group-hover:text-emerald-400 transition-colors">
                        <span className="text-slate-500 mr-1.5 text-[11px] font-bold tracking-tight">[{post.seasonName}]</span>
                        {post.homeTeam} VS {post.awayTeam} <span className={`${Number(post.homeScore) === Number(post.awayScore) ? 'text-slate-400' : 'text-emerald-400'} ml-0.5`}>({post.homeScore}:{post.awayScore})</span>
                    </h3>
                    
                    <div className="flex items-center justify-between w-full text-[10px] sm:text-[11px] text-slate-500 mt-2 font-bold italic">
                        <span>조회수 {post.views || 0}회</span>
                        <div className="flex items-center gap-2 text-slate-400">
                            <button onClick={(e) => { e.stopPropagation(); onLike(post); }} className={`flex items-center gap-1 transition-colors ${isLiked ? 'text-emerald-400' : 'hover:text-white'}`}>
                                <Heart size={11} className={isLiked ? 'fill-emerald-400 text-emerald-400' : ''}/> {likesCount}
                            </button>
                            <span className="text-slate-700">•</span>
                            <span className="flex items-center gap-1">댓글 {(post.comments || []).length}개</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}