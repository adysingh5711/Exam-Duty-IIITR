import { Person } from './personTypes';

export interface ScheduleEntry {
    faculty: Person;
    staff: Person;
    room: number;
    day: number;
}

export interface DutyCount {
    name: string;
    count: number;
}

export interface Schedule {
    entries: ScheduleEntry[];
    facultyDuties: DutyCount[];
    staffDuties: DutyCount[];
}

export interface FacultyConstraint {
    facultyName: string;
    day: number;
}

export interface ScheduleConfig {
    days: number;
    rooms: number;
}

export interface ScheduleStats {
    facultyAvg: string;
    staffAvg: string;
    facultyMin: number;
    facultyMax: number;
    staffMin: number;
    staffMax: number;
    facultyStats: DutyCount[];
    staffStats: DutyCount[];
}