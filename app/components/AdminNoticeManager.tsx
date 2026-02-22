"use client";

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { Notice } from '../types';

export const AdminNoticeManager = () => {
    const [notices, setNotices] = useState<Notice[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 폼 상태 (생성 및 수정용)
    const [editId, setEditId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [imageUrl, setImageUrl] = useState('');     // 🔥 [NEW] 이미지 URL 상태 추가
    const [youtubeUrl, setYoutubeUrl] = useState(''); // 🔥 [NEW] 유튜브 URL 상태 추가
    const [isPopup, setIsPopup] = useState(false);

    // 파이어베이스에서 공지사항 불러오기
    const fetchNotices = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            setNotices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notice)));
        } catch (error) {
            console.error("🚨 Error fetching notices:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchNotices();
    }, []);

    // 폼 초기화
    const resetForm = () => {
        setEditId(null);
        setTitle('');
        setContent('');
        setImageUrl('');     // 🔥 [NEW] 폼 초기화 시 비우기
        setYoutubeUrl('');   // 🔥 [NEW] 폼 초기화 시 비우기
        setIsPopup(false);
    };

    // 저장 (생성 또는 수정)
    const handleSave = async () => {
        if (!title.trim() || !content.trim()) return alert("제목과 내용을 입력해주세요.");

        try {
            if (editId) {
                // 수정
                await updateDoc(doc(db, 'notices', editId), {
                    title, content, imageUrl, youtubeUrl, isPopup // 🔥 [NEW] 확장 필드 업데이트
                });
                alert("공지사항이 수정되었습니다.");
            } else {
                // 신규 생성
                await addDoc(collection(db, 'notices'), {
                    title, content, imageUrl, youtubeUrl, isPopup, // 🔥 [NEW] 확장 필드 생성
                    createdAt: new Date().toISOString(),
                    likedBy: [], dislikedBy: [], comments: []      // 🔥 [NEW] 인터랙션 배열 초기화 세팅
                });
                alert("새 공지사항이 등록되었습니다.");
            }
            resetForm();
            fetchNotices();
        } catch (error) {
            console.error("🚨 Error saving notice:", error);
            alert("저장 중 오류가 발생했습니다.");
        }
    };

    // 편집 모드 진입
    const handleEdit = (notice: Notice) => {
        setEditId(notice.id);
        setTitle(notice.title);
        setContent(notice.content);
        setImageUrl(notice.imageUrl || '');     // 🔥 [NEW] 편집 시 데이터 불러오기
        setYoutubeUrl(notice.youtubeUrl || ''); // 🔥 [NEW] 편집 시 데이터 불러오기
        setIsPopup(notice.isPopup);
        window.scrollTo({ top: 0, behavior: 'smooth' }); // 위로 스크롤
    };

    // 삭제
    const handleDelete = async (id: string) => {
        if (!confirm("정말 이 공지사항을 삭제하시겠습니까?")) return;
        try {
            await deleteDoc(doc(db, 'notices', id));
            alert("삭제 완료되었습니다.");
            fetchNotices();
        } catch (error) {
            console.error("🚨 Error deleting notice:", error);
        }
    };

    const formatDate = (isoString: string) => {
        const d = new Date(isoString);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* 작성/수정 폼 */}
            <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 shadow-xl">
                <div className="flex items-center gap-3 mb-4 border-b border-slate-800 pb-3">
                    <span className="text-2xl">📢</span>
                    <div className="flex flex-col">
                        <h2 className="text-xl font-black italic text-white uppercase tracking-tighter leading-tight">
                            {editId ? 'Edit Notice' : 'New Notice'}
                        </h2>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            공지사항 및 팝업 작성
                        </span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-slate-400 font-bold mb-1 block">Title (제목) *</label>
                        <input 
                            value={title} 
                            onChange={(e) => setTitle(e.target.value)} 
                            className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 text-white font-bold placeholder-slate-600 focus:border-emerald-500 transition-colors" 
                            placeholder="공지사항 제목을 입력하세요" 
                        />
                    </div>
                    
                    <div>
                        <label className="text-xs text-slate-400 font-bold mb-1 block">Content (내용) *</label>
                        <textarea 
                            value={content} 
                            onChange={(e) => setContent(e.target.value)} 
                            className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 text-white text-sm placeholder-slate-600 min-h-[150px] focus:border-emerald-500 transition-colors" 
                            placeholder="공지사항 내용을 자유롭게 입력하세요. (엔터 적용됨)" 
                        />
                    </div>

                    {/* 🔥 [NEW] 이미지 및 유튜브 첨부 필드 영역 추가 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800 pt-4">
                        <div>
                            <label className="text-xs text-slate-400 font-bold mb-1 flex items-center gap-1">🖼️ Image URL (선택)</label>
                            <input 
                                value={imageUrl} 
                                onChange={(e) => setImageUrl(e.target.value)} 
                                className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 text-white text-xs placeholder-slate-600 focus:border-emerald-500 transition-colors" 
                                placeholder="https://example.com/image.png" 
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 font-bold mb-1 flex items-center gap-1">📺 YouTube Link (선택)</label>
                            <input 
                                value={youtubeUrl} 
                                onChange={(e) => setYoutubeUrl(e.target.value)} 
                                className="w-full bg-slate-950 p-3 rounded-xl border border-slate-700 text-white text-xs placeholder-slate-600 focus:border-emerald-500 transition-colors" 
                                placeholder="https://youtube.com/watch?v=..." 
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800 mt-2">
                        <div className="flex flex-col">
                            <span className="text-sm font-black text-white">메인 화면 팝업 노출 🌟</span>
                            <span className="text-[10px] text-slate-500">체크 시 유저들이 사이트 접속 시 팝업으로 먼저 보게 됩니다.</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={isPopup} onChange={(e) => setIsPopup(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>

                    <div className="flex gap-2 pt-2">
                        {editId && (
                            <button onClick={resetForm} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all">
                                취소
                            </button>
                        )}
                        <button onClick={handleSave} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black italic rounded-xl py-3 shadow-lg shadow-emerald-900/20 transition-all">
                            {editId ? 'UPDATE NOTICE' : 'PUBLISH NOTICE'}
                        </button>
                    </div>
                </div>
            </div>

            {/* 공지사항 목록 */}
            <div className="bg-[#0f172a] rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
                <div className="bg-slate-950 py-4 px-5 border-b border-slate-800 flex justify-between items-center">
                    <span className="text-xs font-black italic text-slate-400 uppercase tracking-widest">Notice List</span>
                    <span className="text-[10px] text-emerald-500 font-bold">{notices.length} Posts</span>
                </div>
                
                {isLoading ? (
                    <div className="p-10 text-center text-slate-500 font-bold text-sm animate-pulse">Loading notices...</div>
                ) : notices.length === 0 ? (
                    <div className="p-10 text-center text-slate-500 font-bold text-sm">등록된 공지사항이 없습니다.</div>
                ) : (
                    <div className="divide-y divide-slate-800/50">
                        {notices.map(notice => (
                            <div key={notice.id} className="p-4 sm:p-5 hover:bg-slate-900/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex flex-col flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        {notice.isPopup && (
                                            <span className="bg-yellow-500/20 text-yellow-400 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest border border-yellow-500/30">POPUP</span>
                                        )}
                                        {/* 🔥 [NEW] 리스트에 첨부파일(유튜브, 이미지) 유무 뱃지 표시 */}
                                        {notice.imageUrl && <span className="text-[9px] text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded">🖼️</span>}
                                        {notice.youtubeUrl && <span className="text-[9px] text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded">📺</span>}
                                        <span className="text-[10px] text-slate-500 ml-1">{formatDate(notice.createdAt)}</span>
                                    </div>
                                    <h4 className="text-white font-bold text-sm leading-tight">{notice.title}</h4>
                                    <p className="text-slate-400 text-xs mt-1 line-clamp-1">{notice.content}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                    <button onClick={() => handleEdit(notice)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700 transition-all">Edit</button>
                                    <button onClick={() => handleDelete(notice.id)} className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 text-[10px] font-bold rounded-lg border border-red-900/30 transition-all">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};