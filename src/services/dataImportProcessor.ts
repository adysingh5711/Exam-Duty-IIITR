import * as XLSX from 'xlsx';
import { Person } from '../types';
import { validateExcelFile } from '../utils';

export interface FileProcessingResult {
    faculty: Person[];
    staff: Person[];
    fileName: string;
}

export interface FileProcessingError {
    message: string;
    code: 'VALIDATION_ERROR' | 'PARSE_ERROR' | 'EMPTY_DATA';
}

/**
 * Processes an Excel file and extracts faculty and staff data
 */
export async function processExcelFile(
    file: File
): Promise<FileProcessingResult> {
    // Validate file first
    const validation = validateExcelFile(file);
    if (!validation.isValid) {
        throw new Error(validation.error);
    }

    try {
        const data = await readFileAsArrayBuffer(file);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        const { faculty, staff } = parsePersonnelData(jsonData);

        if (faculty.length === 0 && staff.length === 0) {
            throw new Error('No faculty or staff data found in the file');
        }

        return {
            faculty,
            staff,
            fileName: file.name,
        };
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Failed to process the Excel file');
    }
}

/**
 * Reads a file as ArrayBuffer using FileReader API
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const result = e.target?.result;
            if (result instanceof ArrayBuffer) {
                resolve(result);
            } else {
                reject(new Error('Failed to read file as ArrayBuffer'));
            }
        };

        reader.onerror = () => {
            reject(new Error('Error reading file'));
        };

        reader.readAsArrayBuffer(file);
    });
}

/**
 * Parses personnel data from Excel JSON data
 */
function parsePersonnelData(jsonData: any[]): { faculty: Person[]; staff: Person[] } {
    const faculty: Person[] = [];
    const staff: Person[] = [];

    jsonData.forEach((row: any) => {
        // Handle different possible column names
        const facultyName = row.Faculty || row.faculty || row.FACULTY;
        const staffName = row.Staff || row.staff || row.STAFF;

        if (facultyName && typeof facultyName === 'string') {
            const name = facultyName.trim();
            if (name) {
                faculty.push({ name, type: 'faculty' });
            }
        }

        if (staffName && typeof staffName === 'string') {
            const name = staffName.trim();
            if (name) {
                staff.push({ name, type: 'staff' });
            }
        }
    });

    return { faculty, staff };
}