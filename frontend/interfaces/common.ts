/** Generic paginated list wrapper. */
export interface IPaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

