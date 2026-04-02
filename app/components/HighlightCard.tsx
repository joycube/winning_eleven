"use client";

/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { PlayCircle, Heart, MessageSquare } from 'lucide-react'; 
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
    return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : FALLBACK_IMG;
};

export default function HighlightCard({ post, authUser, onClick, onLike }: any) {
    if (!post) return null;

    const videoUrl = getValidVideoUrl(post);
    const isLiked = post.likedBy?.includes(authUser?.uid) || post.likes?.includes(authUser?.uid);
    const likesCount = Array.isArray(post.likes) ? post.likes.length : (typeof post.likes === 'number' ? post.likes : (post.likedBy?.length || 0));

    const hs = Number(post.homeScore || 0);
    const as = Number(post.awayScore || 0);
    const isHomeWin = hs > as;
    const isAwayWin = as > hs;
    const isDraw = hs === as;

    return (
        <div onClick={onClick} className="group flex flex-col gap-3 cursor-pointer w-full bg-transparent p-0 mb-4 transition-all">
            
            {/* 1. 썸네일 영역 */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-lg border border-slate-800/60">
                <img 
                    src={getYouTubeThumbnail(videoUrl)} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" 
                    alt="" 
                    onError={(e:any)=>e.target.src=FALLBACK_IMG} 
                />
                
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/20">
                    <PlayCircle size={44} className="text-white drop-shadow-xl" strokeWidth={1.5} />
                </div>
                
                <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-black text-emerald-400 uppercase tracking-widest border border-white/10 shadow-sm">
                    {post.matchLabel || 'HIGHLIGHT'}
                </div>
                
                {/* 🚨 스코어 앞 팀 엠블럼 노출 (흰색 원형 배경) */}
                <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-2.5 py-1.5 rounded-md flex items-center gap-1.5 border border-white/10 shadow-lg">
                    <div className="w-6 h-6 rounded-full bg-white p-0.5 shadow-md flex items-center justify-center border border-slate-200">
                        <img src={post.homeLogo || SAFE_TBD_LOGO} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=SAFE_TBD_LOGO} />
                    </div>
                    <span className="text-[13px] font-black text-white tracking-tighter">{post.homeScore}:{post.awayScore}</span>
                    <div className="w-6 h-6 rounded-full bg-white p-0.5 shadow-md flex items-center justify-center border border-slate-200">
                        <img src={post.awayLogo || SAFE_TBD_LOGO} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=SAFE_TBD_LOGO} />
                    </div>
                </div>
            </div>
            
            {/* 2. 하단 정보 영역 */}
            <div className="flex items-start gap-3 px-1 w-full pb-1">
                
                {/* 🚨 [픽스] 승무패 공식에 따른 엠블럼 노출 (하얀 원형 배경 적용) */}
                <div className="relative shrink-0 w-10 h-10 mt-0.5 flex items-center justify-center">
                    {isDraw ? (
                        // 무승부: 홈(위) / 어웨이(아래) 듀얼 노출 (둘 다 하얀 원형)
                        <>
                            <div className="absolute left-0 top-0 w-7 h-7 rounded-full bg-white p-0.5 shadow-md z-10 border border-slate-200">
                                <img src={post.homeLogo || SAFE_TBD_LOGO} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=SAFE_TBD_LOGO} />
                            </div>
                            <div className="absolute right-0 bottom-0 w-7 h-7 rounded-full bg-white p-0.5 shadow-md z-0 border border-slate-200">
                                <img src={post.awayLogo || SAFE_TBD_LOGO} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=SAFE_TBD_LOGO} />
                            </div>
                        </>
                    ) : (
                        // 승리팀: 승리팀 로고 단독 노출 (하얀 원형 안 균형 배치)
                        <div className="w-9 h-9 rounded-full bg-white p-1 shadow-md border border-slate-200 flex items-center justify-center overflow-hidden">
                            <img 
                                src={(isHomeWin ? post.homeLogo : post.awayLogo) || SAFE_TBD_LOGO} 
                                className="w-full h-full object-contain" 
                                alt="winner" 
                                onError={(e:any)=>e.target.src=SAFE_TBD_LOGO} 
                            />
                        </div>
                    )}
                </div>
                
                <div className="flex flex-col min-w-0 flex-1">
                    <h3 className="text-[14px] sm:text-[15px] font-bold text-slate-100 line-clamp-2 uppercase leading-snug group-hover:text-emerald-400 transition-colors break-all">
                        <span className="text-emerald-500 mr-1.5 font-bold tracking-tight">[{post.seasonName}]</span>
                        {post.homeTeam} VS {post.awayTeam} <span className={`${isDraw ? 'text-slate-400' : 'text-emerald-400'} ml-1`}>({post.homeScore}:{post.awayScore})</span>
                    </h3>
                    
                    <div className="flex items-center text-[11px] text-slate-500 font-bold mt-1.5 gap-2 italic">
                        <span>조회수 {post.views || 0}회</span>
                        <span className="text-slate-700 font-bold not-italic">•</span>
                        <button onClick={(e) => { e.stopPropagation(); onLike(post); }} className={`flex items-center gap-1 transition-colors ${isLiked ? 'text-emerald-400' : 'hover:text-white'}`}>
                            <Heart size={11} className={isLiked ? 'fill-emerald-400 text-emerald-400' : ''}/> {likesCount}
                        </button>
                        <span className="text-slate-700 font-bold not-italic">•</span>
                        <span className="flex items-center gap-1">
                            <MessageSquare size={11} /> 댓글 {(post.comments || []).length}개
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}