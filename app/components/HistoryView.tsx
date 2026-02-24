/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useRef } from 'react';
import { FALLBACK_IMG, Owner } from '../types';

// 🔥 캡처 라이브러리 추가
import { toPng } from 'html-to-image';
// @ts-ignore
import download from 'downloadjs';

// 💣 [기본에 충실한 SafeImage] 프록시 제거! 순수 원본 로딩 방식
const SafeImage = ({ src, className, isBg = false }: { src: string, className?: string, isBg?: boolean }) => {
  const [imgSrc, setImgSrc] = useState<string>(src || FALLBACK_IMG);
  const [cors, setCors] = useState<"anonymous" | undefined>("anonymous");

  useEffect(() => {
    if (!src) {
      setImgSrc(FALLBACK_IMG);
      setCors(undefined);
      return;
    }
    // 1단계: 캡처를 염두에 두고 원본 주소 + CORS 허용으로 시도
    setImgSrc(src);
    setCors("anonymous");
  }, [src]);

  const handleError = () => {
    if (cors === "anonymous") {
      // 2단계: CORS 때문에 브라우저가 원본 로딩을 막으면, 보안 설정을 풀고 단순 화면 표시용으로 재시도
      setImgSrc(src);
      setCors(undefined);
    } else {
      // 3단계: 그래도 에러 나면 기본 이미지 표시
      setImgSrc(FALLBACK_IMG);
    }
  };

  if (isBg) {
    return (
      <div 
        className={className} 
        style={{ 
          backgroundImage: `url(${imgSrc})`, 
          backgroundSize: 'contain', 
          backgroundPosition: 'center', 
          backgroundRepeat: 'no-repeat' 
        }} 
      />
    );
  }

  return <img src={imgSrc} className={className} alt="" crossOrigin={cors} onError={handleError} />;
};

const getTodayFormatted = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}.${month}.${day}`;
};

interface HistoryViewProps {
  historyData: any;
  owners?: Owner[]; 
}

export const HistoryView = ({ historyData, owners = [] }: HistoryViewProps) => {
  const [historyTab, setHistoryTab] = useState<'TEAMS' | 'OWNERS' | 'PLAYERS'>('OWNERS');
  const [histPlayerMode, setHistPlayerMode] = useState<'GOAL' | 'ASSIST'>('GOAL');

  const legendCardRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const sortedTeams = [...(historyData.teams || [])].sort((a: any, b: any) => {
    if (b.points !== a.points) return b.points - a.points;      
    if ((b.gd || 0) !== (a.gd || 0)) return (b.gd || 0) - (a.gd || 0); 
    return (b.gf || 0) - (a.gf || 0);                           
  });

  const getPlayerRanking = (players: any[]) => {
    const sortedPlayers = players
        .filter((p:any) => histPlayerMode === 'GOAL' ? p.goals > 0 : p.assists > 0)
        .sort((a:any,b:any) => histPlayerMode === 'GOAL' ? b.goals - a.goals : b.assists - a.assists);

    let currentRank = 1;
    let skip = 0;

    return sortedPlayers.map((player, index, array) => {
        if (index > 0) {
            const prevPlayer = array[index - 1];
            const prevScore = histPlayerMode === 'GOAL' ? prevPlayer.goals : prevPlayer.assists;
            const currScore = histPlayerMode === 'GOAL' ? player.goals : player.assists;

            if (prevScore === currScore) {
                skip++;
            } else {
                currentRank += 1 + skip;
                skip = 0;
            }
        }
        return { ...player, rank: currentRank };
    });
  };

  const rankedPlayers = getPlayerRanking(historyData.players || []);

  const handleCaptureLegend = async () => {
    if (!legendCardRef.current) return;
    setIsCapturing(true);

    try {
        // 모바일 환경 렌더링 딜레이 대기
        await new Promise(resolve => setTimeout(resolve, 400));

        const dataUrl = await toPng(legendCardRef.current, { 
            cacheBust: true, 
            backgroundColor: 'transparent', 
            pixelRatio: 2, 
            style: { transform: 'scale(1)', transformOrigin: 'top left', margin: '0' }
        });
        
        const fileName = `hall-of-fame-legend-${Date.now()}.png`;
        
        download(dataUrl, fileName);
        
        if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
             try {
                 const blob = await (await fetch(dataUrl)).blob();
                 const file = new File([blob], fileName, { type: blob.type });
                 await navigator.share({
                     title: '👑 Hall of Fame Legend',
                     text: '역대 통합 랭킹 1위 레전드입니다!',
                     files: [file]
                 });
             } catch (shareErr) {}
        } else {
             alert('📷 기기에 레전드 카드가 저장되었습니다!');
        }
    } catch (error: any) {
        console.error('캡처 실패:', error);
        // 🔥 프록시 없이 캡처가 막혔을 때, 정확한 원인 안내
        alert(`이미지 캡처에 실패했습니다.\n오너 프로필 사진이 외부 보안이 강한 링크로 등록되어 있어 캡처가 차단되었습니다. (사파리/크롬 모바일 보안 제약)\n\nPC 환경에서 시도하시거나, 해당 오너의 프로필 사진을 일반적인 이미지 링크로 변경해 주세요.`);
    } finally {
        setIsCapturing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
        
        <style dangerouslySetInnerHTML={{ __html: `
            @keyframes verticalFloat {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-12px); }
            }
            @keyframes green-light-sweep {
                0% { transform: translateX(-100%) skewX(-25deg); opacity: 0; }
                50% { opacity: 0.5; }
                100% { transform: translateX(200%) skewX(-25deg); opacity: 0; }
            }
            @keyframes green-glow-pulse {
                0%, 100% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.1); }
                50% { box-shadow: 0 0 40px rgba(16, 185, 129, 0.3); }
            }
            .trophy-float-straight { animation: verticalFloat 4s infinite ease-in-out; }
            .silver-trophy { filter: grayscale(100%) drop-shadow(0 4px 8px rgba(0,0,0,0.6)); }
            .green-neon-bg {
                background: linear-gradient(135deg, rgba(6, 78, 59, 0.4), rgba(15, 23, 42, 0.9), rgba(6, 78, 59, 0.4));
                animation: green-glow-pulse 4s infinite ease-in-out;
            }
            .green-sweep-beam {
                position: absolute; top: 0; left: 0; width: 50%; height: 100%;
                background: linear-gradient(to right, transparent, rgba(52, 211, 153, 0.2), transparent);
                filter: blur(10px); animation: green-light-sweep 4s infinite ease-in-out; pointer-events: none;
            }
        `}} />

        <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-blue-900/20" />
            <h2 className="text-2xl font-black italic text-white mb-1 relative z-10">👑 HALL OF FAME 👑</h2>
            <p className="text-xs text-slate-400 relative z-10">역대 모든 시즌의 통합 기록입니다.</p>
        </div>

        <div className="bg-slate-900/80 p-2 rounded-2xl border border-slate-800 flex justify-center gap-1">
            {['TEAMS', 'OWNERS', 'PLAYERS'].map(t => (
                <button key={t} onClick={() => setHistoryTab(t as any)} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${historyTab === t ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-950 text-slate-500'}`}>{t}</button>
            ))}
        </div>

        {historyTab === 'TEAMS' && (
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs uppercase">
                    <thead className="bg-slate-900 text-slate-500"><tr><th className="p-4 w-8">#</th><th className="p-4">Team</th><th className="p-4 text-center">W/D/L</th><th className="p-4 text-right">Pts</th></tr></thead>
                    <tbody>
                        {sortedTeams.slice(0, 20).map((t:any, i:number) => (
                            <tr key={i} className="border-b border-slate-800/50">
                                <td className="p-4 text-center text-slate-600">{i+1}</td>
                                <td className="p-4 font-bold text-white flex items-center gap-2">
                                    <img src={t.logo} className="w-6 h-6 object-contain bg-white rounded-full p-0.5 flex-shrink-0" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG}/>{t.name} <span className="text-[9px] text-slate-500">({t.owner})</span>
                                </td>
                                <td className="p-4 text-center text-slate-400">{t.win}W {t.draw}D {t.loss}L</td>
                                <td className="p-4 text-right text-emerald-400 font-bold">{t.points}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {historyTab === 'OWNERS' && (
            <div className="space-y-4">
                {historyData.owners.length > 0 && (() => {
                    const legend = historyData.owners[0];
                    const matchedOwner = (owners && owners.length > 0) 
                                ? owners.find(owner => owner.nickname === legend.name) 
                                : null;
                    const displayPhoto = matchedOwner?.photo || FALLBACK_IMG;

                    return (
                        <div className="mb-6 relative flex flex-col">
                            <div className="flex justify-end w-full px-1 mb-2">
                                <button 
                                    onClick={handleCaptureLegend} 
                                    disabled={isCapturing}
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-emerald-400 transition-colors bg-slate-900/50 px-2.5 py-1.5 rounded-lg border border-slate-800"
                                >
                                    {isCapturing ? '⏳ 캡처 중...' : '📸 이미지로 저장'}
                                </button>
                            </div>

                            <div id="legend-card-wrap" ref={legendCardRef} className="relative w-full rounded-2xl overflow-hidden border border-emerald-500/30 shadow-2xl bg-[#0f172a]">
                                <div className="absolute inset-0 green-neon-bg z-0"></div>
                                <div className="green-sweep-beam z-0"></div>
                                
                                <div className="relative z-10 flex flex-col md:flex-row items-center p-5 gap-6 bg-slate-950/40 backdrop-blur-sm pb-10">
                                    <div className="relative pt-4 pl-10">
                                        <div className="absolute -top-2 -left-6 text-6xl z-20 trophy-float-straight silver-trophy">🏆</div>
                                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full p-[3px] bg-gradient-to-br from-emerald-300 via-emerald-500 to-emerald-900 shadow-2xl relative z-10">
                                            <div className="w-full h-full rounded-full overflow-hidden border-4 border-slate-900 grayscale-[0.2]">
                                                {/* 💣 SafeImage 적용! */}
                                                <SafeImage src={displayPhoto} className="w-full h-full object-cover"/>
                                            </div>
                                        </div>
                                        <div className="absolute -bottom-3 inset-x-0 flex justify-center z-30">
                                            <span className="bg-gradient-to-r from-slate-900 to-slate-800 text-emerald-400 text-[10px] font-black px-4 py-1 rounded-full border border-emerald-500/50 shadow-lg tracking-widest uppercase">
                                                All-Time Legend
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex-1 text-center md:text-left pt-3 md:pt-0 w-full">
                                        <h3 className="text-[10px] text-emerald-400 font-bold tracking-[0.3em] mb-1 uppercase">Hall of Fame No.1</h3>
                                        <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-300 mb-4 drop-shadow-sm tracking-tight">
                                            {legend.name}
                                        </h2>
                                        
                                        <div className="flex flex-col gap-2 w-full">
                                            <div className="grid grid-cols-3 gap-2 w-full">
                                                <div className="bg-slate-900/80 rounded-lg py-2 border border-slate-700/50 flex flex-col items-center justify-center">
                                                    <span className="text-[9px] text-slate-500 block font-bold mb-0.5">POINTS</span>
                                                    <span className="text-lg font-black text-emerald-400 leading-none">{legend.points}</span>
                                                </div>
                                                <div className="bg-slate-900/80 rounded-lg py-2 border border-slate-700/50 flex flex-col items-center justify-center">
                                                    <span className="text-[9px] text-slate-500 block font-bold mb-0.5">RECORD</span>
                                                    <span className="text-sm font-bold text-slate-200 leading-none">{legend.win}W {legend.draw}D {legend.loss}L</span>
                                                </div>
                                                <div className="bg-slate-900/80 rounded-lg py-2 border border-slate-700/50 flex flex-col items-center justify-center">
                                                    <span className="text-[9px] text-slate-500 block font-bold mb-0.5">TROPHIES</span>
                                                    <div className="flex gap-1 text-xs leading-none">
                                                        {legend.golds > 0 ? <span>🥇{legend.golds}</span> : <span className="text-slate-700">-</span>}
                                                        {legend.silvers > 0 && <span className="opacity-70">🥈{legend.silvers}</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 rounded-lg py-2 border border-emerald-500/30 flex flex-col items-center justify-center w-full">
                                                <span className="text-[9px] text-emerald-400 block font-black mb-0.5">TOTAL PRIZE</span>
                                                <span className="text-base font-bold text-white leading-none">₩ {legend.prize.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute bottom-2 right-4 text-[8px] text-slate-500/80 font-bold italic tracking-wider z-20">
                                    {`HALL OF FAME / ${getTodayFormatted()}`}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-lg">
                    <table className="w-full text-left text-xs uppercase">
                        <thead className="bg-slate-950 text-slate-500">
                            <tr>
                                <th className="px-2 py-3 w-8 text-center">#</th>
                                <th className="px-2 py-3">Owner</th>
                                <th className="px-2 py-3 text-center">Rec</th>
                                <th className="px-2 py-3 text-center text-emerald-400">Pts</th>
                                <th className="px-2 py-3 text-center">Awards</th>
                                <th className="px-2 py-3 text-right">Prize</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historyData.owners.slice(1).map((o:any, i:number) => {
                                const actualRank = i + 2; 
                                const matchedOwner = (owners && owners.length > 0) 
                                    ? owners.find(owner => owner.nickname === o.name) 
                                    : null;
                                const displayPhoto = matchedOwner?.photo || FALLBACK_IMG;

                                return (
                                    <tr key={i} className="border-b border-slate-800/50">
                                        <td className={`px-2 py-3 text-center font-bold ${actualRank===2?'text-slate-300':actualRank===3?'text-orange-400':'text-slate-600'}`}>{actualRank}</td>
                                        
                                        <td className="px-2 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-full bg-slate-800 border overflow-hidden flex-shrink-0 ${actualRank===2 ? 'border-slate-400' : actualRank===3 ? 'border-orange-600' : 'border-slate-700'}`}>
                                                    <img src={displayPhoto} className="w-full h-full object-cover" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} />
                                                </div>
                                                <span className={`font-bold text-xs whitespace-nowrap ${actualRank===2 ? 'text-slate-200' : actualRank===3 ? 'text-orange-200' : 'text-white'}`}>{o.name}</span>
                                            </div>
                                        </td>

                                        <td className="px-2 py-3 text-center text-slate-400 text-[11px] font-medium whitespace-nowrap">
                                            <span className="text-white">{o.win}</span>W <span className="mx-0.5"></span>
                                            <span className="text-slate-500">{o.draw}D</span> <span className="mx-0.5"></span>
                                            <span className="text-red-400">{o.loss}L</span>
                                        </td>

                                        <td className="px-2 py-3 text-center text-emerald-400 font-black text-sm">
                                            {o.points}
                                        </td>

                                        <td className="px-2 py-3 text-center text-[10px]">
                                            <div className="flex justify-center gap-1">
                                                {o.golds>0 && <span>🥇{o.golds}</span>}
                                                {o.silvers>0 && <span>🥈{o.silvers}</span>}
                                                {o.bronzes>0 && <span>🥉{o.bronzes}</span>}
                                                {o.golds+o.silvers+o.bronzes===0 && <span className="text-slate-700">-</span>}
                                            </div>
                                        </td>
                                        <td className="px-2 py-3 text-right text-slate-300 font-bold text-xs whitespace-nowrap">₩ {o.prize.toLocaleString()}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {historyTab === 'PLAYERS' && (
            <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
                <div className="flex bg-slate-950 border-b border-slate-800">
                    <button onClick={()=>setHistPlayerMode('GOAL')} className={`flex-1 py-3 text-xs font-bold ${histPlayerMode==='GOAL'?'text-yellow-400 bg-slate-900':'text-slate-500'}`}>⚽ TOP SCORERS</button>
                    <button onClick={()=>setHistPlayerMode('ASSIST')} className={`flex-1 py-3 text-xs font-bold ${histPlayerMode==='ASSIST'?'text-blue-400 bg-slate-900':'text-slate-500'}`}>🅰️ TOP ASSISTS</button>
                </div>
                <table className="w-full text-left text-xs uppercase">
                    <thead className="bg-slate-900 text-slate-500"><tr><th className="p-3 w-8">#</th><th className="p-3">Player</th><th className="p-3">Team</th><th className="p-3 text-right">{histPlayerMode}</th></tr></thead>
                    <tbody>
                        {rankedPlayers.slice(0, 20).map((p:any, i:number) => (
                            <tr key={i} className="border-b border-slate-800/50">
                                <td className={`p-3 text-center ${p.rank<=3?'text-emerald-400 font-bold':'text-slate-600'}`}>{p.rank}</td>
                                <td className="p-3 font-bold text-white">{p.name} <span className="text-[9px] text-slate-500 font-normal ml-1">({p.owner})</span></td>
                                <td className="p-3 text-slate-400 flex items-center gap-2">
                                    <img src={p.teamLogo} className="w-5 h-5 object-contain rounded-full bg-white p-0.5" alt="" onError={(e:any)=>e.target.src=FALLBACK_IMG} /><span>{p.team}</span>
                                </td>
                                <td className={`p-3 text-right font-bold ${histPlayerMode==='GOAL'?'text-yellow-400':'text-blue-400'}`}>{histPlayerMode==='GOAL'?p.goals:p.assists}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>
  );
};

export default HistoryView;