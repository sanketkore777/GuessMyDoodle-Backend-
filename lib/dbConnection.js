const mongoose = require("mongoose");
require("dotenv").config();
// MongoDB connection URI
const mongoURI = process.env.MONGO_URI || "your_mongodb_connection_string";

// Function to connect to the database
const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Successfully connected to the database");
  } catch (error) {
    console.error("Error connecting to the database", error);
    process.exit(1); // Exit the process with failure
  }
};

module.exports = connectToDatabase;
