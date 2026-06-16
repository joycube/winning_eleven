/* eslint-disable @next/next/no-img-element */
import React, { useState, useMemo } from 'react';
import { db } from '../firebase';
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore';
import { Banner } from '../types';
import { Image as ImageIcon, Video, Plus } from 'lucide-react';

// 🔥 유튜브 URL에서 ID를 추출
const getYouTubeId = (url: string) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/))([^"&?\/\s]{11})/);
    return match ? match[1] : null;
};

const isVideoBanner = (b: Banner): boolean => {
    const url = (b as any).url || '';
    return /youtube\.com|youtu\.be/i.test(url);
};

// 업로드 순(내림차순) — createdAt > id > 입력순서 폴백
const sortByUploadDesc = (list: Banner[]): Banner[] => {
    return [...list].sort((a: any, b: any) => {
        const ka = Number(a.createdAt ?? a.id ?? 0);
        const kb = Number(b.createdAt ?? b.id ?? 0);
        return kb - ka;
    });
};

type TabKey = 'IMAGE' | 'VIDEO';

export const AdminBannerManager = ({ banners }: { banners: Banner[] }) => {
    const [url, setUrl] = useState('');
    const [desc, setDesc] = useState('');
    const [tab, setTab] = useState<TabKey>('IMAGE');

    // 🛠️ 이미지/동영상 분리 + 업로드 순 정렬
    const { imageBanners, videoBanners } = useMemo(() => {
        const sorted = sortByUploadDesc(banners || []);
        return {
            imageBanners: sorted.filter(b => !isVideoBanner(b)),
            videoBanners: sorted.filter(b => isVideoBanner(b)),
        };
    }, [banners]);

    const visibleBanners = tab === 'IMAGE' ? imageBanners : videoBanners;
    const counts = { IMAGE: imageBanners.length, VIDEO: videoBanners.length };

    const handleAdd = async () => {
        if (!url) return alert("URL을 입력해주세요.");
        // createdAt 정렬용 timestamp 같이 박음 (기존 id 가 createdAt 역할이라 동일하지만 명시적으로)
        const now = Date.now();
        await addDoc(collection(db, "banners"), { id: now, createdAt: now, url, description: desc });
        setUrl(''); setDesc('');
        // 새로 추가한 게 어느 탭인지 자동 전환
        setTab(/youtube\.com|youtu\.be/i.test(url) ? 'VIDEO' : 'IMAGE');
    };

    const handleDel = async (id: string) => {
        if (confirm("삭제?")) await deleteDoc(doc(db, "banners", id));
    };

    return (
        <div className="space-y-5 animate-in fade-in">
            {/* 신규 등록 폼 */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    <Plus size={14} className="text-emerald-400" /> Add New Banner
                </h3>
                <div className="flex flex-col gap-2">
                    <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Image or YouTube URL" className="bg-slate-900 p-3 rounded text-sm text-white border border-slate-700 focus:border-emerald-500 outline-none transition-colors" />
                    <div className="flex gap-2">
                        <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description (Optional)" className="flex-1 bg-slate-900 p-3 rounded text-sm text-white border border-slate-700 focus:border-emerald-500 outline-none transition-colors" />
                        <button onClick={handleAdd} className="bg-emerald-600 px-6 rounded font-bold text-white hover:bg-emerald-500 transition-colors">Add</button>
                    </div>
                </div>
                <p className="text-[10px] text-slate-500 italic">YouTube URL 은 VIDEO 탭, 그 외는 IMAGE 탭에 자동 분류됩니다.</p>
            </div>

            {/* 🛠️ 탭 — 이미지 / 동영상 분리 */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                <div className="flex border-b border-slate-800 h-[44px] bg-slate-950/60">
                    <button
                        onClick={() => setTab('IMAGE')}
                        className={`flex-1 h-full flex justify-center items-center gap-2 text-[12px] font-black tracking-widest transition-all ${tab === 'IMAGE' ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <ImageIcon size={14} /> IMAGE
                        <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-[1px] rounded-full ml-1">{counts.IMAGE}</span>
                    </button>
                    <button
                        onClick={() => setTab('VIDEO')}
                        className={`flex-1 h-full flex justify-center items-center gap-2 text-[12px] font-black tracking-widest transition-all ${tab === 'VIDEO' ? 'bg-slate-900 text-red-400 border-b-2 border-red-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Video size={14} /> VIDEO
                        <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-[1px] rounded-full ml-1">{counts.VIDEO}</span>
                    </button>
                </div>

                {/* 정렬 안내 */}
                <div className="px-4 py-2 bg-slate-950 border-b border-slate-800/60 flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 italic">업로드 순 (최신이 위)</span>
                    <span className="text-[10px] text-slate-600">{visibleBanners.length} 항목</span>
                </div>

                {/* 리스트 */}
                <div className="p-4">
                    {visibleBanners.length === 0 ? (
                        <p className="text-slate-500 text-center py-8 text-sm">
                            {tab === 'IMAGE' ? '등록된 이미지 배너가 없습니다.' : '등록된 동영상 배너가 없습니다.'}
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {visibleBanners.map(b => {
                                const isVideo = isVideoBanner(b);
                                const ytId = isVideo ? getYouTubeId((b as any).url) : null;
                                return (
                                    <div key={(b as any).docId || (b as any).id} className="bg-slate-950 p-3 rounded-xl flex gap-4 border border-slate-800 relative group hover:border-emerald-500 transition-all">
                                        <div className="w-24 h-16 bg-black rounded-lg overflow-hidden flex-shrink-0 border border-slate-800 relative">
                                            {!isVideo && <img src={(b as any).url} className="w-full h-full object-cover" alt="" />}
                                            {isVideo && (
                                                <>
                                                    <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} className="w-full h-full object-cover opacity-60" alt="youtube thumbnail" />
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                        <span className="text-red-500 font-black text-[10px] tracking-widest drop-shadow-md">VIDEO</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex flex-col justify-center flex-1 min-w-0">
                                            <span className="text-xs text-emerald-400 font-bold truncate mb-1">{b.description || 'No Description'}</span>
                                            <span className="text-[10px] text-slate-500 truncate block bg-slate-900 p-1 rounded">{(b as any).url}</span>
                                            {(b as any).createdAt && (
                                                <span className="text-[9px] text-slate-600 mt-1 italic">
                                                    {new Date(Number((b as any).createdAt)).toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                        <button onClick={()=>(b as any).docId && handleDel((b as any).docId)} className="absolute top-2 right-2 text-slate-600 hover:text-red-500 font-bold bg-black rounded-full w-6 h-6 flex items-center justify-center">×</button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
