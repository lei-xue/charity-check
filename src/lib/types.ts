export interface LatestFiling {
  taxPeriod: number | null
  totalRevenue: number | null
  totalExpenses: number | null
  totalAssets: number | null
  pdfUrl: string | null
}

export interface Charity {
  ein: number
  name: string
  city: string | null
  state: string | null
  nteeCode: string | null
  subsectionCode: number
  rulingDate: string | null
  assetAmount: number | null
  incomeAmount: number | null
  revenueAmount: number | null
  latestFiling: LatestFiling | null
}

export type BadgeTone = 'emerald' | 'teal' | 'sky' | 'amber'

export interface Badge {
  label: string
  tone: BadgeTone
}
