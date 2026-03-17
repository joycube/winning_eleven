"use client";

/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { Owner, MasterTeam, FALLBACK_IMG } from '../types'; 
import { getTierBadgeColor } from '../utils/helpers'; 
import { QuickDraftModal } from './QuickDraftModal'; 

interface Props {
    state: any; 
    owners: Owner[];
    masterTeams: MasterTeam[];
}

export const AdminMatching_Step1_TeamSelect = ({ state, owners, masterTeams }: Props) => {
    const {
        hasSchedule, isRolling, isFlipping, randomResult,
        filterCategory, filterLeague, filterTier, searchTeam,
        selectedOwnerId, selectedMasterTeamDocId, isDraftOpen,
        displaySortedLeagues, availableTeams,
        setFilterCategory, setFilterLeague, setFilterTier, setSearchTeam,
        setSelectedOwnerId, setSelectedMasterTeamDocId, setIsDraftOpen, setRandomResult, setIsFlipping,
        handleRandom, handleAddTeam, handleDraftApply
    } = state;

    return (
        <div className={`bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-4 relative ${isRolling || isFlipping ? 'z-[55]' : ''}`}>
            <h3 className="text-white font-bold text-sm border-b border-slate-800 pb-2">Step 1. 팀 & 오너 매칭</h3>

            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-3 rounded-xl border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-3 mb-2">
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="text-white font-black italic flex items-center gap-2 text-sm">
                        <span className="text-yellow-400">⚡</span> 퀵 팀매칭 (Quick Match)
                        <span className="text-[9px] bg-yellow-500 text-black px-1.5 rounded font-black tracking-tighter">HOT</span>
                    </div>
                    <p className="text-sm text-white mt-1 font-bold">✨ 지금 자동으로 팀을 추천 받으세요 ✨</p>
                </div>
                <button onClick={() => { if (hasSchedule) return alert("🚫 스케줄이 생성된 상태에서는 실행할 수 없습니다.\n[Step 2]에서 스케줄을 먼저 삭제해주세요."); setIsDraftOpen(true); }} disabled={hasSchedule} className={`h-10 px-6 bg-indigo-600 text-white font-black italic rounded-lg shadow-lg text-xs tracking-tighter transition-all flex items-center justify-center gap-2 ${hasSchedule ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-500 hover:scale-105 active:scale-95'}`}><span>⚡</span> 퀵 매칭 시작</button>
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-bold">1. Select Owner (Manual)</label>
                <select value={selectedOwnerId} onChange={e => setSelectedOwnerId(e.target.value)} disabled={isRolling} className="bg-slate-950 p-3 rounded border border-slate-700 text-white w-full text-sm font-bold">
                    <option value="">👤 Select Owner</option>
                    {owners.map(o => <option key={o.id} value={o.uid || o.docId || String(o.id)}>{o.nickname}</option>)}
                </select>
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] text-slate-500 font-bold">2. Search Options (Manual)</label>
                    <button onClick={handleRandom} disabled={isRolling || hasSchedule} className={`h-10 px-6 rounded-lg text-xs font-black italic tracking-tighter text-white shadow-lg border border-purple-500 flex items-center justify-center gap-2 transition-all ${isRolling || hasSchedule ? 'bg-purple-900 cursor-not-allowed opacity-50' : 'bg-purple-700 hover:bg-purple-600 active:scale-95 hover:shadow-purple-500/50'}`}>{isRolling ? <span className="animate-spin text-lg">🎰</span> : <span className="text-lg">🎲</span>} {isRolling ? 'OPENING...' : '랜덤 매칭 시작'}</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} disabled={isRolling} className="bg-black p-2 rounded border border-slate-700 text-slate-300 text-xs font-bold"><option value="ALL">All Categories</option><option value="CLUB">Club</option><option value="NATIONAL">National</option></select>
                    <select value={filterLeague} onChange={e => setFilterLeague(e.target.value)} disabled={isRolling} className="bg-black p-2 rounded border border-slate-700 text-slate-300 text-xs font-bold"><option value="">All Leagues</option>{displaySortedLeagues.map((l:any) => <option key={l.id} value={l.name}>{l.name}</option>)}</select>
                    
                    {/* 🔥 [D 등급 추가] 랜덤/수동 매칭 필터에 D Tier 옵션 추가 */}
                    <select value={filterTier} onChange={e => setFilterTier(e.target.value)} disabled={isRolling} className="bg-black p-2 rounded border border-slate-700 text-slate-300 text-xs font-bold">
                        <option value="ALL">All Tiers</option>
                        <option value="S">S Tier</option>
                        <option value="A">A Tier</option>
                        <option value="B">B Tier</option>
                        <option value="C">C Tier</option>
                        <option value="D">D Tier</option>
                    </select>

                    <input type="text" value={searchTeam} onChange={e => setSearchTeam(e.target.value)} disabled={isRolling} placeholder="🔍 Name..." className="bg-black p-2 rounded border border-slate-700 text-white text-xs font-bold" />
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-center"><label className="text-[10px] text-slate-500 font-bold">3. Pack Result</label>{!isRolling && (filterLeague || randomResult) && <button onClick={() => { setFilterLeague(''); setRandomResult(null); setIsFlipping(false); }} className="text-[10px] text-slate-400 border border-slate-700 px-2 rounded hover:text-white font-bold">↩ Back to Leagues</button>}</div>
                {randomResult ? (
                    <div className="flex justify-center py-8 relative" style={{ perspective: '1000px' }}>
                        {isFlipping && <div className="blast-circle" />}
                        <div className={`relative p-6 rounded-[2rem] border-4 flex flex-col items-center gap-4 transition-all duration-500 min-w-[240px] ${isFlipping ? 'fc-card-reveal' : ''} ${randomResult.tier === 'S' ? 'bg-gradient-to-b from-yellow-600/30 to slate-900 border-yellow-500 fc-gold-glow' : 'bg-slate-900 border-emerald-500'} ${isRolling ? 'blur-md scale-90 grayscale opacity-60' : 'scale-100 opacity-100'}`}>
                            <div className={`absolute -top-4 text-white text-xs font-black italic tracking-tighter px-4 py-1.5 rounded-full shadow-2xl transition-all ${isRolling ? 'bg-purple-600 animate-pulse' : 'bg-gradient-to-r from-emerald-600 to-teal-600'}`}>{isRolling ? '🎰 SHUFFLING PACK...' : '🏆 PACK OPENED!'}</div>
                            <div className={`w-32 h-32 bg-white rounded-full flex items-center justify-center p-4 shadow-2xl relative z-10 ${randomResult.tier === 'S' ? 'ring-4 ring-yellow-400/50' : 'ring-4 ring-emerald-400/30'}`}><img src={randomResult.logo} className={`w-full h-full object-contain ${isRolling ? 'animate-bounce' : ''}`} alt="" onError={(e: any) => e.target.src = FALLBACK_IMG} /></div>
                            <div className="text-center relative z-10"><p className="text-2xl font-black italic tracking-tighter text-white uppercase leading-none">{randomResult.name}</p><div className="flex items-center justify-center gap-2 mt-2"><span className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest">{randomResult.region}</span><span className={`text-xs px-3 py-0.5 rounded-full font-black italic ${getTierBadgeColor(randomResult.tier)} shadow-lg`}>{randomResult.tier} TIER</span></div></div>
                            {randomResult.tier === 'S' && !isRolling && <div className="absolute inset-0 bg-yellow-400/10 blur-[60px] rounded-full -z-10 animate-pulse"></div>}
                        </div>
                    </div>
                ) : (
                    !filterLeague && !searchTeam ? (
                        <div className="space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar p-1">
                            {(filterCategory === 'ALL' || filterCategory === 'CLUB') && (<div><p className="text-[10px] text-emerald-500 font-black italic mb-2 ml-1 border-l-4 border-emerald-500 pl-2 uppercase tracking-tighter">Club Leagues</p><div className="grid grid-cols-3 gap-3">{displaySortedLeagues.filter((l:any)=>l.category==='CLUB').map((l:any) => { const count = masterTeams.filter(t => t.region === l.name).length; return (<div key={l.id} onClick={() => setFilterLeague(l.name)} className="bg-slate-900 p-3 rounded-2xl border border-slate-800 cursor-pointer hover:border-emerald-500 flex flex-col items-center gap-2 group transition-all hover:bg-slate-800 shadow-xl"><div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-2 shadow-inner"><img src={l.logo} className="w-full h-full object-contain" alt="" /></div><div className="text-center w-full"><p className="text-[10px] text-white font-black italic group-hover:text-emerald-400 truncate w-full tracking-tighter uppercase">{l.name}</p><p className="text-[9px] text-slate-500 font-bold">{count} Teams</p></div></div>); })}</div></div>)}
                            {(filterCategory === 'ALL' || filterCategory === 'NATIONAL') && (<div><p className="text-[10px] text-blue-500 font-black italic mb-2 ml-1 border-l-4 border-blue-500 pl-2 uppercase tracking-tighter">National Teams</p><div className="grid grid-cols-3 gap-3">{displaySortedLeagues.filter((l:any)=>l.category==='NATIONAL').map((l:any) => { const count = masterTeams.filter(t => t.region === l.name).length; return (<div key={l.id} onClick={() => setFilterLeague(l.name)} className="bg-slate-900 p-3 rounded-2xl border border-slate-800 cursor-pointer hover:border-blue-500 flex flex-col items-center gap-2 group transition-all hover:bg-slate-800 shadow-xl"><div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-2 shadow-inner"><img src={l.logo} className="w-full h-full object-contain" alt="" /></div><div className="text-center w-full"><p className="text-[10px] text-white font-black italic group-hover:text-blue-400 truncate w-full tracking-tighter uppercase">{l.name}</p><p className="text-[9px] text-slate-500 font-bold">{count} Teams</p></div></div>); })}</div></div>)}
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar p-1">
                            {availableTeams.map((t:any) => { 
                                const isSelected = selectedMasterTeamDocId === (t.docId || String(t.id)); 
                                return (
                                    <div id={`team-card-${t.id}`} key={t.id} onClick={() => setSelectedMasterTeamDocId(t.docId || String(t.id))} className={`relative bg-slate-900 p-3 rounded-2xl border flex flex-col items-center cursor-pointer group transition-all ${isSelected ? 'border-emerald-500 ring-2 ring-emerald-500 bg-emerald-900/10' : 'border-slate-800 hover:border-slate-600'}`}>
                                        <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center overflow-hidden shadow-2xl p-2 mb-2">
                                            <img src={t.logo} className="w-full h-full object-contain" alt="" onError={(e: any) => e.target.src = FALLBACK_IMG} />
                                        </div>
                                        <span className="text-[10px] text-center text-slate-300 w-full truncate font-black italic tracking-tighter group-hover:text-white uppercase">{t.name}</span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-full mt-1 font-black italic ${getTierBadgeColor(t.tier)}`}>{t.tier}</span>
                                    </div>
                                ); 
                            })}
                        </div>
                    )
                )}
            </div>

            <button onClick={handleAddTeam} disabled={isRolling || hasSchedule} className={`w-full py-4 font-black italic tracking-tighter rounded-2xl shadow-2xl text-sm transition-all ${isRolling || hasSchedule ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white uppercase active:scale-95'}`}>{hasSchedule ? '🔒 SCHEDULE GENERATED (LOCKED)' : (isRolling ? 'PACK OPENING...' : '✅ SIGN THIS TEAM TO SEASON')}</button>
            
            <QuickDraftModal isOpen={isDraftOpen} onClose={() => setIsDraftOpen(false)} owners={owners} masterTeams={masterTeams} onConfirm={handleDraftApply} />
        </div>
    );
};