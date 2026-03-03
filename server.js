import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import axios from "axios";
import crypto from "crypto";

// (Opcional pero útil) Para que cualquier crash se vea en Logs de Render
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("Backend Audiciones funcionando correctamente 🚀");
});

// Crear pago (Flow)
app.post("/create-payment", async (req, res) => {
  try {
    const { amount, email } = req.body;

    const apiKey = process.env.FLOW_API_KEY;
    const secretKey = process.env.FLOW_SECRET_KEY;
    const baseUrl = process.env.FLOW_BASE_URL;

    // Validaciones básicas
    if (!apiKey || !secretKey || !baseUrl) {
      return res.status(500).json({
        error:
          "Faltan variables de entorno (FLOW_API_KEY / FLOW_SECRET_KEY / FLOW_BASE_URL). Revisa Render > Environment.",
      });
    }

    if (!amount || !email) {
      return res.status(400).json({ error: "Faltan datos (amount, email)." });
    }

    const commerceOrder = `orden_${Date.now()}`;
    const subject = "Pago Audición Bailarines del Mañana";
    const currency = "CLP";

    const urlConfirmation =
      "https://bailarines-del-manana-backend.onrender.com/confirm-payment";

    const urlReturn =
      "https://bailarines-del-manana.onrender.com/pago-exitoso";

    const params = {
      apiKey,
      commerceOrder,
      subject,
      currency,
      amount: Number(amount),
      email: String(email),
      urlConfirmation,
      urlReturn,
    };

    // ✅ Firma Flow: ordenar keys y concatenar key + value (sin =, sin &)
    const keys = Object.keys(params).sort();
    let toSign = "";
    for (const key of keys) {
      toSign += key + String(params[key]);
    }

    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(toSign)
      .digest("hex");

    // ✅ Body x-www-form-urlencoded
    const body = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ),
      s: signature,
    }).toString();

    const response = await axios.post(`${baseUrl}/payment/create`, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    // Flow responde { url, token, flowOrder, ... }
    return res.json(response.data);
  } catch (error) {
    const details = error.response?.data || error.message;
    console.error("FLOW ERROR:", details);
    return res.status(500).json({ error: "Error creando pago", details });
  }
});

// Webhook de confirmación (Flow llamará aquí)
app.post("/confirm-payment", (req, res) => {
  console.log("Confirmación recibida de Flow:", req.body);
  res.status(200).send("OK");
});

// ✅ Importante para Render: bind al puerto asignado
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});