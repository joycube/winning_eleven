import React from 'react';
import { MatchCard } from './MatchCard'; // MatchCard 연결
import { Season, Match } from '../types';

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

  return (
    <div className="space-y-6 animate-in fade-in">
        {/* 시즌 선택 셀렉터 */}
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
            <select value={viewSeasonId} onChange={(e) => setViewSeasonId(Number(e.target.value))} className="w-full bg-slate-950 text-white text-sm p-3 rounded-xl border border-slate-700">
                {seasons.map(s => <option key={s.id} value={s.id}>🗓️ {s.name}</option>)}
            </select>
        </div>
        
        {/* 라운드 및 스테이지별 그룹핑 렌더링 */}
        {currentSeason?.rounds?.map((r, rIdx) => {
            // 🔥 [핵심 변경] 해당 라운드(r) 안에 있는 경기들의 'stage'를 추출하여 유니크한 그룹을 만듦
            // 예: 토너먼트의 경우 하나의 Round 안에 'Semi-Final', 'Final' 등이 섞여 있을 수 있음 -> 이를 분리
            const uniqueStages = Array.from(new Set(r.matches.map(m => m.stage)));

            return (
                <div key={rIdx} className="space-y-6"> {/* 스테이지 간 간격 확보 */}
                    {uniqueStages.map((stageName) => (
                        <div key={stageName} className="space-y-2">
                            {/* 🔥 헤더 분리: r.name 대신 실제 stage 이름을 헤더로 사용 */}
                            <h3 className="text-xs font-bold text-slate-500 pl-2 border-l-2 border-emerald-500 uppercase">
                                {stageName}
                            </h3>
                            
                            {/* 해당 스테이지에 속한 경기만 필터링하여 1단 리스트로 출력 */}
                            <div className="grid md:grid-cols-1 gap-2">
                                {r.matches
                                    .filter(m => m.stage === stageName)
                                    .map(m => (
                                        <MatchCard 
                                            key={m.id} 
                                            match={m} 
                                            onClick={onMatchClick}
                                            activeRankingData={activeRankingData}
                                            historyData={historyData}
                                        />
                                    ))
                                }
                            </div>
                        </div>
                    ))}
                </div>
            );
        })}
        
        {(!currentSeason?.rounds || currentSeason.rounds.length === 0) && (
            <div className="text-center py-10 text-slate-500">등록된 스케줄이 없습니다.</div>
        )}
    </div>
  );
};