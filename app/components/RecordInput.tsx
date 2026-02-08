import React from 'react';

// ✅ 데이터 구조에 맞는 타입 정의
export interface RecordItem {
  id: number;
  name: string;
  count: number | string;
}

interface RecordInputProps {
  type: string;
  inputValue: { name: string, count: string };
  onInputChange: (type: string, field: string, value: string) => void;
  onAdd: (type: string) => void;
  onRemove: (type: string, id: number) => void;
  records: RecordItem[]; // any[] -> RecordItem[] 으로 구체화
  label: string;
  colorClass: string;
  datalistId: string;
}

export const RecordInput = ({ 
  type, 
  inputValue, 
  onInputChange, 
  onAdd, 
  onRemove, 
  records, 
  label, 
  colorClass, 
  datalistId 
}: RecordInputProps) => {

  // ✅ 엔터키 입력 시 추가 기능
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.nativeEvent.isComposing === false) { 
      // isComposing 체크: 한글 입력 중 엔터 두 번 눌림 방지
      e.preventDefault();
      onAdd(type);
    }
  };

  // 버튼 색상 스타일 로직 분리 (가독성 향상)
  const buttonStyle = colorClass.includes('emerald') 
    ? 'bg-emerald-900/50 text-emerald-400 hover:bg-emerald-900' 
    : 'bg-blue-900/50 text-blue-400 hover:bg-blue-900';

  return (
    <div className="space-y-2">
      <label className={`text-xs font-bold ${colorClass}`}>
        {label}
      </label>
      
      <div className="flex gap-1">
        <input 
          list={datalistId}
          value={inputValue.name} 
          onChange={(e) => onInputChange(type, 'name', e.target.value)} 
          onKeyDown={handleKeyDown} // 엔터키 이벤트 연결
          placeholder="Player Name" 
          className="bg-black border border-slate-700 p-2 rounded flex-1 text-white text-xs focus:border-slate-500 outline-none transition-colors"
        />
        <input 
          type="number" 
          min="1" // 최소값 설정
          value={inputValue.count} 
          onChange={(e) => onInputChange(type, 'count', e.target.value)}
          onKeyDown={handleKeyDown} // 엔터키 이벤트 연결
          className="bg-black border border-slate-700 p-2 rounded w-12 text-center text-white text-xs focus:border-slate-500 outline-none transition-colors appearance-none"
        />
        <button 
          type="button" // form submit 방지
          onClick={() => onAdd(type)} 
          className={`px-3 rounded font-bold text-xs transition-colors ${buttonStyle}`}
        >
          +
        </button>
      </div>

      <div className="space-y-1">
        {records.length > 0 && records.map((r) => (
          <div key={r.id} className="flex justify-between items-center bg-slate-900 px-2 py-1 rounded border border-slate-800 animate-in fade-in duration-300">
            <span className="text-white text-[10px]">
              {r.name} {Number(r.count) > 1 && <span className="text-slate-400">({r.count})</span>}
            </span>
            <button 
              type="button"
              onClick={() => onRemove(type, r.id)} 
              className="text-slate-600 hover:text-red-500 font-bold text-[12px] px-1 transition-colors"
              aria-label="Remove record"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};