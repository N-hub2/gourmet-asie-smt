// Contract only. No adapter is configured and no transmission is claimed.
export interface PosOrderSnapshot {
  orderId: string
  tableReference: string
  items: ReadonlyArray<{ productReference: string; variantReference: string; quantity: number; unitPriceCents: number }>
}
export interface PosIntegration {
  sendOrder(order: PosOrderSnapshot, idempotencyKey: string): Promise<{ externalReference: string }>
}
