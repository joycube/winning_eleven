"use client";
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Image as ImageIcon, Youtube, BarChart2, Plus, Trash2, ArrowLeft, Edit3, Link as LinkIcon } from 'lucide-react'; // 🚨 LinkIcon 추가
import { FALLBACK_IMG } from '../types';
import { sendAutoPush } from '../utils/pushUtil';

export default function L_PostEditor({ user, owners, viewMode, setViewMode, editingPostId, setEditingPostId, posts, setSelectedPostId }: any) {
    const [postForm, setPostForm] = useState({ title: '', content: '', cat: '자유', imageUrl: '', youtubeUrl: '' });
    
    // 투표 관련 State
    const [isPollEnabled, setIsPollEnabled] = useState(false);
    const [pollOptions, setPollOptions] = useState([{ id: '1', text: '' }, { id: '2', text: '' }]);
    const [isAnonymous, setIsAnonymous] = useState(true);

    // 🚨 툴바 에디터용 Ref 추가
    const editorRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (viewMode === 'EDIT' && editingPostId) {
            const post = posts.find((p:any) => p.id === editingPostId);
            if (post) {
                setPostForm({ title: post.title, content: post.content, cat: post.cat, imageUrl: post.imageUrl || '', youtubeUrl: post.youtubeId ? `https://youtube.com/watch?v=${post.youtubeId}` : '' });
                if (post.poll) {
                    setIsPollEnabled(true);
                    setPollOptions(post.poll.options || []);
                    setIsAnonymous(post.poll.isAnonymous ?? true);
                }
            }
        }
    }, [viewMode, editingPostId, posts]);

    const handleAddPollOption = () => {
        setPollOptions([...pollOptions, { id: Date.now().toString(), text: '' }]);
    };

    const handleRemovePollOption = (id: string) => {
        setPollOptions(pollOptions.filter(o => o.id !== id));
    };

    const handlePollOptionChange = (id: string, text: string) => {
        setPollOptions(pollOptions.map(o => o.id === id ? { ...o, text } : o));
    };

    // 🚨 가벼운 디자인 툴바 기능: 커서 위치에 URL 텍스트 삽입
    const insertTemplate = (template: string) => {
        if (!editorRef.current) return;
        const start = editorRef.current.selectionStart;
        const end = editorRef.current.selectionEnd;
        const text = postForm.content;
        const newValue = text.substring(0, start) + template + text.substring(end);
        setPostForm({ ...postForm, content: newValue });
        
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

    const handleWritePost = async () => {
        if (!user) return alert("🚨 로그인이 필요합니다!");
        if (!postForm.title.trim() || !postForm.content.trim()) return alert("🚨 제목과 내용을 모두 입력해주세요!");

        let pollData = null;
        if (isPollEnabled) {
            const validOptions = pollOptions.filter(o => o.text.trim());
            if (validOptions.length < 2) return alert("🚨 투표 항목을 2개 이상 입력해주세요.");
            
            pollData = {
                options: validOptions,
                isAnonymous: isAnonymous,
                votes: viewMode === 'EDIT' ? (posts.find((p:any) => p.id === editingPostId)?.poll?.votes || {}) : {}
            };
        }

        const getValidYoutubeId = (url: string) => {
            const match = url?.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([a-zA-Z0-9_-]{11})/);
            return match ? match[1] : '';
        };

        try {
            if (viewMode === 'WRITE') {
                const authorName = user.mappedOwnerId || '미배정 오너';
                const docRef = await addDoc(collection(db, 'posts'), {
                    title: postForm.title, content: postForm.content, cat: postForm.cat,
                    imageUrl: postForm.imageUrl ? postForm.imageUrl.trim() : '', 
                    youtubeId: getValidYoutubeId(postForm.youtubeUrl), 
                    poll: pollData, 
                    authorId: user.uid, authorUid: user.uid, authorName: authorName, 
                    authorPhoto: user.photo || user.photoURL || FALLBACK_IMG, 
                    createdAt: serverTimestamp(), isPinned: false, isEdited: false, views: 0, likes: [], dislikes: [], comments: []
                });

                try {
                    const pushTitle = `📝 [${postForm.cat}] 새로운 게시글`;
                    const pushBody = `${authorName}님: ${postForm.title}`;
                    sendAutoPush(pushTitle, pushBody); 
                } catch (error) {}

                alert("✅ 게시글이 등록되었습니다!");
                setViewMode('LIST'); setSelectedPostId(docRef.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                
            } else if (viewMode === 'EDIT' && editingPostId) {
                await updateDoc(doc(db, 'posts', editingPostId), {
                    title: postForm.title, content: postForm.content, cat: postForm.cat,
                    imageUrl: postForm.imageUrl ? postForm.imageUrl.trim() : '', 
                    youtubeId: getValidYoutubeId(postForm.youtubeUrl), 
                    poll: pollData, 
                    isEdited: true
                });
                alert("✅ 게시글이 수정되었습니다!");
                setViewMode('LIST'); setEditingPostId(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch (e: any) { alert("🚨 오류 발생: " + e.message); }
    };

    return (
        <div className="w-full animate-in slide-in-from-bottom-4 flex flex-col mb-10">
            <div className="flex items-center justify-between mb-6 px-2 w-full">
                <h2 className="text-[18px] sm:text-[20px] font-black italic text-white tracking-widest flex items-center gap-2 uppercase">
                    {viewMode === 'WRITE' ? (
                        <><Edit3 size={20} className="text-emerald-500" /> NEW POST</>
                    ) : (
                        <><Edit3 size={20} className="text-blue-500" /> EDIT POST</>
                    )}
                </h2>
                <button onClick={() => { setViewMode('MAIN'); setEditingPostId(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors font-bold text-[11px] sm:text-[12px] bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 shadow-inner w-max">
                    <ArrowLeft size={14} /> <span>취소 및 돌아가기</span>
                </button>
            </div>

            <div className="space-y-4 w-full">
                <div className="flex gap-2 w-full">
                  <select value={postForm.cat} onChange={e => setPostForm({...postForm, cat: e.target.value})} className="bg-slate-900 text-emerald-400 px-3 py-3 rounded-xl border border-slate-700 text-[13px] font-black outline-none focus:border-emerald-500 cursor-pointer shrink-0 shadow-inner">
                    {['축구', '이풋볼', '자유', '기타'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input placeholder="제목을 입력하세요 (최대 50자)" className="flex-1 bg-slate-900 text-white px-4 py-3 rounded-xl border border-slate-700 text-[14px] font-bold outline-none focus:border-emerald-500 placeholder:font-normal shadow-inner" value={postForm.title} onChange={e => setPostForm({...postForm, title: e.target.value})} />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                   <div className="flex-1 flex items-center bg-slate-900 px-4 rounded-xl border border-slate-700 focus-within:border-emerald-500 shadow-inner">
                       <ImageIcon size={16} className="text-slate-500 mr-2 shrink-0" />
                       <input placeholder="대표 이미지 URL (목록 썸네일용)" className="w-full bg-transparent text-white py-3 text-[13px] outline-none" value={postForm.imageUrl} onChange={e => setPostForm({...postForm, imageUrl: e.target.value})} />
                   </div>
                   <div className="flex-1 flex items-center bg-slate-900 px-4 rounded-xl border border-slate-700 focus-within:border-emerald-500 shadow-inner">
                       <Youtube size={16} className="text-red-500/70 mr-2 shrink-0" />
                       <input placeholder="대표 유튜브 링크 (본문 상단 플레이어)" className="w-full bg-transparent text-white py-3 text-[13px] outline-none" value={postForm.youtubeUrl} onChange={e => setPostForm({...postForm, youtubeUrl: e.target.value})} />
                   </div>
                </div>

                {/* 🚨 가벼운 디자인 툴바 및 에디터 영역 */}
                <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-inner focus-within:border-emerald-500 transition-colors flex flex-col">
                    {/* 상단 툴바 */}
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
                    {/* 텍스트 에어리어 */}
                    <textarea 
                        ref={editorRef}
                        placeholder="자유롭게 소통해 보세요!&#10;상단의 툴바 버튼을 이용해 본문 중간에 사진이나 영상 주소를 쉽게 추가할 수 있습니다 ✨" 
                        className="w-full h-72 sm:h-80 bg-transparent text-slate-200 p-5 text-[14px] outline-none resize-none leading-relaxed placeholder:text-slate-500 placeholder:leading-relaxed" 
                        value={postForm.content} 
                        onChange={e => setPostForm({...postForm, content: e.target.value})}
                    />
                </div>

                {/* 투표 작성 UI 영역 */}
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

                <div className="pt-6 flex justify-end w-full">
                  <button onClick={handleWritePost} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-2xl text-[14px] font-black transition-all flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 tracking-widest uppercase">
                      {viewMode === 'WRITE' ? '게시글 등록하기' : '게시글 수정완료'}
                  </button>
                </div>
            </div>
        </div>
    );
}