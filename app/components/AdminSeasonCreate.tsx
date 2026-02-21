"use client";

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { setDoc, doc } from 'firebase/firestore';

interface AdminSeasonCreateProps {
    onCreateSuccess: (id: number) => void;
}

const parseNumber = (str: string) => Number(str.replace(/,/g, ''));
const formatNumber = (num: number) => num.toLocaleString();

export const AdminSeasonCreate = ({ onCreateSuccess }: AdminSeasonCreateProps) => {
    const [name, setName] = useState('');
    const [type, setType] = useState('LEAGUE');
    const [mode, setMode] = useState('SINGLE');
    const [cupAdvance, setCupAdvance] = useState('2');

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

        let iconPrefix = '';
        switch (type) {
            case 'LEAGUE': iconPrefix = '🏳️'; break;
            case 'TOURNAMENT': iconPrefix = '⚔️'; break;
            case 'CUP': iconPrefix = '🏆'; break;
            default: iconPrefix = '';
        }
        const finalName = `${iconPrefix} ${name}`;
        
        const newSeason: any = {
            id, 
            name: finalName, 
            type, 
            status: 'ACTIVE', 
            teams: [], 
            rounds: [], 
            totalPrize, // 🔥 [수정] Finance 자동 계산의 기준이 될 총상금 데이터 저장
            prizes 
        };

        if (type === 'LEAGUE') {
            newSeason.leagueMode = mode;
        } else if (type === 'CUP') {
            newSeason.cupPhase = 'GROUP_STAGE';
            newSeason.groups = {};
            newSeason.advancementRule = {
                fromGroup: Number(cupAdvance),
                method: 'CROSS'
            };
        }

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
                <div className="grid grid-cols-2 gap-2">
                    <select value={type} onChange={e => setType(e.target.value)} className="bg-slate-950 p-4 rounded border border-slate-700 w-full h-14 text-base text-white font-bold">
                        <option value="LEAGUE">🏳️ LEAGUE</option>
                        <option value="CUP">🏆 CUP (Group+KO)</option>
                        <option value="TOURNAMENT">⚔️ TOURNAMENT</option>
                    </select>

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

            {/* 3. 상금 설정 */}
            <div className="space-y-2">
                <label className="text-xs text-slate-400 font-bold flex justify-between items-center">3. Prizes (Total)<button onClick={() => setIsAuto(!isAuto)} className={`text-xs px-2 py-1 rounded border ${isAuto ? 'border-emerald-500 text-emerald-400' : 'border-orange-500 text-orange-400'}`}>{isAuto ? '⚡ Auto Calc' : '✏️ Manual Input'}</button></label>
                <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">₩</span><input type="text" value={displayPrize} onChange={e => handlePrizeChange(e.target.value)} className="bg-slate-950 w-full p-4 pl-8 rounded border border-slate-700 text-right text-lg font-bold text-emerald-400 mb-1" placeholder="Total Prize" /></div>
                
                {/* 🔥 [추가] 예상 참가비 안내 (Finance 로직 미리보기) */}
                <div className="flex justify-between px-1 text-[10px] text-slate-500 font-bold italic mb-2">
                    <span>Expected Entry Fee:</span>
                    <span>4인 기준: ₩{formatNumber(Math.floor(totalPrize/4))} / 6인 기준: ₩{formatNumber(Math.floor(totalPrize/6))}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded border border-slate-800">
                    <div className="space-y-2"><p className="text-[10px] text-slate-500 font-bold border-b border-slate-700 pb-1">🏆 TEAM PRIZES</p><div><label className="text-[10px] text-slate-500">🥇 1st</label><input type="number" value={prizes.first} onChange={e => setPrizes({ ...prizes, first: Number(e.target.value) })} readOnly={isAuto} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAuto ? 'opacity-50 cursor-not-allowed' : ''}`} /></div><div><label className="text-[10px] text-slate-500">🥈 2nd</label><input type="number" value={prizes.second} onChange={e => setPrizes({ ...prizes, second: Number(e.target.value) })} readOnly={isAuto} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAuto ? 'opacity-50 cursor-not-allowed' : ''}`} /></div><div><label className="text-[10px] text-slate-500">🥉 3rd</label><input type="number" value={prizes.third} onChange={e => setPrizes({ ...prizes, third: Number(e.target.value) })} readOnly={isAuto} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAuto ? 'opacity-50 cursor-not-allowed' : ''}`} /></div></div>
                    <div className="space-y-2"><p className="text-[10px] text-slate-500 font-bold border-b border-slate-700 pb-1">👤 PLAYER PRIZES</p><div><label className="text-[10px] text-slate-500">👟 Scorer</label><input type="number" value={prizes.scorer} onChange={e => setPrizes({ ...prizes, scorer: Number(e.target.value) })} readOnly={isAuto} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAuto ? 'opacity-50 cursor-not-allowed' : ''}`} /></div><div><label className="text-[10px] text-slate-500">🅰️ Assist</label><input type="number" value={prizes.assist} onChange={e => setPrizes({ ...prizes, assist: Number(e.target.value) })} readOnly={isAuto} className={`bg-slate-900 w-full p-2 rounded border border-slate-700 text-right text-sm text-white ${isAuto ? 'opacity-50 cursor-not-allowed' : ''}`} /></div></div>
                </div>
            </div>
            
            <button onClick={handleCreate} className="w-full bg-emerald-600 py-4 rounded-xl font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-900/50">Create Season</button>
        </div>
    );
};