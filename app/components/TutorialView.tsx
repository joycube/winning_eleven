import React from 'react';

export const TutorialView = () => {
  return (
    <div className="space-y-8 animate-in fade-in pb-20">
        
        {/* 헤더 섹션 */}
        <div className="text-center space-y-2 py-4">
            <h1 className="text-3xl md:text-4xl font-black italic text-white tracking-tighter">
                <span className="text-emerald-400">WINNING ELEVEN</span> LEAGUE MANUAL
            </h1>
            <p className="text-slate-400 text-sm md:text-base">
                리그 운영 시스템의 모든 기능을 설명하는 공식 가이드북입니다.
            </p>
        </div>

        {/* 1. 초기 세팅 가이드 */}
        <section className="bg-slate-900/80 rounded-3xl border border-slate-800 overflow-hidden">
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center gap-3">
                <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded">STEP 1</span>
                <h2 className="text-lg font-bold text-white">기초 데이터 세팅 (Admin)</h2>
            </div>
            <div className="p-6 space-y-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 space-y-2">
                        <h3 className="text-emerald-400 font-bold text-sm">👤 오너(플레이어) 등록</h3>
                        <p className="text-slate-400 text-xs leading-relaxed">
                            가장 먼저 리그에 참여할 실제 플레이어들을 등록해야 합니다. 
                            <br/>[ADMIN] &gt; [오너 관리] 탭에서 닉네임과 프로필 사진을 등록하세요.
                        </p>
                    </div>
                    <div className="flex-1 space-y-2">
                        <h3 className="text-emerald-400 font-bold text-sm">🛡️ 마스터 팀 관리</h3>
                        <p className="text-slate-400 text-xs leading-relaxed">
                            사용될 축구 팀 데이터베이스입니다. 
                            <br/>[ADMIN] &gt; [팀 관리] 탭에서 팀 로고, 이름, 리그(Region), 등급(Tier)을 관리할 수 있습니다.
                            <br/>* 팁: &apos;빠른 등급 설정&apos; 기능을 켜면 리스트에서 바로 등급(S/A/B/C)을 수정할 수 있습니다.
                        </p>
                    </div>
                </div>
            </div>
        </section>

        {/* 2. 시즌 생성 가이드 */}
        <section className="bg-slate-900/80 rounded-3xl border border-slate-800 overflow-hidden">
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center gap-3">
                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">STEP 2</span>
                <h2 className="text-lg font-bold text-white">시즌 개설하기</h2>
            </div>
            <div className="p-6">
                <ul className="space-y-4 text-sm text-slate-300">
                    <li className="flex gap-3">
                        <span className="text-xl">🏆</span>
                        <div>
                            <strong className="text-white block mb-1">시즌 생성</strong>
                            [ADMIN] &gt; [새 시즌 생성] 탭에서 시즌 이름을 입력하고 모드를 선택합니다.
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <div className="bg-slate-800 p-2 rounded text-xs border border-slate-700">
                                    <span className="text-emerald-400 font-bold">LEAGUE (리그)</span>
                                    <p className="text-slate-500 mt-1">승점제 방식. 풀리그(Single) 또는 홈&어웨이(Double) 선택 가능.</p>
                                </div>
                                <div className="bg-slate-800 p-2 rounded text-xs border border-slate-700">
                                    <span className="text-purple-400 font-bold">TOURNAMENT (토너먼트)</span>
                                    <p className="text-slate-500 mt-1">패배 시 탈락하는 대진표 방식. 결승전까지 진행됩니다.</p>
                                </div>
                            </div>
                        </div>
                    </li>
                    <li className="flex gap-3">
                        <span className="text-xl">💰</span>
                        <div>
                            <strong className="text-white block mb-1">상금 설정</strong>
                            시즌 생성 시 1, 2, 3위 및 득점왕/도움왕 상금을 미리 설정할 수 있습니다. 이 데이터는 나중에 &apos;역대 기록&apos;에 합산됩니다.
                        </div>
                    </li>
                </ul>
            </div>
        </section>

        {/* 3. 팀 드래프트 가이드 */}
        <section className="bg-slate-900/80 rounded-3xl border border-slate-800 overflow-hidden">
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center gap-3">
                <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded">STEP 3</span>
                <h2 className="text-lg font-bold text-white">팀 매칭 (드래프트)</h2>
            </div>
            <div className="p-6 space-y-6">
                <p className="text-sm text-slate-400 mb-4">
                    [ADMIN] 페이지 하단에서 생성한 시즌을 선택하여 관리 모드로 진입합니다.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <div className="text-2xl mb-2">⚡</div>
                        <h4 className="font-bold text-white mb-2">퀵 매칭 (추천)</h4>
                        <p className="text-xs text-slate-400">
                            카드깡(Pack Opening) 연출을 통해 오너별로 팀을 무작위 배정합니다. 게임의 재미를 위해 가장 추천하는 방식입니다.
                        </p>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <div className="text-2xl mb-2">🎰</div>
                        <h4 className="font-bold text-white mb-2">랜덤 룰렛</h4>
                        <p className="text-xs text-slate-400">
                            특정 오너를 선택하고 룰렛을 돌려 팀을 하나씩 배정합니다. 필터(리그, 등급 등)를 걸고 돌릴 수 있습니다.
                        </p>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <div className="text-2xl mb-2">👆</div>
                        <h4 className="font-bold text-white mb-2">수동 선택</h4>
                        <p className="text-xs text-slate-400">
                            오너 선택 후, 하단의 팀 리스트를 직접 클릭하여 원하는 팀을 지정해 줄 수 있습니다.
                        </p>
                    </div>
                </div>

                <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-xl flex gap-3 items-start">
                    <span className="text-xl">⚠️</span>
                    <div>
                        <strong className="text-red-400 text-sm">주의사항</strong>
                        <p className="text-xs text-red-200/70 mt-1">
                            팀 배정이 모두 끝나면 반드시 <span className="font-bold text-white underline">Generate Schedule</span> 버튼을 눌러 대진표를 확정해야 합니다.
                            <br/>스케줄이 생성된 이후에는 팀을 추가하거나 삭제할 수 없습니다. (수정하려면 스케줄 초기화 필요)
                        </p>
                    </div>
                </div>
            </div>
        </section>

        {/* 4. 경기 진행 및 기록 */}
        <section className="bg-slate-900/80 rounded-3xl border border-slate-800 overflow-hidden">
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center gap-3">
                <span className="bg-orange-600 text-white text-xs font-bold px-2 py-1 rounded">STEP 4</span>
                <h2 className="text-lg font-bold text-white">경기 진행 및 기록</h2>
            </div>
            <div className="p-6">
                <div className="space-y-6 text-sm text-slate-300">
                    <div className="flex gap-4 items-start">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white shrink-0">1</div>
                        <div>
                            <h4 className="font-bold text-white text-base mb-1">결과 입력</h4>
                            <p className="text-xs text-slate-400">
                                [SCHEDULE] 메뉴에서 진행할 경기를 클릭하면 입력 모달이 뜹니다. 스코어를 입력하고, 득점자(Scorer)와 도움(Assist) 선수를 추가하세요.
                                <br/>오너별/선수별 통계가 자동으로 집계됩니다.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white shrink-0">2</div>
                        <div>
                            <h4 className="font-bold text-white text-base mb-1">토너먼트 자동 진출</h4>
                            <p className="text-xs text-slate-400">
                                토너먼트 모드에서는 승리한 팀이 자동으로 다음 대진표로 이동합니다. 
                                <br/>무승부일 경우 &apos;Home 승&apos; 또는 &apos;Away 승&apos; 버튼을 눌러 승부차기 승자를 지정해주세요.
                                <br/>부전승(BYE) 상대를 만난 팀은 결과 저장 시 자동으로 다음 라운드로 진출합니다.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white shrink-0">3</div>
                        <div>
                            <h4 className="font-bold text-white text-base mb-1">유튜브 하이라이트</h4>
                            <p className="text-xs text-slate-400">
                                경기 결과 입력 창 하단에 유튜브 링크를 넣으면, 스케줄 리스트에 <span className="text-red-500">▶</span> 버튼이 활성화됩니다.
                                <br/>클릭 시 하이라이트 영상을 바로 시청할 수 있습니다.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* 5. 랭킹 및 히스토리 */}
        <section className="bg-slate-900/80 rounded-3xl border border-slate-800 overflow-hidden">
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center gap-3">
                <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded">VIEW</span>
                <h2 className="text-lg font-bold text-white">랭킹 & 히스토리</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="text-emerald-400 font-bold mb-2">📊 실시간 랭킹 (RANKING)</h3>
                    <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                        <li>현재 시즌의 팀 순위표 (승점, 득실차, 다득점 순)</li>
                        <li>오너별 통합 순위 (보유 팀들의 성적 합산)</li>
                        <li>개인 기록 (득점왕, 도움왕 랭킹)</li>
                    </ul>
                </div>
                <div>
                    <h3 className="text-emerald-400 font-bold mb-2">📜 명예의 전당 (HISTORY)</h3>
                    <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                        <li>역대 모든 시즌의 누적 기록</li>
                        <li>오너별 통산 우승 횟수(금/은/동) 및 누적 상금</li>
                        <li>통산 최다 득점/도움 선수 기록</li>
                    </ul>
                </div>
            </div>
        </section>

        <div className="text-center pt-8 border-t border-slate-800/50">
            <p className="text-slate-500 text-xs italic">
                Designed & Developed by JoyCube System
            </p>
        </div>
    </div>
  );
};