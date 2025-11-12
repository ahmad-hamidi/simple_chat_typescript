import express, { Request, Response } from "express";

const app = express();
const port = 3000;

app.get("/hello", (req: Request, res: Response) => {
  res.json({ message: "Hello, Worldx!" });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
