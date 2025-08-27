import { UI_CONFIG, ERROR_MESSAGES } from '../constants';
import { Person } from '../types';

/**
 * Validates if a file is a valid Excel file
 */
export function validateExcelFile(file: File): { isValid: boolean; error?: string } {
    // Check file size
    if (file.size > UI_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
        return { isValid: false, error: ERROR_MESSAGES.FILE_TOO_LARGE };
    }

    // Check file type
    const isValidType = UI_CONFIG.SUPPORTED_FILE_TYPES.includes(file.type);
    const isValidExtension = UI_CONFIG.SUPPORTED_EXTENSIONS.some(ext =>
        file.name.toLowerCase().endsWith(ext)
    );

    if (!isValidType && !isValidExtension) {
        return { isValid: false, error: ERROR_MESSAGES.INVALID_FILE_TYPE };
    }

    return { isValid: true };
}

/**
 * Validates faculty constraint input
 */
export function validateFacultyConstraint(
    facultyName: string,
    day: number,
    facultyList: Person[],
    maxDays: number
): { isValid: boolean; error?: string } {
    if (!facultyName.trim()) {
        return { isValid: false, error: ERROR_MESSAGES.EMPTY_FACULTY_SELECTION };
    }

    if (day < 1 || day > maxDays) {
        return { isValid: false, error: ERROR_MESSAGES.INVALID_DAY_RANGE(maxDays) };
    }

    const facultyExists = facultyList.some(f => f.name === facultyName);
    if (!facultyExists) {
        return { isValid: false, error: ERROR_MESSAGES.FACULTY_NOT_FOUND };
    }

    return { isValid: true };
}

/**
 * Validates schedule configuration
 */
export function validateScheduleConfig(days: number, rooms: number): {
    isValid: boolean;
    error?: string
} {
    if (days < 1 || days > 10) {
        return { isValid: false, error: 'Number of days must be between 1 and 10' };
    }

    if (rooms < 1 || rooms > 20) {
        return { isValid: false, error: 'Number of rooms must be between 1 and 20' };
    }

    return { isValid: true };
}