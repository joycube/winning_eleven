"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useHistoryRecords } from '../hooks/useHistoryRecords';
import { useLeagueStats } from '../hooks/useLeagueStats';
import { resolveCurrentSeasonId } from './L2_currentSeason';

import { L2_HeroBanner } from './L2_HeroBanner';
import { L2_QuickStats } from './L2_QuickStats';
import { L2_NextMatchCarousel } from './L2_NextMatchCarousel';
import { L2_LastResultCarousel } from './L2_LastResultCarousel';
import { L2_TeamRanking } from './L2_TeamRanking';
import { L2_TopScorers } from './L2_TopScorers';
import { L2_OwnersForm } from './L2_OwnersForm';
import { L2_HighlightsCarousel } from './L2_HighlightsCarousel';
import { L2_CommunicationTabs } from './L2_CommunicationTabs';
import { ChampionsCarousel } from './ChampionsCarousel';
import HighlightViewerModal from './HighlightViewerModal';
import { L2_LockerRoomSkeleton } from './L2_LockerRoomSkeleton';

interface Props {
  user: any;
  notices: any[];
  seasons: any[];
  masterTeams: any[];
  owners: any[];
  activeRankingData?: any;
  historyData?: any;
  activeSeason?: any;
  posts: any[];
  highlights?: any[];
  uidDict?: Record<string, string>;
  setViewMode: (mode: any) => void;
  setCategory: (cat: string) => void;
  setSelectedPostId: (id: string | null) => void;
  viewSeasonId?: number;
  setViewSeasonId?: (id: number) => void;
  /** 🛠️ [v2 픽스] NEXT/LAST 카드 클릭 시 스케쥴 + 해당 매치 자동 스크롤 */
  onNavigateToSchedule?: (seasonId: number, matchId?: string) => void;
}

/**
 * 🛠️ [L2] 새 락커룸 메인 대시보드
 *  - L_LockerRoomDashboard 의 자리를 대체
 *  - 8개 섹션을 한 페이지에 배치
 *  - 자동 슬라이드 캐러셀 / 시즌+누적 토글 / 시각화 그래프
 */
export default function L2_LockerRoomDashboard({
  user, notices = [], seasons = [], masterTeams = [], owners = [],
  activeRankingData, historyData,
  posts = [], highlights = [], uidDict,
  setViewMode, setCategory, setSelectedPostId,
  viewSeasonId = 0,
  setViewSeasonId,
  onNavigateToSchedule,
}: Props) {
  const [matchCommentsData, setMatchCommentsData] = useState<any[]>([]);
  const [selectedHighlight, setSelectedHighlight] = useState<any>(null);

  // 🛠️ [v2.3] 스켈레톤 로딩 — seasons 도착 전까지 골격 UI 표시.
  //   안전망: 7초 지나면 데이터가 비어도 스켈레톤 해제(빈 상태 노출)
  const [skeletonTimedOut, setSkeletonTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSkeletonTimedOut(true), 7000);
    return () => clearTimeout(t);
  }, []);
  const isLoading = !skeletonTimedOut && (!seasons || seasons.length === 0);

  // 🛠️ [v2.5 성능] 무거운 집계 훅을 대시보드에서 1회만 실행 → 자식들에 props 전달.
  //   기존: TeamRanking/TopScorers/QuickStats 가 각자 useHistoryRecords(Firestore 2컬렉션 fetch)·useLeagueStats 를
  //         중복 호출 → 락커룸 1렌더에 동일 계산이 3회/2회 반복(메인스레드 블로킹·메모리 누적·GIF 끊김·간헐 크래시).
  const { historyData: hofData } = useHistoryRecords(owners, seasons, masterTeams);
  const seasonRankingId = useMemo(() => resolveCurrentSeasonId(seasons), [seasons]);
  const { activeRankingData: seasonRanking } = useLeagueStats(seasons, seasonRankingId, owners, []);

  // match_comments 실시간 구독 (MatchTalkCarousel 용)
  useEffect(() => {
    const q = query(collection(db, 'match_comments'));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // 최신순 정렬
      docs.sort((a: any, b: any) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : Number(a.createdAt || 0);
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : Number(b.createdAt || 0);
        return tb - ta;
      });
      setMatchCommentsData(docs);
    }, () => {
      // 권한 거부 등 — 무시
      setMatchCommentsData([]);
    });
    return () => unsub();
  }, []);

  // 매치 카드 클릭 — 매치톡 LIST 화면으로 진입
  const handleMatchClick = (m: any) => {
    if (!m?.id) return;
    setSelectedPostId(`match_${m.id}`);
    setViewMode('LIST');
    const params = new URLSearchParams(window.location.search);
    params.set('view', 'LOCKERROOM');
    params.set('postId', `match_${m.id}`);
    window.history.pushState(null, '', `?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 하이라이트 클릭 — 모달 오픈
  const handleHighlightClick = (h: any) => {
    setSelectedHighlight(h);
  };

  // 데이터 로딩 중 — 스켈레톤 골격 표시
  if (isLoading) {
    return (
      <div className="w-full">
        <L2_LockerRoomSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* 1. Hero */}
      <L2_HeroBanner seasons={seasons} viewSeasonId={viewSeasonId} />

      {/* 2. Quick Stats */}
      <L2_QuickStats
        seasons={seasons}
        owners={owners}
        masterTeams={masterTeams}
        viewSeasonId={viewSeasonId}
        historyData={hofData}
      />

      {/* 3+4. NEXT / LAST 캐러셀 — PC 2열, 모바일 1열 */}
      {/* 🛠️ [v2 픽스] 클릭 시 스케쥴표 이동 우선 (없으면 매치톡 fallback) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <L2_NextMatchCarousel
          seasons={seasons}
          masterTeams={masterTeams}
          owners={owners}
          activeRankingData={activeRankingData}
          historyData={historyData}
          onNavigateToSchedule={onNavigateToSchedule}
          onMatchClick={handleMatchClick}
        />
        <L2_LastResultCarousel
          seasons={seasons}
          masterTeams={masterTeams}
          owners={owners}
          activeRankingData={activeRankingData}
          historyData={historyData}
          onNavigateToSchedule={onNavigateToSchedule}
          onMatchClick={handleMatchClick}
        />
      </div>

      {/* 🛠️ [v2 픽스] HALL OF CHAMPIONS — 기존 ChampionsCarousel 복원 */}
      <ChampionsCarousel seasons={seasons} owners={owners} masterTeams={masterTeams} />

      {/* 5+6. Team Ranking + Top Scorers — PC 2열, 모바일 1열 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <L2_TeamRanking
          seasons={seasons}
          owners={owners}
          masterTeams={masterTeams}
          viewSeasonId={viewSeasonId}
          historyData={hofData}
          seasonRanking={seasonRanking}
        />
        <L2_TopScorers
          seasons={seasons}
          owners={owners}
          masterTeams={masterTeams}
          viewSeasonId={viewSeasonId}
          historyData={hofData}
          seasonRanking={seasonRanking}
        />
      </div>

      {/* 7. Owners Form */}
      <L2_OwnersForm seasons={seasons} owners={owners} masterTeams={masterTeams} />

      {/* 8. Highlights */}
      <L2_HighlightsCarousel
        seasons={seasons}
        masterTeams={masterTeams}
        owners={owners}
        onHighlightClick={handleHighlightClick}
      />

      {/* 9. Communication */}
      <L2_CommunicationTabs
        user={user}
        posts={posts}
        owners={owners}
        seasons={seasons}
        masterTeams={masterTeams}
        notices={notices}
        matchCommentsData={matchCommentsData}
        setViewMode={setViewMode}
        setCategory={setCategory}
        setSelectedPostId={setSelectedPostId}
      />

      {/* 하이라이트 모달 — activeVideo props 시그니처 사용 */}
      {selectedHighlight && (
        <HighlightViewerModal
          activeVideo={selectedHighlight}
          owners={owners}
          seasons={seasons}
          authUser={user}
          onClose={() => setSelectedHighlight(null)}
        />
      )}
    </div>
  );
}
