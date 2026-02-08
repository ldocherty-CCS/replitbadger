import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || !address || address.trim().length === 0) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
    const response = await fetch(url);
    const data = await response.json() as any;
    if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth Setup
  await setupAuth(app);
  registerAuthRoutes(app);

  // === Config (expose API keys for frontend) ===
  app.get("/api/config/maps-key", (req, res) => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return res.status(404).json({ message: "Maps API key not configured" });
    res.json({ key });
  });

  // === Travel Time (Distance Matrix API) ===
  app.get("/api/travel-time", async (req, res) => {
    const { originLat, originLng, destLat, destLng } = req.query;
    if (!originLat || !originLng || !destLat || !destLng) {
      return res.status(400).json({ message: "Missing coordinates" });
    }
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return res.status(404).json({ message: "Maps API key not configured" });

    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&key=${key}&units=imperial`;
      const response = await fetch(url);
      const data = await response.json() as any;
      
      if (data.status === "OK" && data.rows?.[0]?.elements?.[0]?.status === "OK") {
        const element = data.rows[0].elements[0];
        res.json({
          duration: element.duration.text,
          durationSeconds: element.duration.value,
          distance: element.distance.text,
          distanceMeters: element.distance.value,
        });
      } else {
        res.json({ duration: null, distance: null });
      }
    } catch (error) {
      console.error("Travel time API error:", error);
      res.status(500).json({ message: "Failed to calculate travel time" });
    }
  });

  // === Operators ===
  app.get(api.operators.list.path, async (req, res) => {
    const operators = await storage.getOperators();
    res.json(operators);
  });

  app.get(api.operators.get.path, async (req, res) => {
    const operator = await storage.getOperator(Number(req.params.id));
    if (!operator) return res.status(404).json({ message: "Operator not found" });
    res.json(operator);
  });

  app.post(api.operators.create.path, async (req, res) => {
    try {
      const input = api.operators.create.input.parse(req.body);
      const operator = await storage.createOperator(input);
      res.status(201).json(operator);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.operators.update.path, async (req, res) => {
    try {
      const input = api.operators.update.input.parse(req.body);
      const operator = await storage.updateOperator(Number(req.params.id), input);
      res.json(operator);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Operator not found" });
    }
  });

  app.delete(api.operators.delete.path, async (req, res) => {
    try {
      await storage.deleteOperator(Number(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      if (err?.code === "23503") {
        return res.status(409).json({ message: "Cannot delete this operator because they have jobs assigned. Please reassign or delete their jobs first." });
      }
      res.status(500).json({ message: "Failed to delete operator" });
    }
  });

  // === Customers ===
  app.get(api.customers.list.path, async (req, res) => {
    const customers = await storage.getCustomers();
    res.json(customers);
  });

  app.post(api.customers.create.path, async (req, res) => {
    try {
      const input = api.customers.create.input.parse(req.body);
      const customer = await storage.createCustomer(input);
      res.status(201).json(customer);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.customers.update.path, async (req, res) => {
    try {
      const input = api.customers.update.input.parse(req.body);
      const customer = await storage.updateCustomer(Number(req.params.id), input);
      res.json(customer);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Customer not found" });
    }
  });

  // === Qualifications ===
  app.get(api.qualifications.list.path, async (req, res) => {
    const quals = await storage.getQualifications();
    res.json(quals);
  });

  app.post(api.qualifications.create.path, async (req, res) => {
    try {
      const input = api.qualifications.create.input.parse(req.body);
      const qual = await storage.createQualification(input);
      res.status(201).json(qual);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.qualifications.delete.path, async (req, res) => {
    await storage.deleteQualification(Number(req.params.id));
    res.status(204).send();
  });

  // === Jobs ===
  app.put("/api/jobs/reorder", async (req, res) => {
    try {
      const items = z.array(z.object({ id: z.number(), sortOrder: z.number() })).parse(req.body);
      for (const item of items) {
        await storage.updateJob(item.id, { sortOrder: item.sortOrder });
      }
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Reorder failed" });
    }
  });

  app.get(api.jobs.list.path, async (req, res) => {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      operatorId: req.query.operatorId ? Number(req.query.operatorId) : undefined,
    };
    const jobs = await storage.getJobs(filters);
    res.json(jobs);
  });

  app.get(api.jobs.get.path, async (req, res) => {
    const job = await storage.getJob(Number(req.params.id));
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  });

  app.post(api.jobs.create.path, async (req, res) => {
    try {
      const input = api.jobs.create.input.parse(req.body);
      const userId = (req.user as any)?.claims?.sub || null;
      let jobData: any = { ...input, createdBy: userId };
      if ((!jobData.lat || !jobData.lng) && jobData.address) {
        const coords = await geocodeAddress(jobData.address);
        if (coords) {
          jobData.lat = coords.lat;
          jobData.lng = coords.lng;
        }
      }
      const job = await storage.createJob(jobData);
      res.status(201).json(job);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.jobs.update.path, async (req, res) => {
    try {
      const input = api.jobs.update.input.parse(req.body);
      let updateData: any = { ...input };
      if (updateData.address && (!updateData.lat || !updateData.lng)) {
        const coords = await geocodeAddress(updateData.address);
        if (coords) {
          updateData.lat = coords.lat;
          updateData.lng = coords.lng;
        }
      }
      const job = await storage.updateJob(Number(req.params.id), updateData);
      res.json(job);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Job not found" });
    }
  });

  app.delete(api.jobs.delete.path, async (req, res) => {
    await storage.deleteJob(Number(req.params.id));
    res.status(204).send();
  });

  // === Operator Qualifications ===
  app.get(api.operatorQualifications.list.path, async (req, res) => {
    const operatorId = req.query.operatorId ? Number(req.query.operatorId) : undefined;
    const oqs = await storage.getOperatorQualifications(operatorId);
    res.json(oqs);
  });

  app.get(api.operatorQualifications.get.path, async (req, res) => {
    const oq = await storage.getOperatorQualification(Number(req.params.id));
    if (!oq) return res.status(404).json({ message: "Operator qualification not found" });
    res.json(oq);
  });

  app.post(api.operatorQualifications.create.path, async (req, res) => {
    try {
      const input = api.operatorQualifications.create.input.parse(req.body);
      const oq = await storage.createOperatorQualification(input);
      res.status(201).json(oq);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.operatorQualifications.update.path, async (req, res) => {
    try {
      const input = api.operatorQualifications.update.input.parse(req.body);
      const oq = await storage.updateOperatorQualification(Number(req.params.id), input);
      res.json(oq);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(404).json({ message: "Operator qualification not found" });
    }
  });

  app.delete(api.operatorQualifications.delete.path, async (req, res) => {
    await storage.deleteOperatorQualification(Number(req.params.id));
    res.status(204).send();
  });

  // === Operator Time Off ===
  app.get("/api/time-off", async (req, res) => {
    const filters = {
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      operatorId: req.query.operatorId ? Number(req.query.operatorId) : undefined,
    };
    const results = await storage.getOperatorTimeOff(filters);
    res.json(results);
  });

  app.post("/api/time-off", async (req, res) => {
    try {
      const input = z.object({
        operatorId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
        reason: z.string().optional().nullable(),
      }).parse(req.body);
      const created = await storage.createOperatorTimeOff(input);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create time off" });
    }
  });

  app.delete("/api/time-off/:id", async (req, res) => {
    await storage.deleteOperatorTimeOff(Number(req.params.id));
    res.status(204).send();
  });

  app.post("/api/time-off/:id/remove-day", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { date } = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.body);
      const records = await storage.getOperatorTimeOff();
      const record = records.find(r => r.id === id);
      if (!record) return res.status(404).json({ message: "Not found" });

      const shiftDate = (d: string, offset: number): string => {
        const [y, m, day] = d.split("-").map(Number);
        const dt = new Date(Date.UTC(y, m - 1, day + offset));
        return dt.toISOString().split("T")[0];
      };

      if (record.startDate === record.endDate) {
        await storage.deleteOperatorTimeOff(id);
        return res.json({ action: "deleted" });
      }

      if (date === record.startDate) {
        await storage.updateOperatorTimeOff(id, { startDate: shiftDate(date, 1) });
        return res.json({ action: "trimmed_start" });
      }

      if (date === record.endDate) {
        await storage.updateOperatorTimeOff(id, { endDate: shiftDate(date, -1) });
        return res.json({ action: "trimmed_end" });
      }

      await storage.updateOperatorTimeOff(id, { endDate: shiftDate(date, -1) });
      await storage.createOperatorTimeOff({
        operatorId: record.operatorId,
        startDate: shiftDate(date, 1),
        endDate: record.endDate,
        reason: record.reason,
      });
      return res.json({ action: "split" });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  // === Operator Availability ===
  app.get("/api/operator-availability", async (req, res) => {
    const operatorId = req.query.operatorId ? Number(req.query.operatorId) : undefined;
    const results = await storage.getOperatorAvailability(operatorId);
    res.json(results);
  });

  app.post("/api/operator-availability", async (req, res) => {
    try {
      const input = z.object({
        operatorId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
        notes: z.string().optional().nullable(),
      }).parse(req.body);
      const created = await storage.createOperatorAvailability(input);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create availability" });
    }
  });

  app.put("/api/operator-availability/:id", async (req, res) => {
    try {
      const input = z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        notes: z.string().optional().nullable(),
      }).parse(req.body);
      const updated = await storage.updateOperatorAvailability(Number(req.params.id), input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update availability" });
    }
  });

  app.delete("/api/operator-availability/:id", async (req, res) => {
    await storage.deleteOperatorAvailability(Number(req.params.id));
    res.status(204).send();
  });

  // === Multi-day Job Series ===
  app.post("/api/jobs/series", async (req, res) => {
    try {
      const input = z.object({
        job: z.object({
          customerId: z.number().nullable().optional(),
          operatorId: z.number().nullable().optional(),
          scope: z.string().optional(),
          startTime: z.string().optional(),
          address: z.string().optional(),
          lat: z.number().nullable().optional(),
          lng: z.number().nullable().optional(),
          requestorContact: z.string().nullable().optional(),
          onSiteContact: z.string().nullable().optional(),
          status: z.string().optional(),
          billingInfo: z.string().nullable().optional(),
          poNumber: z.string().nullable().optional(),
          ticketCreated: z.boolean().optional(),
          manifestNeeded: z.boolean().optional(),
          siteQuals: z.array(z.string()).nullable().optional(),
          additionalOperatorNeeded: z.boolean().optional(),
          assistantOperatorId: z.number().nullable().optional(),
          sortOrder: z.number().optional(),
        }),
        startDate: z.string(),
        endDate: z.string(),
      }).parse(req.body);

      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      if (start > end) {
        return res.status(400).json({ message: "Start date must be before or equal to end date" });
      }
      const seriesId = `series-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const userId = (req.user as any)?.claims?.sub || null;
      const created: any[] = [];

      let jobLat = input.job.lat;
      let jobLng = input.job.lng;
      if ((!jobLat || !jobLng) && input.job.address) {
        const coords = await geocodeAddress(input.job.address);
        if (coords) {
          jobLat = coords.lat;
          jobLng = coords.lng;
        }
      }

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0];
        const job = await storage.createJob({
          ...input.job,
          lat: jobLat,
          lng: jobLng,
          scope: input.job.scope || "",
          startTime: input.job.startTime || "08:00 AM",
          address: input.job.address || "",
          scheduledDate: dateStr,
          seriesId,
          createdBy: userId,
        } as any);
        created.push(job);
      }

      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create job series" });
    }
  });

  // === Geocode Backfill (geocode existing jobs without coordinates) ===
  app.post("/api/jobs/geocode-backfill", async (req, res) => {
    try {
      const allJobs = await storage.getJobs({});
      const jobsToGeocode = allJobs.filter(
        (j: any) => j.address && j.address.trim().length > 0 && (j.lat == null || j.lng == null)
      );
      let geocoded = 0;
      for (const job of jobsToGeocode) {
        const coords = await geocodeAddress(job.address);
        if (coords) {
          await storage.updateJob(job.id, { lat: coords.lat, lng: coords.lng });
          geocoded++;
        }
      }
      res.json({ total: jobsToGeocode.length, geocoded });
    } catch (error) {
      console.error("Geocode backfill error:", error);
      res.status(500).json({ message: "Geocode backfill failed" });
    }
  });

  // Seed Data
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingQuals = await storage.getQualifications();
  if (existingQuals.length === 0) {
    const defaultQuals = [
      { name: "EWN", category: "Safety" },
      { name: "Enbridge", category: "Pipeline" },
      { name: "ESN", category: "Pipeline" },
      { name: "NNG", category: "Pipeline" },
      { name: "OSHA 10", category: "Safety" },
      { name: "OSHA 30", category: "Safety" },
      { name: "Confined Space", category: "Safety" },
      { name: "CDL A", category: "License" },
      { name: "CDL B", category: "License" },
      { name: "WE Energies", category: "Utility" },
      { name: "Wis Gas", category: "Utility" },
      { name: "WPS", category: "Utility" },
    ];
    for (const q of defaultQuals) {
      await storage.createQualification(q);
    }
    console.log("Seeded qualifications");
  }

  const existingOperators = await storage.getOperators();
  if (existingOperators.length === 0) {
    console.log("Seeding database...");
    
    // Create Operators
    const op1 = await storage.createOperator({
      name: "John Doe",
      groupName: "Milwaukee Organic",
      truckLocation: "123 Main St, Milwaukee, WI",
      truckLat: 43.0389,
      truckLng: -87.9065,
      qualifications: ["Enbridge", "ESN"],
      isActive: true,
      color: "#3b82f6"
    });
    
    const op2 = await storage.createOperator({
      name: "Jane Smith",
      groupName: "Milwaukee Organic",
      truckLocation: "456 Oak Ave, Milwaukee, WI",
      truckLat: 43.0451,
      truckLng: -87.9093,
      qualifications: ["NNG"],
      isActive: true,
      color: "#10b981"
    });

    const op3 = await storage.createOperator({
      name: "Mike Johnson",
      groupName: "Out-of-State",
      truckLocation: "789 Pine Ln, Chicago, IL",
      truckLat: 41.8781,
      truckLng: -87.6298,
      qualifications: ["Enbridge", "NNG", "ESN"],
      isActive: true,
      color: "#f59e0b"
    });

    // Create Customers
    const cust1 = await storage.createCustomer({
      name: "Big Energy Corp",
      requiredQuals: ["Enbridge"],
      contactInfo: "Bob Builder (555-0123)"
    });

    const cust2 = await storage.createCustomer({
      name: "City Infrastructure",
      requiredQuals: [],
      contactInfo: "Alice Engineer (555-0456)"
    });

    // Create Jobs (Today and Tomorrow)
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    await storage.createJob({
      customerId: cust1.id,
      operatorId: op1.id,
      scope: "Hydrovac excavation for new pipeline",
      startTime: "07:00 AM",
      scheduledDate: today,
      address: "100 Industrial Pkwy, Milwaukee, WI",
      status: "dispatched",
      siteQuals: ["Enbridge"],
      billingInfo: "PO# 998877",
      requestorContact: "Bob Builder"
    });

    await storage.createJob({
      customerId: cust2.id,
      operatorId: op2.id,
      scope: "Potholing for utility location",
      startTime: "08:30 AM",
      scheduledDate: today,
      address: "200 Downtown Ave, Milwaukee, WI",
      status: "ready",
      siteQuals: [],
      billingInfo: "TBD",
      requestorContact: "Alice Engineer"
    });

    await storage.createJob({
      customerId: cust1.id,
      operatorId: op3.id,
      scope: "Emergency spill cleanup",
      startTime: "06:00 AM",
      scheduledDate: tomorrow,
      address: "300 Lake Dr, Milwaukee, WI",
      status: "ticket_created",
      siteQuals: ["Enbridge", "ESN"],
      billingInfo: "Emergency PO# 112233",
      requestorContact: "Safety Officer Dan"
    });
    
    console.log("Database seeded successfully!");
  }
}
