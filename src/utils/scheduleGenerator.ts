import { Person, Schedule, ScheduleEntry, DutyCount } from '../types';

export function generateSchedule(faculty: Person[], staff: Person[]): Schedule {
  const days = 6;
  const rooms = 11;
  const schedule: ScheduleEntry[] = [];
  const dutyCounter = new Map<string, { count: number; type: 'faculty' | 'staff' }>();

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

  // Calculate duty thresholds
  const totalPositions = days * rooms * 2; // days * rooms * (2 people per room)
  const totalPeople = allPeople.length;
  const maxDutiesPerPerson = Math.ceil(totalPositions / totalPeople);
  const minDutiesPerPerson = Math.max(0, maxDutiesPerPerson - 2); // Set minimum 2 less than max

  // Keep track of previous day assignments to avoid same classroom on consecutive days
  const personAssignments = new Map<string, { day: number, room: number }[]>();
  allPeople.forEach(p => personAssignments.set(p.name, []));

  for (let day = 1; day <= days; day++) {
    // Track assigned people for the current day to avoid duplicates on same day
    const assignedPeopleForDay = new Set<string>();

    // For each room on the current day
    for (let room = 1; room <= rooms; room++) {
      // We'll assign two people to each room, first a faculty member, then any staff/faculty
      let selectedPeople: Person[] = [];

      // Try to fill positions from eligible people pool
      for (let position = 0; position < 2; position++) {
        // Modified: For first position, only select from faculty members
        const candidatePool = position === 0 ? faculty : allPeople;

        // Filter eligible people (not assigned today, not assigned to same room yesterday, not reached max duties)
        const eligiblePeople = candidatePool.filter(p => {
          // Not already selected for this room
          if (selectedPeople.some(selected => selected.name === p.name)) return false;

          // Not assigned today
          if (assignedPeopleForDay.has(p.name)) return false;

          // Not reached max duties
          const currentDuties = dutyCounter.get(p.name)!.count;
          if (currentDuties >= maxDutiesPerPerson) return false;

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

          if (unassignedToday.length > 0) {
            const sortedUnassigned = [...unassignedToday].sort((a, b) =>
              dutyCounter.get(a.name)!.count - dutyCounter.get(b.name)!.count
            );

            selectedPeople.push(sortedUnassigned[0]);
          } else {
            // Last resort: take person with fewest duties
            // For first position, still restrict to faculty members only
            const sortedAll = [...candidatePoolFallback].sort((a, b) =>
              dutyCounter.get(a.name)!.count - dutyCounter.get(b.name)!.count
            );

            // Skip people already selected for this room
            const availablePeople = sortedAll.filter(p =>
              !selectedPeople.some(selected => selected.name === p.name)
            );

            if (availablePeople.length > 0) {
              selectedPeople.push(availablePeople[0]);
            }
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
  }

  // Balance schedule to ensure everyone has at least the minimum number of duties
  balanceSchedule(
    schedule,
    dutyCounter,
    personAssignments,
    maxDutiesPerPerson,
    minDutiesPerPerson,
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

// Helper function to balance the schedule by swapping people
function balanceSchedule(
  schedule: ScheduleEntry[],
  dutyCounter: Map<string, { count: number; type: 'faculty' | 'staff' }>,
  personAssignments: Map<string, { day: number, room: number }[]>,
  maxDutiesPerPerson: number,
  minDutiesPerPerson: number,
  facultyIndices: Map<string, number>,
  staffIndices: Map<string, number>
): void {
  // Get all people sorted by duty count (highest to lowest)
  const allPeopleByDuties = Array.from(dutyCounter.entries())
    .sort((a, b) => b[1].count - a[1].count);

  // Calculate average duties
  const totalDuties = allPeopleByDuties.reduce((sum, [_, data]) => sum + data.count, 0);
  const averageDuties = totalDuties / allPeopleByDuties.length;

  // Get overworked and underworked people
  const overworkedPeople = allPeopleByDuties.filter(([_, data]) =>
    data.count > Math.max(averageDuties + 1, maxDutiesPerPerson)
  );

  const underworkedPeople = allPeopleByDuties.filter(([_, data]) =>
    data.count < Math.min(averageDuties - 1, minDutiesPerPerson)
  );

  // Perform swaps to balance (limited to prevent infinite loops)
  const maxSwaps = 100;
  let swapsPerformed = 0;

  // First ensure everyone has at least minDutiesPerPerson duties
  for (const [underworkedName, underworkedData] of underworkedPeople) {
    if (swapsPerformed >= maxSwaps) break;

    // Check if this person is below minimum
    if (underworkedData.count < minDutiesPerPerson) {
      const underworkedType = underworkedData.type;
      let neededDuties = minDutiesPerPerson - underworkedData.count;

      // Try to find people who can give up duties
      for (const [overworkedName] of overworkedPeople) {
        if (swapsPerformed >= maxSwaps || neededDuties <= 0) break;

        // Find entries where overworked person is assigned
        // Check both faculty and staff positions
        const entriesWithOverworked = schedule.filter(entry =>
          entry.faculty.name === overworkedName || entry.staff.name === overworkedName
        );

        for (const entry of entriesWithOverworked) {
          if (swapsPerformed >= maxSwaps || neededDuties <= 0) break;

          // Determine if overworked person is in faculty or staff position
          let isOverworkedFaculty = entry.faculty.name === overworkedName;

          // Check if underworked person can be assigned here
          const underworkedAssignments = personAssignments.get(underworkedName) || [];

          // Check if underworked is not already assigned on this day
          const isAssignedOnDay = schedule.some(e =>
            e.day === entry.day && (e.faculty.name === underworkedName || e.staff.name === underworkedName)
          );

          // Check if underworked was not in same room on previous day
          const wasInSameRoomYesterday = underworkedAssignments.some(a =>
            a.day === entry.day - 1 && a.room === entry.room
          );

          // Only swap if we maintain the faculty requirement (non-faculty can't replace faculty)
          const canReplaceOverworked = !isOverworkedFaculty || underworkedType === 'faculty';

          if (!isAssignedOnDay && !wasInSameRoomYesterday && canReplaceOverworked) {
            // Perform swap
            if (isOverworkedFaculty) {
              entry.faculty = { name: underworkedName, type: underworkedType };
            } else {
              entry.staff = { name: underworkedName, type: underworkedType };
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
            neededDuties--;

            // Re-check seniority after the swap - make sure the order is correct
            enforcePositionBySeniority(entry, facultyIndices, staffIndices, dutyCounter);
          }
        }
      }
    }
  }

  // Then try to balance overall to get closer to average
  // Recalculate overworked and underworked after first balancing phase
  const updatedPeopleByDuties = Array.from(dutyCounter.entries())
    .sort((a, b) => b[1].count - a[1].count);

  const updatedOverworked = updatedPeopleByDuties.filter(([_, data]) =>
    data.count > averageDuties + 1 && data.count > minDutiesPerPerson + 1
  );

  const updatedUnderworked = updatedPeopleByDuties.filter(([_, data]) =>
    data.count < averageDuties - 1
  );

  // Perform additional balancing swaps
  for (const [overworkedName] of updatedOverworked) {
    if (swapsPerformed >= maxSwaps) break;

    for (const [underworkedName, underworkedData] of updatedUnderworked) {
      if (swapsPerformed >= maxSwaps) break;

      const underworkedType = underworkedData.type;

      // Find entries where overworked person is assigned
      const entriesWithOverworked = schedule.filter(entry =>
        entry.faculty.name === overworkedName || entry.staff.name === overworkedName
      );

      for (const entry of entriesWithOverworked) {
        if (swapsPerformed >= maxSwaps) break;

        // Determine if overworked person is in faculty or staff position
        let isOverworkedFaculty = entry.faculty.name === overworkedName;

        // Check if underworked person can be assigned here
        const underworkedAssignments = personAssignments.get(underworkedName) || [];

        // Check if underworked is not already assigned on this day
        const isAssignedOnDay = schedule.some(e =>
          e.day === entry.day && (e.faculty.name === underworkedName || e.staff.name === underworkedName)
        );

        // Check if underworked was not in same room on previous day
        const wasInSameRoomYesterday = underworkedAssignments.some(a =>
          a.day === entry.day - 1 && a.room === entry.room
        );

        // Only swap if we maintain the faculty requirement (non-faculty can't replace faculty)
        const canReplaceOverworked = !isOverworkedFaculty || underworkedType === 'faculty';

        if (!isAssignedOnDay && !wasInSameRoomYesterday && canReplaceOverworked) {
          // Perform swap
          if (isOverworkedFaculty) {
            entry.faculty = { name: underworkedName, type: underworkedType };
          } else {
            entry.staff = { name: underworkedName, type: underworkedType };
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

          // Re-check seniority after the swap - make sure the order is correct
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
