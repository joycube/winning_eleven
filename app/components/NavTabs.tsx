import React from 'react';

type ViewType = 'RANKING' | 'SCHEDULE' | 'HISTORY' | 'FINANCE' | 'ADMIN' | 'TUTORIAL' | 'NOTICE';

interface NavTabsProps {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  // 🔥 [픽스] page.tsx에서 넘겨주는 hasNewNotice 속성을 받을 수 있도록 타입 추가!
  hasNewNotice?: boolean; 
}

export const NavTabs = ({ currentView, setCurrentView, hasNewNotice }: NavTabsProps) => {
  const tabs: ViewType[] = ['NOTICE', 'RANKING', 'SCHEDULE', 'HISTORY', 'FINANCE', 'ADMIN'];

  return (
    <div className="max-w-6xl mx-auto px-4 mt-6 mb-8 relative">
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
            {/* 🔥 N 뱃지 마크 적용 로직 */}
            <span className="relative text-[10px] sm:text-[10px] md:text-xs font-black tracking-widest truncate px-1 w-full text-center">
              {t}
              {t === 'NOTICE' && hasNewNotice && (
                <span className="absolute -top-2 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-[#020617]"></span>
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};