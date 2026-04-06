export class HcmMockService {
  private balances = new Map<string, number>();

  getBalance(employeeId: string, locationId: string) {
    const key = `${employeeId}-${locationId}`;
    return this.balances.get(key) ?? 10;
  }

  deductBalance(employeeId: string, locationId: string, days: number) {
    const key = `${employeeId}-${locationId}`;
    const current = this.getBalance(employeeId, locationId);
    if (current >= days) {
      this.balances.set(key, current - days);
      return { success: true };
    }
    return { success: false, error: 'Insufficient balance' };
  }
}