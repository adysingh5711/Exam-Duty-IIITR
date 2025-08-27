// Default schedule configuration
export const DEFAULT_SCHEDULE_CONFIG = {
    days: 6,
    rooms: 11,
    minDays: 1,
    maxDays: 10,
    minRooms: 1,
    maxRooms: 20,
} as const;

// Schedule generation constants
export const SCHEDULE_CONSTRAINTS = {
    STAFF_DUTY_TARGET_RATIO: 1, // days - 1
    SENIORITY_THRESHOLD_PERCENT: 0.3, // Top 30% are senior
    MIN_STAFF_ASSIGNMENTS_BUFFER: 2,
} as const;

// Day labels for display (Day 1, Day 2, etc.)
export const DAY_LABELS = [
    'Day 1',
    'Day 2',
    'Day 3',
    'Day 4',
    'Day 5',
    'Day 6',
] as const;

// Excel export configuration
export const EXCEL_CONFIG = {
    DEFAULT_FILENAME: 'examination-schedule.xlsx',
    MAIN_SHEET_NAME: 'Examination Schedule',
    STATS_SHEET_NAME: 'Duty Counts',
    COLUMN_WIDTHS: {
        DATE_CLASSROOM: 20,
        DAY_COLUMN: 12,
    },
} as const;