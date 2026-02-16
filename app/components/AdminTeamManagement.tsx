/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import { db } from '../firebase';
import { addDoc, collection, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { League, MasterTeam, FALLBACK_IMG } from '../types'; 
import { getSortedLeagues, getTierBadgeColor, getSortedTeamsLogic } from '../utils/helpers'; 

// 🔥 [수정] TierSelector 컴포넌트: isMini일 때 버튼 사이즈 및 레이아웃 최적화
const TierSelector = ({ value, onChange, isMini = false }: { value: string, onChange: (t: string) => void, isMini?: boolean }) => {
    const tiers = ['S', 'A', 'B', 'C'];
    return (
        <div className={`flex items-center justify-center w-full ${isMini ? 'gap-1 mt-2' : 'gap-1'}`}>
            {tiers.map(t => (
                <button 
                    key={t} 
                    onClick={(e) => { e.stopPropagation(); onChange(t); }}
                    className={`font-bold transition-all border flex items-center justify-center ${
                        isMini 
                        ? 'w-6 h-6 rounded text-[10px] p-0 flex-shrink-0' 
                        : 'flex-1 py-2 rounded-lg text-xs'
                    } ${
                        value === t 
                        ? getTierBadgeColor(t) + ' ring-1 ring-white' 
                        : 'bg-slate-900 text-slate-500 border-slate-700 hover:bg-slate-800'
                    }`} 
                >
                    {t}
                </button>
            ))}
        </div>
    );
};

export const AdminLeagueManager = ({ leagues, masterTeams }: { leagues: League[], masterTeams: MasterTeam[] }) => {
    const [name, setName] = useState('');
    const [logo, setLogo] = useState('');
    const [cat, setCat] = useState<'CLUB'|'NATIONAL'>('CLUB');
    const [editId, setEditId] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const handleSave = async () => {
        if (!name) return alert("리그 이름을 입력하세요.");
        if (editId) {
            await updateDoc(doc(db, "leagues", editId), { name, logo, category: cat });
            setEditId(null);
        } else {
            await addDoc(collection(db, "leagues"), { id: Date.now(), name, logo, category: cat });
        }
        setName(''); setLogo('');
    };

    const handleEdit = (l: League) => {
        setEditId(l.docId!);
        setName(l.name);
        setLogo(l.logo);
        setCat(l.category);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (l: League) => {
        if (!confirm(`'${l.name}' 리그를 삭제하시겠습니까?\n소속된 팀들은 'Unassigned'로 변경됩니다.`)) return;
        const teamsToUpdate = masterTeams.filter(t => t.region === l.name);
        const batch = writeBatch(db);
        teamsToUpdate.forEach(t => { if(t.docId) batch.update(doc(db, "master_teams", t.docId), { region: 'Unassigned' }); });
        await batch.commit();
        if (l.docId) await deleteDoc(doc(db, "leagues", l.docId));
        if (editId === l.docId) { setEditId(null); setName(''); setLogo(''); }
    };

    const renderLeagueList = (category: 'CLUB' | 'NATIONAL', title: string) => {
        let targets = leagues.filter(l => l.category === category);
        if (search) targets = targets.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));
        
        const sortedNames = getSortedLeagues(targets.map(l => l.name));
        const displayList = sortedNames.map(name => targets.find(l => l.name === name)).filter(Boolean) as League[];

        if (displayList.length === 0) return null;

        return (
            <div className="space-y-2 mb-6">
                <h3 className={`text-sm font-bold border-l-4 pl-2 ${category === 'CLUB' ? 'text-emerald-400 border-emerald-500' : 'text-blue-400 border-blue-500'}`}>{title}</h3>
                {/* 🔥 [수정] 반응형 그리드 적용: 모바일 2, 태블릿 3, 데스크탑 5열 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {displayList.map(l => (
                        <div key={l.id} onClick={() => handleEdit(l)} className={`p-4 rounded-xl border cursor-pointer transition-all group relative aspect-square flex flex-col items-center justify-center ${editId === l.docId ? 'bg-blue-900/30 border-blue-500 ring-1 ring-blue-500' : 'bg-slate-900 border-slate-800 hover:border-emerald-500 hover:bg-slate-800'}`}>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-12 h-12 bg-white rounded-full p-2 shadow-sm flex items-center justify-center">
                                    <img src={l.logo || FALLBACK_IMG} className="w-full h-full object-contain" alt=""/>
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-xs text-white group-hover:text-emerald-400 transition-colors leading-tight">{l.name}</p>
                                    <span className="text-[9px] text-slate-500 mt-1 block">{masterTeams.filter(t => t.region === l.name).length} Teams</span>
                                </div>
                            </div>
                            <button onClick={(e)=>{e.stopPropagation(); handleDelete(l);}} className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full bg-slate-950 text-slate-600 hover:text-red-500 hover:bg-red-950 transition-colors text-[10px]">✕</button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in">
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-emerald-400 font-bold text-sm border-b border-slate-800 pb-2">{editId ? '✏️ Edit League' : '➕ New League'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <select value={cat} onChange={e=>setCat(e.target.value as any)} className="bg-slate-900 p-3 rounded text-sm border border-slate-700 text-white">
                        <option value="CLUB">⚽ Club</option>
                        <option value="NATIONAL">🌍 National</option>
                    </select>
                    <input value={name} onChange={e=>setName(e.target.value)} placeholder="League Name" className="bg-slate-900 p-3 rounded text-sm border border-slate-700 text-white md:col-span-2"/>
                    <input value={logo} onChange={e=>setLogo(e.target.value)} placeholder="Logo URL" className="bg-slate-900 p-3 rounded text-sm border border-slate-700 text-white"/>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleSave} className={`flex-1 py-3 rounded font-bold transition-all shadow-lg ${editId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{editId ? 'Update League' : 'Create League'}</button>
                    {editId && <button onClick={()=>{setEditId(null); setName(''); setLogo('');}} className="px-6 bg-slate-800 rounded text-slate-400 hover:text-white">Cancel</button>}
                </div>
            </div>

            <div className="space-y-4">
                <div className="relative mb-4">
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 리그 이름을 검색해보세요..." className="w-full bg-slate-900 p-4 pl-10 rounded-xl border border-slate-700 text-sm text-white focus:border-emerald-500 outline-none"/>
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">🔎</span>
                </div>
                
                {renderLeagueList('CLUB', '⚽ Club Leagues')}
                {renderLeagueList('NATIONAL', '🌍 National Teams')}
            </div>
        </div>
    );
};

export const AdminTeamManager = ({ leagues, masterTeams }: { leagues: League[], masterTeams: MasterTeam[] }) => {
    const [categoryFilter, setCategoryFilter] = useState<'ALL'|'CLUB'|'NATIONAL'>('ALL');
    const [selectedLeague, setSelectedLeague] = useState<string>(''); 
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isQuickTierMode, setIsQuickTierMode] = useState(false);

    const [tName, setTName] = useState('');
    const [tLogo, setTLogo] = useState('');
    const [tRegion, setTRegion] = useState('');
    const [tTier, setTTier] = useState('C');
    const [editTeamId, setEditTeamId] = useState<string | null>(null);

    const handleSaveTeam = async () => {
        if(!tName || !tRegion) return alert("팀 이름과 리그를 선택하세요.");
        const leagueInfo = leagues.find(l => l.name === tRegion);
        const teamData = { name: tName, logo: tLogo, region: tRegion, tier: tTier, category: leagueInfo?.category || 'CLUB' };

        if (editTeamId) {
            await updateDoc(doc(db, "master_teams", editTeamId), teamData);
            setEditTeamId(null);
            alert("수정 완료");
        } else {
            await addDoc(collection(db, "master_teams"), { id: Date.now(), ...teamData });
            alert("생성 완료");
        }
        setTName(''); setTLogo(''); setTTier('C');
    };

    const handleDeleteTeam = async (id: string) => { if(confirm("정말 삭제하시겠습니까?")) await deleteDoc(doc(db,"master_teams",id)); };
    const handleQuickTierUpdate = async (teamId: string, newTier: string) => { await updateDoc(doc(db, "master_teams", teamId), { tier: newTier }); };
    const handleBulkTier = async (targetTier: string) => {
        if (!selectedLeague) return alert("리그를 먼저 선택해주세요.");
        if (!confirm(`'${selectedLeague}'의 모든 팀 등급을 '${targetTier}'로 변경하시겠습니까?`)) return;
        const targets = masterTeams.filter(t => t.region === selectedLeague);
        const batch = writeBatch(db);
        targets.forEach(t => { if(t.docId) batch.update(doc(db, "master_teams", t.docId), { tier: targetTier }); });
        await batch.commit();
        alert("일괄 변경 완료");
    };

    const handleSelectTeamToEdit = (team: MasterTeam) => {
        setIsEditOpen(true);
        setEditTeamId(team.docId!);
        setTName(team.name);
        setTLogo(team.logo);
        setTRegion(team.region);
        setTTier(team.tier);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    let filteredTeams = masterTeams;
    if (categoryFilter !== 'ALL') filteredTeams = filteredTeams.filter(t => categoryFilter === 'CLUB' ? t.category !== 'NATIONAL' : t.category === 'NATIONAL');
    if (selectedLeague) filteredTeams = filteredTeams.filter(t => t.region === selectedLeague);
    if (searchTerm) filteredTeams = filteredTeams.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    filteredTeams = getSortedTeamsLogic(filteredTeams, ''); 

    let displayLeagues = leagues;
    if (categoryFilter !== 'ALL') displayLeagues = displayLeagues.filter(l => l.category === categoryFilter);
    
    const sortedLeagueNames = getSortedLeagues(displayLeagues.map(l=>l.name));
    const displaySortedLeagues = sortedLeagueNames.map(name => displayLeagues.find(l => l.name === name)).filter(Boolean) as League[];
    
    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-emerald-400 font-bold text-sm border-b border-slate-800 pb-2">🔍 Team Search</h3>
                <div className="flex gap-2">
                    <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="🔍 팀 명을 검색해보세요..." className="flex-1 bg-slate-900 p-3 rounded text-sm border border-slate-700 text-white focus:border-emerald-500 outline-none"/>
                    <button onClick={()=>setSearchTerm('')} className="bg-slate-800 px-4 rounded font-bold text-slate-400 hover:text-white">Clear</button>
                </div>
                <div className="flex bg-slate-900 rounded-lg p-1 w-fit">
                    {['ALL', 'CLUB', 'NATIONAL'].map(t => (
                        <button key={t} onClick={() => { setCategoryFilter(t as any); setSelectedLeague(''); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${categoryFilter === t ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-white'}`}>{t}</button>
                    ))}
                </div>
            </div>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div onClick={() => setIsEditOpen(!isEditOpen)} className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-800 transition-colors">
                    <h3 className="text-emerald-400 font-bold text-sm">{editTeamId ? '✏️ Edit Team Info (Editing)' : '➕ Add New Team'}</h3>
                    <span className="text-slate-500 text-xl font-bold">{isEditOpen ? '−' : '+'}</span>
                </div>
                {isEditOpen && (
                    <div className="p-5 border-t border-slate-800 space-y-4 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><label className="text-[10px] text-slate-500 font-bold">Team Name</label><input value={tName} onChange={e=>setTName(e.target.value)} placeholder="Team Name" className="w-full bg-slate-900 p-3 rounded border border-slate-700 text-white text-sm"/></div>
                            <div className="space-y-1"><label className="text-[10px] text-slate-500 font-bold">Logo URL</label><input value={tLogo} onChange={e=>setTLogo(e.target.value)} placeholder="Logo URL" className="w-full bg-slate-900 p-3 rounded border border-slate-700 text-white text-sm"/></div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 font-bold">League / Region</label>
                                <select value={tRegion} onChange={e=>setTRegion(e.target.value)} className="w-full bg-slate-900 p-3 rounded border border-slate-700 text-white text-sm">
                                    <option value="">Select League...</option>
                                    {sortedLeagueNames.map(name => <option key={name} value={name}>{name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1"><label className="text-[10px] text-slate-500 font-bold">Tier Setting</label><TierSelector value={tTier} onChange={setTTier} /></div>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={handleSaveTeam} className={`flex-1 py-3 rounded font-bold shadow-lg transition-all ${editTeamId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>{editTeamId ? 'Update Team' : 'Add Team'}</button>
                            {editTeamId && <button onClick={()=>{setEditTeamId(null); setTName(''); setTLogo(''); setTTier('C'); setIsEditOpen(false);}} className="px-6 bg-slate-800 rounded text-slate-400 text-sm hover:text-white">Cancel</button>}
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-8">
                <div className="flex flex-wrap items-center bg-slate-950 p-2 rounded-lg border border-slate-800 sticky top-0 z-10 shadow-xl gap-2">
                    <button onClick={() => setIsQuickTierMode(!isQuickTierMode)} className={`h-9 px-4 text-xs rounded-lg font-bold border transition-all ${isQuickTierMode ? 'bg-yellow-600 text-white border-yellow-500 shadow-lg shadow-yellow-900/50' : 'bg-slate-900 text-slate-500 border-slate-700'}`}>⚡ 빠른 등급 설정 {isQuickTierMode ? 'ON' : 'OFF'}</button>
                    {selectedLeague ? (
                         <div className="flex gap-2 ml-auto">
                             <button onClick={()=>handleBulkTier('C')} className="h-9 px-4 bg-slate-800 rounded-lg text-xs font-bold text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700">일괄 C등급 변경</button>
                             <button onClick={()=>setSelectedLeague('')} className="h-9 w-9 flex items-center justify-center bg-slate-800 rounded-lg text-white border border-slate-700 hover:bg-slate-700 font-bold">↩</button>
                         </div>
                    ) : <span className="text-xs text-slate-500 pr-2 ml-auto">리그를 선택하세요</span>}
                </div>

                {!selectedLeague && !searchTerm && (
                    <>
                        {categoryFilter !== 'NATIONAL' && (
                            <div className="space-y-3">
                                <h3 className="text-white font-bold text-sm border-l-4 border-emerald-500 pl-2">⚽ Club Leagues</h3>
                                {/* 🔥 [수정] 리그 목록: grid-cols-2 sm:3 md:4 lg:5 적용 */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {displaySortedLeagues.filter(l=>l.category==='CLUB').map(l => (
                                        <div key={l.id} onClick={() => {setSelectedLeague(l.name); setTRegion(l.name);}} className="bg-slate-900 p-4 rounded-xl border border-slate-800 hover:border-emerald-500 cursor-pointer flex flex-col items-center gap-3 group transition-all aspect-square justify-center relative">
                                            <div className="w-14 h-14 bg-white rounded-full p-2 shadow-sm flex items-center justify-center">
                                                <img src={l.logo || FALLBACK_IMG} className="w-full h-full object-contain" alt=""/>
                                            </div>
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-xs text-center text-slate-300 font-bold group-hover:text-white leading-tight">{l.name}</span>
                                                <span className="bg-slate-950 text-slate-500 text-[9px] px-2 py-0.5 rounded-full border border-slate-800">{masterTeams.filter(t=>t.region===l.name).length} Teams</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {categoryFilter !== 'CLUB' && (
                            <div className="space-y-3">
                                <h3 className="text-white font-bold text-sm border-l-4 border-blue-500 pl-2">🌍 National Teams</h3>
                                {/* 🔥 [수정] 국대 목록: grid-cols-2 sm:3 md:4 lg:5 적용 */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {displaySortedLeagues.filter(l=>l.category==='NATIONAL').map(l => (
                                        <div key={l.id} onClick={() => {setSelectedLeague(l.name); setTRegion(l.name);}} className="bg-slate-900 p-4 rounded-xl border border-slate-800 hover:border-blue-500 cursor-pointer flex flex-col items-center gap-3 group transition-all aspect-square justify-center relative">
                                            <div className="w-14 h-14 bg-white rounded-full p-2 shadow-sm flex items-center justify-center">
                                                <img src={l.logo || FALLBACK_IMG} className="w-full h-full object-contain" alt=""/>
                                            </div>
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-xs text-center text-slate-300 font-bold group-hover:text-white leading-tight">{l.name}</span>
                                                <span className="bg-slate-950 text-slate-500 text-[9px] px-2 py-0.5 rounded-full border border-slate-800">{masterTeams.filter(t=>t.region===l.name).length} Teams</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {(selectedLeague || searchTerm) && (
                    /* 🔥 [수정] 팀 목록: grid-cols-2 sm:3 md:4 lg:5 적용 */
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 animate-in fade-in">
                        {filteredTeams.map(t => (
                            <div key={t.id} onClick={() => !isQuickTierMode && handleSelectTeamToEdit(t)} className={`relative bg-slate-900 p-4 rounded-xl border flex flex-col items-center justify-center aspect-square cursor-pointer group hover:border-emerald-500 transition-all ${editTeamId===t.docId ? 'border-emerald-500 bg-emerald-900/20 ring-1 ring-emerald-500' : 'border-slate-800'}`}>
                                <div className="w-14 h-14 bg-white rounded-full overflow-hidden flex items-center justify-center mb-3 shadow-lg ring-1 ring-slate-700 p-1.5">
                                    <img src={t.logo} className="w-full h-full object-contain" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                                </div>
                                <span className="text-xs text-center text-slate-300 w-full truncate font-bold group-hover:text-white">{t.name}</span>
                                {isQuickTierMode ? (
                                    <TierSelector value={t.tier} onChange={(newTier) => t.docId && handleQuickTierUpdate(t.docId, newTier)} isMini={true} />
                                ) : (
                                    <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold shadow-sm ${getTierBadgeColor(t.tier)}`}>{t.tier}</div>
                                )}
                                {!isQuickTierMode && (
                                    <button onClick={(e)=>{e.stopPropagation(); t.docId && handleDeleteTeam(t.docId);}} className="absolute top-2 left-2 w-5 h-5 flex items-center justify-center rounded-full bg-slate-950 text-slate-600 hover:text-red-500 hover:bg-red-950 transition-colors text-xs">✕</button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                {filteredTeams.length === 0 && <div className="text-center py-10 text-slate-600 text-xs">No teams found.</div>}
            </div>
        </div>
    );
};