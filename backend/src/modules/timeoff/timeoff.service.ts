import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TimeOffRequest, TimeOffRequestStatus, HcmSyncStatus } from './entities/timeoff-request.entity';
import { LeaveBalance } from '../balance/entities/leave-balance.entity';
import { BalanceService } from '../balance/balance.service';

@Injectable()
export class TimeOffService {
  private readonly logger = new Logger(TimeOffService.name);

  constructor(
    @InjectRepository(TimeOffRequest)
    private readonly requestRepo: Repository<TimeOffRequest>,
    private readonly balanceService: BalanceService,
    private readonly dataSource: DataSource,
  ) {}

  async submitRequest(employeeId: string, locationId: string, daysRequested: number) {
    if (daysRequested <= 0) throw new BadRequestException('Days requested must be positive');

    // Make sure we have the cache ready
    await this.balanceService.getAvailableBalance(employeeId, locationId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const balance = await queryRunner.manager.findOne(LeaveBalance, {
        where: { employeeId, locationId },
      });

      if (!balance) throw new BadRequestException('Balance missing during transaction');

      const available = Number(balance.balanceDays) - Number(balance.reservedDays);
      if (available < daysRequested) {
        throw new BadRequestException('Insufficient balance available locally');
      }

      // Soft reserve
      balance.reservedDays = Number(balance.reservedDays) + daysRequested;
      await queryRunner.manager.save(LeaveBalance, balance);

      const request = queryRunner.manager.create(TimeOffRequest, {
        employeeId,
        locationId,
        daysRequested,
        status: TimeOffRequestStatus.PENDING,
        hcmSyncStatus: HcmSyncStatus.PENDING_SYNC,
      });
      const savedRequest = await queryRunner.manager.save(TimeOffRequest, request);

      await queryRunner.commitTransaction();
      this.logger.log(`Request submitted and reserved for ${employeeId}`);
      return savedRequest;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getRequests(locationId?: string, status?: TimeOffRequestStatus) {
    const query: any = {};
    if (locationId) query.locationId = locationId;
    if (status) query.status = status;
    return this.requestRepo.find({ where: query });
  }

  async approveRequest(id: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = await queryRunner.manager.findOne(TimeOffRequest, { where: { id } });
      if (!request) throw new NotFoundException('Request not found');
      if (request.status !== TimeOffRequestStatus.PENDING) {
        throw new BadRequestException('Only PENDING requests can be approved');
      }

      request.status = TimeOffRequestStatus.APPROVED;
      request.hcmSyncStatus = HcmSyncStatus.PENDING_SYNC;

      // Update balance internally (convert reserved into deducted)
      const balance = await queryRunner.manager.findOne(LeaveBalance, {
        where: { employeeId: request.employeeId, locationId: request.locationId },
      });

      if (balance) {
        balance.reservedDays = Number(balance.reservedDays) - Number(request.daysRequested);
        balance.balanceDays = Number(balance.balanceDays) - Number(request.daysRequested);
        await queryRunner.manager.save(LeaveBalance, balance);
      }

      await queryRunner.manager.save(TimeOffRequest, request);
      await queryRunner.commitTransaction();

      this.logger.log(`Request ${id} approved locally, queueing outbox for HCM.`);
      return request;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async rejectRequest(id: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = await queryRunner.manager.findOne(TimeOffRequest, { where: { id } });
      if (!request) throw new NotFoundException('Request not found');
      if (request.status !== TimeOffRequestStatus.PENDING) {
        throw new BadRequestException('Only PENDING requests can be rejected');
      }

      request.status = TimeOffRequestStatus.REJECTED;

      const balance = await queryRunner.manager.findOne(LeaveBalance, {
        where: { employeeId: request.employeeId, locationId: request.locationId },
      });

      if (balance) {
        balance.reservedDays = Number(balance.reservedDays) - Number(request.daysRequested);
        await queryRunner.manager.save(LeaveBalance, balance);
      }

      await queryRunner.manager.save(TimeOffRequest, request);
      await queryRunner.commitTransaction();

      this.logger.log(`Request ${id} rejected.`);
      return request;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async cancelRequest(id: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = await queryRunner.manager.findOne(TimeOffRequest, { where: { id } });
      if (!request) throw new NotFoundException('Request not found');

      if (request.status === TimeOffRequestStatus.PENDING) {
        // Just free reserved days
        const balance = await queryRunner.manager.findOne(LeaveBalance, {
          where: { employeeId: request.employeeId, locationId: request.locationId },
        });

        if (balance) {
          balance.reservedDays = Number(balance.reservedDays) - Number(request.daysRequested);
          await queryRunner.manager.save(LeaveBalance, balance);
        }
      } else if (request.status === TimeOffRequestStatus.APPROVED) {
        // Needs a refund to both local balance and HCM, handle complex reversal later or just refund local
        const balance = await queryRunner.manager.findOne(LeaveBalance, {
          where: { employeeId: request.employeeId, locationId: request.locationId },
        });

        if (balance) {
           balance.balanceDays = Number(balance.balanceDays) + Number(request.daysRequested);
           await queryRunner.manager.save(LeaveBalance, balance);
           
           // If we synced to HCM, we should perhaps queue a reverse deduction?
           // For simplicity, TRD says "Cancel approved request -> balance restored in both systems"
           // We will mark it as PENDING_SYNC but the Cron should know it's a refund?
           // Actually, let's keep it simple: outbox cron handles CANCELLED + PENDING_SYNC.
           request.hcmSyncStatus = HcmSyncStatus.PENDING_SYNC; 
        }
      }

      request.status = TimeOffRequestStatus.CANCELLED;
      await queryRunner.manager.save(TimeOffRequest, request);
      await queryRunner.commitTransaction();

      return request;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
