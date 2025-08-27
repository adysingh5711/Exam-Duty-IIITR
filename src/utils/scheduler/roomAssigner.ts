import { Person, ScheduleEntry } from '../../types';
import { AssignmentContext } from './schedulerInterfaces';
import { selectBestCandidate } from './personSelector';
import { updateAssignmentTracking, calculateDayStaffTarget } from './assignmentTracker';

/**
 * Assigns people to positions in a room for a given day with independent selection
 */
export function assignRoomPositions(
    day: number,
    room: number,
    context: AssignmentContext,
    staffAssignmentsForDay: number
): { selectedPeople: Person[]; updatedStaffCount: number } {
    const selectedPeople: Person[] = [];
    let currentStaffCount = staffAssignmentsForDay;

    // Get already assigned rooms for this day
    const assignedRoomsForDay = context.dailyState.preAssignedRooms.get(day) || [];
    const targetStaffForDay = calculateDayStaffTarget(day, context.staff, context.config, context.tracking, assignedRoomsForDay);

    // Determine if we need more staff assignments for this day
    const needMoreStaff = currentStaffCount < targetStaffForDay;

    // Independent assignment: Try to assign the best available people regardless of type
    // Position 0: Try to get the best faculty first, but allow staff if needed
    const firstPerson = selectPersonForPosition(
        0,
        day,
        room,
        selectedPeople,
        false, // Don't force staff prioritization for first position
        context,
        'faculty' // Prefer faculty for first position
    );

    if (firstPerson) {
        selectedPeople.push(firstPerson);
        const personType = context.tracking.dutyCounter.get(firstPerson.name)!.type;
        if (personType === 'staff') {
            currentStaffCount++;
        }
    }

    // Position 1: Independent selection based on needs
    const secondPerson = selectPersonForPosition(
        1,
        day,
        room,
        selectedPeople,
        needMoreStaff, // Consider staff needs but don't force it
        context,
        needMoreStaff ? 'staff' : 'any' // Prefer staff if needed, otherwise any
    );

    if (secondPerson) {
        selectedPeople.push(secondPerson);
        const personType = context.tracking.dutyCounter.get(secondPerson.name)!.type;
        if (personType === 'staff') {
            currentStaffCount++;
        }
    }

    return {
        selectedPeople,
        updatedStaffCount: currentStaffCount,
    };
}

/**
 * Selects a person for a specific position with simplified logic based on the provided code
 */
function selectPersonForPosition(
    position: number,
    day: number,
    room: number,
    selectedPeople: Person[],
    prioritizeStaff: boolean,
    context: AssignmentContext,
    typePreference: 'faculty' | 'staff' | 'any' = 'any'
): Person | null {
    // Calculate remaining rooms for this day to determine urgency
    const assignedRoomsForDay = context.dailyState.preAssignedRooms.get(day) || [];
    const remainingRooms = context.config.rooms - room + 1 - assignedRoomsForDay.filter(r => r >= room).length;

    // Get current staff assignments for this day
    const assignedPeopleForDay = context.dailyState.dailyAssignments.get(day) || new Set<string>();
    const staffAssignmentsForDay = Array.from(assignedPeopleForDay).filter(
        name => context.tracking.dutyCounter.get(name)?.type === 'staff'
    ).length;

    // Calculate minimum staff assignments needed per day
    const minStaffAssignmentsPerDay = Math.floor((context.staff.length * context.config.staffDutyTarget) / context.config.days);

    // Calculate how many more staff assignments needed for this day
    const staffAssignmentsNeededForDay = Math.max(0, minStaffAssignmentsPerDay - staffAssignmentsForDay);

    // Flag to force staff assignment if we're running behind
    const forceStaffAssignment = remainingRooms <= staffAssignmentsNeededForDay;

    // Determine candidate pool based on position and needs
    let candidatePool: Person[];

    // For first position, only select from faculty members unless we need to force staff
    if (position === 0) {
        candidatePool = context.faculty;
    } else {
        // For second position, try to use staff if we're behind on their assignments
        if ((staffAssignmentsForDay < minStaffAssignmentsPerDay) || (forceStaffAssignment)) {
            // Try staff first
            const eligibleStaff = context.staff.filter(p => {
                // Not already selected for this room
                if (selectedPeople.some(selected => selected.name === p.name)) return false;

                // Not assigned today
                if (assignedPeopleForDay.has(p.name)) return false;

                // Not reached max duties
                const currentDuties = context.tracking.dutyCounter.get(p.name)!.count;
                if (currentDuties >= context.config.staffDutyTarget) return false;

                // Not assigned to same room yesterday
                const assignments = context.tracking.personAssignments.get(p.name) || [];
                const wasInSameRoomYesterday = assignments.some(a =>
                    a.day === day - 1 && a.room === room
                );

                return !wasInSameRoomYesterday;
            });

            // If we have eligible staff, use them exclusively
            if (eligibleStaff.length > 0) {
                candidatePool = eligibleStaff;
            } else {
                candidatePool = [...context.faculty, ...context.staff];
            }
        } else {
            candidatePool = [...context.faculty, ...context.staff];
        }
    }

    // Filter eligible people based on standard criteria
    let eligiblePeople = candidatePool.filter(p => {
        // Not already selected for this room
        if (selectedPeople.some(selected => selected.name === p.name)) return false;

        // Not assigned today
        if (assignedPeopleForDay.has(p.name)) return false;

        // Check duty constraints based on type
        const currentDuties = context.tracking.dutyCounter.get(p.name)!.count;
        const personType = context.tracking.dutyCounter.get(p.name)!.type;

        // For staff: don't exceed staffDutyTarget
        if (personType === 'staff' && currentDuties >= context.config.staffDutyTarget) return false;

        // For faculty: don't exceed their seniority-based max duties
        if (personType === 'faculty' && currentDuties >= context.limits.maxDutiesPerFaculty.get(p.name)!) return false;

        // Not assigned to same room yesterday
        const assignments = context.tracking.personAssignments.get(p.name) || [];
        const wasInSameRoomYesterday = assignments.some(a =>
            a.day === day - 1 && a.room === room
        );

        return !wasInSameRoomYesterday;
    });

    if (eligiblePeople.length > 0) {
        return selectBestCandidate(eligiblePeople, context);
    }

    // Fallback: take anyone not assigned today, prioritizing those with fewer duties
    const candidatePoolFallback = position === 0 ? context.faculty : [...context.faculty, ...context.staff];
    const unassignedToday = candidatePoolFallback.filter(p => !assignedPeopleForDay.has(p.name));

    // For position 1, filter out staff who reached their quota
    const filteredUnassignedToday = position === 1
        ? unassignedToday.filter(p =>
            context.tracking.dutyCounter.get(p.name)!.type !== 'staff' ||
            context.tracking.dutyCounter.get(p.name)!.count < context.config.staffDutyTarget
        )
        : unassignedToday;

    if (filteredUnassignedToday.length > 0) {
        return selectBestCandidate(filteredUnassignedToday, context);
    }

    // Last resort: take person with fewest duties
    let sortedAll = [...candidatePoolFallback].filter(p =>
        !selectedPeople.some(selected => selected.name === p.name)
    );

    // Filter out staff who reached their quota for position 1
    if (position === 1) {
        sortedAll = sortedAll.filter(p =>
            context.tracking.dutyCounter.get(p.name)!.type !== 'staff' ||
            context.tracking.dutyCounter.get(p.name)!.count < context.config.staffDutyTarget
        );
    }

    if (sortedAll.length > 0) {
        return selectBestCandidate(sortedAll, context);
    }

    return null;
}

/**
 * Creates a schedule entry from selected people and arranges them by seniority
 */
export function createScheduleEntry(
    selectedPeople: Person[],
    day: number,
    room: number,
    context: AssignmentContext
): ScheduleEntry | null {
    if (selectedPeople.length !== 2) {
        return null;
    }

    const [person1, person2] = selectedPeople;

    // Get the types of the two people
    const type1 = context.tracking.dutyCounter.get(person1.name)!.type;
    const type2 = context.tracking.dutyCounter.get(person2.name)!.type;

    // Arrange by position and seniority rules
    let faculty: Person, staff: Person;

    if (type1 === 'faculty' && type2 === 'faculty') {
        // Both are faculty, sort by faculty indices (lower index = higher seniority)
        const idx1 = context.tracking.facultyIndices.get(person1.name)!;
        const idx2 = context.tracking.facultyIndices.get(person2.name)!;
        faculty = idx1 < idx2 ? person1 : person2;
        staff = idx1 < idx2 ? person2 : person1;
    } else if (type1 === 'staff' && type2 === 'staff') {
        // Both are staff, sort by staff indices (lower index = higher seniority)
        const idx1 = context.tracking.staffIndices.get(person1.name)!;
        const idx2 = context.tracking.staffIndices.get(person2.name)!;
        faculty = idx1 < idx2 ? person1 : person2;
        staff = idx1 < idx2 ? person2 : person1;
    } else {
        // One faculty, one staff - faculty always goes in faculty position
        faculty = type1 === 'faculty' ? person1 : person2;
        staff = type1 === 'faculty' ? person2 : person1;
    }

    // Update tracking for both people
    updateAssignmentTracking(faculty.name, day, room, context.tracking, context.dailyState);
    updateAssignmentTracking(staff.name, day, room, context.tracking, context.dailyState);

    return {
        faculty,
        staff,
        room,
        day,
    };
}