// components/ScheduleView.tsx
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore'; 
import { db } from '../firebase'; 
import { MatchCard } from './MatchCard'; 
import { CupSchedule } from './CupSchedule'; 
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
  const [viewMode, setViewMode] = useState<'LEAGUE' | 'CUP'>('LEAGUE');
  const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);
  
  // 🔥 [추가] 오너(유저) 데이터 상태
  const [owners, setOwners] = useState<any[]>([]);

  const currentSeason = seasons.find(s => s.id === viewSeasonId);

  // 뷰 모드 자동 전환
  useEffect(() => {
    if (currentSeason?.type === 'CUP') {
        setViewMode('CUP');
    } else {
        setViewMode('LEAGUE');
    }
  }, [viewSeasonId, seasons, currentSeason]); 

  // 🔥 [수정] MasterTeams와 Users 데이터를 함께 가져오기
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Master Teams 가져오기
        const teamQ = query(collection(db, 'master_teams'));
        const teamSnapshot = await getDocs(teamQ);
        const teams = teamSnapshot.docs.map(doc => ({
          id: doc.data().id,
          ...doc.data()
        })) as MasterTeam[];
        setMasterTeams(teams);

        // 2. 🔥 Users(Owners) 가져오기 (이게 있어야 닉네임 매칭 가능!)
        const userQ = query(collection(db, 'users'));
        const userSnapshot = await getDocs(userQ);
        const userList = userSnapshot.docs.map(doc => doc.data());
        setOwners(userList);

      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  const getKoreanStageName = (stage: string, matchCount: number, seasonType: string = 'LEAGUE') => {
    const s = stage.toUpperCase();
    if (seasonType === 'LEAGUE') return stage.replace(/ROUND/i, '라운드 ').replace(/GAME/i, '경기');
    if (s.includes('34') || s.includes('3RD')) return '🥉 3·4위전';
    if (s === 'FINAL') return '🏆 결승전';
    if (s.includes('SEMI')) return '4강 (준결승)';
    if (matchCount === 16) return '32강';
    if (matchCount === 8) return '16강';
    if (matchCount === 4) return '8강';
    if (matchCount === 2) return '4강 (준결승)';
    if (matchCount === 1) return '🏆 결승전';
    return stage;
  };

  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-lg">
             <div className="flex items-center gap-3">
                <span className="text-slate-400 text-sm font-bold whitespace-nowrap hidden md:block">SELECT SEASON:</span>
                <select 
                    value={viewSeasonId} 
                    onChange={(e) => setViewSeasonId(Number(e.target.value))} 
                    className="w-full bg-slate-950 text-white text-sm font-bold p-3 rounded-xl border border-slate-700 focus:border-emerald-500 outline-none cursor-pointer transition-colors hover:border-slate-500"
                >
                    {seasons.map(s => (
                        <option key={s.id} value={s.id}>
                            {s.type === 'CUP' ? '🏆' : '🗓️'} {s.name}
                        </option>
                    ))}
                </select>
             </div>
        </div>

        {viewMode === 'CUP' ? (
            <CupSchedule 
                seasons={seasons}
                viewSeasonId={viewSeasonId}
                onMatchClick={onMatchClick}
                masterTeams={masterTeams}       
                activeRankingData={activeRankingData}
                historyData={historyData}
                owners={owners} // 🔥 [추가] 오너 데이터 전달
            />
        ) : (
            <>
                {currentSeason?.rounds?.map((r, rIdx) => {
                    const uniqueStages = Array.from(new Set(r.matches.map(m => m.stage)));
                    const totalMatchesInRound = r.matches.length;
                    const seasonType = currentSeason.type || 'LEAGUE';

                    return (
                        <div key={rIdx} className="space-y-6">
                            {uniqueStages.map((stageName) => {
                                const displayStageName = getKoreanStageName(stageName, totalMatchesInRound, seasonType);
                                return (
                                    <div key={stageName} className="space-y-2">
                                        <h3 className="text-xs font-bold text-slate-500 pl-2 border-l-2 border-emerald-500 uppercase">
                                            {displayStageName}
                                        </h3>
                                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {r.matches.filter(m => m.stage === stageName).map((m, mIdx) => {
                                                const customMatchLabel = `${displayStageName} / ${mIdx + 1}경기`;
                                                return (
                                                    <div key={m.id} className="relative">
                                                        <MatchCard 
                                                            match={{ ...m, matchLabel: customMatchLabel }} 
                                                            onClick={onMatchClick}
                                                            activeRankingData={activeRankingData}
                                                            historyData={historyData}
                                                            masterTeams={masterTeams} 
                                                        />
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
            </>
        )}
    </div>
  );
};