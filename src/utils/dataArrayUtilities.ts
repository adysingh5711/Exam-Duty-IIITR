/**
 * Groups an array of objects by a specified key
 */
export function groupBy<T, K extends keyof T>(
    array: T[],
    key: K
): Record<string, T[]> {
    return array.reduce((groups, item) => {
        const value = String(item[key]);
        if (!groups[value]) {
            groups[value] = [];
        }
        groups[value].push(item);
        return groups;
    }, {} as Record<string, T[]>);
}

/**
 * Sorts an array by multiple keys
 */
export function sortBy<T>(
    array: T[],
    ...keys: Array<keyof T | ((item: T) => any)>
): T[] {
    return [...array].sort((a, b) => {
        for (const key of keys) {
            let aValue: any, bValue: any;

            if (typeof key === 'function') {
                aValue = key(a);
                bValue = key(b);
            } else {
                aValue = a[key];
                bValue = b[key];
            }

            if (aValue < bValue) return -1;
            if (aValue > bValue) return 1;
        }
        return 0;
    });
}

/**
 * Removes duplicate items from an array based on a key
 */
export function uniqueBy<T, K extends keyof T>(array: T[], key: K): T[] {
    const seen = new Set();
    return array.filter(item => {
        const value = item[key];
        if (seen.has(value)) {
            return false;
        }
        seen.add(value);
        return true;
    });
}

/**
 * Safely gets a nested property from an object
 */
export function safeGet<T>(
    obj: any,
    path: string,
    defaultValue?: T
): T | undefined {
    const keys = path.split('.');
    let result = obj;

    for (const key of keys) {
        if (result == null || typeof result !== 'object') {
            return defaultValue;
        }
        result = result[key];
    }

    return result !== undefined ? result : defaultValue;
}

/**
 * Deep clones an object
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime()) as unknown as T;
    }

    if (obj instanceof Array) {
        return obj.map(item => deepClone(item)) as unknown as T;
    }

    const cloned = {} as T;
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }

    return cloned;
}