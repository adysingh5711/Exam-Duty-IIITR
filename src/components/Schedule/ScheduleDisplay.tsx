import React, { useState, useMemo } from 'react';
import { Schedule, ScheduleEntry } from '../../types';
import { getScheduleForDay, getScheduleDays, calculateScheduleStats } from '../../services';
import { getDayName } from '../../utils';

interface ScheduleDisplayProps {
    schedule: Schedule;
}

export const ScheduleDisplay: React.FC<ScheduleDisplayProps> = ({ schedule }) => {
    const [selectedDay, setSelectedDay] = useState<number>(1);
    const [showStats, setShowStats] = useState<boolean>(false);

    const days = useMemo(() => getScheduleDays(schedule), [schedule]);
    const currentEntries = useMemo(() => getScheduleForDay(schedule, selectedDay), [schedule, selectedDay]);
    const stats = useMemo(() => calculateScheduleStats(schedule), [schedule]);

    return (
        <div className="p-4 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Supervision Schedule</h1>

            {/* Day selector tabs */}
            <div className="flex mb-4 overflow-x-auto">
                {days.map((day: number) => (
                    <button
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        className={`px-4 py-2 border-b-2 whitespace-nowrap ${selectedDay === day
                                ? "border-blue-500 text-blue-600 font-semibold"
                                : "border-transparent hover:border-gray-300"
                            }`}
                    >
                        {getDayName(day)}
                    </button>
                ))}
            </div>

            {/* Schedule grid */}
            <ScheduleGrid entries={currentEntries} />

            {/* Stats toggle button */}
            <button
                onClick={() => setShowStats(!showStats)}
                className="mb-4 flex items-center text-blue-600 hover:text-blue-800"
            >
                <span className="mr-2">
                    {showStats ? "Hide Statistics" : "Show Distribution Statistics"}
                </span>
                <ChevronIcon isOpen={showStats} />
            </button>

            {/* Statistics section */}
            {showStats && <StatisticsPanel stats={stats} />}
        </div>
    );
};

interface ScheduleGridProps {
    entries: ScheduleEntry[];
}

const ScheduleGrid: React.FC<ScheduleGridProps> = ({ entries }) => {
    return (
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
                    {entries.map((entry: ScheduleEntry) => (
                        <ScheduleRow key={`${entry.day}-${entry.room}`} entry={entry} />
                    ))}
                    {entries.length === 0 && (
                        <tr>
                            <td colSpan={2} className="px-6 py-4 text-center text-gray-500">
                                No schedule entries for this day
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

interface ScheduleRowProps {
    entry: ScheduleEntry;
}

const ScheduleRow: React.FC<ScheduleRowProps> = ({ entry }) => {
    return (
        <tr className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                Room {entry.room}
            </td>
            <td className="px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:gap-6">
                    <PersonDisplay person={entry.faculty} />
                    <PersonDisplay person={entry.staff} />
                </div>
            </td>
        </tr>
    );
};

interface PersonDisplayProps {
    person: { name: string; type: 'faculty' | 'staff' };
}

const PersonDisplay: React.FC<PersonDisplayProps> = ({ person }) => {
    const bgColor = person.type === 'faculty' ? 'bg-blue-500' : 'bg-green-500';

    return (
        <div className="flex items-center mb-2 sm:mb-0">
            <div className={`h-8 w-8 rounded-full ${bgColor} flex items-center justify-center text-white font-semibold mr-3`}>
                {person.name.charAt(0)}
            </div>
            <div>
                <div className="font-medium">{person.name}</div>
                <div className="text-xs text-gray-500">{person.type}</div>
            </div>
        </div>
    );
};

interface StatisticsPanelProps {
    stats: ReturnType<typeof calculateScheduleStats>;
}

const StatisticsPanel: React.FC<StatisticsPanelProps> = ({ stats }) => {
    return (
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Duty Distribution</h2>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatsSection
                    title="Faculty Duties"
                    average={stats.facultyAvg}
                    min={stats.facultyMin}
                    max={stats.facultyMax}
                    data={stats.facultyStats}
                    color="bg-blue-500"
                />
                <StatsSection
                    title="Staff Duties"
                    average={stats.staffAvg}
                    min={stats.staffMin}
                    max={stats.staffMax}
                    data={stats.staffStats}
                    color="bg-green-500"
                />
            </div>
        </div>
    );
};

interface StatsSectionProps {
    title: string;
    average: string;
    min: number;
    max: number;
    data: Array<{ name: string; count: number }>;
    color: string;
}

const StatsSection: React.FC<StatsSectionProps> = ({
    title,
    average,
    min,
    max,
    data,
    color,
}) => {
    return (
        <div>
            <h3 className="font-medium text-gray-700 mb-2">{title}</h3>
            <div className="flex justify-between mb-2 text-sm">
                <span>Average: {average}</span>
                <span>Range: {min} - {max}</span>
            </div>
            <div className="space-y-2 mt-3">
                {data.map((item) => (
                    <div key={item.name} className="flex items-center">
                        <div className="w-1/3 text-sm font-medium truncate pr-2">
                            {item.name}
                        </div>
                        <div className="w-2/3 flex items-center">
                            <div
                                className={`${color} h-5 rounded-sm`}
                                style={{
                                    width: `${(item.count / max) * 100}%`,
                                    minWidth: '24px',
                                }}
                            />
                            <span className="ml-2 text-sm">{item.count}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface ChevronIconProps {
    isOpen: boolean;
}

const ChevronIcon: React.FC<ChevronIconProps> = ({ isOpen }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
        >
            {isOpen ? (
                <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                />
            ) : (
                <path
                    fillRule="evenodd"
                    d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                    clipRule="evenodd"
                />
            )}
        </svg>
    );
};

export default ScheduleDisplay;