"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase'; 
import { User, Clock } from 'lucide-react';
import MatchTalkBoard from './MatchTalkBoard';

// 분리된 컴포넌트들 임포트
import L_LockerRoomDashboard from './L_LockerRoomDashboard';
import L_CommunityList from './L_CommunityList';
import L_PostDetail from './L_PostDetail';
import L_PostEditor from './L_PostEditor';

interface UserData {
  uid: string;
  mappedOwnerId: string;
  role?: 'ADMIN' | 'USER';
  photoUrl?: string;
  photoURL?: string; 
  photo?: string;
}

interface LockerRoomViewProps {
  user: UserData | null;
  notices: any[];
  seasons?: any[];
  masterTeams?: any[];
  owners?: any[];
  activeRankingData?: any; 
  historyData?: any; 
  activeSeason?: any; 
}

const normalizeName = (str?: string | null): string => (str || '').replace(/[\s\.\-\_]/g, '').toLowerCase();

export default function LockerRoomView({ user, notices = [], seasons = [], masterTeams = [], owners = [], activeRankingData, historyData, activeSeason }: LockerRoomViewProps) {
  const [posts, setPosts] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'MAIN' | 'LIST' | 'WRITE' | 'EDIT'>('MAIN');
  const [category, setCategory] = useState('전체');
  
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [uidDict, setUidDict] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchHistoryDict = async () => {
        const snap = await getDocs(collection(db, 'history_records'));
        const dict: Record<string, string> = {};
        snap.docs.forEach(doc => {
            const data = doc.data();
            data.teams?.forEach((t:any) => {
                if (t.owner && t.ownerId) dict[t.owner] = t.ownerId;
                if (t.legacyName && t.ownerId) dict[t.legacyName] = t.ownerId;
            });
        });
        setUidDict(dict);
    };
    fetchHistoryDict();
  }, []);

  const isMaster = useMemo(() => {
      if (!user) return false;
      if (user.role === 'ADMIN') return true; 
      const targetFuzzy = normalizeName(user.mappedOwnerId);
      return owners?.some(o => {
          const isNameMatch = normalizeName(o.nickname) === targetFuzzy;
          const isIdMatch = String(o.id) === user.uid || String((o as any).docId) === user.uid;
          return (isNameMatch || isIdMatch) && (o as any).role === 'ADMIN';
      });
  }, [user, owners]);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedPosts.sort((a: any, b: any) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));
      setPosts(fetchedPosts);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const syncState = () => {
        const params = new URLSearchParams(window.location.search);
        const pId = params.get('postId');
        const currentView = params.get('view');
        if (currentView === 'LOCKERROOM') {
            if (!pId) { setSelectedPostId(null); setViewMode('MAIN'); } 
            else if (pId && pId !== selectedPostId) { setSelectedPostId(pId); setViewMode('LIST'); } 
        }
    };
    syncState();
    window.addEventListener('popstate', syncState);
    return () => window.removeEventListener('popstate', syncState);
  }, [selectedPostId]);

  // 🔥 요청하신 대로 로그인 차단 로직을 완전히 제거/주석 처리했습니다.
  /*
  if (!user) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center animate-in fade-in zoom-in-95 mt-10">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-5 shadow-lg border border-slate-700"><User size={32} className="text-slate-400" /></div>
              <h2 className="text-xl font-black text-white italic mb-2 tracking-tighter">구단주 로그인이 필요합니다</h2>
              <p className="text-slate-400 text-xs font-medium">우측 상단의 로그인 버튼을 눌러 계정을 연결해주세요.</p>
          </div>
      );
  }

  if (!user.mappedOwnerId) {
      return (
          <div className="max-w-md mx-auto mt-10 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-5 text-center">
              <div className="flex justify-center mb-5 relative"><Clock size={50} className="text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] animate-pulse" /></div>
              <h2 className="text-2xl font-black text-white italic tracking-tighter mb-2">라이선스 발급 대기 중</h2>
              <p className="text-slate-400 text-[11px] mb-8 leading-relaxed px-4">현재 접속 중인 계정의 보안 승인 절차가 진행 중입니다.<br/>리그 관리자가 <strong className="text-yellow-500">구단주 명부 연동</strong>을 완료하면<br/>자동으로 구단주실이 오픈됩니다.</p>
          </div>
      );
  }
  */

  return (
    <div className="max-w-[700px] mx-auto p-0 sm:p-2 space-y-6 pb-20">
      <style jsx>{`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* 모드에 따른 화면 분기 렌더링 */}
      {(viewMode === 'WRITE' || viewMode === 'EDIT') && (
          <L_PostEditor user={user} owners={owners} viewMode={viewMode} setViewMode={setViewMode} editingPostId={editingPostId} setEditingPostId={setEditingPostId} posts={posts} setSelectedPostId={setSelectedPostId} />
      )}

      {viewMode === 'MAIN' && (
          <L_LockerRoomDashboard user={user} notices={notices} seasons={seasons} masterTeams={masterTeams} owners={owners} historyData={historyData} activeSeason={activeSeason} posts={posts} uidDict={uidDict} setViewMode={setViewMode} setCategory={setCategory} setSelectedPostId={setSelectedPostId} />
      )}

      {viewMode === 'LIST' && (
        <>
          {selectedPostId ? (
              selectedPostId.startsWith('match_') ? (
                  <MatchTalkBoard user={user} seasons={seasons} masterTeams={masterTeams} owners={owners} activeRankingData={activeRankingData} selectedMatchId={selectedPostId} 
                      onSelectMatch={(id) => { setSelectedPostId(id); const params = new URLSearchParams(window.location.search); params.set('view', 'LOCKERROOM'); params.set('postId', id); window.history.pushState(null, '', `?${params.toString()}`); }} 
                      onClose={() => { setSelectedPostId(null); setViewMode('MAIN'); }} 
                  />
              ) : (
                  <L_PostDetail user={user} owners={owners} notices={notices} posts={posts} selectedPostId={selectedPostId} isMaster={isMaster} setViewMode={setViewMode} setSelectedPostId={setSelectedPostId} setEditingPostId={setEditingPostId} />
              )
          ) : (
              category === '매치톡' ? (
                  <MatchTalkBoard user={user} seasons={seasons} masterTeams={masterTeams} owners={owners} activeRankingData={activeRankingData} selectedMatchId={null} 
                      onSelectMatch={(id) => { setSelectedPostId(id); const params = new URLSearchParams(window.location.search); params.set('view', 'LOCKERROOM'); params.set('postId', id); window.history.pushState(null, '', `?${params.toString()}`); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                      onClose={() => { setSelectedPostId(null); setViewMode('MAIN'); }} 
                  />
              ) : (
                  <L_CommunityList user={user} notices={notices} posts={posts} category={category} setCategory={setCategory} setViewMode={setViewMode} setSelectedPostId={setSelectedPostId} />
              )
          )}
        </>
      )}
    </div>
  );
}