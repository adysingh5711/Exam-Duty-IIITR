import React, { useState } from 'react';
import { Schedule, ScheduleEntry } from './types';

interface ScheduleDisplayProps {
    schedule: Schedule;
}

const ScheduleDisplay: React.FC<ScheduleDisplayProps> = ({ schedule }) => {
    const [selectedDay, setSelectedDay] = useState<number>(1);
    const [showStats, setShowStats] = useState<boolean>(false);

    const days: number[] = Array.from(new Set(schedule.entries.map((entry: ScheduleEntry) => entry.day))) as number[];
    // Remove weekday names - use Day 1, Day 2, etc. instead

    // Group entries by day and room
    const getEntriesForDay = (day: number): ScheduleEntry[] => {
        return schedule.entries
            .filter((entry: ScheduleEntry) => entry.day === day)
            .sort((a: ScheduleEntry, b: ScheduleEntry) => a.room - b.room);
    };

    const currentEntries: ScheduleEntry[] = getEntriesForDay(selectedDay);

    // Calculate duty distribution stats
    const calculateStats = () => {
        const facultyStats = schedule.facultyDuties;
        const staffStats = schedule.staffDuties;

        const facultyAvg = facultyStats.reduce((sum: number, item: { count: number }) => sum + item.count, 0) / facultyStats.length;
        const staffAvg = staffStats.reduce((sum: number, item: { count: number }) => sum + item.count, 0) / staffStats.length;

        return {
            facultyAvg: facultyAvg.toFixed(2),
            staffAvg: staffAvg.toFixed(2),
            facultyMin: facultyStats.length ? facultyStats[facultyStats.length - 1].count : 0,
            facultyMax: facultyStats.length ? facultyStats[0].count : 0,
            staffMin: staffStats.length ? staffStats[staffStats.length - 1].count : 0,
            staffMax: staffStats.length ? staffStats[0].count : 0,
            facultyStats,
            staffStats
        };
    };

    const stats = calculateStats();

    return (
        <div className="p-4 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Supervision Schedule</h1>

            {/* Day selector tabs */}
            <div className="flex mb-4 overflow-x-auto">
                {days.map((day: number) => (
                    <button
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        className={`px-4 py-2 border-b-2 ${selectedDay === day
                            ? "border-blue-500 text-blue-600 font-semibold"
                            : "border-transparent hover:border-gray-300"
                            }`}
                    >
                        Day {day}
                    </button>
                ))}
            </div>

            {/* Schedule grid */}
            <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                                Room
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Supervisors
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {currentEntries.map((entry: ScheduleEntry) => (
                            <tr key={`${entry.day}-${entry.room}`} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                                    Room {entry.room}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col sm:flex-row sm:gap-6">
                                        <div className="flex items-center mb-2 sm:mb-0">
                                            <div className={`h-8 w-8 rounded-full ${entry.faculty.type === 'faculty' ? 'bg-blue-500' : 'bg-green-400'} flex items-center justify-center text-white font-semibold mr-3`}>
                                                {entry.faculty.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-medium">{entry.faculty.name}</div>
                                                <div className="text-xs text-gray-500">{entry.faculty.type}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <div className={`h-8 w-8 rounded-full ${entry.staff.type === 'staff' ? 'bg-green-500' : 'bg-blue-500'} flex items-center justify-center text-white font-semibold mr-3`}>
                                                {entry.staff.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-medium">{entry.staff.name}</div>
                                                <div className="text-xs text-gray-500">{entry.staff.type}</div>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}

                        {currentEntries.length === 0 && (
                            <tr>
                                <td colSpan={2} className="px-6 py-4 text-center text-gray-500">
                                    No schedule entries for this day
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Stats toggle button */}
            <button
                onClick={() => setShowStats(!showStats)}
                className="mb-4 flex items-center text-blue-600 hover:text-blue-800"
            >
                <span className="mr-2">{showStats ? "Hide Statistics" : "Show Distribution Statistics"}</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    {showStats ? (
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    ) : (
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    )}
                </svg>
            </button>

            {/* Statistics section */}
            {showStats && (
                <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
                    <div className="p-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold">Duty Distribution</h2>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Faculty stats */}
                        <div>
                            <h3 className="font-medium text-gray-700 mb-2">Faculty Duties</h3>
                            <div className="flex justify-between mb-2 text-sm">
                                <span>Average: {stats.facultyAvg}</span>
                                <span>Range: {stats.facultyMin} - {stats.facultyMax}</span>
                            </div>

                            <div className="space-y-2 mt-3">
                                {stats.facultyStats.map((item: { name: string; count: number }) => (
                                    <div key={item.name} className="flex items-center">
                                        <div className="w-1/3 text-sm font-medium truncate pr-2">{item.name}</div>
                                        <div className="w-2/3 flex items-center">
                                            <div
                                                className="bg-blue-500 h-5 rounded-sm"
                                                style={{
                                                    width: `${(item.count / stats.facultyMax) * 100}%`,
                                                    minWidth: '24px'
                                                }}
                                            ></div>
                                            <span className="ml-2 text-sm">{item.count}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Staff stats */}
                        <div>
                            <h3 className="font-medium text-gray-700 mb-2">Staff Duties</h3>
                            <div className="flex justify-between mb-2 text-sm">
                                <span>Average: {stats.staffAvg}</span>
                                <span>Range: {stats.staffMin} - {stats.staffMax}</span>
                            </div>

                            <div className="space-y-2 mt-3">
                                {stats.staffStats.map((item: { name: string; count: number }) => (
                                    <div key={item.name} className="flex items-center">
                                        <div className="w-1/3 text-sm font-medium truncate pr-2">{item.name}</div>
                                        <div className="w-2/3 flex items-center">
                                            <div
                                                className="bg-green-500 h-5 rounded-sm"
                                                style={{
                                                    width: `${(item.count / stats.staffMax) * 100}%`,
                                                    minWidth: '24px'
                                                }}
                                            ></div>
                                            <span className="ml-2 text-sm">{item.count}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="text-sm text-gray-500 mt-4">
                <p>Note: The schedule has been optimized randomly to balance duties fairly across all staff and faculty members.</p>
            </div>
        </div>
    );
};

export default ScheduleDisplay;