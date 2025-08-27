import { Person, Schedule, FacultyConstraint, DutyCount } from '../types';
import { ScheduleStats } from '../types/examScheduleTypes';
import { generateSchedule as coreGenerateSchedule } from '../utils/examDutyScheduleGenerator';

export interface ScheduleGenerationOptions {
    days: number;
    rooms: number;
    constraints?: FacultyConstraint[];
}

/**
 * Generates a schedule with the given parameters
 */
export function generateSchedule(
    faculty: Person[],
    staff: Person[],
    options: ScheduleGenerationOptions
): Schedule {
    const { days, rooms, constraints = [] } = options;

    // Convert constraints to the format expected by the core algorithm
    const preAssignedFaculty: { [day: number]: string[] } = {};

    constraints.forEach(constraint => {
        if (!preAssignedFaculty[constraint.day]) {
            preAssignedFaculty[constraint.day] = [];
        }
        preAssignedFaculty[constraint.day].push(constraint.facultyName);
    });

    return coreGenerateSchedule(faculty, staff, preAssignedFaculty, days, rooms);
}

/**
 * Calculates statistics for a generated schedule
 */
export function calculateScheduleStats(schedule: Schedule): ScheduleStats {
    const facultyStats = schedule.facultyDuties;
    const staffStats = schedule.staffDuties;

    const facultyAvg = facultyStats.reduce((sum, item) => sum + item.count, 0) / facultyStats.length;
    const staffAvg = staffStats.reduce((sum, item) => sum + item.count, 0) / staffStats.length;

    return {
        facultyAvg: facultyAvg.toFixed(2),
        staffAvg: staffAvg.toFixed(2),
        facultyMin: facultyStats.length ? Math.min(...facultyStats.map(f => f.count)) : 0,
        facultyMax: facultyStats.length ? Math.max(...facultyStats.map(f => f.count)) : 0,
        staffMin: staffStats.length ? Math.min(...staffStats.map(s => s.count)) : 0,
        staffMax: staffStats.length ? Math.max(...staffStats.map(s => s.count)) : 0,
        facultyStats,
        staffStats,
    };
}

/**
 * Validates if a schedule is properly balanced
 */
export function validateSchedule(
    schedule: Schedule,
    expectedDays: number,
    expectedRooms: number
): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check if all slots are filled
    const expectedEntries = expectedDays * expectedRooms;
    if (schedule.entries.length !== expectedEntries) {
        issues.push(`Expected ${expectedEntries} entries, but found ${schedule.entries.length}`);
    }

    // Check for duplicate assignments (same person in multiple rooms on same day)
    const dayAssignments = new Map<number, Set<string>>();

    schedule.entries.forEach(entry => {
        if (!dayAssignments.has(entry.day)) {
            dayAssignments.set(entry.day, new Set());
        }

        const daySet = dayAssignments.get(entry.day)!;

        if (daySet.has(entry.faculty.name)) {
            issues.push(`Faculty ${entry.faculty.name} is assigned to multiple rooms on day ${entry.day}`);
        } else {
            daySet.add(entry.faculty.name);
        }

        if (daySet.has(entry.staff.name)) {
            issues.push(`Staff ${entry.staff.name} is assigned to multiple rooms on day ${entry.day}`);
        } else {
            daySet.add(entry.staff.name);
        }
    });

    return {
        isValid: issues.length === 0,
        issues,
    };
}

/**
 * Gets schedule entries for a specific day
 */
export function getScheduleForDay(schedule: Schedule, day: number) {
    return schedule.entries
        .filter(entry => entry.day === day)
        .sort((a, b) => a.room - b.room);
}

/**
 * Gets all unique days in the schedule
 */
export function getScheduleDays(schedule: Schedule): number[] {
    const days = new Set(schedule.entries.map(entry => entry.day));
    return Array.from(days).sort((a, b) => a - b);
}