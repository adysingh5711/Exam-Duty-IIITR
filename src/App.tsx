import React, { useState, useCallback } from 'react';
import { FileUp, Download, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Person, Schedule } from './types';
import { generateSchedule } from './utils/scheduleGenerator';

function App() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [faculty, setFaculty] = useState<Person[]>([]);
  const [staff, setStaff] = useState<Person[]>([]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const regenerateSchedule = useCallback(() => {
    const generatedSchedule = generateSchedule(faculty, staff);
    setSchedule(generatedSchedule);
  }, [faculty, staff]);

  const downloadSchedule = useCallback(() => {
    if (!schedule) return;

    const wb = XLSX.utils.book_new();

    // Schedule sheet
    const scheduleWs = XLSX.utils.json_to_sheet(
      schedule.entries.map(entry => ({
        Day: entry.day,
        Room: entry.room,
        Faculty: entry.faculty.name,
        Staff: entry.staff.name
      }))
    );
    XLSX.utils.book_append_sheet(wb, scheduleWs, 'Schedule');

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h1 className="text-4xl font-bold text-gray-800 mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent text-center leading-relaxed">
            Examination Duty Schedule Generator
          </h1>

          <div className="mb-8">
            <label
              className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer bg-gray-50/50 hover:bg-gray-50 transition-all duration-300 border-gray-300/50 hover:border-blue-400/50"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <FileUp className="w-12 h-12 mb-4 text-blue-500" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-400">Excel file with Faculty and Staff columns</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {schedule && (
            <div className="space-y-8">
              <div className="overflow-hidden bg-white rounded-xl border border-gray-200">
                <div className="p-6 flex justify-between items-center border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-800">Generated Schedule</h2>
                  <div className="flex gap-3">
                    <button
                      onClick={regenerateSchedule}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Regenerate
                    </button>
                    <button
                      onClick={downloadSchedule}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faculty</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {schedule.entries.map((entry, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Day {entry.day}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Room {entry.room}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.faculty.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.staff.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800">Faculty Duty Count</h3>
                  <div className="space-y-3">
                    {schedule.facultyDuties.map((duty, index) => (
                      <div key={index} className="flex justify-between items-center p-3 rounded-lg bg-gray-50/50">
                        <span className="text-gray-700 font-medium">{duty.name}</span>
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                          {duty.count} duties
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800">Staff Duty Count</h3>
                  <div className="space-y-3">
                    {schedule.staffDuties.map((duty, index) => (
                      <div key={index} className="flex justify-between items-center p-3 rounded-lg bg-gray-50/50">
                        <span className="text-gray-700 font-medium">{duty.name}</span>
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                          {duty.count} duties
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;