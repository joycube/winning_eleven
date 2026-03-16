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
    const state = useAdminMatching(targetSeason, owners, leagues, masterTeams, onNavigateToSchedule);

    return (
        <div className="space-y-6 animate-in fade-in relative">
            <AdminMatching_Step1_TeamSelect state={state} owners={owners} masterTeams={masterTeams} />
            <AdminMatching_Step2_Roster state={state} targetSeason={targetSeason} masterTeams={masterTeams} owners={owners} onDeleteSchedule={onDeleteSchedule} />

            {state.hasSchedule && (
                <>
                    {/* 🔥 주석 위치 수정 완료! 에러가 나지 않습니다. */}
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