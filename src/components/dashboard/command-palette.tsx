"use client";

import { useRouter } from "next/navigation";
import {
  Compass,
  LogOut,
  MessageSquare,
  Plus,
  Settings,
  Sparkles,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAuthStore } from "@/lib/store";

/**
 * ⌘K command palette for the dashboard.
 * The parent owns `open` state and the global keydown listener.
 */
export function CommandPalette({
  open,
  onOpenChange,
  projects,
  onNewProject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: { id: string; name: string; status: string }[];
  onNewProject: () => void;
}) {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);

  function run(action: () => void) {
    onOpenChange(false);
    action();
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>Nothing found</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(onNewProject)}>
            <Plus />
            New project
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/chat"))}>
            <MessageSquare />
            Lovify Chat
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/explore"))}>
            <Compass />
            Explore
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/settings"))}>
            <Settings />
            Settings
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() => {
                clear();
                router.replace("/");
              })
            }
          >
            <LogOut />
            Sign out
          </CommandItem>
        </CommandGroup>
        {projects.length > 0 ? (
          <CommandGroup heading="Your apps">
            {projects.map((p) => (
              <CommandItem
                key={p.id}
                value={p.name}
                onSelect={() => run(() => router.push(`/builder/${p.id}`))}
              >
                <Sparkles />
                {p.name}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
