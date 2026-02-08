import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatOperatorShortName(op: { firstName: string; lastName: string }): string {
  return `${op.lastName}, ${op.firstName.charAt(0)}`;
}

export function formatOperatorFullName(op: { firstName: string; lastName: string }): string {
  return `${op.firstName} ${op.lastName}`;
}
