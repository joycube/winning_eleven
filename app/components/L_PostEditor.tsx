"use client";
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Image as ImageIcon, Youtube, BarChart2, Plus, Trash2 } from 'lucide-react';
import { FALLBACK_IMG } from '../types';
import { sendAutoPush } from '../utils/pushUtil';

export default function L_PostEditor({ user, owners, viewMode, setViewMode, editingPostId, setEditingPostId, posts, setSelectedPostId }: any) {
    const [postForm, setPostForm] = useState({ title: '', content: '', cat: '자유', imageUrl: '', youtubeUrl: '' });
    
    // 🚨 투표 관련 State 추가
    const [isPollEnabled, setIsPollEnabled] = useState(false);
    const [pollOptions, setPollOptions] = useState([{ id: '1', text: '' }, { id: '2', text: '' }]);
    const [isAnonymous, setIsAnonymous] = useState(true);

    useEffect(() => {
        if (viewMode === 'EDIT' && editingPostId) {
            const post = posts.find((p:any) => p.id === editingPostId);
            if (post) {
                setPostForm({ title: post.title, content: post.content, cat: post.cat, imageUrl: post.imageUrl || '', youtubeUrl: post.youtubeId ? `https://youtube.com/watch?v=${post.youtubeId}` : '' });
                // 투표 정보 불러오기
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
                    poll: pollData, // 🚨 투표 데이터 추가
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
                
            } else if (viewMode === 'EDIT' && editingPostId) {
                await updateDoc(doc(db, 'posts', editingPostId), {
                    title: postForm.title, content: postForm.content, cat: postForm.cat,
                    imageUrl: postForm.imageUrl ? postForm.imageUrl.trim() : '', 
                    youtubeId: getValidYoutubeId(postForm.youtubeUrl), 
                    poll: pollData, // 🚨 투표 데이터 업데이트
                    isEdited: true
                });
                alert("✅ 게시글이 수정되었습니다!");
                setViewMode('LIST'); setEditingPostId(null);
            }
        } catch (e: any) { alert("🚨 오류 발생: " + e.message); }
    };

    return (
        <div className="bg-[#0f172a] rounded-3xl border border-slate-800 shadow-2xl p-6 sm:p-8 animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-5 border-b border-slate-800 pb-4">
                <h2 className="text-[16px] sm:text-[18px] font-black text-white tracking-tight">
                    {viewMode === 'WRITE' ? '새로운 게시글 작성 ✍️' : '게시글 수정 🛠️'}
                </h2>
                <button onClick={() => { setViewMode('MAIN'); setEditingPostId(null); }} className="text-slate-400 hover:text-white text-[11px] font-bold bg-slate-800 px-3 py-1.5 rounded-lg transition-colors">✕ 취소</button>
            </div>
            <div className="space-y-4">
                <div className="flex gap-2">
                  <select value={postForm.cat} onChange={e => setPostForm({...postForm, cat: e.target.value})} className="bg-slate-900 text-emerald-400 px-3 py-2.5 rounded-xl border border-slate-700 text-[12px] font-black outline-none focus:border-emerald-500 cursor-pointer shrink-0 shadow-inner">
                    {['축구', '이풋볼', '자유', '기타'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input placeholder="제목을 입력하세요 (최대 50자)" className="flex-1 bg-slate-900 text-white px-4 py-2.5 rounded-xl border border-slate-700 text-[13px] font-bold outline-none focus:border-emerald-500 placeholder:font-normal shadow-inner" value={postForm.title} onChange={e => setPostForm({...postForm, title: e.target.value})} />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2">
                   <div className="flex-1 flex items-center bg-slate-900 px-3 rounded-xl border border-slate-700 focus-within:border-emerald-500 shadow-inner">
                       <ImageIcon size={14} className="text-slate-500 mr-2 shrink-0" />
                       <input placeholder="이미지 URL (선택)" className="w-full bg-transparent text-white py-2.5 text-[12px] outline-none" value={postForm.imageUrl} onChange={e => setPostForm({...postForm, imageUrl: e.target.value})} />
                   </div>
                   <div className="flex-1 flex items-center bg-slate-900 px-3 rounded-xl border border-slate-700 focus-within:border-emerald-500 shadow-inner">
                       <Youtube size={14} className="text-red-500/70 mr-2 shrink-0" />
                       <input placeholder="유튜브 링크 (선택)" className="w-full bg-transparent text-white py-2.5 text-[12px] outline-none" value={postForm.youtubeUrl} onChange={e => setPostForm({...postForm, youtubeUrl: e.target.value})} />
                   </div>
                </div>

                <textarea placeholder="자유롭게 소통해 보세요!" className="w-full h-56 bg-slate-900 text-slate-200 p-4 rounded-xl border border-slate-700 text-[13px] outline-none focus:border-emerald-500 resize-none shadow-inner" value={postForm.content} onChange={e => setPostForm({...postForm, content: e.target.value})}></textarea>

                {/* 🚨 투표 작성 UI 영역 */}
                <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <button onClick={() => setIsPollEnabled(!isPollEnabled)} className={`flex items-center gap-2 text-[12px] font-black px-3 py-1.5 rounded-lg transition-colors border ${isPollEnabled ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                            <BarChart2 size={16} /> {isPollEnabled ? '투표 사용 중' : '투표 첨부하기'}
                        </button>
                        {isPollEnabled && (
                            <button onClick={() => setIsAnonymous(!isAnonymous)} className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                                현재: {isAnonymous ? '👻 무기명 투표' : '👁️ 기명(공개) 투표'}
                            </button>
                        )}
                    </div>
                    
                    {isPollEnabled && (
                        <div className="space-y-2 pt-2 border-t border-slate-800/50">
                            {pollOptions.map((opt, i) => (
                                <div key={opt.id} className="flex gap-2 items-center">
                                    <span className="w-6 text-center text-[10px] font-bold text-slate-500">{i + 1}</span>
                                    <input placeholder={`항목 ${i + 1} 입력`} className="flex-1 bg-slate-900 text-white px-3 py-2 rounded-lg border border-slate-700 text-[12px] outline-none focus:border-blue-500" value={opt.text} onChange={e => handlePollOptionChange(opt.id, e.target.value)} />
                                    <button onClick={() => handleRemovePollOption(opt.id)} disabled={pollOptions.length <= 2} className="p-2 text-slate-500 hover:text-red-400 disabled:opacity-30 transition-colors bg-slate-800 rounded-lg border border-slate-700">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                            <button onClick={handleAddPollOption} className="w-full mt-2 py-2 border border-dashed border-slate-700 rounded-lg text-[11px] font-bold text-slate-400 hover:text-white hover:border-slate-500 transition-colors flex items-center justify-center gap-1">
                                <Plus size={14} /> 항목 추가
                            </button>
                        </div>
                    )}
                </div>

                <div className="pt-2 flex justify-end">
                  <button onClick={handleWritePost} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl text-[12px] font-black transition-all tracking-widest">
                      {viewMode === 'WRITE' ? '등록 완료' : '수정 완료'}
                  </button>
                </div>
            </div>
        </div>
    );
}