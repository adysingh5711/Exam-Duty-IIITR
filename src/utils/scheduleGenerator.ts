import { Person, Schedule, ScheduleEntry, DutyCount } from '../types';

export function generateSchedule(faculty: Person[], staff: Person[]): Schedule {
  const days = 6;
  const rooms = 11;
  const schedule: ScheduleEntry[] = [];
  const dutyCounter = new Map<string, { count: number; type: 'faculty' | 'staff' }>();

  // Initialize duty counter
  faculty.forEach(f => dutyCounter.set(f.name, { count: 0, type: 'faculty' }));
  staff.forEach(s => dutyCounter.set(s.name, { count: 0, type: 'staff' }));

  for (let day = 1; day <= days; day++) {
    // Reset available people for each day
    let availableFaculty = [...faculty];
    let availableStaff = [...staff];

    // Fill all 12 rooms for the current day
    for (let room = 1; room <= rooms; room++) {
      // If we run out of faculty or staff, reset the available pool
      if (availableFaculty.length === 0) {
        availableFaculty = [...faculty];
      }
      if (availableStaff.length === 0) {
        availableStaff = [...staff];
      }

      // Select faculty and staff for this room
      const facultyIndex = Math.floor(Math.random() * availableFaculty.length);
      const staffIndex = Math.floor(Math.random() * availableStaff.length);

      const selectedFaculty = availableFaculty[facultyIndex];
      const selectedStaff = availableStaff[staffIndex];

      // Update duty counter
      dutyCounter.get(selectedFaculty.name)!.count++;
      dutyCounter.get(selectedStaff.name)!.count++;

      // Remove selected people from available pools
      availableFaculty.splice(facultyIndex, 1);
      availableStaff.splice(staffIndex, 1);

      schedule.push({
        faculty: selectedFaculty,
        staff: selectedStaff,
        room: room,
        day: day
      });
    }
  }

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