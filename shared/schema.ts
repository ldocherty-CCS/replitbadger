import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, date, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const qualifications = pgTable("qualifications", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Merged with Replit Auth requirements
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  username: text("username").unique(), // Optional for Replit Auth users
  password: text("password"), // Optional for Replit Auth users
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").default("scheduler").notNull(), // scheduler, manager, operator
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const operators = pgTable("operators", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  truckLocation: text("truck_location"),
  truckLat: doublePrecision("truck_lat"),
  truckLng: doublePrecision("truck_lng"),
  qualifications: text("qualifications").array(),
  groupName: text("group_name").notNull(),
  color: text("color").default("#3b82f6"),
  operatorType: text("operator_type").default("operator").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isOutOfState: boolean("is_out_of_state").default(false).notNull(),
  availableFrom: text("available_from"),
  availableTo: text("available_to"),
  isAssistantOnly: boolean("is_assistant_only").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactInfo: text("contact_info"),
  requiredQuals: text("required_quals").array(), // Default quals required
  createdAt: timestamp("created_at").defaultNow(),
});

export const customerContacts = pgTable("customer_contacts", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  role: text("role"),
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
  status: text("status").notNull().default("missing_info"), // dispatched, ready, missing_info, cancelled, standby, etc.
  billingInfo: text("billing_info"),
  poNumber: text("po_number"),
  ticketCreated: boolean("ticket_created").default(false),
  manifestNeeded: boolean("manifest_needed").default(false),
  manifestNumber: text("manifest_number"),
  manifestDumpLocation: text("manifest_dump_location"),
  manifestDumpLocationName: text("manifest_dump_location_name"),
  scheduledDumpTimes: text("scheduled_dump_times").array(),
  
  // Remote Hose
  remoteHose: boolean("remote_hose").default(false),
  remoteHoseLength: text("remote_hose_length"),
  remoteHoseOperatorId: integer("remote_hose_operator_id").references(() => operators.id),
  
  // Site logistics
  water: text("water"), // "on_site" or "off_site"
  dump: text("dump"), // "on_site" or "off_site"
  srNumber: text("sr_number"),
  
  // Requirements
  siteQuals: text("site_quals").array(),
  additionalOperatorNeeded: boolean("additional_operator_needed").default(false),
  assistantOperatorId: integer("assistant_operator_id").references(() => operators.id),
  sortOrder: integer("sort_order").default(0),
  seriesId: text("series_id"),
  noteType: text("note_type"),
  createdBy: varchar("created_by").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const dumpLocations = pgTable("dump_locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const operatorTimeOff = pgTable("operator_time_off", {
  id: serial("id").primaryKey(),
  operatorId: integer("operator_id").references(() => operators.id, { onDelete: "cascade" }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const operatorAvailability = pgTable("operator_availability", {
  id: serial("id").primaryKey(),
  operatorId: integer("operator_id").references(() => operators.id, { onDelete: "cascade" }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const operatorDocuments = pgTable("operator_documents", {
  id: serial("id").primaryKey(),
  operatorId: integer("operator_id").references(() => operators.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  objectPath: text("object_path").notNull(),
  contentType: text("content_type"),
  size: integer("size"),
  uploadedBy: varchar("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const operatorQualifications = pgTable("operator_qualifications", {
  id: serial("id").primaryKey(),
  operatorId: integer("operator_id").references(() => operators.id, { onDelete: "cascade" }).notNull(),
  qualificationId: integer("qualification_id").references(() => qualifications.id, { onDelete: "cascade" }).notNull(),
  status: text("status").default("active").notNull(),
  issueDate: date("issue_date"),
  expirationDate: date("expiration_date"),
  documentUrl: text("document_url"),
  documentName: text("document_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === SCHEMAS ===

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOperatorSchema = createInsertSchema(operators).omit({ id: true, createdAt: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export const insertQualificationSchema = createInsertSchema(qualifications).omit({ id: true, createdAt: true });
export const insertOperatorQualificationSchema = createInsertSchema(operatorQualifications).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCustomerContactSchema = createInsertSchema(customerContacts).omit({ id: true, createdAt: true });
export const insertOperatorTimeOffSchema = createInsertSchema(operatorTimeOff).omit({ id: true, createdAt: true });
export const insertOperatorAvailabilitySchema = createInsertSchema(operatorAvailability).omit({ id: true, createdAt: true });
export const insertOperatorDocumentSchema = createInsertSchema(operatorDocuments).omit({ id: true, createdAt: true });
export const insertDumpLocationSchema = createInsertSchema(dumpLocations).omit({ id: true, createdAt: true });

// === EXPLICIT API TYPES ===

export type User = typeof users.$inferSelect;
export type Operator = typeof operators.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Qualification = typeof qualifications.$inferSelect;
export type OperatorQualification = typeof operatorQualifications.$inferSelect;
export type OperatorTimeOff = typeof operatorTimeOff.$inferSelect;
export type OperatorAvailability = typeof operatorAvailability.$inferSelect;
export type CustomerContact = typeof customerContacts.$inferSelect;
export type OperatorDocument = typeof operatorDocuments.$inferSelect;
export type DumpLocation = typeof dumpLocations.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertOperator = z.infer<typeof insertOperatorSchema>;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type InsertQualification = z.infer<typeof insertQualificationSchema>;
export type InsertOperatorQualification = z.infer<typeof insertOperatorQualificationSchema>;
export type InsertCustomerContact = z.infer<typeof insertCustomerContactSchema>;
export type InsertOperatorTimeOff = z.infer<typeof insertOperatorTimeOffSchema>;
export type InsertOperatorAvailability = z.infer<typeof insertOperatorAvailabilitySchema>;
export type InsertOperatorDocument = z.infer<typeof insertOperatorDocumentSchema>;
export type InsertDumpLocation = z.infer<typeof insertDumpLocationSchema>;

export type OperatorQualificationWithDetails = OperatorQualification & {
  operator?: Operator;
  qualification?: Qualification;
};

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
  assistantOperator?: Operator;
  creator?: { id: string; firstName: string | null; lastName: string | null } | null;
};

export type LoginRequest = { username: string; password: string };
export type AuthResponse = User;
