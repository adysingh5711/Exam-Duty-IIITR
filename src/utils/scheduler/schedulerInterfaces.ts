import { Person, ScheduleEntry } from '../../types';

// Internal scheduler types
export interface SchedulerConfig {
    days: number;
    rooms: number;
    totalPositions: number;
    staffDutyTarget: number;
    totalStaffDuties: number;
    totalFacultyDuties: number;
    seniorityThreshold: number;
}

export interface DutyLimits {
    maxDutiesPerFaculty: Map<string, number>;
    minDutiesPerFaculty: number;
}

export interface AssignmentTracking {
    dutyCounter: Map<string, { count: number; type: 'faculty' | 'staff' }>;
    personAssignments: Map<string, { day: number; room: number }[]>;
    facultyIndices: Map<string, number>;
    staffIndices: Map<string, number>;
}

export interface DailyState {
    preAssignedRooms: Map<number, number[]>;
    dailyAssignments: Map<number, Set<string>>;
    preAssignedPeople: Map<string, number[]>; // person name -> days they are pre-assigned to
}

export interface AssignmentContext {
    config: SchedulerConfig;
    limits: DutyLimits;
    tracking: AssignmentTracking;
    dailyState: DailyState;
    faculty: Person[];
    staff: Person[];
    allPeople: Person[];
}

export interface PositionCandidate {
    person: Person;
    priority: number;
    reason: string;
}