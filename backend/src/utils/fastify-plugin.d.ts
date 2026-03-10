declare module "fastify-plugin" {
  import type { FastifyPluginCallback, FastifyPluginAsync } from "fastify";
  function fp<T>(
    fn: FastifyPluginCallback<T> | FastifyPluginAsync<T>,
    options?: { name?: string; fastify?: string; decorators?: { fastify?: string[]; reply?: string[]; request?: string[] }; dependencies?: string[] }
  ): FastifyPluginCallback<T>;
  export = fp;
}
