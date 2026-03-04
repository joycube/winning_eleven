"use client";

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Owner } from '../types';

interface AdminUserTrackerProps {
  owners: Owner[];
}

export const AdminUserTracker = ({ owners }: AdminUserTrackerProps) => {
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // 1. 대기 유저 가져오기 (🔥 원래 경로인 user_accounts 로 복구!)
  const fetchPendingUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'user_accounts'), where('role', '==', 'PENDING'));
      const querySnapshot = await getDocs(q);
      const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPendingUsers(users);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  // 2. 통합 승인 처리 (신규 가입자 & 기존 오너 매핑)
  const handleApprove = async (userUid: string, selectedOwner: string, userName: string) => {
    setProcessingId(userUid);
    
    try {
      // 🔥 여기도 user_accounts 로 복구!
      const userRef = doc(db, 'user_accounts', userUid);
      let finalOwnerId = selectedOwner;

      // 분기 1: 신규 가입자 승인 (드롭다운을 선택하지 않은 경우)
      if (!selectedOwner) {
        if (!confirm(`[신규 가입] '${userName}' 님을 새로운 구단주로 승인하시겠습니까?\n(승인 후 오너룸에서 직접 프로필과 팀을 설정하게 됩니다.)`)) {
          setProcessingId(null);
          return;
        }
        finalOwnerId = userName; // 신규 유저는 본인의 구글 닉네임을 기본 오너명으로 부여
      } 
      // 분기 2: 기존 오너 매핑 (드롭다운을 선택한 경우)
      else {
        if (!confirm(`[기존 매핑] '${selectedOwner}'님의 기존 기록과 연결하여 승인하시겠습니까?`)) {
          setProcessingId(null);
          return;
        }
      }

      await updateDoc(userRef, {
        role: 'MEMBER',
        mappedOwnerId: finalOwnerId,
        approvedAt: new Date().toISOString()
      });
      
      setPendingUsers(prev => prev.filter(u => u.id !== userUid));
      alert('✅ 승인 처리가 완료되었습니다!');
    } catch (e: any) {
      console.error(e);
      alert(`🚨 승인 실패 (파이어베이스 보안 규칙을 확인하세요): ${e.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // 3. 거절(삭제) 처리
  const handleReject = async (userUid: string, name: string) => {
    if (!confirm(`[경고] ${name}님의 가입 신청을 거절하고 데이터베이스에서 완전히 삭제하시겠습니까?`)) return;

    setProcessingId(userUid);
    try {
      // 🔥 여기도 user_accounts 로 복구!
      await deleteDoc(doc(db, 'user_accounts', userUid));
      setPendingUsers(prev => prev.filter(u => u.id !== userUid));
      alert('🗑️ 성공적으로 삭제되었습니다.');
    } catch (e: any) {
      console.error(e);
      alert(`🚨 삭제 실패 (파이어베이스 보안 규칙을 확인하세요): ${e.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // 검색 필터링 로직
  const filteredUsers = pendingUsers.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-slate-900/50 rounded-3xl border border-slate-800 p-6 backdrop-blur-md animate-in fade-in duration-500">
      {/* 헤더 섹션 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-black text-white italic tracking-tighter uppercase flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            Waiting List
          </h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            신규 가입 {pendingUsers.length}명 대기 중
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input 
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 w-full md:w-64 transition-all"
          />
          <button 
            onClick={fetchPendingUsers}
            className="p-2.5 bg-slate-800 rounded-xl hover:bg-slate-700 text-slate-400 transition-all"
          >
            🔄
          </button>
        </div>
      </div>

      {/* 리스트 섹션 */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 italic font-bold animate-pulse">Scanning database...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="py-20 text-center bg-slate-950/30 rounded-2xl border border-dashed border-slate-800">
          <p className="text-slate-500 text-sm font-bold italic">
            {searchTerm ? "검색 결과가 없습니다." : "대기 중인 가입자가 없습니다."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredUsers.map((u) => (
            <div key={u.id} className="group flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-950/80 p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all duration-300">
              {/* 유저 정보 */}
              <div className="flex items-center gap-4">
                <img 
                  src={u.photoURL || 'https://via.placeholder.com/40'} 
                  className="w-12 h-12 rounded-full border-2 border-slate-800 group-hover:border-emerald-500/50 transition-all" 
                  alt="" 
                />
                <div>
                  <div className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors">{u.displayName}</div>
                  <div className="text-[11px] text-slate-500 font-medium">{u.email}</div>
                </div>
              </div>

              {/* 액션 구역 */}
              <div className="flex flex-wrap items-center gap-3">
                <select 
                  id={`select-${u.id}`}
                  disabled={processingId === u.id}
                  className="flex-1 lg:flex-none bg-slate-900 text-[11px] font-bold border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:ring-1 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                >
                  <option value="">[신규 구단주] 로 승인 (매핑 없음)</option>
                  <optgroup label="--- 기존 구단주 기록 연결 ---">
                    {owners.map(o => (
                      <option key={o.nickname} value={o.nickname}>{o.nickname} 기록 연동</option>
                    ))}
                  </optgroup>
                </select>

                <div className="flex items-center gap-2">
                  <button 
                    disabled={processingId === u.id}
                    onClick={() => {
                      const select = document.getElementById(`select-${u.id}`) as HTMLSelectElement;
                      handleApprove(u.id, select.value, u.displayName);
                    }}
                    className="flex-1 lg:flex-none bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-[11px] font-black italic px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-900/20"
                  >
                    {processingId === u.id ? "승인 중..." : "APPROVE"}
                  </button>
                  <button 
                    disabled={processingId === u.id}
                    onClick={() => handleReject(u.id, u.displayName)}
                    className="p-2.5 bg-slate-900 hover:bg-red-950/30 text-slate-600 hover:text-red-500 border border-slate-800 rounded-xl transition-all"
                    title="거절 및 삭제"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 푸터 안내 */}
      <div className="mt-8 p-5 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
        <p className="text-[11px] text-slate-400 leading-relaxed font-bold">
          <span className="text-emerald-400 mr-1">TIPS:</span> 
          기존 오너를 선택하면 <span className="text-emerald-400">과거 기록이 매핑</span>되며, 선택하지 않고 승인하면 <span className="text-white">신규 구단주</span>로 처리되어 유저가 오너룸에서 직접 프로필을 세팅하게 됩니다. 
        </p>
      </div>
    </div>
  );
};