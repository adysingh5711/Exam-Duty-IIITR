import { Person, Schedule, ScheduleEntry, DutyCount } from '../types';

export function generateSchedule(faculty: Person[], staff: Person[]): Schedule {
  const days = 6;
  const rooms = 11;
  const schedule: ScheduleEntry[] = [];
  const dutyCounter = new Map<string, { count: number; type: 'faculty' | 'staff' }>();

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
      // We'll assign two people to each room, no restriction on staff/faculty
      let selectedPeople: Person[] = [];

      // Try to fill positions from eligible people pool
      for (let position = 0; position < 2; position++) {
        // Filter eligible people (not assigned today, not assigned to same room yesterday, not reached max duties)
        const eligiblePeople = allPeople.filter(p => {
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
          const unassignedToday = allPeople.filter(p => !assignedPeopleForDay.has(p.name));

          if (unassignedToday.length > 0) {
            const sortedUnassigned = [...unassignedToday].sort((a, b) =>
              dutyCounter.get(a.name)!.count - dutyCounter.get(b.name)!.count
            );

            selectedPeople.push(sortedUnassigned[0]);
          } else {
            // Last resort: take person with fewest duties
            const sortedAll = [...allPeople].sort((a, b) =>
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
        // Mark as assigned for today
        selectedPeople.forEach(person => {
          assignedPeopleForDay.add(person.name);

          // Update assignment history
          personAssignments.get(person.name)!.push({ day, room });

          // Update duty counter
          dutyCounter.get(person.name)!.count++;
        });

        // Add to schedule
        schedule.push({
          faculty: selectedPeople[0], // We're no longer enforcing faculty/staff roles
          staff: selectedPeople[1],   // These property names are kept for compatibility
          room: room,
          day: day
        });
      }
    }
  }

  // Balance schedule to ensure everyone has at least the minimum number of duties
  balanceSchedule(schedule, dutyCounter, personAssignments, maxDutiesPerPerson, minDutiesPerPerson);

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
  minDutiesPerPerson: number
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

          if (!isAssignedOnDay && !wasInSameRoomYesterday) {
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

        if (!isAssignedOnDay && !wasInSameRoomYesterday) {
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
          break;
        }
      }
    }
  }
}
