import * as XLSX from 'xlsx';
import { Schedule } from '../types';
import { EXCEL_CONFIG } from '../constants';
// Excel service utilities

/**
 * Exports a schedule to an Excel file and triggers download
 */
export function exportScheduleToExcel(
    schedule: Schedule,
    config: { days: number; rooms: number },
    filename: string = EXCEL_CONFIG.DEFAULT_FILENAME
): void {
    const workbook = createScheduleWorkbook(schedule, config);
    XLSX.writeFile(workbook, filename);
}

/**
 * Creates a complete Excel workbook with schedule and statistics
 */
function createScheduleWorkbook(
    schedule: Schedule,
    config: { days: number; rooms: number }
): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new();

    // Create main schedule sheet
    const scheduleSheet = createScheduleSheet(schedule, config);
    XLSX.utils.book_append_sheet(workbook, scheduleSheet, EXCEL_CONFIG.MAIN_SHEET_NAME);

    // Create duty counts sheet
    const statsSheet = createStatsSheet(schedule);
    XLSX.utils.book_append_sheet(workbook, statsSheet, EXCEL_CONFIG.STATS_SHEET_NAME);

    return workbook;
}

/**
 * Creates the main schedule worksheet
 */
function createScheduleSheet(
    schedule: Schedule,
    config: { days: number; rooms: number }
): XLSX.WorkSheet {
    const ws = XLSX.utils.aoa_to_sheet([]);

    // Set column widths
    const columnWidths = [
        { wch: EXCEL_CONFIG.COLUMN_WIDTHS.DATE_CLASSROOM },
        ...Array(config.days).fill({ wch: EXCEL_CONFIG.COLUMN_WIDTHS.DAY_COLUMN }),
    ];
    ws['!cols'] = columnWidths;

    // Helper function to get cell reference
    const getCellRef = (row: number, col: number): string => {
        const colLetter = String.fromCharCode(65 + col);
        return `${colLetter}${row + 1}`;
    };

    // Header row with day numbers
    for (let col = 1; col <= config.days; col++) {
        const cellRef = getCellRef(0, col);
        ws[cellRef] = { t: 's', v: `Day ${col}` };
        ws[cellRef].s = { alignment: { horizontal: 'center' } };
    }

    // First column header
    ws[getCellRef(0, 0)] = { t: 's', v: 'Date&Day/Classroom' };

    // Room labels and data
    for (let room = 1; room <= config.rooms; room++) {
        // Room label (spans 2 rows)
        const roomCellRef = getCellRef(room * 2, 0);
        ws[roomCellRef] = { t: 's', v: `Room ${room}` };

        // Merge room cells vertically
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({
            s: { r: room * 2, c: 0 },
            e: { r: room * 2 + 1, c: 0 },
        });

        // Fill data for each day
        for (let day = 1; day <= config.days; day++) {
            const entry = schedule.entries.find(e => e.day === day && e.room === room);

            if (entry) {
                // Faculty row
                const facultyCellRef = getCellRef(room * 2, day);
                ws[facultyCellRef] = { t: 's', v: entry.faculty.name };

                // Staff row
                const staffCellRef = getCellRef(room * 2 + 1, day);
                ws[staffCellRef] = { t: 's', v: entry.staff.name };
            }
        }
    }

    // Set worksheet range
    ws['!ref'] = `A1:${String.fromCharCode(65 + config.days)}${config.rooms * 2 + 2}`;

    // Add borders to all cells
    addBordersToSheet(ws);

    return ws;
}

/**
 * Creates the statistics worksheet
 */
function createStatsSheet(schedule: Schedule): XLSX.WorkSheet {
    const data = [
        ['Faculty Duties'],
        ['Name', 'Count'],
        ...schedule.facultyDuties.map(f => [f.name, f.count]),
        [],
        ['Staff Duties'],
        ['Name', 'Count'],
        ...schedule.staffDuties.map(s => [s.name, s.count]),
    ];

    return XLSX.utils.aoa_to_sheet(data);
}

/**
 * Adds borders to all cells in a worksheet
 */
function addBordersToSheet(ws: XLSX.WorkSheet): void {
    if (!ws['!ref']) return;

    const range = XLSX.utils.decode_range(ws['!ref']);
    const borderStyle = {
        border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } },
        },
    };

    for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
            if (ws[cellRef]) {
                ws[cellRef].s = { ...ws[cellRef].s, ...borderStyle };
            } else {
                ws[cellRef] = { t: 's', v: '', s: borderStyle };
            }
        }
    }
}