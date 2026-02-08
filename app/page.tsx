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
      let currentMatchIndex = -1; // 전체 배열에서의 절대 인덱스

      // 🔥 [추가] 승률 박제 로직 (DB 저장용 스냅샷 생성)
      // 현재 랭킹, 전적, 마스터 팀 정보를 활용하여 "이 경기 시점의 예측 승률"을 계산합니다.
      const predictionSnapshot = calculateMatchSnapshot(
          editingMatch.home,
          editingMatch.away,
          activeRankingData, // 현재 시즌 랭킹 데이터
          historyData,       // 역대 전적 데이터
          masterTeams        // 마스터 팀 정보
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

                      // 🔥 [추가] 계산된 승률을 DB에 영구 저장 (박제)
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
          
          // (A) 승자 판별 로직
          // 1. 상대가 BYE(부전승)이면 무조건 Home 승리
          if (editingMatch.away === 'BYE' || editingMatch.away === 'BYE (부전승)') {
              winningTeam = {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner};
              console.log("Auto-win by BYE:", winningTeam.name);
          }
          // 2. 수동 승자 선택 (동점 승부차기 등)
          else if (manualWinner === 'HOME') winningTeam = {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner};
          else if (manualWinner === 'AWAY') winningTeam = {name: editingMatch.away, logo: editingMatch.awayLogo, owner: editingMatch.awayOwner};
          // 3. 점수 비교
          else if (h > a) winningTeam = {name: editingMatch.home, logo: editingMatch.homeLogo, owner: editingMatch.homeOwner};
          else if (a > h) winningTeam = {name: editingMatch.away, logo: editingMatch.awayLogo, owner: editingMatch.awayOwner};
          else {
              // 무승부이고 수동 선택도 안 함
              return alert("⚠️ 무승부입니다! 'Home 승' 또는 'Away 승' 버튼을 눌러 승자를 선택해주세요.");
          }

          // (B) 다음 라운드 진출 로직 (Flat Tree 구조 계산)
          // newRounds[0].matches 안에 모든 경기가 다 들어있다고 가정
          if (winningTeam && newRounds[0] && newRounds[0].matches) {
              const allMatches = newRounds[0].matches;
              const totalMatches = allMatches.length;
              
              // 현재 레벨(8강, 4강 등) 파악을 위한 초기값
              // 예: 7경기면 첫 라운드는 4경기 (0~3 인덱스)
              let levelSize = (totalMatches + 1) / 2; 
              let startIndex = 0;

              // 현재 매치 인덱스가 어느 레벨 구간에 있는지 찾기
              while (currentMatchIndex >= startIndex + levelSize) {
                  startIndex += levelSize;
                  levelSize /= 2;
                  
                  // 무한 루프 방지
                  if (levelSize < 1) break; 
              }

              // 다음 매치 인덱스 계산 공식
              const nextMatchIndex = (startIndex + levelSize) + Math.floor((currentMatchIndex - startIndex) / 2);

              console.log(`Advancing ${winningTeam.name} to Match Index: ${nextMatchIndex}`);

              // 다음 경기가 존재하면 업데이트
              if (allMatches[nextMatchIndex]) {
                  const targetMatch = allMatches[nextMatchIndex];
                  
                  // 현재 위치가 짝수면 Home 슬롯, 홀수면 Away 슬롯
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
                  
                  // 'TBD' 텍스트 제거 (UI 깔끔하게)
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
            <HistoryView historyData={historyData} />
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
              isTournament={seasons.find(s=>s.id===editingMatch.seasonId)?.type === 'TOURNAMENT'}
              teamPlayers={getTeamPlayers}
          />
      )}
    </div>
  );
}