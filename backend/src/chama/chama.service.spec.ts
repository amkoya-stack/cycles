import { Test, TestingModule } from '@nestjs/testing';
import { ChamaService } from './chama.service';

describe('ChamaService', () => {
  let service: ChamaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChamaService],
    }).compile();

    service = module.get<ChamaService>(ChamaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
