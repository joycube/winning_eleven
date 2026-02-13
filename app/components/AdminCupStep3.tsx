/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { TeamCard } from './TeamCard';
import { CupEntry, FALLBACK_IMG } from '../types';

interface AdminCupStep3Props {
    waitingPool: CupEntry[];
    bracket: (CupEntry | null)[];
    
    // 핸들러
    onDragStart: (e: React.DragEvent, entry: CupEntry) => void; // void 추가 (타입 명시)
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, idx: number) => void;
    onSlotClick: (idx: number) => void;
    onAutoMatch: () => void;
    onRandomMatch: () => void;
    onCreateSchedule: () => void;
}

export const AdminCupStep3 = ({
    waitingPool, bracket,
    onDragStart, onDragOver, onDrop, onSlotClick,
    onAutoMatch, onRandomMatch, onCreateSchedule
}: AdminCupStep3Props) => {

    return (
        <div className="bg-[#0b0e14] p-6 rounded-[2.5rem] border border-slate-800 relative">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-slate-800 pb-4 gap-4">
                <h3 className="text-white font-black italic uppercase tracking-tighter text-xl">Step 3. Tournament Bracket Setup</h3>
                <div className="flex gap-2">
                    <button onClick={onAutoMatch} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black italic text-xs shadow-lg hover:bg-indigo-500 transition-all">⚡ AUTO (A1 vs B2)</button>
                    <button onClick={onRandomMatch} className="px-4 py-2 bg-purple-600 text-white rounded-xl font-black italic text-xs shadow-lg hover:bg-purple-500 transition-all">🎲 RANDOM SHUFFLE</button>
                </div>
            </div>

            {/* 토너먼트 대기실 */}
            <div className="mb-6 bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Qualified Teams Inventory ({waitingPool.length})</span>
                    <span className="text-[10px] text-slate-500 italic">Drag team to bracket slot</span>
                </div>
                
                {waitingPool.length === 0 ? (
                    <div className="text-center py-4 text-slate-600 text-xs italic">조별리그 통과팀이 대기실에 없습니다.</div>
                ) : (
                    // 🔥 TeamCard 사용 + 반응형 그리드
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {waitingPool.map(t => (
                            <TeamCard key={t.id} team={t} draggable={true} onDragStart={(e) => onDragStart(e, t)} /> // 여기서 t는 setDraggedTournamentEntry로 전달됨
                        ))}
                    </div>
                )}
            </div>

            {/* 토너먼트 대진표 드롭존 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-800 hidden md:block opacity-20"></div>
                {Array.from({ length: bracket.length / 2 }).map((_, mIdx) => (
                    <div key={mIdx} className="space-y-4 bg-slate-900/20 p-5 rounded-3xl border border-slate-800/50">
                        <div className="text-[9px] text-slate-600 font-black mb-1 italic tracking-widest uppercase">{bracket.length === 8 ? 'Quarter-Final' : 'Semi-Final'} Match {mIdx + 1}</div>
                        {[mIdx * 2, mIdx * 2 + 1].map((slotIdx) => (
                            <div key={slotIdx} onDragOver={onDragOver} onDrop={(e) => onDrop(e, slotIdx)} onClick={() => onSlotClick(slotIdx)} className={`relative h-16 rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all group ${bracket[slotIdx] ? 'border-emerald-500/30 bg-emerald-900/10 hover:border-red-500/50 hover:bg-red-950/20' : 'border-slate-800 bg-black/20 hover:border-indigo-500/50 hover:bg-slate-800'}`}>
                                {bracket[slotIdx] ? (
                                    <div className="flex items-center gap-4 w-full px-5">
                                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1.5 shadow-md"><img src={bracket[slotIdx]?.logo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /></div>
                                        <div className="flex flex-col flex-1"><span className="text-xs font-black text-white italic">{bracket[slotIdx]?.name}</span><span className="text-[9px] text-emerald-400 font-bold uppercase">{bracket[slotIdx]?.ownerName}</span></div>
                                        <span className="text-[8px] text-slate-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">REMOVE ✕</span>
                                    </div>
                                ) : (
                                    <div className="text-slate-700 group-hover:text-indigo-500 transition-colors flex items-center gap-2"><span className="text-lg font-black">+</span><span className="text-[9px] font-black italic">DROP TEAM HERE</span></div>
                                )}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 flex justify-center">
                <button onClick={onCreateSchedule} className="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black italic rounded-2xl shadow-2xl text-lg transition-transform active:scale-95 flex items-center gap-3"><span>⚔️</span> GENERATE TOURNAMENT BRACKET</button>
            </div>
        </div>
    );
};