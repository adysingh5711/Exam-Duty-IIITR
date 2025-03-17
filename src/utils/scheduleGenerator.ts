import { Person, Schedule, ScheduleEntry, DutyCount } from '../types';

export function generateSchedule(faculty: Person[], staff: Person[]): Schedule {
  const days = 6;
  const rooms = 11;
  const schedule: ScheduleEntry[] = [];
  const dutyCounter = new Map<string, { count: number; type: 'faculty' | 'staff' }>();

  // Staff duty target is exactly (days-1) per person
  const staffDutyTarget = days - 1;

  // Calculate minimum staff assignments needed per day
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

  // STEP 1: CALCULATE FACULTY DUTY DISTRIBUTION WITH PRECISION
  const totalPositions = days * rooms * 2;
  const totalStaffDuties = staff.length * staffDutyTarget;
  const remainingDutiesForFaculty = totalPositions - totalStaffDuties;

  // Calculate exact duties per faculty 
  const avgDutiesPerFaculty = remainingDutiesForFaculty / faculty.length;
  const minPossibleDuties = Math.floor(avgDutiesPerFaculty);
  const maxPossibleDuties = Math.ceil(avgDutiesPerFaculty);

  // Calculate exactly how many faculty get min vs max duties
  const facultyWithMaxDuties = remainingDutiesForFaculty - (minPossibleDuties * faculty.length);
  const facultyWithMinDuties = faculty.length - facultyWithMaxDuties;

  console.log(`Faculty duty distribution:`);
  console.log(`- ${facultyWithMinDuties} senior faculty will get ${minPossibleDuties} duties`);
  console.log(`- ${facultyWithMaxDuties} junior faculty will get ${maxPossibleDuties} duties`);

  // Sort faculty by seniority (lower index = higher seniority)
  const facultyBySeniority = [...faculty].sort((a, b) =>
    facultyIndices.get(a.name)! - facultyIndices.get(b.name)!
  );

  // Create a map for target duty counts and a set for tracking who's reached their quota
  const facultyDutyTargets = new Map<string, number>();
  const facultyReachedQuota = new Set<string>();

  // Track which faculty are senior (get min duties)
  const seniorFacultySet = new Set<string>();

  // Assign targets based on seniority - most senior get min duties
  facultyBySeniority.forEach((f, index) => {
    if (index < facultyWithMinDuties) {
      facultyDutyTargets.set(f.name, minPossibleDuties);
      seniorFacultySet.add(f.name); // Mark as senior faculty
      console.log(`${f.name} (senior #${index + 1}): Target = ${minPossibleDuties} duties`);
    } else {
      facultyDutyTargets.set(f.name, maxPossibleDuties);
      console.log(`${f.name} (junior #${index - facultyWithMinDuties + 1}): Target = ${maxPossibleDuties} duties`);
    }
  });

  // Keep track of previous day assignments to avoid same classroom on consecutive days
  const personAssignments = new Map<string, { day: number, room: number }[]>();
  allPeople.forEach(p => personAssignments.set(p.name, []));

  // Track forced assignments that might cause senior faculty to exceed targets
  const forcedExcessAssignments = new Map<string, number>();

  // Main schedule generation loop
  for (let day = 1; day <= days; day++) {
    // Track assigned people for the current day to avoid duplicates
    const assignedPeopleForDay = new Set<string>();

    // Count staff assignments for this day
    let staffAssignmentsForDay = 0;

    // For each room on the current day
    for (let room = 1; room <= rooms; room++) {
      // We'll assign two people to each room
      let selectedPeople: Person[] = [];

      // Calculate remaining rooms and staff needed
      const remainingRooms = rooms - room + 1;
      const staffAssignmentsNeededForDay = Math.max(0, minStaffAssignmentsPerDay - staffAssignmentsForDay);
      const forceStaffAssignment = remainingRooms <= staffAssignmentsNeededForDay;

      // Fill each position (faculty and staff)
      for (let position = 0; position < 2; position++) {
        // For faculty position, select only from faculty
        // For staff position, select from all people, with preference for staff when needed
        let candidatePool = position === 0 ? faculty : allPeople;

        // For second position, prioritize staff if we're behind on assignments
        if ((position === 1 && staffAssignmentsForDay < minStaffAssignmentsPerDay) ||
          (forceStaffAssignment && position === 1)) {

          // Get eligible staff who haven't reached their quota
          const eligibleStaff = staff.filter(p => {
            // Not already selected for this room
            if (selectedPeople.some(selected => selected.name === p.name)) return false;

            // Not assigned today
            if (assignedPeopleForDay.has(p.name)) return false;

            // Not reached staff duty target
            if (dutyCounter.get(p.name)!.count >= staffDutyTarget) return false;

            // Not in same room yesterday
            const assignments = personAssignments.get(p.name) || [];
            if (assignments.some(a => a.day === day - 1 && a.room === room)) return false;

            return true;
          });

          if (eligibleStaff.length > 0) {
            candidatePool = eligibleStaff;
          }
        }

        // Filter eligible people from candidate pool
        let eligiblePeople = candidatePool.filter(p => {
          // Not already selected for this room
          if (selectedPeople.some(selected => selected.name === p.name)) return false;

          // Not assigned today
          if (assignedPeopleForDay.has(p.name)) return false;

          // Check duty constraints
          const currentDuties = dutyCounter.get(p.name)!.count;
          const personType = dutyCounter.get(p.name)!.type;

          // For staff: don't exceed staffDutyTarget
          if (personType === 'staff' && currentDuties >= staffDutyTarget) return false;

          // For faculty: strictly don't exceed their target
          if (personType === 'faculty') {
            // Skip if already reached quota
            if (facultyReachedQuota.has(p.name)) return false;

            const target = facultyDutyTargets.get(p.name)!;
            if (currentDuties >= target) return false;
          }

          // Not in same room yesterday
          const assignments = personAssignments.get(p.name) || [];
          if (assignments.some(a => a.day === day - 1 && a.room === room)) return false;

          return true;
        });

        // If we have eligible people, select one based on priorities
        if (eligiblePeople.length > 0) {
          let selectedPerson: Person;

          // For faculty selection (first position or eligible faculty in second)
          if (position === 0 || eligiblePeople.some(p => dutyCounter.get(p.name)!.type === 'faculty')) {
            // Filter only faculty if available
            const eligibleFaculty = eligiblePeople.filter(p =>
              dutyCounter.get(p.name)!.type === 'faculty'
            );

            if (eligibleFaculty.length > 0) {
              // Sort faculty by:
              // 1. Whether they are senior (prioritize junior faculty first for additional duties)
              // 2. How far they are from their target 
              // 3. Seniority (when all else is equal)
              const sortedFaculty = [...eligibleFaculty].sort((a, b) => {
                // First prioritize by senior vs junior status
                const aIsSenior = seniorFacultySet.has(a.name);
                const bIsSenior = seniorFacultySet.has(b.name);

                if (aIsSenior !== bIsSenior) {
                  return aIsSenior ? 1 : -1; // Junior faculty first
                }

                // Same status, now check distance from target
                const aCurrentDuties = dutyCounter.get(a.name)!.count;
                const bCurrentDuties = dutyCounter.get(b.name)!.count;

                const aTarget = facultyDutyTargets.get(a.name)!;
                const bTarget = facultyDutyTargets.get(b.name)!;

                const aDistance = aTarget - aCurrentDuties;
                const bDistance = bTarget - bCurrentDuties;

                // Sort by remaining duties (higher = higher priority)
                if (aDistance !== bDistance) {
                  return bDistance - aDistance;
                }

                // When distance is equal, prioritize by seniority
                return facultyIndices.get(a.name)! - facultyIndices.get(b.name)!;
              });

              selectedPerson = sortedFaculty[0];
            } else {
              // No eligible faculty, sort staff by duty count
              const sortedStaff = [...eligiblePeople].sort((a, b) =>
                dutyCounter.get(a.name)!.count - dutyCounter.get(b.name)!.count
              );

              selectedPerson = sortedStaff[0];
            }
          } else {
            // For pure staff selection, sort by duty count
            const sortedEligible = [...eligiblePeople].sort((a, b) =>
              dutyCounter.get(a.name)!.count - dutyCounter.get(b.name)!.count
            );

            selectedPerson = sortedEligible[0];
          }

          selectedPeople.push(selectedPerson);
        } else {
          // No eligible people - we need to relax some constraints

          // Start with anyone not assigned today
          const candidatePoolFallback = position === 0 ? faculty : allPeople;
          const unassignedToday = candidatePoolFallback.filter(p =>
            !assignedPeopleForDay.has(p.name) &&
            !selectedPeople.some(selected => selected.name === p.name)
          );

          // Additional filter for staff who haven't reached quota
          const filteredPool = position === 1
            ? unassignedToday.filter(p =>
              dutyCounter.get(p.name)!.type !== 'staff' ||
              dutyCounter.get(p.name)!.count < staffDutyTarget
            )
            : unassignedToday;

          if (filteredPool.length > 0) {
            // For faculty positions, prioritize by target and seniority 
            if (position === 0) {
              // Sort faculty by seniority status, then distance from target
              const sortedFaculty = [...filteredPool].sort((a, b) => {
                // First prioritize junior faculty over senior faculty
                const aIsSenior = seniorFacultySet.has(a.name);
                const bIsSenior = seniorFacultySet.has(b.name);

                if (aIsSenior !== bIsSenior) {
                  return aIsSenior ? 1 : -1; // Junior faculty first
                }

                // Same status, now check distance from target
                const aExcess = dutyCounter.get(a.name)!.count - facultyDutyTargets.get(a.name)!;
                const bExcess = dutyCounter.get(b.name)!.count - facultyDutyTargets.get(b.name)!;

                // Lower excess (or higher deficit) first
                if (aExcess !== bExcess) {
                  return aExcess - bExcess;
                }

                // When excess is equal, prefer senior faculty
                return facultyIndices.get(a.name)! - facultyIndices.get(b.name)!;
              });

              selectedPeople.push(sortedFaculty[0]);
            } else {
              // For staff position, prioritize staff with fewest duties
              const sortedPool = [...filteredPool].sort((a, b) =>
                dutyCounter.get(a.name)!.count - dutyCounter.get(b.name)!.count
              );

              selectedPeople.push(sortedPool[0]);
            }
          } else {
            // Last resort: use anyone available, but prioritize non-senior faculty
            let availablePeople = candidatePoolFallback.filter(p =>
              !assignedPeopleForDay.has(p.name) &&
              !selectedPeople.some(selected => selected.name === p.name)
            );

            // For staff position, still filter out staff at max duties
            if (position === 1) {
              availablePeople = availablePeople.filter(p =>
                dutyCounter.get(p.name)!.type !== 'staff' ||
                dutyCounter.get(p.name)!.count < staffDutyTarget
              );
            }

            if (availablePeople.length > 0) {
              const sortedAvailable = [...availablePeople].sort((a, b) => {
                // For faculty, prioritize non-senior faculty that are at or below target
                if (dutyCounter.get(a.name)!.type === 'faculty' &&
                  dutyCounter.get(b.name)!.type === 'faculty') {

                  // NEVER select senior faculty who are at or above target
                  // This is a hard constraint that must be enforced
                  const aIsSenior = seniorFacultySet.has(a.name);
                  const bIsSenior = seniorFacultySet.has(b.name);
                  const aAtOrAboveTarget = aIsSenior && dutyCounter.get(a.name)!.count >= facultyDutyTargets.get(a.name)!;
                  const bAtOrAboveTarget = bIsSenior && dutyCounter.get(b.name)!.count >= facultyDutyTargets.get(b.name)!;

                  if (aAtOrAboveTarget !== bAtOrAboveTarget) {
                    return aAtOrAboveTarget ? 1 : -1; // Always choose faculty not at target
                  }

                  // Only then consider senior/junior status
                  if (aIsSenior !== bIsSenior) {
                    return aIsSenior ? 1 : -1; // Prefer junior faculty
                  }

                  // Both same category, prioritize by duty count relative to target
                  const aExcess = dutyCounter.get(a.name)!.count - facultyDutyTargets.get(a.name)!;
                  const bExcess = dutyCounter.get(b.name)!.count - facultyDutyTargets.get(b.name)!;

                  if (aExcess !== bExcess) {
                    return aExcess - bExcess; // Lower excess first
                  }

                  // If both have same excess, sort by seniority
                  return facultyIndices.get(a.name)! - facultyIndices.get(b.name)!;
                }

                // Otherwise sort by duty count
                return dutyCounter.get(a.name)!.count - dutyCounter.get(b.name)!.count;
              });

              const selectedPerson = sortedAvailable[0];

              // NEVER assign a senior faculty who is already at target in a faculty position
              // This is critically important - only do this as an absolute last resort
              if (position === 0 &&
                dutyCounter.get(selectedPerson.name)!.type === 'faculty' &&
                seniorFacultySet.has(selectedPerson.name) &&
                dutyCounter.get(selectedPerson.name)!.count >= facultyDutyTargets.get(selectedPerson.name)!) {

                // Try to find ANY junior faculty who is available instead
                const anyJuniorFaculty = availablePeople.find(p =>
                  dutyCounter.get(p.name)!.type === 'faculty' &&
                  !seniorFacultySet.has(p.name)
                );

                if (anyJuniorFaculty) {
                  // Use junior faculty instead, even if they're at their target
                  console.log(`🔄 Substituting junior faculty ${anyJuniorFaculty.name} to protect senior faculty ${selectedPerson.name}`);
                  const updatedPerson = anyJuniorFaculty;
                  selectedPeople[selectedPeople.length - 1] = updatedPerson;
                } else {
                  // We have no choice but to use senior faculty  
                  const forced = forcedExcessAssignments.get(selectedPerson.name) || 0;
                  forcedExcessAssignments.set(selectedPerson.name, forced + 1);
                  console.log(`⚠️ WARNING: FORCED assignment of senior faculty ${selectedPerson.name} beyond target on day ${day}, room ${room}. No alternatives available.`);
                }
              }

              selectedPeople.push(selectedPerson);
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
        // Arrange by faculty/staff and seniority
        const person1 = selectedPeople[0];
        const person2 = selectedPeople[1];

        // Get the types of the two people
        const type1 = dutyCounter.get(person1.name)!.type;
        const type2 = dutyCounter.get(person2.name)!.type;

        // Determine who goes in faculty vs staff position
        let faculty, staff;

        if (type1 === 'faculty' && type2 === 'faculty') {
          // Both are faculty, sort by seniority
          const idx1 = facultyIndices.get(person1.name)!;
          const idx2 = facultyIndices.get(person2.name)!;

          faculty = idx1 < idx2 ? person1 : person2;
          staff = idx1 < idx2 ? person2 : person1;
        } else if (type1 === 'staff' && type2 === 'staff') {
          // Both are staff, sort by seniority
          const idx1 = staffIndices.get(person1.name)!;
          const idx2 = staffIndices.get(person2.name)!;

          faculty = idx1 < idx2 ? person1 : person2;
          staff = idx1 < idx2 ? person2 : person1;
        } else {
          // Mixed types - faculty goes in faculty position
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

          // Check if faculty has reached quota and update tracker
          if (dutyCounter.get(person.name)!.type === 'faculty') {
            const target = facultyDutyTargets.get(person.name)!;
            if (dutyCounter.get(person.name)!.count >= target) {
              facultyReachedQuota.add(person.name);
            }
          }
        });

        // Add to schedule
        schedule.push({
          faculty,
          staff,
          room,
          day
        });
      }
    }

    // Before moving to next day, ensure staff quota is met - but protect senior faculty
    if (staffAssignmentsForDay < minStaffAssignmentsPerDay) {
      // Find entries for this day where faculty is in staff position, prioritizing junior faculty
      const entriesForDay = schedule.filter(entry =>
        entry.day === day &&
        dutyCounter.get(entry.staff.name)!.type === 'faculty'
      );

      // Sort entries - prioritize junior faculty first to avoid swapping senior faculty
      entriesForDay.sort((a, b) => {
        const aIsSenior = seniorFacultySet.has(a.staff.name);
        const bIsSenior = seniorFacultySet.has(b.staff.name);

        if (aIsSenior !== bIsSenior) {
          return aIsSenior ? 1 : -1; // Junior faculty first for swapping
        }

        // If both same seniority category, sort by room for consistency
        return a.room - b.room;
      });

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

        const staffToAssign = eligibleStaff.shift();
        if (staffToAssign) {
          // Get faculty being replaced
          const facultyName = entry.staff.name;

          // Log if this was a senior faculty that's being swapped out
          if (seniorFacultySet.has(facultyName)) {
            console.log(`✅ GOOD SWAP: Removing senior faculty ${facultyName} from staff position on day ${day}, room ${entry.room}`);
          }

          // Decrement faculty duty count
          dutyCounter.get(facultyName)!.count--;

          // Remove from faculty reached quota if applicable
          if (facultyReachedQuota.has(facultyName) &&
            dutyCounter.get(facultyName)!.count < facultyDutyTargets.get(facultyName)!) {
            facultyReachedQuota.delete(facultyName);
          }

          // Remove from assignments
          const facultyAssignments = personAssignments.get(facultyName)!;
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

  // Verify all staff have exactly staffDutyTarget duties
  function validateStaffDuties(): boolean {
    let changes = false;

    // Check which staff have incorrect duty counts
    const staffEntries = Array.from(dutyCounter.entries())
      .filter(([_, data]) => data.type === 'staff');

    const underworkedStaff = staffEntries.filter(([_, data]) => data.count < staffDutyTarget);
    const overworkedStaff = staffEntries.filter(([_, data]) => data.count > staffDutyTarget);

    if (underworkedStaff.length === 0 && overworkedStaff.length === 0) {
      return false; // All staff have correct duty count
    }

    console.log(`Staff duty validation needed: ${underworkedStaff.length} under, ${overworkedStaff.length} over`);

    // Fix underworked staff by swapping with faculty - but prioritize junior faculty
    for (const [staffName, staffData] of underworkedStaff) {
      let neededDuties = staffDutyTarget - staffData.count;
      console.log(`${staffName} needs ${neededDuties} more duties`);

      // Find faculty candidates for swapping - PRIORITIZE JUNIOR FACULTY
      const facultyCandidates = Array.from(dutyCounter.entries())
        .filter(([name, data]) => {
          return data.type === 'faculty' &&
            dutyCounter.get(name)!.count > 0;
        })
        .sort((a, b) => {
          // First prioritize by seniority category
          const aIsSenior = seniorFacultySet.has(a[0]);
          const bIsSenior = seniorFacultySet.has(b[0]);

          if (aIsSenior !== bIsSenior) {
            return aIsSenior ? 1 : -1; // Junior faculty first
          }

          // Then check who is furthest above their target
          const aExcess = a[1].count - facultyDutyTargets.get(a[0])!;
          const bExcess = b[1].count - facultyDutyTargets.get(b[0])!;

          if (aExcess !== bExcess) {
            return bExcess - aExcess; // Higher excess first
          }

          // When excess is equal, prefer junior faculty
          return facultyIndices.get(b[0])! - facultyIndices.get(a[0])!;
        });

      // Try to swap with each faculty candidate
      for (const [facultyName, _] of facultyCandidates) {
        if (neededDuties <= 0) break;

        // Don't swap with senior faculty unless they're above their target
        if (seniorFacultySet.has(facultyName) &&
          dutyCounter.get(facultyName)!.count <= facultyDutyTargets.get(facultyName)!) {
          // Skip this faculty - they are senior and at/below target
          console.log(`Skipping senior faculty ${facultyName} who is at/below target`);
          continue;
        }

        // Find days where faculty has duty but staff doesn't
        const facultyDays = new Set(
          schedule.filter(entry =>
            (entry.faculty.name === facultyName || entry.staff.name === facultyName)
          ).map(entry => entry.day)
        );

        const staffDays = new Set(
          schedule.filter(entry =>
            (entry.faculty.name === staffName || entry.staff.name === staffName)
          ).map(entry => entry.day)
        );

        // Find available days for swap
        const availableDays = [...facultyDays].filter(day => !staffDays.has(day));

        for (const day of availableDays) {
          if (neededDuties <= 0) break;

          // Find entries where faculty is in staff position
          const entriesForSwap = schedule.filter(entry =>
            entry.day === day &&
            entry.staff.name === facultyName
          );

          if (entriesForSwap.length > 0) {
            const entry = entriesForSwap[0];

            // Perform swap
            entry.staff = { name: staffName, type: 'staff' };

            // Update counts
            dutyCounter.get(facultyName)!.count--;
            dutyCounter.get(staffName)!.count++;

            // Update faculty quota status
            if (dutyCounter.get(facultyName)!.count < facultyDutyTargets.get(facultyName)!) {
              facultyReachedQuota.delete(facultyName);
            }

            // Update assignments
            const facultyAssignments = personAssignments.get(facultyName)!;
            const indexToRemove = facultyAssignments.findIndex(a =>
              a.day === day && a.room === entry.room
            );

            if (indexToRemove !== -1) {
              facultyAssignments.splice(indexToRemove, 1);
            }

            personAssignments.get(staffName)!.push({ day, room: entry.room });

            changes = true;
            neededDuties--;

            console.log(`Swapped ${facultyName} with ${staffName} on day ${day}, room ${entry.room}`);
          }
        }
      }
    }

    // Fix overworked staff by swapping with faculty - but protect senior faculty
    for (const [staffName, staffData] of overworkedStaff) {
      let excessDuties = staffData.count - staffDutyTarget;
      console.log(`${staffName} has ${excessDuties} excess duties`);

      // Find faculty candidates for swapping - AVOID SENIOR FACULTY WHO ARE AT TARGET
      const facultyCandidates = Array.from(dutyCounter.entries())
        .filter(([name, data]) => {
          return data.type === 'faculty' &&
            dutyCounter.get(name)!.count < facultyDutyTargets.get(name)!;
        })
        .sort((a, b) => {
          // Prefer junior faculty first
          const aIsSenior = seniorFacultySet.has(a[0]);
          const bIsSenior = seniorFacultySet.has(b[0]);

          if (aIsSenior !== bIsSenior) {
            return aIsSenior ? 1 : -1; // Junior faculty first
          }

          // Then go by how far they are from target
          const aDeficit = facultyDutyTargets.get(a[0])! - a[1].count;
          const bDeficit = facultyDutyTargets.get(b[0])! - b[1].count;

          if (aDeficit !== bDeficit) {
            return bDeficit - aDeficit; // Higher deficit first
          }

          // When deficit is equal, prefer junior faculty
          return facultyIndices.get(b[0])! - facultyIndices.get(a[0])!;
        });

      // Try to find entries with overworked staff that can be swapped
      for (const [facultyName, _] of facultyCandidates) {
        if (excessDuties <= 0) break;

        // Find entries where staff is assigned
        const entriesWithStaff = schedule.filter(entry =>
          entry.staff.name === staffName
        );

        for (const entry of entriesWithStaff) {
          if (excessDuties <= 0) break;

          // Check if faculty can be assigned here
          // Check if faculty is not already assigned on this day
          const isAssignedOnDay = schedule.some(e =>
            e.day === entry.day && (e.faculty.name === facultyName || e.staff.name === facultyName)
          );

          if (isAssignedOnDay) continue;

          // Check if faculty was not in same room yesterday
          const facultyAssignments = personAssignments.get(facultyName) || [];
          const wasInSameRoomYesterday = facultyAssignments.some(a =>
            a.day === entry.day - 1 && a.room === entry.room
          );

          if (wasInSameRoomYesterday) continue;

          // Perform swap
          entry.staff = { name: facultyName, type: 'faculty' };

          // Update counts
          dutyCounter.get(staffName)!.count--;
          dutyCounter.get(facultyName)!.count++;

          // Update faculty quota status
          if (dutyCounter.get(facultyName)!.count >= facultyDutyTargets.get(facultyName)!) {
            facultyReachedQuota.add(facultyName);
          }

          // Update assignments
          const staffAssignments = personAssignments.get(staffName)!;
          const indexToRemove = staffAssignments.findIndex(a =>
            a.day === entry.day && a.room === entry.room
          );

          if (indexToRemove !== -1) {
            staffAssignments.splice(indexToRemove, 1);
          }

          personAssignments.get(facultyName)!.push({ day: entry.day, room: entry.room });

          changes = true;
          excessDuties--;

          console.log(`Swapped ${staffName} with ${facultyName} on day ${entry.day}, room ${entry.room}`);
        }
      }
    }

    return changes;
  }

  // Update the senior faculty duty balancing function
  function fixSeniorFacultyOverassignment(): boolean {
    let changes = false;

    // Find senior faculty who exceed their target
    const seniorFacultyViolations = facultyBySeniority
      .filter(f => seniorFacultySet.has(f.name) &&
        dutyCounter.get(f.name)!.count > facultyDutyTargets.get(f.name)!)
      .sort((a, b) => {
        // Sort by excess duties (highest first)
        const aExcess = dutyCounter.get(a.name)!.count - facultyDutyTargets.get(a.name)!;
        const bExcess = dutyCounter.get(b.name)!.count - facultyDutyTargets.get(b.name)!;

        if (aExcess !== bExcess) {
          return bExcess - aExcess;
        }

        // Then by seniority (highest first)
        return facultyIndices.get(a.name)! - facultyIndices.get(b.name)!;
      });

    if (seniorFacultyViolations.length === 0) {
      return false;
    }

    console.log(`\n🚨 Found ${seniorFacultyViolations.length} senior faculty with too many duties:`);
    seniorFacultyViolations.forEach(f => {
      const actual = dutyCounter.get(f.name)!.count;
      const target = facultyDutyTargets.get(f.name)!;
      console.log(`${f.name}: ${actual} duties (target: ${target})`);
    });

    // Try increasingly aggressive measures to fix the violations
    // First try finding junior faculty below target
    if (!trySwapWithJuniorFacultyBelowTarget(seniorFacultyViolations)) {
      // If that doesn't work, try any junior faculty
      if (!trySwapWithAnyJuniorFaculty(seniorFacultyViolations)) {
        // If all else fails, try drastic measures
        tryDrasticSwaps(seniorFacultyViolations);
      }
    }

    return changes;

    // Helper for trying to swap with junior faculty below target
    function trySwapWithJuniorFacultyBelowTarget(violations: Person[]): boolean {
      let subChanges = false;

      // Find junior faculty below target
      const juniorFacultyBelowTarget = facultyBySeniority
        .filter(f => !seniorFacultySet.has(f.name) &&
          dutyCounter.get(f.name)!.count < facultyDutyTargets.get(f.name)!)
        .sort((a, b) => {
          // Sort by deficit (highest first)
          const aDeficit = facultyDutyTargets.get(a.name)! - dutyCounter.get(a.name)!.count;
          const bDeficit = facultyDutyTargets.get(b.name)! - dutyCounter.get(b.name)!.count;

          if (aDeficit !== bDeficit) {
            return bDeficit - aDeficit;
          }

          // Then by seniority (least senior first)
          return facultyIndices.get(b.name)! - facultyIndices.get(a.name)!;
        });

      for (const senior of violations) {
        const seniorName = senior.name;
        let excessDuties = dutyCounter.get(seniorName)!.count - facultyDutyTargets.get(seniorName)!;

        console.log(`Trying to fix ${seniorName} (${excessDuties} excess duties)`);

        for (const junior of juniorFacultyBelowTarget) {
          if (excessDuties <= 0) break;

          const juniorName = junior.name;
          const juniorDeficit = facultyDutyTargets.get(juniorName)! - dutyCounter.get(juniorName)!.count;

          if (juniorDeficit <= 0) continue;

          console.log(`  Trying to swap with junior ${juniorName} (deficit: ${juniorDeficit})`);

          // Find assignments of the senior faculty
          const seniorEntries = schedule.filter(entry =>
            entry.faculty.name === seniorName || entry.staff.name === seniorName
          );

          for (const entry of seniorEntries) {
            if (excessDuties <= 0 || juniorDeficit <= 0) break;

            // Check if junior is already assigned on this day
            const isJuniorAssignedOnDay = schedule.some(e =>
              e.day === entry.day && (e.faculty.name === juniorName || e.staff.name === juniorName)
            );

            if (isJuniorAssignedOnDay) continue;

            // Check room yesterday constraint
            const juniorAssignments = personAssignments.get(juniorName) || [];
            const wasInSameRoomYesterday = juniorAssignments.some(a =>
              a.day === entry.day - 1 && a.room === entry.room
            );

            if (wasInSameRoomYesterday) continue;

            // Perform swap
            if (entry.faculty.name === seniorName) {
              entry.faculty = { name: juniorName, type: 'faculty' };
            } else {
              entry.staff = { name: juniorName, type: 'faculty' };
            }

            // Update counts
            dutyCounter.get(seniorName)!.count--;
            dutyCounter.get(juniorName)!.count++;

            // Update quota status
            if (dutyCounter.get(seniorName)!.count < facultyDutyTargets.get(seniorName)!) {
              facultyReachedQuota.delete(seniorName);
            }

            if (dutyCounter.get(juniorName)!.count >= facultyDutyTargets.get(juniorName)!) {
              facultyReachedQuota.add(juniorName);
            }

            // Update assignments
            const seniorAssignments = personAssignments.get(seniorName)!;
            const indexToRemove = seniorAssignments.findIndex(a =>
              a.day === entry.day && a.room === entry.room
            );

            if (indexToRemove !== -1) {
              seniorAssignments.splice(indexToRemove, 1);
            }

            juniorAssignments.push({ day: entry.day, room: entry.room });

            changes = true;
            subChanges = true;
            excessDuties--;

            console.log(`  ✅ Swapped ${seniorName} with ${juniorName} on day ${entry.day}, room ${entry.room}`);
          }
        }
      }

      return subChanges;
    }

    // Helper for trying to swap with any junior faculty
    function trySwapWithAnyJuniorFaculty(violations: Person[]): boolean {
      let subChanges = false;

      // Find all junior faculty
      const juniorFaculty = facultyBySeniority
        .filter(f => !seniorFacultySet.has(f.name))
        .sort((a, b) => {
          // Sort by current duty count (lowest first)
          const aDuties = dutyCounter.get(a.name)!.count;
          const bDuties = dutyCounter.get(b.name)!.count;

          if (aDuties !== bDuties) {
            return aDuties - bDuties;
          }

          // Then by seniority (least senior first)
          return facultyIndices.get(b.name)! - facultyIndices.get(a.name)!;
        });

      for (const senior of violations) {
        const seniorName = senior.name;
        let excessDuties = dutyCounter.get(seniorName)!.count - facultyDutyTargets.get(seniorName)!;

        console.log(`Trying more aggressively to fix ${seniorName} (${excessDuties} excess duties)`);

        for (const junior of juniorFaculty) {
          if (excessDuties <= 0) break;

          const juniorName = junior.name;

          console.log(`  Trying to swap with any junior ${juniorName}`);

          // Find assignments of the senior faculty
          const seniorEntries = schedule.filter(entry =>
            entry.faculty.name === seniorName || entry.staff.name === seniorName
          );

          for (const entry of seniorEntries) {
            if (excessDuties <= 0) break;

            // Check if junior is already assigned on this day
            const isJuniorAssignedOnDay = schedule.some(e =>
              e.day === entry.day && (e.faculty.name === juniorName || e.staff.name === juniorName)
            );

            if (isJuniorAssignedOnDay) continue;

            // Check room yesterday constraint
            const juniorAssignments = personAssignments.get(juniorName) || [];
            const wasInSameRoomYesterday = juniorAssignments.some(a =>
              a.day === entry.day - 1 && a.room === entry.room
            );

            if (wasInSameRoomYesterday) continue;

            // Perform swap
            if (entry.faculty.name === seniorName) {
              entry.faculty = { name: juniorName, type: 'faculty' };
            } else {
              entry.staff = { name: juniorName, type: 'faculty' };
            }

            // Update counts
            dutyCounter.get(seniorName)!.count--;
            dutyCounter.get(juniorName)!.count++;

            // Update quota status
            if (dutyCounter.get(seniorName)!.count < facultyDutyTargets.get(seniorName)!) {
              facultyReachedQuota.delete(seniorName);
            }

            if (dutyCounter.get(juniorName)!.count >= facultyDutyTargets.get(juniorName)!) {
              facultyReachedQuota.add(juniorName);
            }

            // Update assignments
            const seniorAssignments = personAssignments.get(seniorName)!;
            const indexToRemove = seniorAssignments.findIndex(a =>
              a.day === entry.day && a.room === entry.room
            );

            if (indexToRemove !== -1) {
              seniorAssignments.splice(indexToRemove, 1);
            }

            juniorAssignments.push({ day: entry.day, room: entry.room });

            changes = true;
            subChanges = true;
            excessDuties--;

            console.log(`  ✅ Aggressively swapped ${seniorName} with ${juniorName} on day ${entry.day}, room ${entry.room}`);
          }
        }
      }

      return subChanges;
    }

    // Helper for truly desperate measures - relax room constraints if needed
    function tryDrasticSwaps(violations: Person[]): boolean {
      let subChanges = false;

      // Find all junior faculty
      const juniorFaculty = facultyBySeniority
        .filter(f => !seniorFacultySet.has(f.name))
        .sort((a, b) => {
          // Sort by current duty count (lowest first)
          const aDuties = dutyCounter.get(a.name)!.count;
          const bDuties = dutyCounter.get(b.name)!.count;

          if (aDuties !== bDuties) {
            return aDuties - bDuties;
          }

          // Then by seniority (least senior first)
          return facultyIndices.get(b.name)! - facultyIndices.get(a.name)!;
        });

      for (const senior of violations) {
        const seniorName = senior.name;
        let excessDuties = dutyCounter.get(seniorName)!.count - facultyDutyTargets.get(seniorName)!;

        console.log(`DESPERATE MEASURES for ${seniorName} (${excessDuties} excess duties)`);

        for (const junior of juniorFaculty) {
          if (excessDuties <= 0) break;

          const juniorName = junior.name;

          console.log(`  Last resort - trying to swap with ${juniorName}`);

          // Find assignments of the senior faculty
          const seniorEntries = schedule.filter(entry =>
            entry.faculty.name === seniorName || entry.staff.name === seniorName
          );

          for (const entry of seniorEntries) {
            if (excessDuties <= 0) break;

            // Check ONLY if junior is already assigned on this day
            const isJuniorAssignedOnDay = schedule.some(e =>
              e.day === entry.day && (e.faculty.name === juniorName || e.staff.name === juniorName)
            );

            if (isJuniorAssignedOnDay) continue;

            // Perform swap - ignore room constraint as this is our last resort
            if (entry.faculty.name === seniorName) {
              entry.faculty = { name: juniorName, type: 'faculty' };
            } else {
              entry.staff = { name: juniorName, type: 'faculty' };
            }

            // Update counts
            dutyCounter.get(seniorName)!.count--;
            dutyCounter.get(juniorName)!.count++;

            // Update quota status
            if (dutyCounter.get(seniorName)!.count < facultyDutyTargets.get(seniorName)!) {
              facultyReachedQuota.delete(seniorName);
            }

            if (dutyCounter.get(juniorName)!.count >= facultyDutyTargets.get(juniorName)!) {
              facultyReachedQuota.add(juniorName);
            }

            // Update assignments
            const seniorAssignments = personAssignments.get(seniorName)!;
            const indexToRemove = seniorAssignments.findIndex(a =>
              a.day === entry.day && a.room === entry.room
            );

            if (indexToRemove !== -1) {
              seniorAssignments.splice(indexToRemove, 1);
            }

            personAssignments.get(juniorName)!.push({ day: entry.day, room: entry.room });

            changes = true;
            subChanges = true;
            excessDuties--;

            console.log(`  🆘 EMERGENCY swap: ${seniorName} with ${juniorName} on day ${entry.day}, room ${entry.room}`);
          }
        }
      }

      return subChanges;
    }
  }

  // Run validation loops
  console.log("Running staff validation...");
  let staffValidationIterations = 0;
  while (staffValidationIterations < 5) {
    const changes = validateStaffDuties();
    if (!changes) break;
    staffValidationIterations++;
  }

  // Run MULTIPLE rounds of senior faculty fix to ensure constraints are met
  console.log("\nRunning aggressive senior faculty duty balancing...");
  let seniorFixIterations = 0;
  let seniorChanges = true;

  while (seniorChanges && seniorFixIterations < 10) {
    seniorChanges = fixSeniorFacultyOverassignment();
    if (seniorChanges) {
      console.log(`Completed senior faculty balancing pass ${seniorFixIterations + 1}, continuing...`);
    }
    seniorFixIterations++;
  }

  // Verify all senior faculty now have exactly their target number of duties
  const remainingSeniorViolations = facultyBySeniority
    .filter(f => seniorFacultySet.has(f.name) &&
      dutyCounter.get(f.name)!.count > facultyDutyTargets.get(f.name)!);

  if (remainingSeniorViolations.length > 0) {
    console.log("\n⚠️ CRITICAL ERROR: Could not fully fix all senior faculty duties:");
    remainingSeniorViolations.forEach(f => {
      const actual = dutyCounter.get(f.name)!.count;
      const target = facultyDutyTargets.get(f.name)!;
      console.log(`${f.name}: ${actual} duties (target: ${target})`);
    });
  } else {
    console.log("\n✅ SUCCESS: All senior faculty have been assigned exactly their minimum target duties!");
  }

  // Final position seniority check
  schedule.forEach(entry => {
    enforcePositionBySeniority(entry, facultyIndices, staffIndices, dutyCounter);
  });

  // Output final duty counts for verification
  console.log("\nFinal Faculty Duty Counts:");
  facultyBySeniority.forEach(f => {
    const target = facultyDutyTargets.get(f.name);
    const actual = dutyCounter.get(f.name)!.count;
    const seniorityRank = facultyIndices.get(f.name)! + 1;

    console.log(`${f.name}(Rank #${seniorityRank}): ${actual} duties(target: ${target})`);
  });

  console.log("\nFinal Staff Duty Counts:");
  staff.forEach(s => {
    const count = dutyCounter.get(s.name)!.count;
    console.log(`${s.name}: ${count} duties(target: ${staffDutyTarget})`);
  });

  // Create duty count arrays for return
  const facultyDuties: DutyCount[] = facultyBySeniority
    .map(f => ({
      name: f.name,
      count: dutyCounter.get(f.name)!.count
    }));

  const staffDuties: DutyCount[] = Array.from(dutyCounter.entries())
    .filter(([_, data]) => data.type === 'staff')
    .map(([name, data]) => ({ name, count: data.count }))
    .sort((a, b) => b.count - a.count);

  return { entries: schedule, facultyDuties, staffDuties };
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
