"use client";

import React from 'react';
import { Season, Owner, League, MasterTeam } from '../types';
import { useAdminMatching } from '../hooks/useAdminMatching';

import { AdminMatching_Step1_TeamSelect } from './AdminMatching_Step1_TeamSelect';
import { AdminMatching_Step2_Roster } from './AdminMatching_Step2_Roster';
import { AdminMatching_Step3_LeaguePO } from './AdminMatching_Step3_LeaguePO';
import { AdminMatching_Step3_Tournament } from './AdminMatching_Step3_Tournament';

interface Props {
    targetSeason: Season;
    owners: Owner[];
    leagues: League[];
    masterTeams: MasterTeam[];
    onNavigateToSchedule: (id: number) => void;
    onDeleteSchedule: (id: number) => void;
}

export const AdminTeamMatching = ({ targetSeason, owners, leagues, masterTeams, onNavigateToSchedule, onDeleteSchedule }: Props) => {
    // 🔥 모든 로직과 상태를 중앙에서 관리하는 커스텀 훅
    const state = useAdminMatching(targetSeason, owners, leagues, masterTeams, onNavigateToSchedule);

    return (
        <div className="space-y-6 animate-in fade-in relative">
            {/* Step 1: 팀 선택 및 매칭 (🚨 D등급 필터 UI는 이 컴포넌트 내부에 있습니다) */}
            <AdminMatching_Step1_TeamSelect state={state} owners={owners} masterTeams={masterTeams} />
            
            {/* Step 2: 배정된 로스터 확인 */}
            <AdminMatching_Step2_Roster state={state} targetSeason={targetSeason} masterTeams={masterTeams} owners={owners} onDeleteSchedule={onDeleteSchedule} />

            {/* Step 3: 스케줄 생성 후 대진표 세팅 */}
            {state.hasSchedule && (
                <>
                    {targetSeason.type === 'LEAGUE_PLAYOFF' && (
                        <AdminMatching_Step3_LeaguePO 
                            state={state} 
                            targetSeason={targetSeason} 
                            masterTeams={masterTeams} 
                            owners={owners} 
                        />
                    )}
                    {targetSeason.type === 'TOURNAMENT' && (
                        <AdminMatching_Step3_Tournament 
                            state={state} 
                            targetSeason={targetSeason} 
                            onNavigateToSchedule={onNavigateToSchedule} 
                        />
                    )}
                </>
            )}
        </div>
    );
};