/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect } from 'react';
import { db } from './firebase'; 
import { doc, updateDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { Season, Match } from './types';

// 컴포넌트들
import { TopBar } from './components/TopBar';
import { NavTabs } from './components/NavTabs';
import { BannerSlider } from './components/BannerSlider';
import { Footer } from './components/Footer';
import { RankingView } from './components/RankingView';
import { ScheduleView } from './components/ScheduleView';
import { HistoryView } from './components/HistoryView';
import { TutorialView } from './components/TutorialView';
import { AdminView } from './components/AdminView';
import { MatchEditModal } from './components/MatchEditModal';

// 훅 (데이터 가져오는 엔진)
import { useLeagueData } from './hooks/useLeagueData';
import { useLeagueStats } from './hooks/useLeagueStats';

// 🔥 [핵심 추가] 승률 박제 도우미 함수 import
import { calculateMatchSnapshot } from './utils/predictor';

export default function FootballLeagueApp() {
  // 1. 데이터 로딩
  const { seasons, owners, masterTeams, leagues, banners, isLoaded } = useLeagueData();
  
  // 2. 화면 상태 관리
  const [currentView, setCurrentView] = useState<'RANKING' | 'SCHEDULE' | 'HISTORY' | 'ADMIN' | 'TUTORIAL'>('RANKING');
  const [viewSeasonId, setViewSeasonId] = useState<number>(0);
  const [adminTab, setAdminTab] = useState<any>('NEW'); 
  
  // 3. 통계 계산 (랭킹 등)
  const { activeRankingData, historyData } = useLeagueStats(seasons, viewSeasonId);
  
  // 4. 경기 수정 모달 상태
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  // [초기화] URL에서 파라미터 읽어오기
  useEffect(() => {
    if (seasons.length === 0) return;
    
    const params = new URLSearchParams(window.location.search);
    const paramView = params.get('view');
    const paramSeasonId = Number(params.get('season'));

    if (paramView && ['RANKING', 'SCHEDULE', 'HISTORY', 'TUTORIAL', 'ADMIN'].includes(paramView)) {
        setCurrentView(paramView as any);
    }
    
    if (paramSeasonId && seasons.find(s => s.id === paramSeasonId)) {
        setViewSeasonId(paramSeasonId);
    } else if (viewSeasonId === 0 && seasons.length > 0) {
        setViewSeasonId(seasons[0].id);
    }
  }, [seasons]);

  // [동기화] 탭이나 시즌을 바꾸면 URL도 바꿔줌
  useEffect(() => {
    if (viewSeasonId > 0) {
        const params = new URLSearchParams(window.location.search);
        params.set('view', currentView);
        params.set('season', String(viewSeasonId));
        window.history.replaceState(null, '', `?${params.toString()}`);
    }
  }, [currentView, viewSeasonId]);

  const handleMatchClick = (m: Match) => setEditingMatch(m);

  // ==================================================================================
  // 🔥 [핵심 수정] 경기 결과 저장 및 토너먼트 자동 진출 (부전승 포함)
  // ==================================================================================
  const handleSaveMatchResult = async (matchId: string, hScore: string, aScore: string, yt: string, records: any, manualWinner: 'HOME'|'AWAY'|null) => {
      if(!editingMatch) return;
      const s = seasons.find(se => se.id === editingMatch.seasonId);
      if(!s || !s.rounds) return;

      console.log("Saving Match:", matchId, "Type:", s.type);

      // 1. 점수 및 기록 업데이트
      let newRounds = [...s.rounds];
      let currentRoundIndex = -1;
      let currentMatchIndex = -1; 

      const predictionSnapshot = calculateMatchSnapshot(
          editingMatch.home,
          editingMatch.away,
          activeRankingData, 
          historyData,       
          masterTeams        
      );

      newRounds = newRounds.map((r, rIdx) => ({
          ...r,
          matches: r.matches.map((m, mIdx) => {
              if (m.id === matchId) {
                  currentRoundIndex = rIdx;
                  currentMatchIndex = mIdx;
                  return { 
                      ...m, 
                      homeScore: hScore, awayScore: aScore, youtubeUrl: yt, status: 'COMPLETED',
                      homeScorers: records.homeScorers, awayScorers: records.awayScorers,
                      homeAssists: records.homeAssists, awayAssists: records.awayAssists,
                      homePredictRate: predictionSnapshot.homePredictRate,
                      awayPredictRate: predictionSnapshot.awayPredictRate
                  };
              }
              return m;
          })
      }));

      // 2. 토너먼트 승자 자동 진출 로직 (TOURNAMENT 또는 CUP)
      if ((s.type === 'TOURNAMENT' || s.type === 'CUP') && currentRoundIndex !== -1 && currentMatchIndex !== -1) {
          
          let winningTeam: {name: string, logo: string, owner: string} | null = null;
          const h = Number(hScore); 
          const a = Number(aScore);
          
          // 🔥 [수정] 이 부분이 무승부를 허용하는 핵심 로직입니다.
          // 조별리그(GROUP) 단계인지를 먼저 판단합니다.
          const isGroupStage = editingMatch.matchLabel?.toUpperCase().includes('GROUP') || editingMatch.stage?.toUpperCase().includes('GROUP');

          // (A) 승자 판별 로직
          if (editingMatch.away === 'BYE' || editingMatch.away === 'BYE (부전승)') {
              winningTeam = {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner};
          }
          else if (manualWinner === 'HOME') winningTeam = {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner};
          else if (manualWinner === 'AWAY') winningTeam = {name: editingMatch.away, logo: editingMatch.awayLogo, owner: editingMatch.awayOwner};
          else if (h > a) winningTeam = {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner};
          else if (a > h) winningTeam = {name: editingMatch.away, logo: editingMatch.awayLogo, owner: editingMatch.awayOwner};
          else {
              // 🤝 무승부 상황일 때
              // 조별리그라면 승자 선택 없이 통과(저장), 토너먼트라면 승자 선택 강제
              if (!isGroupStage) {
                  return alert("⚠️ 무승부입니다! 'Home 승' 또는 'Away 승' 버튼을 눌러 승자를 선택해주세요.");
              }
          }

          // (B) 다음 라운드 진출 로직 (조별리그가 아닌 토너먼트 본선일 때만 수행)
          if (winningTeam && !isGroupStage && newRounds[0] && newRounds[0].matches) {
              const allMatches = newRounds[0].matches;
              const totalMatches = allMatches.length;
              let levelSize = (totalMatches + 1) / 2; 
              let startIndex = 0;

              while (currentMatchIndex >= startIndex + levelSize) {
                  startIndex += levelSize;
                  levelSize /= 2;
                  if (levelSize < 1) break; 
              }

              const nextMatchIndex = (startIndex + levelSize) + Math.floor((currentMatchIndex - startIndex) / 2);

              if (allMatches[nextMatchIndex]) {
                  const targetMatch = allMatches[nextMatchIndex];
                  const isHomeSlot = (currentMatchIndex - startIndex) % 2 === 0;

                  if (isHomeSlot) {
                      targetMatch.home = winningTeam.name;
                      targetMatch.homeLogo = winningTeam.logo;
                      targetMatch.homeOwner = winningTeam.owner;
                  } else {
                      targetMatch.away = winningTeam.name;
                      targetMatch.awayLogo = winningTeam.logo;
                      targetMatch.awayOwner = winningTeam.owner;
                  }
                  
                  if (targetMatch.home !== 'TBD' && targetMatch.away !== 'TBD') {
                      targetMatch.matchLabel = targetMatch.matchLabel.replace(' (TBD)', '');
                  }
              }
          }
      }

      await updateDoc(doc(db, "seasons", String(s.id)), { rounds: newRounds });
      setEditingMatch(null);
  };

  // 새 시즌 만들기
  const handleCreateSeason = async (name: string, type: string, mode: string, prize: number, prizesObj: any) => {
      if(!name) return alert("시즌 이름을 입력하세요.");
      const id = Date.now();
      const newSeason: any = { 
          id, name, type: type as any, leagueMode: mode as any, status: 'ACTIVE', 
          teams: [], rounds: [], prizes: prizesObj 
      };
      await setDoc(doc(db, "seasons", String(id)), newSeason);
      setAdminTab(id); setViewSeasonId(id);
      alert("게임 생성 완료! 팀을 배정해주세요.");
  };

  // 구단주(Owner) 추가/수정
  const handleSaveOwner = async (name: string, photo: string, editId: string | null) => {
      if(!name) return;
      if (editId) {
          await updateDoc(doc(db, "users", editId), { nickname: name, photo });
          alert("오너 정보 수정 완료");
      } else {
          await addDoc(collection(db, "users"), { id: Date.now(), nickname: name, photo });
          alert("새 오너 등록 완료");
      }
  };

  const getTeamPlayers = (teamName: string) => {
      if (!activeRankingData?.players) return [];
      const players = new Set<string>();
      activeRankingData.players.forEach((p:any) => { if(p.team === teamName) players.add(p.name); });
      return Array.from(players);
  };

  const handleNavigateToSchedule = (seasonId: number) => {
      setCurrentView('SCHEDULE');
      setViewSeasonId(seasonId);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white font-black italic tracking-tighter overflow-x-hidden pb-20">
      <div className="relative">
          <BannerSlider banners={banners || []} />
          <TopBar />
      </div>

      <NavTabs currentView={currentView} setCurrentView={setCurrentView} />

      <main className="max-w-6xl mx-auto px-4 md:px-8 space-y-8">
        {currentView === 'RANKING' && (
            <RankingView 
                seasons={seasons} 
                viewSeasonId={viewSeasonId} 
                setViewSeasonId={setViewSeasonId} 
                activeRankingData={activeRankingData}
                owners={owners} 
            />
        )}

        {currentView === 'SCHEDULE' && (
            <ScheduleView 
                seasons={seasons} 
                viewSeasonId={viewSeasonId} 
                setViewSeasonId={setViewSeasonId} 
                onMatchClick={handleMatchClick}
                activeRankingData={activeRankingData}
                historyData={historyData}
            />
        )}

        {currentView === 'HISTORY' && (
            <HistoryView 
                historyData={historyData} 
                owners={owners} 
            />
        )}

        {currentView === 'TUTORIAL' && (
            <TutorialView />
        )}

        {currentView === 'ADMIN' && (
            <AdminView 
                adminTab={adminTab}
                setAdminTab={setAdminTab}
                seasons={seasons}
                owners={owners}
                leagues={leagues}
                masterTeams={masterTeams}
                banners={banners || []} 
                onAdminLogin={(pw) => pw === '0705'}
                onCreateSeason={handleCreateSeason}
                onSaveOwner={handleSaveOwner}
                onNavigateToSchedule={handleNavigateToSchedule} 
            />
        )}
      </main>

      <Footer />

      {editingMatch && (
          <MatchEditModal 
              match={editingMatch} 
              onClose={() => setEditingMatch(null)} 
              onSave={handleSaveMatchResult}
              isTournament={seasons.find(s=>s.id===editingMatch.seasonId)?.type === 'TOURNAMENT' || seasons.find(s=>s.id===editingMatch.seasonId)?.type === 'CUP'}
              teamPlayers={getTeamPlayers}
          />
      )}
    </div>
  );
}