"use client";

import React, { useState } from 'react';
import { LiveFeed } from './LiveFeed';
import { MatchTalkCarousel } from './MatchTalkCarousel';
import { ChevronRight, MessageSquare, Radio, FileText, Edit3 } from 'lucide-react';

interface Props {
  user: any;
  posts: any[];
  owners: any[];
  seasons: any[];
  masterTeams: any[];
  notices: any[];
  matchCommentsData?: any[];
  setViewMode: (mode: any) => void;
  setCategory: (cat: string) => void;
  setSelectedPostId: (id: string | null) => void;
  onNavigateToMatch?: (params: { id: string, seasonId: number }) => void;
}

type Tab = 'TALK' | 'FEED' | 'BOARD';

/**
 * 🛠️ [L2] Communication 3탭
 *  - 매치톡 (MatchTalkCarousel)
 *  - 라이브피드 (LiveFeed dashboard 모드)
 *  - 자유게시판 (게시글 리스트 미리보기 + 전체보기 버튼)
 */
export const L2_CommunicationTabs = ({
  user, posts, owners, seasons, masterTeams, notices, matchCommentsData = [],
  setViewMode, setCategory, setSelectedPostId, onNavigateToMatch,
}: Props) => {
  const [tab, setTab] = useState<Tab>('TALK');

  // posts 상단 5개 (공지 + 일반 + 투표 섞어서)
  const previewPosts = (posts || []).slice(0, 5);

  const goToMatchTalk = () => {
    setCategory('매치톡');
    setViewMode('LIST');
    setSelectedPostId(null);
  };

  const goToBoard = (category = '전체') => {
    setCategory(category);
    setViewMode('LIST');
    setSelectedPostId(null);
  };

  const goToWrite = () => {
    setViewMode('WRITE');
  };

  const openPost = (postId: string) => {
    setSelectedPostId(postId);
    setViewMode('LIST');
    const params = new URLSearchParams(window.location.search);
    params.set('view', 'LOCKERROOM');
    params.set('postId', postId);
    window.history.pushState(null, '', `?${params.toString()}`);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 sm:p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-[3px] h-[14px] rounded bg-orange-500" />
          <span className="text-[13px] font-black italic text-white tracking-wide">COMMUNICATION</span>
        </div>
        {user && (
          <button
            onClick={goToWrite}
            className="flex items-center gap-1 text-[10px] bg-orange-600 hover:bg-orange-500 text-white px-2.5 py-1 rounded-md font-bold transition"
          >
            <Edit3 size={11} /> 글쓰기
          </button>
        )}
      </div>

      {/* 탭 버튼 */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        <button
          onClick={() => setTab('TALK')}
          className={`px-2 py-2 rounded-lg text-[11px] font-black italic transition flex items-center justify-center gap-1 ${
            tab === 'TALK' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          <MessageSquare size={12} /> 매치톡
        </button>
        <button
          onClick={() => setTab('FEED')}
          className={`px-2 py-2 rounded-lg text-[11px] font-black italic transition flex items-center justify-center gap-1 ${
            tab === 'FEED' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          <Radio size={12} /> 라이브
        </button>
        <button
          onClick={() => setTab('BOARD')}
          className={`px-2 py-2 rounded-lg text-[11px] font-black italic transition flex items-center justify-center gap-1 ${
            tab === 'BOARD' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          <FileText size={12} /> 게시판
        </button>
      </div>

      {/* 매치톡 */}
      {tab === 'TALK' && (
        <div>
          <MatchTalkCarousel
            seasons={seasons}
            matchCommentsData={matchCommentsData}
            owners={owners}
            masterTeams={masterTeams}
            onNavigateToMatch={(params) => {
              if (onNavigateToMatch) onNavigateToMatch(params);
              else {
                setSelectedPostId(`match_${params.id}`);
                setViewMode('LIST');
                const sp = new URLSearchParams(window.location.search);
                sp.set('view', 'LOCKERROOM');
                sp.set('postId', `match_${params.id}`);
                window.history.pushState(null, '', `?${sp.toString()}`);
              }
            }}
          />
          <button
            onClick={goToMatchTalk}
            className="w-full mt-2 py-2 text-[11px] text-orange-300 hover:text-orange-200 font-bold flex items-center justify-center gap-1 border border-orange-900/40 hover:border-orange-700 rounded-md transition"
          >
            모든 매치톡 보기 <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* 라이브피드 */}
      {tab === 'FEED' && (
        <div>
          <LiveFeed
            mode="dashboard"
            posts={posts}
            owners={owners}
            seasons={seasons}
          />
        </div>
      )}

      {/* 자유게시판 */}
      {tab === 'BOARD' && (
        <div>
          {previewPosts.length === 0 ? (
            <div className="text-center py-6 text-[11px] text-slate-500">아직 게시글이 없습니다</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {previewPosts.map((p: any) => {
                const isPinned = p.isPinned;
                const isPoll = p.type === 'POLL' || p.pollOptions;
                const cat = isPinned ? '📢 공지' : isPoll ? '🗳 투표' : '📝 일반';
                const catColor = isPinned ? 'text-red-400 bg-red-950/30 border-red-900/40' :
                  isPoll ? 'text-purple-400 bg-purple-950/30 border-purple-900/40' :
                  'text-slate-400 bg-slate-800 border-slate-700';
                return (
                  <button
                    key={p.id}
                    onClick={() => openPost(p.id)}
                    className="flex items-center gap-2 p-2 bg-slate-800/50 hover:bg-slate-800 rounded-md text-left transition"
                  >
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${catColor} whitespace-nowrap`}>
                      {cat}
                    </span>
                    <span className="text-[11px] text-slate-200 font-medium truncate flex-1">{p.title || '(제목 없음)'}</span>
                    <span className="text-[9px] text-slate-500 whitespace-nowrap">{p.authorName || ''}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={() => goToBoard('전체')}
              className="py-2 text-[11px] text-orange-300 hover:text-orange-200 font-bold flex items-center justify-center gap-1 border border-orange-900/40 hover:border-orange-700 rounded-md transition"
            >
              전체 게시판 <ChevronRight size={12} />
            </button>
            {user && (
              <button
                onClick={goToWrite}
                className="py-2 text-[11px] text-white font-bold flex items-center justify-center gap-1 bg-orange-600 hover:bg-orange-500 rounded-md transition"
              >
                <Edit3 size={11} /> 새 글 작성
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
