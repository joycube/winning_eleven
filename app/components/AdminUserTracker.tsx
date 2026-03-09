"use client";

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Owner, FALLBACK_IMG } from '../types'; 

interface AdminUserTrackerProps {
  owners: Owner[];
}

export const AdminUserTracker = ({ owners }: AdminUserTrackerProps) => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const [editData, setEditData] = useState<Record<string, { nickname: string, photo: string, role: string }>>({});

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'user_accounts'));
      // 🔥 [TS 에러 픽스] as any를 명시하여 타입 에러를 우회합니다.
      const fetchedUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setAccounts(fetchedUsers);

      const initialEditData: any = {};
      // 🔥 [TS 에러 픽스] (u: any) 로 명시하여 속성 없음 에러를 해결합니다.
      fetchedUsers.forEach((u: any) => {
        if (u.role !== 'PENDING') {
          const ownerMatch = owners.find(o => (o as any).uid === u.id || String(o.id) === u.id || o.docId === u.id);
          initialEditData[u.id] = {
            nickname: ownerMatch?.nickname || u.mappedOwnerId || u.displayName || '',
            photo: ownerMatch?.photo || u.photoURL || '',
            role: u.role || 'MEMBER'
          };
        }
      });
      setEditData(initialEditData);

    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [owners]);

  const handleApprove = async (user: any, selectedLegacyName: string) => {
    const userUid = user.id;
    setProcessingId(userUid);
    
    try {
      if (!selectedLegacyName) {
        if (!confirm(`[신규 가입] '${user.displayName}' 님을 새로운 구단주로 승인하시겠습니까?\n\n승인 즉시 고유 UID 기반으로 오너 명부가 생성됩니다.`)) {
          setProcessingId(null); return;
        }
      } else {
        if (!confirm(`[기존 기록 연결] 구글 계정(${user.displayName})에 과거 '${selectedLegacyName}'의 모든 기록을 귀속시키겠습니까?\n\n이후부터 이 계정의 본체(Key)는 UID로 동작합니다.`)) {
          setProcessingId(null); return;
        }
      }

      const batch = writeBatch(db);
      const userAccountRef = doc(db, 'user_accounts', userUid);
      const ownerListRef = doc(db, 'users', userUid); 

      batch.update(userAccountRef, {
        role: 'MEMBER',
        uid: userUid, 
        mappedOwnerId: selectedLegacyName || user.displayName, 
        approvedAt: new Date().toISOString()
      });

      const legacyOwnerData = owners.find(o => o.nickname === selectedLegacyName);
      
      batch.set(ownerListRef, {
        id: Date.now(), 
        uid: userUid,   
        nickname: selectedLegacyName || user.displayName, 
        legacyName: selectedLegacyName || null, 
        photo: legacyOwnerData?.photo || user.photoURL || '',
        email: user.email,
        createdAt: new Date().toISOString()
      }, { merge: true }); 
      
      await batch.commit();
      alert('✅ 승인 및 명부 생성 처리가 완벽히 완료되었습니다!');
      fetchUsers();
    } catch (e: any) {
      alert(`🚨 승인 실패 (파이어베이스 규칙을 확인하세요): ${e.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateMember = async (uid: string) => {
    setProcessingId(uid);
    try {
      const data = editData[uid];
      if (!data.nickname.trim()) { alert("닉네임을 입력해주세요."); setProcessingId(null); return; }

      const batch = writeBatch(db);
      
      batch.update(doc(db, 'user_accounts', uid), {
        mappedOwnerId: data.nickname,
        role: data.role
      });

      const ownerMatch = owners.find(o => (o as any).uid === uid || String(o.id) === uid || o.docId === uid);
      const userRef = doc(db, 'users', uid);

      const updatePayload: any = {
        nickname: data.nickname,
        photo: data.photo
      };

      if (ownerMatch && ownerMatch.nickname !== data.nickname && !ownerMatch.legacyName) {
         updatePayload.legacyName = ownerMatch.nickname;
      }

      batch.set(userRef, updatePayload, { merge: true });
      
      await batch.commit();
      alert('✅ 정보가 성공적으로 수정되었습니다.\n(앱 전반에 즉시 동기화됩니다.)');
      fetchUsers();
    } catch (e: any) {
      alert(`🚨 수정 실패: ${e.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleEditChange = (uid: string, field: string, value: string) => {
    setEditData(prev => ({
      ...prev,
      [uid]: { ...prev[uid], [field]: value }
    }));
  };

  const handleReject = async (userUid: string, name: string) => {
    if (!confirm(`[경고] ${name}님의 지메일 계정을 데이터베이스에서 완전히 삭제하시겠습니까?\n(승인된 유저라면 앱 이용 권한이 즉시 박탈됩니다)`)) return;

    setProcessingId(userUid);
    try {
      await deleteDoc(doc(db, 'user_accounts', userUid));
      alert('🗑️ 성공적으로 삭제되었습니다.');
      fetchUsers();
    } catch (e: any) {
      alert(`🚨 삭제 실패: ${e.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const pendingUsers = accounts.filter(u => u.role === 'PENDING');
  const approvedUsers = accounts.filter(u => u.role !== 'PENDING');

  const filteredPending = pendingUsers.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredApproved = approvedUsers.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || u.mappedOwnerId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-slate-900/50 rounded-3xl border border-slate-800 p-6 backdrop-blur-md animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-black text-white italic tracking-tighter uppercase flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
            G-MAIL ACCOUNTS
          </h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            승인 대기 ({pendingUsers.length}) / 승인 완료 ({approvedUsers.length})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input 
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 w-full md:w-64 transition-all shadow-inner"
          />
          <button onClick={fetchUsers} className="p-2.5 bg-slate-800 rounded-xl hover:bg-slate-700 text-slate-400 transition-all shadow-md active:scale-95">🔄</button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500 italic font-bold animate-pulse">Scanning database...</div>
      ) : (
        <div className="space-y-10">
          
          <div>
              <h4 className="text-emerald-400 font-black mb-3 text-xs tracking-widest flex items-center gap-1.5"><span className="text-base">⏳</span> PENDING APPROVAL</h4>
              {filteredPending.length === 0 ? (
                <div className="py-10 text-center bg-slate-950/30 rounded-2xl border border-dashed border-slate-800 text-slate-500 text-xs font-bold italic">
                  {searchTerm ? "검색 결과가 없습니다." : "대기 중인 가입자가 없습니다."}
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredPending.map((u) => (
                    <div key={u.id} className="group flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-950/80 p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all duration-300 shadow-lg">
                      <div className="flex items-center gap-4">
                        <img src={u.photoURL || FALLBACK_IMG} className="w-12 h-12 rounded-full border-2 border-slate-800 group-hover:border-emerald-500/50 transition-all object-cover" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                        <div>
                          <div className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors">{u.displayName}</div>
                          <div className="text-[11px] text-slate-500 font-medium">{u.email}</div>
                          <div className="text-[9px] text-slate-600 font-mono mt-0.5">UID: {u.id}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <select id={`select-${u.id}`} disabled={processingId === u.id} className="flex-1 lg:flex-none bg-slate-900 text-[11px] font-bold border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:ring-1 focus:ring-emerald-500 cursor-pointer disabled:opacity-50">
                          <option value="">[신규 구단주] 로 승인 (과거 기록 없음)</option>
                          <optgroup label="--- 기존 구단주 기록 흡수 ---">
                            {owners.map(o => <option key={o.id} value={o.nickname}>{o.nickname}님의 과거 기록 연결</option>)}
                          </optgroup>
                        </select>

                        <div className="flex items-center gap-2">
                          <button disabled={processingId === u.id} onClick={() => { const select = document.getElementById(`select-${u.id}`) as HTMLSelectElement; handleApprove(u, select.value); }} className="flex-1 lg:flex-none bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-[11px] font-black italic px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-900/20 active:scale-95">{processingId === u.id ? "승인 중..." : "APPROVE"}</button>
                          <button disabled={processingId === u.id} onClick={() => handleReject(u.id, u.displayName)} className="p-2.5 bg-slate-900 hover:bg-red-950/30 text-slate-600 hover:text-red-500 border border-slate-800 rounded-xl transition-all" title="거절 및 삭제">🗑️</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent my-2"></div>

          <div>
              <h4 className="text-blue-400 font-black mb-3 text-xs tracking-widest flex items-center gap-1.5"><span className="text-base">✅</span> APPROVED MEMBERS</h4>
              {filteredApproved.length === 0 ? (
                <div className="py-10 text-center bg-slate-950/30 rounded-2xl border border-dashed border-slate-800 text-slate-500 text-xs font-bold italic">
                  {searchTerm ? "검색 결과가 없습니다." : "승인된 가입자가 없습니다."}
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredApproved.map((u) => (
                    <div key={u.id} className="group flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-950/40 p-4 sm:p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition-all duration-300">
                      
                      <div className="flex items-center gap-3 w-full lg:w-1/4 min-w-0">
                        <img src={editData[u.id]?.photo || FALLBACK_IMG} className="w-10 h-10 rounded-full border border-slate-700 object-cover shrink-0 bg-slate-800" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-xs font-black text-slate-200 truncate leading-none">{u.displayName}</span>
                              {u.role === 'ADMIN' && <span className="bg-red-900/30 border border-red-500/30 text-red-400 text-[8px] font-black px-1.5 rounded uppercase shrink-0">ADMIN</span>}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium truncate">{u.email}</div>
                          <div className="text-[8px] text-slate-600 font-mono truncate">UID: {u.id}</div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row flex-1 items-stretch gap-2">
                        <div className="flex flex-col flex-1">
                            <label className="text-[9px] text-slate-500 font-bold ml-1 mb-0.5 uppercase tracking-widest">Nickname</label>
                            <input 
                                type="text" value={editData[u.id]?.nickname || ''} onChange={(e) => handleEditChange(u.id, 'nickname', e.target.value)} placeholder="닉네임"
                                className="w-full bg-slate-900 text-xs font-bold border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-blue-500 outline-none transition-colors shadow-inner"
                            />
                        </div>
                        <div className="flex flex-col flex-[2]">
                            <label className="text-[9px] text-slate-500 font-bold ml-1 mb-0.5 uppercase tracking-widest">Photo URL</label>
                            <input 
                                type="text" value={editData[u.id]?.photo || ''} onChange={(e) => handleEditChange(u.id, 'photo', e.target.value)} placeholder="이미지 주소"
                                className="w-full bg-slate-900 text-xs font-bold border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-blue-500 outline-none transition-colors shadow-inner"
                            />
                        </div>
                        <div className="flex flex-col w-full sm:w-24 shrink-0">
                            <label className="text-[9px] text-slate-500 font-bold ml-1 mb-0.5 uppercase tracking-widest">Role</label>
                            <select 
                                value={editData[u.id]?.role || 'MEMBER'} onChange={(e) => handleEditChange(u.id, 'role', e.target.value)}
                                className="w-full bg-slate-900 text-xs font-bold border border-slate-700 rounded-xl px-2 py-2 text-slate-300 focus:border-blue-500 outline-none cursor-pointer"
                            >
                                <option value="MEMBER">일반(USER)</option>
                                <option value="ADMIN" className="text-red-400 font-black">운영진(ADMIN)</option>
                            </select>
                        </div>
                      </div>

                      <div className="flex items-end gap-2 w-full lg:w-auto mt-2 lg:mt-0 shrink-0">
                        <button disabled={processingId === u.id} onClick={() => handleUpdateMember(u.id)} className="flex-1 lg:flex-none h-[34px] bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-[11px] font-black px-4 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center">
                          {processingId === u.id ? "저장 중..." : "설정 저장"}
                        </button>
                        <button disabled={processingId === u.id} onClick={() => handleReject(u.id, u.displayName)} className="h-[34px] w-[34px] bg-slate-900 hover:bg-red-950/30 text-slate-600 hover:text-red-500 border border-slate-700 rounded-xl transition-all flex items-center justify-center" title="계정 완전 삭제">
                          🗑️
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      )}

      <div className="mt-8 p-5 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
        <p className="text-[11px] text-slate-400 leading-relaxed font-bold">
          <span className="text-emerald-400 mr-1">TIPS:</span> 
          이곳에서 유저의 정보(닉네임, 프로필)를 변경하면 앱 전반의 과거/현재 기록에 <strong>단 1초 만에 일괄 동기화(UID 연동)</strong> 됩니다. 절대 명부가 중복 생성되지 않습니다.
        </p>
      </div>
    </div>
  );
};