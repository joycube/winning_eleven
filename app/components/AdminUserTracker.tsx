"use client";

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Owner } from '../types';

interface AdminUserTrackerProps {
  owners: Owner[];
}

export const AdminUserTracker = ({ owners }: AdminUserTrackerProps) => {
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // 1. 대기 유저 가져오기
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

  // 2. 통합 승인 처리 (신규 가입자 & 과거 기록 매핑 - 100% FM UID 뼈대 구축)
  const handleApprove = async (user: any, selectedLegacyName: string) => {
    const userUid = user.id;
    setProcessingId(userUid);
    
    try {
      // 분기 1: 신규 가입자 승인 (과거 기록 매핑 안 함)
      if (!selectedLegacyName) {
        if (!confirm(`[신규 가입] '${user.displayName}' 님을 새로운 구단주로 승인하시겠습니까?\n\n승인 즉시 고유 UID 기반으로 오너 명부가 생성됩니다.`)) {
          setProcessingId(null);
          return;
        }
      } 
      // 분기 2: 기존 오너 매핑 (과거 기록 연결)
      else {
        if (!confirm(`[기존 기록 연결] 구글 계정(${user.displayName})에 과거 '${selectedLegacyName}'의 모든 기록을 귀속시키겠습니까?\n\n이후부터 이 계정의 본체(Key)는 UID로 동작합니다.`)) {
          setProcessingId(null);
          return;
        }
      }

      // 🔥 [100% FM 픽스] user_accounts(로그인)와 users(명부)를 동시에 업데이트하기 위해 Batch 사용
      const batch = writeBatch(db);
      
      const userAccountRef = doc(db, 'user_accounts', userUid);
      const ownerListRef = doc(db, 'users', userUid); // 🔥 [핵심] 문서 ID 자체가 구글 UID가 됨!

      // A. 로그인 계정 권한 승격
      batch.update(userAccountRef, {
        role: 'MEMBER',
        uid: userUid, 
        mappedOwnerId: selectedLegacyName || user.displayName, // 매핑값이 없으면 본인 닉네임 사용
        approvedAt: new Date().toISOString()
      });

      // B. 실제 앱에서 쓰일 오너 명부(users) 객체 생성
      // 기존에 선택된 오너의 정보(이미지 등)가 있다면 가져오고, 없으면 구글 프로필 사용
      const legacyOwnerData = owners.find(o => o.nickname === selectedLegacyName);
      
      batch.set(ownerListRef, {
        id: Date.now(), // 정렬용 보조 숫자 ID
        uid: userUid,   // 완벽한 뼈대!
        nickname: selectedLegacyName || user.displayName, // 기본 노출 이름
        legacyName: selectedLegacyName || null, // 🔥 과거 스냅샷과 연결할 생명줄 (호환성 유지용)
        photo: legacyOwnerData?.photo || user.photoURL || '',
        email: user.email,
        createdAt: new Date().toISOString()
      }, { merge: true }); // 이미 문서가 있다면 덮어쓰기(병합)
      
      // 트랜잭션 실행
      await batch.commit();
      
      setPendingUsers(prev => prev.filter(u => u.id !== userUid));
      alert('✅ 승인 및 명부 생성 처리가 완벽히 완료되었습니다!');
    } catch (e: any) {
      console.error(e);
      alert(`🚨 승인 실패 (파이어베이스 규칙을 확인하세요): ${e.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // 3. 거절(삭제) 처리
  const handleReject = async (userUid: string, name: string) => {
    if (!confirm(`[경고] ${name}님의 가입 신청을 거절하고 데이터베이스에서 완전히 삭제하시겠습니까?`)) return;

    setProcessingId(userUid);
    try {
      await deleteDoc(doc(db, 'user_accounts', userUid));
      setPendingUsers(prev => prev.filter(u => u.id !== userUid));
      alert('🗑️ 성공적으로 삭제되었습니다.');
    } catch (e: any) {
      console.error(e);
      alert(`🚨 삭제 실패: ${e.message}`);
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
              <div className="flex items-center gap-4">
                <img 
                  src={u.photoURL || 'https://via.placeholder.com/40'} 
                  className="w-12 h-12 rounded-full border-2 border-slate-800 group-hover:border-emerald-500/50 transition-all" 
                  alt="" 
                />
                <div>
                  <div className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors">{u.displayName}</div>
                  <div className="text-[11px] text-slate-500 font-medium">{u.email}</div>
                  <div className="text-[9px] text-slate-600 font-mono mt-0.5">UID: {u.id}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select 
                  id={`select-${u.id}`}
                  disabled={processingId === u.id}
                  className="flex-1 lg:flex-none bg-slate-900 text-[11px] font-bold border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:ring-1 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                >
                  <option value="">[신규 구단주] 로 승인 (과거 기록 없음)</option>
                  <optgroup label="--- 기존 구단주 기록 흡수 ---">
                    {owners.map(o => (
                      <option key={o.nickname} value={o.nickname}>{o.nickname}님의 과거 기록 연결</option>
                    ))}
                  </optgroup>
                </select>

                <div className="flex items-center gap-2">
                  <button 
                    disabled={processingId === u.id}
                    onClick={() => {
                      const select = document.getElementById(`select-${u.id}`) as HTMLSelectElement;
                      handleApprove(u, select.value); // 전체 객체를 전달하도록 수정
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

      <div className="mt-8 p-5 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
        <p className="text-[11px] text-slate-400 leading-relaxed font-bold">
          <span className="text-emerald-400 mr-1">TIPS:</span> 
          승인 시 유저의 고유 <span className="text-white font-mono">구글 UID</span>가 오너 명부(users)의 고유 식별자로 지정됩니다. 기존 오너를 매핑하면 과거 텍스트 이름이 UID에 종속되어 영구적으로 기록이 보존됩니다.
        </p>
      </div>
    </div>
  );
};