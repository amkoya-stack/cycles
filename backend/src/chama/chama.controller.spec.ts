import { Test, TestingModule } from '@nestjs/testing';
import { ChamaController } from './chama.controller';

describe('ChamaController', () => {
  let controller: ChamaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChamaController],
    }).compile();

    controller = module.get<ChamaController>(ChamaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
