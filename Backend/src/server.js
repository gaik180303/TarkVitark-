// env.js loads dotenv and validates config — must be imported first
import { env } from "./config/env.js";

import connectDB from "./db/index.js";
import { app } from "./app.js";
import { DebateRoom } from "./models/debateRoom.model.js";
import setupSocket from "./socket.js";
import http from "http";

connectDB()
  .then(() => {
    const server = http.createServer(app);
    setupSocket(server);

    server.listen(env.PORT, () => {
      console.log(`Server is running at port: ${env.PORT}`);
    });

    // Periodically flip scheduled debates that are now due to "ongoing"
    setInterval(async () => {
      try {
        const result = await DebateRoom.updateMany(
          { status: "scheduled", scheduledAt: { $lte: new Date() } },
          { $set: { status: "ongoing" } }
        );
        if (result.modifiedCount > 0) {
          console.log(`${result.modifiedCount} debate(s) moved to ongoing.`);
        }
      } catch (err) {
        console.error("Error updating debate statuses:", err);
      }
    }, 60 * 1000);
  })
  .catch((err) => {
    console.log("MongoDB connection failed!", err);
    process.exit(1);
  });
