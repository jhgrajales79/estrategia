"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { StoredParticipant } from "./participant";

interface OnlinePeer {
  name: string;
  aspiration_id: number | null;
}

export default function usePresence(participant: StoredParticipant | null, room: string = "global") {
  const [online, setOnline] = useState<OnlinePeer[]>([]);

  useEffect(() => {
    if (!participant) return;
    const channel = supabase.channel(`presence-${room}`, {
      config: { presence: { key: participant.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<OnlinePeer>();
        const peers = Object.values(state)
          .flat()
          .map((p) => ({ name: p.name, aspiration_id: p.aspiration_id }))
          .filter((p) => p.name !== participant.name);
        setOnline(peers);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ name: participant.name, aspiration_id: participant.aspiration_id });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [participant, room]);

  return online;
}
