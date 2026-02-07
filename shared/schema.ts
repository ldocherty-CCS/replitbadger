import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("scheduler").notNull(), // scheduler, manager, operator
  createdAt: timestamp("created_at").defaultNow(),
});

export const operators = pgTable("operators", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  truckLocation: text("truck_location"), // Address or coordinates
  qualifications: text("qualifications").array(), // List of certs
  groupName: text("group_name").notNull(), // e.g., "Milwaukee Organic"
  color: text("color").default("#3b82f6"), // Visual identifier
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactInfo: text("contact_info"),
  requiredQuals: text("required_quals").array(), // Default quals required
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id),
  operatorId: integer("operator_id").references(() => operators.id),
  
  // Job Details
  scope: text("scope").notNull(),
  startTime: text("start_time").notNull(), // "08:00 AM"
  scheduledDate: date("scheduled_date").notNull(),
  
  // Location
  address: text("address").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  
  // Contacts
  requestorContact: text("requestor_contact"),
  onSiteContact: text("on_site_contact"),
  
  // Status & Billing
  status: text("status").notNull().default("missing_info"), // dispatched, ready, missing_info, etc.
  billingInfo: text("billing_info"),
  poNumber: text("po_number"),
  ticketCreated: boolean("ticket_created").default(false),
  manifestNeeded: boolean("manifest_needed").default(false),
  
  // Requirements
  siteQuals: text("site_quals").array(),
  additionalOperatorNeeded: boolean("additional_operator_needed").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// === SCHEMAS ===

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertOperatorSchema = createInsertSchema(operators).omit({ id: true, createdAt: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });

// === EXPLICIT API TYPES ===

export type User = typeof users.$inferSelect;
export type Operator = typeof operators.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Job = typeof jobs.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertOperator = z.infer<typeof insertOperatorSchema>;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type InsertJob = z.infer<typeof insertJobSchema>;

// API Request/Response Types
export type CreateOperatorRequest = InsertOperator;
export type UpdateOperatorRequest = Partial<InsertOperator>;
export type OperatorResponse = Operator;

export type CreateCustomerRequest = InsertCustomer;
export type UpdateCustomerRequest = Partial<InsertCustomer>;
export type CustomerResponse = Customer;

export type CreateJobRequest = InsertJob;
export type UpdateJobRequest = Partial<InsertJob>;
export type JobResponse = Job & { 
  customer?: Customer;
  operator?: Operator;
};

export type LoginRequest = { username: string; password: string };
export type AuthResponse = User;
