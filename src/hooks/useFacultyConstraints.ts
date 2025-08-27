import { useState, useCallback } from 'react';
import { Person, FacultyConstraint } from '../types';
import { validateFacultyConstraint } from '../utils';
import { ERROR_MESSAGES } from '../constants';

export interface UseConstraintsState {
    constraints: FacultyConstraint[];
    newConstraintFaculty: string;
    newConstraintDay: number;
    error: string | null;
}

export interface UseConstraintsActions {
    addConstraint: (faculty: Person[], maxDays: number) => boolean;
    removeConstraint: (index: number) => void;
    setNewConstraintFaculty: (faculty: string) => void;
    setNewConstraintDay: (day: number) => void;
    clearConstraints: () => void;
    clearError: () => void;
}

export function useConstraints(): UseConstraintsState & UseConstraintsActions {
    const [state, setState] = useState<UseConstraintsState>({
        constraints: [],
        newConstraintFaculty: '',
        newConstraintDay: 1,
        error: null,
    });

    const addConstraint = useCallback((faculty: Person[], maxDays: number): boolean => {
        const validation = validateFacultyConstraint(
            state.newConstraintFaculty,
            state.newConstraintDay,
            faculty,
            maxDays
        );

        if (!validation.isValid) {
            setState(prev => ({
                ...prev,
                error: validation.error || 'Invalid constraint',
            }));
            return false;
        }

        // Check for duplicate constraints
        const isDuplicate = state.constraints.some(c =>
            c.facultyName === state.newConstraintFaculty && c.day === state.newConstraintDay
        );

        if (isDuplicate) {
            setState(prev => ({
                ...prev,
                error: ERROR_MESSAGES.DUPLICATE_CONSTRAINT,
            }));
            return false;
        }

        const newConstraint: FacultyConstraint = {
            facultyName: state.newConstraintFaculty,
            day: state.newConstraintDay,
        };

        setState(prev => ({
            ...prev,
            constraints: [...prev.constraints, newConstraint],
            newConstraintFaculty: '',
            newConstraintDay: 1,
            error: null,
        }));

        return true;
    }, [state.newConstraintFaculty, state.newConstraintDay, state.constraints]);

    const removeConstraint = useCallback((index: number) => {
        setState(prev => ({
            ...prev,
            constraints: prev.constraints.filter((_, i) => i !== index),
            error: null,
        }));
    }, []);

    const setNewConstraintFaculty = useCallback((faculty: string) => {
        setState(prev => ({
            ...prev,
            newConstraintFaculty: faculty,
            error: null,
        }));
    }, []);

    const setNewConstraintDay = useCallback((day: number) => {
        setState(prev => ({
            ...prev,
            newConstraintDay: day,
            error: null,
        }));
    }, []);

    const clearConstraints = useCallback(() => {
        setState(prev => ({
            ...prev,
            constraints: [],
            newConstraintFaculty: '',
            newConstraintDay: 1,
            error: null,
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
        addConstraint,
        removeConstraint,
        setNewConstraintFaculty,
        setNewConstraintDay,
        clearConstraints,
        clearError,
    };
}