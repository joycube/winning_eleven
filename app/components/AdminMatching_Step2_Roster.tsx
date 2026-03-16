"use client";

import React from 'react';
import { Season, MasterTeam, Owner } from '../types'; // 경로 수정됨
import { TeamCard } from './TeamCard'; // 경로 수정됨

interface Props {
    state: any;
    targetSeason: Season;
    masterTeams: MasterTeam[];
    owners: Owner[];
    onDeleteSchedule: (id: number) => void;
}

export const AdminMatching_Step2_Roster = ({ state, targetSeason, masterTeams, owners, onDeleteSchedule }: Props) => {
    const { 
        hasSchedule, 
        isPoLocked, 
        isTourneyLocked, 
        handleRemoveTeam, 
        handleGenerateSchedule, 
        handleLoadPlayoffTeams 
    } = state;

    return (
        <div className="bg-black p-5 rounded-[2rem] border border-slate-800">
            <div className="flex flex-col md:flex-row md:justify-between items-center gap-4 mb-6 border-b border-slate-800 pb-4">
                <h3 className="text-white font-black italic tracking-tighter uppercase w-full md:w-auto">Step 2. Season Members ({targetSeason.teams?.length || 0})</h3>
                <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                    {hasSchedule ? (
                        <>
                            {targetSeason.type === 'LEAGUE_PLAYOFF' && !isPoLocked && (
                                <button onClick={handleLoadPlayoffTeams} className="bg-emerald-600 px-3 py-2 rounded-lg text-[10px] font-black italic tracking-tighter uppercase hover:bg-emerald-500 shadow-lg shadow-emerald-900/50 animate-pulse">🌟 PO 진출팀 대기실로 이동</button>
                            )}
                            {targetSeason.type === 'TOURNAMENT' && !isTourneyLocked && (
                                <button onClick={() => { document.getElementById('tourney-setup-section')?.scrollIntoView({ behavior: 'smooth' }); }} className="bg-blue-600 px-3 py-2 rounded-lg text-[10px] font-black italic tracking-tighter uppercase hover:bg-blue-500 shadow-lg shadow-blue-900/50 animate-pulse">🌟 토너먼트 대진표 세팅</button>
                            )}
                            <button onClick={() => handleGenerateSchedule(true)} className="bg-blue-700 px-3 py-2 rounded-lg text-[10px] font-black italic tracking-tighter uppercase hover:bg-blue-600">Re-Gen</button>
                            <button onClick={() => onDeleteSchedule(targetSeason.id)} className="bg-red-900 px-3 py-2 rounded-lg text-[10px] font-black italic tracking-tighter uppercase hover:bg-red-700">Clear</button>
                        </>
                    ) : (
                        <button onClick={() => handleGenerateSchedule(false)} className="bg-purple-700 px-4 py-2 rounded-lg text-xs font-black italic tracking-tighter uppercase hover:bg-purple-600 shadow-xl shadow-purple-900/50 animate-pulse">Generate Schedule</button>
                    )}
                </div>
            </div>
            
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {targetSeason.teams?.map(t => {
                    const master = masterTeams.find(m => m.name === t.name);
                    const displayTeam = { ...t, logo: master ? master.logo : t.logo, tier: master ? master.tier : t.tier, region: master ? master.region : t.region };
                    return (
                        <div key={t.id} className="relative group">
                            <TeamCard team={displayTeam} />
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleRemoveTeam(t.id, t.name); }} 
                                className={`absolute top-2 right-2 z-20 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 hover:bg-red-600 text-white transition-colors ${hasSchedule ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                                <span className="text-[10px] font-bold">{hasSchedule ? '🔒' : '✕'}</span>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};