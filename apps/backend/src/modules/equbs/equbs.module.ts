import { Module } from '@nestjs/common';
import { EqubsController } from './equbs.controller';
import { EqubsService } from './equbs.service';
import { EqubsRepository } from './equbs.repository';

@Module({
    controllers: [EqubsController],
    providers: [EqubsService, EqubsRepository],
    exports: [EqubsService],
})
export class EqubsModule {}
