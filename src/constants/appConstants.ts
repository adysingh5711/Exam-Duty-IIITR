// Application metadata
export const APP_CONFIG = {
    NAME: 'Exam-Duty-IIITR',
    VERSION: '1.0.0',
    AUTHOR: 'Aditya Singh',
    DESCRIPTION: 'Exam Duty Scheduler for IIITR',
} as const;

// UI Constants
export const UI_CONFIG = {
    MAX_FILE_SIZE_MB: 10,
    SUPPORTED_FILE_TYPES: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
    ],
    SUPPORTED_EXTENSIONS: ['.xlsx', '.xls'],
    DEBOUNCE_DELAY: 300,
} as const;

// Error messages
export const ERROR_MESSAGES = {
    FILE_TOO_LARGE: `File size exceeds ${UI_CONFIG.MAX_FILE_SIZE_MB}MB limit`,
    INVALID_FILE_TYPE: 'Please upload a valid Excel file (.xlsx or .xls)',
    FACULTY_NOT_FOUND: 'Selected faculty member not found in the uploaded list',
    DUPLICATE_CONSTRAINT: 'This constraint already exists',
    INVALID_DAY_RANGE: (days: number) => `Day must be between 1 and ${days}`,
    EMPTY_FACULTY_SELECTION: 'Please select a faculty member',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
    FILE_UPLOADED: 'File uploaded successfully',
    SCHEDULE_GENERATED: 'Schedule generated successfully',
    CONSTRAINT_ADDED: 'Constraint added successfully',
    CONSTRAINT_REMOVED: 'Constraint removed successfully',
} as const;