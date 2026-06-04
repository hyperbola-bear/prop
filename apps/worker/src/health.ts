import { createServer, type Server } from "node:http";
import type { StopTask } from "./ticker";

type HealthServerOptions = {
  port: number;
};

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export function startHealthServer({ port }: HealthServerOptions): StopTask {
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });

  server.listen(port, () => {
    console.log(`[worker] health: listening on ${port}`);
  });

  return async () => {
    await closeServer(server);
    console.log("[worker] health: stopped");
  };
}
