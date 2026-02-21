import React from 'react';

// 🔥 FINANCE 추가 및 타입 정비
type ViewType = 'RANKING' | 'SCHEDULE' | 'HISTORY' | 'FINANCE' | 'ADMIN' | 'TUTORIAL';

interface NavTabsProps {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
}

// 🔥 export const 확인!
export const NavTabs = ({ currentView, setCurrentView }: NavTabsProps) => {
  // 🔥 TUTORIAL을 빼고 FINANCE를 추가하여 핵심 5개 메뉴 구성
  const tabs: ViewType[] = ['RANKING', 'SCHEDULE', 'HISTORY', 'FINANCE', 'ADMIN'];

  return (
    // 🔥 relative 속성을 추가하여 튜토리얼 아이콘의 기준점을 잡아줌
    <div className="max-w-6xl mx-auto px-4 mt-6 mb-8 relative">
      
      {/* 🔥 튜토리얼 아이콘 (메뉴영역 맨우측 상단, 박스 없음, 공간 최소화) */}
      <button 
        onClick={() => setCurrentView('TUTORIAL')} 
        className={`absolute -top-5 right-4 z-10 flex items-center justify-center transition-all hover:scale-110 ${
          currentView === 'TUTORIAL' 
            ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]' 
            : 'text-slate-500 opacity-60 hover:opacity-100'
        }`}
        title="TUTORIAL"
      >
        <span className="text-sm md:text-base">ℹ️</span>
      </button>

      {/* 메인 5개 탭 (기존 5열 그리드 유지, 꽉 채움) */}
      <div className="grid grid-cols-5 gap-1.5 md:gap-2">
        {tabs.map(t => (
          <button 
            key={t} 
            onClick={() => setCurrentView(t)} 
            className={`h-14 md:h-16 rounded-xl border border-slate-800 flex flex-col items-center justify-center transition-all active:scale-95 shadow-lg overflow-hidden ${
              currentView === t 
                ? 'bg-gradient-to-br from-emerald-900 to-slate-900 border-emerald-500 text-emerald-400' 
                : 'bg-slate-950 text-slate-500 hover:bg-slate-900 hover:text-slate-300'
            }`}
          >
            {/* 모바일에서 텍스트가 깨지지 않게 폰트 사이즈 미세 조정 */}
            <span className="text-[9px] sm:text-[10px] md:text-xs font-black tracking-widest truncate px-1 w-full text-center">
              {t}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};