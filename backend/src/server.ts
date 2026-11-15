import { app, prisma } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
const server = app.listen(port, () => {
  console.info(`Outpost Commander API listening on http://localhost:${port}`);
});

process.on("SIGINT", () => {
  server.close(() => void prisma.$disconnect());
});
process.on("SIGTERM", () => {
  server.close(() => void prisma.$disconnect());
});
