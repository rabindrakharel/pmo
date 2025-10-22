/**
 * Fastify Logger Type Augmentation
 * Makes the logger more permissive to accept any error types
 */

declare module 'fastify' {
  interface FastifyBaseLogger {
    error(msg: string, ...args: any[]): void;
    error(obj: unknown, msg?: string, ...args: any[]): void;
    warn(msg: string, ...args: any[]): void;
    warn(obj: unknown, msg?: string, ...args: any[]): void;
    info(msg: string, ...args: any[]): void;
    info(obj: unknown, msg?: string, ...args: any[]): void;
    debug(msg: string, ...args: any[]): void;
    debug(obj: unknown, msg?: string, ...args: any[]): void;
    trace(msg: string, ...args: any[]): void;
    trace(obj: unknown, msg?: string, ...args: any[]): void;
    fatal(msg: string, ...args: any[]): void;
    fatal(obj: unknown, msg?: string, ...args: any[]): void;
  }
}

export {};
