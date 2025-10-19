import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'dotenv/config';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    if(!process.env.PORT) {
        throw new Error("Port not specified!");
    }

    await app.listen(process.env.PORT);
    console.log(`Running on: http://localhost:${process.env.PORT || 3000}`);
}

bootstrap();