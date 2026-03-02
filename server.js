import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import axios from "axios";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend Audiciones funcionando correctamente 🚀");
});

app.post("/create-payment", async (req, res) => {
  try {
    const { amount, email } = req.body;

    const apiKey = process.env.FLOW_API_KEY;
    const secretKey = process.env.FLOW_SECRET_KEY;
    const baseUrl = process.env.FLOW_BASE_URL;

    const commerceOrder = `orden_${Date.now()}`;
    const subject = "Pago Audición Bailarines del Mañana";
    const currency = "CLP";
    const urlConfirmation = "https://bailarines-del-manana-backend.onrender.com/confirm-payment";
    const urlReturn = "https://bailarines-del-manana.onrender.com/pago-exitoso";
    const params = {
      apiKey,
      commerceOrder,
      subject,
      currency,
      amount,
      email,
      urlConfirmation,
      urlReturn
    };

    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join("&");

    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(sortedParams)
      .digest("hex");

    const response = await axios.post(`${baseUrl}/payment/create`, {
      ...params,
      s: signature
    });

    res.json(response.data);

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Error creando pago" });
  }
});

app.post("/confirm-payment", (req, res) => {
  console.log("Confirmación recibida de Flow:", req.body);
  res.status(200).send("OK");
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});