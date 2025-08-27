import { Person, ScheduleEntry } from '../../types';
import { AssignmentContext } from './schedulerInterfaces';
import { updateAssignmentTracking, wasInSameRoomYesterday } from './assignmentTracker';

/**
 * Handles pre-assigned people to specific days based on input constraints
 * Uses independent assignment - each pre-assigned person gets a position without forced pairing
 */
export function handlePreAssignedFaculty(
    preAssignedFaculty: { [day: number]: string[] },
    context: AssignmentContext
): ScheduleEntry[] {
    const schedule: ScheduleEntry[] = [];

    // First, populate the pre-assigned people tracking
    for (let day = 1; day <= context.config.days; day++) {
        if (preAssignedFaculty[day] && preAssignedFaculty[day].length > 0) {
            preAssignedFaculty[day].forEach(personName => {
                if (!context.dailyState.preAssignedPeople.has(personName)) {
                    context.dailyState.preAssignedPeople.set(personName, []);
                }
                context.dailyState.preAssignedPeople.get(personName)!.push(day);
            });
        }
    }

    // Process each day's pre-assignments
    for (let day = 1; day <= context.config.days; day++) {
        if (preAssignedFaculty[day] && preAssignedFaculty[day].length > 0) {
            const preAssignedNames = preAssignedFaculty[day];

            for (const personName of preAssignedNames) {
                // Check if person exists in either faculty or staff lists
                const isFaculty = context.tracking.facultyIndices.has(personName);
                const isStaff = context.tracking.staffIndices.has(personName);

                if (!isFaculty && !isStaff) {
                    console.warn(`Pre-assigned person ${personName} not found in faculty or staff lists`);
                    continue;
                }

                // Try to assign this person to an available room independently
                const assignmentResult = assignPreAssignedPersonIndependently(
                    personName,
                    day,
                    context
                );

                if (assignmentResult) {
                    schedule.push(assignmentResult.entry);

                    // Mark room as taken for this day
                    const preAssignedRooms = context.dailyState.preAssignedRooms.get(day) || [];
                    preAssignedRooms.push(assignmentResult.room);
                    context.dailyState.preAssignedRooms.set(day, preAssignedRooms);
                } else {
                    console.warn(`Could not pre-assign person ${personName} for day ${day} - no available slots`);
                }
            }
        }
    }

    return schedule;
}

/**
 * Assigns a pre-assigned person to an available position independently
 * Finds an available room and position without forcing specific pairing
 */
function assignPreAssignedPersonIndependently(
    personName: string,
    day: number,
    context: AssignmentContext
): { room: number; entry: ScheduleEntry } | null {
    // Get already assigned rooms for this day
    const assignedRoomsForDay = context.dailyState.preAssignedRooms.get(day) || [];
    const dailyAssignments = context.dailyState.dailyAssignments.get(day) || new Set<string>();

    // Find the pre-assigned person
    let preAssignedPerson: Person | null = null;
    const facultyMember = context.faculty.find(f => f.name === personName);
    if (facultyMember) {
        preAssignedPerson = facultyMember;
    } else {
        const staffMember = context.staff.find(s => s.name === personName);
        if (staffMember) {
            preAssignedPerson = staffMember;
        }
    }

    if (!preAssignedPerson) {
        return null;
    }

    // Try to find available room for this person
    for (let room = 1; room <= context.config.rooms; room++) {
        // Skip if this room is already taken for this day
        if (assignedRoomsForDay.includes(room)) continue;

        // Check if person was in this room yesterday
        if (wasInSameRoomYesterday(personName, day, room, context.tracking)) {
            continue;
        }

        // Find the best available partner for this room
        const partner = findBestAvailablePartner(
            personName,
            day,
            room,
            dailyAssignments,
            context
        );

        if (partner) {
            // Create schedule entry with proper position assignment based on seniority and type
            const entry = createIndependentPreAssignmentEntry(
                preAssignedPerson,
                partner,
                day,
                room,
                context
            );

            if (entry) {
                // Update tracking for both people
                updateAssignmentTracking(entry.faculty.name, day, room, context.tracking, context.dailyState);
                updateAssignmentTracking(entry.staff.name, day, room, context.tracking, context.dailyState);

                return { room, entry };
            }
        }
    }

    return null;
}

/**
 * Finds the best available partner considering duty constraints and seniority
 */
function findBestAvailablePartner(
    preAssignedPersonName: string,
    day: number,
    room: number,
    dailyAssignments: Set<string>,
    context: AssignmentContext
): Person | null {
    // Create a pool of potential partners (everyone except the pre-assigned person)
    const potentialPartners = [...context.faculty, ...context.staff].filter(person =>
        person.name !== preAssignedPersonName
    );

    // Filter available partners
    const availablePartners = potentialPartners.filter(partner => {
        // Skip if already assigned today
        if (dailyAssignments.has(partner.name)) return false;

        // Check duty constraints based on partner type
        const currentDuties = context.tracking.dutyCounter.get(partner.name)!.count;
        const partnerType = context.tracking.dutyCounter.get(partner.name)!.type;

        if (partnerType === 'staff') {
            // Skip if they've reached their duty target
            if (currentDuties >= context.config.staffDutyTarget) return false;
        } else {
            // For faculty, check their max duties
            const maxDuties = context.limits.maxDutiesPerFaculty.get(partner.name)!;
            if (currentDuties >= maxDuties) return false;
        }

        // Skip if they were in this room yesterday
        if (wasInSameRoomYesterday(partner.name, day, room, context.tracking)) {
            return false;
        }

        return true;
    });

    if (availablePartners.length === 0) {
        return null;
    }

    // Sort partners by duty count first, then by seniority
    const sortedPartners = [...availablePartners].sort((a, b) => {
        const aDuties = context.tracking.dutyCounter.get(a.name)!.count;
        const bDuties = context.tracking.dutyCounter.get(b.name)!.count;

        if (aDuties !== bDuties) {
            return aDuties - bDuties; // Fewer duties first
        }

        // Tie-break by seniority based on their type
        const aType = context.tracking.dutyCounter.get(a.name)!.type;
        const bType = context.tracking.dutyCounter.get(b.name)!.type;

        if (aType === bType) {
            if (aType === 'faculty') {
                const aIndex = context.tracking.facultyIndices.get(a.name) || 0;
                const bIndex = context.tracking.facultyIndices.get(b.name) || 0;
                // For faculty, junior faculty (higher index) get priority to balance duties
                return bIndex - aIndex;
            } else {
                const aIndex = context.tracking.staffIndices.get(a.name) || 0;
                const bIndex = context.tracking.staffIndices.get(b.name) || 0;
                return aIndex - bIndex; // Higher seniority first for staff
            }
        }

        return 0;
    });

    // Randomly select from the top candidates with equal priority
    const minDutyCount = context.tracking.dutyCounter.get(sortedPartners[0].name)!.count;
    const topCandidates = sortedPartners.filter(p =>
        context.tracking.dutyCounter.get(p.name)!.count === minDutyCount
    );

    const randomIndex = Math.floor(Math.random() * topCandidates.length);
    return topCandidates[randomIndex];
}

/**
 * Creates a schedule entry for a pre-assigned person with truly independent position assignment
 * Positions are determined purely by seniority and type, not by pre-assignment status
 */
function createIndependentPreAssignmentEntry(
    preAssignedPerson: Person,
    partner: Person,
    day: number,
    room: number,
    context: AssignmentContext
): ScheduleEntry | null {
    // Determine positions based ONLY on types and seniority rules, not pre-assignment status
    let faculty: Person, staff: Person;

    const preAssignedType = preAssignedPerson.type;
    const partnerType = partner.type;

    if (preAssignedType === 'faculty' && partnerType === 'faculty') {
        // Both are faculty - use standard seniority rules (lower index = more senior)
        const preAssignedIdx = context.tracking.facultyIndices.get(preAssignedPerson.name)!;
        const partnerIdx = context.tracking.facultyIndices.get(partner.name)!;
        
        // More senior faculty gets faculty position (standard rule)
        faculty = preAssignedIdx < partnerIdx ? preAssignedPerson : partner;
        staff = preAssignedIdx < partnerIdx ? partner : preAssignedPerson;
    } else if (preAssignedType === 'staff' && partnerType === 'staff') {
        // Both are staff - use standard seniority rules (lower index = more senior)
        const preAssignedIdx = context.tracking.staffIndices.get(preAssignedPerson.name)!;
        const partnerIdx = context.tracking.staffIndices.get(partner.name)!;
        
        // More senior staff gets faculty position (standard rule)
        faculty = preAssignedIdx < partnerIdx ? preAssignedPerson : partner;
        staff = preAssignedIdx < partnerIdx ? partner : preAssignedPerson;
    } else {
        // Mixed types - faculty always goes in faculty position (standard rule)
        faculty = preAssignedType === 'faculty' ? preAssignedPerson : partner;
        staff = preAssignedType === 'faculty' ? partner : preAssignedPerson;
    }

    return {
        faculty,
        staff,
        room,
        day,
    };
}

/**
 * Validates pre-assignment constraints before processing
 */
export function validatePreAssignments(
    preAssignedFaculty: { [day: number]: string[] },
    faculty: Person[],
    staff: Person[],
    days: number,
    rooms: number
): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const allPersonNames = new Set([...faculty.map(f => f.name), ...staff.map(s => s.name)]);

    // Check each day's pre-assignments
    for (let day = 1; day <= days; day++) {
        if (preAssignedFaculty[day]) {
            const preAssignedNames = preAssignedFaculty[day];

            // Check if all pre-assigned people exist in faculty or staff lists
            for (const personName of preAssignedNames) {
                if (!allPersonNames.has(personName)) {
                    errors.push(`Pre-assigned person '${personName}' for day ${day} not found in faculty or staff lists`);
                }
            }

            // Check if too many people are pre-assigned for available rooms
            if (preAssignedNames.length > rooms) {
                errors.push(`Day ${day} has ${preAssignedNames.length} pre-assigned people, but only ${rooms} rooms available`);
            }

            // Check for duplicate people on the same day
            const uniqueNames = new Set(preAssignedNames);
            if (uniqueNames.size !== preAssignedNames.length) {
                errors.push(`Day ${day} has duplicate pre-assignments`);
            }
        }
    }

    // Check for people assigned to multiple days (if needed to be restricted)
    const allPreAssignedPeople = new Map<string, number[]>();
    for (let day = 1; day <= days; day++) {
        if (preAssignedFaculty[day]) {
            for (const personName of preAssignedFaculty[day]) {
                if (!allPreAssignedPeople.has(personName)) {
                    allPreAssignedPeople.set(personName, []);
                }
                allPreAssignedPeople.get(personName)!.push(day);
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}