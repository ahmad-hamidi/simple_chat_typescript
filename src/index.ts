import express, { Request, Response } from "express";
import { db } from "./firestore";

const app = express();
const port = 3000;

app.get("/hello", (req: Request, res: Response) => {
  res.json({ message: "Hello, Worldx!" });
});


app.get("/firestore-firebase", async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection("users").get(); // ubah "users" ke nama koleksi kamu
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json(data);
  } catch (error) {
    console.error("Error getting Firestore data:", error);
    res.status(500).json({ error: "Failed to fetch Firestore data" });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
