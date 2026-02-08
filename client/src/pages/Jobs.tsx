import { useJobs } from "@/hooks/use-jobs";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { formatOperatorFullName } from "@/lib/utils";

export default function Jobs() {
  const { data: jobs, isLoading } = useJobs();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-display font-bold mb-6">All Jobs</h1>
      
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Start Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs?.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">
                  {format(new Date(job.scheduledDate), "MMM d, yyyy")}
                </TableCell>
                <TableCell>{job.customer?.name}</TableCell>
                <TableCell>{job.operator ? formatOperatorFullName(job.operator) : <span className="text-muted-foreground italic">Unassigned</span>}</TableCell>
                <TableCell className="max-w-[200px] truncate" title={job.address}>
                  {job.address}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {job.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{job.startTime}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
