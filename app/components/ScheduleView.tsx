import React, { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore'; 
import { db } from '../firebase'; 
import { MatchCard } from './MatchCard'; // 🔥 MatchCard 파일 연결!
import { Season, Match, MasterTeam } from '../types'; 

interface ScheduleViewProps {
  seasons: Season[];
  viewSeasonId: number;
  setViewSeasonId: (id: number) => void;
  onMatchClick: (m: Match) => void;
  activeRankingData: any;
  historyData: any;
}

export const ScheduleView = ({ 
  seasons, viewSeasonId, setViewSeasonId, onMatchClick,
  activeRankingData, historyData 
}: ScheduleViewProps) => {
  const currentSeason = seasons.find(s => s.id === viewSeasonId);
  const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);

  useEffect(() => {
    const fetchMasterTeams = async () => {
      try {
        const q = query(collection(db, 'master_teams'));
        const querySnapshot = await getDocs(q);
        const teams = querySnapshot.docs.map(doc => ({
          id: doc.data().id,
          ...doc.data()
        })) as MasterTeam[];
        setMasterTeams(teams); 
      } catch (error) {
        console.error("Error fetching master teams:", error);
      }
    };
    fetchMasterTeams();
  }, []);

  const getKoreanStageName = (stage: string) => {
    const s = stage.toUpperCase();
    if (s.includes('ROUND OF 32') || s.includes('32')) return '32강';
    if (s.includes('ROUND OF 16') || s.includes('16')) return '16강';
    if (s.includes('QUARTER') || s.includes('8')) return '8강';
    if (s.includes('SEMI') || s.includes('4')) return '준결승';
    if (s.includes('THIRD')) return '3·4위전';
    if (s.includes('FINAL')) return '결승';
    if (s.includes('ROUND')) {
        const num = s.replace(/[^0-9]/g, '');
        return `${num}라운드`;
    }
    return stage;
  };

  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
            <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="w-full bg-slate-950 text-white text-sm p-3 rounded-xl border border-slate-700">
                {seasons.map(s => <option key={s.id} value={s.id}>🗓️ {s.name}</option>)}
            </select>
        </div>
        
        {currentSeason?.rounds?.map((r, rIdx) => {
            const uniqueStages = Array.from(new Set(r.matches.map(m => m.stage)));
            return (
                <div key={rIdx} className="space-y-6">
                    {uniqueStages.map((stageName) => {
                        const displayStageName = getKoreanStageName(stageName);
                        return (
                            <div key={stageName} className="space-y-2">
                                <h3 className="text-xs font-bold text-slate-500 pl-2 border-l-2 border-emerald-500 uppercase">
                                    {displayStageName}
                                </h3>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {r.matches.filter(m => m.stage === stageName).map((m, mIdx) => {
                                        const isBye = m.away === 'BYE' || m.away === 'BYE (부전승)' || m.status === 'BYE';
                                        const customMatchLabel = `${displayStageName} ${mIdx + 1}게임`;
                                        const displayMatch = { ...m, matchLabel: customMatchLabel };

                                        return (
                                            <div key={m.id} className="relative">
                                                <MatchCard 
                                                    match={displayMatch} 
                                                    onClick={onMatchClick}
                                                    activeRankingData={activeRankingData}
                                                    historyData={historyData}
                                                    masterTeams={masterTeams} 
                                                />
                                                {isBye && (
                                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center rounded-xl z-10 pointer-events-none">
                                                        <div className="bg-slate-900/90 text-emerald-400 text-xs font-bold px-4 py-2 rounded-full border border-emerald-500/50 shadow-2xl flex items-center gap-2">
                                                            <span>✨</span>
                                                            <span>{m.home} 부전승 진출!</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        })}
        {(!currentSeason?.rounds || currentSeason.rounds.length === 0) && (
            <div className="text-center py-10 text-slate-500">등록된 스케줄이 없습니다.</div>
        )}
    </div>
  );
};