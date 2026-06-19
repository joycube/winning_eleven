/* eslint-disable react-hooks/exhaustive-deps */
"use client";

// 🛠️ [Day 2 분할] 1032줄 → ~330줄로 슬림화
//   기존 로직은 app/hooks/* 와 app/utils/handleSaveMatchResult.ts 로 분리됨.

import React, { useEffect, useMemo, useState } from 'react';

import type { Match } from './types';

import { TopBar } from './components/TopBar';
import { NavTabs } from './components/NavTabs';
import { BannerSlider } from './components/BannerSlider';
import { Footer } from './components/Footer';
import { ScrollToTop } from './components/ScrollToTop';
import InAppBrowserGuard from './components/InAppBrowserGuard';

// 🛠️ [Day 2 분할 픽스 v2] next/dynamic 제거 — Next.js 14.2 의 "next/dynamic css was called outside a request scope" 버그 회피
//   App Router 는 일반 import 도 클라이언트 번들에서 자동 코드 스플릿함
import LockerRoomView from './components/LockerRoomView';
import OwnerRoomView from './components/OwnerRoomView';
import { RankingView } from './components/RankingView';
import { ScheduleView } from './components/ScheduleView';
import { HistoryView } from './components/HistoryView';
import { FinanceView } from './components/FinanceView';
import { AdminView } from './components/AdminView';
import { MatchEditModal } from './components/MatchEditModal';

import { useLeagueData } from './hooks/useLeagueData';
import { useLeagueStats } from './hooks/useLeagueStats';
import { useAuth } from './hooks/useAuth';
import { usePushNotification } from './hooks/usePushNotification';

// 🛠️ [Day 2 분할] 추출된 훅들
import { usePerfectHistoryData } from './hooks/usePerfectHistoryData';
import { useCombinedHistoryData } from './hooks/useCombinedHistoryData';
import { useKnockoutStages } from './hooks/useKnockoutStages';
import { useNoticesSubscription } from './hooks/useNoticesSubscription';

// 🛠️ [Day 2 분할] 추출된 매치 저장 유틸
import { createHandleSaveMatchResult } from './utils/handleSaveMatchResult';

// 🔥 [핵심 픽스] 시즌 생성/오너 저장 — 인라인 유지 (트리비얼)
import { db } from './firebase';
import { doc, updateDoc, setDoc, addDoc, collection } from 'firebase/firestore';


export default function FootballLeagueApp() {
  // ──────────────────────────────────────────────────────────────────
  // 1. 데이터 / 인증 훅
  // ──────────────────────────────────────────────────────────────────
  const { seasons, owners, masterTeams, leagues, banners, historyRecords, isLoaded } = useLeagueData();
  const { authUser, isLoading: isAuthLoading } = useAuth();
  const { requestPermissionAndSaveToken } = usePushNotification();

  // ──────────────────────────────────────────────────────────────────
  // 2. UI 상태
  // ──────────────────────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState<'LOCKERROOM' | 'RANKING' | 'SCHEDULE' | 'HISTORY' | 'FINANCE' | 'OWNERROOM' | 'ADMIN'>('LOCKERROOM');
  const [viewSeasonId, setViewSeasonId] = useState<number>(0);
  const [adminTab, setAdminTab] = useState<any>('NEW');
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  // ──────────────────────────────────────────────────────────────────
  // 3. 파생 데이터 — 명예의 전당 / 합산 히스토리 / 토너먼트 진출
  // ──────────────────────────────────────────────────────────────────
  const { activeRankingData, historyData } = useLeagueStats(seasons, viewSeasonId, owners, historyRecords);

  // 명예의 전당용 통합 데이터 (퍼펙트)
  const perfectHistoryData = usePerfectHistoryData(historyRecords, owners);

  // 진행 중 시즌 매치까지 포함한 통합 히스토리
  const combinedHistoryData = useCombinedHistoryData(historyData, seasons, owners, historyRecords, isLoaded);

  // 공지 구독 & 새 공지 감지
  const { notices, latestPopupNotice, hideTicker, hasNewNotice, handleCloseTicker } =
    useNoticesSubscription(currentView);

  // ──────────────────────────────────────────────────────────────────
  // 4. 헬퍼 함수 (작은 유틸은 인라인)
  // ──────────────────────────────────────────────────────────────────
  const getOwnerUidByName = (targetName: string) => {
    if (!targetName || ['-', 'TBD', 'BYE', 'SYSTEM', 'CPU'].includes(targetName.trim())) return undefined;
    const search = targetName.trim();
    const found = owners.find(o => o.nickname === search || o.legacyName === search || o.docId === search || o.uid === search);
    return found?.uid || found?.docId || undefined;
  };

  // 토너먼트 진출 스냅샷 (RANKING/SCHEDULE 뷰에서만 동작)
  const knockoutStages = useKnockoutStages(
    seasons, viewSeasonId, activeRankingData, masterTeams, currentView, isLoaded, getOwnerUidByName
  );

  // ──────────────────────────────────────────────────────────────────
  // 5. 푸시 알림 권한 요청 (앱 진입 후 2초 뒤)
  // ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const timer = setTimeout(() => {
          requestPermissionAndSaveToken(authUser?.uid || null);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [authUser]);

  // ──────────────────────────────────────────────────────────────────
  // 6. ADMIN 권한 가드
  // ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (currentView === 'ADMIN' && !isAuthLoading) {
      if (authUser?.role !== 'ADMIN') {
        alert('🚫 관리자 권한이 없습니다. 마스터 계정으로 로그인해주세요.');
        setCurrentView('LOCKERROOM');
      }
    }
  }, [currentView, authUser, isAuthLoading]);

  // ──────────────────────────────────────────────────────────────────
  // 7. URL 동기화
  // ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (seasons.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const paramView = params.get('view');
    const paramSeasonId = Number(params.get('season'));
    if (paramView && ['LOCKERROOM', 'RANKING', 'SCHEDULE', 'HISTORY', 'FINANCE', 'OWNERROOM', 'ADMIN'].includes(paramView)) {
      setCurrentView(paramView as any);
    }
    if (paramSeasonId && seasons.find(s => s.id === paramSeasonId)) setViewSeasonId(paramSeasonId);
    else if (viewSeasonId === 0 && seasons.length > 0) setViewSeasonId(seasons[0].id);
  }, [seasons]);

  useEffect(() => {
    if (viewSeasonId > 0) {
      const params = new URLSearchParams(window.location.search);
      params.set('view', currentView);
      params.set('season', String(viewSeasonId));
      window.history.replaceState(null, '', `?${params.toString()}`);
    }
  }, [currentView, viewSeasonId]);

  // ──────────────────────────────────────────────────────────────────
  // 8. View / Click 핸들러
  // ──────────────────────────────────────────────────────────────────
  const handleViewChange = (newView: any) => {
    setCurrentView(newView);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('view', newView);

      if (newView === 'LOCKERROOM') {
        params.delete('postId');
        params.delete('noticeId');
        window.history.pushState(null, '', `?${params.toString()}`);
        window.dispatchEvent(new Event('popstate'));
      } else if (newView === 'RANKING' || newView === 'SCHEDULE') {
        if (seasons && seasons.length > 0) {
          const latestSeasonId = seasons[0].id;
          setViewSeasonId(latestSeasonId);
          params.set('season', String(latestSeasonId));
        }
        window.history.pushState(null, '', `?${params.toString()}`);
      } else {
        window.history.pushState(null, '', `?${params.toString()}`);
      }
    }
  };

  const handleMatchClick = (m: Match) => setEditingMatch(m);

  // ──────────────────────────────────────────────────────────────────
  // 9. 매치 저장 핸들러 (TBD 패치 + LEAGUE_PLAYOFF 진출 자동 채우기 포함)
  //    유틸로 분리됨. deps 가 바뀔 때만 재생성.
  // ──────────────────────────────────────────────────────────────────
  const handleSaveMatchResult = useMemo(
    () => createHandleSaveMatchResult({
      editingMatch, seasons, viewSeasonId, activeRankingData, combinedHistoryData,
      masterTeams, getOwnerUidByName, setEditingMatch,
    }),
    [editingMatch, seasons, viewSeasonId, activeRankingData, combinedHistoryData, masterTeams, owners]
  );

  // ──────────────────────────────────────────────────────────────────
  // 10. 어드민 핸들러 (트리비얼)
  // ──────────────────────────────────────────────────────────────────
  const handleCreateSeason = async (name: string, type: string, mode: string, prize: number, prizesObj: any) => {
    if (!name) return alert("시즌 이름을 입력하세요.");
    const id = Date.now();
    const newSeason: any = { id, name, type: type as any, leagueMode: mode as any, status: 'ACTIVE', teams: [], rounds: [], prizes: prizesObj };
    await setDoc(doc(db, "seasons", String(id)), newSeason);
    setAdminTab(id);
    setViewSeasonId(id);
    alert("완료");
  };

  const handleSaveOwner = async (name: string, photo: string, editId: string | null) => {
    if (!name) return;
    if (editId) await updateDoc(doc(db, "users", editId), { nickname: name, photo });
    else await addDoc(collection(db, "users"), { id: Date.now(), nickname: name, photo });
    alert("완료");
  };

  const getTeamPlayers = (teamName: string) => {
    if (!activeRankingData?.players) return [];
    const players = new Set<string>();
    activeRankingData.players.forEach((p: any) => { if (p.team === teamName) players.add(p.name); });
    return Array.from(players);
  };

  const handleNavigateToSchedule = (seasonId: number) => {
    const s = seasons.find(item => item.id === seasonId);
    const isKnockout = (s?.cupPhase as any) === 'KNOCKOUT';
    setCurrentView('SCHEDULE');
    setViewSeasonId(seasonId);
    const params = new URLSearchParams(window.location.search);
    params.set('view', 'SCHEDULE');
    params.set('season', String(seasonId));
    if (isKnockout) params.set('phase', 'KNOCKOUT');
    window.history.replaceState(null, '', `?${params.toString()}`);
  };

  // ──────────────────────────────────────────────────────────────────
  // 11. 렌더링
  // ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#020617] text-white font-black italic tracking-tighter overflow-x-hidden pb-2">
      <InAppBrowserGuard />

      {latestPopupNotice && !hideTicker && (
        <div className="w-full bg-[#050b14] border-b border-emerald-500/30 py-2.5 px-4 flex items-center justify-between z-50">
          <style>{`
            @keyframes seamless-ticker {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .animate-ticker-seamless {
              display: flex;
              white-space: nowrap;
              width: max-content;
              animation: seamless-ticker 20s linear infinite;
            }
            .animate-ticker-seamless:hover { animation-play-state: paused; }
          `}</style>

          <div className="flex items-center w-full overflow-hidden">
            <span className="shrink-0 bg-emerald-950/80 text-emerald-400 border border-emerald-500/50 px-2 py-0.5 rounded text-[10px] font-black mr-4 z-10 shadow-[0_0_10px_rgba(52,211,153,0.2)]">전체 공지</span>

            <div
              className="flex-1 overflow-hidden cursor-pointer flex"
              onClick={() => {
                setCurrentView('LOCKERROOM');
                if (typeof window !== 'undefined') {
                  const params = new URLSearchParams(window.location.search);
                  params.set('view', 'LOCKERROOM');
                  params.set('noticeId', latestPopupNotice.id);
                  window.history.pushState(null, '', `?${params.toString()}`);
                  window.dispatchEvent(new Event('forceNoticeCheck'));
                }
              }}
            >
              <div className="animate-ticker-seamless gap-16 pr-16 text-emerald-400/90 font-bold text-[11px] sm:text-xs tracking-widest drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
                <span>{latestPopupNotice.title}</span>
                <span>{latestPopupNotice.title}</span>
                <span>{latestPopupNotice.title}</span>
                <span>{latestPopupNotice.title}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleCloseTicker}
            className="shrink-0 ml-4 bg-slate-800/80 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded text-[10px] font-black transition-all border border-slate-700/50 z-10"
            title="오늘 하루 보지 않기"
          >
            ✕ 닫기
          </button>
        </div>
      )}

      <div className="relative">
        <BannerSlider banners={banners || []} />
        <TopBar setCurrentView={handleViewChange} masterTeams={masterTeams} owners={owners} />
      </div>
      <NavTabs currentView={currentView} setCurrentView={handleViewChange} hasNewNotice={hasNewNotice} />

      <main className="max-w-6xl mx-auto px-4 md:px-8 pb-4">
        {currentView === 'LOCKERROOM' && (
          <LockerRoomView
            user={authUser as any}
            notices={notices}
            seasons={seasons}
            masterTeams={masterTeams}
            owners={owners}
            activeRankingData={activeRankingData}
            historyData={combinedHistoryData}
            viewSeasonId={viewSeasonId}
            setViewSeasonId={setViewSeasonId}
          />
        )}

        {currentView === 'RANKING' && (
          <RankingView
            seasons={seasons}
            viewSeasonId={viewSeasonId}
            setViewSeasonId={setViewSeasonId}
            activeRankingData={activeRankingData}
            owners={owners}
            knockoutStages={knockoutStages}
          />
        )}

        {currentView === 'SCHEDULE' && (
          <ScheduleView
            {...({ seasons, viewSeasonId, setViewSeasonId, onMatchClick: handleMatchClick, activeRankingData, historyData: combinedHistoryData, knockoutStages, ownersFromParent: owners } as any)}
          />
        )}

        {/* 🔥 [핵심 픽스] HistoryView 에만 오차율 0%의 perfectHistoryData 주입 */}
        {/* 🛠️ [Finance v4 / 옵션1 정제] seasons 전달 → 진행 중 시즌 W/D/L/PTS 합산 */}
        {/* 🛠️ [옵션A-3] masterTeams 전달 → owner TBD/빈값 매치도 팀명으로 폴백 매칭 */}
        {currentView === 'HISTORY' && <HistoryView historyData={perfectHistoryData} owners={owners} seasons={seasons} masterTeams={masterTeams} user={authUser} />}

        {currentView === 'FINANCE' && (
          <FinanceView owners={owners} seasons={seasons} masterTeams={masterTeams} user={authUser as any} />
        )}

        {currentView === 'OWNERROOM' && (
          <OwnerRoomView
            user={authUser as any}
            masterTeams={masterTeams}
            historyData={combinedHistoryData}
            seasons={seasons}
            owners={owners}
          />
        )}

        {currentView === 'ADMIN' && authUser?.role === 'ADMIN' && (
          <AdminView
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            seasons={seasons}
            owners={owners}
            leagues={leagues}
            masterTeams={masterTeams}
            banners={banners || []}
            onAdminLogin={() => true}
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
          isTournament={seasons.find(s => s.id === editingMatch.seasonId)?.type === 'TOURNAMENT' || seasons.find(s => s.id === editingMatch.seasonId)?.type === 'CUP'}
          teamPlayers={getTeamPlayers}
          owners={owners}
        />
      )}

      <ScrollToTop />
    </div>
  );
}
