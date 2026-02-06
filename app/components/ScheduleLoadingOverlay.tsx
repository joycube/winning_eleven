import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
    status: 'IDLE' | 'LOADING' | 'ERROR';
    onRetry: () => void;
    onCancel: () => void;
}

// ⚠️ export default가 아니라 export const여야 합니다.
export const ScheduleLoadingOverlay = ({ status, onRetry, onCancel }: Props) => {
    if (status === 'IDLE') return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md">
            <AnimatePresence mode="wait">
                {status === 'LOADING' && (
                    <motion.div 
                        key="loading"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="text-center"
                    >
                        {/* 회전하는 축구공 */}
                        <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            className="text-7xl mb-6 inline-block"
                        >
                            ⚽
                        </motion.div>
                        <h2 className="text-2xl font-black italic text-white mb-2 tracking-tighter">
                            지금 스케쥴을 생성 중입니다.
                        </h2>
                        <p className="text-emerald-400 font-bold animate-pulse">잠시만 기다려주세요...</p>
                    </motion.div>
                )}

                {status === 'ERROR' && (
                    <motion.div 
                        key="error"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-slate-900 border border-red-500/50 p-8 rounded-3xl max-w-sm w-full text-center shadow-[0_0_50px_rgba(239,68,68,0.2)]"
                    >
                        <div className="text-5xl mb-4">⚠️</div>
                        <h2 className="text-xl font-black text-white mb-4 tracking-tight leading-tight">
                            스케쥴을 생성하지 못 했습니다.<br/>다시 생성할까요?
                        </h2>
                        <p className="text-slate-400 text-sm mb-8">
                            팀 구성이 너무 복잡하여 매칭에 실패했습니다.<br/>
                            (오너 간 팀 밸런스를 확인해주세요)
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={onCancel}
                                className="py-4 rounded-xl bg-slate-800 text-slate-400 font-bold hover:bg-slate-700 transition-colors"
                            >
                                아니오
                            </button>
                            <button 
                                onClick={onRetry}
                                className="py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-black italic shadow-lg hover:brightness-110 transition-all"
                            >
                                예 (다시 시도)
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};