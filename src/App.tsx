import React, { useState, useCallback } from 'react';
import { FileUp, Download, RefreshCw, Plus, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Person, Schedule, FacultyConstraint } from './types';
import { generateSchedule } from './utils/scheduleGenerator';
import ScheduleDisplay from './ScheduleDisplay';

function App() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [faculty, setFaculty] = useState<Person[]>([]);
  const [staff, setStaff] = useState<Person[]>([]);
  const [isGenerated, setIsGenerated] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [constraints, setConstraints] = useState<FacultyConstraint[]>([]);
  const [days, setDays] = useState<number>(6);
  const [rooms, setRooms] = useState<number>(11);

  // Constraint form state
  const [newConstraintFaculty, setNewConstraintFaculty] = useState<string>('');
  const [newConstraintDay, setNewConstraintDay] = useState<number>(1);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clear previous file
    event.target.value = '';

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);

      const newFaculty: Person[] = [];
      const newStaff: Person[] = [];

      jsonData.forEach((row: any) => {
        if (row.Faculty) {
          newFaculty.push({ name: row.Faculty, type: 'faculty' });
        }
        if (row.Staff) {
          newStaff.push({ name: row.Staff, type: 'staff' });
        }
      });

      setFaculty(newFaculty);
      setStaff(newStaff);
      const generatedSchedule = generateSchedule(newFaculty, newStaff);
      setSchedule(generatedSchedule);
      setIsGenerated(true);
    };
    reader.readAsArrayBuffer(file);
  }, []);


  const downloadSchedule = useCallback(() => {
    if (!schedule) return;

    const wb = XLSX.utils.book_new();

    // Create new worksheet with the same structure as the image
    const ws = XLSX.utils.aoa_to_sheet([]);

    // Set column widths
    const columnWidths = [
      { wch: 20 },  // Date&Day/Classroom column
      { wch: 12 },  // Day 1
      { wch: 12 },  // Day 2
      { wch: 12 },  // Day 3
      { wch: 12 },  // Day 4
      { wch: 12 },  // Day 5
      { wch: 12 },  // Day 6
    ];
    ws['!cols'] = columnWidths;

    // Function to get cell reference
    const getCellRef = (r: number, c: number): string => {
      const col = String.fromCharCode(65 + c); // A, B, C, etc.
      return `${col}${r + 1}`;
    };

    // Header row with merged day cells
    for (let col = 1; col <= 6; col++) {
      const cellRef = getCellRef(0, col);
      ws[cellRef] = { t: 's', v: `Day ${col}` };
      // No cell_set_style in XLSX, use cell style directly
      ws[cellRef].s = { alignment: { horizontal: 'center' } };
    }

    // Day names row (Monday - Saturday)
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (let col = 1; col <= 6; col++) {
      const cellRef = getCellRef(1, col);
      ws[cellRef] = { t: 's', v: dayNames[col - 1] };
      // No cell_set_style in XLSX, use cell style directly
      ws[cellRef].s = { alignment: { horizontal: 'center' } };
    }

    // First column with Room labels
    ws[getCellRef(0, 0)] = { t: 's', v: 'Date&Day/Classroom' };
    for (let room = 1; room <= 11; room++) {
      const cellRef = getCellRef(room * 2, 0);
      ws[cellRef] = { t: 's', v: `Room ${room}` };
      // Merge the room cells vertically to span 2 rows
      ws['!merges'] = ws['!merges'] || [];
      ws['!merges'].push({
        s: { r: room * 2, c: 0 },
        e: { r: room * 2 + 1, c: 0 }
      });
    }

    // Fill in data for each room, day and person
    for (let day = 1; day <= 6; day++) {
      for (let room = 1; room <= 11; room++) {
        // Find the entry for this day and room
        const entry = schedule.entries.find(e => e.day === day && e.room === room);

        if (entry) {
          // Faculty row (first row for each room)
          const facultyCellRef = getCellRef(room * 2, day);
          ws[facultyCellRef] = { t: 's', v: entry.faculty.name };

          // Staff row (second row for each room)
          const staffCellRef = getCellRef(room * 2 + 1, day);
          ws[staffCellRef] = { t: 's', v: entry.staff.name };
        }
      }
    }

    // Set the range for the worksheet
    ws['!ref'] = `A1:G${11 * 2 + 2}`;

    // Add borders to all cells
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = getCellRef(row, col);
        if (ws[cellRef]) {
          ws[cellRef].s = {
            ...ws[cellRef].s,
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
          };
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Examination Schedule');

    // Duty counts sheet
    const dutyCounts = [
      ['Faculty Duties'],
      ['Name', 'Count'],
      ...schedule.facultyDuties.map(f => [f.name, f.count]),
      [],
      ['Staff Duties'],
      ['Name', 'Count'],
      ...schedule.staffDuties.map(s => [s.name, s.count])
    ];
    const dutyWs = XLSX.utils.aoa_to_sheet(dutyCounts);
    XLSX.utils.book_append_sheet(wb, dutyWs, 'Duty Counts');

    XLSX.writeFile(wb, 'examination-schedule.xlsx');
  }, [schedule]);

  const addConstraint = useCallback(() => {
    if (!newConstraintFaculty.trim()) {
      alert('Please select a faculty member');
      return;
    }

    if (newConstraintDay < 1 || newConstraintDay > days) {
      alert(`Day must be between 1 and ${days}`);
      return;
    }

    // Check if faculty exists in the loaded list
    const facultyExists = faculty.some(f => f.name === newConstraintFaculty);
    if (!facultyExists) {
      alert('Selected faculty member not found in the uploaded list');
      return;
    }

    // Check for duplicate constraints
    const duplicate = constraints.some(c =>
      c.facultyName === newConstraintFaculty && c.day === newConstraintDay
    );
    if (duplicate) {
      alert('This constraint already exists');
      return;
    }

    const newConstraint: FacultyConstraint = {
      facultyName: newConstraintFaculty,
      day: newConstraintDay
    };

    setConstraints(prev => [...prev, newConstraint]);
    setNewConstraintFaculty('');
    setNewConstraintDay(1);
  }, [newConstraintFaculty, newConstraintDay, days, faculty, constraints]);

  const removeConstraint = useCallback((index: number) => {
    setConstraints(prev => prev.filter((_, i) => i !== index));
  }, []);

  const generateAndSetSchedule = useCallback(() => {
    const constraintMap: { [day: number]: string[] } = {};
    constraints.forEach(constraint => {
      if (!constraintMap[constraint.day]) {
        constraintMap[constraint.day] = [];
      }
      constraintMap[constraint.day].push(constraint.facultyName);
    });

    const generatedSchedule = generateSchedule(faculty, staff, constraintMap, days, rooms);
    setSchedule(generatedSchedule);
    setIsGenerated(true);
  }, [faculty, staff, constraints, days, rooms]);

  console.log('Faculty:', faculty);
  console.log('Staff:', staff);
  console.log('Schedule:', schedule);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h1 className="text-4xl font-bold text-gray-800 mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent text-center leading-relaxed">
            Examination Duty Schedule Generator
          </h1>

          <div className="mb-8 relative">
            <label
              className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer bg-gray-50/50 hover:bg-gray-50 transition-all duration-300 border-gray-300/50 hover:border-blue-400/50"
            >
              {fileName && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setFileName(null);
                    setFaculty([]);
                    setStaff([]);
                    setSchedule(null);
                    setIsGenerated(false);
                    setConstraints([]);
                  }}
                  className="absolute -right-2 -top-2 p-2 bg-red-400 rounded-full hover:bg-red-500 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-white"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <FileUp className="w-12 h-12 mb-4 text-blue-500" />
                {fileName ? (
                  <p className="text-sm text-gray-500 font-medium">{fileName}</p>
                ) : (
                  <>
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or <span className="font-semibold">drop file here</span>
                    </p>
                    <p className="text-xs text-gray-400">Excel file with Faculty and Staff columns</p>
                  </>
                )}
              </div>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {/* Configuration Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Schedule Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Number of Days</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={days}
                    onChange={(e) => setDays(parseInt(e.target.value) || 6)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Number of Rooms</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={rooms}
                    onChange={(e) => setRooms(parseInt(e.target.value) || 11)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Faculty Day Fixing</h3>
              {faculty.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <select
                      value={newConstraintFaculty}
                      onChange={(e) => setNewConstraintFaculty(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Faculty</option>
                      {faculty.map((f, index) => (
                        <option key={index} value={f.name}>{f.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      max={days}
                      value={newConstraintDay}
                      onChange={(e) => setNewConstraintDay(parseInt(e.target.value) || 1)}
                      placeholder="Day"
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={addConstraint}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {constraints.length > 0 && (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {constraints.map((constraint, index) => (
                        <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                          <span className="text-sm text-gray-700">
                            {constraint.facultyName} - Day {constraint.day}
                          </span>
                          <button
                            onClick={() => removeConstraint(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Upload faculty list first to add constraints</p>
              )}
            </div>
          </div>

          <div className="flex justify-center mb-8">
            <button
              onClick={() => {
                if (faculty.length === 0 || staff.length === 0) {
                  alert('Please upload a file first!');
                  return;
                }
                generateAndSetSchedule();
              }}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              {isGenerated ? 'Regenerate Schedule' : 'Generate Schedule'}
            </button>

            {isGenerated && (
              <button
                onClick={downloadSchedule}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ml-4"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            )}
          </div>

          {schedule && (
            <ScheduleDisplay schedule={schedule} />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;