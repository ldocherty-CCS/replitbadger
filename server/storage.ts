import { db } from "./db";
import {
  users, operators, customers, jobs, qualifications, operatorQualifications, operatorTimeOff, operatorAvailability, operatorDocuments, customerContacts, dumpLocations,
  type User, type Operator, type Customer, type Job, type Qualification, type OperatorQualification, type OperatorTimeOff, type OperatorAvailability, type OperatorDocument, type CustomerContact, type DumpLocation,
  type InsertUser, type InsertOperator, type InsertCustomer, type InsertJob, type InsertQualification, type InsertOperatorQualification, type InsertOperatorTimeOff, type InsertOperatorAvailability, type InsertOperatorDocument, type InsertCustomerContact, type InsertDumpLocation,
  type UpdateOperatorRequest, type UpdateCustomerRequest, type UpdateJobRequest,
  type OperatorQualificationWithDetails
} from "@shared/schema";
import { eq, and, gte, lte, or, ilike, aliasedTable, desc } from "drizzle-orm";

export interface IStorage {
  // Operators
  getOperators(): Promise<Operator[]>;
  getOperator(id: number): Promise<Operator | undefined>;
  createOperator(operator: InsertOperator): Promise<Operator>;
  updateOperator(id: number, updates: UpdateOperatorRequest): Promise<Operator>;
  deleteOperator(id: number): Promise<void>;

  // Customers
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, updates: UpdateCustomerRequest): Promise<Customer>;

  // Jobs
  getJobs(filters?: { startDate?: string; endDate?: string; operatorId?: number }): Promise<(Job & { customer?: Customer; operator?: Operator; assistantOperator?: Operator })[]>;
  searchJobs(query: string, limit?: number): Promise<(Job & { customer?: Customer; operator?: Operator })[]>;
  getJob(id: number): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: number, updates: UpdateJobRequest): Promise<Job>;
  deleteJob(id: number): Promise<void>;

  // Qualifications
  getQualifications(): Promise<Qualification[]>;
  createQualification(qual: InsertQualification): Promise<Qualification>;
  deleteQualification(id: number): Promise<void>;

  // Operator Qualifications
  getOperatorQualifications(operatorId?: number): Promise<OperatorQualificationWithDetails[]>;
  getOperatorQualification(id: number): Promise<OperatorQualificationWithDetails | undefined>;
  createOperatorQualification(oq: InsertOperatorQualification): Promise<OperatorQualification>;
  updateOperatorQualification(id: number, updates: Partial<InsertOperatorQualification>): Promise<OperatorQualification>;
  deleteOperatorQualification(id: number): Promise<void>;

  // Operator Time Off
  getOperatorTimeOff(filters?: { startDate?: string; endDate?: string; operatorId?: number }): Promise<(OperatorTimeOff & { operator?: Operator })[]>;
  createOperatorTimeOff(timeOff: InsertOperatorTimeOff): Promise<OperatorTimeOff>;
  updateOperatorTimeOff(id: number, data: { startDate?: string; endDate?: string }): Promise<OperatorTimeOff>;
  deleteOperatorTimeOff(id: number): Promise<void>;

  // Operator Availability
  getOperatorAvailability(operatorId?: number): Promise<(OperatorAvailability & { operator?: Operator })[]>;
  createOperatorAvailability(avail: InsertOperatorAvailability): Promise<OperatorAvailability>;
  updateOperatorAvailability(id: number, data: Partial<InsertOperatorAvailability>): Promise<OperatorAvailability>;
  deleteOperatorAvailability(id: number): Promise<void>;

  // Operator Documents
  getOperatorDocuments(operatorId: number): Promise<OperatorDocument[]>;
  createOperatorDocument(doc: InsertOperatorDocument): Promise<OperatorDocument>;
  deleteOperatorDocument(id: number): Promise<void>;

  // Customer Contacts
  getCustomerContacts(customerId: number): Promise<CustomerContact[]>;
  createCustomerContact(contact: InsertCustomerContact): Promise<CustomerContact>;
  updateCustomerContact(id: number, updates: Partial<InsertCustomerContact>): Promise<CustomerContact>;
  deleteCustomerContact(id: number): Promise<void>;

  // Dump Locations
  getDumpLocations(): Promise<DumpLocation[]>;
  createDumpLocation(location: InsertDumpLocation): Promise<DumpLocation>;
  deleteDumpLocation(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Operators
  async getOperators(): Promise<Operator[]> {
    return await db.select().from(operators).orderBy(operators.groupName, operators.lastName, operators.firstName);
  }

  async getOperator(id: number): Promise<Operator | undefined> {
    const [operator] = await db.select().from(operators).where(eq(operators.id, id));
    return operator;
  }

  async createOperator(insertOperator: InsertOperator): Promise<Operator> {
    const [operator] = await db.insert(operators).values(insertOperator).returning();
    return operator;
  }

  async updateOperator(id: number, updates: UpdateOperatorRequest): Promise<Operator> {
    const [updated] = await db
      .update(operators)
      .set(updates)
      .where(eq(operators.id, id))
      .returning();
    return updated;
  }

  async deleteOperator(id: number): Promise<void> {
    await db.update(jobs).set({ operatorId: null }).where(eq(jobs.operatorId, id));
    await db.update(jobs).set({ assistantOperatorId: null }).where(eq(jobs.assistantOperatorId, id));
    await db.update(jobs).set({ remoteHoseOperatorId: null }).where(eq(jobs.remoteHoseOperatorId, id));
    await db.delete(operators).where(eq(operators.id, id));
  }

  // Customers
  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(customers.name);
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(insertCustomer).returning();
    return customer;
  }

  async updateCustomer(id: number, updates: UpdateCustomerRequest): Promise<Customer> {
    const [updated] = await db
      .update(customers)
      .set(updates)
      .where(eq(customers.id, id))
      .returning();
    return updated;
  }

  // Qualifications
  async getQualifications(): Promise<Qualification[]> {
    return await db.select().from(qualifications).orderBy(qualifications.name);
  }

  async createQualification(qual: InsertQualification): Promise<Qualification> {
    const [created] = await db.insert(qualifications).values(qual).returning();
    return created;
  }

  async deleteQualification(id: number): Promise<void> {
    await db.delete(qualifications).where(eq(qualifications.id, id));
  }

  // Jobs
  async getJobs(filters?: { startDate?: string; endDate?: string; operatorId?: number }): Promise<(Job & { customer?: Customer; operator?: Operator; assistantOperator?: Operator; creator?: { id: string; firstName: string | null; lastName: string | null } | null })[]> {
    const assistantOperators = aliasedTable(operators, "assistant_operators");
    const creatorUsers = aliasedTable(users, "creator_users");
    let query = db.select({
      id: jobs.id,
      customerId: jobs.customerId,
      operatorId: jobs.operatorId,
      scope: jobs.scope,
      startTime: jobs.startTime,
      scheduledDate: jobs.scheduledDate,
      address: jobs.address,
      lat: jobs.lat,
      lng: jobs.lng,
      requestorContact: jobs.requestorContact,
      onSiteContact: jobs.onSiteContact,
      status: jobs.status,
      billingInfo: jobs.billingInfo,
      poNumber: jobs.poNumber,
      ticketCreated: jobs.ticketCreated,
      manifestNeeded: jobs.manifestNeeded,
      manifestNumber: jobs.manifestNumber,
      manifestDumpLocation: jobs.manifestDumpLocation,
      manifestDumpLocationName: jobs.manifestDumpLocationName,
      scheduledDumpTimes: jobs.scheduledDumpTimes,
      remoteHose: jobs.remoteHose,
      remoteHoseLength: jobs.remoteHoseLength,
      remoteHoseOperatorId: jobs.remoteHoseOperatorId,
      water: jobs.water,
      dump: jobs.dump,
      srNumber: jobs.srNumber,
      siteQuals: jobs.siteQuals,
      additionalOperatorNeeded: jobs.additionalOperatorNeeded,
      assistantOperatorId: jobs.assistantOperatorId,
      sortOrder: jobs.sortOrder,
      seriesId: jobs.seriesId,
      noteType: jobs.noteType,
      createdBy: jobs.createdBy,
      createdAt: jobs.createdAt,
      customer: customers,
      operator: operators,
      assistantOperator: assistantOperators,
      creator: {
        id: creatorUsers.id,
        firstName: creatorUsers.firstName,
        lastName: creatorUsers.lastName,
      },
    })
    .from(jobs)
    .leftJoin(customers, eq(jobs.customerId, customers.id))
    .leftJoin(operators, eq(jobs.operatorId, operators.id))
    .leftJoin(assistantOperators, eq(jobs.assistantOperatorId, assistantOperators.id))
    .leftJoin(creatorUsers, eq(jobs.createdBy, creatorUsers.id));

    const conditions = [];
    if (filters?.startDate) {
      conditions.push(gte(jobs.scheduledDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(jobs.scheduledDate, filters.endDate));
    }
    if (filters?.operatorId) {
      conditions.push(eq(jobs.operatorId, filters.operatorId));
    }

    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }

    // @ts-ignore
    const results = await query.orderBy(jobs.scheduledDate, jobs.sortOrder, jobs.startTime);
    
    return results.map(row => ({
      ...row,
      customer: row.customer || undefined,
      operator: row.operator || undefined,
      assistantOperator: row.assistantOperator || undefined,
      creator: row.creator?.id ? row.creator : null,
    }));
  }

  async searchJobs(query: string, limit: number = 50): Promise<(Job & { customer?: Customer; operator?: Operator })[]> {
    const pattern = `%${query}%`;
    const results = await db.select({
      id: jobs.id,
      customerId: jobs.customerId,
      operatorId: jobs.operatorId,
      scope: jobs.scope,
      startTime: jobs.startTime,
      scheduledDate: jobs.scheduledDate,
      address: jobs.address,
      lat: jobs.lat,
      lng: jobs.lng,
      requestorContact: jobs.requestorContact,
      onSiteContact: jobs.onSiteContact,
      status: jobs.status,
      billingInfo: jobs.billingInfo,
      poNumber: jobs.poNumber,
      ticketCreated: jobs.ticketCreated,
      manifestNeeded: jobs.manifestNeeded,
      manifestNumber: jobs.manifestNumber,
      manifestDumpLocation: jobs.manifestDumpLocation,
      manifestDumpLocationName: jobs.manifestDumpLocationName,
      scheduledDumpTimes: jobs.scheduledDumpTimes,
      remoteHose: jobs.remoteHose,
      remoteHoseLength: jobs.remoteHoseLength,
      remoteHoseOperatorId: jobs.remoteHoseOperatorId,
      water: jobs.water,
      dump: jobs.dump,
      srNumber: jobs.srNumber,
      siteQuals: jobs.siteQuals,
      additionalOperatorNeeded: jobs.additionalOperatorNeeded,
      assistantOperatorId: jobs.assistantOperatorId,
      sortOrder: jobs.sortOrder,
      seriesId: jobs.seriesId,
      noteType: jobs.noteType,
      createdBy: jobs.createdBy,
      createdAt: jobs.createdAt,
      customer: customers,
      operator: operators,
    })
    .from(jobs)
    .leftJoin(customers, eq(jobs.customerId, customers.id))
    .leftJoin(operators, eq(jobs.operatorId, operators.id))
    .where(
      or(
        ilike(customers.name, pattern),
        ilike(operators.firstName, pattern),
        ilike(jobs.address, pattern),
        ilike(jobs.scope, pattern),
        ilike(jobs.poNumber, pattern),
      )
    )
    .orderBy(desc(jobs.scheduledDate))
    .limit(limit);

    return results.map(row => ({
      ...row,
      customer: row.customer || undefined,
      operator: row.operator || undefined,
    }));
  }

  async getJob(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobs).values(insertJob).returning();
    return job;
  }

  async updateJob(id: number, updates: UpdateJobRequest): Promise<Job> {
    const [updated] = await db
      .update(jobs)
      .set(updates)
      .where(eq(jobs.id, id))
      .returning();
    return updated;
  }

  async deleteJob(id: number): Promise<void> {
    await db.delete(jobs).where(eq(jobs.id, id));
  }

  // Operator Qualifications
  async getOperatorQualifications(operatorId?: number): Promise<OperatorQualificationWithDetails[]> {
    let query = db.select({
      id: operatorQualifications.id,
      operatorId: operatorQualifications.operatorId,
      qualificationId: operatorQualifications.qualificationId,
      status: operatorQualifications.status,
      issueDate: operatorQualifications.issueDate,
      expirationDate: operatorQualifications.expirationDate,
      documentUrl: operatorQualifications.documentUrl,
      documentName: operatorQualifications.documentName,
      notes: operatorQualifications.notes,
      createdAt: operatorQualifications.createdAt,
      updatedAt: operatorQualifications.updatedAt,
      operator: operators,
      qualification: qualifications,
    })
    .from(operatorQualifications)
    .leftJoin(operators, eq(operatorQualifications.operatorId, operators.id))
    .leftJoin(qualifications, eq(operatorQualifications.qualificationId, qualifications.id));

    if (operatorId) {
      // @ts-ignore
      query = query.where(eq(operatorQualifications.operatorId, operatorId));
    }

    // @ts-ignore
    const results = await query.orderBy(operators.lastName);
    return results.map(row => ({
      ...row,
      operator: row.operator || undefined,
      qualification: row.qualification || undefined,
    }));
  }

  async getOperatorQualification(id: number): Promise<OperatorQualificationWithDetails | undefined> {
    const results = await db.select({
      id: operatorQualifications.id,
      operatorId: operatorQualifications.operatorId,
      qualificationId: operatorQualifications.qualificationId,
      status: operatorQualifications.status,
      issueDate: operatorQualifications.issueDate,
      expirationDate: operatorQualifications.expirationDate,
      documentUrl: operatorQualifications.documentUrl,
      documentName: operatorQualifications.documentName,
      notes: operatorQualifications.notes,
      createdAt: operatorQualifications.createdAt,
      updatedAt: operatorQualifications.updatedAt,
      operator: operators,
      qualification: qualifications,
    })
    .from(operatorQualifications)
    .leftJoin(operators, eq(operatorQualifications.operatorId, operators.id))
    .leftJoin(qualifications, eq(operatorQualifications.qualificationId, qualifications.id))
    .where(eq(operatorQualifications.id, id));

    if (results.length === 0) return undefined;
    const row = results[0];
    return { ...row, operator: row.operator || undefined, qualification: row.qualification || undefined };
  }

  async createOperatorQualification(oq: InsertOperatorQualification): Promise<OperatorQualification> {
    const [created] = await db.insert(operatorQualifications).values(oq).returning();
    return created;
  }

  async updateOperatorQualification(id: number, updates: Partial<InsertOperatorQualification>): Promise<OperatorQualification> {
    const [updated] = await db
      .update(operatorQualifications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(operatorQualifications.id, id))
      .returning();
    return updated;
  }

  async deleteOperatorQualification(id: number): Promise<void> {
    await db.delete(operatorQualifications).where(eq(operatorQualifications.id, id));
  }

  // Operator Time Off
  async getOperatorTimeOff(filters?: { startDate?: string; endDate?: string; operatorId?: number }): Promise<(OperatorTimeOff & { operator?: Operator })[]> {
    let query = db.select({
      id: operatorTimeOff.id,
      operatorId: operatorTimeOff.operatorId,
      startDate: operatorTimeOff.startDate,
      endDate: operatorTimeOff.endDate,
      reason: operatorTimeOff.reason,
      createdAt: operatorTimeOff.createdAt,
      operator: operators,
    })
    .from(operatorTimeOff)
    .leftJoin(operators, eq(operatorTimeOff.operatorId, operators.id));

    const conditions = [];
    if (filters?.startDate) {
      conditions.push(gte(operatorTimeOff.endDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(operatorTimeOff.startDate, filters.endDate));
    }
    if (filters?.operatorId) {
      conditions.push(eq(operatorTimeOff.operatorId, filters.operatorId));
    }
    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }

    // @ts-ignore
    const results = await query.orderBy(operatorTimeOff.startDate);
    return results.map(row => ({
      ...row,
      operator: row.operator || undefined,
    }));
  }

  async createOperatorTimeOff(timeOff: InsertOperatorTimeOff): Promise<OperatorTimeOff> {
    const [created] = await db.insert(operatorTimeOff).values(timeOff).returning();
    return created;
  }

  async updateOperatorTimeOff(id: number, data: { startDate?: string; endDate?: string }): Promise<OperatorTimeOff> {
    const [updated] = await db.update(operatorTimeOff).set(data).where(eq(operatorTimeOff.id, id)).returning();
    return updated;
  }

  async deleteOperatorTimeOff(id: number): Promise<void> {
    await db.delete(operatorTimeOff).where(eq(operatorTimeOff.id, id));
  }

  // Operator Availability
  async getOperatorAvailability(operatorId?: number): Promise<(OperatorAvailability & { operator?: Operator })[]> {
    let query = db.select({
      id: operatorAvailability.id,
      operatorId: operatorAvailability.operatorId,
      startDate: operatorAvailability.startDate,
      endDate: operatorAvailability.endDate,
      notes: operatorAvailability.notes,
      createdAt: operatorAvailability.createdAt,
      operator: operators,
    })
    .from(operatorAvailability)
    .leftJoin(operators, eq(operatorAvailability.operatorId, operators.id));

    if (operatorId) {
      // @ts-ignore
      query = query.where(eq(operatorAvailability.operatorId, operatorId));
    }

    // @ts-ignore
    const results = await query.orderBy(operatorAvailability.startDate);
    return results.map(row => ({
      ...row,
      operator: row.operator || undefined,
    }));
  }

  async createOperatorAvailability(avail: InsertOperatorAvailability): Promise<OperatorAvailability> {
    const [created] = await db.insert(operatorAvailability).values(avail).returning();
    return created;
  }

  async updateOperatorAvailability(id: number, data: Partial<InsertOperatorAvailability>): Promise<OperatorAvailability> {
    const [updated] = await db.update(operatorAvailability).set(data).where(eq(operatorAvailability.id, id)).returning();
    return updated;
  }

  async deleteOperatorAvailability(id: number): Promise<void> {
    await db.delete(operatorAvailability).where(eq(operatorAvailability.id, id));
  }

  async getOperatorDocuments(operatorId: number): Promise<OperatorDocument[]> {
    return await db.select().from(operatorDocuments).where(eq(operatorDocuments.operatorId, operatorId)).orderBy(desc(operatorDocuments.createdAt));
  }

  async createOperatorDocument(doc: InsertOperatorDocument): Promise<OperatorDocument> {
    const [result] = await db.insert(operatorDocuments).values(doc).returning();
    return result;
  }

  async deleteOperatorDocument(id: number): Promise<void> {
    await db.delete(operatorDocuments).where(eq(operatorDocuments.id, id));
  }

  // Customer Contacts
  async getCustomerContacts(customerId: number): Promise<CustomerContact[]> {
    return await db.select().from(customerContacts).where(eq(customerContacts.customerId, customerId)).orderBy(customerContacts.name);
  }

  async createCustomerContact(contact: InsertCustomerContact): Promise<CustomerContact> {
    const [created] = await db.insert(customerContacts).values(contact).returning();
    return created;
  }

  async updateCustomerContact(id: number, updates: Partial<InsertCustomerContact>): Promise<CustomerContact> {
    const [updated] = await db.update(customerContacts).set(updates).where(eq(customerContacts.id, id)).returning();
    return updated;
  }

  async deleteCustomerContact(id: number): Promise<void> {
    await db.delete(customerContacts).where(eq(customerContacts.id, id));
  }

  async getDumpLocations(): Promise<DumpLocation[]> {
    return await db.select().from(dumpLocations).orderBy(dumpLocations.name);
  }

  async createDumpLocation(location: InsertDumpLocation): Promise<DumpLocation> {
    const [created] = await db.insert(dumpLocations).values(location).returning();
    return created;
  }

  async deleteDumpLocation(id: number): Promise<void> {
    await db.delete(dumpLocations).where(eq(dumpLocations.id, id));
  }
}

export const storage = new DatabaseStorage();
