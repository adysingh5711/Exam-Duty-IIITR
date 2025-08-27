import { Person, Schedule, ScheduleEntry, DutyCount } from '../types';
import {
  validateInputs,
  createSchedulerConfig,
  calculateDutyLimits,
  initializeTracking,
  assignRoomPositions,
  handlePreAssignedFaculty,
  validatePreAssignments,
  balanceScheduleWithStaffConstraint,
  verifyStaffDuties,
  validateSchedule,
  AssignmentContext,
  updateAssignmentTracking
} from './scheduler';

/**
 * Generates a schedule for exam duties with faculty and staff assignments
 * @param faculty List of faculty members
 * @param staff List of staff members
 * @param preAssignedFaculty Optional pre-assignments of faculty to specific days
 * @param days Number of exam days (default: 6)
 * @param rooms Number of exam rooms (default: 11)
 * @returns Complete schedule with duty assignments
 */
export function generateSchedule(
  faculty: Person[],
  staff: Person[],
  preAssignedFaculty: { [day: number]: string[] } = {},
  days: number = 6,
  rooms: number = 11
): Schedule {
  // Validate all inputs
  validateInputs(faculty, staff, days, rooms);

  const preAssignmentValidation = validatePreAssignments(preAssignedFaculty, faculty, staff, days, rooms);
  if (!preAssignmentValidation.isValid) {
    throw new Error(`Pre-assignment validation failed: ${preAssignmentValidation.errors.join(', ')}`);
  }

  // Create configuration
  const config = createSchedulerConfig(faculty, staff, days, rooms);
  const limits = calculateDutyLimits(faculty, config);
  const { tracking, dailyState } = initializeTracking(faculty, staff, config);

  // Create assignment context
  const context: AssignmentContext = {
    config,
    limits,
    tracking,
    dailyState,
    faculty,
    staff,
    allPeople: [...faculty, ...staff]
  };

  // Handle pre-assigned faculty first
  const schedule: ScheduleEntry[] = handlePreAssignedFaculty(preAssignedFaculty, context);

  // Regular assignment process for remaining slots
  for (let day = 1; day <= config.days; day++) {
    // Get already assigned rooms for this day from pre-assignments
    const assignedRoomsForDay = context.dailyState.preAssignedRooms.get(day) || [];

    // Count staff assignments for this day from pre-assignments
    const assignedPeopleForDay = context.dailyState.dailyAssignments.get(day) || new Set<string>();
    let staffAssignmentsForDay = Array.from(assignedPeopleForDay).filter(
      name => context.tracking.dutyCounter.get(name)?.type === 'staff'
    ).length;

    // For each room on the current day that hasn't been pre-assigned
    for (let room = 1; room <= config.rooms; room++) {
      // Skip pre-assigned rooms
      if (assignedRoomsForDay.includes(room)) continue;

      // Assign people to this room
      const roomResult = assignRoomPositions(day, room, context, staffAssignmentsForDay);

      if (roomResult.selectedPeople.length === 2) {
        // Get the types and arrange by seniority/position rules
        const type1 = context.tracking.dutyCounter.get(roomResult.selectedPeople[0].name)!.type;
        const type2 = context.tracking.dutyCounter.get(roomResult.selectedPeople[1].name)!.type;

        let faculty: Person, staff: Person;

        if (type1 === 'faculty' && type2 === 'faculty') {
          // Both are faculty, sort by faculty indices (lower index = higher seniority)
          const idx1 = context.tracking.facultyIndices.get(roomResult.selectedPeople[0].name)!;
          const idx2 = context.tracking.facultyIndices.get(roomResult.selectedPeople[1].name)!;
          faculty = idx1 < idx2 ? roomResult.selectedPeople[0] : roomResult.selectedPeople[1];
          staff = idx1 < idx2 ? roomResult.selectedPeople[1] : roomResult.selectedPeople[0];
        } else if (type1 === 'staff' && type2 === 'staff') {
          // Both are staff, sort by staff indices (lower index = higher seniority)
          const idx1 = context.tracking.staffIndices.get(roomResult.selectedPeople[0].name)!;
          const idx2 = context.tracking.staffIndices.get(roomResult.selectedPeople[1].name)!;
          faculty = idx1 < idx2 ? roomResult.selectedPeople[0] : roomResult.selectedPeople[1];
          staff = idx1 < idx2 ? roomResult.selectedPeople[1] : roomResult.selectedPeople[0];
        } else {
          // One faculty, one staff - faculty always goes in faculty position
          faculty = type1 === 'faculty' ? roomResult.selectedPeople[0] : roomResult.selectedPeople[1];
          staff = type1 === 'faculty' ? roomResult.selectedPeople[1] : roomResult.selectedPeople[0];
        }

        // Update tracking for both people using the proper tracking function
        updateAssignmentTracking(faculty.name, day, room, context.tracking, context.dailyState);
        updateAssignmentTracking(staff.name, day, room, context.tracking, context.dailyState);

        // Create and add schedule entry
        const entry = {
          faculty,
          staff,
          room,
          day
        };
        schedule.push(entry);
        staffAssignmentsForDay = roomResult.updatedStaffCount;
      }
    }
  }

  // IMMEDIATE seniority enforcement after initial schedule generation
  console.log('\n=== INITIAL SCHEDULE SENIORITY CHECK ===');
  balanceScheduleWithStaffConstraint(
    schedule,
    context.tracking.dutyCounter,
    context.tracking.personAssignments,
    context.limits.maxDutiesPerFaculty,
    context.limits.minDutiesPerFaculty,
    config.staffDutyTarget,
    context.tracking.facultyIndices,
    context.tracking.staffIndices,
    context.dailyState.preAssignedPeople
  );

  // Balance the schedule to optimize duty distribution
  balanceScheduleWithStaffConstraint(
    schedule,
    context.tracking.dutyCounter,
    context.tracking.personAssignments,
    context.limits.maxDutiesPerFaculty,
    context.limits.minDutiesPerFaculty,
    config.staffDutyTarget,
    context.tracking.facultyIndices,
    context.tracking.staffIndices,
    context.dailyState.preAssignedPeople
  );

  // FINAL seniority enforcement before verification
  console.log('\n=== PRE-VERIFICATION SENIORITY ENFORCEMENT ===');
  balanceScheduleWithStaffConstraint(
    schedule,
    context.tracking.dutyCounter,
    context.tracking.personAssignments,
    context.limits.maxDutiesPerFaculty,
    context.limits.minDutiesPerFaculty,
    config.staffDutyTarget,
    context.tracking.facultyIndices,
    context.tracking.staffIndices,
    context.dailyState.preAssignedPeople
  );

  // Final verification to ensure all staff have exactly staffDutyTarget duties
  verifyStaffDuties(
    schedule,
    staff,
    config.staffDutyTarget,
    context.tracking.dutyCounter,
    context.tracking.personAssignments,
    context.tracking.facultyIndices,
    context.tracking.staffIndices,
    context.dailyState.preAssignedPeople
  );

  // Validate the final schedule
  const validation = validateSchedule(schedule, faculty, staff, config.staffDutyTarget, days, rooms);
  if (!validation.isValid) {
    console.warn('Schedule validation warnings:', validation.errors.join(', '));
  }

  // Convert duty counter to arrays
  const facultyDuties: DutyCount[] = Array.from(context.tracking.dutyCounter.entries())
    .filter(([, data]) => data.type === 'faculty')
    .map(([name, data]) => ({ name, count: data.count }))
    .sort((a, b) => b.count - a.count);

  const staffDuties: DutyCount[] = Array.from(context.tracking.dutyCounter.entries())
    .filter(([, data]) => data.type === 'staff')
    .map(([name, data]) => ({ name, count: data.count }))
    .sort((a, b) => b.count - a.count);

  return { entries: schedule, facultyDuties, staffDuties };
}


