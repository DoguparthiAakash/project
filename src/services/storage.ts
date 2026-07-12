import type { StoredReview } from "@/types/review"

const STORAGE_KEY = "codesage_reviews"
const MAX_STORED = 10

export function getStoredReviews(): StoredReview[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveReview(review: StoredReview): void {
  const reviews = getStoredReviews()
  const updated = [review, ...reviews].slice(0, MAX_STORED)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export function deleteReview(id: string): void {
  const reviews = getStoredReviews().filter((r) => r.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews))
}

export function clearReviews(): void {
  localStorage.removeItem(STORAGE_KEY)
}
