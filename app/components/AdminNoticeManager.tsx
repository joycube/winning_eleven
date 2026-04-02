"use client";

import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { Notice } from '../types';
import { useAuth } from '../hooks/useAuth'; 
import { Edit3, Image as ImageIcon, Youtube, Link as LinkIcon, BarChart2, Plus, Trash2 } from 'lucide-react'; // 🚨 에디터용 아이콘 추가

export const AdminNoticeManager = () => {
    const { authUser } = useAuth(); 
    const [notices, setNotices] = useState<Notice[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 폼 상태 (생성 및 수정용)
    const [editId, setEditId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [imageUrl, setImageUrl] = useState('');     
    const [youtubeUrl, setYoutubeUrl] = useState(''); 
    const [isPopup, setIsPopup] = useState(false);

    // 🚨 투표 관련 State 추가
    const [isPollEnabled, setIsPollEnabled] = useState(false);
    const [pollOptions, setPollOptions] = useState([{ id: '1', text: '' }, { id: '2', text: '' }]);
    const [isAnonymous, setIsAnonymous] = useState(true);

    // 🚨 툴바 에디터용 Ref 추가
    const editorRef = useRef<HTMLTextAreaElement>(null);

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
        setImageUrl('');     
        setYoutubeUrl('');   
        setIsPopup(false);
        setIsPollEnabled(false);
        setPollOptions([{ id: '1', text: '' }, { id: '2', text: '' }]);
        setIsAnonymous(true);
    };

    // 🚨 가벼운 디자인 툴바 기능: 커서 위치에 URL 텍스트 삽입
    const insertTemplate = (template: string) => {
        if (!editorRef.current) return;
        const start = editorRef.current.selectionStart;
        const end = editorRef.current.selectionEnd;
        const newValue = content.substring(0, start) + template + content.substring(end);
        setContent(newValue);
        
        setTimeout(() => {
            editorRef.current?.focus();
            editorRef.current?.setSelectionRange(start + template.length, start + template.length);
        }, 0);
    };

    const handleInsertImage = () => {
        const url = window.prompt("📷 본문에 삽입할 이미지 주소(URL)를 입력하세요.\n(예: https://.../photo.jpg)");
        if (url) insertTemplate(`\n${url}\n`);
    };

    const handleInsertYoutube = () => {
        const url = window.prompt("🎬 본문에 삽입할 유튜브 주소를 입력하세요.\n(예: https://youtube.com/...)");
        if (url) insertTemplate(`\n${url}\n`);
    };

    const handleInsertLink = () => {
        const url = window.prompt("🔗 본문에 삽입할 웹사이트 주소를 입력하세요.\n(예: https://...)");
        if (url) insertTemplate(`\n${url}\n`);
    };

    const handleAddPollOption = () => {
        setPollOptions([...pollOptions, { id: Date.now().toString(), text: '' }]);
    };

    const handleRemovePollOption = (id: string) => {
        setPollOptions(pollOptions.filter(o => o.id !== id));
    };

    const handlePollOptionChange = (id: string, text: string) => {
        setPollOptions(pollOptions.map(o => o.id === id ? { ...o, text } : o));
    };

    // 저장 (생성 또는 수정)
    const handleSave = async () => {
        if (!title.trim() || !content.trim()) return alert("제목과 내용을 입력해주세요.");

        let pollData = null;
        if (isPollEnabled) {
            const validOptions = pollOptions.filter(o => o.text.trim());
            if (validOptions.length < 2) return alert("🚨 투표 항목을 2개 이상 입력해주세요.");
            
            pollData = {
                options: validOptions,
                isAnonymous: isAnonymous,
                votes: editId ? ((notices.find((n: any) => n.id === editId) as any)?.poll?.votes || {}) : {}
            };
        }

        try {
            if (editId) {
                await updateDoc(doc(db, 'notices', editId), {
                    title, content, imageUrl, youtubeUrl, isPopup,
                    poll: pollData, // 🔥 투표 데이터 업데이트
                    updatedAt: new Date().toISOString() 
                });
                alert("공지사항이 수정되었습니다.");
            } else {
                await addDoc(collection(db, 'notices'), {
                    title, content, imageUrl, youtubeUrl, isPopup, 
                    poll: pollData, // 🔥 투표 데이터 추가
                    authorUid: authUser?.uid || 'system', 
                    authorName: authUser?.mappedOwnerId || '운영진', 
                    createdAt: new Date().toISOString(),
                    likedBy: [], dislikedBy: [], comments: []      
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
    const handleEdit = (notice: any) => {
        setEditId(notice.id);
        setTitle(notice.title);
        setContent(notice.content);
        setImageUrl(notice.imageUrl || '');     
        setYoutubeUrl(notice.youtubeUrl || ''); 
        setIsPopup(notice.isPopup);
        
        if (notice.poll) {
            setIsPollEnabled(true);
            setPollOptions(notice.poll.options || []);
            setIsAnonymous(notice.poll.isAnonymous ?? true);
        } else {
            setIsPollEnabled(false);
            setPollOptions([{ id: '1', text: '' }, { id: '2', text: '' }]);
            setIsAnonymous(true);
        }
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

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
        // 🚨 픽스: 라운딩 박스 제거, 풀-블리드 오픈형 레이아웃
        <div className="w-full animate-in fade-in flex flex-col mb-10">
            
            {/* 타이틀 헤더 */}
            <div className="flex items-center justify-between mb-6 px-2 w-full">
                <h2 className="text-[18px] sm:text-[20px] font-black italic text-white tracking-widest flex items-center gap-2 uppercase">
                    <Edit3 size={20} className="text-purple-500" /> {editId ? 'EDIT NOTICE' : 'NEW NOTICE'}
                </h2>
                {editId && (
                    <button onClick={resetForm} className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors font-bold text-[11px] sm:text-[12px] bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 shadow-inner w-max">
                        <span>취소 및 새 글 쓰기</span>
                    </button>
                )}
            </div>

            {/* 작성 폼 (오픈형) */}
            <div className="space-y-4 w-full">
                <div className="flex gap-2 w-full">
                    <input 
                        value={title} 
                        onChange={(e) => setTitle(e.target.value)} 
                        className="flex-1 bg-slate-900 text-white px-4 py-3 rounded-xl border border-slate-700 text-[14px] font-bold outline-none focus:border-emerald-500 placeholder:font-normal shadow-inner" 
                        placeholder="공지사항 제목을 입력하세요" 
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full">
                   <div className="flex-1 flex items-center bg-slate-900 px-4 rounded-xl border border-slate-700 focus-within:border-emerald-500 shadow-inner">
                       <ImageIcon size={16} className="text-slate-500 mr-2 shrink-0" />
                       <input placeholder="대표 이미지 URL (목록 썸네일용)" className="w-full bg-transparent text-white py-3 text-[13px] outline-none" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
                   </div>
                   <div className="flex-1 flex items-center bg-slate-900 px-4 rounded-xl border border-slate-700 focus-within:border-emerald-500 shadow-inner">
                       <Youtube size={16} className="text-red-500/70 mr-2 shrink-0" />
                       <input placeholder="대표 유튜브 링크 (상단 플레이어)" className="w-full bg-transparent text-white py-3 text-[13px] outline-none" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} />
                   </div>
                </div>

                {/* 에디터 툴바 & 텍스트 영역 */}
                <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-inner focus-within:border-emerald-500 transition-colors flex flex-col">
                    <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-2 border-b border-slate-700">
                        <button type="button" onClick={handleInsertImage} className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-slate-700 rounded-lg text-[12px] font-bold text-slate-300 hover:text-white transition-colors" title="본문에 이미지 삽입">
                            <ImageIcon size={14} className="text-emerald-400" /> 사진 첨부
                        </button>
                        <button type="button" onClick={handleInsertYoutube} className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-slate-700 rounded-lg text-[12px] font-bold text-slate-300 hover:text-white transition-colors" title="본문에 유튜브 링크 삽입">
                            <Youtube size={14} className="text-red-400" /> 영상 링크
                        </button>
                        <div className="w-px h-4 bg-slate-700 mx-1"></div>
                        <button type="button" onClick={handleInsertLink} className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-slate-700 rounded-lg text-[12px] font-bold text-slate-300 hover:text-white transition-colors" title="본문에 일반 웹 링크 삽입">
                            <LinkIcon size={14} className="text-blue-400" /> 주소 링크
                        </button>
                    </div>
                    <textarea 
                        ref={editorRef}
                        value={content} 
                        onChange={(e) => setContent(e.target.value)} 
                        className="w-full h-72 sm:h-80 bg-transparent text-slate-200 p-5 text-[14px] outline-none resize-none leading-relaxed placeholder:text-slate-500 placeholder:leading-relaxed" 
                        placeholder="공지사항 내용을 자유롭게 작성하세요!&#10;상단의 툴바 버튼을 이용해 본문 중간에 사진이나 영상 주소를 쉽게 추가할 수 있습니다 ✨" 
                    />
                </div>

                {/* 🚨 공지사항 전용: 메인 팝업 설정 */}
                <div className="flex items-center justify-between bg-slate-900/80 px-5 py-4 rounded-xl border border-slate-800 shadow-sm w-full">
                    <div className="flex flex-col">
                        <span className="text-[13px] font-black text-white">🌟 메인 화면 팝업 노출</span>
                        <span className="text-[11px] text-slate-400">체크 시 유저들이 사이트 접속 시 팝업으로 먼저 보게 됩니다.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={isPopup} onChange={(e) => setIsPopup(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                    </label>
                </div>

                {/* 🚨 투표 작성 UI 영역 */}
                <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 space-y-4 w-full shadow-md">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <button onClick={() => setIsPollEnabled(!isPollEnabled)} className={`flex items-center justify-center gap-2 text-[13px] font-black px-4 py-2.5 rounded-xl transition-colors border shadow-sm ${isPollEnabled ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                            <BarChart2 size={18} /> {isPollEnabled ? '투표 기능 사용 중' : '📊 투표 첨부하기'}
                        </button>
                        {isPollEnabled && (
                            <button onClick={() => setIsAnonymous(!isAnonymous)} className="text-[12px] font-bold text-slate-400 hover:text-white transition-colors bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-700 shadow-sm">
                                현재 모드: {isAnonymous ? '👻 무기명 투표' : '👁️ 기명(공개) 투표'}
                            </button>
                        )}
                    </div>
                    
                    {isPollEnabled && (
                        <div className="space-y-2.5 pt-3 border-t border-slate-800/60 w-full">
                            {pollOptions.map((opt, i) => (
                                <div key={opt.id} className="flex gap-2 items-center w-full">
                                    <span className="w-6 text-center text-[11px] font-black text-slate-500">{i + 1}</span>
                                    <input placeholder={`항목 ${i + 1} 내용 입력`} className="flex-1 bg-[#0f172a] text-white px-4 py-3 rounded-xl border border-slate-700 text-[13px] outline-none focus:border-blue-500 shadow-inner" value={opt.text} onChange={e => handlePollOptionChange(opt.id, e.target.value)} />
                                    <button onClick={() => handleRemovePollOption(opt.id)} disabled={pollOptions.length <= 2} className="p-3 text-slate-500 hover:text-red-400 disabled:opacity-30 transition-colors bg-[#0f172a] rounded-xl border border-slate-700 shadow-sm">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            <button onClick={handleAddPollOption} className="w-full mt-3 py-3 border border-dashed border-slate-600 rounded-xl text-[12px] font-bold text-slate-400 hover:text-white hover:border-slate-500 hover:bg-slate-800/50 transition-colors flex items-center justify-center gap-1.5">
                                <Plus size={16} /> 투표 항목 추가
                            </button>
                        </div>
                    )}
                </div>

                <div className="pt-4 flex justify-end w-full pb-10 border-b border-slate-800/60">
                    <button onClick={handleSave} className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white px-10 py-4 rounded-2xl text-[14px] font-black transition-all flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.3)] active:scale-95 tracking-widest uppercase">
                        {editId ? 'UPDATE NOTICE' : 'PUBLISH NOTICE'}
                    </button>
                </div>
            </div>

            {/* 공지사항 목록 (오픈형) */}
            <div className="w-full pt-8">
                <div className="flex justify-between items-center mb-4 px-2 w-full">
                    <h3 className="text-[16px] sm:text-[18px] font-black italic text-slate-300 uppercase tracking-widest">Notice List</h3>
                    <span className="text-[11px] text-purple-400 font-bold px-2.5 py-1 bg-purple-900/20 border border-purple-500/30 rounded-lg">Total {notices.length}</span>
                </div>
                
                {isLoading ? (
                    <div className="p-10 text-center text-slate-500 font-bold text-sm animate-pulse w-full">Loading notices...</div>
                ) : notices.length === 0 ? (
                    <div className="p-10 text-center text-slate-500 font-bold text-[13px] w-full bg-slate-900/30 rounded-xl border border-slate-800/50">등록된 공지사항이 없습니다.</div>
                ) : (
                    <div className="flex flex-col divide-y divide-slate-800/50 border-y border-slate-800/60 w-full">
                        {notices.map(notice => (
                            <div key={notice.id} className="py-4 px-2 hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full group">
                                <div className="flex flex-col flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        {notice.isPopup && (
                                            <span className="bg-yellow-500/20 text-yellow-400 text-[9px] font-black px-2 py-0.5 rounded border border-yellow-500/30">POPUP</span>
                                        )}
                                        {/* 🚨 공지도 투표 아이콘 표시 추가 */}
                                        {(notice as any).poll && <BarChart2 size={14} className="text-blue-400 shrink-0" />}
                                        <span className="text-[11px] text-slate-500 font-medium">{formatDate(notice.createdAt)}</span>
                                    </div>
                                    <h4 className="text-slate-200 group-hover:text-purple-400 transition-colors font-bold text-[14px] sm:text-[15px] leading-tight truncate pr-2">{notice.title}</h4>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                    <button onClick={() => handleEdit(notice)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded-lg border border-slate-700 transition-all shadow-sm">수정</button>
                                    <button onClick={() => handleDelete(notice.id)} className="px-4 py-2 bg-slate-900 hover:bg-red-900/40 text-red-400 text-[11px] font-bold rounded-lg border border-slate-800 hover:border-red-900/50 transition-all shadow-sm">삭제</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};