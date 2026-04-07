import { NestFactory } from '@nestjs/core';
import { HcmModule } from './hcm.module';

async function bootstrap() {
  const app = await NestFactory.create(HcmModule);
  // Optional: Global validation pipes could be added here
  app.enableCors({
    origin: 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  
  await app.listen(3001);
  console.log('Mock HCM Server is running on: http://localhost:3001');
}
bootstrap();
