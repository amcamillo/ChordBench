import { createServer } from 'vite';

export default async function setup() {
  // Own the server directly so Windows cleanup does not depend on terminating
  // a nested npm/cmd process tree. Use a dedicated test port.
  const server = await createServer({ server: { host: '127.0.0.1', port: 5174, strictPort: true } });
  await server.listen();
  return () => server.close();
}
