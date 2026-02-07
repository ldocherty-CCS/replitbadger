import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth Setup
  await setupAuth(app);
  registerAuthRoutes(app);

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
    await storage.deleteOperator(Number(req.params.id));
    res.status(204).send();
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
      // Coerce numeric fields if they come as strings (though zod schema usually handles this if defined correctly, explicit coercion in schema is safer)
      const input = api.jobs.create.input.parse(req.body);
      const job = await storage.createJob(input);
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
      const job = await storage.updateJob(Number(req.params.id), input);
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
