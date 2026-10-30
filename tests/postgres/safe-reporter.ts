import type { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter'
export default class SafeReporter implements Reporter {
  private counts: Record<string, number> = {}
  onTestEnd(test: TestCase, result: TestResult) {
    this.counts[result.status] = (this.counts[result.status] || 0) + 1
    console.log(JSON.stringify({ test: test.title, status: result.status, durationMs: result.duration,
      errors: result.errors.map(e => e.message?.replace(/[a-fA-F0-9]{64}/g, '[REDACTED]').replace(/postgres(?:ql)?:\/\/\S+/g, '[REDACTED URL]')) }))
  }
  onEnd(result: FullResult) { console.log(JSON.stringify({ final: result.status, counts: this.counts })) }
}
