"use client"

import { useState, useEffect, useCallback, useSyncExternalStore } from "react"
import type { PipelineLead } from "./wholesaling-engine"

// --- Saved Entity Types ---

export interface SavedMarket {
  id: string
  city: string
  state: string
  searchType: "houses" | "land"
  msaPopulation: number
  cityPopulation: number
  medianPrice: number
  daysOnMarket: number
  pendingRatio: number
  score: number
  verdict: "ideal" | "borderline" | "disqualified"
  aiSummary: string
  zipCodes: string[]
  dateAnalyzed: string
  isAttorneyState: boolean
  isNonDisclosure: boolean
  isRestricted: boolean
  // Land-specific saved data
  landMaxPrice?: number
  landUse?: string
  minAcres?: number
  maxAcres?: number
  landExitStrategies?: string[]
}

export interface SavedDeal {
  id: string
  address: string
  city: string
  state: string
  listPrice: number
  zestimate: number
  askingPrice: number
  arv: number
  repairEstimate: number
  mao: number
  qualifierPrice: number
  spread: number
  motivationScore: number
  motivatedKeywords: string[]
  aiVerdict: string
  dateAnalyzed: string
  linkedLeadId?: string
}

export interface SavedBuyer {
  id: string
  name: string
  email: string
  phone: string
  type: "cash-buyer" | "landlord" | "llc" | "fix-flip" | "brrrr" | "turnkey" | "other"
  buyBox: string
  markets: string[]
  maxPrice: number
  notes: string
  dateAdded: string
  lastContact: string
  dealsSent: number
}

export interface KpiData {
  marketsTested: number
  dealsAnalyzed: number
  leadsContacted: number
  qualifiedLeads: number
  offersSent: number
  underContract: number
  closedDeals: number
  partnerSubmissions: number
  estimatedSpread: number
  buyerContacts: number
  outreachSent: number
  date: string
}

export interface DailyChecklist {
  date: string
  items: Record<string, boolean>
}

export interface LoggedContact {
  id: string
  sellerName: string
  address: string
  city: string
  state: string
  sellerPhone: string
  sellerEmail: string
  listPrice: number
  motivationLevel: string
  leadSource: string
  dateLogged: string
  arv?: number
  repairEstimate?: number
  notes?: string
}

export interface PrefillData {
  // Market -> Deal flow
  city?: string
  state?: string
  marketMedian?: number
  msaPopulation?: number
  cityPopulation?: number
  medianPrice?: number
  daysOnMarket?: number
  pendingRatio?: number
  aiMarketData?: Record<string, unknown>
  // Deal -> Lead flow
  address?: string
  listPrice?: number
  zestimate?: number
  askingPrice?: number
  arv?: number
  repairEstimate?: number
  mao?: number
  spread?: number
  motivationScore?: number
  // Lead -> Outreach flow
  sellerName?: string
  sellerPhone?: string
  sellerEmail?: string
  leadSource?: string
  // Deal -> Dispo flow
  assignmentPrice?: number
  // General
  leadId?: string
}

// --- localStorage helpers ---

function getStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(`dealcmd_${key}`)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function setStored<T>(key: string, value: T): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(`dealcmd_${key}`, JSON.stringify(value))
  } catch {
    // storage full, ignore
  }
}

// --- External Store for cross-component reactivity ---

type Listener = () => void

class Store<T> {
  private value: T
  private key: string
  private listeners = new Set<Listener>()

  constructor(key: string, fallback: T) {
    this.key = key
    this.value = getStored(key, fallback)
  }

  getSnapshot = (): T => this.value

  getServerSnapshot = (): T => this.value

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  set(updater: T | ((prev: T) => T)): void {
    const newValue = typeof updater === "function"
      ? (updater as (prev: T) => T)(this.value)
      : updater
    this.value = newValue
    setStored(this.key, newValue)
    this.listeners.forEach((l) => l())
  }

  get(): T {
    return this.value
  }
}

// --- Global Store Instances ---

const marketsStore = new Store<SavedMarket[]>("markets", [])
const dealsStore = new Store<SavedDeal[]>("deals", [])
const leadsStore = new Store<PipelineLead[]>("leads", [])
const buyersStore = new Store<SavedBuyer[]>("buyers", [])
const kpiStore = new Store<KpiData>("kpi", {
  marketsTested: 0,
  dealsAnalyzed: 0,
  leadsContacted: 0,
  qualifiedLeads: 0,
  offersSent: 0,
  underContract: 0,
  closedDeals: 0,
  partnerSubmissions: 0,
  estimatedSpread: 0,
  buyerContacts: 0,
  outreachSent: 0,
  date: new Date().toISOString().split("T")[0],
})
const checklistStore = new Store<DailyChecklist>("checklist", {
  date: new Date().toISOString().split("T")[0],
  items: {},
})
const userNameStore = new Store<string>("userName", "")
const contactsStore = new Store<LoggedContact[]>("loggedContacts", [])

// --- Hook ---

function useStore<T>(store: Store<T>) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}

// --- Main App Store Hook ---

export function useAppStore() {
  const savedMarkets = useStore(marketsStore)
  const savedDeals = useStore(dealsStore)
  const leads = useStore(leadsStore)
  const savedBuyers = useStore(buyersStore)
  const kpiData = useStore(kpiStore)
  const checklist = useStore(checklistStore)
  const userName = useStore(userNameStore)
  const loggedContacts = useStore(contactsStore)

  // --- Market actions ---
  const addMarket = useCallback((market: Omit<SavedMarket, "id" | "dateAnalyzed">) => {
    const newMarket: SavedMarket = {
      ...market,
      id: crypto.randomUUID(),
      dateAnalyzed: new Date().toISOString(),
    }
    marketsStore.set((prev) => [newMarket, ...prev])
    bumpKpi("marketsTested")
    return newMarket
  }, [])

  const removeMarket = useCallback((id: string) => {
    marketsStore.set((prev) => prev.filter((m) => m.id !== id))
  }, [])

  // --- Deal actions ---
  const addDeal = useCallback((deal: Omit<SavedDeal, "id" | "dateAnalyzed">) => {
    const newDeal: SavedDeal = {
      ...deal,
      id: crypto.randomUUID(),
      dateAnalyzed: new Date().toISOString(),
    }
    dealsStore.set((prev) => [newDeal, ...prev])
    bumpKpi("dealsAnalyzed")
    if (deal.spread > 0) {
      kpiStore.set((prev) => ({ ...prev, estimatedSpread: prev.estimatedSpread + deal.spread }))
    }
    return newDeal
  }, [])

  const removeDeal = useCallback((id: string) => {
    dealsStore.set((prev) => prev.filter((d) => d.id !== id))
  }, [])

  // --- Lead actions ---
  const addLead = useCallback((lead: Omit<PipelineLead, "id" | "dateAdded">) => {
    // Deduplicate: if a lead with the same street address already exists, update it
    const normalizeAddr = (a: string) => a.split(",")[0].trim().toLowerCase().replace(/\s+/g, " ")
    const existing = leadsStore.get().find(
      (l) => normalizeAddr(l.address) === normalizeAddr(lead.address)
    )
    if (existing) {
      // Merge new data into existing lead, keeping the original id and dateAdded
      const merged = { ...existing, ...lead, id: existing.id, dateAdded: existing.dateAdded }
      leadsStore.set((prev) => prev.map((l) => (l.id === existing.id ? merged : l)))
      return merged
    }
    const newLead: PipelineLead = {
      ...lead,
      id: crypto.randomUUID(),
      dateAdded: new Date().toISOString(),
    }
    leadsStore.set((prev) => [newLead, ...prev])
    return newLead
  }, [])

  const updateLead = useCallback((id: string, updates: Partial<PipelineLead>) => {
    leadsStore.set((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }, [])

  const removeLead = useCallback((id: string) => {
    leadsStore.set((prev) => prev.filter((l) => l.id !== id))
  }, [])

  // --- Buyer actions ---
  const addBuyer = useCallback((buyer: Omit<SavedBuyer, "id" | "dateAdded" | "dealsSent">) => {
    const newBuyer: SavedBuyer = {
      ...buyer,
      id: crypto.randomUUID(),
      dateAdded: new Date().toISOString(),
      dealsSent: 0,
    }
    buyersStore.set((prev) => [newBuyer, ...prev])
    bumpKpi("buyerContacts")
    return newBuyer
  }, [])

  const updateBuyer = useCallback((id: string, updates: Partial<SavedBuyer>) => {
    buyersStore.set((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)))
  }, [])

  const removeBuyer = useCallback((id: string) => {
    buyersStore.set((prev) => prev.filter((b) => b.id !== id))
  }, [])

  // --- KPI actions ---
  const bumpKpi = useCallback((field: keyof Omit<KpiData, "date">, amount = 1) => {
    kpiStore.set((prev) => {
      const today = new Date().toISOString().split("T")[0]
      const base = prev.date === today ? prev : {
        marketsTested: 0, dealsAnalyzed: 0, leadsContacted: 0, qualifiedLeads: 0,
        offersSent: 0, underContract: 0, closedDeals: 0, partnerSubmissions: 0,
        estimatedSpread: 0, buyerContacts: 0, outreachSent: 0, date: today,
      }
      return { ...base, [field]: (base[field] as number) + amount }
    })
  }, [])

  const setKpiField = useCallback((field: keyof Omit<KpiData, "date">, value: number) => {
    kpiStore.set((prev) => ({ ...prev, [field]: value }))
  }, [])

  // --- User profile actions ---
  const setUserName = useCallback((newName: string) => {
    userNameStore.set(newName)
  }, [])

  // --- Logged contact actions ---
  const addContact = useCallback((contact: Omit<LoggedContact, "id" | "dateLogged">) => {
    const newContact: LoggedContact = {
      ...contact,
      id: crypto.randomUUID(),
      dateLogged: new Date().toISOString(),
    }
    contactsStore.set((prev) => [newContact, ...prev])
    return newContact
  }, [])

  const removeContact = useCallback((id: string) => {
    contactsStore.set((prev) => prev.filter((c) => c.id !== id))
  }, [])

  // --- Checklist actions ---
  const toggleChecklistItem = useCallback((itemKey: string) => {
    checklistStore.set((prev) => {
      const today = new Date().toISOString().split("T")[0]
      const base = prev.date === today ? prev : { date: today, items: {} }
      return {
        ...base,
        items: { ...base.items, [itemKey]: !base.items[itemKey] },
      }
    })
  }, [])

  return {
    // Data
    savedMarkets,
    savedDeals,
    leads,
    savedBuyers,
    kpiData,
    checklist,
    userName,
    loggedContacts,
    // Market
    addMarket,
    removeMarket,
    // Deal
    addDeal,
    removeDeal,
    // Lead
    addLead,
    updateLead,
    removeLead,
    // Buyer
    addBuyer,
    updateBuyer,
    removeBuyer,
    // KPI
    bumpKpi,
    setKpiField,
    // User Profile
    setUserName,
    // Contacts
    addContact,
    removeContact,
    // Checklist
    toggleChecklistItem,
  }
}

export type AppStore = ReturnType<typeof useAppStore>

// Re-export the type for convenience
export type PageId = "dashboard" | "finder" | "scout" | "market" | "deal" | "qualification" | "pipeline" | "outreach" | "partner" | "dispo" | "kpi"
