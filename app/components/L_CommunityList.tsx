"use client";
import React, { useState } from 'react';
import { ArrowLeft, Edit3, Image as ImageIcon } from 'lucide-react';

const isNewPost = (createdAt: any) => {
    if (!createdAt) return false;
    let postTime = 0;
    if (createdAt.seconds) postTime = createdAt.seconds * 1000;
    else if (typeof createdAt === 'number') postTime = createdAt;
    else if (createdAt instanceof Date) postTime = createdAt.getTime();
    else if (typeof createdAt === 'string') postTime = new Date(createdAt).getTime();
    
    if (!postTime) return false;
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
    return (Date.now() - postTime) < twoDaysInMs;
};

export default function L_CommunityList({ user, notices, posts, category, setCategory, setViewMode, setSelectedPostId }: any) {
    const [visibleCount, setVisibleCount] = useState(10);

    const filteredPosts = posts.filter((p:any) => category === '전체' || p.cat === category);
    const visiblePostsList = filteredPosts.slice(0, visibleCount);
    const hasMore = visiblePostsList.length < filteredPosts.length;

    const handlePostClick = (post: any) => {
        setSelectedPostId(post.id);
        const params = new URLSearchParams(window.location.search);
        params.set('view', 'LOCKERROOM'); params.set('postId', post.id);
        window.history.pushState(null, '', `?${params.toString()}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <>
            <div className="bg-slate-900/80 p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col gap-5 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-6 sm:h-7 bg-emerald-500 rounded-sm"></div>
                    <div className="flex flex-col">
                        <h2 className="text-xl sm:text-2xl font-black italic text-white uppercase tracking-tighter leading-none">LEAGUE COMMUNITY</h2>
                        <span className="text-[10px] text-slate-500 font-bold mt-1">자유 소통 게시판</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    {['🏆 매치톡', '전체', '축구', '이풋볼', '자유', '기타'].map(cat => {
                        const catValue = cat.replace('🏆 ', '');
                        const isSelected = category === catValue;
                        const isMatchTalk = catValue === '매치톡';
                        let btnClass = "py-2.5 px-4 sm:px-5 rounded-xl text-[11px] sm:text-xs font-black transition-all shrink-0 whitespace-nowrap uppercase tracking-widest border";
                        if (isSelected) btnClass += isMatchTalk ? " bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/40" : " bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/40";
                        else btnClass += isMatchTalk ? " bg-slate-800/80 text-blue-400 border-slate-700/50 hover:bg-slate-700 hover:text-blue-300" : " bg-slate-800/80 text-slate-500 border-slate-700/50 hover:bg-slate-700 hover:text-slate-300";
                        return <button key={catValue} onClick={() => { setCategory(catValue); setVisibleCount(10); }} className={btnClass}>{cat}</button>
                    })}
                </div>
            </div>

            <div className="bg-[#0f172a] rounded-2xl border border-slate-800 shadow-xl overflow-hidden mb-6">
                <div className="flex flex-col divide-y divide-slate-800/50">
                    {notices.map((notice:any) => (
                        <div key={notice.id} onClick={() => handlePostClick(notice)} className="flex items-center p-3 sm:p-4 hover:bg-slate-800/40 transition-colors cursor-pointer group">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="bg-slate-800 border border-slate-700 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded shrink-0 shadow-inner">공지</span>
                                {/* 🚨 픽스: 이탤릭체 잘림 방지를 위해 pr-1.5 추가 */}
                                <span className="text-slate-100 font-bold text-[13px] sm:text-[14px] truncate group-hover:text-emerald-400 transition-colors pr-1.5">{notice.title}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="w-full h-1 bg-slate-900/50 border-y border-slate-800/50"></div>
                
                {visiblePostsList.length === 0 ? (
                    <div className="p-16 text-center text-slate-400 font-bold text-[14px] sm:text-[16px] italic bg-slate-900/30 leading-relaxed shadow-inner">
                        &quot;브로, 그대가 여기 첫번째 작성자가 될 수 있어 🏆&quot;
                    </div>
                ) : (
                    <div className="flex flex-col divide-y divide-slate-800/50">
                        {visiblePostsList.map((post:any, index:number) => {
                            const boardNumber = filteredPosts.length - index; 
                            const ytMatch = post.youtubeUrl?.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([a-zA-Z0-9_-]{11})/);
                            const ytId = post.youtubeId || (ytMatch ? ytMatch[1] : null);
                            const thumbSrc = post.imageUrl || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null);
                            const commentCount = post.comments?.length || 0;

                            return (
                                <div key={post.id} onClick={() => handlePostClick(post)} className="flex items-center justify-between p-3.5 hover:bg-slate-800/40 transition-colors cursor-pointer group">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <span className="text-slate-500 font-bold italic text-xs w-4 text-center shrink-0">{boardNumber}</span>
                                        <div className="flex flex-col min-w-0 flex-1 gap-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="bg-slate-800/80 border border-slate-700/80 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded shrink-0">{post.cat}</span>
                                                {/* 🚨 픽스: 이탤릭체 잘림 방지를 위해 pr-1.5 추가 */}
                                                <span className="text-slate-100 font-bold text-[13px] sm:text-[14px] truncate group-hover:text-emerald-400 transition-colors pr-1.5">{post.title}</span>
                                                {isNewPost(post.createdAt) && <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-[3px] shrink-0 shadow-[0_0_5px_rgba(239,68,68,0.4)]">N</span>}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500 ml-[36px] sm:ml-[40px]">
                                                <span>{post.authorName}</span>
                                                <span className="w-0.5 h-0.5 bg-slate-600 rounded-full"></span>
                                                <span>조회 {post.views || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-3">
                                        {thumbSrc && <img src={thumbSrc} alt="thumb" className="w-10 h-10 rounded-md object-cover border border-slate-700 block shrink-0" onError={(e: any) => { e.target.style.display = 'none'; }} />}
                                        <div className={`flex flex-col items-center justify-center rounded-xl w-10 h-10 border shrink-0 shadow-sm transition-colors ${commentCount > 0 ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-500'}`}>
                                            <span className="text-[13px] font-black leading-none">{commentCount}</span>
                                            <span className="text-[8px] font-bold mt-0.5">댓글</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {hasMore && (
                    <div className="p-3 border-t border-slate-800/50 flex justify-center bg-slate-900/30">
                        <button onClick={() => setVisibleCount(v => v + 10)} className="text-slate-400 text-[11px] font-bold px-5 py-2.5 bg-slate-800 rounded-full hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-1.5 active:scale-95 shadow-lg">더 보기 ▼</button>
                    </div>
                )}
            </div>

            {user && category !== '매치톡' && (
                <div className="flex justify-end pt-2 pb-8 flex-col sm:flex-row items-center gap-3">
                  <button onClick={() => { setViewMode('MAIN'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-3 rounded-2xl text-[12px] sm:text-[13px] font-black transition-all flex justify-center items-center gap-2 shadow-lg">
                      <ArrowLeft size={16} /><span>대시보드로 가기</span>
                  </button>
                  <button onClick={() => { setViewMode('WRITE'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl text-[12px] sm:text-[13px] font-black transition-all flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 tracking-widest uppercase">
                      <Edit3 size={16} /><span>글쓰기</span>
                  </button>
                </div>
            )}
        </>
    );
}