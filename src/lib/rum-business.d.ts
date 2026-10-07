export function setBusinessActor(
  user: { uid: string; email?: string | null } | null,
): void;
export function businessEvent(
  name: string,
  properties?: Record<string, unknown>,
): boolean;
export function installInteractionEvents(
  onInteraction?: (name: string, fields: Record<string, string>) => void,
): void;
