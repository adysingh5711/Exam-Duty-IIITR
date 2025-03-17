import { Person, Schedule, ScheduleEntry, DutyCount } from '../types';

export function generateSchedule(faculty: Person[], staff: Person[]): Schedule {
  const days = 6;
  const rooms = 11;
  const schedule: ScheduleEntry[] = [];
  const dutyCounter = new Map<string, { count: number; type: 'faculty' | 'staff' }>();

  // Staff duty target is exactly (days-1) per person
  const staffDutyTarget = days - 1;

  // Calculate minimum staff assignments needed per day
  // Total staff duties needed: staff.length * staffDutyTarget
  // Distributed across days evenly
  const minStaffAssignmentsPerDay = Math.floor((staff.length * staffDutyTarget) / days);

  // Store original indices for seniority reference
  const facultyIndices = new Map<string, number>();
  faculty.forEach((f, index) => facultyIndices.set(f.name, index));

  const staffIndices = new Map<string, number>();
  staff.forEach((s, index) => staffIndices.set(s.name, index));

  // Create combined people pool for random assignment
  const allPeople = [...faculty, ...staff];

  // Initialize duty counter
  faculty.forEach(f => dutyCounter.set(f.name, { count: 0, type: 'faculty' }));
  staff.forEach(s => dutyCounter.set(s.name, { count: 0, type: 'staff' }));

  // Calculate faculty duty thresholds
  const totalPositions = days * rooms * 2; // days * rooms * (2 people per room)
  const totalStaffDuties = staff.length * staffDutyTarget;
  const remainingDutiesForFaculty = totalPositions - totalStaffDuties;
  const maxDutiesPerFaculty = Math.ceil(remainingDutiesForFaculty / faculty.length);
  const minDutiesPerFaculty = Math.max(0, maxDutiesPerFaculty - 2); // Set minimum 2 less than max

  // Keep track of previous day assignments to avoid same classroom on consecutive days
  const personAssignments = new Map<string, { day: number, room: number }[]>();
  allPeople.forEach(p => personAssignments.set(p.name, []));

  for (let day = 1; day <= days; day++) {
    // Track assigned people for the current day to avoid duplicates on same day
    const assignedPeopleForDay = new Set<string>();

    // Count staff assignments for this day
    let staffAssignmentsForDay = 0;

    // For each room on the current day
    for (let room = 1; room <= rooms; room++) {
      // We'll assign two people to each room, first a faculty member, then any staff/faculty
      let selectedPeople: Person[] = [];

      // Calculate remaining rooms for this day
      const remainingRooms = rooms - room + 1;

      // Calculate how many more staff assignments needed for this day to meet minimum
      const staffAssignmentsNeededForDay = Math.max(0, minStaffAssignmentsPerDay - staffAssignmentsForDay);

      // Flag to force staff assignment if we're running behind on staff assignments
      const forceStaffAssignment = remainingRooms <= staffAssignmentsNeededForDay;

      // Try to fill positions from eligible people pool
      for (let position = 0; position < 2; position++) {
        // Modified: For first position, only select from faculty members unless we need to force staff
        let candidatePool = position === 0 ? faculty : allPeople;

        // If we're running behind on staff assignments and this is the second position,
        // or if we absolutely need to assign staff and have few rooms left, prioritize staff
        if ((position === 1 && staffAssignmentsForDay < minStaffAssignmentsPerDay) ||
          (forceStaffAssignment && position === 1)) {
          // For second position, try to use staff if we're behind on their assignments
          const eligibleStaff = staff.filter(p => {
            // Not already selected for this room
            if (selectedPeople.some(selected => selected.name === p.name)) return false;

            // Not assigned today
            if (assignedPeopleForDay.has(p.name)) return false;

            // Not reached max duties
            const currentDuties = dutyCounter.get(p.name)!.count;
            if (currentDuties >= staffDutyTarget) return false;

            // Not assigned to same room yesterday
            const assignments = personAssignments.get(p.name) || [];
            const wasInSameRoomYesterday = assignments.some(a =>
              a.day === day - 1 && a.room === room
            );

            return !wasInSameRoomYesterday;
          });

          // If we have eligible staff, use them exclusively
          if (eligibleStaff.length > 0) {
            candidatePool = eligibleStaff;
          }
        }

        // Filter eligible people based on standard criteria
        let eligiblePeople = candidatePool.filter(p => {
          // Not already selected for this room
          if (selectedPeople.some(selected => selected.name === p.name)) return false;

          // Not assigned today
          if (assignedPeopleForDay.has(p.name)) return false;

          // Check duty constraints based on type
          const currentDuties = dutyCounter.get(p.name)!.count;
          const personType = dutyCounter.get(p.name)!.type;

          // For staff: don't exceed staffDutyTarget
          if (personType === 'staff' && currentDuties >= staffDutyTarget) return false;

          // For faculty: don't exceed maxDutiesPerFaculty
          if (personType === 'faculty' && currentDuties >= maxDutiesPerFaculty) return false;

          // Not assigned to same room yesterday
          const assignments = personAssignments.get(p.name) || [];
          const wasInSameRoomYesterday = assignments.some(a =>
            a.day === day - 1 && a.room === room
          );

          return !wasInSameRoomYesterday;
        });

        if (eligiblePeople.length > 0) {
          // Prioritize people with fewer duties but still eligible
          const sortedEligible = [...eligiblePeople].sort((a, b) =>
            dutyCounter.get(a.name)!.count - dutyCounter.get(b.name)!.count
          );

          // Randomly select from people with the minimum duty count
          const minDutyCount = dutyCounter.get(sortedEligible[0].name)!.count;
          const peopleWithMinDuties = sortedEligible.filter(p =>
            dutyCounter.get(p.name)!.count === minDutyCount
          );

          const randomIndex = Math.floor(Math.random() * peopleWithMinDuties.length);
          selectedPeople.push(peopleWithMinDuties[randomIndex]);
        } else {
          // Fallback: take anyone not assigned today, prioritizing those with fewer duties
          // For first position, still restrict to faculty members only
          const candidatePoolFallback = position === 0 ? faculty : allPeople;
          const unassignedToday = candidatePoolFallback.filter(p => !assignedPeopleForDay.has(p.name));

          // For position 1, filter out staff who reached their quota
          const filteredUnassignedToday = position === 1
            ? unassignedToday.filter(p =>
              dutyCounter.get(p.name)!.type !== 'staff' ||
              dutyCounter.get(p.name)!.count < staffDutyTarget
            )
            : unassignedToday;

          if (filteredUnassignedToday.length > 0) {
            const sortedUnassigned = [...filteredUnassignedToday].sort((a, b) =>
              dutyCounter.get(a.name)!.count - dutyCounter.get(b.name)!.count
            );

            selectedPeople.push(sortedUnassigned[0]);
          } else {
            // Last resort: take person with fewest duties
            // For first position, still restrict to faculty members only
            let sortedAll = [...candidatePoolFallback].sort((a, b) =>
              dutyCounter.get(a.name)!.count - dutyCounter.get(b.name)!.count
            );

            // Filter out staff who reached their quota for position 1
            if (position === 1) {
              sortedAll = sortedAll.filter(p =>
                dutyCounter.get(p.name)!.type !== 'staff' ||
                dutyCounter.get(p.name)!.count < staffDutyTarget
              );
            }

            // Skip people already selected for this room
            const availablePeople = sortedAll.filter(p =>
              !selectedPeople.some(selected => selected.name === p.name)
            );

            if (availablePeople.length > 0) {
              selectedPeople.push(availablePeople[0]);
            }
          }
        }

        // After selection is made, update staff assignment counter
        if (selectedPeople.length === position + 1) {
          const selectedPerson = selectedPeople[position];
          const personType = dutyCounter.get(selectedPerson.name)!.type;
          if (personType === 'staff') {
            staffAssignmentsForDay++;
          }
        }
      }

      // Make sure we found two people
      if (selectedPeople.length === 2) {
        // Sort people by seniority if they have the same type
        const person1 = selectedPeople[0];
        const person2 = selectedPeople[1];

        // Get the types of the two people
        const type1 = dutyCounter.get(person1.name)!.type;
        const type2 = dutyCounter.get(person2.name)!.type;

        // Arrange by seniority if both are faculty or both are staff
        let faculty, staff;

        if (type1 === 'faculty' && type2 === 'faculty') {
          // Both are faculty, sort by faculty indices (lower index = higher seniority)
          const idx1 = facultyIndices.get(person1.name)!;
          const idx2 = facultyIndices.get(person2.name)!;

          faculty = idx1 < idx2 ? person1 : person2;
          staff = idx1 < idx2 ? person2 : person1;
        } else if (type1 === 'staff' && type2 === 'staff') {
          // Both are staff, sort by staff indices (lower index = higher seniority)
          const idx1 = staffIndices.get(person1.name)!;
          const idx2 = staffIndices.get(person2.name)!;

          // For two staff, put higher seniority in faculty position
          faculty = idx1 < idx2 ? person1 : person2;
          staff = idx1 < idx2 ? person2 : person1;
        } else {
          // One faculty, one staff - faculty always goes in faculty position
          faculty = type1 === 'faculty' ? person1 : person2;
          staff = type1 === 'faculty' ? person2 : person1;
        }

        // Mark as assigned for today
        [faculty, staff].forEach(person => {
          assignedPeopleForDay.add(person.name);

          // Update assignment history
          personAssignments.get(person.name)!.push({ day, room });

          // Update duty counter
          dutyCounter.get(person.name)!.count++;
        });

        // Add to schedule
        schedule.push({
          faculty,
          staff,
          room: room,
          day: day
        });
      }
    }

    // Before moving to next day, verify we assigned enough staff
    // If not, we might need to swap some faculty with staff
    if (staffAssignmentsForDay < minStaffAssignmentsPerDay) {
      // Find entries for this day where both positions are filled by faculty
      const entriesForDay = schedule.filter(entry => entry.day === day);

      // Sort by rooms to keep changes predictable
      entriesForDay.sort((a, b) => a.room - b.room);

      // Calculate how many more staff we need to assign
      const additionalStaffNeeded = minStaffAssignmentsPerDay - staffAssignmentsForDay;

      // Find eligible staff to assign
      const eligibleStaff = staff.filter(s =>
        !assignedPeopleForDay.has(s.name) &&
        dutyCounter.get(s.name)!.count < staffDutyTarget
      );

      // Sort by duty count to prioritize staff with fewer duties
      eligibleStaff.sort((a, b) =>
        dutyCounter.get(a.name)!.count - dutyCounter.get(b.name)!.count
      );

      // Count swaps made
      let swapsMade = 0;

      // Try to swap faculty in staff positions with eligible staff
      for (const entry of entriesForDay) {
        if (swapsMade >= additionalStaffNeeded || eligibleStaff.length === 0) break;

        // If this entry has a faculty member in the staff position, swap it
        if (dutyCounter.get(entry.staff.name)!.type === 'faculty') {
          const staffToAssign = eligibleStaff.shift();
          if (staffToAssign) {
            // Decrement count for faculty member being replaced
            dutyCounter.get(entry.staff.name)!.count--;

            // Remove from assigned people and assignments
            const facultyAssignments = personAssignments.get(entry.staff.name)!;
            const indexToRemove = facultyAssignments.findIndex(a =>
              a.day === day && a.room === entry.room
            );
            if (indexToRemove !== -1) {
              facultyAssignments.splice(indexToRemove, 1);
            }

            // Assign staff
            entry.staff = staffToAssign;
            assignedPeopleForDay.add(staffToAssign.name);
            dutyCounter.get(staffToAssign.name)!.count++;
            personAssignments.get(staffToAssign.name)!.push({ day, room: entry.room });

            swapsMade++;
            staffAssignmentsForDay++;
          }
        }
      }
    }
  }

  // Modified balance function to ensure staff maintain exactly staffDutyTarget duties
  balanceScheduleWithStaffConstraint(
    schedule,
    dutyCounter,
    personAssignments,
    maxDutiesPerFaculty,
    minDutiesPerFaculty,
    staffDutyTarget,
    facultyIndices,
    staffIndices
  );

  // Convert duty counter to arrays
  const facultyDuties: DutyCount[] = Array.from(dutyCounter.entries())
    .filter(([_, data]) => data.type === 'faculty')
    .map(([name, data]) => ({ name, count: data.count }))
    .sort((a, b) => b.count - a.count);

  const staffDuties: DutyCount[] = Array.from(dutyCounter.entries())
    .filter(([_, data]) => data.type === 'staff')
    .map(([name, data]) => ({ name, count: data.count }))
    .sort((a, b) => b.count - a.count);

  return { entries: schedule, facultyDuties, staffDuties };
}

// Modified helper function to balance the schedule with staff constraint
function balanceScheduleWithStaffConstraint(
  schedule: ScheduleEntry[],
  dutyCounter: Map<string, { count: number; type: 'faculty' | 'staff' }>,
  personAssignments: Map<string, { day: number, room: number }[]>,
  maxDutiesPerFaculty: number,
  minDutiesPerFaculty: number,
  staffDutyTarget: number,
  facultyIndices: Map<string, number>,
  staffIndices: Map<string, number>
): void {
  // First check if any staff has != staffDutyTarget duties
  const staffEntries = Array.from(dutyCounter.entries())
    .filter(([_, data]) => data.type === 'staff');

  const overworkedStaff = staffEntries.filter(([_, data]) => data.count > staffDutyTarget);
  const underworkedStaff = staffEntries.filter(([_, data]) => data.count < staffDutyTarget);

  // Get all faculty sorted by duty count (highest to lowest)
  const facultyByDuties = Array.from(dutyCounter.entries())
    .filter(([_, data]) => data.type === 'faculty')
    .sort((a, b) => b[1].count - a[1].count);

  // Calculate faculty duty stats
  const totalFacultyDuties = facultyByDuties.reduce((sum, [_, data]) => sum + data.count, 0);
  const avgFacultyDuties = totalFacultyDuties / facultyByDuties.length;

  // Identify faculty that can give/take duties
  const overworkedFaculty = facultyByDuties.filter(([_, data]) =>
    data.count > Math.max(avgFacultyDuties + 1, maxDutiesPerFaculty)
  );

  const underworkedFaculty = facultyByDuties.filter(([_, data]) =>
    data.count < Math.min(avgFacultyDuties - 1, minDutiesPerFaculty)
  );

  // Perform swaps to balance (limited to prevent infinite loops)
  const maxSwaps = 100;
  let swapsPerformed = 0;

  // Phase 1: Fix staff duty counts

  // Handle overworked staff first - swap with underworked faculty
  for (const [staffName, staffData] of overworkedStaff) {
    if (swapsPerformed >= maxSwaps) break;

    let excessDuties = staffData.count - staffDutyTarget;

    // Find underworked faculty to take these duties
    for (const [facultyName, facultyData] of underworkedFaculty) {
      if (swapsPerformed >= maxSwaps || excessDuties <= 0) break;

      // Find entries where this staff is assigned
      const entriesWithStaff = schedule.filter(entry =>
        entry.faculty.name === staffName || entry.staff.name === staffName
      );

      for (const entry of entriesWithStaff) {
        if (swapsPerformed >= maxSwaps || excessDuties <= 0) break;

        // Determine position of staff in this entry
        const isStaffInFacultyPosition = entry.faculty.name === staffName;

        // Check if faculty can be assigned here
        // Check if faculty is not already assigned on this day
        const isAssignedOnDay = schedule.some(e =>
          e.day === entry.day && (e.faculty.name === facultyName || e.staff.name === facultyName)
        );

        // Check if faculty was not in same room on previous day
        const facultyAssignments = personAssignments.get(facultyName) || [];
        const wasInSameRoomYesterday = facultyAssignments.some(a =>
          a.day === entry.day - 1 && a.room === entry.room
        );

        if (!isAssignedOnDay && !wasInSameRoomYesterday) {
          // Perform swap
          if (isStaffInFacultyPosition) {
            entry.faculty = { name: facultyName, type: 'faculty' };
          } else {
            entry.staff = { name: facultyName, type: 'faculty' };
          }

          // Update counts
          dutyCounter.get(staffName)!.count--;
          dutyCounter.get(facultyName)!.count++;

          // Update assignments
          const staffAssignments = personAssignments.get(staffName)!;
          const indexToRemove = staffAssignments.findIndex(a =>
            a.day === entry.day && a.room === entry.room
          );

          if (indexToRemove !== -1) {
            staffAssignments.splice(indexToRemove, 1);
          }

          personAssignments.get(facultyName)!.push({ day: entry.day, room: entry.room });

          swapsPerformed++;
          excessDuties--;

          // Re-check seniority after the swap
          enforcePositionBySeniority(entry, facultyIndices, staffIndices, dutyCounter);
        }
      }
    }
  }

  // Handle underworked staff - swap with overworked faculty
  for (const [staffName, staffData] of underworkedStaff) {
    if (swapsPerformed >= maxSwaps) break;

    let neededDuties = staffDutyTarget - staffData.count;

    // Find overworked faculty to give up duties
    for (const [facultyName, facultyData] of overworkedFaculty) {
      if (swapsPerformed >= maxSwaps || neededDuties <= 0) break;

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
        // Check if staff is not already assigned on this day
        const isAssignedOnDay = schedule.some(e =>
          e.day === entry.day && (e.faculty.name === staffName || e.staff.name === staffName)
        );

        // Check if staff was not in same room on previous day
        const staffAssignments = personAssignments.get(staffName) || [];
        const wasInSameRoomYesterday = staffAssignments.some(a =>
          a.day === entry.day - 1 && a.room === entry.room
        );

        if (!isAssignedOnDay && !wasInSameRoomYesterday) {
          // Perform swap - staff can only take staff position
          entry.staff = { name: staffName, type: 'staff' };

          // Update counts
          dutyCounter.get(facultyName)!.count--;
          dutyCounter.get(staffName)!.count++;

          // Update assignments
          const facultyAssignments = personAssignments.get(facultyName)!;
          const indexToRemove = facultyAssignments.findIndex(a =>
            a.day === entry.day && a.room === entry.room
          );

          if (indexToRemove !== -1) {
            facultyAssignments.splice(indexToRemove, 1);
          }

          personAssignments.get(staffName)!.push({ day: entry.day, room: entry.room });

          swapsPerformed++;
          neededDuties--;

          // Re-check seniority after the swap
          enforcePositionBySeniority(entry, facultyIndices, staffIndices, dutyCounter);
        }
      }
    }
  }

  // Phase 2: Balance faculty duties (only swap faculty with faculty)
  // Recalculate faculty status
  const updatedFacultyByDuties = Array.from(dutyCounter.entries())
    .filter(([_, data]) => data.type === 'faculty')
    .sort((a, b) => b[1].count - a[1].count);

  const updatedOverworkedFaculty = updatedFacultyByDuties.filter(([_, data]) =>
    data.count > avgFacultyDuties + 1 && data.count > minDutiesPerFaculty + 1
  );

  const updatedUnderworkedFaculty = updatedFacultyByDuties.filter(([_, data]) =>
    data.count < avgFacultyDuties - 1
  );

  // Swap duties between faculty members to balance
  for (const [overworkedName, overworkedData] of updatedOverworkedFaculty) {
    if (swapsPerformed >= maxSwaps) break;

    for (const [underworkedName, underworkedData] of updatedUnderworkedFaculty) {
      if (swapsPerformed >= maxSwaps) break;

      // Find entries where overworked faculty is assigned
      const entriesWithOverworked = schedule.filter(entry =>
        entry.faculty.name === overworkedName || entry.staff.name === overworkedName
      );

      for (const entry of entriesWithOverworked) {
        if (swapsPerformed >= maxSwaps) break;

        // Determine position
        const isInFacultyPosition = entry.faculty.name === overworkedName;

        // Check if underworked can be assigned here
        // Check if not already assigned on this day
        const isAssignedOnDay = schedule.some(e =>
          e.day === entry.day && (e.faculty.name === underworkedName || e.staff.name === underworkedName)
        );

        // Check if was not in same room on previous day
        const underworkedAssignments = personAssignments.get(underworkedName) || [];
        const wasInSameRoomYesterday = underworkedAssignments.some(a =>
          a.day === entry.day - 1 && a.room === entry.room
        );

        if (!isAssignedOnDay && !wasInSameRoomYesterday) {
          // Perform swap
          if (isInFacultyPosition) {
            entry.faculty = { name: underworkedName, type: 'faculty' };
          } else {
            entry.staff = { name: underworkedName, type: 'faculty' };
          }

          // Update counts
          dutyCounter.get(overworkedName)!.count--;
          dutyCounter.get(underworkedName)!.count++;

          // Update assignments
          const overworkedAssignments = personAssignments.get(overworkedName)!;
          const indexToRemove = overworkedAssignments.findIndex(a =>
            a.day === entry.day && a.room === entry.room
          );

          if (indexToRemove !== -1) {
            overworkedAssignments.splice(indexToRemove, 1);
          }

          personAssignments.get(underworkedName)!.push({ day: entry.day, room: entry.room });

          swapsPerformed++;

          // Re-check seniority after the swap
          enforcePositionBySeniority(entry, facultyIndices, staffIndices, dutyCounter);
          break;
        }
      }
    }
  }

  // Final pass to ensure all entries have correct seniority ordering
  schedule.forEach(entry => {
    enforcePositionBySeniority(entry, facultyIndices, staffIndices, dutyCounter);
  });
}

// Helper function to enforce seniority ordering in a schedule entry
function enforcePositionBySeniority(
  entry: ScheduleEntry,
  facultyIndices: Map<string, number>,
  staffIndices: Map<string, number>,
  dutyCounter: Map<string, { count: number; type: 'faculty' | 'staff' }>
): void {
  const faculty = entry.faculty;
  const staff = entry.staff;

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
