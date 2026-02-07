import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface DroppableDayProps {
  id: string;
  date: string;
  operatorId: number;
  children: React.ReactNode;
  className?: string;
  type?: "schedule" | "standby" | "cancelled";
}

export function DroppableDay({ id, date, operatorId, children, className, type = "schedule" }: DroppableDayProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
    data: { operatorId, date, type },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-full min-h-[100px] transition-colors",
        isOver ? "bg-primary/5 ring-2 ring-inset ring-primary/20" : "",
        className
      )}
    >
      {children}
    </div>
  );
}
