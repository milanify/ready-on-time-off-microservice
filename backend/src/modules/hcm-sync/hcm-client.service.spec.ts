import { Test, TestingModule } from '@nestjs/testing';
import { HcmClientService } from './hcm-client.service';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosHeaders } from 'axios';

describe('HcmClientService', () => {
  let service: HcmClientService;
  let httpService: any;

  const mockAxiosResponse = (data: any): AxiosResponse => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

  beforeEach(async () => {
    httpService = {
      get: jest.fn(),
      post: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HcmClientService,
        { provide: HttpService, useValue: httpService },
      ],
    }).compile();

    service = module.get<HcmClientService>(HcmClientService);
  });

  describe('fetchBalance', () => {
    it('should fetch balance from correct HCM URL', async () => {
      httpService.get.mockReturnValue(of(mockAxiosResponse({ balanceDays: 25, locationId: 'US-NY' })));

      const result = await service.fetchBalance('emp-1', 'US-NY');

      expect(httpService.get).toHaveBeenCalledWith('http://localhost:3001/mock-hcm/balances/emp-1/US-NY');
      expect(result.balanceDays).toBe(25);
    });

    it('should propagate errors from HCM', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('Connection refused')));

      await expect(service.fetchBalance('emp-1', 'US-NY')).rejects.toThrow('Connection refused');
    });

    it('should handle zero balance response', async () => {
      httpService.get.mockReturnValue(of(mockAxiosResponse({ balanceDays: 0, locationId: 'US-NY' })));

      const result = await service.fetchBalance('emp-1', 'US-NY');
      expect(result.balanceDays).toBe(0);
    });
  });

  describe('deductBalance', () => {
    it('should POST deduction to correct HCM URL', async () => {
      httpService.post.mockReturnValue(of(mockAxiosResponse({ balanceDays: 18 })));

      const result = await service.deductBalance('emp-1', 'US-NY', 7);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:3001/mock-hcm/balances/deduct',
        { employeeId: 'emp-1', locationId: 'US-NY', amount: 7 }
      );
      expect(result.balanceDays).toBe(18);
    });

    it('should propagate 400 errors from HCM on insufficient balance', async () => {
      const error = { response: { status: 400 }, message: 'Insufficient balance in HCM' };
      httpService.post.mockReturnValue(throwError(() => error));

      await expect(service.deductBalance('emp-1', 'US-NY', 100)).rejects.toEqual(error);
    });

    it('should propagate network errors', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));

      await expect(service.deductBalance('emp-1', 'US-NY', 5)).rejects.toThrow('ECONNREFUSED');
    });

    it('should handle negative amounts (credits/refunds)', async () => {
      httpService.post.mockReturnValue(of(mockAxiosResponse({ balanceDays: 32 })));

      const result = await service.deductBalance('emp-1', 'US-NY', -5);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:3001/mock-hcm/balances/deduct',
        { employeeId: 'emp-1', locationId: 'US-NY', amount: -5 }
      );
    });
  });
});
