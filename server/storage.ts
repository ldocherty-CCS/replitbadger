import { db } from "./db";
import {
  users, operators, customers, jobs, qualifications, operatorQualifications,
  type User, type Operator, type Customer, type Job, type Qualification, type OperatorQualification,
  type InsertUser, type InsertOperator, type InsertCustomer, type InsertJob, type InsertQualification, type InsertOperatorQualification,
  type UpdateOperatorRequest, type UpdateCustomerRequest, type UpdateJobRequest,
  type OperatorQualificationWithDetails
} from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";

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
  getJobs(filters?: { startDate?: string; endDate?: string; operatorId?: number }): Promise<(Job & { customer?: Customer; operator?: Operator })[]>;
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
}

export class DatabaseStorage implements IStorage {
  // Operators
  async getOperators(): Promise<Operator[]> {
    return await db.select().from(operators).orderBy(operators.groupName, operators.name);
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
  async getJobs(filters?: { startDate?: string; endDate?: string; operatorId?: number }): Promise<(Job & { customer?: Customer; operator?: Operator })[]> {
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
      siteQuals: jobs.siteQuals,
      additionalOperatorNeeded: jobs.additionalOperatorNeeded,
      createdAt: jobs.createdAt,
      customer: customers,
      operator: operators,
    })
    .from(jobs)
    .leftJoin(customers, eq(jobs.customerId, customers.id))
    .leftJoin(operators, eq(jobs.operatorId, operators.id));

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
    const results = await query.orderBy(jobs.scheduledDate, jobs.startTime);
    
    return results.map(row => ({
      ...row,
      // Map joined fields to nested objects if they exist
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
    const results = await query.orderBy(operators.name, qualifications.name);
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
}

export const storage = new DatabaseStorage();
