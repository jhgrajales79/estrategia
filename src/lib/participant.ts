"use client";

import type { Participant } from "./types";

const KEY = "socya_participant";

export interface StoredParticipant {
  id: string;
  name: string;
  role: Participant["role"];
  aspiration_id: number | null;
}

export function getStoredParticipant(): StoredParticipant | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredParticipant;
  } catch {
    return null;
  }
}

export function setStoredParticipant(p: StoredParticipant) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(p));
}

export function clearStoredParticipant() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
