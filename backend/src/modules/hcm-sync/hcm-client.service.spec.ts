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

    it('should handle missing locationId by sending undefined to HCM', async () => {
      httpService.post.mockReturnValue(of(mockAxiosResponse({ balanceDays: 10 })));
      await service.deductBalance('emp-1', undefined as any, 5);
      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ locationId: undefined })
      );
    });

    it('should throw when HCM returns 500 status', async () => {
      const error = { response: { status: 500 }, message: 'Internal Server Error' };
      httpService.post.mockReturnValue(throwError(() => error));
      await expect(service.deductBalance('e', 'l', 1)).rejects.toEqual(error);
    });

    it('should handle malformed response body by returning undefined balanceDays if property missing', async () => {
      httpService.post.mockReturnValue(of(mockAxiosResponse({ wrongKey: 10 })));
      const result = await service.deductBalance('e', 'l', 1);
      expect(result.balanceDays).toBeUndefined();
    });
  });

  describe('Health Checks', () => {
    it('should use localhost:3001 by default', async () => {
      httpService.get.mockReturnValue(of(mockAxiosResponse({})));
      await service.fetchBalance('e', 'l');
      expect(httpService.get).toHaveBeenCalledWith(expect.stringContaining('localhost:3001'));
    });
  });
});
