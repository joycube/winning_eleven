import React from 'react';

// 🔥 NOTICE 추가 및 타입 정비
type ViewType = 'RANKING' | 'SCHEDULE' | 'HISTORY' | 'FINANCE' | 'ADMIN' | 'TUTORIAL' | 'NOTICE';

interface NavTabsProps {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
}

export const NavTabs = ({ currentView, setCurrentView }: NavTabsProps) => {
  // 🔥 NOTICE를 추가하여 총 6개 메뉴 구성 (공지사항을 맨 앞에 배치)
  const tabs: ViewType[] = ['NOTICE', 'RANKING', 'SCHEDULE', 'HISTORY', 'FINANCE', 'ADMIN'];

  return (
    <div className="max-w-6xl mx-auto px-4 mt-6 mb-8 relative">
      
      {/* 튜토리얼 아이콘 (메뉴영역 맨우측 상단, 박스 없음, 공간 최소화) */}
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

      {/* 메인 6개 탭 (모바일에선 3칸씩 2줄, PC에선 6칸 1줄로 깨짐 방지) */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 md:gap-2">
        {tabs.map(t => (
          <button 
            key={t} 
            onClick={() => setCurrentView(t)} 
            className={`h-12 sm:h-14 md:h-16 rounded-xl border border-slate-800 flex flex-col items-center justify-center transition-all active:scale-95 shadow-lg overflow-hidden ${
              currentView === t 
                ? 'bg-gradient-to-br from-emerald-900 to-slate-900 border-emerald-500 text-emerald-400' 
                : 'bg-slate-950 text-slate-500 hover:bg-slate-900 hover:text-slate-300'
            }`}
          >
            <span className="text-[10px] sm:text-[10px] md:text-xs font-black tracking-widest truncate px-1 w-full text-center">
              {t}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};