import { useState } from 'react';
import { db } from '../firebase';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Owner } from '../types';

interface Props {
  owners: Owner[];
}

export const AdminOwnerManager = ({ owners }: Props) => {
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState('');
  const [password, setPassword] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 초기화 함수
  const resetForm = () => {
    setName('');
    setPhoto('');
    setPassword('');
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
            photo: photo,
            password: password 
        });
        alert('수정되었습니다!');
      } else {
        // 신규 등록 모드
        await addDoc(collection(db, 'users'), {
          id: Date.now(),
          nickname: name,
          photo: photo,
          password: password,
          win: 0, draw: 0, loss: 0
        });
        alert('등록되었습니다!');
      }
      resetForm();
      // 🔥 [수정] 새로고침 코드 삭제 (탭 유지됨)
      // window.location.reload(); 
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
      // 🔥 [수정] 새로고침 코드 삭제 (탭 유지됨)
      // window.location.reload();
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
           <input 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 (선택)"
            className="bg-slate-900 border border-slate-700 p-2 rounded text-white"
          />
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
      <div className="grid grid-cols-2 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar">
        {owners.map(o => (
          <div 
            key={o.id} 
            onClick={() => { 
                setEditId(o.docId || ''); 
                setName(o.nickname); 
                setPhoto(o.photo || ''); 
                setPassword(o.password || '');
            }}
            className={`relative p-3 rounded-xl flex items-center gap-3 cursor-pointer border transition-colors ${editId === o.docId ? 'bg-purple-900/30 border-purple-500' : 'bg-slate-950 border-slate-800 hover:border-emerald-500'}`}
          >
            <img src={o.photo || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full object-cover bg-black" alt="" />
            <div className="flex flex-col pr-6"> 
                <span className="font-bold text-white truncate">{o.nickname}</span>
                {o.password && <span className="text-[10px] text-slate-500">pw: {o.password}</span>}
            </div>
            
            <button 
              onClick={(e) => { e.stopPropagation(); handleDelete(o.docId); }}
              className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full text-slate-600 hover:text-red-500 hover:bg-red-900/30 transition-colors text-xs font-bold"
              title="삭제"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};