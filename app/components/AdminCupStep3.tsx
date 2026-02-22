/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { TeamCard } from './TeamCard';
import { CupEntry, FALLBACK_IMG } from '../types';

interface AdminCupStep3Props {
    waitingPool: CupEntry[];
    bracket: (CupEntry | null)[];
    isLocked?: boolean; 
    
    // 핸들러
    onDragStart: (e: React.DragEvent, entry: CupEntry) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, idx: number) => void;
    onSlotClick: (idx: number) => void;
    onAutoMatch: () => void;
    onRandomMatch: () => void;
    onCreateSchedule: () => void;
}

export const AdminCupStep3 = ({
    waitingPool, bracket, isLocked = false, 
    onDragStart, onDragOver, onDrop, onSlotClick,
    onAutoMatch, onRandomMatch, onCreateSchedule
}: AdminCupStep3Props) => {

    const handleLockedAction = (action: () => void) => {
        if (isLocked) {
            alert("🔒 토너먼트 대진이 이미 확정되었습니다.\n수정을 원하시면 먼저 초기화(RESET)를 진행해주세요.");
            return;
        }
        action();
    };

    const matchCount = Math.floor(bracket.length / 2);
    const matches = Array.from({ length: matchCount });

    return (
        <div className={`bg-[#0b0e14] p-4 md:p-6 rounded-[2.5rem] border relative transition-all duration-300 ${isLocked ? 'border-slate-800 bg-[#05070a]' : 'border-slate-800'}`}>
            
            {/* 헤더 섹션 */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-slate-800 pb-4 gap-4">
                <div className="flex items-center gap-3">
                    <h3 className="text-white font-black italic uppercase tracking-tighter text-xl">Step 3. Tournament Bracket Setup</h3>
                    {isLocked && (
                        <div className="flex items-center gap-1 bg-red-900/30 border border-red-500/30 px-3 py-1 rounded-full">
                            <span className="text-sm">🔒</span>
                            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">LOCKED</span>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => handleLockedAction(onAutoMatch)} 
                        className={`px-4 py-2 rounded-xl font-black italic text-xs shadow-lg transition-all ${isLocked ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95'}`}
                    >
                        ⚡ AUTO (A1 vs B2)
                    </button>
                    <button 
                        onClick={() => handleLockedAction(onRandomMatch)} 
                        className={`px-4 py-2 rounded-xl font-black italic text-xs shadow-lg transition-all ${isLocked ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-500 active:scale-95'}`}
                    >
                        🎲 RANDOM SHUFFLE
                    </button>
                </div>
            </div>

            {/* 토너먼트 대기실 */}
            <div className={`mb-6 p-4 rounded-2xl border transition-all duration-300 ${isLocked ? 'bg-black/40 border-slate-800/50 opacity-40 grayscale pointer-events-none' : 'bg-slate-900/50 border-slate-700/50'}`}>
                <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Qualified Teams Inventory ({waitingPool.length})</span>
                    {!isLocked && <span className="text-[10px] text-slate-500 italic">Drag team to bracket slot</span>}
                </div>
                
                {waitingPool.length === 0 ? (
                    <div className="text-center py-4 text-slate-600 text-xs italic">조별리그 통과팀이 대기실에 없습니다.</div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 max-h-[350px] overflow-y-auto custom-scrollbar p-1">
                        {waitingPool.map(t => (
                            <TeamCard 
                                key={t.id} 
                                team={t} 
                                draggable={!isLocked} 
                                onDragStart={(e) => !isLocked && onDragStart(e, t)} 
                                size="small" 
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* 🔥 토너먼트 대진표 보드 (Step 2와 동일한 정사각형 카드 레이아웃으로 변경) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 relative">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-800 hidden lg:block opacity-20"></div>
                
                {matches.map((_, mIdx) => {
                    const slot1 = mIdx * 2;
                    const slot2 = mIdx * 2 + 1;
                    const team1 = bracket[slot1];
                    const team2 = bracket[slot2];

                    return (
                        <div key={mIdx} className={`relative flex flex-col p-4 sm:p-5 rounded-3xl border transition-all ${isLocked ? 'bg-black/20 border-slate-800/30' : 'bg-slate-900/20 border-slate-800/50'}`}>
                            
                            <div className="text-center mb-4 border-b border-slate-800/50 pb-2">
                                <span className="text-[10px] text-emerald-500 font-black italic tracking-widest uppercase">
                                    {bracket.length === 8 ? 'Quarter-Final' : 'Semi-Final'} Match {mIdx + 1}
                                </span>
                            </div>
                            
                            {/* 🔥 grid-cols-2를 사용해서 Step2 조별리그 슬롯과 완벽하게 똑같은 구조 적용 */}
                            <div className="grid grid-cols-2 gap-3 sm:gap-4 relative items-center">
                                
                                {/* VS Divider */}
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                                    <div className="bg-[#0b0e14] px-2 py-1 rounded-md border border-slate-700 text-[9px] font-black text-slate-500 italic shadow-lg">VS</div>
                                </div>

                                {[
                                    { idx: slot1, team: team1 },
                                    { idx: slot2, team: team2 }
                                ].map(({ idx, team }) => (
                                    <div 
                                        key={idx}
                                        onDragOver={isLocked ? undefined : onDragOver} 
                                        onDrop={(e) => !isLocked && onDrop(e, idx)} 
                                        onClick={() => !isLocked && onSlotClick(idx)} 
                                        // 🔥 Step 2 슬롯 클래스 그대로 복사 (최소 높이, 보더 등)
                                        className={`relative min-h-[96px] sm:min-h-[110px] rounded-xl border-2 flex flex-col items-center justify-center transition-all group overflow-hidden ${
                                            isLocked 
                                            ? 'border-slate-800/50 bg-black/20 cursor-default'
                                            : team 
                                                ? 'border-emerald-500/30 bg-emerald-900/10 hover:border-red-500/50 hover:bg-red-900/10 cursor-pointer border-dashed' 
                                                : 'border-slate-700 bg-slate-900/30 hover:border-yellow-500/50 hover:bg-slate-800 border-dashed cursor-pointer'
                                        }`}
                                    >
                                        {team ? (
                                            <div className="w-full h-full">
                                                {/* 🔥 TeamCard 통째로 삽입 */}
                                                <TeamCard 
                                                    team={team} 
                                                    size="small" 
                                                    className={`w-full h-full border-none shadow-none bg-transparent flex items-center justify-center ${isLocked ? 'grayscale opacity-80' : ''}`}
                                                />
                                                {!isLocked && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] z-30">
                                                        <span className="text-red-400 font-black text-xs">REMOVE ✕</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className={`flex flex-col items-center transition-colors ${isLocked ? 'text-slate-700' : 'text-slate-600 group-hover:text-yellow-500'}`}>
                                                <span className="text-xl font-black">{isLocked ? '-' : '+'}</span>
                                                <span className="text-[9px] font-bold">{isLocked ? 'EMPTY' : 'ADD TEAM'}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                        </div>
                    );
                })}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 flex justify-center">
                {isLocked ? (
                    <div className="px-10 py-5 bg-slate-900 text-slate-500 font-black italic rounded-2xl border border-slate-800 flex items-center gap-3 cursor-not-allowed select-none">
                        <span>🔒</span> TOURNAMENT SCHEDULE FIXED
                    </div>
                ) : (
                    <button onClick={onCreateSchedule} className="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black italic rounded-2xl shadow-2xl text-lg transition-transform active:scale-95 flex items-center gap-3"><span>⚔️</span> GENERATE TOURNAMENT BRACKET</button>
                )}
            </div>
        </div>
    );
};