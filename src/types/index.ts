// Person types
export type { Person, PersonType } from './personTypes';

// Schedule types
export type {
    ScheduleEntry,
    DutyCount,
    Schedule,
    FacultyConstraint,
    ScheduleConfig,
    ScheduleStats
} from './examScheduleTypes';

// Re-export for backward compatibility
export type {
    Person as PersonInterface,
    ScheduleEntry as ScheduleEntryInterface,
    DutyCount as DutyCountInterface,
    Schedule as ScheduleInterface,
    FacultyConstraint as FacultyConstraintInterface,
    ScheduleStats as ScheduleStatsInterface
} from './examScheduleTypes';