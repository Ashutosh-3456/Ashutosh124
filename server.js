import express from "express";
import dotenv from "dotenv";
import twilio from "twilio";
import cors from "cors";

dotenv.config();

const app = express();

// Allow your React frontend to communicate with the backend
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

// Check whether Twilio credentials exist
if (
  !process.env.TWILIO_ACCOUNT_SID ||
  !process.env.TWILIO_AUTH_TOKEN ||
  !process.env.TWILIO_VERIFY_SERVICE_SID
) {
  console.warn(
    "WARNING: Missing Twilio environment variables. Check your .env file."
  );
}

// Create Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/* =====================================================
   SEND OTP
===================================================== */

app.post("/api/send-otp", async (req, res) => {
  console.log("OTP REQUEST RECEIVED");
  console.log("Request body:", req.body);
  try {
    const { phoneNumber } = req.body;

    const normalizedPhone =
      typeof phoneNumber === "string"
        ? phoneNumber.trim()
        : "";

    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Ask Twilio Verify to send the OTP
    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({
        to: normalizedPhone,
        channel: "sms",
      });

    res.json({
      success: true,
      message: "OTP sent successfully",
      status: verification.status,
    });

  } catch (error) {
  console.error("========== TWILIO OTP ERROR ==========");
  console.error("Message:", error.message);
  console.error("Code:", error.code);
  console.error("More info:", error.moreInfo);
  console.error("Status:", error.status);
  console.error("======================================");

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Could not send OTP",
    code: error.code || null,
  });
}
});


/* =====================================================
   VERIFY OTP
===================================================== */

app.post("/api/verify-otp", async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    const normalizedPhone =
      typeof phoneNumber === "string"
        ? phoneNumber.trim()
        : "";

    if (!normalizedPhone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required",
      });
    }

    // Verify OTP using Twilio Verify
    const verificationCheck = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to: normalizedPhone,
        code: otp.trim(),
      });

    // OTP is correct
    if (verificationCheck.status === "approved") {
      return res.json({
        success: true,
        message: "OTP verified successfully",
        authorized: true,
      });
    }

    // OTP is incorrect
    return res.status(401).json({
      success: false,
      message: "Invalid OTP",
      authorized: false,
    });

  } catch (error) {
    console.error(
      "Twilio verify OTP error:",
      error?.message || error
    );

    res.status(500).json({
      success: false,
      message: "OTP verification failed",
    });
  }
});


/* =====================================================
   BACKEND HEALTH CHECK
===================================================== */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "OTP backend is running",
  });
});


/* =====================================================
   START SERVER
===================================================== */

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});