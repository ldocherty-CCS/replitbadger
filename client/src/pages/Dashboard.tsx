import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useJobs, useUpdateJob } from "@/hooks/use-jobs";
import { useOperators } from "@/hooks/use-operators";
import { JobCard } from "@/components/JobCard";
import { CreateJobDialog } from "@/components/CreateJobDialog";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Job, Customer } from "@shared/schema";
import { DroppableDay } from "@/components/DroppableDay";

// Component for a droppable cell in the grid
function DayCell({ 
  date, 
  operatorId, 
  jobs, 
  onJobClick 
}: { 
  date: string, 
  operatorId: number, 
  jobs: Job[], 
  onJobClick: (job: Job) => void 
}) {
  return (
    <DroppableDay 
      id={`cell-${operatorId}-${date}`} 
      date={date} 
      operatorId={operatorId}
      className="min-h-[120px] p-2 border-r border-b bg-card/50 hover:bg-card transition-colors"
    >
      {jobs.map((job) => (
        <div key={job.id} onClick={(e) => { e.stopPropagation(); onJobClick(job); }}>
          <JobCard job={job} />
        </div>
      ))}
    </DroppableDay>
  );
}

export default function Dashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeDragJob, setActiveDragJob] = useState<Job | null>(null);
  
  const updateJob = useUpdateJob();

  // Calculate week view
  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(startDate, i);
    return {
      dateObj: d,
      iso: format(d, "yyyy-MM-dd"),
      label: format(d, "EEE d"),
      fullLabel: format(d, "EEEE, MMMM do"),
    };
  });

  // Fetch data
  const { data: operators, isLoading: opsLoading } = useOperators();
  const { data: jobs, isLoading: jobsLoading } = useJobs({
    startDate: weekDays[0].iso,
    endDate: weekDays[6].iso,
  });

  const isLoading = opsLoading || jobsLoading;

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const job = active.data.current?.job as Job;
    setActiveDragJob(job);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragJob(null);

    if (!over) return;

    // Parse target drop zone ID: cell-{operatorId}-{date}
    const overId = over.id as string;
    if (!overId.startsWith("cell-")) return;

    const parts = overId.split("-");
    // cell-123-2023-01-01  -> parts: ['cell', '123', '2023', '01', '01']
    // Reconstruct date carefully
    const operatorId = parseInt(parts[1]);
    const dateStr = parts.slice(2).join("-");

    const job = active.data.current?.job as Job;

    // Only update if changed
    if (job.operatorId !== operatorId || job.scheduledDate !== dateStr) {
      await updateJob.mutateAsync({
        id: job.id,
        operatorId,
        scheduledDate: dateStr,
      });
    }
  };

  const nextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const prevWeek = () => setCurrentDate(addDays(currentDate, -7));
  const today = () => setCurrentDate(new Date());

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Group jobs by operator and date for O(1) lookup
  const jobsMap: Record<string, Job[]> = {};
  jobs?.forEach(job => {
    if (!job.operatorId) return; // Skip unassigned jobs in the grid (should be in a sidebar)
    const key = `${job.operatorId}-${job.scheduledDate}`;
    if (!jobsMap[key]) jobsMap[key] = [];
    jobsMap[key].push(job);
  });

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-muted/30">
      {/* Toolbar */}
      <div className="px-6 py-4 flex items-center justify-between border-b bg-card">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-display font-bold text-foreground">
            Scheduling Board
          </h1>
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            <Button variant="ghost" size="icon" onClick={prevWeek} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={today} className="text-xs font-medium px-3 h-8">
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={nextWeek} className="h-8 w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <span className="text-sm font-medium text-muted-foreground ml-2">
            {format(startDate, "MMMM yyyy")}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => { setSelectedJob(null); setIsCreateOpen(true); }} className="shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4 mr-2" />
            New Job
          </Button>
        </div>
      </div>

      {/* Main Grid Content */}
      <DndContext 
        sensors={sensors} 
        onDragStart={handleDragStart} 
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Header Row (Days) */}
          <div className="flex border-b bg-muted/50">
            <div className="w-48 shrink-0 p-4 font-semibold text-sm border-r bg-muted/50 sticky left-0 z-10 flex items-center">
              Operators
            </div>
            {weekDays.map((day) => (
              <div 
                key={day.iso} 
                className={cn(
                  "flex-1 min-w-[180px] p-3 text-center border-r last:border-r-0",
                  day.iso === format(new Date(), "yyyy-MM-dd") && "bg-blue-50/50 dark:bg-blue-900/10"
                )}
              >
                <div className="font-semibold text-sm">{day.label}</div>
              </div>
            ))}
          </div>

          {/* Scrollable Grid */}
          <ScrollArea className="flex-1 custom-scrollbar">
            <div className="min-w-fit">
              {operators?.map((operator) => (
                <div key={operator.id} className="flex border-b last:border-b-0">
                  {/* Operator Sidebar Cell */}
                  <div className="w-48 shrink-0 p-3 border-r bg-card sticky left-0 z-10 flex flex-col justify-center group hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-8 rounded-full shrink-0" 
                        style={{ backgroundColor: operator.color || '#3b82f6' }} 
                      />
                      <div>
                        <div className="font-bold text-sm leading-tight">{operator.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{operator.groupName}</div>
                      </div>
                    </div>
                  </div>

                  {/* Day Cells */}
                  {weekDays.map((day) => {
                    const key = `${operator.id}-${day.iso}`;
                    const cellJobs = jobsMap[key] || [];
                    
                    return (
                      <div key={day.iso} className="flex-1 min-w-[180px]">
                        <DayCell 
                          date={day.iso} 
                          operatorId={operator.id} 
                          jobs={cellJobs}
                          onJobClick={(job) => { setSelectedJob(job); setIsCreateOpen(true); }}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        <DragOverlay>
          {activeDragJob && (
            <div className="w-[180px]">
              <JobCard job={activeDragJob} isOverlay />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <CreateJobDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen}
        initialData={selectedJob}
      />
    </div>
  );
}
