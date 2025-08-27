import { Person } from '../../types';
import { AssignmentTracking, DailyState, SchedulerConfig } from './schedulerInterfaces';

/**
 * Initializes tracking data structures for assignment management
 */
export function initializeTracking(
    faculty: Person[],
    staff: Person[],
    config: SchedulerConfig
): { tracking: AssignmentTracking; dailyState: DailyState } {
    const allPeople = [...faculty, ...staff];

    // Create indices for seniority reference
    const facultyIndices = new Map<string, number>();
    faculty.forEach((f, index) => facultyIndices.set(f.name, index));

    const staffIndices = new Map<string, number>();
    staff.forEach((s, index) => staffIndices.set(s.name, index));

    // Initialize duty counter
    const dutyCounter = new Map<string, { count: number; type: 'faculty' | 'staff' }>();
    faculty.forEach(f => dutyCounter.set(f.name, { count: 0, type: 'faculty' }));
    staff.forEach(s => dutyCounter.set(s.name, { count: 0, type: 'staff' }));

    // Keep track of assignments to avoid same classroom on consecutive days
    const personAssignments = new Map<string, { day: number; room: number }[]>();
    allPeople.forEach(p => personAssignments.set(p.name, []));

    // Initialize daily tracking
    const preAssignedRooms = new Map<number, number[]>();
    const dailyAssignments = new Map<number, Set<string>>();
    const preAssignedPeople = new Map<string, number[]>();

    for (let day = 1; day <= config.days; day++) {
        dailyAssignments.set(day, new Set<string>());
        preAssignedRooms.set(day, []);
    }

    return {
        tracking: {
            dutyCounter,
            personAssignments,
            facultyIndices,
            staffIndices,
        },
        dailyState: {
            preAssignedRooms,
            dailyAssignments,
            preAssignedPeople,
        },
    };
}

/**
 * Updates assignment tracking after assigning a person to a room
 */
export function updateAssignmentTracking(
    personName: string,
    day: number,
    room: number,
    tracking: AssignmentTracking,
    dailyState: DailyState
): void {
    // Update duty counter
    const dutyInfo = tracking.dutyCounter.get(personName);
    if (dutyInfo) {
        dutyInfo.count++;
    }

    // Update assignment history
    const assignments = tracking.personAssignments.get(personName);
    if (assignments) {
        assignments.push({ day, room });
    }

    // Update daily assignments
    const dailySet = dailyState.dailyAssignments.get(day);
    if (dailySet) {
        dailySet.add(personName);
    }
}

/**
 * Checks if a person was in the same room on the previous day
 */
export function wasInSameRoomYesterday(
    personName: string,
    day: number,
    room: number,
    tracking: AssignmentTracking
): boolean {
    const assignments = tracking.personAssignments.get(personName) || [];
    return assignments.some(a => a.day === day - 1 && a.room === room);
}

/**
 * Checks if a person is already assigned on a given day
 */
export function isAssignedOnDay(
    personName: string,
    day: number,
    dailyState: DailyState
): boolean {
    const dailySet = dailyState.dailyAssignments.get(day);
    return dailySet ? dailySet.has(personName) : false;
}

/**
 * Gets the remaining duties needed for a person to reach their target
 */
export function getRemainingDuties(
    personName: string,
    staffDutyTarget: number,
    tracking: AssignmentTracking
): number {
    const dutyInfo = tracking.dutyCounter.get(personName);
    if (!dutyInfo || dutyInfo.type !== 'staff') {
        return 0;
    }
    return Math.max(0, staffDutyTarget - dutyInfo.count);
}

/**
 * Calculates target staff assignments for a given day
 */
export function calculateDayStaffTarget(
    day: number,
    staff: Person[],
    config: SchedulerConfig,
    tracking: AssignmentTracking,
    assignedRoomsForDay: number[]
): number {
    const remainingDays = config.days - day + 1;
    const remainingStaffDuties = staff.reduce((sum, s) =>
        sum + getRemainingDuties(s.name, config.staffDutyTarget, tracking), 0
    );

    return Math.min(
        config.rooms - assignedRoomsForDay.length, // Can't exceed available rooms
        Math.ceil(remainingStaffDuties / remainingDays) // Distribute evenly
    );
}