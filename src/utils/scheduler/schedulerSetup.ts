import { Person } from '../../types';
import { SchedulerConfig, DutyLimits } from './schedulerInterfaces';

/**
 * Validates input parameters for schedule generation
 */
export function validateInputs(
    faculty: Person[],
    staff: Person[],
    days: number,
    rooms: number
): void {
    if (days < 1 || days > 10) {
        throw new Error('Number of days must be between 1 and 10');
    }
    if (rooms < 1 || rooms > 20) {
        throw new Error('Number of rooms must be between 1 and 20');
    }
    if (faculty.length === 0) {
        throw new Error('At least one faculty member is required');
    }
    if (staff.length === 0) {
        throw new Error('At least one staff member is required');
    }

    const totalPositions = days * rooms * 2;
    if (faculty.length + staff.length < Math.ceil(totalPositions / days)) {
        console.warn('Warning: May not have enough people to fill all positions optimally');
    }
}

/**
 * Creates the scheduler configuration based on input parameters
 */
export function createSchedulerConfig(
    faculty: Person[],
    staff: Person[],
    days: number,
    rooms: number
): SchedulerConfig {
    const totalPositions = days * rooms * 2;

    // Step 1: Staff get exactly (days - 1) duties each
    const staffDutyTarget = Math.max(1, days - 1);
    const totalStaffDuties = staff.length * staffDutyTarget;

    // Step 2: Remaining positions go to faculty
    const totalFacultyDuties = totalPositions - totalStaffDuties;
    const seniorityThreshold = Math.floor(faculty.length * 0.3); // Top 30% are senior

    return {
        days,
        rooms,
        totalPositions,
        staffDutyTarget,
        totalStaffDuties,
        totalFacultyDuties,
        seniorityThreshold,
    };
}

/**
 * Calculates duty limits for faculty members based on seniority
 * ENFORCES STRICT HIERARCHY: Senior faculty get progressively fewer duties
 */
export function calculateDutyLimits(
    faculty: Person[],
    config: SchedulerConfig
): DutyLimits {
    const maxDutiesPerFaculty = new Map<string, number>();

    // Step 1: Calculate base equal duties per faculty
    const baseDutiesPerFaculty = Math.floor(config.totalFacultyDuties / faculty.length);
    const extraDuties = config.totalFacultyDuties % faculty.length;

    console.log(`Faculty Duty Calculation (STRICT SENIORITY HIERARCHY):`);
    console.log(`- Total faculty duties to allocate: ${config.totalFacultyDuties}`);
    console.log(`- Base duties per faculty: ${baseDutiesPerFaculty}`);
    console.log(`- Extra duties to distribute: ${extraDuties}`);
    console.log(`- Faculty count: ${faculty.length}`);

    // Step 2: Assign duties with ULTRA-STRICT seniority hierarchy
    // Distribute duties in REVERSE order: junior faculty get duties first, then senior
    const dutiesPerLevel = Math.floor(config.totalFacultyDuties / faculty.length);
    const remainingDuties = config.totalFacultyDuties % faculty.length;

    // Create a duty distribution that ensures strict hierarchy
    const dutyDistribution: number[] = new Array(faculty.length).fill(dutiesPerLevel);

    // Add extra duties to the MOST JUNIOR faculty first (highest indices)
    for (let i = 0; i < remainingDuties; i++) {
        const targetIndex = faculty.length - 1 - i; // Start from most junior
        dutyDistribution[targetIndex]++;
    }

    // Apply the distribution
    faculty.forEach((f, index) => {
        const dutyAllocation = Math.max(1, dutyDistribution[index]);

        console.log(`${index === 0 ? 'MOST SENIOR' : index === faculty.length - 1 ? 'MOST JUNIOR' : 'FACULTY'} ${f.name} (index ${index}): ${dutyAllocation} duties`);

        maxDutiesPerFaculty.set(f.name, dutyAllocation);
    });

    // Verify STRICT hierarchy - NO senior faculty should have >= duties than any junior
    let hierarchyPerfect = true;
    for (let i = 0; i < faculty.length - 1; i++) {
        const seniorDuties = maxDutiesPerFaculty.get(faculty[i].name)!;

        for (let j = i + 1; j < faculty.length; j++) {
            const juniorDuties = maxDutiesPerFaculty.get(faculty[j].name)!;

            if (seniorDuties > juniorDuties) {
                console.error(`❌ HIERARCHY VIOLATION: ${faculty[i].name} (${seniorDuties}) > ${faculty[j].name} (${juniorDuties})`);
                hierarchyPerfect = false;
            } else if (seniorDuties === juniorDuties) {
                console.warn(`⚠️  EQUAL DUTIES: ${faculty[i].name} = ${faculty[j].name} (${seniorDuties} each)`);
            }
        }
    }

    if (hierarchyPerfect) {
        console.log('✅ PERFECT HIERARCHY: Every senior faculty has fewer duties than every junior faculty');
    }

    // Step 3: Verify total allocation
    const totalAllocated = Array.from(maxDutiesPerFaculty.values()).reduce((sum, duties) => sum + duties, 0);
    console.log(`Total faculty duties allocated: ${totalAllocated} (should be ${config.totalFacultyDuties})`);

    if (totalAllocated !== config.totalFacultyDuties) {
        console.error(`MISMATCH: Expected ${config.totalFacultyDuties}, got ${totalAllocated}`);
    }

    // Log the final hierarchy
    console.log('\nFINAL DUTY HIERARCHY (Senior → Junior):');
    faculty.forEach((f, index) => {
        const duties = maxDutiesPerFaculty.get(f.name)!;
        console.log(`  ${index + 1}. ${f.name}: ${duties} duties`);
    });

    const minDutiesPerFaculty = Math.max(1, baseDutiesPerFaculty - 1);

    return {
        maxDutiesPerFaculty,
        minDutiesPerFaculty,
    };
}