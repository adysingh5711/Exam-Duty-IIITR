import { DAY_LABELS } from '../constants';

/**
 * Gets the day label for a given day number (1-6)
 */
export function getDayName(dayNumber: number): string {
    if (dayNumber < 1 || dayNumber > DAY_LABELS.length) {
        return `Day ${dayNumber}`;
    }
    return DAY_LABELS[dayNumber - 1];
}

/**
 * Gets all available day names up to a given number of days
 */
export function getDayNames(numberOfDays: number): string[] {
    return Array.from({ length: numberOfDays }, (_, i) => getDayName(i + 1));
}

/**
 * Formats a person's name with proper capitalization
 */
export function formatPersonName(name: string): string {
    return name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Gets the initials of a person's name
 */
export function getPersonInitials(name: string): string {
    return name
        .split(' ')
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

/**
 * Formats a number with proper decimal places
 */
export function formatNumber(num: number, decimals: number = 2): string {
    return parseFloat(num.toString()).toFixed(decimals);
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;

    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}