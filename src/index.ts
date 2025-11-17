import express, { Request, Response } from "express";
import { db } from "./firestore";
import admin from "firebase-admin";

const cors = require('cors');
const app = express();
const port = 55536;
const bcrypt = require("bcryptjs");

app.use(express.json());  
app.use(cors({
  //origin: 'http://localhost:55536',
   origin: '*', 
}));

app.get("/hello", (req: Request, res: Response) => {
  res.json({ message: "Hello, World!" });
});


app.get("/list-users", async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection("users").get();
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


app.post("/register", async (req: Request, res: Response) => {
  try {
    const { fullname, email, password } = req.body;

    if (!fullname) {
      return res.status(400).json({ error: "Fullname are required" });
    }

    if (!email) {
      return res.status(400).json({ error: "Email are required" });
    }

    const isEmailExisting = await db
      .collection("users")
      .where("email", "==", email)
      .get();

    if (!isEmailExisting.empty) {
      return res.status(400).json({ error: "Email already exists" });
    }

    if (!password) {
      return res.status(400).json({ error: "Password are required" });
    }

    const user_id = Date.now();
    const passwordHash = await bcrypt.hash(password, 10);

    const docRef = await db.collection("users").add({
      user_id,
      fullname,
      email,
      password: passwordHash
    });

    res.status(201).json({ message: "Users added successfully", user_id: user_id });
  } catch (error) {
    console.error("Error adding document:", error);
    res.status(500).json({ error: "Failed to add data to Firestore" });
  }
});

app.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;


    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const userSnapshot = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      return res.status(400).json({ error: "Account not found" });
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    const isMatch = await bcrypt.compare(password, userData.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Incorrect password" });
    }

    const { password: _, ...safeUserData } = userData;

    res.status(200).json({
      message: "Login successfully",
      user: {
        id: userDoc.id,
        ...safeUserData,
      },
    });
  } catch (error) {
    console.error("Error login:", error);
    res
      .status(500)
      .json({ error: "Failed to login, something went wrong on server" });
  }
});

app.post("/add-message", async (req: Request, res: Response) => {
  try {
    const { sender_id, receiver_id, message } = req.body;

    if (!sender_id || !receiver_id || !message) {
      return res.status(400).json({ error: "sender_id, receiver_id, and message are required" });
    }

    const roomId = [sender_id, receiver_id].sort().join("_");

    await db
      .collection("chats")
      .doc(roomId)
      .collection("messages")
      .add({
         participants: [sender_id, receiver_id],
        sender_id,
        receiver_id,
        message,
        timestamp: Date.now(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      
      await db.collection("chats").doc(roomId).set({
        participants: [sender_id, receiver_id],
        lastMessage: message,
        lastSenderId: sender_id,
        updatedAt: Date.now(),
      },
      { merge: true });

    res.status(201).json({
      message: "Message sent",
      roomId: roomId,
    });
  } catch (error) {
    console.error("Error adding message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.get("/chat-list", async (req: Request, res: Response) => {
  try {
    const userId = req.query.user_id as string;

    if (!userId) {
      return res.status(400).json({ error: "user_id query parameter is required" });
    }

    const chatsSnapshot = await db
      .collection("chats")
      //.doc("1763248750882_1763307295505")
      //.collection("messages")
      .where("participants", "array-contains", Number(userId))
      .get();
      
    if (chatsSnapshot.empty) {
      return res.status(200).json({
        message: "No chat rooms found for this user " + userId,
        chats: [],
      });
    }

    const chatList = chatsSnapshot.docs.map((doc) => {
      const data = doc.data() as any;

      const otherUserId = data.participants.find(
        (p: any) => String(p) !== String(userId)
      );

      return {
        roomId: doc.id,
        participants: data.participants,
        otherUserId,
        lastMessage: data.lastMessage || null,
        lastSenderId: data.lastSenderId || null,
        updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : data.updatedAt,
      };
    });

    res.status(200).json({
      message: "Chat list fetched successfully",
      chats: chatList,
    });
  } catch (error) {
    console.error("Error fetching chat list:", error);
    res.status(500).json({
      error: "Failed to fetch chat list from Firestore",
    });
  }
});

app.get("/all-chat", async (req: Request, res: Response) => {
  try {

    const chatsSnapshot = await db
      .collectionGroup("messages")
      .get();
      
    if (chatsSnapshot.empty) {
      return res.status(200).json({
        message: "No chat rooms",
        chats: [],
      });
    }

    const chatList = await Promise.all(
      chatsSnapshot.docs.map(async (doc) => {
        const data = doc.data();

        const senderId = String(data.sender_id);
        const receiverId = String(data.receiver_id);

        const senderDoc = await db.collection("users")
        .where("user_id", "==", Number(senderId))
        .limit(1)
        .get();

        const senderName = senderDoc.empty ? null : senderDoc.docs[0].data().fullname;
        
        const receiverDoc = await db.collection("users")
        .where("user_id", "==", Number(receiverId))
        .limit(1)
        .get();

        const receiverName = receiverDoc.empty ? null : receiverDoc.docs[0].data().fullname;

        const { sender_id, receiver_id, updatedAt, roomId, ...response } = data;
        
        return {
          roomId: doc.ref.parent.parent?.id,
          ...response,
          senderName: senderName,
          receiverName: receiverName,
        };
      })
    );

    res.status(200).json({
      message: "Chat list fetched successfully ",
      chats: chatList,
    });
  } catch (error) {
    console.error("Error fetching all chat :", error);
    res.status(500).json({
      error: "Failed to fetch all chat from Firestore",
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
