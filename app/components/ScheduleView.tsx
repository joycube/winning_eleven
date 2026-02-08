// components/ScheduleView.tsx
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore'; 
import { db } from '../firebase'; 
import { MatchCard } from './MatchCard'; // MatchCard 파일 불러오기
import { Season, Match, MasterTeam } from '../types'; 

interface ScheduleViewProps {
  seasons: Season[];
  viewSeasonId: number;
  setViewSeasonId: (id: number) => void;
  onMatchClick: (m: Match) => void;
  activeRankingData: any;
  historyData: any;
}

// 🔥 핵심: 여기 이름이 반드시 'ScheduleView' 여야 합니다!
export const ScheduleView = ({ 
  seasons, viewSeasonId, setViewSeasonId, onMatchClick,
  activeRankingData, historyData 
}: ScheduleViewProps) => {
  const currentSeason = seasons.find(s => s.id === viewSeasonId);
  const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);

  // DB에서 팀 정보 가져오기
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

  // 🔥 [수정] 시즌 타입과 경기 수를 모두 고려한 명칭 변환 함수
  const getKoreanStageName = (stage: string, matchCount: number, seasonType: string = 'LEAGUE') => {
    const s = stage.toUpperCase();
    
    // 1. 리그(LEAGUE)인 경우: 경기 수 계산 안 함, 그냥 라운드 표기
    if (seasonType === 'LEAGUE') {
        // Round와 숫자 사이 공백 추가
        return stage.replace(/ROUND/i, '라운드 ').replace(/GAME/i, '경기');
    }

    // 2. 토너먼트(TOURNAMENT, CUP)인 경우: 경기 수 역산 로직 적용
    // (1) 텍스트에 명확한 힌트가 있는 경우 우선 적용
    if (s.includes('34') || s.includes('3RD')) return '🥉 3·4위전';
    if (s === 'FINAL') return '🏆 결승전';
    if (s.includes('SEMI')) return '4강 (준결승)';

    // (2) 경기 수(matchCount)로 단계 유추
    if (matchCount === 16) return '32강';
    if (matchCount === 8) return '16강';
    if (matchCount === 4) return '8강';
    if (matchCount === 2) return '4강 (준결승)';
    if (matchCount === 1) return '🏆 결승전';

    // (3) 예외: 매칭되지 않은 경우 그대로 출력
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
            // 🔥 해당 라운드의 총 경기 수 계산
            const totalMatchesInRound = r.matches.length;
            // 🔥 시즌 타입 확인
            const seasonType = currentSeason.type || 'LEAGUE';

            return (
                <div key={rIdx} className="space-y-6">
                    {uniqueStages.map((stageName) => {
                        // 🔥 함수 호출 시 시즌 타입과 경기 수 전달
                        const displayStageName = getKoreanStageName(stageName, totalMatchesInRound, seasonType);
                        
                        return (
                            <div key={stageName} className="space-y-2">
                                <h3 className="text-xs font-bold text-slate-500 pl-2 border-l-2 border-emerald-500 uppercase">
                                    {displayStageName}
                                </h3>
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {r.matches.filter(m => m.stage === stageName).map((m, mIdx) => {
                                        // 🔥 [수정] 라운드명과 경기 번호 사이에 ' / ' 구분자 추가하여 가독성 개선
                                        // 예: "라운드 2 / 2경기" 또는 "16강 / 3경기"
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
    </div>
  );
};