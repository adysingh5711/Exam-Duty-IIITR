import { ScheduleEntry } from '../../types';

/**
 * Checks if a faculty swap would violate seniority duty hierarchy
 * Senior faculty (lower index) must ALWAYS have fewer or equal duties to junior faculty
 * CRITICAL: This function must prevent ANY swap that would create a violation
 */
function wouldViolateSeniorityDutyHierarchy(
    fromFaculty: string,
    toFaculty: string,
    facultyIndices: Map<string, number>,
    dutyCounter: Map<string, { count: number; type: 'faculty' | 'staff' }>
): boolean {
    const fromIndex = facultyIndices.get(fromFaculty)!;
    const toIndex = facultyIndices.get(toFaculty)!;
    const fromCurrentDuties = dutyCounter.get(fromFaculty)!.count;
    const toCurrentDuties = dutyCounter.get(toFaculty)!.count;

    // Calculate duties after the swap (from loses 1, to gains 1)
    const fromDutiesAfter = fromCurrentDuties - 1;
    const toDutiesAfter = toCurrentDuties + 1;

    // FIXED LOGIC: Check if this swap would violate hierarchy in EITHER direction
    if (fromIndex < toIndex) {
        // fromFaculty is MORE SENIOR than toFaculty (lower index = more senior)
        // After swap: senior would have fromDutiesAfter, junior would have toDutiesAfter
        // VIOLATION: if senior ends up with MORE duties than junior
        return fromDutiesAfter > toDutiesAfter;
    } else if (toIndex < fromIndex) {
        // toFaculty is MORE SENIOR than fromFaculty (lower index = more senior)
        // After swap: senior would have toDutiesAfter, junior would have fromDutiesAfter
        // VIOLATION: if senior ends up with MORE duties than junior
        return toDutiesAfter > fromDutiesAfter;
    }

    // Same seniority level - no violation possible
    return false;
}

/**
 * Checks if a person is protected by pre-assignment constraints
 * Returns true if the person should NOT be moved from their current assignments
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
 * Checks current duty distribution for seniority violations and logs status
 * Returns true if hierarchy is properly maintained
 */
function checkSeniorityHierarchyStatus(
    facultyIndices: Map<string, number>,
    dutyCounter: Map<string, { count: number; type: 'faculty' | 'staff' }>,
    context: string = ''
): boolean {
    const facultyByIndex = Array.from(facultyIndices.entries())
        .sort((a, b) => a[1] - b[1]);

    let violations = 0;
    const violationDetails: string[] = [];

    for (let i = 0; i < facultyByIndex.length - 1; i++) {
        for (let j = i + 1; j < facultyByIndex.length; j++) {
            const [seniorFaculty] = facultyByIndex[i];
            const [juniorFaculty] = facultyByIndex[j];
            const seniorDuties = dutyCounter.get(seniorFaculty)!.count;
            const juniorDuties = dutyCounter.get(juniorFaculty)!.count;

            if (seniorDuties > juniorDuties) {
                violations++;
                violationDetails.push(`${seniorFaculty}(${seniorDuties}) > ${juniorFaculty}(${juniorDuties})`);
            }
        }
    }

    if (context) {
        console.log(`\n--- Seniority Check: ${context} ---`);
    }

    if (violations === 0) {
        console.log('✅ Seniority hierarchy is properly maintained');
        return true;
    } else {
        console.log(`❌ ${violations} seniority violations found:`);
        violationDetails.forEach(detail => console.log(`  - ${detail}`));
        return false;
    }
}

/**
 * Enforces strict seniority duty hierarchy across ALL faculty pairs
 * Senior faculty (lower index) must have fewer or equal duties to junior faculty
 * COMPREHENSIVE: Checks ALL pairs, not just consecutive ones
 */
function enforceSeniorityDutyHierarchy(
    schedule: ScheduleEntry[],
    facultyIndices: Map<string, number>,
    dutyCounter: Map<string, { count: number; type: 'faculty' | 'staff' }>,
    personAssignments: Map<string, { day: number; room: number }[]>,
    preAssignedPeople?: Map<string, number[]>
): void {
    const facultyByIndex = Array.from(facultyIndices.entries())
        .sort((a, b) => a[1] - b[1]); // Sort by seniority (lower index = more senior)

    let violationsFixed = 0;
    const maxFixes = 100; // Increased limit
    const maxIterations = 10; // Multiple passes to handle complex violations

    console.log('\n=== STARTING SENIORITY HIERARCHY ENFORCEMENT ===');

    // Multiple passes to handle cascading violations
    for (let iteration = 0; iteration < maxIterations && violationsFixed < maxFixes; iteration++) {
        let violationsFoundInThisPass = 0;

        // Check ALL pairs of faculty, not just consecutive ones
        for (let i = 0; i < facultyByIndex.length - 1; i++) {
            for (let j = i + 1; j < facultyByIndex.length; j++) {
                if (violationsFixed >= maxFixes) break;

                const [seniorFaculty] = facultyByIndex[i]; // More senior (lower index)
                const [juniorFaculty] = facultyByIndex[j]; // More junior (higher index)

                const seniorDuties = dutyCounter.get(seniorFaculty)!.count;
                const juniorDuties = dutyCounter.get(juniorFaculty)!.count;

                // VIOLATION: Senior has MORE duties than junior
                if (seniorDuties > juniorDuties) {
                    console.log(`VIOLATION FOUND: Senior ${seniorFaculty} (${seniorDuties} duties) > Junior ${juniorFaculty} (${juniorDuties} duties)`);

                    // Check if either is pre-assigned (cannot be moved)
                    const seniorIsPreAssigned = preAssignedPeople?.has(seniorFaculty);
                    const juniorIsPreAssigned = preAssignedPeople?.has(juniorFaculty);

                    if (seniorIsPreAssigned || juniorIsPreAssigned) {
                        console.log(`Cannot fix - pre-assignment constraints`);
                        continue;
                    }

                    // Find duties to swap between senior and junior
                    const seniorEntries = schedule.filter(entry =>
                        entry.faculty.name === seniorFaculty || entry.staff.name === seniorFaculty
                    );

                    // Try to swap one duty from senior to junior
                    let swapPerformed = false;
                    for (const seniorEntry of seniorEntries) {
                        if (swapPerformed) break;

                        // Check if this day is free for junior faculty
                        const isJuniorAssignedOnDay = schedule.some(e =>
                            e.day === seniorEntry.day && (e.faculty.name === juniorFaculty || e.staff.name === juniorFaculty)
                        );

                        if (!isJuniorAssignedOnDay) {
                            // Check room constraints for junior faculty
                            const juniorAssignments = personAssignments.get(juniorFaculty) || [];
                            const wasInSameRoomYesterday = juniorAssignments.some(a =>
                                a.day === seniorEntry.day - 1 && a.room === seniorEntry.room
                            );

                            if (!wasInSameRoomYesterday) {
                                // Perform the swap
                                if (seniorEntry.faculty.name === seniorFaculty) {
                                    seniorEntry.faculty = { name: juniorFaculty, type: 'faculty' };
                                } else {
                                    seniorEntry.staff = { name: juniorFaculty, type: 'faculty' };
                                }

                                // Update tracking
                                updateSwapTracking(
                                    seniorFaculty,
                                    juniorFaculty,
                                    seniorEntry.day,
                                    seniorEntry.room,
                                    dutyCounter,
                                    personAssignments
                                );

                                violationsFixed++;
                                violationsFoundInThisPass++;
                                swapPerformed = true;
                                console.log(`✓ FIXED: Moved duty from ${seniorFaculty} to ${juniorFaculty}`);
                            }
                        }
                    }

                    if (!swapPerformed) {
                        console.log(`✗ Could not fix violation between ${seniorFaculty} and ${juniorFaculty}`);
                    }
                }
            }
        }

        console.log(`Pass ${iteration + 1}: Fixed ${violationsFoundInThisPass} violations`);

        // If no violations found in this pass, we're done
        if (violationsFoundInThisPass === 0) {
            break;
        }
    }

    // Final verification
    console.log('\n=== FINAL SENIORITY VERIFICATION ===');
    let finalViolations = 0;
    for (let i = 0; i < facultyByIndex.length - 1; i++) {
        for (let j = i + 1; j < facultyByIndex.length; j++) {
            const [seniorFaculty] = facultyByIndex[i];
            const [juniorFaculty] = facultyByIndex[j];
            const seniorDuties = dutyCounter.get(seniorFaculty)!.count;
            const juniorDuties = dutyCounter.get(juniorFaculty)!.count;

            if (seniorDuties > juniorDuties) {
                console.log(`⚠️  REMAINING VIOLATION: ${seniorFaculty} (${seniorDuties}) > ${juniorFaculty} (${juniorDuties})`);
                finalViolations++;
            }
        }
    }

    if (finalViolations === 0) {
        console.log('✅ SENIORITY HIERARCHY PERFECTLY ENFORCED!');
    } else {
        console.log(`❌ ${finalViolations} violations remain (likely due to constraints)`);
    }

    console.log(`Total violations fixed: ${violationsFixed}`);
    console.log('=== SENIORITY ENFORCEMENT COMPLETE ===\n');
}

/**
 * Balances the schedule by redistributing duties to meet staff targets and faculty constraints
 */
export function balanceScheduleWithStaffConstraint(
    schedule: ScheduleEntry[],
    dutyCounter: Map<string, { count: number; type: 'faculty' | 'staff' }>,
    personAssignments: Map<string, { day: number; room: number }[]>,
    maxDutiesPerFaculty: Map<string, number>,
    minDutiesPerFaculty: number,
    staffDutyTarget: number,
    facultyIndices: Map<string, number>,
    staffIndices: Map<string, number>,
    preAssignedPeople?: Map<string, number[]>
): void {
    // First check if any staff has != staffDutyTarget duties
    const staffEntries = Array.from(dutyCounter.entries())
        .filter(([, data]) => data.type === 'staff');

    const overworkedStaff = staffEntries.filter(([, data]) => data.count > staffDutyTarget);
    const underworkedStaff = staffEntries.filter(([, data]) => data.count < staffDutyTarget);

    // Get all faculty sorted by duty count (highest to lowest)
    const facultyByDuties = Array.from(dutyCounter.entries())
        .filter(([, data]) => data.type === 'faculty')
        .sort((a, b) => b[1].count - a[1].count);

    // Calculate faculty duty stats
    const totalFacultyDuties = facultyByDuties.reduce((sum, [, data]) => sum + data.count, 0);
    const avgFacultyDuties = totalFacultyDuties / facultyByDuties.length;

    // Identify faculty that can give/take duties while respecting seniority
    const overworkedFaculty = facultyByDuties.filter(([name, data]) => {
        const maxAllowed = maxDutiesPerFaculty.get(name)!;
        return data.count > maxAllowed;
    });

    const underworkedFaculty = facultyByDuties.filter(([name, data]) => {
        const maxAllowed = maxDutiesPerFaculty.get(name)!;
        // Only consider faculty who can take more duties without exceeding their strict limit
        // For senior faculty, we must respect their exact limits with no flexibility
        return data.count < maxAllowed && data.count < minDutiesPerFaculty;
    });

    // Perform swaps to balance (limited to prevent infinite loops)
    const maxSwaps = 100;
    let swapsPerformed = 0;

    // CRITICAL: Check seniority hierarchy at the start
    checkSeniorityHierarchyStatus(facultyIndices, dutyCounter, 'BEFORE balancing');

    // CRITICAL: Log all pre-assigned people for transparency
    if (preAssignedPeople && preAssignedPeople.size > 0) {
        console.log('\n🔒 PRE-ASSIGNMENT PROTECTION STATUS:');
        for (const [personName, days] of preAssignedPeople.entries()) {
            console.log(`  - ${personName}: Fixed for days [${days.join(', ')}] - SHUFFLE RESISTANT`);
        }
        console.log(`Total protected people: ${preAssignedPeople.size}\n`);
    } else {
        console.log('\n🔓 No pre-assigned people - all positions can be shuffled\n');
    }

    // Phase 1: Fix staff duty counts
    swapsPerformed += handleOverworkedStaff(
        overworkedStaff,
        underworkedFaculty,
        schedule,
        dutyCounter,
        personAssignments,
        facultyIndices,
        staffIndices,
        staffDutyTarget,
        maxSwaps - swapsPerformed,
        maxDutiesPerFaculty,
        preAssignedPeople
    );

    swapsPerformed += handleUnderworkedStaff(
        underworkedStaff,
        overworkedFaculty,
        schedule,
        dutyCounter,
        personAssignments,
        facultyIndices,
        staffIndices,
        staffDutyTarget,
        maxSwaps - swapsPerformed,
        maxDutiesPerFaculty,
        preAssignedPeople
    );

    // Check seniority after staff balancing
    checkSeniorityHierarchyStatus(facultyIndices, dutyCounter, 'AFTER staff balancing');

    // Phase 2: Balance faculty duties (only swap faculty with faculty)
    balanceFacultyDuties(
        schedule,
        dutyCounter,
        personAssignments,
        facultyIndices,
        staffIndices,
        avgFacultyDuties,
        minDutiesPerFaculty,
        maxSwaps - swapsPerformed,
        maxDutiesPerFaculty,
        preAssignedPeople
    );

    // Check seniority after faculty balancing
    checkSeniorityHierarchyStatus(facultyIndices, dutyCounter, 'AFTER faculty balancing');

    // Final pass to ensure all entries have correct seniority ordering
    schedule.forEach(entry => {
        enforcePositionBySeniority(entry, facultyIndices, staffIndices, dutyCounter, preAssignedPeople);
    });

    // CRITICAL: Enforce strict seniority duty hierarchy - senior faculty must have fewer duties
    enforceSeniorityDutyHierarchy(
        schedule,
        facultyIndices,
        dutyCounter,
        personAssignments,
        preAssignedPeople
    );

    // Final verification
    checkSeniorityHierarchyStatus(facultyIndices, dutyCounter, 'FINAL result');

    // CRITICAL: Verify pre-assigned people are still in their fixed positions
    if (preAssignedPeople && preAssignedPeople.size > 0) {
        console.log('\n🔍 VERIFYING PRE-ASSIGNMENT INTEGRITY:');
        let violationsFound = 0;

        for (const [personName, fixedDays] of preAssignedPeople.entries()) {
            for (const day of fixedDays) {
                const isAssignedOnDay = schedule.some(entry =>
                    entry.day === day && (entry.faculty.name === personName || entry.staff.name === personName)
                );

                if (!isAssignedOnDay) {
                    console.log(`❌ VIOLATION: ${personName} should be assigned on day ${day} but is missing!`);
                    violationsFound++;
                } else {
                    console.log(`✅ VERIFIED: ${personName} is correctly assigned on day ${day}`);
                }
            }
        }

        if (violationsFound === 0) {
            console.log(`✅ ALL PRE-ASSIGNMENTS VERIFIED - SHUFFLE RESISTANCE SUCCESSFUL!`);
        } else {
            console.log(`❌ ${violationsFound} pre-assignment violations found!`);
        }
        console.log('=== PRE-ASSIGNMENT VERIFICATION COMPLETE ===\n');
    }
}

/**
 * Handles overworked staff by swapping them with underworked faculty
 */
function handleOverworkedStaff(
    overworkedStaff: [string, { count: number; type: 'faculty' | 'staff' }][],
    underworkedFaculty: [string, { count: number; type: 'faculty' | 'staff' }][],
    schedule: ScheduleEntry[],
    dutyCounter: Map<string, { count: number; type: 'faculty' | 'staff' }>,
    personAssignments: Map<string, { day: number; room: number }[]>,
    facultyIndices: Map<string, number>,
    staffIndices: Map<string, number>,
    staffDutyTarget: number,
    maxSwaps: number,
    maxDutiesPerFaculty: Map<string, number>,
    preAssignedPeople?: Map<string, number[]>
): number {
    let swapsPerformed = 0;

    for (const [staffName, staffData] of overworkedStaff) {
        if (swapsPerformed >= maxSwaps) break;

        // CRITICAL: Skip if staff is pre-assigned (cannot be moved)
        if (isPersonProtectedByPreAssignment(staffName, preAssignedPeople)) {
            continue;
        }

        let excessDuties = staffData.count - staffDutyTarget;

        // Find underworked faculty to take these duties
        for (const [facultyName] of underworkedFaculty) {
            if (swapsPerformed >= maxSwaps || excessDuties <= 0) break;

            // CRITICAL: Skip if faculty is pre-assigned (cannot be moved to different position)
            if (isPersonProtectedByPreAssignment(facultyName, preAssignedPeople)) {
                continue;
            }

            // Find entries where this staff is assigned
            const entriesWithStaff = schedule.filter(entry =>
                entry.faculty.name === staffName || entry.staff.name === staffName
            );

            for (const entry of entriesWithStaff) {
                if (swapsPerformed >= maxSwaps || excessDuties <= 0) break;

                // Determine position of staff in this entry
                const isStaffInFacultyPosition = entry.faculty.name === staffName;

                // Check if faculty can be assigned here
                if (canSwapAssignment(facultyName, entry.day, entry.room, schedule, personAssignments, dutyCounter, maxDutiesPerFaculty, preAssignedPeople)) {
                    // Perform swap
                    if (isStaffInFacultyPosition) {
                        entry.faculty = { name: facultyName, type: 'faculty' };
                    } else {
                        entry.staff = { name: facultyName, type: 'faculty' };
                    }

                    // Update counts and assignments
                    updateSwapTracking(
                        staffName,
                        facultyName,
                        entry.day,
                        entry.room,
                        dutyCounter,
                        personAssignments
                    );

                    swapsPerformed++;
                    excessDuties--;

                    // Re-check seniority after the swap
                    enforcePositionBySeniority(entry, facultyIndices, staffIndices, dutyCounter, preAssignedPeople);
                }
            }
        }
    }

    return swapsPerformed;
}

/**
 * Handles underworked staff by swapping them with overworked faculty
 */
function handleUnderworkedStaff(
    underworkedStaff: [string, { count: number; type: 'faculty' | 'staff' }][],
    overworkedFaculty: [string, { count: number; type: 'faculty' | 'staff' }][],
    schedule: ScheduleEntry[],
    dutyCounter: Map<string, { count: number; type: 'faculty' | 'staff' }>,
    personAssignments: Map<string, { day: number; room: number }[]>,
    facultyIndices: Map<string, number>,
    staffIndices: Map<string, number>,
    staffDutyTarget: number,
    maxSwaps: number,
    maxDutiesPerFaculty: Map<string, number>,
    preAssignedPeople?: Map<string, number[]>
): number {
    let swapsPerformed = 0;

    for (const [staffName, staffData] of underworkedStaff) {
        if (swapsPerformed >= maxSwaps) break;

        // CRITICAL: Skip if staff is pre-assigned (cannot be moved)
        if (isPersonProtectedByPreAssignment(staffName, preAssignedPeople)) {
            continue;
        }

        let neededDuties = staffDutyTarget - staffData.count;

        // Find overworked faculty to give up duties
        for (const [facultyName] of overworkedFaculty) {
            if (swapsPerformed >= maxSwaps || neededDuties <= 0) break;

            // CRITICAL: Skip if faculty is pre-assigned (cannot be moved from their position)
            if (isPersonProtectedByPreAssignment(facultyName, preAssignedPeople)) {
                continue;
            }

            // Find entries where this faculty is assigned
            const entriesWithFaculty = schedule.filter(entry =>
                entry.faculty.name === facultyName || entry.staff.name === facultyName
            );

            for (const entry of entriesWithFaculty) {
                if (swapsPerformed >= maxSwaps || neededDuties <= 0) break;

                // Determine position of faculty in this entry
                const isFacultyInFacultyPosition = entry.faculty.name === facultyName;

                // For faculty position, we need a staff of type 'faculty' to replace
                if (isFacultyInFacultyPosition) continue; // Skip faculty positions as staff can't take them

                // Check if staff can be assigned here
                if (canSwapAssignment(staffName, entry.day, entry.room, schedule, personAssignments, dutyCounter, maxDutiesPerFaculty, preAssignedPeople)) {
                    // Perform swap - staff can only take staff position
                    entry.staff = { name: staffName, type: 'staff' };

                    // Update counts and assignments
                    updateSwapTracking(
                        facultyName,
                        staffName,
                        entry.day,
                        entry.room,
                        dutyCounter,
                        personAssignments
                    );

                    swapsPerformed++;
                    neededDuties--;

                    // Re-check seniority after the swap
                    enforcePositionBySeniority(entry, facultyIndices, staffIndices, dutyCounter, preAssignedPeople);
                }
            }
        }
    }

    return swapsPerformed;
}

/**
 * Balances duties between faculty members
 */
function balanceFacultyDuties(
    schedule: ScheduleEntry[],
    dutyCounter: Map<string, { count: number; type: 'faculty' | 'staff' }>,
    personAssignments: Map<string, { day: number; room: number }[]>,
    facultyIndices: Map<string, number>,
    staffIndices: Map<string, number>,
    avgFacultyDuties: number,
    minDutiesPerFaculty: number,
    maxSwaps: number,
    maxDutiesPerFaculty: Map<string, number>,
    preAssignedPeople?: Map<string, number[]>
): void {
    let swapsPerformed = 0;

    // Recalculate faculty status with strict respect for individual limits
    const updatedFacultyByDuties = Array.from(dutyCounter.entries())
        .filter(([, data]) => data.type === 'faculty')
        .sort((a, b) => b[1].count - a[1].count);

    const updatedOverworkedFaculty = updatedFacultyByDuties.filter(([name, data]) => {
        const maxAllowed = maxDutiesPerFaculty.get(name)!;
        return data.count > maxAllowed;
    });

    const updatedUnderworkedFaculty = updatedFacultyByDuties.filter(([name, data]) => {
        const maxAllowed = maxDutiesPerFaculty.get(name)!;
        // Only consider faculty who can take more duties without exceeding their strict limit
        return data.count < maxAllowed && data.count < minDutiesPerFaculty;
    });

    // Swap duties between faculty members to balance - BUT RESPECT SENIORITY HIERARCHY AND PRE-ASSIGNMENTS
    for (const [overworkedName] of updatedOverworkedFaculty) {
        if (swapsPerformed >= maxSwaps) break;

        // CRITICAL: Skip if overworked faculty is pre-assigned (cannot be moved)
        if (isPersonProtectedByPreAssignment(overworkedName, preAssignedPeople)) {
            continue;
        }

        for (const [underworkedName] of updatedUnderworkedFaculty) {
            if (swapsPerformed >= maxSwaps) break;

            // CRITICAL: Skip if underworked faculty is pre-assigned (cannot be moved)
            if (isPersonProtectedByPreAssignment(underworkedName, preAssignedPeople)) {
                continue;
            }

            // CRITICAL CHECK: Ensure swap doesn't violate seniority duty hierarchy
            if (wouldViolateSeniorityDutyHierarchy(overworkedName, underworkedName, facultyIndices, dutyCounter)) {
                console.log(`Skipping faculty swap from ${overworkedName} to ${underworkedName} - would violate seniority hierarchy`);
                continue;
            }

            // Find entries where overworked faculty is assigned
            const entriesWithOverworked = schedule.filter(entry =>
                entry.faculty.name === overworkedName || entry.staff.name === overworkedName
            );

            for (const entry of entriesWithOverworked) {
                if (swapsPerformed >= maxSwaps) break;

                // Determine position
                const isInFacultyPosition = entry.faculty.name === overworkedName;

                // Check if underworked can be assigned here
                if (canSwapAssignment(underworkedName, entry.day, entry.room, schedule, personAssignments, dutyCounter, maxDutiesPerFaculty, preAssignedPeople)) {
                    // Perform swap
                    if (isInFacultyPosition) {
                        entry.faculty = { name: underworkedName, type: 'faculty' };
                    } else {
                        entry.staff = { name: underworkedName, type: 'faculty' };
                    }

                    // Update counts and assignments
                    updateSwapTracking(
                        overworkedName,
                        underworkedName,
                        entry.day,
                        entry.room,
                        dutyCounter,
                        personAssignments
                    );

                    swapsPerformed++;

                    // Re-check seniority after the swap
                    enforcePositionBySeniority(entry, facultyIndices, staffIndices, dutyCounter, preAssignedPeople);
                    break;
                }
            }
        }
    }
}

/**
 * Checks if a person can be assigned to a specific day and room for swapping
 * CRITICAL: Respects pre-assignment constraints - pre-assigned people CANNOT be moved
 */
function canSwapAssignment(
    personName: string,
    day: number,
    room: number,
    schedule: ScheduleEntry[],
    personAssignments: Map<string, { day: number; room: number }[]>,
    dutyCounter: Map<string, { count: number; type: 'faculty' | 'staff' }>,
    maxDutiesPerFaculty: Map<string, number>,
    preAssignedPeople?: Map<string, number[]>
): boolean {
    // CRITICAL CHECK: If person is pre-assigned for this day, they CANNOT be moved
    if (preAssignedPeople?.has(personName) && preAssignedPeople.get(personName)!.includes(day)) {
        console.log(`🔒 BLOCKED: ${personName} is pre-assigned for day ${day} - cannot be swapped`);
        return false;
    }

    // Check if target slot involves a pre-assigned person who cannot be displaced
    const targetEntry = schedule.find(e => e.day === day && e.room === room);
    if (targetEntry) {
        const facultyIsPreAssigned = preAssignedPeople?.has(targetEntry.faculty.name) &&
            preAssignedPeople.get(targetEntry.faculty.name)!.includes(day);
        const staffIsPreAssigned = preAssignedPeople?.has(targetEntry.staff.name) &&
            preAssignedPeople.get(targetEntry.staff.name)!.includes(day);

        if (facultyIsPreAssigned || staffIsPreAssigned) {
            console.log(`🔒 BLOCKED: Target slot has pre-assigned person - cannot swap into day ${day} room ${room}`);
            return false;
        }
    }

    // Check if not already assigned on this day
    const isAssignedOnDay = schedule.some(e =>
        e.day === day && (e.faculty.name === personName || e.staff.name === personName)
    );

    if (isAssignedOnDay) return false;

    // Check if was not in same room on previous day
    const assignments = personAssignments.get(personName) || [];
    const wasInSameRoomYesterday = assignments.some(a =>
        a.day === day - 1 && a.room === room
    );

    if (wasInSameRoomYesterday) return false;

    // For faculty, check if they can take an additional duty without exceeding their limit
    const personType = dutyCounter.get(personName)?.type;
    if (personType === 'faculty') {
        const currentDuties = dutyCounter.get(personName)!.count;
        const maxAllowed = maxDutiesPerFaculty.get(personName)!;
        // Senior faculty have strict limits - cannot exceed
        if (currentDuties >= maxAllowed) {
            return false;
        }
    }

    return true;
}

/**
 * Updates tracking information after a swap
 */
function updateSwapTracking(
    oldPersonName: string,
    newPersonName: string,
    day: number,
    room: number,
    dutyCounter: Map<string, { count: number; type: 'faculty' | 'staff' }>,
    personAssignments: Map<string, { day: number; room: number }[]>
): void {
    // Update counts
    dutyCounter.get(oldPersonName)!.count--;
    dutyCounter.get(newPersonName)!.count++;

    // Update assignments
    const oldAssignments = personAssignments.get(oldPersonName)!;
    const indexToRemove = oldAssignments.findIndex(a =>
        a.day === day && a.room === room
    );

    if (indexToRemove !== -1) {
        oldAssignments.splice(indexToRemove, 1);
    }

    personAssignments.get(newPersonName)!.push({ day, room });
}

/**
 * Enforces seniority ordering in a schedule entry
 */
export function enforcePositionBySeniority(
    entry: ScheduleEntry,
    facultyIndices: Map<string, number>,
    staffIndices: Map<string, number>,
    dutyCounter: Map<string, { count: number; type: 'faculty' | 'staff' }>,
    preAssignedPeople?: Map<string, number[]>
): void {
    const faculty = entry.faculty;
    const staff = entry.staff;

    // Check if either person is pre-assigned for this day
    const facultyIsPreAssigned = preAssignedPeople?.has(faculty.name) &&
        preAssignedPeople.get(faculty.name)!.includes(entry.day);
    const staffIsPreAssigned = preAssignedPeople?.has(staff.name) &&
        preAssignedPeople.get(staff.name)!.includes(entry.day);

    // If either person is pre-assigned, don't swap them - respect their assignment
    if (facultyIsPreAssigned || staffIsPreAssigned) {
        return;
    }

    // Get types from duty counter
    const facultyType = dutyCounter.get(faculty.name)!.type;
    const staffType = dutyCounter.get(staff.name)!.type;

    // If both are faculty, ensure higher seniority is in the faculty position
    if (facultyType === 'faculty' && staffType === 'faculty') {
        const facultyIdx = facultyIndices.get(faculty.name)!;
        const staffIdx = facultyIndices.get(staff.name)!;

        // If staff has higher seniority (lower index), swap positions
        if (staffIdx < facultyIdx) {
            entry.faculty = staff;
            entry.staff = faculty;
        }
    }
    // If both are staff, ensure higher seniority is in the faculty position
    else if (facultyType === 'staff' && staffType === 'staff') {
        const facultyIdx = staffIndices.get(faculty.name)!;
        const staffIdx = staffIndices.get(staff.name)!;

        // If staff has higher seniority (lower index), swap positions
        if (staffIdx < facultyIdx) {
            entry.faculty = staff;
            entry.staff = faculty;
        }
    }
    // If mixed types, faculty type should be in faculty position
    else if (facultyType === 'staff' && staffType === 'faculty') {
        // Swap them as faculty should be in faculty position
        entry.faculty = staff;
        entry.staff = faculty;
    }
    // If faculty is in faculty position and staff is in staff position, no change needed
}