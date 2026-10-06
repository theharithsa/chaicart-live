export function rumEvent(name: string, properties?: Record<string, string | number | boolean>): void;
export function beginRumAction(name?: string, properties?: Record<string, string | number | boolean>): { end(outcome?: string, extra?: Record<string, string | number | boolean>): void };
export function withRumAction<T>(name: string, work: () => Promise<T>, properties?: Record<string, string | number | boolean>): Promise<T>;
