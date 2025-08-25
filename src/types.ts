export interface Person {
  name: string;
  type: 'faculty' | 'staff';
}

export interface ScheduleEntry {
  faculty: Person;
  staff: Person;
  room: number;
  day: number;
}

export interface DutyCount {
  name: string;
  count: number;
}

export interface Schedule {
  entries: ScheduleEntry[];
  facultyDuties: DutyCount[];
  staffDuties: DutyCount[];
}

export interface FacultyConstraint {
  facultyName: string;
  day: number;
}