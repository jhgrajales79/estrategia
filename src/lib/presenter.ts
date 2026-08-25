import type { StoredParticipant } from "./participant";

export function isPresenter(participant: StoredParticipant | null): boolean {
  return participant?.role === "facilitador";
}
