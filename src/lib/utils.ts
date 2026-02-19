import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export const generateId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
