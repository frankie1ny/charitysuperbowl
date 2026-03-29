const admin = require("firebase-admin");
const path = require("path");

// Path to your service account key JSON file
const serviceAccount = require("./serviceAccountKey.json");

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://st-bernard-kofc-superbowl-grid-default-rtdb.firebaseio.com"
});

const db = admin.database();

// CONFIGURE THESE:
const SOURCE_PATH = "/publicBoards/1lmzFT7UP2UtsBMIKrINYUIT9fj2/state/pools/0"; // Pool to import
const DEST_POOLS_PATH = "/state/pools";    // Where you want to import (default)

async function importPool() {
    // Read the pool from the source location
    const snapshot = await db.ref(SOURCE_PATH).once("value");
    const poolData = snapshot.val();
    if (!poolData) {
        console.error("No pool found at source path.");
        process.exit(1);
    }

    // Append to the destination pools array
    const destRef = db.ref(DEST_POOLS_PATH);
    const destSnapshot = await destRef.once("value");
    const pools = destSnapshot.val() || [];
    pools.push(poolData);

    // Write back the updated pools array
    await destRef.set(pools);
    console.log("Pool imported successfully!");
    process.exit(0);
}

importPool().catch(err => {
    console.error("Error importing pool:", err);
    process.exit(1);
});
