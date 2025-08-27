import { Person, ScheduleEntry } from '../../types';
import { enforcePositionBySeniority } from './workloadBalancer';

/**
 * Checks if a person is protected by pre-assignment constraints
 */
function isPersonProtectedByPreAssignment(
    personName: string,
    preAssignedPeople?: Map<string, number[]>
): boolean {
    if (!preAssignedPeople?.has(personName)) {
        return false;
    }

    const preAssignedDays = preAssignedPeople.get(personName)!;
    if (preAssignedDays.length > 0) {
        console.log(`🔒 PROTECTED: ${personName} is pre-assigned for days [${preAssignedDays.join(', ')}] - SHUFFLE RESISTANT`);
        return true;
    }

    return false;
}

/**
 * Verifies and fixes staff duty counts to ensure they meet the target
 */
export function verifyStaffDuties(
    schedule: ScheduleEntry[],
    staff: Person[],
    staffDutyTarget: number,
    dutyCounter: Map<string, { count: number; type: 'faculty' | 'staff' }>,
    personAssignments: Map<string, { day: number; room: number }[]>,
    facultyIndices: Map<string, number>,
    staffIndices: Map<string, number>,
    preAssignedPeople?: Map<string, number[]>
): void {
    // Check each staff member
    for (const staffPerson of staff) {
        const dutyCount = dutyCounter.get(staffPerson.name)!.count;

        // If staff has fewer duties than target, we need to add more
        if (dutyCount < staffDutyTarget) {
            addStaffDuties(
                staffPerson,
                staffDutyTarget - dutyCount,
                schedule,
                dutyCounter,
                personAssignments,
                facultyIndices,
                staffIndices,
                preAssignedPeople
            );
        }

        // If staff has more duties than target, we need to remove some
        if (dutyCount > staffDutyTarget) {
            removeStaffDuties(
                staffPerson,
                dutyCount - staffDutyTarget,
                schedule,
                staff,
                staffDutyTarget,
                dutyCounter,
                personAssignments,
                facultyIndices,
                staffIndices,
                preAssignedPeople
            );
        }
    }
}

/**
 * Adds duties to an underworked staff member
 */
function addStaffDuties(
    staffPerson: Person,
    dutiesNeeded: number,
    schedule: ScheduleEntry[],
    dutyCounter: Map<string, { count: number; type: 'faculty' | 'staff' }>,
    personAssignments: Map<string, { day: number; room: number }[]>,
    facultyIndices: Map<string, number>,
    staffIndices: Map<string, number>,
    preAssignedPeople?: Map<string, number[]>
): void {
    // CRITICAL: Skip if staff person is pre-assigned (cannot be moved)
    if (isPersonProtectedByPreAssignment(staffPerson.name, preAssignedPeople)) {
        return;
    }

    // Find faculty members who can give up assignments
    const facultyByDuties = Array.from(dutyCounter.entries())
        .filter(([, data]) => data.type === 'faculty')
        .sort((a, b) => b[1].count - a[1].count);

    // Start with faculty who have the most duties
    for (const [facultyName] of facultyByDuties) {
        // CRITICAL: Skip if faculty is pre-assigned (cannot be moved from their position)
        if (isPersonProtectedByPreAssignment(facultyName, preAssignedPeople)) {
            continue;
        }

        // Find entries where this faculty is assigned in staff position
        const facultyEntries = schedule.filter(entry =>
            entry.staff.name === facultyName
        );

        for (const entry of facultyEntries) {
            if (dutiesNeeded <= 0) break;

            // Check if staff can take this duty
            if (canStaffTakeAssignment(staffPerson.name, entry, schedule, personAssignments, preAssignedPeople)) {
                // Perform the swap
                swapPersonInEntry(
                    entry,
                    facultyName,
                    staffPerson.name,
                    'staff',
                    dutyCounter,
                    personAssignments
                );

                // Re-check seniority after the swap with pre-assigned people protection
                enforcePositionBySeniority(entry, facultyIndices, staffIndices, dutyCounter, preAssignedPeople);

                dutiesNeeded--;
            }
        }
    }
}

/**
 * Removes excess duties from an overworked staff member
 */
function removeStaffDuties(
    staffPerson: Person,
    excessDuties: number,
    schedule: ScheduleEntry[],
    allStaff: Person[],
    staffDutyTarget: number,
    dutyCounter: Map<string, { count: number; type: 'faculty' | 'staff' }>,
    personAssignments: Map<string, { day: number; room: number }[]>,
    facultyIndices: Map<string, number>,
    staffIndices: Map<string, number>,
    preAssignedPeople?: Map<string, number[]>
): void {
    // CRITICAL: Skip if staff person is pre-assigned (cannot be moved)
    if (isPersonProtectedByPreAssignment(staffPerson.name, preAssignedPeople)) {
        return;
    }

    let dutiesRemoved = 0;

    // Find entries where this staff is assigned
    const staffEntries = schedule.filter(entry =>
        entry.faculty.name === staffPerson.name || entry.staff.name === staffPerson.name
    );

    // Try to replace with faculty first
    const facultyByDuties = Array.from(dutyCounter.entries())
        .filter(([, data]) => data.type === 'faculty')
        .sort((a, b) => a[1].count - b[1].count); // Start with faculty who have fewer duties

    for (const [facultyName] of facultyByDuties) {
        if (dutiesRemoved >= excessDuties) break;

        // CRITICAL: Skip if faculty is pre-assigned (cannot be moved to different position)
        if (isPersonProtectedByPreAssignment(facultyName, preAssignedPeople)) {
            continue;
        }

        for (const entry of staffEntries) {
            if (dutiesRemoved >= excessDuties) break;

            // Determine if staff is in faculty or staff position
            const staffInFacultyPosition = entry.faculty.name === staffPerson.name;

            // Check if faculty can take this assignment
            if (canPersonTakeAssignment(facultyName, entry, schedule, personAssignments, preAssignedPeople)) {
                // Replace staff with faculty
                if (staffInFacultyPosition) {
                    swapPersonInEntry(
                        entry,
                        staffPerson.name,
                        facultyName,
                        'faculty',
                        dutyCounter,
                        personAssignments
                    );
                } else {
                    swapPersonInEntry(
                        entry,
                        staffPerson.name,
                        facultyName,
                        'staff',
                        dutyCounter,
                        personAssignments
                    );
                }

                // Re-check seniority after the swap with pre-assigned people protection
                enforcePositionBySeniority(entry, facultyIndices, staffIndices, dutyCounter, preAssignedPeople);

                dutiesRemoved++;
            }
        }
    }

    // If we still have excess duties, try to swap with underworked staff
    if (dutiesRemoved < excessDuties) {
        const underworkedStaff = allStaff.filter(s =>
            s.name !== staffPerson.name &&
            dutyCounter.get(s.name)!.count < staffDutyTarget
        );

        for (const otherStaff of underworkedStaff) {
            if (dutiesRemoved >= excessDuties) break;

            // CRITICAL: Skip if other staff is pre-assigned (cannot be moved)
            if (isPersonProtectedByPreAssignment(otherStaff.name, preAssignedPeople)) {
                continue;
            }

            const remainingStaffEntries = schedule.filter(entry =>
                entry.faculty.name === staffPerson.name || entry.staff.name === staffPerson.name
            );

            for (const entry of remainingStaffEntries) {
                if (dutiesRemoved >= excessDuties) break;

                // Check if other staff can take this duty
                if (canStaffTakeAssignment(otherStaff.name, entry, schedule, personAssignments, preAssignedPeople)) {
                    // Determine position
                    const staffInFacultyPosition = entry.faculty.name === staffPerson.name;

                    if (staffInFacultyPosition) {
                        swapPersonInEntry(
                            entry,
                            staffPerson.name,
                            otherStaff.name,
                            'faculty',
                            dutyCounter,
                            personAssignments
                        );
                    } else {
                        swapPersonInEntry(
                            entry,
                            staffPerson.name,
                            otherStaff.name,
                            'staff',
                            dutyCounter,
                            personAssignments
                        );
                    }

                    // Re-check seniority with pre-assigned people protection
                    enforcePositionBySeniority(entry, facultyIndices, staffIndices, dutyCounter, preAssignedPeople);

                    dutiesRemoved++;
                }
            }
        }
    }
}

/**
 * Checks if a staff member can take a specific assignment
 * CRITICAL: Respects pre-assignment constraints
 */
function canStaffTakeAssignment(
    staffName: string,
    entry: ScheduleEntry,
    schedule: ScheduleEntry[],
    personAssignments: Map<string, { day: number; room: number }[]>,
    preAssignedPeople?: Map<string, number[]>
): boolean {
    // CRITICAL: If person is pre-assigned for a different day, they cannot be moved
    if (isPersonProtectedByPreAssignment(staffName, preAssignedPeople)) {
        return false;
    }

    // CRITICAL: Check if target slot involves pre-assigned people who cannot be displaced
    const facultyIsPreAssigned = preAssignedPeople?.has(entry.faculty.name) &&
        preAssignedPeople.get(entry.faculty.name)!.includes(entry.day);
    const staffIsPreAssigned = preAssignedPeople?.has(entry.staff.name) &&
        preAssignedPeople.get(entry.staff.name)!.includes(entry.day);

    if (facultyIsPreAssigned || staffIsPreAssigned) {
        console.log(`🔒 PROTECTED: Target slot has pre-assigned person - cannot swap`);
        return false;
    }

    // Staff should not already be assigned on this day
    const isAssignedOnDay = schedule.some(e =>
        e.day === entry.day && (e.faculty.name === staffName || e.staff.name === staffName)
    );

    if (isAssignedOnDay) return false;

    // Staff should not have been in same room yesterday
    const staffAssignments = personAssignments.get(staffName) || [];
    const wasInSameRoomYesterday = staffAssignments.some(a =>
        a.day === entry.day - 1 && a.room === entry.room
    );

    return !wasInSameRoomYesterday;
}

/**
 * Checks if a person can take a specific assignment
 * CRITICAL: Respects pre-assignment constraints
 */
function canPersonTakeAssignment(
    personName: string,
    entry: ScheduleEntry,
    schedule: ScheduleEntry[],
    personAssignments: Map<string, { day: number; room: number }[]>,
    preAssignedPeople?: Map<string, number[]>
): boolean {
    // CRITICAL: If person is pre-assigned for a different day, they cannot be moved
    if (isPersonProtectedByPreAssignment(personName, preAssignedPeople)) {
        return false;
    }

    // CRITICAL: Check if target slot involves pre-assigned people who cannot be displaced
    const facultyIsPreAssigned = preAssignedPeople?.has(entry.faculty.name) &&
        preAssignedPeople.get(entry.faculty.name)!.includes(entry.day);
    const staffIsPreAssigned = preAssignedPeople?.has(entry.staff.name) &&
        preAssignedPeople.get(entry.staff.name)!.includes(entry.day);

    if (facultyIsPreAssigned || staffIsPreAssigned) {
        console.log(`🔒 PROTECTED: Target slot has pre-assigned person - cannot swap`);
        return false;
    }

    // Person should not already be assigned on this day
    const isAssignedOnDay = schedule.some(e =>
        e.day === entry.day && (e.faculty.name === personName || e.staff.name === personName)
    );

    if (isAssignedOnDay) return false;

    // Person should not have been in same room yesterday
    const assignments = personAssignments.get(personName) || [];
    const wasInSameRoomYesterday = assignments.some(a =>
        a.day === entry.day - 1 && a.room === entry.room
    );

    return !wasInSameRoomYesterday;
}

/**
 * Swaps a person in a schedule entry and updates tracking
 */
function swapPersonInEntry(
    entry: ScheduleEntry,
    oldPersonName: string,
    newPersonName: string,
    position: 'faculty' | 'staff',
    dutyCounter: Map<string, { count: number; type: 'faculty' | 'staff' }>,
    personAssignments: Map<string, { day: number; room: number }[]>
): void {
    // Update the entry
    if (position === 'faculty') {
        entry.faculty = {
            name: newPersonName,
            type: dutyCounter.get(newPersonName)!.type
        };
    } else {
        entry.staff = {
            name: newPersonName,
            type: dutyCounter.get(newPersonName)!.type
        };
    }

    // Update duty counters
    dutyCounter.get(oldPersonName)!.count--;
    dutyCounter.get(newPersonName)!.count++;

    // Update assignment history
    const oldAssignments = personAssignments.get(oldPersonName)!;
    const indexToRemove = oldAssignments.findIndex(a =>
        a.day === entry.day && a.room === entry.room
    );
    if (indexToRemove !== -1) {
        oldAssignments.splice(indexToRemove, 1);
    }

    personAssignments.get(newPersonName)!.push({ day: entry.day, room: entry.room });
}

/**
 * Validates the final schedule for consistency and constraint compliance
 */
export function validateSchedule(
    schedule: ScheduleEntry[],
    faculty: Person[],
    staff: Person[],
    staffDutyTarget: number,
    days: number,
    rooms: number
): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if we have the correct number of entries
    const expectedEntries = days * rooms;
    if (schedule.length !== expectedEntries) {
        errors.push(`Expected ${expectedEntries} schedule entries, but got ${schedule.length}`);
    }

    // Validate each day has the correct number of rooms
    for (let day = 1; day <= days; day++) {
        const entriesForDay = schedule.filter(entry => entry.day === day);
        if (entriesForDay.length !== rooms) {
            errors.push(`Day ${day} has ${entriesForDay.length} entries, expected ${rooms}`);
        }

        // Check for duplicate room assignments on the same day
        const roomsForDay = entriesForDay.map(entry => entry.room);
        const uniqueRooms = new Set(roomsForDay);
        if (uniqueRooms.size !== roomsForDay.length) {
            errors.push(`Day ${day} has duplicate room assignments`);
        }

        // Check for duplicate person assignments on the same day
        const peopleForDay = entriesForDay.flatMap(entry => [entry.faculty.name, entry.staff.name]);
        const uniquePeople = new Set(peopleForDay);
        if (uniquePeople.size !== peopleForDay.length) {
            errors.push(`Day ${day} has duplicate person assignments`);
        }
    }

    // Validate staff duty targets
    const dutyCounter = new Map<string, number>();
    schedule.forEach(entry => {
        dutyCounter.set(entry.faculty.name, (dutyCounter.get(entry.faculty.name) || 0) + 1);
        dutyCounter.set(entry.staff.name, (dutyCounter.get(entry.staff.name) || 0) + 1);
    });

    for (const staffPerson of staff) {
        const actualDuties = dutyCounter.get(staffPerson.name) || 0;
        if (actualDuties !== staffDutyTarget) {
            errors.push(`Staff member ${staffPerson.name} has ${actualDuties} duties, expected ${staffDutyTarget}`);
        }
    }

    // Check for consecutive room assignments
    for (const person of [...faculty, ...staff]) {
        const personEntries = schedule.filter(entry =>
            entry.faculty.name === person.name || entry.staff.name === person.name
        );

        for (const entry of personEntries) {
            const nextDayEntry = personEntries.find(e =>
                e.day === entry.day + 1 && e.room === entry.room
            );
            if (nextDayEntry) {
                errors.push(`${person.name} is assigned to room ${entry.room} on consecutive days ${entry.day} and ${entry.day + 1}`);
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}