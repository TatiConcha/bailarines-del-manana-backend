import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import axios from "axios";
import crypto from "crypto";
import querystring from "querystring"; 

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend Audiciones funcionando correctamente 🚀");
});

import axios from "axios";
import crypto from "crypto";
import querystring from "node:querystring";

app.post("/create-payment", async (req, res) => {
  try {
    const { amount, email } = req.body;

    const apiKey = process.env.FLOW_API_KEY;
    const secretKey = process.env.FLOW_SECRET_KEY;
    const baseUrl = process.env.FLOW_BASE_URL;

    if (!apiKey || !secretKey || !baseUrl) {
      return res.status(500).json({
        error: "Faltan variables de entorno en el backend (FLOW_API_KEY / FLOW_SECRET_KEY / FLOW_BASE_URL).",
      });
    }

    const commerceOrder = `orden_${Date.now()}`;
    const subject = "Pago Audición Bailarines del Mañana";
    const currency = "CLP";

    const urlConfirmation =
      "https://bailarines-del-manana-backend.onrender.com/confirm-payment";

    const urlReturn =
      "https://bailarines-del-manana.onrender.com/pago-exitoso";

    // ✅ params requeridos por Flow
    const params = {
      apiKey,
      commerceOrder,
      subject,
      currency,
      amount: Number(amount), // asegurar número
      email,
      urlConfirmation,
      urlReturn,
    };

    // ✅ Firma correcta: ordenar keys y concatenar key + value (sin =, sin &)
    const keys = Object.keys(params).sort();
    let toSign = "";
    for (const key of keys) {
      toSign += key + String(params[key]);
    }

    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(toSign)
      .digest("hex");

    // ✅ Body urlencoded
    const body = querystring.stringify({
      ...params,
      s: signature,
    });

    const response = await axios.post(`${baseUrl}/payment/create`, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    // Flow responde JSON con { url, token, flowOrder }
    return res.json(response.data);
  } catch (error) {
    const details = error.response?.data || error.message;
    console.error("FLOW ERROR:", details);
    return res.status(500).json({ error: "Error creando pago", details });
  }
});