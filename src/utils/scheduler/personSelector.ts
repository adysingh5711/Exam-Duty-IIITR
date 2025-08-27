import { Person } from '../../types';
import { AssignmentContext } from './schedulerInterfaces';
import { wasInSameRoomYesterday, isAssignedOnDay } from './assignmentTracker';

/**
 * Filters candidates based on assignment rules and constraints
 */
export function getEligibleCandidates(
    candidates: Person[],
    day: number,
    room: number,
    position: number,
    selectedPeople: Person[],
    context: AssignmentContext
): Person[] {
    return candidates.filter(person => {
        // Not already selected for this room
        if (selectedPeople.some(selected => selected.name === person.name)) {
            return false;
        }

        // Not assigned today
        if (isAssignedOnDay(person.name, day, context.dailyState)) {
            return false;
        }

        // Check duty constraints based on type
        const currentDuties = context.tracking.dutyCounter.get(person.name)!.count;
        const personType = context.tracking.dutyCounter.get(person.name)!.type;

        // For staff: don't exceed staffDutyTarget
        if (personType === 'staff' && currentDuties >= context.config.staffDutyTarget) {
            return false;
        }

        // For faculty: don't exceed their seniority-based max duties
        if (personType === 'faculty') {
            const maxDuties = context.limits.maxDutiesPerFaculty.get(person.name)!;
            if (currentDuties >= maxDuties) {
                return false;
            }
        }

        // Not assigned to same room yesterday
        if (wasInSameRoomYesterday(person.name, day, room, context.tracking)) {
            return false;
        }

        return true;
    });
}

/**
 * Gets staff candidates who need to meet their duty targets
 */
export function getEligibleStaff(
    staff: Person[],
    day: number,
    room: number,
    selectedPeople: Person[],
    context: AssignmentContext
): Person[] {
    return staff.filter(person => {
        // Not already selected for this room
        if (selectedPeople.some(selected => selected.name === person.name)) {
            return false;
        }

        // Not assigned today
        if (isAssignedOnDay(person.name, day, context.dailyState)) {
            return false;
        }

        // Not reached max duties
        const currentDuties = context.tracking.dutyCounter.get(person.name)!.count;
        if (currentDuties >= context.config.staffDutyTarget) {
            return false;
        }

        // Not assigned to same room yesterday
        if (wasInSameRoomYesterday(person.name, day, room, context.tracking)) {
            return false;
        }

        return true;
    });
}

/**
 * Selects the best candidate from a list based on duty count with SENIORITY HIERARCHY prioritization
 * STRICT PRIORITY ORDER:
 * 1. Maintain seniority hierarchy (don't assign senior faculty if it would violate hierarchy)
 * 2. Fewer current duties (workload balance)
 * 3. For faculty: Junior faculty strongly preferred (helps maintain hierarchy)
 * 4. Random selection among equals
 */
export function selectBestCandidate(
    candidates: Person[],
    context: AssignmentContext
): Person | null {
    if (candidates.length === 0) {
        return null;
    }

    // Step 1: Filter out candidates that would violate seniority hierarchy if selected
    const hierarchySafeCandidates = candidates.filter(candidate => {
        const candidateType = context.tracking.dutyCounter.get(candidate.name)!.type;

        // Only check hierarchy for faculty
        if (candidateType !== 'faculty') {
            return true;
        }

        const candidateIndex = context.tracking.facultyIndices.get(candidate.name)!;
        const candidateCurrentDuties = context.tracking.dutyCounter.get(candidate.name)!.count;

        // Check if assigning this candidate would create a hierarchy violation
        // with any other faculty member
        const allFaculty = Array.from(context.tracking.facultyIndices.entries());

        for (const [otherFacultyName, otherIndex] of allFaculty) {
            if (otherFacultyName === candidate.name) continue;

            const otherCurrentDuties = context.tracking.dutyCounter.get(otherFacultyName)!.count;

            // If candidate is more senior (lower index) than other faculty
            if (candidateIndex < otherIndex) {
                // After assignment, senior would have candidateCurrentDuties + 1
                // This should not exceed junior's current duties
                if (candidateCurrentDuties + 1 > otherCurrentDuties) {
                    console.log(`⚠️  Skipping ${candidate.name} - would create hierarchy violation with ${otherFacultyName}`);
                    return false; // Would violate hierarchy
                }
            }
        }

        return true; // Safe to assign
    });

    // If hierarchy filtering eliminated all candidates, fall back to original list
    // (better to have some violation than no assignment)
    const workingCandidates = hierarchySafeCandidates.length > 0 ? hierarchySafeCandidates : candidates;

    // Step 2: Sort by duty count and seniority preferences
    const sortedEligible = [...workingCandidates].sort((a, b) => {
        const aDuties = context.tracking.dutyCounter.get(a.name)!.count;
        const bDuties = context.tracking.dutyCounter.get(b.name)!.count;

        // Primary sort: fewer duties first (workload balance)
        if (aDuties !== bDuties) {
            return aDuties - bDuties;
        }

        // Secondary sort: when duty counts are equal, strongly prefer junior faculty
        const aType = context.tracking.dutyCounter.get(a.name)!.type;
        const bType = context.tracking.dutyCounter.get(b.name)!.type;

        if (aType === 'faculty' && bType === 'faculty') {
            // STRONG preference for junior faculty (higher index = less senior)
            const aIndex = context.tracking.facultyIndices.get(a.name) || 0;
            const bIndex = context.tracking.facultyIndices.get(b.name) || 0;
            return bIndex - aIndex; // Higher index (junior) gets strong preference
        }

        return 0;
    });

    // Step 3: Randomly select from the best options (those with minimum duties)
    const minDutyCount = context.tracking.dutyCounter.get(sortedEligible[0].name)!.count;
    const peopleWithMinDuties = sortedEligible.filter(p =>
        context.tracking.dutyCounter.get(p.name)!.count === minDutyCount
    );

    // Among people with min duties, prefer junior faculty even more strongly
    const facultyWithMinDuties = peopleWithMinDuties.filter(p =>
        context.tracking.dutyCounter.get(p.name)!.type === 'faculty'
    ).sort((a, b) => {
        const aIndex = context.tracking.facultyIndices.get(a.name) || 0;
        const bIndex = context.tracking.facultyIndices.get(b.name) || 0;
        return bIndex - aIndex; // Most junior first
    });

    const staffWithMinDuties = peopleWithMinDuties.filter(p =>
        context.tracking.dutyCounter.get(p.name)!.type === 'staff'
    );

    // Prefer faculty over staff if duties are equal, but prioritize junior faculty
    let finalPool: Person[];
    if (facultyWithMinDuties.length > 0) {
        // Take the most junior faculty first
        finalPool = [facultyWithMinDuties[0]];
    } else {
        finalPool = staffWithMinDuties;
    }

    if (finalPool.length === 0) {
        finalPool = peopleWithMinDuties; // Fallback
    }

    const randomIndex = Math.floor(Math.random() * finalPool.length);
    const selected = finalPool[randomIndex];

    // Log hierarchy-conscious selection
    if (context.tracking.dutyCounter.get(selected.name)!.type === 'faculty') {
        const selectedIndex = context.tracking.facultyIndices.get(selected.name)!;
        const selectedDuties = context.tracking.dutyCounter.get(selected.name)!.count;
        console.log(`Selected faculty: ${selected.name} (index ${selectedIndex}, ${selectedDuties} duties) - hierarchy-conscious choice`);
    }

    return selected;
}

/**
 * Gets fallback candidates when primary selection fails
 */
export function getFallbackCandidates(
    candidatePool: Person[],
    selectedPeople: Person[],
    context: AssignmentContext,
    day?: number
): Person[] {
    // Filter out people already selected for this room
    const availableCandidates = candidatePool.filter(p =>
        !selectedPeople.some(selected => selected.name === p.name)
    );

    if (day !== undefined) {
        // First try: people not assigned today
        const unassignedToday = availableCandidates.filter(p =>
            !isAssignedOnDay(p.name, day, context.dailyState)
        );

        // Filter by duty constraints
        const constrainedCandidates = unassignedToday.filter(p => {
            const currentDuties = context.tracking.dutyCounter.get(p.name)!.count;
            const personType = context.tracking.dutyCounter.get(p.name)!.type;

            if (personType === 'staff') {
                return currentDuties < context.config.staffDutyTarget;
            } else {
                const maxDuties = context.limits.maxDutiesPerFaculty.get(p.name)!;
                return currentDuties < maxDuties;
            }
        });

        if (constrainedCandidates.length > 0) {
            return constrainedCandidates;
        }

        if (unassignedToday.length > 0) {
            return unassignedToday;
        }
    }

    // Last resort: anyone available (respecting duty limits)
    return availableCandidates.filter(p => {
        const currentDuties = context.tracking.dutyCounter.get(p.name)!.count;
        const personType = context.tracking.dutyCounter.get(p.name)!.type;

        if (personType === 'staff') {
            return currentDuties < context.config.staffDutyTarget;
        } else {
            const maxDuties = context.limits.maxDutiesPerFaculty.get(p.name)!;
            return currentDuties < maxDuties;
        }
    });
}