import React, { useState, useEffect } from 'react'; 
import { db } from '../firebase';
import { addDoc, collection, deleteDoc, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { Owner } from '../types';
import { UserCheck, UserPlus, Trash2, Search, ShieldAlert } from 'lucide-react';

const COMMON_DEFAULT_PROFILE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2364748b'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

interface Props {
  owners: Owner[];
}

export const AdminOwnerManager = ({ owners }: Props) => {
  const [activeTab, setActiveTab] = useState<'EXISTING' | 'PENDING'>('EXISTING');
  
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState('');
  // 🔥 [핵심 추가] 권한(role) 상태 관리
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER'); 
  const [editId, setEditId] = useState<string | null>(null);
  const [oldNickname, setOldNickname] = useState('');
  const [pendingEmail, setPendingEmail] = useState<string | null>(null); 
  
  const [isLoading, setIsLoading] = useState(false);
  const [userAccounts, setUserAccounts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUserAccounts = async () => {
      try {
          const snap = await getDocs(collection(db, 'user_accounts'));
          setUserAccounts(snap.docs.map(d => ({ docId: d.id, ...d.data() })));
      } catch (error) {
          console.error("유저 계정 로드 실패:", error);
      }
  };

  useEffect(() => {
      fetchUserAccounts();
  }, []);

  const resetForm = () => {
    setName('');
    setPhoto('');
    setRole('USER');
    setEditId(null);
    setOldNickname('');
    setPendingEmail(null);
  };

  useEffect(() => {
      resetForm();
  }, [activeTab]);

  const handleSave = async () => {
    if (!name) return alert('닉네임을 입력하세요');
    setIsLoading(true);

    try {
      if (activeTab === 'EXISTING' && editId) {
        // 🔥 정보 및 권한 업데이트 (안전한 명부 업데이트만 수행)
        const updatePayload: any = { nickname: name, role: role };
        if (photo.trim() !== '') {
            updatePayload.photo = photo.trim();
        }

        // 로그인 계정의 연동 이름 및 권한 업데이트
        const targetAcc = userAccounts.find(acc => acc.mappedOwnerId === oldNickname);
        if (targetAcc && targetAcc.docId) {
             await updateDoc(doc(db, 'user_accounts', String(targetAcc.docId)), { 
                 mappedOwnerId: name,
                 role: role // 🔥 명부(users)의 권한과 로그인 계정(user_accounts)의 권한 동기화
             });
        }

        await updateDoc(doc(db, 'users', editId), updatePayload);
        alert(`✅ [${name}]님의 정보 및 권한(${role})이 안전하게 수정되었습니다!\n(과거 기록은 UID 기반으로 자동 연동 유지됨)`);

      } else if (activeTab === 'PENDING' && pendingEmail) {
        const targetAcc = userAccounts.find(acc => acc.email === pendingEmail);
        if (!targetAcc) return alert("해당 G메일 계정을 찾을 수 없습니다.");

        const existingOwner = owners.find(o => o.nickname === (oldNickname || name));
        const finalPhoto = photo.trim() || targetAcc.photoUrl || COMMON_DEFAULT_PROFILE;

        if (existingOwner && existingOwner.docId) {
            // 🔥 기존 오너 정보 업데이트
            const updatePayload: any = { nickname: name, role: role };
            if (photo.trim() !== '') updatePayload.photo = photo.trim(); 
            await updateDoc(doc(db, 'users', String(existingOwner.docId)), updatePayload);
        } else if (!existingOwner) {
            // 🔥 신규 오너 생성
            await addDoc(collection(db, 'users'), {
              id: Date.now(), nickname: name, photo: finalPhoto, win: 0, draw: 0, loss: 0, role: role
            });
        }

        // 🔥 로그인 계정에 연동된 닉네임 업데이트 및 PENDING -> USER/ADMIN 상태 변경
        if (targetAcc.docId) {
            await updateDoc(doc(db, 'user_accounts', String(targetAcc.docId)), { 
                mappedOwnerId: name,
                role: role // 🔥 이 코드가 추가되어 PENDING 상태를 벗어납니다!
            });
        }
        
        alert(`✅ [${name}] 구단주 연동 및 권한 처리가 완료되었습니다!`);
      }
      
      await fetchUserAccounts(); 
      resetForm();
    } catch (e) {
      console.error(e);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (docId?: string) => {
    if (!docId) return;
    if (!confirm("정말 삭제하시겠습니까?\n진행 중인 스케줄이나 구단 소유권에 문제가 생길 수 있습니다.")) return;
    try {
      await deleteDoc(doc(db, 'users', docId));
      alert('삭제되었습니다.');
    } catch (e) { alert('삭제 실패'); }
  };

  const filteredOwners = owners.filter(o => 
      o.nickname.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredAccounts = userAccounts.filter(acc => 
      (acc.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (acc.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (acc.mappedOwnerId || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-2xl">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h2 className="text-xl font-bold flex items-center gap-2">
            👑 오너 & 권한 관리
          </h2>
          
          <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
              <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="이름, 닉네임, G메일 검색..." 
                  className="w-full bg-slate-950 border border-slate-700 py-2 pl-9 pr-3 rounded-lg text-white text-xs sm:text-sm outline-none focus:border-emerald-500 transition-colors shadow-inner"
              />
          </div>
      </div>

      <div className="flex bg-[#0B1120] rounded-xl p-1.5 border border-slate-800 mb-6">
          <button 
              onClick={() => setActiveTab('EXISTING')}
              className={`flex-1 py-3 text-xs sm:text-sm font-black rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'EXISTING' ? 'bg-slate-800 text-emerald-400 shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
          >
              <UserCheck size={16} /> 명부 관리 ({filteredOwners.length})
          </button>
          <button 
              onClick={() => setActiveTab('PENDING')}
              className={`flex-1 py-3 text-xs sm:text-sm font-black rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'PENDING' ? 'bg-blue-900/30 text-blue-400 shadow-md border border-blue-500/30' : 'text-slate-500 hover:text-slate-300'}`}
          >
              <UserPlus size={16} /> G메일 가입자 ({filteredAccounts.length})
          </button>
      </div>

      <div className={`flex flex-col gap-4 mb-6 p-4 sm:p-5 rounded-xl border shadow-inner ${activeTab === 'PENDING' ? 'bg-blue-950/20 border-blue-900/30' : 'bg-slate-950 border-slate-800'}`}>
        
        <div className="mb-1 border-b border-slate-800/50 pb-2">
            {activeTab === 'EXISTING' ? (
                <p className="text-[11px] text-slate-400 font-bold">👇 유저 선택 후 닉네임/프사/권한을 변경하세요.</p>
            ) : (
                <p className="text-[11px] text-blue-400 font-bold">👇 연동할 G메일 유저를 아래에서 선택하세요.</p>
            )}
        </div>

        {activeTab === 'PENDING' && pendingEmail && (
            <div className="bg-blue-900/40 text-blue-300 text-[11px] sm:text-xs font-black p-2.5 rounded-lg border border-blue-500/50 flex flex-wrap items-center gap-2">
                <span>📧 선택된 G메일:</span>
                <span className="tracking-wider">{pendingEmail}</span>
            </div>
        )}
        {activeTab === 'EXISTING' && editId && (
            <div className="bg-slate-800 text-slate-300 text-[11px] sm:text-xs font-black p-2.5 rounded-lg border border-slate-700 flex flex-wrap items-center gap-2">
                <span>👤 수정 대상:</span>
                <span className="text-emerald-400">{oldNickname}</span>
                <span className="text-[10px] text-slate-500 font-normal ml-1">
                    ({userAccounts.find(a => a.mappedOwnerId === oldNickname)?.email || '미연동'})
                </span>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            placeholder="부여할 닉네임 (예: 킹갓제너럴)"
            disabled={activeTab === 'PENDING' && !pendingEmail}
            className="w-full bg-[#0B1120] border border-slate-700 p-3 rounded-xl text-white text-sm outline-none focus:border-emerald-500 disabled:opacity-50 transition-colors"
          />
          <input 
            value={photo} 
            onChange={(e) => setPhoto(e.target.value)}
            placeholder="프로필 사진 URL (빈칸 시 유지)"
            disabled={activeTab === 'PENDING' && !pendingEmail}
            className="w-full bg-[#0B1120] border border-slate-700 p-3 rounded-xl text-white text-sm outline-none focus:border-emerald-500 disabled:opacity-50 transition-colors"
          />
          {/* 🔥 권한 설정 드롭다운 (Admin일 경우 빨간색으로 시인성 강화) */}
          <div className="relative">
              <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'USER' | 'ADMIN')}
                  disabled={activeTab === 'PENDING' && !pendingEmail}
                  className={`w-full p-3 pr-10 rounded-xl text-sm font-bold outline-none disabled:opacity-50 transition-all appearance-none cursor-pointer shadow-inner ${role === 'ADMIN' ? 'bg-red-950/20 border border-red-900/50 text-red-400 focus:border-red-500' : 'bg-[#0B1120] border border-slate-700 text-slate-300 focus:border-emerald-500'}`}
              >
                  <option value="USER" className="bg-slate-900 text-white">👤 일반 오너 (USER)</option>
                  <option value="ADMIN" className="bg-red-900 text-white">👑 최고 관리자 (ADMIN)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                  ▼
              </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-1">
          {(editId || pendingEmail) && (
              <button onClick={resetForm} className="px-5 py-2.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors">
                  취소
              </button>
          )}
          <button 
            onClick={handleSave} 
            disabled={isLoading || (!editId && !pendingEmail)}
            className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all text-white disabled:opacity-50 flex items-center gap-1.5 ${activeTab === 'PENDING' ? 'bg-blue-600 hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_15px_rgba(52,211,153,0.4)]'}`}
          >
            {isLoading ? '처리 중...' : (activeTab === 'PENDING' ? '연동 및 설정 저장' : <><ShieldAlert size={16}/> 설정 저장</>)}
          </button>
        </div>
      </div>

      <div className="bg-[#0B1120] p-4 rounded-xl border border-slate-800/80 shadow-inner min-h-[200px]">
          
          {activeTab === 'EXISTING' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[500px] overflow-y-auto no-scrollbar">
                {filteredOwners.length === 0 && <div className="col-span-full py-10 text-center text-slate-500 text-sm font-bold">검색 결과가 없습니다.</div>}
                {filteredOwners.map(o => {
                  const linkedAccount = userAccounts.find(acc => acc.mappedOwnerId === o.nickname);
                  const isSelected = editId === o.docId;
                  const isAdmin = (o as any).role === 'ADMIN';

                  return (
                    <div 
                        key={o.id} 
                        onClick={() => { 
                            setEditId(o.docId || ''); 
                            setName(o.nickname); 
                            setOldNickname(o.nickname); 
                            setPhoto(''); 
                            setRole(isAdmin ? 'ADMIN' : 'USER'); // 🔥 클릭 시 해당 유저의 권한을 폼에 세팅
                        }}
                        className={`relative p-3 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer border transition-all hover:-translate-y-1 bg-slate-900 ${isSelected ? 'border-emerald-500 shadow-[0_0_15px_rgba(52,211,153,0.2)]' : isAdmin ? 'border-red-900/40 shadow-inner hover:border-red-500/50' : 'border-slate-800 hover:border-slate-600'}`}
                    >
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(o.docId); }} className="absolute top-2 right-2 text-slate-600 hover:text-red-500 transition-colors" title="삭제"><Trash2 size={14} /></button>
                        
                        <div className="relative">
                            <img src={o.photo || 'https://via.placeholder.com/64'} className={`w-14 h-14 rounded-full object-cover bg-black shadow-md border ${isAdmin ? 'border-red-500' : 'border-slate-700'}`} alt="" />
                            {/* 🔥 최고 관리자일 경우 왕관 뱃지 표시 */}
                            {isAdmin && <span className="absolute -bottom-1 -right-1 bg-red-600 text-[10px] rounded-full w-5 h-5 flex items-center justify-center border border-slate-900 shadow-lg" title="최고 관리자">👑</span>}
                        </div>

                        <div className="flex flex-col items-center w-full min-w-0 mt-1"> 
                            <span className={`font-black text-sm truncate w-full text-center ${isAdmin ? 'text-red-400' : 'text-white'}`}>{o.nickname}</span>
                            
                            {linkedAccount ? (
                                <span className="text-[9px] text-emerald-400 truncate w-full text-center mt-0.5 font-bold">{linkedAccount.email}</span>
                            ) : (
                                <span className="text-[9px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded mt-0.5">미연동</span>
                            )}
                        </div>
                    </div>
                  )
                })}
              </div>
          )}

          {activeTab === 'PENDING' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto no-scrollbar">
                  {filteredAccounts.length === 0 ? (
                      <div className="col-span-full py-10 text-center text-slate-500 font-bold text-sm">
                          조건에 맞는 G메일 유저가 없습니다.
                      </div>
                  ) : (
                      filteredAccounts.map((acc, idx) => {
                          const isSelected = pendingEmail === acc.email;
                          const isMapped = !!acc.mappedOwnerId;
                          // 🔥 UI에 배지 표시용
                          const currentRole = acc.role === 'ADMIN' ? '👑 ADMIN' : acc.role === 'USER' ? '👤 USER' : '⏳ PENDING';

                          return (
                              <div 
                                  key={idx}
                                  onClick={() => {
                                      setPendingEmail(acc.email);
                                      setName(acc.mappedOwnerId || acc.displayName || ''); 
                                      setOldNickname(acc.mappedOwnerId || ''); 
                                      setPhoto('');
                                      // 기존 권한이 있으면 가져오고 없으면 기본값 USER 세팅
                                      setRole(acc.role === 'ADMIN' ? 'ADMIN' : 'USER'); 
                                  }}
                                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-blue-900/20 border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.2)]' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
                              >
                                  <img src={acc.photoUrl || COMMON_DEFAULT_PROFILE} className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0" alt=""/>
                                  <div className="flex flex-col min-w-0 flex-1">
                                      <span className="text-white font-bold text-sm truncate">{acc.displayName || '이름 없음'}</span>
                                      <span className="text-slate-400 text-[10px] truncate mb-0.5">{acc.email}</span>
                                      
                                      <div className="flex gap-1.5 items-center mt-1">
                                        {isMapped ? (
                                            <span className="text-emerald-400 text-[10px] font-bold truncate border border-emerald-900 bg-emerald-950/30 px-1.5 py-0.5 rounded">✓ {acc.mappedOwnerId}</span>
                                        ) : (
                                            <span className="text-slate-500 text-[10px] font-bold border border-slate-700 bg-slate-800 px-1.5 py-0.5 rounded">미연동</span>
                                        )}
                                        {/* 상태 배지 노출 */}
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black border ${acc.role === 'ADMIN' ? 'bg-red-900/50 text-red-400 border-red-900' : acc.role === 'USER' ? 'bg-blue-900/50 text-blue-400 border-blue-900' : 'bg-yellow-900/30 text-yellow-500 border-yellow-900/50'}`}>
                                            {currentRole}
                                        </span>
                                      </div>
                                  </div>
                                  <div className="shrink-0">
                                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>선택</span>
                                  </div>
                              </div>
                          )
                      })
                  )}
              </div>
          )}
      </div>
    </div>
  );
};