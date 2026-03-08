"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { FALLBACK_IMG, Owner, Season } from '../types';

declare module 'react' {
  interface StyleHTMLAttributes<T> extends React.HTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}

interface FinanceViewProps {
  owners: Owner[];
  seasons: Season[];
  user?: {
    uid: string;
    mappedOwnerId: string;
    role: string;
  } | null;
}

interface SettlementGroup {
  rev: any[];
  exp: any[];
  p2pRx: any[];
  p2pTx: any[];
  sumRev: number;
  sumExp: number;
  sumRx: number;
  sumTx: number;
}

export const FinanceView = ({ owners, seasons, user }: FinanceViewProps) => {
  const [activeTab, setActiveTab] = useState<'STATEMENT' | 'SETTLEMENT' | 'HALL_OF_FAME'>('HALL_OF_FAME');
  
  const [dbLedgers, setDbLedgers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedOwnerId, setSelectedOwnerId] = useState<string>(''); 
  const [targetOwnerId, setTargetOwnerId] = useState<string>('ALL'); 
  const [settlementSeason, setSettlementSeason] = useState<string>('ALL'); 
  const [statementSeason, setStatementSeason] = useState<string>('ALL');

  useEffect(() => {
    if (!user) {
      setActiveTab('HALL_OF_FAME');
    } else {
      // 🔥 [FM 픽스] UID 우선 조회 후, 없으면 닉네임으로 내 오너 정보를 찾습니다.
      const myOwner = owners.find(o => (o.uid && o.uid === user.uid) || o.nickname === user.mappedOwnerId);
      if (myOwner) {
        setSelectedOwnerId(String(myOwner.id));
      }
    }
  }, [user, owners]);

  useEffect(() => {
    const fetchFinanceData = async () => {
      try {
        const lSnap = await getDocs(collection(db, 'finance_ledger'));
        const rawLedgers = lSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const activeSeasonIds = new Set(seasons.map(s => String(s.id)));
        
        const validLedgers = rawLedgers
            .filter((l: any) => activeSeasonIds.has(String(l.seasonId)))
            .sort((a: any, b: any) => {
                const dateA = new Date(a.createdAt || 0).getTime();
                const dateB = new Date(b.createdAt || 0).getTime();
                return dateB - dateA; 
            });

        setDbLedgers(validLedgers);
      } catch (error) {
        console.error("🚨 Finance data fetch error:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFinanceData();
  }, [seasons]);

  const computedOwners = useMemo(() => {
    return owners.map(owner => {
        let win = 0, draw = 0, loss = 0;
        const teamWins: Record<string, { logo: string, wins: number }> = {};

        seasons.forEach(s => {
            s.rounds?.forEach(r => {
                r.matches?.forEach(m => {
                    if (m.status === 'COMPLETED' && m.homeScore !== '' && m.awayScore !== '') {
                        const hScore = Number(m.homeScore); const aScore = Number(m.awayScore);
                        // 🔥 [FM 픽스] 경기 기록 대조 시 닉네임 뿐만 아니라 UID(homeOwnerUid)도 체크합니다.
                        const isHome = m.homeOwner === owner.nickname || (m.homeOwnerUid && m.homeOwnerUid === owner.uid);
                        const isAway = m.awayOwner === owner.nickname || (m.awayOwnerUid && m.awayOwnerUid === owner.uid);

                        if (isHome) {
                            if (hScore > aScore) { win++; teamWins[m.home] = { logo: m.homeLogo, wins: (teamWins[m.home]?.wins || 0) + 1 }; }
                            else if (hScore === aScore) draw++;
                            else loss++;
                        } else if (isAway) {
                            if (aScore > hScore) { win++; teamWins[m.away] = { logo: m.awayLogo, wins: (teamWins[m.away]?.wins || 0) + 1 }; }
                            else if (hScore === aScore) draw++;
                            else loss++;
                        }
                    }
                });
            });
        });

        let bestTeam = { name: '-', logo: FALLBACK_IMG, wins: 0 };
        Object.keys(teamWins).forEach(teamName => {
            if (teamWins[teamName].wins > bestTeam.wins) bestTeam = { name: teamName, logo: teamWins[teamName].logo, wins: teamWins[teamName].wins };
        });

        // 🔥 [FM 픽스] 장부 필터링 시 레거시 숫자 ID와 새로운 구글 UID를 모두 확인합니다. (Dual-Track)
        const ownerLedgers = dbLedgers.filter(l => 
            String(l.ownerId) === String(owner.id) || 
            (owner.uid && String(l.ownerId) === owner.uid) ||
            (l.ownerUid && l.ownerUid === owner.uid)
        );
        const revenues = ownerLedgers.filter(l => l.type === 'REVENUE');
        const expenses = ownerLedgers.filter(l => l.type === 'EXPENSE');
        
        const totalRevenue = revenues.reduce((sum, item) => sum + Number(item.amount), 0);
        const totalExpense = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
        const netProfit = totalRevenue - totalExpense;

        const trophies = revenues.filter(r => 
            r.title.includes('우승') || r.title.includes('준우승') || r.title.includes('3위') || 
            r.title.includes('득점왕') || r.title.includes('도움왕') || r.title.includes('최우수')
        ).length;

        return {
            id: String(owner.id), nickname: owner.nickname, photo: owner.photo || FALLBACK_IMG,
            trophies, win, draw, loss, bestTeam, totalRevenue, totalExpense, netProfit
        };
    });
  }, [owners, seasons, dbLedgers]);

  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}.${mm}.${dd}`;
  };

  const computedFinanceDetails = useMemo(() => {
    const details: Record<string, any> = {};
    owners.forEach(owner => {
        // 🔥 [FM 픽스] 세부 내역 추출 시에도 ID/UID 이중 매칭
        const ownerLedgers = dbLedgers.filter(l => 
            String(l.ownerId) === String(owner.id) || 
            (owner.uid && String(l.ownerId) === owner.uid)
        );
        details[String(owner.id)] = {
            revenues: ownerLedgers.filter(l => l.type === 'REVENUE').map(l => ({ 
                ...l, season: seasons.find(s => String(s.id) === l.seasonId)?.name || '기타', date: formatDate(l.createdAt)
            })),
            expenses: ownerLedgers.filter(l => l.type === 'EXPENSE').map(l => ({ 
                ...l, season: seasons.find(s => String(s.id) === l.seasonId)?.name || '기타', date: formatDate(l.createdAt)
            }))
        };
    });
    return details;
  }, [owners, dbLedgers, seasons]);

  const computedSettlements = useMemo(() => {
    const txs: any[] = [];
    const seasonIds = Array.from(new Set(dbLedgers.map(l => String(l.seasonId))));

    seasonIds.forEach(sId => {
        const sLedgers = dbLedgers.filter(l => String(l.seasonId) === sId);
        const balances: Record<string, number> = {};
        owners.forEach(o => { balances[String(o.id)] = 0; });
        
        sLedgers.forEach(l => {
            // 🔥 [FM 픽스] 장부에 적힌 ID가 UID든 숫자 ID든 실제 Owner 객체를 찾아 점수를 합산합니다.
            const targetOwner = owners.find(o => String(o.id) === String(l.ownerId) || (o.uid && o.uid === String(l.ownerId)));
            if (targetOwner) {
                const key = String(targetOwner.id);
                if (l.type === 'REVENUE') balances[key] += Number(l.amount);
                if (l.type === 'EXPENSE') balances[key] -= Number(l.amount);
            }
        });

        const creditors = owners.map(o => ({ id: String(o.id), balance: balances[String(o.id)] })).filter(o => o.balance > 0.5).sort((a, b) => b.balance - a.balance);
        const debtors = owners.map(o => ({ id: String(o.id), balance: balances[String(o.id)] })).filter(o => o.balance < -0.5).sort((a, b) => a.balance - b.balance);

        let cIdx = 0; let dIdx = 0;
        while (cIdx < creditors.length && dIdx < debtors.length) {
            const creditor = creditors[cIdx]; const debtor = debtors[dIdx];
            const amount = Math.min(creditor.balance, Math.abs(debtor.balance));
            if (amount > 0) {
                txs.push({
                    id: `tx_${sId}_${debtor.id}_${creditor.id}_${Math.random()}`,
                    seasonId: sId, from: debtor.id, to: creditor.id, amount: Math.round(amount), status: 'PENDING'
                });
            }
            creditor.balance -= amount; debtor.balance += amount;
            if (creditor.balance <= 0.5) cIdx++; if (debtor.balance >= -0.5) dIdx++;
        }
    });
    return txs;
  }, [dbLedgers, owners]);

  const settlementViewData = useMemo(() => {
    if (!selectedOwnerId) return {} as Record<string, SettlementGroup>;
    const groups: Record<string, SettlementGroup> = {};
    
    // 선택된 구단주 객체 찾기
    const selOwner = owners.find(o => String(o.id) === selectedOwnerId);

    if (targetOwnerId === 'ALL') {
        dbLedgers.filter(l => 
            String(l.ownerId) === selectedOwnerId || 
            (selOwner?.uid && String(l.ownerId) === selOwner.uid)
        ).forEach(l => {
            const sName = seasons.find(s => String(s.id) === l.seasonId)?.name || '기타';
            if (!groups[sName]) groups[sName] = { rev: [], exp: [], p2pRx: [], p2pTx: [], sumRev: 0, sumExp: 0, sumRx: 0, sumTx: 0 };
            
            if (l.type === 'REVENUE') { groups[sName].rev.push(l); groups[sName].sumRev += Number(l.amount); }
            if (l.type === 'EXPENSE') { groups[sName].exp.push(l); groups[sName].sumExp += Number(l.amount); }
        });
    }

    computedSettlements.forEach(tx => {
        if (tx.from !== selectedOwnerId && tx.to !== selectedOwnerId) return;
        if (targetOwnerId !== 'ALL' && tx.from !== targetOwnerId && tx.to !== targetOwnerId) return;
        
        const sName = seasons.find(s => String(s.id) === String(tx.seasonId))?.name || '기타';
        if (!groups[sName]) groups[sName] = { rev: [], exp: [], p2pRx: [], p2pTx: [], sumRev: 0, sumExp: 0, sumRx: 0, sumTx: 0 };

        if (tx.to === selectedOwnerId) {
            const fromName = owners.find(o => String(o.id) === tx.from)?.nickname || 'Unknown';
            groups[sName].p2pRx.push({ text: `from. ${fromName}`, amount: tx.amount });
            groups[sName].sumRx += tx.amount;
        }
        if (tx.from === selectedOwnerId) {
            const toName = owners.find(o => String(o.id) === tx.to)?.nickname || 'Unknown';
            groups[sName].p2pTx.push({ text: `to. ${toName}`, amount: tx.amount });
            groups[sName].sumTx += tx.amount;
        }
    });

    const filteredGroups: Record<string, SettlementGroup> = {};
    Object.entries(groups).forEach(([sName, g]) => {
        if (settlementSeason !== 'ALL' && sName !== settlementSeason) return;
        
        if (targetOwnerId !== 'ALL') {
            if (g.p2pRx.length > 0 || g.p2pTx.length > 0) filteredGroups[sName] = g;
        } else {
            if (g.rev.length > 0 || g.exp.length > 0 || g.p2pRx.length > 0 || g.p2pTx.length > 0) filteredGroups[sName] = g;
        }
    });

    return filteredGroups;
  }, [dbLedgers, computedSettlements, selectedOwnerId, targetOwnerId, settlementSeason, seasons, owners]);

  const totalNetSettlement = useMemo(() => {
      let total = 0;
      Object.values(settlementViewData).forEach((g: SettlementGroup) => {
          if (targetOwnerId === 'ALL') {
              total += (g.sumRev - g.sumExp);
          } else {
              total += (g.sumRx - g.sumTx); 
          }
      });
      return total;
  }, [settlementViewData, targetOwnerId]);

  const rankedOwners = useMemo(() => [...computedOwners].sort((a, b) => b.netProfit - a.netProfit), [computedOwners]);
  const activeOwner = computedOwners.find(o => o.id === selectedOwnerId);
  const rawOwnerDetails = computedFinanceDetails[selectedOwnerId] || { revenues: [], expenses: [] };

  const availableSeasons = useMemo(() => {
    const sSet = new Set(dbLedgers.map(l => seasons.find(s => String(s.id) === l.seasonId)?.name || '기타'));
    return Array.from(sSet);
  }, [dbLedgers, seasons]);

  const statementData = useMemo(() => {
    const filteredRevenues = statementSeason === 'ALL' ? rawOwnerDetails.revenues : rawOwnerDetails.revenues.filter((r: any) => r.season === statementSeason);
    const filteredExpenses = statementSeason === 'ALL' ? rawOwnerDetails.expenses : rawOwnerDetails.expenses.filter((e: any) => e.season === statementSeason);
    const totalRev = filteredRevenues.reduce((sum: number, item: any) => sum + item.amount, 0);
    const totalExp = filteredExpenses.reduce((sum: number, item: any) => sum + item.amount, 0);
    return { filteredRevenues, filteredExpenses, totalRev, totalExp, netProfit: totalRev - totalExp };
  }, [rawOwnerDetails, statementSeason]);

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center py-32 animate-pulse">
              <span className="text-5xl mb-4">💰</span>
              <p className="text-emerald-500 font-bold italic tracking-widest uppercase text-sm">Loading Finance Data...</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .champion-card-glow { box-shadow: 0 0 40px rgba(234, 179, 8, 0.15); }
      `}</style>

      {/* 상단 타이틀 */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3 mb-4 border-b border-slate-800 pb-3">
          <span className="text-2xl">💼</span>
          <div className="flex flex-col">
            <h2 className="text-xl font-black italic text-white uppercase tracking-tighter leading-tight">Club Finance</h2>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Financial Statement & Settlement</span>
          </div>
        </div>
        <div className="flex gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          {[
            { id: 'STATEMENT', label: '재무제표', disabled: !user },
            { id: 'SETTLEMENT', label: '정산소', disabled: !user }, 
            { id: 'HALL_OF_FAME', label: '명예의 전당', disabled: false }
          ].map(tab => (
            <button 
              key={tab.id} 
              disabled={tab.disabled}
              onClick={() => setActiveTab(tab.id as any)} 
              className={`flex-1 py-2.5 rounded-lg text-xs font-black italic transition-all ${activeTab === tab.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : tab.disabled ? 'text-slate-700 cursor-not-allowed opacity-30' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {tab.label}
              {tab.disabled && <span className="block text-[8px] font-normal not-italic mt-0.5">🔒 로그인 필요</span>}
            </button>
          ))}
        </div>
      </div>

      {/* 공통: 기준 구단주 선택기 */}
      {(activeTab === 'STATEMENT' || activeTab === 'SETTLEMENT') && user && (
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 px-1 border-b border-slate-800/50 mb-2">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap shrink-0">Selected Owner :</span>
          {computedOwners
            .filter(o => {
                // 🔥 [FM 픽스] 관리자거나, UID 또는 닉네임이 일치하는 본인 계정만 노출
                const isMyAccount = (user.uid && o.id && owners.find(own => String(own.id) === o.id)?.uid === user.uid) || o.nickname === user.mappedOwnerId;
                return user.role === 'ADMIN' || isMyAccount;
            })
            .map(owner => (
            <div key={owner.id} onClick={() => { setSelectedOwnerId(owner.id); setTargetOwnerId('ALL'); setSettlementSeason('ALL'); setStatementSeason('ALL'); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-all border whitespace-nowrap shrink-0 ${selectedOwnerId === owner.id ? 'bg-slate-800 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.2)]' : 'bg-slate-900/50 border-slate-800 hover:border-slate-600'}`}>
              <img src={owner.photo} className="w-5 h-5 rounded-full object-cover" alt="" /><span className={`text-[11px] font-bold ${selectedOwnerId === owner.id ? 'text-white' : 'text-slate-500'}`}>{owner.nickname}</span>
            </div>
          ))}
        </div>
      )}

      {/* [탭 1] 재무제표 (STATEMENT) */}
      {activeTab === 'STATEMENT' && activeOwner && (
        <div className="space-y-4 animate-in slide-in-from-left-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-[100px] opacity-5">🏆</div>
            <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
              <img src={activeOwner.photo} className="w-20 h-20 rounded-full border-4 border-slate-800 shadow-xl object-cover" alt="" />
              <div className="flex-1 text-center md:text-left w-full">
                <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-1">{activeOwner.nickname}</h3>
                <p className="text-xs text-yellow-500 font-bold tracking-widest uppercase mb-4">Total Trophies: {activeOwner.trophies} 🏆</p>
                <div className="grid grid-cols-3 w-full max-w-lg mx-auto md:mx-0 gap-2">
                  <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800 flex flex-col items-center justify-center">
                    <span className="block text-[8px] sm:text-[9px] text-slate-500 font-bold mb-0.5 uppercase">Record</span>
                    <span className="text-[10px] sm:text-xs font-black text-white whitespace-nowrap">{activeOwner.win}W <span className="text-slate-500">{activeOwner.draw}D</span> <span className="text-red-400">{activeOwner.loss}L</span></span>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800 flex flex-col items-center justify-center">
                    <span className="block text-[8px] sm:text-[9px] text-slate-500 font-bold mb-0.5 uppercase">Win Rate</span>
                    <span className="text-[10px] sm:text-xs font-black text-emerald-400">{Math.round((activeOwner.win / (activeOwner.win + activeOwner.draw + activeOwner.loss || 1)) * 100)}%</span>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800 flex flex-col items-center justify-center overflow-hidden">
                    <span className="block text-[8px] sm:text-[9px] text-slate-500 font-bold mb-0.5 uppercase">Best Team</span>
                    <div className="flex items-center justify-center gap-1 w-full px-1">
                      {activeOwner.bestTeam.wins > 0 ? (
                        <><img src={activeOwner.bestTeam.logo} className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-white p-[1px] object-contain shrink-0" alt="" /><span className="text-[10px] sm:text-xs font-black text-white truncate">{activeOwner.bestTeam.wins}W</span></>
                      ) : <span className="text-[10px] sm:text-xs font-black text-slate-600">-</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-1 mt-6">
            <h3 className="text-lg font-black italic text-white uppercase border-l-4 border-emerald-500 pl-2">Financial Statement (P&L)</h3>
            <div className="flex items-center gap-2 bg-[#0f172a] p-1.5 rounded-lg border border-slate-800 shrink-0">
              <span className="text-[10px] text-slate-500 font-bold px-2 uppercase">Season :</span>
              <select value={statementSeason} onChange={(e) => setStatementSeason(e.target.value)} className="bg-slate-900 text-white text-[11px] font-bold p-1.5 rounded border border-slate-700 outline-none">
                <option value="ALL">전시즌 전체보기</option>
                {availableSeasons.map(season => <option key={season} value={season}>{season}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-[#0f172a] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-slate-800/50">
              <div className="flex flex-col p-4 sm:p-6 text-left">
                <h4 className="text-[10px] sm:text-xs font-black text-emerald-500 uppercase tracking-widest mb-1">🟢 수익 (REV)</h4>
                <div className="text-xl sm:text-2xl font-black text-white tracking-tighter mb-4">+{statementData.totalRev.toLocaleString()}</div>
                <div className="w-full h-[1px] bg-slate-800/60 mb-4"></div>
                <div className="space-y-3 min-h-[120px]">
                  {statementData.filteredRevenues.length === 0 ? <p className="text-[10px] text-slate-600 italic py-2">내역 없음</p> : statementData.filteredRevenues.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center w-full border-b border-slate-800/30 pb-2">
                      <div className="flex flex-col"><span className="text-[10px] sm:text-xs font-bold text-slate-300 leading-tight">{item.title}</span><span className="text-[9px] text-slate-500 mt-0.5">{item.date}</span></div>
                      <span className="text-[11px] sm:text-sm font-black text-emerald-400">+{item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col p-4 sm:p-6 bg-slate-900/20 text-left">
                <h4 className="text-[10px] sm:text-xs font-black text-red-500 uppercase tracking-widest mb-1">🔴 지출 (EXP)</h4>
                <div className="text-xl sm:text-2xl font-black text-white tracking-tighter mb-4">-{statementData.totalExp.toLocaleString()}</div>
                <div className="w-full h-[1px] bg-slate-800/60 mb-4"></div>
                <div className="space-y-3 min-h-[120px]">
                  {statementData.filteredExpenses.length === 0 ? <p className="text-[10px] text-slate-600 italic py-2">내역 없음</p> : statementData.filteredExpenses.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center w-full border-b border-slate-800/30 pb-2">
                      <div className="flex flex-col"><span className="text-[10px] sm:text-xs font-bold text-slate-400 leading-tight">{item.title}</span><span className="text-[9px] text-slate-600 mt-0.5">{item.date}</span></div>
                      <span className="text-[11px] sm:text-sm font-black text-red-400">-{item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className={`p-5 sm:p-6 border-t ${statementData.netProfit > 0 ? 'bg-emerald-900/20 border-emerald-900/50' : statementData.netProfit < 0 ? 'bg-red-900/20 border-red-900/50' : 'bg-slate-900/20 border-slate-800/50'}`}>
              <div className="flex justify-between items-end">
                <div className="flex flex-col"><span className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-400">{statementSeason === 'ALL' ? '누적 순이익' : '당기 순이익'}</span></div>
                <span className={`text-2xl sm:text-4xl font-black italic tracking-tighter ${statementData.netProfit > 0 ? 'text-emerald-400' : statementData.netProfit < 0 ? 'text-red-500' : 'text-slate-400'}`}>{statementData.netProfit > 0 ? '+' : ''}₩ {statementData.netProfit.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* [탭 2] 정산소 (SETTLEMENT) */}
      {activeTab === 'SETTLEMENT' && activeOwner && (
        <div className="space-y-4 animate-in slide-in-from-right-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-1">
            <h3 className="text-lg font-black italic text-white uppercase border-l-4 border-emerald-500 pl-2">Settlement Ledger</h3>
            <div className="flex w-full md:w-auto gap-2">
              <div className="flex-1 flex flex-col justify-center bg-[#0f172a] p-1.5 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-500 font-bold px-1 uppercase mb-0.5">Season</span>
                <select value={settlementSeason} onChange={(e) => setSettlementSeason(e.target.value)} className="w-full bg-slate-900 text-white text-[11px] font-bold py-1 px-1.5 rounded border border-slate-700 outline-none">
                  <option value="ALL">전시즌</option>
                  {availableSeasons.map(season => <option key={season} value={season}>{season}</option>)}
                </select>
              </div>
              <div className="flex-1 flex flex-col justify-center bg-[#0f172a] p-1.5 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-500 font-bold px-1 uppercase mb-0.5">Owner</span>
                <select value={targetOwnerId} onChange={(e) => setTargetOwnerId(e.target.value)} className="w-full bg-slate-900 text-white text-[11px] font-bold py-1 px-1.5 rounded border border-slate-700 outline-none">
                  <option value="ALL">전체 구단주</option>
                  {computedOwners.filter(o => o.id !== selectedOwnerId).map(o => <option key={o.id} value={o.id}>{o.nickname}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
            <div className="bg-slate-950 py-3 px-5 border-b border-slate-800 flex justify-between items-center">
              <span className="text-xs font-black italic text-slate-400 uppercase tracking-widest">{activeOwner.nickname}님의 정산 장부</span>
            </div>

            <div className="grid grid-cols-2 text-center border-b border-slate-700 bg-slate-900/80 py-2.5 shadow-md">
               <div className="text-emerald-500 font-black text-[11px] sm:text-xs tracking-widest">
                 {targetOwnerId === 'ALL' ? '🟢 수입 (INCOME)' : '🟢 받을 돈 (RX)'}
               </div>
               <div className="text-red-500 font-black text-[11px] sm:text-xs tracking-widest">
                 {targetOwnerId === 'ALL' ? '🔴 지출 (EXPENSE)' : '🔴 보낼 돈 (TX)'}
               </div>
            </div>

            {Object.keys(settlementViewData).length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm font-bold">해당 조건의 정산 내역이 없습니다.</div>
            ) : (
              Object.entries(settlementViewData).map(([season, data]: [string, SettlementGroup]) => {
                const isAll = targetOwnerId === 'ALL';
                const seasonNetProfit = data.sumRev - data.sumExp; 
                const seasonNetTransfer = data.sumRx - data.sumTx;

                return (
                  <div key={season} className="border-b border-slate-800/50 last:border-0 pb-4">
                    <div className="bg-slate-900/50 px-4 py-2 border-b border-slate-800/80 flex items-center gap-2">
                      <div className="w-1.5 h-3 bg-yellow-500 rounded-full"></div>
                      <span className="text-xs font-black text-yellow-500 tracking-wider">{season}</span>
                    </div>

                    {isAll && (
                      <>
                        <div className="bg-slate-950/40 p-1.5 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800/30">
                            📊 정산 근거 (P&L)
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-slate-800/50">
                          <div className="flex flex-col p-3 sm:p-4 space-y-3 text-left">
                            {data.rev.length === 0 ? <p className="text-[10px] text-slate-600 italic py-1">상금 없음</p> : data.rev.map((item:any, i:number) => (
                              <div key={i} className="flex justify-between items-center w-full gap-2">
                                <span className="text-[10px] sm:text-xs font-bold text-slate-300 truncate">{item.title}</span>
                                <span className="text-[11px] sm:text-sm font-black text-emerald-400">+{Number(item.amount).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-col bg-slate-900/10 p-3 sm:p-4 space-y-3 text-left">
                            {data.exp.length === 0 ? <p className="text-[10px] text-slate-600 italic py-1">지출 없음</p> : data.exp.map((item:any, i:number) => (
                              <div key={i} className="flex justify-between items-center w-full gap-2">
                                <span className="text-[10px] sm:text-xs font-bold text-slate-400 truncate">{item.title}</span>
                                <span className="text-[11px] sm:text-sm font-black text-red-400">-{Number(item.amount).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="bg-slate-900/30 px-4 py-2 flex justify-between items-center text-[10px] sm:text-xs border-y border-slate-800/30">
                            <span className="text-slate-400 font-bold uppercase tracking-widest">이번 시즌 순수익 (근거 합계)</span>
                            <span className={`font-black ${seasonNetProfit > 0 ? 'text-emerald-400' : seasonNetProfit < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                {seasonNetProfit > 0 ? '+' : ''}{seasonNetProfit.toLocaleString()}
                            </span>
                        </div>
                      </>
                    )}

                    {(!isAll || data.p2pRx.length > 0 || data.p2pTx.length > 0) && (
                      <>
                        {isAll && (
                            <div className="bg-slate-950/40 p-1.5 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800/30">
                                💸 실제 이체 내역 (Transfer)
                            </div>
                        )}
                        <div className="grid grid-cols-2 divide-x divide-slate-800/50">
                          <div className="flex flex-col p-3 sm:p-4 space-y-3 text-left">
                            {data.p2pRx.length === 0 ? <p className="text-[10px] text-slate-600 italic py-1">받을 돈 없음</p> : data.p2pRx.map((item:any, i:number) => (
                              <div key={i} className="flex justify-between items-center w-full gap-2 bg-emerald-900/10 p-2 rounded-lg border border-emerald-900/30">
                                <span className="text-[10px] sm:text-xs font-bold text-blue-300 truncate">{item.text}</span>
                                <span className="text-[11px] sm:text-sm font-black text-emerald-400">+{Number(item.amount).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-col bg-slate-900/10 p-3 sm:p-4 space-y-3 text-left">
                            {data.p2pTx.length === 0 ? <p className="text-[10px] text-slate-600 italic py-1">보낼 돈 없음</p> : data.p2pTx.map((item:any, i:number) => (
                              <div key={i} className="flex justify-between items-center w-full gap-2 bg-red-900/10 p-2 rounded-lg border border-red-900/30">
                                <span className="text-[10px] sm:text-xs font-bold text-pink-300 truncate">{item.text}</span>
                                <span className="text-[11px] sm:text-sm font-black text-red-400">-{Number(item.amount).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {!isAll && (
                            <div className="bg-slate-900/30 px-4 py-2 flex justify-between items-center text-[10px] sm:text-xs border-y border-slate-800/30 mt-2">
                                <span className="text-slate-400 font-bold uppercase tracking-widest">이번 시즌 이체 합계</span>
                                <span className={`font-black ${seasonNetTransfer > 0 ? 'text-emerald-400' : seasonNetTransfer < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                    {seasonNetTransfer > 0 ? '+' : ''}{seasonNetTransfer.toLocaleString()}
                                </span>
                            </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )}
            
            <div className="bg-slate-950 p-5 border-t border-slate-700">
              <div className="flex justify-between items-end px-1 sm:px-2">
                <div className="flex flex-col text-left">
                  <span className="text-xs sm:text-sm text-white font-black uppercase tracking-widest">
                    {targetOwnerId === 'ALL' 
                      ? (settlementSeason === 'ALL' ? '전체 최종 수입 (잔액)' : '선택 시즌 수입 합계')
                      : `${owners.find(o => String(o.id) === targetOwnerId)?.nickname}님과의 누적 채무`
                    }
                  </span>
                  <span className="text-[9px] text-slate-500 mt-1">
                    {targetOwnerId === 'ALL' 
                      ? '* 화면에 표시된 내역의 순수익 합계입니다.' 
                      : '* 선택한 상대방과 역대 주고받아야 할 총 누적 채무액입니다.'
                    }
                  </span>
                </div>
                <span className={`text-2xl sm:text-3xl font-black italic tracking-tighter ${totalNetSettlement > 0 ? 'text-emerald-400' : totalNetSettlement < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                  {totalNetSettlement > 0 ? '+' : ''}₩ {totalNetSettlement.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* [탭 3] 명예의 전당 (HALL OF FAME) */}
      {activeTab === 'HALL_OF_FAME' && (
        <div className="space-y-6 animate-in slide-in-from-right-4">
          
          {rankedOwners.length > 0 && (() => {
            const champ = rankedOwners[0];
            return (
              <div className="relative w-full rounded-[1.5rem] overflow-hidden border-2 border-yellow-500/40 champion-card-glow transform hover:scale-[1.01] transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/20 via-[#020617] to-black z-0"></div>
                <div className="relative z-10 flex flex-col items-center p-6 pt-10 text-center backdrop-blur-sm">
                  <div className="relative mb-4">
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-5xl filter drop-shadow-2xl z-20 animate-bounce" style={{ animationDuration: '3s' }}>👑</div>
                    <div className="w-24 h-24 rounded-full p-[2px] bg-gradient-to-tr from-yellow-200 via-yellow-500 to-yellow-100 shadow-[0_0_30px_rgba(234,179,8,0.3)]">
                      <div className="w-full h-full rounded-full overflow-hidden border-2 border-[#020617]">
                        <img src={champ.photo} alt={champ.nickname} className="w-full h-full object-cover" />
                      </div>
                    </div>
                  </div>
                  
                  <h2 className="text-3xl font-black text-white mb-6 tracking-tighter italic uppercase leading-none">{champ.nickname}</h2>
                  
                  <div className="grid grid-cols-3 w-full max-w-lg mx-auto gap-2">
                    <div className="bg-[#0f172a]/80 p-2 sm:p-3 rounded-xl border border-yellow-500/20 flex flex-col items-center justify-center">
                      <span className="block text-[8px] sm:text-[9px] text-yellow-500 font-black mb-1 uppercase tracking-widest">Profit</span>
                      <span className="text-[10px] sm:text-xs font-black text-white italic truncate">{champ.netProfit > 0 ? '+' : ''}₩{champ.netProfit.toLocaleString()}</span>
                    </div>
                    <div className="bg-[#0f172a]/80 p-2 sm:p-3 rounded-xl border border-slate-800 flex flex-col items-center justify-center">
                      <span className="block text-[8px] sm:text-[9px] text-slate-500 font-black mb-1 uppercase tracking-widest">Record</span>
                      <span className="text-[10px] sm:text-xs font-bold text-white whitespace-nowrap">{champ.win}W {champ.draw}D {champ.loss}L</span>
                    </div>
                    <div className="bg-[#0f172a]/80 p-2 sm:p-3 rounded-xl border border-emerald-500/20 flex flex-col items-center justify-center">
                      <span className="block text-[8px] sm:text-[9px] text-emerald-500 font-black mb-1 uppercase tracking-widest">Best</span>
                      <div className="flex items-center gap-1 w-full justify-center px-1">
                        {champ.bestTeam?.wins > 0 ? (
                            <><img src={champ.bestTeam?.logo} className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-white p-[1px] object-contain shrink-0" alt="" /><span className="text-[10px] sm:text-xs font-black text-white truncate">{champ.bestTeam?.wins}W</span></>
                        ) : <span className="text-[10px] sm:text-xs font-black text-slate-600">-</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="bg-[#0f172a] rounded-[1.2rem] border border-slate-800 overflow-hidden shadow-2xl">
            <div className="bg-slate-950 py-3 px-5 border-b border-slate-800 flex justify-between items-center">
              <span className="text-[10px] font-black italic text-slate-400 uppercase tracking-widest">Hall of Fame Ledger</span>
            </div>
            <table className="w-full text-left text-[11px] uppercase border-collapse table-fixed">
              <thead className="bg-slate-900/50 text-slate-500 font-bold border-b border-slate-800/50 text-[9px]">
                <tr>
                  <th className="p-3 w-10 text-center">Rank</th>
                  <th className="p-3 w-28 sm:w-40 text-left">Owner</th>
                  <th className="p-3 text-center">W-D-L (Record)</th>
                  <th className="p-3 w-10 text-center">🏆</th>
                  <th className="p-3 text-right text-emerald-400">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30 font-medium">
                {rankedOwners.slice(1).map((o, i) => (
                  <tr key={o.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="p-3 text-center text-sm font-black text-slate-500">{i + 2}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden">
                        <img src={o.photo} className="w-7 h-7 rounded-full border border-slate-800 shrink-0 object-cover" alt="" />
                        <span className="font-black text-white text-[11px] tracking-tight truncate">{o.nickname}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center text-slate-400 font-bold text-[10px] whitespace-nowrap tracking-tighter">
                      <span className="text-white">{o.win}</span>W <span className="text-slate-600">/</span> {o.draw}D <span className="text-slate-600">/</span> <span className="text-red-400/80">{o.loss}L</span>
                    </td>
                    <td className="p-3 text-center text-yellow-500 font-black text-sm">{o.trophies > 0 ? o.trophies : '-'}</td>
                    <td className={`p-3 text-right font-black text-[11px] tracking-tighter ${o.netProfit > 0 ? 'text-emerald-400' : o.netProfit < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                      {o.netProfit > 0 ? '+' : ''}{o.netProfit.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};