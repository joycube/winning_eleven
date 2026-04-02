"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase'; 
import { User, Clock } from 'lucide-react';
import MatchTalkBoard from './MatchTalkBoard';

import L_LockerRoomDashboard from './L_LockerRoomDashboard';
import L_CommunityList from './L_CommunityList';
import L_PostDetail from './L_PostDetail';
import L_PostEditor from './L_PostEditor';
import L_HighlightsBoard from './L_HighlightsBoard';

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
  viewSeasonId?: number; 
  setViewSeasonId?: any; 
}

const normalizeName = (str?: string | null): string => (str || '').replace(/[\s\.\-\_]/g, '').toLowerCase();

export default function LockerRoomView({ user, notices = [], seasons = [], masterTeams = [], owners = [], activeRankingData, historyData, activeSeason, viewSeasonId, setViewSeasonId }: LockerRoomViewProps) {
  const [posts, setPosts] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'MAIN' | 'LIST' | 'WRITE' | 'EDIT' | 'HIGHLIGHTS'>('MAIN');
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
    const q = query(collection(db, 'highlights'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedHighlights = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHighlights(fetchedHighlights);
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

  const handleCloseToMain = () => {
      setSelectedPostId(null);
      setViewMode('MAIN');
      const params = new URLSearchParams(window.location.search);
      params.delete('postId'); 
      window.history.pushState(null, '', `/?${params.toString()}`);
      window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  return (
    // 🚨 픽스: space-y-6, pb-20 등 여백을 만드는 모든 옵션을 제거하여 0으로 만듦
    <div className="max-w-screen-xl w-full mx-auto p-0 sm:p-2 px-2 sm:px-4 pb-0 mb-0">
      <style jsx>{`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {(viewMode === 'WRITE' || viewMode === 'EDIT') && (
          <L_PostEditor user={user} owners={owners} viewMode={viewMode} setViewMode={setViewMode} editingPostId={editingPostId} setEditingPostId={setEditingPostId} posts={posts} setSelectedPostId={setSelectedPostId} />
      )}

      {viewMode === 'MAIN' && (
          <L_LockerRoomDashboard 
              user={user} notices={notices} seasons={seasons} masterTeams={masterTeams} 
              owners={owners} historyData={historyData} activeSeason={activeSeason} 
              posts={posts} highlights={highlights} uidDict={uidDict} 
              setViewMode={setViewMode} setCategory={setCategory} setSelectedPostId={setSelectedPostId} 
              activeRankingData={activeRankingData}
              viewSeasonId={viewSeasonId} 
              setViewSeasonId={setViewSeasonId} 
          />
      )}

      {viewMode === 'HIGHLIGHTS' && (
          <L_HighlightsBoard highlights={highlights} owners={owners} seasons={seasons} setViewMode={setViewMode} />
      )}

      {viewMode === 'LIST' && (
        <>
          {selectedPostId ? (
              selectedPostId.startsWith('match_') ? (
                  <MatchTalkBoard user={user} seasons={seasons} masterTeams={masterTeams} owners={owners} activeRankingData={activeRankingData} selectedMatchId={selectedPostId} 
                      onSelectMatch={(id) => { setSelectedPostId(id); const params = new URLSearchParams(window.location.search); params.set('view', 'LOCKERROOM'); params.set('postId', id); window.history.pushState(null, '', `?${params.toString()}`); }} 
                      onClose={handleCloseToMain} 
                  />
              ) : (
                  <L_PostDetail user={user} owners={owners} notices={notices} posts={posts} selectedPostId={selectedPostId} isMaster={isMaster} setViewMode={setViewMode} setSelectedPostId={setSelectedPostId} setEditingPostId={setEditingPostId} />
              )
          ) : (
              category === '매치톡' ? (
                  <MatchTalkBoard user={user} seasons={seasons} masterTeams={masterTeams} owners={owners} activeRankingData={activeRankingData} selectedMatchId={null} 
                      onSelectMatch={(id) => { setSelectedPostId(id); const params = new URLSearchParams(window.location.search); params.set('view', 'LOCKERROOM'); params.set('postId', id); window.history.pushState(null, '', `?${params.toString()}`); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                      onClose={handleCloseToMain} 
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