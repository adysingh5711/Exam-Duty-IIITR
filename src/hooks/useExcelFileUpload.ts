import { useState, useCallback } from 'react';
import { Person } from '../types';
import { processExcelFile, FileProcessingResult } from '../services';

export interface UseFileUploadState {
    isLoading: boolean;
    fileName: string | null;
    error: string | null;
    faculty: Person[];
    staff: Person[];
}

export interface UseFileUploadActions {
    handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    clearData: () => void;
    clearError: () => void;
}

export function useFileUpload(): UseFileUploadState & UseFileUploadActions {
    const [state, setState] = useState<UseFileUploadState>({
        isLoading: false,
        fileName: null,
        error: null,
        faculty: [],
        staff: [],
    });

    const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Clear previous file input
        event.target.value = '';

        setState(prev => ({
            ...prev,
            isLoading: true,
            error: null,
        }));

        try {
            const result: FileProcessingResult = await processExcelFile(file);

            setState(prev => ({
                ...prev,
                isLoading: false,
                fileName: result.fileName,
                faculty: result.faculty,
                staff: result.staff,
                error: null,
            }));
        } catch (error) {
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: error instanceof Error ? error.message : 'Failed to process file',
            }));
        }
    }, []);

    const clearData = useCallback(() => {
        setState({
            isLoading: false,
            fileName: null,
            error: null,
            faculty: [],
            staff: [],
        });
    }, []);

    const clearError = useCallback(() => {
        setState(prev => ({
            ...prev,
            error: null,
        }));
    }, []);

    return {
        ...state,
        handleFileUpload,
        clearData,
        clearError,
    };
}