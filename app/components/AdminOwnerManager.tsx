import React, { useState } from 'react'; // 🔥 [수정] React import 추가
import { db } from '../firebase';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Owner } from '../types';

interface Props {
  owners: Owner[];
}

export const AdminOwnerManager = ({ owners }: Props) => {
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState('');
  // 🔥 [수정 1] 비밀번호 state 제거
  const [editId, setEditId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 초기화 함수
  const resetForm = () => {
    setName('');
    setPhoto('');
    // 🔥 [수정 1] 비밀번호 초기화 제거
    setEditId(null);
  };

  // 오너 등록 및 수정
  const handleSave = async () => {
    if (!name) return alert('닉네임을 입력하세요');
    setIsLoading(true);

    try {
      if (editId) {
        // 수정 모드
        const ownerRef = doc(db, 'users', editId);
        await updateDoc(ownerRef, { 
            nickname: name, 
            photo: photo
            // 🔥 [수정 1] 비밀번호 업데이트 제거
        });
        alert('수정되었습니다!');
      } else {
        // 신규 등록 모드
        await addDoc(collection(db, 'users'), {
          id: Date.now(),
          nickname: name,
          photo: photo,
          // 🔥 [수정 1] 비밀번호 필드 제거
          win: 0, draw: 0, loss: 0
        });
        alert('등록되었습니다!');
      }
      resetForm();
    } catch (e) {
      console.error(e);
      alert('저장 중 오류가 발생했습니다.\n(원인: DB 연결 문제 또는 컬렉션 이름 불일치)');
    } finally {
      setIsLoading(false);
    }
  };

  // 오너 삭제
  const handleDelete = async (docId?: string) => {
    if (!docId) return;

    const message = 
`정말 삭제하시겠습니까?

[주의사항]
해당 오너를 삭제할 경우:
1. 진행 중인 시즌의 팀 배정 정보가 사라질 수 있습니다.
2. 과거 경기 기록의 오너 정보가 'Unknown'으로 표시될 수 있습니다.

그래도 진행하시겠습니까?`;

    if (!confirm(message)) return;

    try {
      await deleteDoc(doc(db, 'users', docId));
      alert('삭제되었습니다.');
    } catch (e) {
      console.error(e);
      alert('삭제 실패');
    }
  };

  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        👑 오너 관리 <span className="text-xs text-slate-500 font-normal">(총 {owners.length}명)</span>
      </h2>

      {/* 입력 폼 */}
      <div className="flex flex-col gap-3 mb-6 bg-slate-950 p-4 rounded-xl border border-slate-800">
        {/* 🔥 [수정 1] grid-cols-3 -> grid-cols-2 로 변경 (비밀번호 입력창 제거로 인한 레이아웃 조정) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            placeholder="닉네임 (예: 킹갓제너럴)"
            className="bg-slate-900 border border-slate-700 p-2 rounded text-white"
          />
          <input 
            value={photo} 
            onChange={(e) => setPhoto(e.target.value)}
            placeholder="프로필 사진 URL"
            className="bg-slate-900 border border-slate-700 p-2 rounded text-white"
          />
           {/* 🔥 [수정 1] 비밀번호 입력 input 제거됨 */}
        </div>
        <div className="flex justify-end gap-2">
          {editId && <button onClick={resetForm} className="px-4 py-2 text-slate-400 hover:text-white">취소</button>}
          <button 
            onClick={handleSave} 
            disabled={isLoading}
            className={`px-6 py-2 rounded-lg font-bold transition-all ${editId ? 'bg-purple-600 hover:bg-purple-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
          >
            {isLoading ? '처리 중...' : (editId ? '수정 완료' : '신규 등록')}
          </button>
        </div>
      </div>

      {/* 오너 리스트 */}
      {/* 🔥 [수정 2] p-1 추가: hover 시 카드가 위로 올라갈 때(-translate-y-1) 컨테이너에 잘리는 현상 방지 */}
      <div className="grid grid-cols-3 md:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar p-1">
        {owners.map(o => (
          <div 
            key={o.id} 
            onClick={() => { 
                setEditId(o.docId || ''); 
                setName(o.nickname); 
                setPhoto(o.photo || ''); 
                // 🔥 [수정 1] setPassword 제거
            }}
            className={`relative p-4 rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer border transition-all hover:-translate-y-1 ${editId === o.docId ? 'bg-purple-900/30 border-purple-500' : 'bg-slate-950 border-slate-800 hover:border-emerald-500'}`}
          >
            <button 
              onClick={(e) => { e.stopPropagation(); handleDelete(o.docId); }}
              className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-slate-600 hover:text-red-500 hover:bg-red-900/30 transition-colors text-xs font-bold"
              title="삭제"
            >
              ✕
            </button>

            <img src={o.photo || 'https://via.placeholder.com/64'} className="w-16 h-16 rounded-full object-cover bg-black shadow-lg ring-2 ring-slate-800" alt="" />
            
            <div className="flex flex-col text-center w-full"> 
                <span className="font-bold text-white text-sm truncate w-full px-2">{o.nickname}</span>
                {/* 🔥 [수정 1] 비밀번호 표시 텍스트 제거 */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};