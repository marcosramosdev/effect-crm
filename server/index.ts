import { Hono } from "hono";

const app = new Hono();

app.get("/hono", (c) => {
  return c.text("Hello Hono!");
});

export default app;
