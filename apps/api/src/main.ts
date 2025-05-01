import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import fastify from 'fastify';
import { AppModule } from './app/app.module';
import fastifyCors from '@fastify/cors';

// Carga variables de entorno desde .env según el entorno
dotenv.config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
});

async function bootstrap() {
  const ssl = process.env.SSL === 'true';
  const port = Number(process.env.PORT) || 3000;
  const httpPort = Number(process.env.HTTP_PORT) || 80;
  const hostname = process.env.HOSTNAME || '127.0.0.1';
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['https://your-frontend.com']; // Ajusta en producción

  // Configuración de certificados
  const CERTS_FOLDER = path.resolve(__dirname, 'certs');
  let httpsOptions = {};
  if (ssl) {
    const keyPath = path.join(CERTS_FOLDER, 'key.pem');
    const certPath = path.join(CERTS_FOLDER, 'cert.pem');

    if (!fs.existsSync(keyPath)) {
      throw new Error(`Certificate key not found at ${keyPath}`);
    }
    if (!fs.existsSync(certPath)) {
      throw new Error(`Certificate not found at ${certPath}`);
    }

    httpsOptions = {
      allowHTTP1: true,
      http2: true,
      https: {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      },
    };
  }

  // Crear instancia de Fastify
  const fastifyInstance = fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    ...httpsOptions,
  });

  // Configurar CORS
  fastifyInstance.register(fastifyCors, {
    origin:
      process.env.NODE_ENV === 'production'
        ? allowedOrigins
        : true, // Permite todos en desarrollo
    methods: ['GET', 'POST', 'DELETE', 'PATCH'],
    credentials: true, // Si necesitas cookies o autenticación
  });

  // Crear adaptador Fastify
  const adapter = new FastifyAdapter(fastifyInstance);


  // Crear aplicación NestJS
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);
  app.setGlobalPrefix('api');

  try {
    // Iniciar el servidor
    await app.listen({ port, host: hostname });
    Logger.log(
      `🚀 API corriendo en: http${ssl ? 's' : ''}://${hostname}:${port}/api`,
    );

    // Redirección HTTP a HTTPS si SSL está habilitado
    if (ssl) {
      const httpRedirectServer = fastify({ logger: true });
      httpRedirectServer.get('*', (req, reply) => {
        const target = `https://${hostname}:${port}${req.raw.url}`;
        reply.redirect(target); // Redirección permanente
      });

      await httpRedirectServer.listen({ port: httpPort, host: hostname });
      Logger.log(
        `🌐 Redirección HTTP activa en: http://${hostname}:${httpPort} → https://${hostname}:${port}`,
      );
    }
  } catch (error) {
    Logger.error(`Error al iniciar la aplicación: ${error.message}`, error.stack);
    process.exit(1);
  }
}
/*
async function bootstrap() {
  const app = await NestFactory.create(ApiModule, new FastifyAdapter());
  app.setGlobalPrefix('api');
  await app.listen(3000, '127.0.0.1');
  console.log(`🚀 API corriendo en: http://127.0.0.1:3000/api`);
}
*/
bootstrap().catch((error) => {
  Logger.error(`Error en bootstrap: ${error.message}`, error.stack);
  process.exit(1);
});