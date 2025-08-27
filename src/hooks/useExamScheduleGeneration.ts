import { useState, useCallback } from 'react';
import { Person, Schedule, FacultyConstraint } from '../types';
import { generateSchedule, ScheduleGenerationOptions } from '../services';
import { DEFAULT_SCHEDULE_CONFIG } from '../constants';

export interface UseScheduleGenerationState {
    schedule: Schedule | null;
    isGenerated: boolean;
    isGenerating: boolean;
    error: string | null;
    days: number;
    rooms: number;
}

export interface UseScheduleGenerationActions {
    generateAndSetSchedule: (faculty: Person[], staff: Person[], constraints: FacultyConstraint[]) => void;
    clearSchedule: () => void;
    setDays: (days: number) => void;
    setRooms: (rooms: number) => void;
    clearError: () => void;
}

export function useScheduleGeneration(): UseScheduleGenerationState & UseScheduleGenerationActions {
    const [state, setState] = useState<UseScheduleGenerationState>({
        schedule: null,
        isGenerated: false,
        isGenerating: false,
        error: null,
        days: DEFAULT_SCHEDULE_CONFIG.days,
        rooms: DEFAULT_SCHEDULE_CONFIG.rooms,
    });

    const generateAndSetSchedule = useCallback((
        faculty: Person[],
        staff: Person[],
        constraints: FacultyConstraint[]
    ) => {
        if (faculty.length === 0 || staff.length === 0) {
            setState(prev => ({
                ...prev,
                error: 'Please upload faculty and staff data first',
            }));
            return;
        }

        setState(prev => ({
            ...prev,
            isGenerating: true,
            error: null,
        }));

        try {
            const options: ScheduleGenerationOptions = {
                days: state.days,
                rooms: state.rooms,
                constraints,
            };

            const generatedSchedule = generateSchedule(faculty, staff, options);

            setState(prev => ({
                ...prev,
                schedule: generatedSchedule,
                isGenerated: true,
                isGenerating: false,
                error: null,
            }));
        } catch (error) {
            setState(prev => ({
                ...prev,
                isGenerating: false,
                error: error instanceof Error ? error.message : 'Failed to generate schedule',
            }));
        }
    }, [state.days, state.rooms]);

    const clearSchedule = useCallback(() => {
        setState(prev => ({
            ...prev,
            schedule: null,
            isGenerated: false,
            error: null,
        }));
    }, []);

    const setDays = useCallback((days: number) => {
        setState(prev => ({
            ...prev,
            days,
            // Clear existing schedule when configuration changes
            schedule: null,
            isGenerated: false,
        }));
    }, []);

    const setRooms = useCallback((rooms: number) => {
        setState(prev => ({
            ...prev,
            rooms,
            // Clear existing schedule when configuration changes
            schedule: null,
            isGenerated: false,
        }));
    }, []);

    const clearError = useCallback(() => {
        setState(prev => ({
            ...prev,
            error: null,
        }));
    }, []);

    return {
        ...state,
        generateAndSetSchedule,
        clearSchedule,
        setDays,
        setRooms,
        clearError,
    };
}