import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module.js';
import 'dotenv/config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setViewEngine('hbs');
  app.setBaseViewsDir(join(process.cwd(), 'public/layout'));

  if(!process.env.PORT) {
    throw new Error("Port not specified!");
  }

  await app.listen(process.env.PORT);
  console.log(`Running on: http://localhost:${process.env.PORT || 3000}`);
}

bootstrap();