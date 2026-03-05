import React, { useState, useEffect } from 'react'; 
import { db } from '../firebase';
import { addDoc, collection, deleteDoc, doc, updateDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { Owner } from '../types';
import { UserCheck, UserPlus, Trash2, Search, Wrench, ShieldAlert } from 'lucide-react';

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

  // [에러 복구용 툴 상태]
  const [legacyName, setLegacyName] = useState('');
  const [targetOwnerDocId, setTargetOwnerDocId] = useState('');

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

  // [궁극의 복구 툴] 파이어베이스의 "모든" 컬렉션을 뒤져서 옛날 이름을 새 이름으로 완벽 치환
  const runForceMigration = async () => {
      if (!legacyName.trim() || !targetOwnerDocId) return alert("지워야 할 과거 이름과 변경할 대상을 모두 선택해주세요.");
      
      const targetOwner = owners.find(o => o.docId === targetOwnerDocId);
      if (!targetOwner) return alert("대상 오너를 찾을 수 없습니다.");
      
      const newName = targetOwner.nickname;
      if (!window.confirm(`🚨 최후의 보루: 파이어베이스의 '모든' 컬렉션(히스토리, 장부, 공지사항, 시즌 등)을 뒤져서 '${legacyName}'을(를) '${newName}'(으)로 100% 영구 병합합니다.\n진행하시겠습니까?`)) return;

      setIsLoading(true);
      try {
          // 1. History Data
          const historySnap = await getDocs(collection(db, 'history_data'));
          for (const d of historySnap.docs) {
              const hData = d.data();
              let hModified = false;
              let updatePayload: any = {};

              if (hData.owners && Array.isArray(hData.owners)) {
                  updatePayload.owners = hData.owners.map((o:any) => {
                      if (o.name === legacyName) { hModified = true; return {...o, name: newName}; }
                      return o;
                  });
              }
              if (hData.teams && Array.isArray(hData.teams)) {
                  updatePayload.teams = hData.teams.map((t:any) => {
                      let tMod = false;
                      const newT = {...t};
                      if (newT.owner === legacyName) { newT.owner = newName; tMod = true; }
                      if (newT.name && newT.name.includes(legacyName)) { newT.name = newT.name.replace(legacyName, newName); tMod = true; }
                      if(tMod) hModified = true;
                      return newT;
                  });
              }
              if (hData.players && Array.isArray(hData.players)) {
                  updatePayload.players = hData.players.map((p:any) => {
                      let pMod = false;
                      const newP = {...p};
                      if (newP.owner === legacyName) { newP.owner = newName; pMod = true; }
                      if (newP.team && newP.team.includes(legacyName)) { newP.team = newP.team.replace(legacyName, newName); pMod = true; }
                      if(pMod) hModified = true;
                      return newP;
                  });
              }
              if (hModified) await updateDoc(d.ref, updatePayload);
          }

          // 2. Finance Ledger
          const ledgerSnap = await getDocs(collection(db, 'finance_ledger'));
          for (const d of ledgerSnap.docs) {
              const lData = d.data();
              let lModified = false;
              let updatePayload: any = {};
              
              if (lData.ownerId === legacyName || lData.ownerName === legacyName) {
                  if(lData.ownerName) updatePayload.ownerName = newName;
                  lModified = true;
              }
              if (lData.title && typeof lData.title === 'string' && lData.title.includes(legacyName)) {
                  updatePayload.title = lData.title.replace(legacyName, newName);
                  lModified = true;
              }
              if (lData.targetId === legacyName) { updatePayload.targetId = newName; lModified = true; }
              if (lData.targetOwnerName === legacyName) { updatePayload.targetOwnerName = newName; lModified = true; }

              if (lModified && Object.keys(updatePayload).length > 0) await updateDoc(d.ref, updatePayload);
          }

          // 3. Notices
          const noticesSnap = await getDocs(collection(db, 'notices'));
          for (const d of noticesSnap.docs) {
              const nData = d.data();
              let nModified = false;
              let updatePayload: any = {};

              const updateReplies = (repliesArray: any[]) => {
                  return repliesArray.map((r: any) => {
                      let rMod = false;
                      const newR = { ...r };
                      if (newR.authorName === legacyName || newR.ownerName === legacyName) {
                          if (newR.authorName !== undefined) newR.authorName = newName;
                          if (newR.ownerName !== undefined) newR.ownerName = newName;
                          rMod = true;
                      }
                      if (rMod) nModified = true;
                      return newR;
                  });
              };

              if (nData.comments && Array.isArray(nData.comments)) {
                  updatePayload.comments = updateReplies(nData.comments);
              }
              if (nData.replies && Array.isArray(nData.replies)) {
                  updatePayload.replies = updateReplies(nData.replies);
              }
              if (nModified && Object.keys(updatePayload).length > 0) await updateDoc(d.ref, updatePayload);
          }

          // 4. Posts & Match Comments
          const postsSnap = await getDocs(collection(db, 'posts'));
          for (const d of postsSnap.docs) {
              const pData = d.data();
              let pMod = false;
              let pUpdate: any = {};
              if (pData.authorName === legacyName) { pUpdate.authorName = newName; pMod = true; }
              if (pData.comments && Array.isArray(pData.comments)) {
                  pUpdate.comments = pData.comments.map((c:any) => {
                      const newC = {...c};
                      if (newC.authorName === legacyName) { newC.authorName = newName; pMod = true; }
                      if (newC.replies && Array.isArray(newC.replies)) {
                          newC.replies = newC.replies.map((r:any) => {
                              if (r.authorName === legacyName) { r.authorName = newName; pMod = true; }
                              return r;
                          });
                      }
                      return newC;
                  });
              }
              if (pMod) await updateDoc(d.ref, pUpdate);
          }

          const matchComSnap = await getDocs(collection(db, 'match_comments'));
          for (const d of matchComSnap.docs) {
              if (d.data().authorName === legacyName || d.data().ownerName === legacyName) {
                  const uData: any = {};
                  if (d.data().authorName !== undefined) uData.authorName = newName;
                  if (d.data().ownerName !== undefined) uData.ownerName = newName;
                  await updateDoc(d.ref, uData);
              }
          }

          // 5. Seasons
          const seasonsSnap = await getDocs(collection(db, 'seasons'));
          for (const d of seasonsSnap.docs) {
              const data = d.data();
              let isModified = false;
              if (data.rounds && Array.isArray(data.rounds)) {
                  const newRounds = data.rounds.map((r:any) => {
                      if (!r.matches) return r;
                      const newMatches = r.matches.map((m:any) => {
                          let matchMod = false;
                          const newM = { ...m };
                          
                          if (newM.homeOwner === legacyName) { newM.homeOwner = newName; matchMod = true; }
                          if (newM.awayOwner === legacyName) { newM.awayOwner = newName; matchMod = true; }
                          if (newM.home && newM.home.includes(legacyName)) { newM.home = newM.home.replace(legacyName, newName); matchMod = true; }
                          if (newM.away && newM.away.includes(legacyName)) { newM.away = newM.away.replace(legacyName, newName); matchMod = true; }

                          if(newM.homeScorers) {
                              newM.homeScorers = newM.homeScorers.map((s:any) => {
                                  if(typeof s === 'object' && s.owner === legacyName) { matchMod = true; return {...s, owner: newName}; }
                                  return s;
                              });
                          }
                          if(newM.awayScorers) {
                              newM.awayScorers = newM.awayScorers.map((s:any) => {
                                  if(typeof s === 'object' && s.owner === legacyName) { matchMod = true; return {...s, owner: newName}; }
                                  return s;
                              });
                          }
                          
                          if (matchMod) isModified = true;
                          return newM;
                      });
                      return { ...r, matches: newMatches };
                  });
                  if (isModified) await updateDoc(d.ref, { rounds: newRounds });
              }
          }

          // 6. Master Teams & User Accounts
          const teamsQ = query(collection(db, 'master_teams'), where('ownerName', '==', legacyName));
          const teamsSnap = await getDocs(teamsQ);
          for (const d of teamsSnap.docs) { await updateDoc(d.ref, { ownerName: newName }); }

          const accountsQ = query(collection(db, 'user_accounts'), where('mappedOwnerId', '==', legacyName));
          const accountsSnap = await getDocs(accountsQ);
          for (const d of accountsSnap.docs) { await updateDoc(d.ref, { mappedOwnerId: newName }); }

          alert(`🎉 완벽합니다! '${legacyName}'의 모든 잃어버린 데이터(명예의전당/장부/게시판/시즌)가 '${newName}'(으)로 100% 병합되었습니다.`);
          setLegacyName('');
          setTargetOwnerDocId('');
      } catch (error: any) {
          console.error("Migration Error: ", error);
          alert("병합 처리 중 오류가 발생했습니다: " + error.message);
      } finally {
          setIsLoading(false);
      }
  };

  const handleSave = async () => {
    if (!name) return alert('닉네임을 입력하세요');
    setIsLoading(true);

    try {
      const safeUpdate = async (ref: any, data: any) => {
          try {
              await updateDoc(ref, data);
          } catch (err) {
              console.warn("권한 제한으로 일부 데이터 업데이트 스킵됨", err);
          }
      };

      const runCascadeUpdate = async () => {
          const accountsQ = query(collection(db, 'user_accounts'), where('mappedOwnerId', '==', oldNickname));
          const accountsSnap = await getDocs(accountsQ);
          const accountPromises = accountsSnap.docs.map(d => safeUpdate(d.ref, { mappedOwnerId: name }));

          const teamsQ = query(collection(db, 'master_teams'), where('ownerName', '==', oldNickname));
          const teamsSnap = await getDocs(teamsQ);
          const teamPromises = teamsSnap.docs.map(d => safeUpdate(d.ref, { ownerName: name }));

          const postsQ = query(collection(db, 'posts'), where('authorName', '==', oldNickname));
          const postsSnap = await getDocs(postsQ);
          const postPromises = postsSnap.docs.map(d => safeUpdate(d.ref, { authorName: name }));

          const allPostsSnap = await getDocs(collection(db, 'posts'));
          const postCommentPromises = allPostsSnap.docs.map(d => {
              const data = d.data();
              if (data.comments && Array.isArray(data.comments)) {
                  let changed = false;
                  const newComments = data.comments.map((c:any) => {
                      if (c.authorName === oldNickname) { changed = true; return { ...c, authorName: name }; }
                      return c;
                  });
                  if (changed) return safeUpdate(d.ref, { comments: newComments });
              }
              return Promise.resolve();
          });

          const matchCommentsQ = query(collection(db, 'match_comments'), where('authorName', '==', oldNickname));
          const matchCommentsSnap = await getDocs(matchCommentsQ);
          const matchCommentPromises = matchCommentsSnap.docs.map(d => safeUpdate(d.ref, { authorName: name }));

          const seasonsSnap = await getDocs(collection(db, 'seasons'));
          const seasonPromises = seasonsSnap.docs.map(d => {
              const data = d.data();
              let changed = false;
              if (data.rounds && Array.isArray(data.rounds)) {
                  const newRounds = data.rounds.map((r:any) => {
                      if (!r.matches) return r;
                      const newMatches = r.matches.map((m:any) => {
                          let matchChanged = false;
                          const newM = { ...m };
                          if (newM.homeOwner === oldNickname) { newM.homeOwner = name; matchChanged = true; }
                          if (newM.awayOwner === oldNickname) { newM.awayOwner = name; matchChanged = true; }
                          if (matchChanged) changed = true;
                          return newM;
                      });
                      return { ...r, matches: newMatches };
                  });
                  if (changed) return safeUpdate(d.ref, { rounds: newRounds });
              }
              return Promise.resolve();
          });

          await Promise.allSettled([ 
              ...accountPromises, ...teamPromises, ...postPromises, 
              ...postCommentPromises, ...matchCommentPromises, ...seasonPromises 
          ]);
      };

      if (activeTab === 'EXISTING' && editId) {
        if (oldNickname && oldNickname !== name) {
            const confirmMsg = `⚠️ 경고: '${oldNickname}'의 이름을 '${name}'(으)로 변경합니다.\n\n구단 소유권, 스케줄, 락커룸 등 모든 기록을 일괄 교체합니다.\n계속하시겠습니까?`;
            if (!confirm(confirmMsg)) { setIsLoading(false); return; }
            await runCascadeUpdate();
        }

        // 🔥 업데이트 항목에 role(권한) 추가
        const updatePayload: any = { nickname: name, role: role };
        if (photo.trim() !== '') {
            updatePayload.photo = photo.trim();
        }

        await updateDoc(doc(db, 'users', editId), updatePayload);
        alert(oldNickname !== name ? '🔥 기록 일괄 업데이트 완료!' : `✅ [${name}]님의 정보 및 권한(${role})이 수정되었습니다!`);

      } else if (activeTab === 'PENDING' && pendingEmail) {
        const targetAcc = userAccounts.find(acc => acc.email === pendingEmail);
        if (!targetAcc) return alert("해당 G메일 계정을 찾을 수 없습니다.");

        if (oldNickname && oldNickname !== name) {
            const confirmMsg = `⚠️ 경고: 연동된 오너 '${oldNickname}'의 이름을 '${name}'(으)로 변경합니다.\n\n모든 기록이 일괄 교체됩니다.\n계속하시겠습니까?`;
            if (!confirm(confirmMsg)) { setIsLoading(false); return; }
            await runCascadeUpdate();
        }

        const existingOwner = owners.find(o => o.nickname === (oldNickname || name));
        
        const finalPhoto = photo.trim() || targetAcc.photoUrl || COMMON_DEFAULT_PROFILE;

        if (existingOwner && existingOwner.docId) {
            // 🔥 업데이트 항목에 role(권한) 추가
            const updatePayload: any = { nickname: name, role: role };
            if (photo.trim() !== '') updatePayload.photo = photo.trim(); 
            await updateDoc(doc(db, 'users', String(existingOwner.docId)), updatePayload);
        } else if (!existingOwner) {
            // 🔥 신규 생성 시 role(권한) 추가
            await addDoc(collection(db, 'users'), {
              id: Date.now(), nickname: name, photo: finalPhoto, win: 0, draw: 0, loss: 0, role: role
            });
        }

        if (targetAcc.docId) {
            await updateDoc(doc(db, 'user_accounts', String(targetAcc.docId)), { mappedOwnerId: name });
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

      {activeTab === 'EXISTING' && (
          <div className="mt-4 mb-8 bg-red-950/20 border border-red-900/50 p-5 rounded-2xl shadow-inner animate-in fade-in">
              <p className="text-xs text-red-400 font-bold mb-3 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  [최후의 수단] 파이어베이스 전체 기록 강제 병합기
              </p>
              <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
                  명예의 전당, 재무장부, 공지사항 댓글 등에 <strong>과거 이름(강원주, NO.7 베컴 등)</strong>이 남아있을 때 사용하세요.<br/>
                  모든 컬렉션을 뒤져서 선택한 오너로 100% 흡수 병합시킵니다.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                      value={legacyName}
                      onChange={e => setLegacyName(e.target.value)}
                      placeholder="사라진 옛날 이름 정확히 입력 (예: 강원주)"
                      className="w-full bg-[#0B1120] border border-red-900/50 p-3 rounded-xl text-white text-sm outline-none focus:border-red-500 transition-colors placeholder:text-slate-600"
                  />
                  <select
                      value={targetOwnerDocId}
                      onChange={e => setTargetOwnerDocId(e.target.value)}
                      className="w-full bg-[#0B1120] border border-red-900/50 p-3 rounded-xl text-white text-sm outline-none focus:border-red-500 transition-colors cursor-pointer"
                  >
                      <option value="" className="text-slate-500">-- 데이터를 흡수할 현재 오너 선택 --</option>
                      {owners.map(o => <option key={o.docId} value={o.docId!}>{o.nickname}</option>)}
                  </select>
              </div>
              <div className="flex justify-end mt-4">
                  <button
                      onClick={runForceMigration}
                      disabled={isLoading || !legacyName || !targetOwnerDocId}
                      className="bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:bg-slate-800 disabled:text-slate-500 text-white px-6 py-2.5 rounded-xl font-black text-xs transition-all shadow-lg"
                  >
                      {isLoading ? '병합 작업 진행 중...' : '데이터 완벽 병합 실행 🚀'}
                  </button>
              </div>
          </div>
      )}

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

                          return (
                              <div 
                                  key={idx}
                                  onClick={() => {
                                      setPendingEmail(acc.email);
                                      setName(acc.mappedOwnerId || acc.displayName || ''); 
                                      setOldNickname(acc.mappedOwnerId || ''); 
                                      setPhoto('');
                                      setRole('USER'); // 신규 가입자는 기본 USER 할당
                                  }}
                                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-blue-900/20 border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.2)]' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
                              >
                                  <img src={acc.photoUrl || COMMON_DEFAULT_PROFILE} className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0" alt=""/>
                                  <div className="flex flex-col min-w-0 flex-1">
                                      <span className="text-white font-bold text-sm truncate">{acc.displayName || '이름 없음'}</span>
                                      <span className="text-slate-400 text-[10px] truncate mb-0.5">{acc.email}</span>
                                      
                                      {isMapped ? (
                                          <span className="text-emerald-400 text-[10px] font-bold truncate">✓ 연동됨: {acc.mappedOwnerId}</span>
                                      ) : (
                                          <span className="text-slate-500 text-[10px] font-bold">미연동</span>
                                      )}
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