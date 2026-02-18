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

    // 🔥 [수정] 줄터네 이슈 해결을 위한 렌더링 안전장치
    // bracket 길이에 맞춰 매치 수를 계산 (8강이면 4경기, 4강이면 2경기)
    const matchCount = Math.floor(bracket.length / 2);
    const matches = Array.from({ length: matchCount });

    return (
        <div className={`bg-[#0b0e14] p-6 rounded-[2.5rem] border relative transition-all duration-300 ${isLocked ? 'border-slate-800 bg-[#05070a]' : 'border-slate-800'}`}>
            
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

            <div className={`mb-6 p-4 rounded-2xl border transition-all duration-300 ${isLocked ? 'bg-black/40 border-slate-800/50 opacity-40 grayscale pointer-events-none' : 'bg-slate-900/50 border-slate-700/50'}`}>
                <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Qualified Teams Inventory ({waitingPool.length})</span>
                    {!isLocked && <span className="text-[10px] text-slate-500 italic">Drag team to bracket slot</span>}
                </div>
                
                {waitingPool.length === 0 ? (
                    <div className="text-center py-4 text-slate-600 text-xs italic">조별리그 통과팀이 대기실에 없습니다.</div>
                ) : (
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {waitingPool.map(t => (
                            <TeamCard 
                                key={t.id} 
                                team={t} 
                                draggable={!isLocked} 
                                onDragStart={(e) => !isLocked && onDragStart(e, t)} 
                                size="mini" // 리스트에서는 작게 표시
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* 🔥 [수정] 줄터네 이슈(배열 인덱스 오류) 방지를 위한 렌더링 로직 개선 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8 relative">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-800 hidden md:block opacity-20"></div>
                
                {matches.map((_, mIdx) => {
                    const slot1 = mIdx * 2;
                    const slot2 = mIdx * 2 + 1;
                    const team1 = bracket[slot1];
                    const team2 = bracket[slot2];

                    return (
                        <div key={mIdx} className={`space-y-3 p-4 rounded-3xl border transition-all ${isLocked ? 'bg-black/20 border-slate-800/30' : 'bg-slate-900/20 border-slate-800/50'}`}>
                            <div className="text-[9px] text-slate-600 font-black mb-1 italic tracking-widest uppercase">
                                {bracket.length === 8 ? 'Quarter-Final' : 'Semi-Final'} Match {mIdx + 1}
                            </div>
                            
                            {/* 첫 번째 슬롯 (Home) */}
                            <div 
                                onDragOver={isLocked ? undefined : onDragOver} 
                                onDrop={(e) => !isLocked && onDrop(e, slot1)} 
                                onClick={() => !isLocked && onSlotClick(slot1)} 
                                className={`relative h-14 rounded-xl border flex items-center justify-center transition-all group ${
                                    isLocked 
                                    ? 'border-slate-800/50 bg-black/20 cursor-default'
                                    : team1 
                                        ? 'border-emerald-500/30 bg-emerald-900/10 hover:border-red-500/50 hover:bg-red-950/20 cursor-pointer' 
                                        : 'border-slate-800 bg-black/20 hover:border-indigo-500/50 hover:bg-slate-800 border-dashed cursor-pointer'
                                }`}
                            >
                                {team1 ? (
                                    <div className="flex items-center gap-3 w-full px-4 overflow-hidden">
                                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center p-1 shadow-md shrink-0">
                                            <img src={team1.logo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                                        </div>
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className={`text-[10px] font-black italic truncate ${isLocked ? 'text-slate-500' : 'text-white'}`}>{team1.name}</span>
                                            <span className="text-[8px] text-emerald-600 font-bold uppercase truncate">{team1.ownerName}</span>
                                        </div>
                                        {!isLocked && <span className="text-[8px] text-slate-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</span>}
                                    </div>
                                ) : (
                                    <span className={`text-[9px] font-black italic tracking-widest ${isLocked ? 'text-slate-800' : 'text-slate-700 group-hover:text-indigo-500'}`}>
                                        {isLocked ? 'BYE (PASS)' : '+ DROP TEAM'}
                                    </span>
                                )}
                            </div>

                            {/* VS 구분선 */}
                            <div className="flex justify-center items-center h-4 relative">
                                <div className="absolute w-full h-px bg-slate-800/30"></div>
                                <span className="relative bg-[#0b0e14] px-2 text-[8px] font-black text-slate-700 italic">VS</span>
                            </div>

                            {/* 두 번째 슬롯 (Away) */}
                            <div 
                                onDragOver={isLocked ? undefined : onDragOver} 
                                onDrop={(e) => !isLocked && onDrop(e, slot2)} 
                                onClick={() => !isLocked && onSlotClick(slot2)} 
                                className={`relative h-14 rounded-xl border flex items-center justify-center transition-all group ${
                                    isLocked 
                                    ? 'border-slate-800/50 bg-black/20 cursor-default'
                                    : team2
                                        ? 'border-emerald-500/30 bg-emerald-900/10 hover:border-red-500/50 hover:bg-red-950/20 cursor-pointer' 
                                        : 'border-slate-800 bg-black/20 hover:border-indigo-500/50 hover:bg-slate-800 border-dashed cursor-pointer'
                                }`}
                            >
                                {team2 ? (
                                    <div className="flex items-center gap-3 w-full px-4 overflow-hidden">
                                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center p-1 shadow-md shrink-0">
                                            <img src={team2.logo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                                        </div>
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className={`text-[10px] font-black italic truncate ${isLocked ? 'text-slate-500' : 'text-white'}`}>{team2.name}</span>
                                            <span className="text-[8px] text-emerald-600 font-bold uppercase truncate">{team2.ownerName}</span>
                                        </div>
                                        {!isLocked && <span className="text-[8px] text-slate-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</span>}
                                    </div>
                                ) : (
                                    <span className={`text-[9px] font-black italic tracking-widest ${isLocked ? 'text-slate-800' : 'text-slate-700 group-hover:text-indigo-500'}`}>
                                        {isLocked ? 'BYE (PASS)' : '+ DROP TEAM'}
                                    </span>
                                )}
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