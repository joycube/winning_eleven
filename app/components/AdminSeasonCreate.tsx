import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { setDoc, doc } from 'firebase/firestore';
// types는 import만 하고, 실제 저장 시에는 any로 유연하게 처리 (기존 로직 유지)

interface AdminSeasonCreateProps {
    onCreateSuccess: (id: number) => void;
}

const parseNumber = (str: string) => Number(str.replace(/,/g, ''));
const formatNumber = (num: number) => num.toLocaleString();

export const AdminSeasonCreate = ({ onCreateSuccess }: AdminSeasonCreateProps) => {
    const [name, setName] = useState('');
    
    // 🔥 [수정] 기본값은 LEAGUE
    const [type, setType] = useState('LEAGUE');
    
    // 리그 모드 (단판/더블)
    const [mode, setMode] = useState('SINGLE');
    
    // 🔥 [추가] 컵 모드 설정 (조별리그 진출 팀 수)
    const [cupAdvance, setCupAdvance] = useState('2'); // 기본: 2위까지 진출

    const [totalPrize, setTotalPrize] = useState(100000);
    const [displayPrize, setDisplayPrize] = useState('100,000');
    const [prizes, setPrizes] = useState({ first: 45000, second: 25000, third: 10000, scorer: 10000, assist: 10000 });
    const [isAuto, setIsAuto] = useState(true);

    const handlePrizeChange = (val: string) => {
        const num = parseNumber(val);
        if (!isNaN(num)) { setTotalPrize(num); setDisplayPrize(formatNumber(num)); }
        else if (val === '') { setTotalPrize(0); setDisplayPrize(''); }
    };

    useEffect(() => {
        if (isAuto) {
            setPrizes({
                first: Math.floor(totalPrize * 0.45), second: Math.floor(totalPrize * 0.25), third: Math.floor(totalPrize * 0.10),
                scorer: Math.floor(totalPrize * 0.10), assist: Math.floor(totalPrize * 0.10)
            });
        }
    }, [totalPrize, isAuto]);

    const handleCreate = async () => {
        if (!name) return alert("시즌 이름을 입력하세요.");
        const id = Date.now();

        // 🔥 [제목 생성 디벨롭] 타입별 아이콘 자동 부여
        let iconPrefix = '';
        switch (type) {
            case 'LEAGUE': iconPrefix = '🏳️'; break;
            case 'TOURNAMENT': iconPrefix = '⚔️'; break;
            case 'CUP': iconPrefix = '🏆'; break;
            default: iconPrefix = '';
        }
        const finalName = `${iconPrefix} ${name}`;
        
        // 공통 데이터
        const newSeason: any = {
            id, 
            name: finalName, // 🔥 아이콘이 붙은 최종 이름 저장
            type, 
            status: 'ACTIVE', 
            teams: [], 
            rounds: [], 
            prizes 
        };

        // 🔥 [로직 분기] 타입에 따라 초기 데이터 다르게 설정
        if (type === 'LEAGUE') {
            newSeason.leagueMode = mode; // SINGLE or DOUBLE
        } else if (type === 'CUP') {
            // 🏆 컵 모드 초기화 데이터
            newSeason.cupPhase = 'GROUP_STAGE'; // 시작은 조별리그
            newSeason.groups = {}; // 조 편성은 나중에 함
            newSeason.advancementRule = {
                fromGroup: Number(cupAdvance), // 1 or 2
                method: 'CROSS' // 기본값: 크로스 매칭 (A1 vs B2)
            };
        }
        // TOURNAMENT는 추가 설정 없이 기본 구조만 있으면 됨

        await setDoc(doc(db, "seasons", String(id)), newSeason);
        alert(`${type} 시즌 생성 완료!`);
        onCreateSuccess(id);
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* 1. 시즌 이름 */}
            <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold">1. Season Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 2026 World Cup" className="bg-slate-950 w-full p-4 rounded border border-slate-700 text-base text-white" />
            </div>

            {/* 2. 타입 및 모드 선택 */}
            <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold">2. Type & Mode</label>
                {/* 🔥 [레이아웃 수정] flex -> grid로 변경하여 강제 50:50 비율 유지 */}
                <div className="grid grid-cols-2 gap-2">
                    {/* 메인 타입 선택 */}
                    <select value={type} onChange={e => setType(e.target.value)} className="bg-slate-950 p-4 rounded border border-slate-700 w-full h-14 text-base text-white font-bold">
                        <option value="LEAGUE">🏳️ LEAGUE</option>
                        <option value="CUP">🏆 CUP (Group+KO)</option>
                        <option value="TOURNAMENT">⚔️ TOURNAMENT</option>
                    </select>

                    {/* 🔥 타입에 따른 세부 옵션 UI 변경 */}
                    {type === 'LEAGUE' && (
                        <select value={mode} onChange={e => setMode(e.target.value)} className="bg-slate-950 p-4 rounded border border-slate-700 w-full h-14 text-base text-white">
                            <option value="SINGLE">Single Round (단판)</option>
                            <option value="DOUBLE">Double Round (홈&어웨이)</option>
                        </select>
                    )}

                    {type === 'CUP' && (
                        <select value={cupAdvance} onChange={e => setCupAdvance(e.target.value)} className="bg-slate-950 p-4 rounded border border-emerald-900/50 w-full h-14 text-base text-white">
                            <option value="2">Top 2 Advance (1,2위 진출)</option>
                            <option value="1">Top 1 Advance (1위만 진출)</option>
                        </select>
                    )}

                    {type === 'TOURNAMENT' && (
                        <div className="bg-slate-900 p-4 rounded border border-slate-800 w-full h-14 flex items-center justify-center text-slate-500 text-sm">
                            No Extra Options
                        </div>
                    )}
                </div>
            </div>

            {/* 3. 상금 설정 (기존 코드 유지) */}
            <div className="space-y-2">
                <label className="text-xs text-slate-400 font-bold flex justify-between items-center">3. Prizes (Total)<button onClick={() => setIsAuto(!isAuto)} className={`text-xs px-2 py-1 rounded border ${isAuto ? 'border-emerald-500 text-emerald-400' : 'border-orange-500 text-orange-400'}`}>{isAuto ? '⚡ Auto Calc' : '✏️ Manual Input'}</button></label>
                <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">₩</span><input type="text" value={displayPrize} onChange={e => handlePrizeChange(e.target.value)} className="bg-slate-950 w-full p-4 pl-8 rounded border border-slate-700 text-right text-lg font-bold text-emerald-400 mb-2" placeholder="Total Prize" /></div>
                <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded border border-slate-800">
                    <div className="space-y-2"><p className="text-[10px] text-slate-500 font-bold border-b border-slate-700 pb-1">🏆 TEAM PRIZES</p><div><label className="text-[10px] text-slate-500">🥇 1st</label><input type="number" value={prizes.first} onChange={e => setPrizes({ ...prizes, first: Number(e.target.value) })} readOnly={isAuto} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAuto ? 'opacity-50 cursor-not-allowed' : ''}`} /></div><div><label className="text-[10px] text-slate-500">🥈 2nd</label><input type="number" value={prizes.second} onChange={e => setPrizes({ ...prizes, second: Number(e.target.value) })} readOnly={isAuto} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAuto ? 'opacity-50 cursor-not-allowed' : ''}`} /></div><div><label className="text-[10px] text-slate-500">🥉 3rd</label><input type="number" value={prizes.third} onChange={e => setPrizes({ ...prizes, third: Number(e.target.value) })} readOnly={isAuto} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAuto ? 'opacity-50 cursor-not-allowed' : ''}`} /></div></div>
                    <div className="space-y-2"><p className="text-[10px] text-slate-500 font-bold border-b border-slate-700 pb-1">👤 PLAYER PRIZES</p><div><label className="text-[10px] text-slate-500">👟 Scorer</label><input type="number" value={prizes.scorer} onChange={e => setPrizes({ ...prizes, scorer: Number(e.target.value) })} readOnly={isAuto} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAuto ? 'opacity-50 cursor-not-allowed' : ''}`} /></div><div><label className="text-[10px] text-slate-500">🅰️ Assist</label><input type="number" value={prizes.assist} onChange={e => setPrizes({ ...prizes, assist: Number(e.target.value) })} readOnly={isAuto} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAuto ? 'opacity-50 cursor-not-allowed' : ''}`} /></div></div>
                </div>
            </div>
            
            <button onClick={handleCreate} className="w-full bg-emerald-600 py-4 rounded-xl font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-900/50">Create Season</button>
        </div>
    );
};