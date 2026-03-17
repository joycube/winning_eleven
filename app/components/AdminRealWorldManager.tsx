/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx'; 
import { db } from '../firebase';
import { writeBatch, doc } from 'firebase/firestore';
import { League, MasterTeam, FALLBACK_IMG } from '../types';

interface Props {
    leagues: League[];
    masterTeams: MasterTeam[];
}

export const AdminRealWorldManager = ({ leagues, masterTeams }: Props) => {
    // ------------------------------------------------
    // 1. 상태 관리
    // ------------------------------------------------
    const [viewMode, setViewMode] = useState<'SELECT' | 'EDIT'>('SELECT');
    const [selectedLeagueIds, setSelectedLeagueIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<MasterTeam[]>([]);
    
    // 편집 모드 상태
    const [editTeams, setEditTeams] = useState<MasterTeam[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // ------------------------------------------------
    // 2. 검색 및 필터링 로직
    // ------------------------------------------------
    const leagueTeamCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        leagues.forEach(l => {
            counts[l.name] = masterTeams.filter(t => t.region === l.name).length;
        });
        return counts;
    }, [leagues, masterTeams]);

    useEffect(() => {
        if (!searchTerm || searchTerm.length < 2) {
            setSearchResults([]);
            return;
        }
        const lowerTerm = searchTerm.toLowerCase();
        const results = masterTeams.filter(t => 
            t.name.toLowerCase().includes(lowerTerm) || 
            (t.region && t.region.toLowerCase().includes(lowerTerm))
        );
        setSearchResults(results.slice(0, 5)); 
    }, [searchTerm, masterTeams]);

    const sortLeagues = (list: League[]) => {
        return list.sort((a, b) => {
            const countDiff = (leagueTeamCounts[b.name] || 0) - (leagueTeamCounts[a.name] || 0);
            if (countDiff !== 0) return countDiff;
            return a.name.localeCompare(b.name);
        });
    };

    const clubLeagues = useMemo(() => sortLeagues(leagues.filter(l => l.category === 'CLUB')), [leagues, leagueTeamCounts]);
    const nationalLeagues = useMemo(() => sortLeagues(leagues.filter(l => l.category === 'NATIONAL')), [leagues, leagueTeamCounts]);

    // ------------------------------------------------
    // 3. 핸들러
    // ------------------------------------------------
    const toggleLeague = (leagueName: string) => {
        setSelectedLeagueIds(prev => 
            prev.includes(leagueName) 
                ? prev.filter(id => id !== leagueName)
                : [...prev, leagueName]
        );
    };

    const handleLoadSelectedLeagues = () => {
        if (selectedLeagueIds.length === 0) return alert("하나 이상의 리그를 선택해주세요.");
        
        const targets = masterTeams
            .filter(t => selectedLeagueIds.includes(t.region))
            .map(t => ({ ...t })); 
        
        const sorted = targets.sort((a, b) => {
            if (a.region !== b.region) return a.region.localeCompare(b.region);
            return (a.real_rank || 99) - (b.real_rank || 99);
        });

        setEditTeams(sorted);
        setViewMode('EDIT');
    };

    const handleSelectSearchedTeam = (team: MasterTeam) => {
        setEditTeams([{ ...team }]);
        setViewMode('EDIT');
        setSearchTerm('');
    };

    const handleRemoveTeam = (docIdOrId: string | number) => {
        setEditTeams(prev => prev.filter(t => String(t.docId || t.id) !== String(docIdOrId)));
    };

    const handleBack = () => {
        if (confirm("현재 편집 내용을 저장하지 않고 나가시겠습니까?")) {
            setViewMode('SELECT');
            setEditTeams([]);
        }
    };

    const handleRankChange = (targetTeam: MasterTeam, val: string) => {
        const numVal = val === '' ? 0 : parseInt(val, 10);
        setEditTeams(prev => prev.map(t => {
            const isMatch = t.docId 
                ? t.docId === targetTeam.docId 
                : (t.id === targetTeam.id && t.region === targetTeam.region);
            return isMatch ? { ...t, real_rank: numVal } : t;
        }));
    };

    const handleConditionChange = (targetTeam: MasterTeam, val: string) => {
        setEditTeams(prev => prev.map(t => {
            const isMatch = t.docId 
                ? t.docId === targetTeam.docId 
                : (t.id === targetTeam.id && t.region === targetTeam.region);
            return isMatch ? { ...t, condition: val } : t;
        }));
    };

    const getSimilarity = (str1: string, str2: string) => {
        const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, ''); 
        const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (s1 === s2) return 1;
        if (s1.length < 2 || s2.length < 2) return 0;
        const getBigrams = (str: string) => {
            const bigrams = new Set();
            for (let i = 0; i < str.length - 1; i++) {
                bigrams.add(str.substring(i, i + 2));
            }
            return bigrams;
        };
        const bg1 = getBigrams(s1);
        const bg2 = getBigrams(s2);
        let intersection = 0;
        bg1.forEach(item => { if (bg2.has(item)) intersection++; });
        return (2.0 * intersection) / (bg1.size + bg2.size);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsName = wb.SheetNames[0];
            const ws = wb.Sheets[wsName];
            const data: any[] = XLSX.utils.sheet_to_json(ws);
            
            const isSelectMode = viewMode === 'SELECT';
            
            let baseTeams: MasterTeam[] = [];
            if (isSelectMode) {
                baseTeams = selectedLeagueIds.length > 0 
                    ? masterTeams.filter(t => selectedLeagueIds.includes(t.region))
                    : masterTeams;
            } else {
                baseTeams = editTeams;
            }

            const updatedTeams = baseTeams.map(t => ({...t}));
            const matchedIds = new Set<string>();
            let matchCount = 0;

            data.forEach((row) => {
                const rowValues = Object.values(row).map(v => String(v).trim());
                const excelTeamName = row['Team'] || row['팀명'] || rowValues.find(v => isNaN(Number(v)) && v.length > 3);
                const excelRank = parseInt(row['Rank'] || row['순위'] || rowValues.find(v => !isNaN(Number(v)) && Number(v) > 0 && Number(v) < 30) || '0', 10);
                const excelForm = row['Form'] || row['기세'] || rowValues.find(v => /^[WDLwdl]+$/.test(v) && v.length >= 3);

                if (!excelTeamName) return;

                let bestMatch: MasterTeam | null = null;
                let maxScore = 0;

                updatedTeams.forEach(team => {
                    const score = getSimilarity(team.name, excelTeamName);
                    if (score > 0.4 && score > maxScore) {
                        maxScore = score;
                        bestMatch = team;
                    }
                });

                if (bestMatch && maxScore > 0.4) {
                    const target = bestMatch as MasterTeam;
                    target.real_rank = excelRank;
                    if (excelForm) {
                        const formStr = String(excelForm).toUpperCase();
                        let formScore = 0;
                        for (const char of formStr) {
                            if (char === 'W') formScore += 3;
                            else if (char === 'D') formScore += 1;
                        }
                        if (formScore >= 13) target.condition = 'A'; 
                        else if (formScore >= 10) target.condition = 'B'; 
                        else if (formScore >= 6) target.condition = 'C'; 
                        else if (formScore >= 3) target.condition = 'D'; 
                        else target.condition = 'E'; 
                    }
                    if (target.docId) matchedIds.add(target.docId);
                    else matchedIds.add(String(target.id) + target.region);
                    matchCount++;
                }
            });

            if (matchCount === 0) {
                alert("일치하는 팀을 찾지 못했습니다.");
                return;
            }

            if (isSelectMode) {
                const filteredTeams = updatedTeams.filter(t => t.docId ? matchedIds.has(t.docId) : matchedIds.has(String(t.id) + t.region));
                setEditTeams(filteredTeams);
                setViewMode('EDIT');
                alert(`${matchCount}개 팀 자동 매칭 성공!`);
            } else {
                setEditTeams(updatedTeams);
                alert(`${matchCount}개 팀 업데이트 완료!`);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleSaveAll = async () => {
        if (!confirm(`총 ${editTeams.length}개 팀의 정보를 저장하시겠습니까?`)) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            editTeams.forEach(team => {
                if (team.docId) {
                    const ref = doc(db, 'master_teams', team.docId);
                    batch.update(ref, {
                        real_rank: team.real_rank || 0, 
                        condition: team.condition || 'C'
                    });
                }
            });
            await batch.commit();
            alert("✅ 저장 완료!");
            setViewMode('SELECT'); 
            setEditTeams([]);
        } catch (e) {
            console.error(e);
            alert("저장 중 오류 발생");
        } finally {
            setIsSaving(false);
        }
    };

    // ------------------------------------------------
    // 🖥️ UI 렌더링
    // ------------------------------------------------

    if (viewMode === 'SELECT') {
        return (
            <div className="space-y-6 animate-in fade-in pb-24"> 
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl relative">
                    
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                        <div>
                            <h2 className="text-2xl font-black text-white flex items-center gap-2">
                                🌏 REAL-WORLD PATCH
                            </h2>
                            <p className="text-sm text-slate-400 mt-1 font-medium">실제 축구 데이터를 AI 승부 예측에 반영합니다.</p>
                        </div>
                        <div className="relative w-full md:w-80">
                            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="🔍 팀 검색..." className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:border-emerald-500 outline-none font-bold"/>
                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 w-full bg-slate-800 border border-slate-700 rounded-xl mt-2 shadow-2xl z-50 overflow-hidden">
                                    {searchResults.map(t => (
                                        <div key={t.docId || t.id} onClick={() => handleSelectSearchedTeam(t)} className="flex items-center gap-3 p-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50">
                                            <img src={t.logo} className="w-8 h-8 object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                                            <div><p className="text-sm font-bold text-white">{t.name}</p><p className="text-[10px] text-slate-400">{t.region}</p></div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mb-12">
                        <div className="flex items-center gap-2 mb-4 pl-1"><div className="w-1 h-5 bg-emerald-500 rounded-full"></div><h3 className="text-lg font-bold text-white italic">Club Leagues</h3></div>
                        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
                            {clubLeagues.map(l => (
                                <div key={l.id} onClick={() => toggleLeague(l.name)} className={`relative p-3 md:p-6 rounded-2xl border-2 cursor-pointer transition-all hover:scale-[1.02] flex flex-col items-center gap-2 md:gap-4 ${selectedLeagueIds.includes(l.name) ? 'bg-emerald-900/20 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}>
                                    <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-white p-2 md:p-3.5 flex items-center justify-center shadow-md"><img src={l.logo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /></div>
                                    <div className="text-center w-full"><span className="text-xs md:text-lg font-bold text-white block leading-tight mb-1 truncate">{l.name}</span><span className="text-[8px] md:text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">{leagueTeamCounts[l.name] || 0} Teams</span></div>
                                    {selectedLeagueIds.includes(l.name) && <div className="absolute top-1 right-1 md:top-3 md:right-3 w-4 h-4 md:w-6 md:h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg"><svg className="w-2.5 h-2.5 md:w-4 md:h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="mb-24">
                        <div className="flex items-center gap-2 mb-4 pl-1"><div className="w-1 h-5 bg-blue-500 rounded-full"></div><h3 className="text-lg font-bold text-white italic">National Teams</h3></div>
                        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
                            {nationalLeagues.map(l => (
                                <div key={l.id} onClick={() => toggleLeague(l.name)} className={`relative p-3 md:p-6 rounded-2xl border-2 cursor-pointer transition-all hover:scale-[1.02] flex flex-col items-center gap-2 md:gap-4 ${selectedLeagueIds.includes(l.name) ? 'bg-emerald-900/20 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}>
                                    <div className="w-10 h-10 md:w-16 md:h-16 rounded-full bg-white p-2 md:p-3.5 flex items-center justify-center shadow-md"><img src={l.logo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /></div>
                                    <div className="text-center w-full"><span className="text-xs md:text-lg font-bold text-white block leading-tight mb-1 truncate">{l.name}</span><span className="text-[8px] md:text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">{leagueTeamCounts[l.name] || 0} Teams</span></div>
                                    {selectedLeagueIds.includes(l.name) && <div className="absolute top-1 right-1 md:top-3 md:right-3 w-4 h-4 md:w-6 md:h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg"><svg className="w-2.5 h-2.5 md:w-4 md:h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-[95%] max-w-5xl z-50">
                        <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-600 p-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex flex-col md:flex-row items-center justify-between gap-4">
                            
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
                                    <span className="text-xl">📢</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-white font-bold text-sm">
                                        {selectedLeagueIds.length > 0 ? (
                                            <>현재 <span className="text-emerald-400">{selectedLeagueIds.length}개 리그</span>가 선택되었습니다.</>
                                        ) : (
                                            <span className="text-slate-400">편집할 리그를 선택하거나 엑셀을 업로드하세요.</span>
                                        )}
                                    </span>
                                    <span className="text-[10px] text-slate-500">선택된 팀들의 데이터를 일괄 수정할 수 있습니다.</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <label className="flex-1 md:flex-none bg-blue-700 hover:bg-blue-600 text-white font-bold py-3 px-5 rounded-xl border border-blue-500 shadow-lg cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 text-sm whitespace-nowrap group">
                                    <span className="group-hover:animate-bounce">🚀</span> 엑셀 대량 업데이트
                                    <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                                </label>

                                <button 
                                    onClick={handleLoadSelectedLeagues}
                                    disabled={selectedLeagueIds.length === 0}
                                    className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3 px-8 rounded-xl border border-emerald-500 shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 text-sm whitespace-nowrap"
                                >
                                    다음 단계 <span className="text-lg">🚗</span>
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-right-10 fade-in duration-300 pb-24">
            <div className="bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6 border-b border-slate-800 pb-4 sm:pb-6">
                    <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                        <button onClick={handleBack} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-white transition-colors shrink-0">←</button>
                        <div className="min-w-0">
                            <h2 className="text-lg sm:text-xl font-bold text-white truncate">📝 데이터 편집 <span className="text-emerald-400">({editTeams.length}팀)</span></h2>
                            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">순위와 컨디션을 수정합니다.</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 sm:p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                            {editTeams.map((t) => (
                                // 🔥 [핵심 디벨롭] 좁은 스마트폰에서도 절대 깨지지 않도록 레이아웃 슬림화 및 flex-wrap 적용
                                <div key={t.docId || t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 shadow-sm hover:border-slate-700 transition-colors relative group">
                                    <button 
                                        onClick={() => handleRemoveTeam(String(t.docId || t.id))}
                                        className="absolute top-2 right-2 w-6 h-6 bg-slate-800/80 hover:bg-red-900 text-slate-400 hover:text-white rounded-full flex items-center justify-center transition-all z-10 text-[10px] font-bold backdrop-blur-sm"
                                        title="목록에서 제거"
                                    >
                                        ✕
                                    </button>

                                    {/* 좌측: 팀 정보 영역 (슬림화) */}
                                    <div className="flex items-center gap-3 flex-1 w-full min-w-0 pr-6">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center shadow-inner p-2 shrink-0">
                                            <img src={t.logo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG}/>
                                        </div>
                                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                            <h3 className="text-sm sm:text-base font-black text-white tracking-tight truncate leading-tight" title={t.name}>{t.name}</h3>
                                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap mt-0.5">
                                                <span className="text-[9px] text-slate-500 font-bold bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-700/50 truncate max-w-[100px] sm:max-w-[120px]">{t.region}</span>
                                                <span className="bg-white text-slate-900 text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-md inline-flex items-center gap-1 shrink-0">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${t.tier === 'S' ? 'bg-yellow-400' : t.tier === 'A' ? 'bg-emerald-400' : 'bg-slate-400'}`}></span>
                                                    {t.tier} CLASS
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 우측: 랭크 및 컨디션 입력 영역 (가로 넘침 방지) */}
                                    <div className="flex flex-col gap-2 w-full sm:w-auto bg-slate-950/50 p-2.5 sm:p-3 rounded-xl border border-slate-800/50 shrink-0">
                                        <div className="flex items-center justify-between gap-3 border-b border-slate-800/50 pb-2 mb-0.5">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Real Rank</span>
                                            <input type="number" value={t.real_rank || ''} onChange={(e) => handleRankChange(t, e.target.value)} placeholder="-" className="w-14 sm:w-16 h-7 sm:h-8 bg-slate-900 border border-slate-700 rounded-lg text-center text-white text-sm sm:text-base font-black focus:border-emerald-500 outline-none shadow-inner"/>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 sm:gap-3">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Condition</span>
                                            <div className="flex bg-slate-900 rounded-md p-0.5 border border-slate-700 shadow-inner flex-1 justify-between max-w-[140px] sm:max-w-[160px]">
                                                {/* 버튼 사이즈를 줄여 좁은 화면에서도 5개가 한 줄에 들어가도록 처리 */}
                                                {['A','B','C','D','E'].map(cond => (
                                                    <button key={cond} onClick={() => handleConditionChange(t, cond)} className={`w-5 h-5 sm:w-6 sm:h-6 text-[9px] sm:text-[10px] font-black rounded flex items-center justify-center transition-all duration-200 ${(t.condition || 'C') === cond ? cond === 'A' ? 'bg-emerald-500 text-black' : cond === 'B' ? 'bg-teal-500 text-black' : cond === 'D' ? 'bg-orange-500 text-black' : cond === 'E' ? 'bg-red-500 text-white' : 'bg-slate-500 text-white' : 'text-slate-600 hover:bg-slate-800'}`}>{cond}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    {t.real_rank !== masterTeams.find(mt=>mt.id===t.id)?.real_rank && <div className="absolute top-0 left-0 w-full h-full border-2 border-emerald-500/30 rounded-2xl pointer-events-none animate-pulse"></div>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="fixed bottom-4 sm:bottom-6 left-1/2 transform -translate-x-1/2 w-[95%] max-w-5xl z-50">
                    <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-600 p-3 sm:p-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                        <div className="text-white font-bold text-xs sm:text-sm ml-2 self-start sm:self-center">
                            <span className="text-emerald-400">{editTeams.filter(t => t.real_rank !== masterTeams.find(mt => mt.id === t.id)?.real_rank || t.condition !== masterTeams.find(mt => mt.id === t.id)?.condition).length}개 팀</span> 수정 중
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                             <label className="flex-1 sm:flex-none bg-blue-700 hover:bg-blue-600 text-white font-bold py-2.5 sm:py-3 px-3 sm:px-5 rounded-xl border border-blue-500 shadow-lg cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm whitespace-nowrap group">
                                <span className="group-hover:animate-bounce">🚀</span> 엑셀 추가
                                <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                            </label>
                            <button onClick={handleSaveAll} disabled={isSaving} className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 sm:py-3 px-6 sm:px-8 rounded-xl border border-emerald-500 shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm whitespace-nowrap">
                                {isSaving ? '저장 중...' : '💾 저장하기'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};